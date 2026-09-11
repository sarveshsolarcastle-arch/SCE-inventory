import { Printer, Undo2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { capabilityMode, currentUser, requireCapability } from "@/lib/permissions";
import { reverseTransfer } from "@/lib/actions/corrections";
import { ReverseButton } from "@/components/CorrectionPanel";
import { describeMovement } from "@/lib/units";
import Link from "next/link";
import { notFound } from "next/navigation";
import PageHeader from "@/components/ui/PageHeader";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import { TableWrap, Table, THead, Th, Tr, Td } from "@/components/ui/Table";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import { buttonClasses } from "@/components/ui/Button";
import { formatTransferChallanNo } from "@/lib/challan";

export default async function TransferDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Checked here, not left to proxy.ts — that file documents itself as
  // convenience only, matching the same direct check on /ledger and the
  // challan routes.
  await requireCapability("ledger:view");

  const { id } = await params;

  const transfer = await prisma.transfer.findUnique({
    where: { id },
    include: {
      fromSite: true,
      toSite: true,
      user: true,
      // All transactions this batch grouped, not just TRANSFER — the
      // REVERSAL rows reverseTransfer writes carry the same transferId, and
      // the card below needs them to say what was undone and why.
      transactions: {
        orderBy: { createdAt: "asc" },
        include: { item: true },
      },
    },
  });

  if (!transfer) notFound();

  const user = await currentUser();
  const reverseMode = capabilityMode(user?.role, "stock:reverse");

  const transferLines = transfer.transactions.filter((t) => t.type === "TRANSFER");
  const reversalLines = transfer.transactions.filter((t) => t.type === "REVERSAL");
  const activeLines = transferLines.filter((t) => !t.reversedAt);
  const fullyReversed = transferLines.length > 0 && activeLines.length === 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Transfer ${formatTransferChallanNo(transfer.challanNo)}`}
        subtitle={
          <>
            {transfer.fromSite.name} →{" "}
            <Link href={`/sites/${transfer.toSite.id}`} className="font-bold text-accent hover:text-accent-hover">
              {transfer.toSite.name}
            </Link>{" "}
            on {transfer.transferredAt.toLocaleDateString()} by {transfer.user.name}
            {transfer.note && ` — ${transfer.note}`}
          </>
        }
        actions={
          <div className="flex items-center gap-2">
            {/* Only offered when there is something left to move — the
                challan page refuses a fully reversed transfer anyway, and a
                Print button that leads to a refusal is a worse answer than
                no button. */}
            {activeLines.length > 0 && (
              <Link href={`/transfers/${transfer.id}/challan`} className={buttonClasses("secondary")}>
                <Printer size={14} aria-hidden />
                Print challan
              </Link>
            )}
            {fullyReversed ? (
              <Badge tone="neutral">Reversed</Badge>
            ) : (
              reverseMode !== "none" &&
              activeLines.length > 0 && (
                <ReverseButton
                  action={reverseTransfer.bind(null, transfer.id)}
                  label="this whole transfer"
                  mode={reverseMode}
                  detail="This removes it from both sites' balances, exactly as if it never happened. It refuses if the destination has already moved some of it on again."
                />
              )
            )}
          </div>
        }
      />

      <Card>
        <TableWrap>
          <Table>
            <THead>
              <tr>
                <Th>Item</Th>
                <Th>Quantity</Th>
                <Th>Status</Th>
              </tr>
            </THead>
            <tbody>
              {transferLines.map((t) => (
                <Tr key={t.id}>
                  <Td>
                    <Link href={`/items/${t.item.id}`} className="font-bold text-ink hover:text-accent">
                      {t.item.name}
                    </Link>
                  </Td>
                  <Td className="text-ink-subtle">{describeMovement(t.item, t)}</Td>
                  <Td>
                    {t.reversedAt ? (
                      <Badge tone="neutral">Reversed</Badge>
                    ) : (
                      <Badge tone="ok">Active</Badge>
                    )}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
        {transferLines.length === 0 && <EmptyState>No lines on this transfer.</EmptyState>}
      </Card>

      {reversalLines.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle tone="danger" icon={<Undo2 size={13} />}>
              Reversal
            </CardTitle>
          </CardHeader>
          <CardBody>
            <p className="text-sm font-semibold text-ink-subtle">
              {reversalLines.length} line{reversalLines.length === 1 ? "" : "s"} of this transfer
              {fullyReversed ? "" : " have been"} reversed
              {reversalLines[0]?.reason && `, reason: "${reversalLines[0].reason}"`}.
            </p>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
