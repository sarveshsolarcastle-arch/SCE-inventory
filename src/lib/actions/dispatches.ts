"use server";

import { prisma } from "@/lib/prisma";
import { NotPermittedError, requireCapability } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import {
  AllocationFailedError,
  StaleApprovalError,
  commitAllocation,
  type ApprovedOpens,
} from "@/lib/packs";
import { piecesTotal, type Piece } from "@/lib/units";
import { serialiseAppliedPlan } from "@/lib/corrections";
import type { AllocationRequest } from "@/lib/allocation";

/* -------------------------------------------------------------------------
 * Records a batch dispatch — the Excel-pasted, 15+ item allocation to one
 * site. Each line becomes its own ISSUE Transaction (dispatchId set), through
 * the SAME commitAllocation() single-item issues use, called once per line
 * IN ORDER inside one prisma.$transaction. That is what makes rows compete
 * for stock realistically: row 2 reads the packs row 1 just decremented,
 * because both run against the same transaction client. See planBatch in
 * allocation.ts for the client-side preview that mirrors this.
 *
 * All-or-nothing: any row failing — unmatched item, out of stock, or an open
 * beyond what was approved — throws, and Prisma rolls back everything. The
 * dispatch that gets recorded always matches the paper list exactly, or
 * nothing is recorded at all.
 * ---------------------------------------------------------------------- */

export type DispatchLineInput = {
  sourceText: string;
  itemId: string;
  sealedPacks: { packSize: number; count: number }[];
  pieces: Piece[];
  loose: number;
  /** Opens this row's reviewed plan needed, approved by whoever reviewed it. */
  approvedOpens: ApprovedOpens;
};

export type DispatchInput = {
  siteId: string;
  reference?: string | null;
  note?: string | null;
  lines: DispatchLineInput[];
};

export type DispatchResult =
  | { ok: true; dispatchId: string }
  | { ok: false; message: string; rowIndex?: number; needsApproval?: ApprovedOpens };

class RowError extends Error {
  constructor(readonly index: number, message: string) {
    super(message);
    this.name = "RowError";
  }
}

class RowStaleError extends Error {
  constructor(readonly index: number, readonly required: ApprovedOpens) {
    super("Stock changed while this batch was being reviewed.");
    this.name = "RowStaleError";
  }
}

function requestOf(line: DispatchLineInput): AllocationRequest {
  return { sealedPacks: line.sealedPacks, pieces: line.pieces, loose: line.loose };
}

function totalOf(request: AllocationRequest): number {
  const sealed = request.sealedPacks.reduce((s, p) => s + p.packSize * p.count, 0);
  return sealed + piecesTotal(request.pieces) + request.loose;
}

function positiveInt(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n > 0;
}

/** Structural validation only — whether an item exists and holds enough
 * stock is discovered inside the transaction, since that can change between
 * the review screen and the submit. */
function validateLine(line: DispatchLineInput, index: number): string | null {
  const label = `Row ${index + 1}`;
  if (!line.itemId) return `${label}: choose an item`;
  for (const p of line.sealedPacks) {
    if (!positiveInt(p.packSize) || !positiveInt(p.count)) {
      return `${label}: pack sizes and counts must be whole numbers greater than zero`;
    }
  }
  for (const p of line.pieces) {
    if (!positiveInt(p.length) || !positiveInt(p.count)) {
      return `${label}: piece lengths and counts must be whole numbers greater than zero`;
    }
  }
  if (line.loose !== 0 && !positiveInt(line.loose)) {
    return `${label}: quantity must be a whole number greater than zero`;
  }
  if (totalOf(requestOf(line)) <= 0) return `${label}: enter a quantity`;
  return null;
}

export async function recordDispatch(input: DispatchInput): Promise<DispatchResult> {
  let userId: string;
  try {
    const user = await requireCapability("stock:issue");
    userId = user.id;
  } catch (error) {
    if (error instanceof NotPermittedError) {
      return { ok: false, message: "Your account cannot dispatch stock" };
    }
    return { ok: false, message: "Not signed in" };
  }

  if (!input.siteId) return { ok: false, message: "Choose a site" };
  if (!input.lines.length) return { ok: false, message: "Add at least one line" };

  for (const [index, line] of input.lines.entries()) {
    const invalid = validateLine(line, index);
    if (invalid) return { ok: false, message: invalid, rowIndex: index };
  }

  const reference = input.reference?.trim() || null;
  const note = input.note?.trim() || null;
  let dispatchId = "";

  try {
    await prisma.$transaction(async (tx) => {
      const dispatch = await tx.dispatch.create({
        data: { siteId: input.siteId, reference, note, userId },
      });
      dispatchId = dispatch.id;

      // Sequential, on purpose: each row reads the packs the row before it
      // just left behind, so two rows asking for the same offcut cannot both
      // be told they can have it.
      for (const [index, line] of input.lines.entries()) {
        const item = await tx.item.findUnique({ where: { id: line.itemId } });
        if (!item) throw new RowError(index, `Row ${index + 1}: item no longer exists`);

        const request = requestOf(line);
        const movement = await tx.transaction.create({
          data: {
            type: "ISSUE",
            quantity: totalOf(request),
            itemId: item.id,
            siteId: input.siteId,
            dispatchId: dispatch.id,
            userId,
            note,
            packSize: request.sealedPacks[0]?.packSize ?? null,
            packCount: request.sealedPacks.reduce((s, p) => s + p.count, 0) || null,
            pieces: request.pieces.length ? JSON.stringify(request.pieces) : null,
          },
        });

        try {
          const { applied } = await commitAllocation(
            tx,
            item,
            request,
            line.approvedOpens ?? [],
            userId
          );
          await tx.transaction.update({
            where: { id: movement.id },
            data: { appliedPlan: serialiseAppliedPlan(applied) },
          });
        } catch (error) {
          if (error instanceof AllocationFailedError) {
            throw new RowError(index, `Row ${index + 1} (${item.name}): ${error.message}`);
          }
          if (error instanceof StaleApprovalError) {
            throw new RowStaleError(index, error.required);
          }
          throw error;
        }
      }
    });
  } catch (error) {
    if (error instanceof RowStaleError) {
      return {
        ok: false,
        message: `Row ${error.index + 1} needs opening more than was approved — stock moved while this batch was under review. Re-check the plan and try again.`,
        rowIndex: error.index,
        needsApproval: error.required,
      };
    }
    if (error instanceof RowError) {
      return { ok: false, message: error.message, rowIndex: error.index };
    }
    return { ok: false, message: error instanceof Error ? error.message : "Dispatch failed" };
  }

  revalidateDispatch(input.siteId);
  return { ok: true, dispatchId };
}

function revalidateDispatch(siteId: string) {
  revalidatePath("/items", "layout");
  revalidatePath("/dashboard");
  revalidatePath("/shelf");
  revalidatePath("/shelf/suggestions");
  revalidatePath("/recycle");
  revalidatePath("/dispatches");
  revalidatePath(`/sites/${siteId}`);
}
