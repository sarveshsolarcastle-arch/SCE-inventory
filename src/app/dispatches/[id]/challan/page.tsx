import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireCapability } from "@/lib/permissions";
import { formatChallanNo } from "@/lib/challan";
import ChallanSheet from "@/components/ChallanSheet";
import { lineFromTransaction } from "@/lib/challanLines";
import PrintButton from "@/components/PrintButton";
import { buttonClasses } from "@/components/ui/Button";

/* -------------------------------------------------------------------------
 * The printable Material Delivery Challan.
 *
 * A server component that renders one A4 sheet from an existing Dispatch —
 * header from the Dispatch and its Site, lines from the ISSUE transactions
 * that carry its dispatchId. It reads the ledger and writes nothing; printing
 * a challan is not an event in the stock record.
 *
 * The sheet lives INSIDE AppShell like every other page. Escaping the shell
 * would mean restructuring the root layout for one route; instead the chrome
 * carries data-print="hide" and the @media print block in globals.css drops it,
 * so what reaches the paper is this sheet alone.
 * ---------------------------------------------------------------------- */

export default async function ChallanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Checked here, not left to proxy.ts — that file documents itself as
  // convenience only, and a printable record of the client's stock movements
  // must not be readable by a role that cannot read the ledger.
  await requireCapability("ledger:view");

  const dispatch = await prisma.dispatch.findUnique({
    where: { id },
    include: {
      site: true,
      user: true,
      transactions: { orderBy: { createdAt: "asc" }, include: { item: true } },
    },
  });

  if (!dispatch) notFound();

  // Reversed lines are excluded rather than struck through. A signed challan
  // listing material that was pulled back out of the ledger would be a false
  // record — the one thing this document exists to avoid.
  const issued = dispatch.transactions.filter((t) => t.type === "ISSUE");
  const lines = issued.filter((t) => !t.reversedAt);

  if (lines.length === 0) {
    return (
      <div className="max-w-lg space-y-4">
        <h1 className="text-lg font-bold text-ink">Nothing to print</h1>
        <p className="text-sm font-semibold text-ink-subtle">
          {issued.length === 0
            ? "This dispatch has no lines."
            : "Every line of this dispatch has been reversed, so there is no material to deliver. Printing it would produce a signed record of a delivery that did not happen."}
        </p>
        <Link href={`/dispatches/${dispatch.id}`} className={buttonClasses("secondary")}>
          Back to the dispatch
        </Link>
      </div>
    );
  }

  const site = dispatch.site;

  return (
    <div className="space-y-4">
      <div data-print="hide" className="flex items-center gap-3">
        <Link href={`/dispatches/${dispatch.id}`} className={buttonClasses("secondary")}>
          Back
        </Link>
        <PrintButton />
        <p className="text-xs font-semibold text-ink-subtle">
          Prints on plain A4. Sign the Received By block on delivery.
        </p>
      </div>

      <ChallanSheet
        challanNo={formatChallanNo(dispatch.challanNo)}
        date={dispatch.dispatchedAt}
        // The "Delivery Challan For" block is no longer printed (showParty),
        // by decision; `party` is kept so re-enabling it needs no other edit.
        showParty={false}
        // The customer when one is recorded; the site's own name is the
        // honest fallback, since that is who the material is for.
        party={{ name: site.customerName || site.name, address: site.address, projectCode: site.projectCode }}
        shipTo={{ name: site.name, address: site.address || site.location }}
        lines={lines.map(lineFromTransaction)}
        issuedBy={dispatch.user.name}
        reference={dispatch.reference}
        deliveredBy={dispatch.deliveredBy}
        receivedBy={dispatch.receivedBy}
      />
    </div>
  );
}
