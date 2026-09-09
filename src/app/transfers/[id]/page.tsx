import { Printer } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireCapability } from "@/lib/permissions";
import { describeMovement } from "@/lib/units";
import Link from "next/link";
import { notFound } from "next/navigation";
import PageHeader from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { TableWrap, Table, THead, Th, Tr, Td } from "@/components/ui/Table";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import { buttonClasses } from "@/components/ui/Button";
import { formatTransferChallanNo } from "@/lib/challan";

/* No reversal control on this page: a TRANSFER Transaction carries no
 * appliedPlan (it never opens a pack), so findObstaclesFor in
 * ops/corrections.ts always refuses it with "no_plan" — the item page's own
 * history table hides its ReverseButton for exactly this reason, on the same
 * `t.appliedPlan` check. Nothing here would ever render, so it is left out
 * rather than kept as a column that can never do anything. */
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
      transactions: {
        where: { type: "TRANSFER" },
        orderBy: { createdAt: "asc" },
        include: { item: true },
      },
    },
  });

  if (!transfer) notFound();

  const activeLines = transfer.transactions.filter((t) => !t.reversedAt);
  const fullyReversed = transfer.transactions.length > 0 && activeLines.length === 0;

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
            {fullyReversed && <Badge tone="neutral">Reversed</Badge>}
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
              {transfer.transactions.map((t) => (
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
        {transfer.transactions.length === 0 && <EmptyState>No lines on this transfer.</EmptyState>}
      </Card>
    </div>
  );
}
