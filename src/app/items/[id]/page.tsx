import { Pencil, Clock } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { updateItem } from "@/lib/actions/items";
import { openPackAction } from "@/lib/actions/transactions";
import { describeMovement, formatQuantity, formatStock } from "@/lib/units";
import { can, currentUser } from "@/lib/permissions";
import { adjustStock, reverseTransaction } from "@/lib/actions/corrections";
import { AdjustStockForm, ReverseButton } from "@/components/CorrectionPanel";
import Link from "next/link";
import { notFound } from "next/navigation";
import PageHeader from "@/components/ui/PageHeader";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import { TableWrap, Table, THead, Th, Tr, Td } from "@/components/ui/Table";
import { Field, Input, Select } from "@/components/ui/Field";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Alert from "@/components/ui/Alert";
import EmptyState from "@/components/ui/EmptyState";

export default async function ItemDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const item = await prisma.item.findUnique({
    where: { id },
    include: {
      shelfSlots: { include: { shelf: true }, orderBy: { boxType: "asc" } },
      packStock: { orderBy: { packSize: "asc" } },
      openPacks: { orderBy: { remaining: "desc" } },
      transactions: {
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { site: true, user: true },
      },
    },
  });

  if (!item) notFound();

  const updateWithId = updateItem.bind(null, item.id);
  const openRemaining = item.openPacks
    .filter((p) => p.state === "OPEN")
    .map((p) => p.remaining);
  const sealedSizes = item.packStock.filter((g) => g.sealedCount > 0);
  // Cosmetic only — openPackAction enforces this itself, since a server action
  // can be invoked regardless of what the page chose to render.
  const user = await currentUser();
  const canOpenPacks = can(user?.role, "stock:issue");
  const canEdit = can(user?.role, "item:manage");
  const canAdjust = can(user?.role, "stock:adjust");
  const canReverse = can(user?.role, "stock:reverse");

  const countRows = [
    ...item.packStock.map((g) => ({
      key: `sealed_${g.packSize}`,
      label: `Sealed ${g.packSize} ${item.baseUnit} ${item.packUnit ?? "pack"}s`,
      current: g.sealedCount,
    })),
    ...item.openPacks
      .filter((p) => p.state === "OPEN")
      .map((p) => ({
        key: `open_${p.id}`,
        label: `Open pack — ${p.remaining} ${item.baseUnit} remaining`,
        current: p.remaining,
      })),
  ];

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <PageHeader
          title={item.name}
          subtitle={
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-mono">Current stock: {formatQuantity(item, item.currentStock)}</span>
              {item.currentStock < item.minStock && (
                <Badge tone="danger">Below minimum ({item.minStock})</Badge>
              )}
            </span>
          }
        />
        <p className="text-sm font-semibold text-ink-subtle">
          {formatStock(item, item.packStock, openRemaining)}
        </p>
        {item.scrapStock > 0 && (
          <Alert tone="warn">
            Plus {formatQuantity(item, item.scrapStock)} in{" "}
            <Link href="/recycle" className="font-bold underline">
              recycle
            </Link>{" "}
            — below the scrap threshold, not counted as stock.
          </Alert>
        )}

        {sealedSizes.length > 0 && canOpenPacks && (
          <form action={openPackAction} className="flex flex-wrap items-center gap-2 pt-1">
            <input type="hidden" name="itemId" value={item.id} />
            <label className="text-sm font-semibold text-ink-muted">
              Open a sealed {item.packUnit ?? "pack"}:
            </label>
            <Select name="packSize" className="w-auto">
              {sealedSizes.map((g) => (
                <option key={g.packSize} value={g.packSize}>
                  {g.packSize} {item.baseUnit} ({g.sealedCount} left)
                </option>
              ))}
            </Select>
            <Button type="submit" variant="secondary" size="sm">
              Open one
            </Button>
          </form>
        )}
        <div className="text-sm font-semibold text-ink-subtle">
          Shelf locations:{" "}
          {item.shelfSlots.length === 0 ? (
            <>
              Unassigned —{" "}
              <Link href="/shelf" className="font-bold text-accent hover:text-accent-hover">
                assign on a shelf map
              </Link>
            </>
          ) : (
            <ul className="mt-1 space-y-1">
              {item.shelfSlots.map((slot) => (
                <li key={slot.id} className="flex items-center gap-1.5">
                  <Badge tone="neutral">{slot.boxType}</Badge>
                  <Link href={`/shelf/${slot.shelfId}`} className="font-bold text-accent hover:text-accent-hover">
                    {slot.shelf.name} · {slot.side} · row {slot.row}, col {slot.column} (tag{" "}
                    {slot.tagCode})
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {canAdjust && (
        <AdjustStockForm
          rows={countRows}
          baseUnit={item.baseUnit}
          action={adjustStock.bind(null, item.id)}
        />
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {canEdit && (
          <Card>
            <CardHeader>
              <CardTitle tone="info" icon={<Pencil size={13} />}>
                Edit Item
              </CardTitle>
            </CardHeader>
            <CardBody>
              <form action={updateWithId} className="space-y-3">
                <Field label="Name">
                  <Input name="name" defaultValue={item.name} required />
                </Field>
                <Field label="SKU">
                  <Input name="sku" defaultValue={item.sku} required />
                </Field>
                <Field label="Category">
                  <Input name="category" defaultValue={item.category ?? ""} />
                </Field>
                <Field label="Base unit (what stock is counted in — m, pcs)">
                  <Input name="baseUnit" defaultValue={item.baseUnit} />
                </Field>
                <Field label="Pack unit (roll, packet — blank if not packaged)">
                  <Input name="packUnit" defaultValue={item.packUnit ?? ""} />
                </Field>
                <Field label="Measure">
                  <Select name="measure" defaultValue={item.measure}>
                    <option value="DISCRETE">
                      Discrete — countable units that pool freely (screws)
                    </option>
                    <option value="CONTINUOUS">
                      Continuous — a length must come from one pack (wire)
                    </option>
                  </Select>
                </Field>
                <Field label="Scrap threshold (continuous only — offcuts at or below this stop being stock)">
                  <Input
                    name="scrapThreshold"
                    type="number"
                    defaultValue={item.scrapThreshold === null ? "" : String(item.scrapThreshold)}
                  />
                </Field>
                <Field label="Minimum stock">
                  <Input name="minStock" type="number" defaultValue={String(item.minStock)} />
                </Field>
                <Button type="submit">Save</Button>
              </form>
            </CardBody>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle tone="ok" icon={<Clock size={13} />}>
              Transaction History
            </CardTitle>
          </CardHeader>
          <TableWrap className="max-h-96 overflow-y-auto">
            <Table>
              <THead>
                <tr>
                  <Th>Date</Th>
                  <Th>Type</Th>
                  <Th>Qty</Th>
                  <Th>Site</Th>
                  <Th>By</Th>
                  <Th />
                </tr>
              </THead>
              <tbody>
                {item.transactions.map((t) => (
                  <Tr key={t.id}>
                    <Td className="text-ink-subtle">{t.createdAt.toLocaleDateString()}</Td>
                    <Td>{t.type}</Td>
                    <Td>
                      {describeMovement(item, t)}
                      {t.defectiveQty ? (
                        <span className="ml-1 font-semibold text-warn-ink">
                          ({t.defectiveQty} defective)
                        </span>
                      ) : null}
                    </Td>
                    <Td className="text-ink-subtle">{t.site?.name ?? "—"}</Td>
                    <Td className="text-ink-subtle">{t.user.name}</Td>
                    <Td>
                      {t.reversedAt ? (
                        <span className="text-ink-subtle line-through">reversed</span>
                      ) : canReverse &&
                        t.type !== "REVERSAL" &&
                        t.type !== "ADJUSTMENT" &&
                        t.appliedPlan ? (
                        <ReverseButton
                          action={reverseTransaction.bind(null, t.id)}
                          label={`this ${t.type} of ${describeMovement(item, t)}`}
                        />
                      ) : null}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
          {item.transactions.length === 0 && <EmptyState>No transactions yet.</EmptyState>}
        </Card>
      </div>
    </div>
  );
}
