import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireCapability } from "@/lib/permissions";
import { formatSiteChallanNo, siteChallanOf } from "@/lib/challan";
import ChallanSheet from "@/components/ChallanSheet";
import PrintButton from "@/components/PrintButton";
import { buttonClasses } from "@/components/ui/Button";

/* -------------------------------------------------------------------------
 * The printable Material Delivery Challan for a direct-to-site Delivery —
 * the material never touched the store, but the driver handing it straight
 * to the site still needs a signed sheet. Same document as the dispatch
 * challan (ChallanSheet), its own number series (formatSiteChallanNo).
 *
 * Lines are the ISSUE half of the delivery's STOCK_IN + ISSUE pair — ISSUE is
 * the half that says "this went to the site", which is what the sheet
 * attests. A store delivery has no ISSUE lines at all, and siteChallanOf
 * refuses it before we get that far.
 * ---------------------------------------------------------------------- */

export default async function DeliveryChallanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Checked here, not left to proxy.ts — that file documents itself as
  // convenience only, and a printable record of the client's stock movements
  // must not be readable by a role that cannot read the ledger.
  await requireCapability("ledger:view");

  const delivery = await prisma.delivery.findUnique({
    where: { id },
    include: {
      site: true,
      user: true,
      transactions: { orderBy: { createdAt: "asc" }, include: { item: true } },
    },
  });

  if (!delivery) notFound();

  const numbered = siteChallanOf(delivery);
  if (!numbered) notFound();

  // Reversed lines are excluded rather than struck through. A signed challan
  // listing material that was pulled back out of the ledger would be a false
  // record — the one thing this document exists to avoid.
  const issued = delivery.transactions.filter((t) => t.type === "ISSUE");
  const lines = issued.filter((t) => !t.reversedAt);

  if (lines.length === 0) {
    return (
      <div className="max-w-lg space-y-4">
        <h1 className="text-lg font-bold text-ink">Nothing to print</h1>
        <p className="text-sm font-semibold text-ink-subtle">
          {issued.length === 0
            ? "This delivery has no lines."
            : "Every line of this delivery has been reversed, so there is no material to deliver. Printing it would produce a signed record of a delivery that did not happen."}
        </p>
        <Link href={`/deliveries/${delivery.id}`} className={buttonClasses("secondary")}>
          Back to the delivery
        </Link>
      </div>
    );
  }

  const site = numbered.site;

  return (
    <div className="space-y-4">
      <div data-print="hide" className="flex items-center gap-3">
        <Link href={`/deliveries/${delivery.id}`} className={buttonClasses("secondary")}>
          Back
        </Link>
        <PrintButton />
        <p className="text-xs font-semibold text-ink-subtle">
          Prints on plain A4. Sign the Received By block on delivery.
        </p>
      </div>

      <ChallanSheet
        challanNo={formatSiteChallanNo(numbered.challanNo)}
        date={delivery.receivedAt}
        // The customer when one is recorded; the site's own name is the
        // honest fallback, since that is who the material is for.
        party={{ name: site.customerName || site.name, address: site.address, projectCode: site.projectCode }}
        shipTo={{ name: site.name, address: site.address || site.location }}
        lines={lines}
        issuedBy={delivery.user.name}
        reference={delivery.reference}
        deliveredBy={delivery.deliveredBy}
        receivedBy={delivery.receivedBy}
        note={delivery.note}
        supplier={delivery.supplier}
      />
    </div>
  );
}
