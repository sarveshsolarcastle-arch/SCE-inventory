import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatQuantity } from "@/lib/units";
import { can, currentUser } from "@/lib/permissions";
import DefectClaimControl from "@/components/DefectClaimControl";
import PageHeader from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { TableWrap, Table, THead, Th, Tr, Td } from "@/components/ui/Table";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import { DEFECT_STATUS_TONE } from "@/components/ui/tones";

/** Goods that physically exist but are not stock, held for a supplier claim. */
export default async function DefectivePage() {
  const [rows, recentDeliveries, user] = await Promise.all([
    prisma.defectiveItem.findMany({
      include: { item: true, site: true, user: true, delivery: true, replacedBy: true },
      orderBy: [{ status: "asc" }, { reportedAt: "desc" }],
    }),
    // Offered as the "which delivery replaced it" choice — a replacement is
    // always an ordinary delivery, never its own special path.
    prisma.delivery.findMany({ orderBy: { receivedAt: "desc" }, take: 25 }),
    currentUser(),
  ]);

  const outstanding = rows.filter((r) => r.status !== "REPLACED");
  const canResolve = can(user?.role, "defect:resolve");
  const deliveryChoices = recentDeliveries.map((d) => ({
    id: d.id,
    label: `${d.reference || d.id.slice(0, 8)} — ${d.receivedAt.toLocaleDateString()}${
      d.supplier ? ` (${d.supplier})` : ""
    }`,
  }));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Defective Goods"
        subtitle={
          <>
            Damaged on arrival, or returned damaged from a site. Not counted in stock and never
            issued — held so the supplier can be chased.
            {outstanding.length > 0 && <> {outstanding.length} outstanding.</>}
          </>
        }
      />

      <Card>
        <TableWrap>
          <Table>
            <THead>
              <tr>
                <Th>Item</Th>
                <Th>Quantity</Th>
                <Th>Source</Th>
                <Th>Status</Th>
                <Th>Reported</Th>
                <Th>By</Th>
                <Th>Note</Th>
                {canResolve && <Th>Claim</Th>}
              </tr>
            </THead>
            <tbody>
              {rows.map((row) => (
                <Tr key={row.id}>
                  <Td>
                    <Link href={`/items/${row.item.id}`} className="font-bold text-ink hover:text-accent">
                      {row.item.name}
                    </Link>
                  </Td>
                  <Td className="font-mono">
                    {row.packCount && row.packSize
                      ? `${row.packCount} × ${row.packSize} ${row.item.baseUnit}`
                      : formatQuantity(row.item, row.quantity)}
                  </Td>
                  <Td className="text-ink-subtle">
                    {row.source === "RETURN" ? (
                      `Returned${row.site ? ` from ${row.site.name}` : ""}`
                    ) : row.delivery ? (
                      <Link href={`/deliveries/${row.delivery.id}`} className="hover:text-accent">
                        Damaged on arrival ({row.delivery.reference || "no ref"})
                      </Link>
                    ) : (
                      "Damaged on arrival"
                    )}
                  </Td>
                  <Td>
                    <Badge tone={DEFECT_STATUS_TONE[row.status as keyof typeof DEFECT_STATUS_TONE]}>
                      {row.status}
                    </Badge>
                    {row.replacedBy && (
                      <Link
                        href={`/deliveries/${row.replacedBy.id}`}
                        className="mt-1 block text-xs font-semibold text-ink-subtle hover:text-accent"
                      >
                        by {row.replacedBy.reference || "delivery"}
                      </Link>
                    )}
                  </Td>
                  <Td className="text-ink-subtle">{row.reportedAt.toLocaleDateString()}</Td>
                  <Td className="text-ink-subtle">{row.user.name}</Td>
                  <Td className="text-ink-subtle">{row.note ?? "—"}</Td>
                  {canResolve && (
                    <Td>
                      <DefectClaimControl
                        defectiveId={row.id}
                        status={row.status}
                        deliveries={deliveryChoices}
                      />
                    </Td>
                  )}
                </Tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
        {rows.length === 0 && <EmptyState>Nothing defective on record.</EmptyState>}
      </Card>
    </div>
  );
}
