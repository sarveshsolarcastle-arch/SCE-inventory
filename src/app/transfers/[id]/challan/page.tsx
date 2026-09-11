import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireCapability } from "@/lib/permissions";
import { formatTransferChallanNo } from "@/lib/challan";
import ChallanSheet from "@/components/ChallanSheet";
import PrintButton from "@/components/PrintButton";
import { buttonClasses } from "@/components/ui/Button";

/* -------------------------------------------------------------------------
 * The printable challan for a batch site-to-site transfer — same sheet as a
 * Dispatch or a direct-to-site Delivery, its own number series
 * (formatTransferChallanNo).
 *
 * UNLIKE a Dispatch, Delivery or the site Material Statement, `party` here is
 * NOT a customer. Those three always print the SAME site's customer as
 * `party` and that site itself as `shipTo`, so the two can never disagree.
 * A transfer moves material between two of the company's own sites, which
 * may belong to two entirely different customers — printing the origin
 * site's customer as though it were the recipient of a delivery to the
 * destination site would misstate who the goods are for. So both `party` and
 * `shipTo` here are the sites themselves — origin and destination — under
 * "Transfer From" / "Transfer To" headings, never a customer name.
 * ---------------------------------------------------------------------- */

export default async function TransferChallanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Checked here, not left to proxy.ts — that file documents itself as
  // convenience only, and a printable record of the client's stock movements
  // must not be readable by a role that cannot read the ledger.
  await requireCapability("ledger:view");

  const transfer = await prisma.transfer.findUnique({
    where: { id },
    include: {
      fromSite: true,
      toSite: true,
      user: true,
      transactions: {
        where: { type: "TRANSFER" },
        orderBy: { createdAt: "asc" },
        include: { item: true },
      },
    },
  });

  if (!transfer) notFound();

  // Reversed lines are excluded rather than struck through. A signed challan
  // listing material that was pulled back out of the ledger would be a false
  // record — the one thing this document exists to avoid.
  const lines = transfer.transactions.filter((t) => !t.reversedAt);

  if (lines.length === 0) {
    return (
      <div className="max-w-lg space-y-4">
        <h1 className="text-lg font-bold text-ink">Nothing to print</h1>
        <p className="text-sm font-semibold text-ink-subtle">
          {transfer.transactions.length === 0
            ? "This transfer has no lines."
            : "Every line of this transfer has been reversed, so there is no material to deliver. Printing it would produce a signed record of a delivery that did not happen."}
        </p>
        <Link href={`/transfers/${transfer.id}`} className={buttonClasses("secondary")}>
          Back to the transfer
        </Link>
      </div>
    );
  }

  const { fromSite, toSite } = transfer;

  return (
    <div className="space-y-4">
      <div data-print="hide" className="flex items-center gap-3">
        <Link href={`/transfers/${transfer.id}`} className={buttonClasses("secondary")}>
          Back
        </Link>
        <PrintButton />
        <p className="text-xs font-semibold text-ink-subtle">
          Prints on plain A4. Sign the Received By block on delivery.
        </p>
      </div>

      <ChallanSheet
        challanNo={formatTransferChallanNo(transfer.challanNo)}
        date={transfer.transferredAt}
        partyHeading="Transfer From"
        shipToHeading="Transfer To"
        party={{
          name: fromSite.name,
          address: fromSite.address,
          projectCode: fromSite.projectCode,
        }}
        shipTo={{ name: toSite.name, address: toSite.address || toSite.location }}
        lines={lines}
        issuedBy={transfer.user.name}
        reference={null}
        deliveredBy={transfer.deliveredBy}
        receivedBy={transfer.receivedBy}
        note={transfer.note}
      />
    </div>
  );
}
