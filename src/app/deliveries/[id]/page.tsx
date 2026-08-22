import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { describeMovement, formatQuantity } from "@/lib/units";
import Link from "next/link";
import { notFound } from "next/navigation";
import PageHeader from "@/components/ui/PageHeader";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import { TableWrap, Table, THead, Th, Tr, Td } from "@/components/ui/Table";
import Alert from "@/components/ui/Alert";
import EmptyState from "@/components/ui/EmptyState";

export default async function DeliveryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const delivery = await prisma.delivery.findUnique({
    where: { id },
    include: {
      site: true,
      user: true,
      transactions: { orderBy: { createdAt: "asc" }, include: { item: true } },
      defectiveItems: { include: { item: true } },
      replaces: { include: { item: true } },
    },
  });

  if (!delivery) notFound();

  // A direct-to-site delivery writes a STOCK_IN and an ISSUE per line. They
  // are one event, not two, so only the STOCK_IN rows are listed and the
  // destination line above explains where the material went.
  const lines = delivery.transactions.filter((t) => t.type === "STOCK_IN");

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <PageHeader
          title={`Delivery ${delivery.reference || `#${delivery.id.slice(0, 8)}`}`}
          subtitle={
            <>
              {delivery.supplier ? `From ${delivery.supplier} · ` : ""}
              received {delivery.receivedAt.toLocaleDateString()} by {delivery.user.name}
              {delivery.note && ` — ${delivery.note}`}
            </>
          }
        />
        {delivery.site ? (
          <Alert tone="info">
            Delivered direct to{" "}
            <Link href={`/sites/${delivery.site.id}`} className="font-bold underline">
              {delivery.site.name}
            </Link>{" "}
            — this material never entered the store, so store stock is unchanged. It is recorded
            as held at the site.
          </Alert>
        ) : (
          <p className="text-sm font-semibold text-ink-subtle">Received into the store.</p>
        )}
      </div>

      <Card>
        <TableWrap>
          <Table>
            <THead>
              <tr>
                <Th>Item</Th>
                <Th>Received</Th>
              </tr>
            </THead>
            <tbody>
              {lines.map((t) => (
                <Tr key={t.id}>
                  <Td>
                    <Link href={`/items/${t.item.id}`} className="font-bold text-ink hover:text-accent">
                      {t.item.name}
                    </Link>
                  </Td>
                  <Td className="text-ink-subtle">{describeMovement(t.item, t)}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
        {lines.length === 0 && <EmptyState>Nothing entered stock on this delivery.</EmptyState>}
      </Card>

      {delivery.defectiveItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle tone="warn" icon={<AlertTriangle size={13} />}>
              Arrived damaged — quarantined, never counted as stock
            </CardTitle>
          </CardHeader>
          <CardBody className="divide-y divide-line p-0">
            {delivery.defectiveItems.map((d) => (
              <div key={d.id} className="flex justify-between px-4 py-2.5 text-sm">
                <Link href={`/items/${d.item.id}`} className="font-semibold text-ink hover:text-accent">
                  {d.item.name}
                </Link>
                <span className="text-ink-subtle">
                  {formatQuantity(d.item, d.quantity)} · {d.status}
                </span>
              </div>
            ))}
          </CardBody>
          <div className="border-t border-line px-4 py-3">
            <Link href="/defective" className="text-sm font-bold text-accent hover:text-accent-hover">
              Chase these on the defective register →
            </Link>
          </div>
        </Card>
      )}

      {delivery.replaces.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle tone="ok" icon={<CheckCircle2 size={13} />}>
              Replaced earlier defective goods
            </CardTitle>
          </CardHeader>
          <CardBody className="divide-y divide-line p-0">
            {delivery.replaces.map((d) => (
              <div key={d.id} className="flex justify-between px-4 py-2.5 text-sm">
                <span className="font-semibold text-ink">{d.item.name}</span>
                <span className="text-ink-subtle">{formatQuantity(d.item, d.quantity)}</span>
              </div>
            ))}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
