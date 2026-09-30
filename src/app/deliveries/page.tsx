/* Stock_In ledger (/deliveries): every delivery received into the store, newest
 * first, 50 per page. Direct-to-site deliveries are a separate paper-only feature
 * with their own ledger at /site-deliveries, so they are filtered out here.
 */
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { can, currentUser, requireCapability } from "@/lib/permissions";
import PageHeader from "@/components/ui/PageHeader";
import { buttonClasses } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TableWrap, Table, THead, Th, Tr, Td } from "@/components/ui/Table";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import Pager from "@/components/ui/Pager";
import { parsePage, pageArgs, clampPage } from "@/lib/pagination";

export default async function DeliveriesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  // Checked here, not left to proxy.ts — that file documents itself as
  // convenience only, matching the same direct check on /ledger and /transfers.
  await requireCapability("ledger:view");

  const { page: rawPage } = await searchParams;
  const requestedPage = parsePage(rawPage);

  // Store-only — a direct-to-site delivery lives on /site-deliveries now, its
  // own ledger, so this list and its count must agree on the same filter.
  const where = { siteId: null };

  // A requested page past the end must fall back to the actual last page
  // rather than render an empty table, so total has to be known first.
  const [total, user] = await Promise.all([prisma.delivery.count({ where }), currentUser()]);
  const page = clampPage(requestedPage, total);
  const deliveries = await prisma.delivery.findMany({
    where,
    orderBy: { receivedAt: "desc" },
    ...pageArgs(page),
    include: {
      user: true,
      transactions: { where: { type: "STOCK_IN" } },
      defectiveItems: true,
    },
  });

  const canRecord = can(user?.role, "delivery:record");

  return (
    <div className="space-y-4">
      <PageHeader
        title="Stock_In Ledger"
        subtitle={`${total} deliver${total === 1 ? "y" : "ies"}`}
        actions={
          canRecord ? (
            <Link href="/deliveries/new" className={buttonClasses("primary", "md")}>
              <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d="M10 4v12M4 10h12" /></svg>
              Record Stock_In
            </Link>
          ) : undefined
        }
      />

      <Card>
        <TableWrap>
          <Table>
            <THead>
              <tr>
                <Th>Received</Th>
                <Th>Reference</Th>
                <Th>Supplier</Th>
                <Th>Lines</Th>
                <Th>Defects</Th>
                <Th>Status</Th>
                <Th>By</Th>
              </tr>
            </THead>
            <tbody>
              {deliveries.map((d) => {
                const active = d.transactions.filter((t) => !t.reversedAt);
                const reversed = active.length === 0 && d.transactions.length > 0;
                return (
                  <Tr key={d.id}>
                    <Td className="text-ink-subtle">{d.receivedAt.toLocaleDateString()}</Td>
                    <Td>
                      <Link href={`/deliveries/${d.id}`} className="font-bold text-ink hover:text-accent">
                        {d.reference || "(no reference)"}
                      </Link>
                    </Td>
                    <Td className="text-ink-subtle">{d.supplier ?? "—"}</Td>
                    <Td className="text-ink-subtle">{d.transactions.length}</Td>
                    <Td>
                      {d.defectiveItems.length > 0 ? (
                        <Badge tone="warn">{d.defectiveItems.length}</Badge>
                      ) : (
                        <span className="text-ink-subtle">—</span>
                      )}
                    </Td>
                    <Td>
                      {d.transactions.length === 0 ? (
                        <span className="text-ink-subtle">—</span>
                      ) : reversed ? (
                        <Badge tone="neutral">Reversed</Badge>
                      ) : (
                        <Badge tone="ok">Active</Badge>
                      )}
                    </Td>
                    <Td className="text-ink-subtle">{d.user.name}</Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        </TableWrap>
        {deliveries.length === 0 && <EmptyState>No deliveries recorded yet.</EmptyState>}
        <Pager total={total} page={page} basePath="/deliveries" />
      </Card>
    </div>
  );
}
