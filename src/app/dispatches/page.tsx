import Link from "next/link";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/ui/PageHeader";
import { buttonClasses } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TableWrap, Table, THead, Th, Tr, Td } from "@/components/ui/Table";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";

export default async function DispatchesPage() {
  const dispatches = await prisma.dispatch.findMany({
    orderBy: { dispatchedAt: "desc" },
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
        subtitle={`${dispatches.length} dispatch${dispatches.length === 1 ? "" : "es"}`}
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
                <Th>Date</Th>
                <Th>Reference</Th>
                <Th>Site</Th>
                <Th>Lines</Th>
                <Th>Status</Th>
                <Th>By</Th>
              </tr>
            </THead>
            <tbody>
              {dispatches.map((d) => {
                const active = d.transactions.filter((t) => !t.reversedAt);
                const reversed = active.length === 0 && d.transactions.length > 0;
                return (
                  <Tr key={d.id}>
                    <Td className="text-ink-subtle">{d.dispatchedAt.toLocaleDateString()}</Td>
                    <Td>
                      <Link href={`/dispatches/${d.id}`} className="font-bold text-ink hover:text-accent">
                        {d.reference || "(no reference)"}
                      </Link>
                    </Td>
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
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        </TableWrap>
        {dispatches.length === 0 && <EmptyState>No dispatches recorded yet.</EmptyState>}
      </Card>
    </div>
  );
}
