"use server";

import { prisma } from "@/lib/prisma";
import { NotPermittedError, requireCapability } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { AllocationFailedError, StaleApprovalError, type ApprovedOpens } from "@/lib/packs";
import {
  DefectError,
  markStockDefective,
  validateMarkDefective,
  type MarkDefectiveInput,
} from "@/lib/defects";

export type MarkDefectiveResult =
  | { ok: true }
  | { ok: false; message: string; needsApproval?: ApprovedOpens };

/** Takes stock off the shelf and records it as defective, at any time.
 *
 * Gated on `defect:flag` here, not just in the UI — server actions are directly
 * invocable, so hiding the button proves nothing. Undoing one is an ordinary
 * reversal of the DEFECT movement, which needs `stock:reverse`. */
export async function markDefective(input: MarkDefectiveInput): Promise<MarkDefectiveResult> {
  let userId: string;
  try {
    userId = (await requireCapability("defect:flag")).id;
  } catch (error) {
    if (error instanceof NotPermittedError) {
      return { ok: false, message: "Your account cannot mark stock as defective" };
    }
    return { ok: false, message: "Not signed in" };
  }

  const invalid = validateMarkDefective(input);
  if (invalid) return { ok: false, message: invalid };

  try {
    await prisma.$transaction((tx) => markStockDefective(tx, input, userId));
  } catch (error) {
    if (error instanceof StaleApprovalError) {
      return { ok: false, message: error.message, needsApproval: error.required };
    }
    if (error instanceof AllocationFailedError || error instanceof DefectError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }

  revalidatePath("/items");
  revalidatePath(`/items/${input.itemId}`);
  revalidatePath("/dashboard");
  revalidatePath("/shelf");
  revalidatePath("/recycle");
  revalidatePath("/ledger");
  revalidatePath("/defective");
  return { ok: true };
}
