import { AlertTriangle, CheckCircle2, Printer, Undo2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { capabilityMode, currentUser, requireCapability } from "@/lib/permissions";
import { reverseDelivery } from "@/lib/actions/corrections";
import { ReverseButton } from "@/components/CorrectionPanel";
import { describeMovement, formatQuantity } from "@/lib/units";
import Link from "next/link";
import { notFound } from "next/navigation";
import PageHeader from "@/components/ui/PageHeader";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import { TableWrap, Table, THead, Th, Tr, Td } from "@/components/ui/Table";
import Alert from "@/components/ui/Alert";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import { buttonClasses } from "@/components/ui/Button";
import { formatSiteChallanNo, siteChallanOf } from "@/lib/challan";

export default async function DeliveryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Checked here, not left to proxy.ts — that file documents itself as
  // convenience only, matching the same direct check on /ledger and /transfers.
  await requireCapability("ledger:view");

  const delivery = await prisma.delivery.findUnique({
    where: { id },
    include: {
      site: true,
      user: true,
      transactions: { orderBy: { createdAt: "asc" }, include: { item: true } },
      lines: { orderBy: { position: "asc" } },
      defectiveItems: { include: { item: true } },
      replaces: { include: { item: true } },
    },
  });

  if (!delivery) notFound();

  // A direct-to-site delivery writes a STOCK_IN and an ISSUE per line. They
  // are one event, not two, so only the STOCK_IN rows are listed and the
  // destination line above explains where the material went.
  const lines = delivery.transactions.filter((t) => t.type === "STOCK_IN");

  const numbered = siteChallanOf(delivery);
  // Only offered when there is something to deliver — the challan page
  // refuses a fully-reversed delivery anyway, and a Print button that leads
  // to a refusal is a worse answer than no button.
  const activeIssueLines = delivery.transactions.filter((t) => t.type === "ISSUE" && !t.reversedAt);
  // A paper-only challan (typed lines, no ledger rows) always has something
  // to print; an older stock-backed one only while some line is unreversed.
  const paperLines = delivery.lines;
  const canPrint = numbered != null && (paperLines.length > 0 || activeIssueLines.length > 0);

  const user = await currentUser();
  const reverseMode = capabilityMode(user?.role, "stock:reverse");

  const reversalLines = delivery.transactions.filter((t) => t.type === "REVERSAL");
  const activeStockInLines = lines.filter((t) => !t.reversedAt);
  // reverseDelivery reverses a line's STOCK_IN and (on a legacy direct-to-site
  // delivery) its paired ISSUE together, atomically — so the STOCK_IN side
  // alone is a reliable stand-in for "is the whole delivery undone".
  const fullyReversed = lines.length > 0 && activeStockInLines.length === 0;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <PageHeader
          title={
            numbered
              ? `Delivery ${formatSiteChallanNo(numbered.challanNo)}`
              : `Delivery ${delivery.reference || `#${delivery.id.slice(0, 8)}`}`
          }
          subtitle={
            <>
              {delivery.supplier ? `From ${delivery.supplier} · ` : ""}
              received {delivery.receivedAt.toLocaleDateString()} by {delivery.user.name}
              {delivery.note && ` — ${delivery.note}`}
            </>
          }
          actions={
            <div className="flex items-center gap-2">
              {canPrint && (
                <Link href={`/deliveries/${delivery.id}/challan`} className={buttonClasses("secondary")}>
                  <Printer size={14} aria-hidden />
                  Print challan
                </Link>
              )}
              {/* Nothing to reverse on a paper-only challan — it never touched
                  stock or a site's holding, so there is nothing here to undo. */}
              {lines.length > 0 &&
                (fullyReversed ? (
                  <Badge tone="neutral">Reversed</Badge>
                ) : (
                  reverseMode !== "none" &&
                  activeStockInLines.length > 0 && (
                    <ReverseButton
                      action={reverseDelivery.bind(null, delivery.id)}
                      label="this whole delivery"
                      mode={reverseMode}
                    />
                  )
                ))}
            </div>
          }
        />
        {delivery.site && paperLines.length > 0 ? (
          <Alert tone="info">
            Paper challan for{" "}
            <Link href={`/sites/${delivery.site.id}`} className="font-bold underline">
              {delivery.site.name}
            </Link>{" "}
            — this only makes a printable challan. It is not in the item list, and store stock
            and the site&apos;s materials are unchanged.
          </Alert>
        ) : delivery.site ? (
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

      {paperLines.length > 0 && (
        <Card>
          <TableWrap>
            <Table>
              <THead>
                <tr>
                  <Th>Item</Th>
                  <Th>Description</Th>
                  <Th>Qty</Th>
                  <Th>Unit</Th>
                  <Th>Remarks</Th>
                </tr>
              </THead>
              <tbody>
                {paperLines.map((l) => (
                  <Tr key={l.id}>
                    <Td className="font-bold text-ink">{l.name}</Td>
                    <Td className="text-ink-subtle">{l.description ?? ""}</Td>
                    <Td className="font-mono">{l.quantity}</Td>
                    <Td className="text-ink-subtle">{l.unit}</Td>
                    <Td className="text-ink-subtle">{l.remark ?? ""}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        </Card>
      )}

      {paperLines.length === 0 && (
      <Card>
        <TableWrap>
          <Table>
            <THead>
              <tr>
                <Th>Item</Th>
                <Th>Received</Th>
                <Th>Status</Th>
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
        {lines.length === 0 && <EmptyState>Nothing entered stock on this delivery.</EmptyState>}
      </Card>
      )}

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

      {reversalLines.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle tone="danger" icon={<Undo2 size={13} />}>
              Reversal
            </CardTitle>
          </CardHeader>
          <CardBody>
            <p className="text-sm font-semibold text-ink-subtle">
              {reversalLines.length} line{reversalLines.length === 1 ? "" : "s"} of this delivery
              {fullyReversed ? "" : " have been"} reversed
              {reversalLines[0]?.reason && `, reason: "${reversalLines[0].reason}"`}.
            </p>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
