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
import { formatSiteChallanNo } from "@/lib/challan";
import { parsePage, pageArgs, clampPage } from "@/lib/pagination";

/* -------------------------------------------------------------------------
 * "Site Ledger" — the direct-to-site half of the delivery split (see
 * /deliveries, its store-only sibling, and DeliveryForm's `mode` prop for
 * the reasoning). Same Delivery model, same detail/challan pages — this is
 * only a different `where` and a different entry point, not a different
 * kind of record.
 * ---------------------------------------------------------------------- */

export default async function SiteDeliveriesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  // Checked here, not left to proxy.ts — matches the direct check every
  // other ledger-view page under this nav group makes.
  await requireCapability("ledger:view");

  const { page: rawPage } = await searchParams;
  const requestedPage = parsePage(rawPage);

  // Direct-to-site only — /deliveries' count and query use the opposite
  // filter, and the two must never overlap or a delivery would show on both.
  const where = { siteId: { not: null } };

  const [total, user] = await Promise.all([prisma.delivery.count({ where }), currentUser()]);
  const page = clampPage(requestedPage, total);
  const deliveries = await prisma.delivery.findMany({
    where,
    orderBy: { receivedAt: "desc" },
    ...pageArgs(page),
    include: {
      site: true,
      user: true,
      transactions: { where: { type: "STOCK_IN" } },
      defectiveItems: true,
    },
  });

  const canRecord = can(user?.role, "delivery:record");

  return (
    <div className="space-y-4">
      <PageHeader
        title="Site Ledger"
        subtitle={`${total} direct-to-site deliver${total === 1 ? "y" : "ies"}`}
        actions={
          canRecord ? (
            <Link href="/site-deliveries/new" className={buttonClasses("primary", "md")}>
              <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d="M10 4v12M4 10h12" /></svg>
              Record Site Delivery
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
                <Th>Site</Th>
                <Th>Lines</Th>
                <Th>Defects</Th>
                <Th>By</Th>
              </tr>
            </THead>
            <tbody>
              {deliveries.map((d) => (
                <Tr key={d.id}>
                  <Td className="text-ink-subtle">{d.receivedAt.toLocaleDateString()}</Td>
                  <Td>
                    <Link href={`/deliveries/${d.id}`} className="font-bold text-ink hover:text-accent">
                      {d.reference || "(no reference)"}
                    </Link>
                  </Td>
                  <Td className="text-ink-subtle">{d.supplier ?? "—"}</Td>
                  <Td>
                    <Badge tone="info">
                      {d.challanNo != null && `${formatSiteChallanNo(d.challanNo)} · `}
                      {d.site?.name ?? "—"}
                    </Badge>
                  </Td>
                  <Td className="text-ink-subtle">{d.transactions.length}</Td>
                  <Td>
                    {d.defectiveItems.length > 0 ? (
                      <Badge tone="warn">{d.defectiveItems.length}</Badge>
                    ) : (
                      <span className="text-ink-subtle">—</span>
                    )}
                  </Td>
                  <Td className="text-ink-subtle">{d.user.name}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
        {deliveries.length === 0 && <EmptyState>No direct-to-site deliveries recorded yet.</EmptyState>}
        <Pager total={total} page={page} basePath="/site-deliveries" />
      </Card>
    </div>
  );
}
