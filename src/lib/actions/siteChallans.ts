"use server";

import { prisma } from "@/lib/prisma";
import { NotPermittedError, requireCapability } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { nextChallanNo, SITE_CHALLAN_SEQUENCE_KEY } from "@/lib/challan";

/* -------------------------------------------------------------------------
 * A paper-only site delivery challan.
 *
 * This deliberately does NOT touch the ledger. Material delivered this way is
 * managed outside the app, so there is no Item, no Transaction, no pack row and
 * no effect on what any site holds — the only thing written is a numbered
 * Delivery and its typed lines, so the challan can be printed and found again
 * in the Site Ledger.
 *
 * What may be typed is not restricted to the item list; the form WARNS when a
 * line looks like a registered item (so stock that should be tracked goes
 * through Stock_Out instead) but this action never refuses on that ground —
 * a warning the person can see and override is the whole intent, and a server
 * check that blocked would quietly turn it into a rule.
 * ---------------------------------------------------------------------- */

export type SiteChallanLineInput = {
  name: string;
  description?: string | null;
  quantity: number;
  unit: string;
  remark?: string | null;
};

export type SiteChallanInput = {
  siteId: string;
  /** yyyy-mm-dd from a date input; blank = today. */
  date?: string | null;
  supplier?: string | null;
  reference?: string | null;
  note?: string | null;
  deliveredBy?: string | null;
  receivedBy?: string | null;
  lines: SiteChallanLineInput[];
};

export type SiteChallanResult =
  | { ok: true; deliveryId: string }
  | { ok: false; message: string };

const clean = (s: string | null | undefined) => s?.trim() || null;

export async function recordSiteChallan(input: SiteChallanInput): Promise<SiteChallanResult> {
  let userId: string;
  try {
    const user = await requireCapability("delivery:record");
    userId = user.id;
  } catch (error) {
    if (error instanceof NotPermittedError) {
      return { ok: false, message: "Your account cannot record a site delivery" };
    }
    return { ok: false, message: "Not signed in" };
  }

  const site = await prisma.site.findUnique({ where: { id: input.siteId } });
  if (!site) return { ok: false, message: "Choose a site" };

  // A row with nothing typed in it is the form's spare row, not a mistake.
  const lines = input.lines.filter(
    (l) => l.name.trim() || (l.description ?? "").trim() || l.quantity || (l.remark ?? "").trim()
  );
  if (!lines.length) return { ok: false, message: "Add at least one line" };

  for (const [i, l] of lines.entries()) {
    if (!l.name.trim()) return { ok: false, message: `Row ${i + 1}: enter the item name` };
    if (!Number.isFinite(l.quantity) || l.quantity <= 0) {
      return { ok: false, message: `Row ${i + 1}: enter a quantity above zero` };
    }
    if (!l.unit.trim()) return { ok: false, message: `Row ${i + 1}: enter a unit` };
  }

  // Noon, not midnight: a date-only value parsed as UTC midnight prints as the
  // previous day anywhere west of Greenwich, and local midnight can slip a day
  // either way across DST. Noon is a day-safe anchor.
  const dated = input.date ? new Date(`${input.date}T12:00:00`) : null;
  const receivedAt = dated && !Number.isNaN(dated.getTime()) ? dated : new Date();

  let deliveryId = "";
  await prisma.$transaction(async (tx) => {
    // Same transaction as the write, so a failure cannot burn a number and
    // leave a gap in the official series.
    const challanNo = await nextChallanNo(tx, SITE_CHALLAN_SEQUENCE_KEY);
    const delivery = await tx.delivery.create({
      data: {
        siteId: site.id,
        userId,
        challanNo,
        receivedAt,
        reference: clean(input.reference),
        supplier: clean(input.supplier),
        note: clean(input.note),
        deliveredBy: clean(input.deliveredBy),
        receivedBy: clean(input.receivedBy),
        lines: {
          create: lines.map((l, position) => ({
            position,
            name: l.name.trim(),
            description: clean(l.description),
            quantity: l.quantity,
            unit: l.unit.trim(),
            remark: clean(l.remark),
          })),
        },
      },
    });
    deliveryId = delivery.id;
  });

  revalidatePath("/site-deliveries");
  revalidatePath(`/sites/${site.id}`, "layout");
  return { ok: true, deliveryId };
}
