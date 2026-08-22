import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { can, currentUser } from "@/lib/permissions";
import PageHeader from "@/components/ui/PageHeader";
import { buttonClasses } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TableWrap, Table, THead, Th, Tr, Td } from "@/components/ui/Table";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";

export default async function DeliveriesPage() {
  const [deliveries, user] = await Promise.all([
    prisma.delivery.findMany({
      orderBy: { receivedAt: "desc" },
      include: {
        site: true,
        user: true,
        transactions: { where: { type: "STOCK_IN" } },
        defectiveItems: true,
      },
    }),
    currentUser(),
  ]);

  const canRecord = can(user?.role, "delivery:record");

  return (
    <div className="space-y-4">
      <PageHeader
        title="Deliveries"
        subtitle={`${deliveries.length} deliver${deliveries.length === 1 ? "y" : "ies"}`}
        actions={
          canRecord ? (
            <Link href="/deliveries/new" className={buttonClasses("primary", "md")}>
              <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d="M10 4v12M4 10h12" /></svg>
              Record Delivery
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
                <Th>Destination</Th>
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
                    {d.site ? (
                      <Badge tone="info">Direct to {d.site.name}</Badge>
                    ) : (
                      <span className="text-ink-subtle">Store</span>
                    )}
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
        {deliveries.length === 0 && <EmptyState>No deliveries recorded yet.</EmptyState>}
      </Card>
    </div>
  );
}
