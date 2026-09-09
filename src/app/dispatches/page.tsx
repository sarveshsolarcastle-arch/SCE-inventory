import Link from "next/link";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/ui/PageHeader";
import { buttonClasses } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TableWrap, Table, THead, Th, Tr, Td } from "@/components/ui/Table";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import Pager from "@/components/ui/Pager";
import { formatChallanNo } from "@/lib/challan";
import { parsePage, pageArgs, clampPage } from "@/lib/pagination";

export default async function DispatchesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: rawPage } = await searchParams;
  const requestedPage = parsePage(rawPage);

  // A requested page past the end must fall back to the actual last page
  // rather than render an empty table, so total has to be known first.
  const total = await prisma.dispatch.count();
  const page = clampPage(requestedPage, total);
  const dispatches = await prisma.dispatch.findMany({
    orderBy: { dispatchedAt: "desc" },
    ...pageArgs(page),
    include: {
      site: true,
      user: true,
      transactions: { where: { type: "ISSUE" } },
    },
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Dispatches"
        subtitle={`${total} dispatch${total === 1 ? "" : "es"}`}
        actions={
          <Link href="/dispatches/new" className={buttonClasses("primary", "md")}>
            <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d="M10 4v12M4 10h12" /></svg>
            New Dispatch
          </Link>
        }
      />

      <Card>
        <TableWrap>
          <Table>
            <THead>
              <tr>
                <Th>Challan No.</Th>
                <Th>Date</Th>
                <Th>Their ref.</Th>
                <Th>Site</Th>
                <Th>Lines</Th>
                <Th>Status</Th>
                <Th>By</Th>
                <Th>Challan</Th>
              </tr>
            </THead>
            <tbody>
              {dispatches.map((d) => {
                const active = d.transactions.filter((t) => !t.reversedAt);
                const reversed = active.length === 0 && d.transactions.length > 0;
                return (
                  <Tr key={d.id}>
                    {/* The challan number is now the identity of the row — it
                        is what someone holding the paper copy searches by. The
                        other party's reference keeps its own column. */}
                    <Td>
                      <Link href={`/dispatches/${d.id}`} className="font-bold text-ink hover:text-accent">
                        {formatChallanNo(d.challanNo)}
                      </Link>
                    </Td>
                    <Td className="text-ink-subtle">{d.dispatchedAt.toLocaleDateString()}</Td>
                    <Td className="text-ink-subtle">{d.reference || "—"}</Td>
                    <Td className="text-ink-subtle">{d.site.name}</Td>
                    <Td className="text-ink-subtle">{d.transactions.length}</Td>
                    <Td>
                      {reversed ? (
                        <Badge tone="neutral">Reversed</Badge>
                      ) : (
                        <Badge tone="ok">Active</Badge>
                      )}
                    </Td>
                    <Td className="text-ink-subtle">{d.user.name}</Td>
                    <Td>
                      {active.length > 0 && (
                        <Link
                          href={`/dispatches/${d.id}/challan`}
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
        {dispatches.length === 0 && <EmptyState>No dispatches recorded yet.</EmptyState>}
        <Pager total={total} page={page} basePath="/dispatches" />
      </Card>
    </div>
  );
}
