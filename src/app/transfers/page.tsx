import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireCapability } from "@/lib/permissions";
import PageHeader from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { TableWrap, Table, THead, Th, Tr, Td } from "@/components/ui/Table";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import Pager from "@/components/ui/Pager";
import { formatTransferChallanNo } from "@/lib/challan";
import { parsePage, pageArgs, clampPage } from "@/lib/pagination";

export default async function TransfersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  // Checked here, not left to proxy.ts — that file documents itself as
  // convenience only, matching the same direct check on /ledger and the
  // challan routes.
  await requireCapability("ledger:view");

  const { page: rawPage } = await searchParams;
  const requestedPage = parsePage(rawPage);

  // A requested page past the end must fall back to the actual last page
  // rather than render an empty table, so total has to be known first.
  const total = await prisma.transfer.count();
  const page = clampPage(requestedPage, total);
  const transfers = await prisma.transfer.findMany({
    orderBy: { transferredAt: "desc" },
    ...pageArgs(page),
    include: {
      fromSite: true,
      toSite: true,
      user: true,
      transactions: { where: { type: "TRANSFER" } },
    },
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Transfers"
        subtitle={`${total} transfer${total === 1 ? "" : "s"} — recorded from a site's own page, alongside consumption`}
      />

      <Card>
        <TableWrap>
          <Table>
            <THead>
              <tr>
                <Th>Challan No.</Th>
                <Th>Date</Th>
                <Th>From → To</Th>
                <Th>Lines</Th>
                <Th>Status</Th>
                <Th>By</Th>
                <Th>Challan</Th>
              </tr>
            </THead>
            <tbody>
              {transfers.map((t) => {
                const active = t.transactions.filter((line) => !line.reversedAt);
                const reversed = active.length === 0 && t.transactions.length > 0;
                return (
                  <Tr key={t.id}>
                    <Td>
                      <Link href={`/transfers/${t.id}`} className="font-bold text-ink hover:text-accent">
                        {formatTransferChallanNo(t.challanNo)}
                      </Link>
                    </Td>
                    <Td className="text-ink-subtle">{t.transferredAt.toLocaleDateString()}</Td>
                    <Td className="text-ink-subtle">
                      {t.fromSite.name} → {t.toSite.name}
                    </Td>
                    <Td className="text-ink-subtle">{t.transactions.length}</Td>
                    <Td>
                      {reversed ? (
                        <Badge tone="neutral">Reversed</Badge>
                      ) : (
                        <Badge tone="ok">Active</Badge>
                      )}
                    </Td>
                    <Td className="text-ink-subtle">{t.user.name}</Td>
                    <Td>
                      {active.length > 0 && (
                        <Link
                          href={`/transfers/${t.id}/challan`}
                          className="text-xs font-semibold text-accent hover:text-accent-hover"
                        >
                          Print
                        </Link>
                      )}
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        </TableWrap>
        {transfers.length === 0 && <EmptyState>No transfers recorded yet.</EmptyState>}
        <Pager total={total} page={page} basePath="/transfers" />
      </Card>
    </div>
  );
}
