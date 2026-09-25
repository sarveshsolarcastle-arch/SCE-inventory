import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireCapability } from "@/lib/permissions";
import { materialsAtSite } from "@/lib/stock";
import { formatQuantity } from "@/lib/units";
import ChallanSheet from "@/components/ChallanSheet";
import type { ChallanLine } from "@/lib/challanLines";
import PrintButton from "@/components/PrintButton";
import { buttonClasses } from "@/components/ui/Button";

/* -------------------------------------------------------------------------
 * The site material statement — one sheet listing everything currently at a
 * site, for handing to the customer. Reuses the same printed layout as a
 * Dispatch or Delivery challan, but is not one: it is a dated SNAPSHOT of a
 * live balance rather than a record of one movement, which is why its number
 * is a deterministic date-based reference (SCE/MS/<yyyy-mm-dd>) rather than a
 * Sequence-allocated one — burning a counter value on every print would
 * imply each print is its own distinct consignment, which it is not.
 *
 * Lines come from materialsAtSite(id) — the SAME net-balance function the
 * site page itself renders — so the sheet and the screen can never disagree.
 * Provenance is absent BY CONSTRUCTION: dispatched, transferred and
 * direct-delivered material arrive already merged into one per-item
 * quantity, with no dispatchId/deliveryId/fromSiteId anywhere in the lines
 * this page builds, and every line's `note` is explicitly null so a source
 * can never leak through the Remarks column.
 * ---------------------------------------------------------------------- */

export default async function SiteMaterialStatementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const user = await requireCapability("ledger:view");

  const site = await prisma.site.findUnique({ where: { id } });
  if (!site) notFound();

  const materials = await materialsAtSite(id);

  if (materials.length === 0) {
    return (
      <div className="max-w-lg space-y-4">
        <h1 className="text-lg font-bold text-ink">Nothing to print</h1>
        <p className="text-sm font-semibold text-ink-subtle">
          {site.name} is not currently holding any material.
        </p>
        <Link href={`/sites/${site.id}`} className={buttonClasses("secondary")}>
          Back to the site
        </Link>
      </div>
    );
  }

  const lines: ChallanLine[] = materials.map(({ item, quantity }) => ({
    id: item.id,
    name: item.name,
    // A balance, not a movement: no pack breakdown to spell out, just the
    // plain quantity in the item's own unit.
    description: formatQuantity(item, quantity),
    quantity,
    unit: item.baseUnit,
    note: null,
  }));

  const today = new Date();
  // Built from the SAME local calendar day the sheet's own Date field prints
  // (toLocaleDateString below) — toISOString() reads UTC, which disagrees
  // with the local date for part of every day east of Greenwich (all evening,
  // IST) and would print two different dates on one sheet.
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, "0");
  const d = String(today.getDate()).padStart(2, "0");
  const reference = `SCE/MS/${y}-${m}-${d}`;

  return (
    <div className="space-y-4">
      <div data-print="hide" className="flex items-center gap-3">
        <Link href={`/sites/${site.id}`} className={buttonClasses("secondary")}>
          Back
        </Link>
        <PrintButton />
        <p className="text-xs font-semibold text-ink-subtle">
          Prints on plain A4. A snapshot of what is here today — figures change as material is
          used, so an old copy should not be relied on later.
        </p>
      </div>

      <ChallanSheet
        // Called a material statement everywhere in the app, but it PRINTS as
        // a Delivery Challan — the default title — by decision, because that
        // is the document the customer's site actually accepts. The reference
        // number below is still the date-based one, not an allocated challan
        // number, so that stays honest.
        documentNoLabel="Reference No."
        showDeliveryDetails={false}
        showParty={false}
        challanNo={reference}
        date={today}
        party={{ name: site.customerName || site.name, address: site.address, projectCode: site.projectCode }}
        shipTo={{ name: site.name, address: site.address || site.location }}
        lines={lines}
        issuedBy={user.name ?? "—"}
        reference={null}
        deliveredBy={null}
        receivedBy={null}
      />
    </div>
  );
}
