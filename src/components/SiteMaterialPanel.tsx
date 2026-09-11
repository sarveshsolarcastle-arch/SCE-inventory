"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Boxes } from "lucide-react";
import {
  consumeAtSite,
  markForPickup,
  transferBatch,
} from "@/lib/actions/siteLifecycle";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Field";
import Button from "@/components/ui/Button";
import Alert from "@/components/ui/Alert";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";

export type HeldRow = {
  itemId: string;
  name: string;
  baseUnit: string;
  quantity: number;
  /** Base units already flagged as awaiting collection. */
  flagged: number;
  oldestISO: string | null;
};

export default function SiteMaterialPanel({
  siteId,
  rows,
  otherSites,
  canConsume,
  canTransfer,
  canFlag,
}: {
  siteId: string;
  rows: HeldRow[];
  otherSites: { id: string; name: string }[];
  canConsume: boolean;
  canTransfer: boolean;
  canFlag: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [consumed, setConsumed] = useState<Record<string, string>>({});
  // Batching transfers is what makes the shared "remaining" figure below
  // possible at all: consume and transfer are now the same shape — a typed
  // quantity per row, filed together — so one destination covers the whole
  // trip instead of a per-row picker.
  const [transferQty, setTransferQty] = useState<Record<string, string>>({});
  const [transferDestination, setTransferDestination] = useState("");
  // Printed on the transfer challan's signature blocks, same as
  // DispatchBatchForm's pair — blank is fine, the challan then prints ruled
  // lines to fill in when the material actually moves.
  const [deliveredBy, setDeliveredBy] = useState("");
  const [receivedBy, setReceivedBy] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [lastTransferId, setLastTransferId] = useState<string | null>(null);

  function consumedQty(row: HeldRow) {
    return Number(consumed[row.itemId]) || 0;
  }
  function transferQtyOf(row: HeldRow) {
    return Number(transferQty[row.itemId]) || 0;
  }
  /** What is left after BOTH typed-but-not-yet-filed actions on this row are
   * counted — the number that was missing before: each input used to cap at
   * the raw held quantity independently, so typing the full amount into
   * consume left transfer still offering the same amount. */
  function remainingOf(row: HeldRow) {
    return row.quantity - consumedQty(row) - transferQtyOf(row);
  }

  const consumeLines = rows
    .map((r) => ({ itemId: r.itemId, quantity: consumedQty(r) }))
    .filter((l) => l.quantity > 0);
  const transferLines = rows
    .map((r) => ({ itemId: r.itemId, quantity: transferQtyOf(r) }))
    .filter((l) => l.quantity > 0);

  /** Consuming material that was flagged for collection is allowed — you do
   * sometimes use what you meant to retrieve — but it must not happen
   * silently, or the pickup list quietly loses entries. */
  function flaggedTouched() {
    return rows.filter(
      (r) => r.flagged > 0 && consumedQty(r) > r.quantity - r.flagged
    );
  }

  /** Typed consume and transfer together outrunning what a row actually
   * holds. Caught here rather than only by each input's `max`, because a
   * `max` attribute is a hint the browser does not strictly enforce. */
  function overDrawnRows() {
    return rows.filter((r) => remainingOf(r) < 0);
  }
  const overDrawn = overDrawnRows();

  function clearBatches() {
    // Clears BOTH maps on success of either action — the bug this fixes: a
    // completed transfer used to leave typed-but-unfiled consumption behind,
    // now stale against a site that just got smaller.
    setConsumed({});
    setTransferQty({});
  }

  function submitConsume(force = false) {
    setError(null);
    setLastTransferId(null);
    if (!consumeLines.length) return;

    if (!force) {
      const touched = flaggedTouched();
      if (touched.length) {
        setWarning(
          touched
            .map(
              (r) =>
                `${r.flagged} ${r.baseUnit} of ${r.name} here is marked for collection; consuming this much removes it from the pickup list.`
            )
            .join(" ")
        );
        return;
      }
    }

    setWarning(null);
    startTransition(async () => {
      const result = await consumeAtSite(siteId, consumeLines);
      if (result.ok) {
        clearBatches();
        router.refresh();
      } else setError(result.message);
    });
  }

  function submitTransfer() {
    setError(null);
    setWarning(null);
    if (!transferLines.length) return;
    if (!transferDestination) {
      setError("Choose a destination site");
      return;
    }

    startTransition(async () => {
      const result = await transferBatch({
        fromSiteId: siteId,
        toSiteId: transferDestination,
        lines: transferLines,
        deliveredBy,
        receivedBy,
      });
      if (result.ok) {
        clearBatches();
        setDeliveredBy("");
        setReceivedBy("");
        setLastTransferId(result.transferId);
        router.refresh();
      } else setError(result.message);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle tone="special" icon={<Boxes size={13} />}>
          Materials Currently at This Site
        </CardTitle>
      </CardHeader>
      <CardBody className="space-y-3">
        {error && <Alert tone="danger">{error}</Alert>}

        {lastTransferId && (
          <Alert tone="ok" className="flex flex-wrap items-center justify-between gap-2">
            <span>Transfer recorded.</span>
            <Link href={`/transfers/${lastTransferId}/challan`} className="font-bold underline">
              Print challan →
            </Link>
          </Alert>
        )}

        {overDrawn.length > 0 && (
          <Alert tone="danger">
            {overDrawn
              .map(
                (r) =>
                  `${r.name}: consuming and transferring together add up to more than the ${r.quantity} ${r.baseUnit} here.`
              )
              .join(" ")}
          </Alert>
        )}

        {warning && (
          <Alert tone="warn" className="space-y-2">
            <p>{warning}</p>
            <div className="flex gap-2">
              <Button type="button" onClick={() => setWarning(null)} variant="secondary" size="sm">
                Go back
              </Button>
              <Button
                type="button"
                onClick={() => submitConsume(true)}
                disabled={pending}
                variant="secondary"
                size="sm"
              >
                Consume anyway
              </Button>
            </div>
          </Alert>
        )}

        {rows.length === 0 && <EmptyState>Nothing currently at this site.</EmptyState>}

        <div className="space-y-2">
          {rows.map((row) => (
            <MaterialRow
              key={row.itemId}
              row={row}
              canConsume={canConsume}
              canTransfer={canTransfer && otherSites.length > 0}
              canFlag={canFlag}
              siteId={siteId}
              consumedValue={consumed[row.itemId] ?? ""}
              onConsumedChange={(v) => setConsumed((p) => ({ ...p, [row.itemId]: v }))}
              consumedMax={Math.max(0, row.quantity - transferQtyOf(row))}
              transferValue={transferQty[row.itemId] ?? ""}
              onTransferChange={(v) => setTransferQty((p) => ({ ...p, [row.itemId]: v }))}
              transferMax={Math.max(0, row.quantity - consumedQty(row))}
              pending={consumedQty(row) + transferQtyOf(row)}
            />
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canConsume && rows.length > 0 && (
            <Button
              type="button"
              onClick={() => submitConsume()}
              disabled={pending || !consumeLines.length || overDrawn.length > 0}
            >
              {pending
                ? "Recording…"
                : `Record consumption${consumeLines.length ? ` (${consumeLines.length} item${consumeLines.length === 1 ? "" : "s"})` : ""}`}
            </Button>
          )}

          {canTransfer && otherSites.length > 0 && rows.length > 0 && (
            <div className="flex w-full flex-wrap items-end gap-2">
              <Select
                value={transferDestination}
                onChange={(e) => setTransferDestination(e.target.value)}
                className="w-auto"
              >
                <option value="">Transfer to…</option>
                {otherSites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
              {/* Optional — printed on the transfer challan's signature
                  blocks. Left blank, the challan prints them as ruled lines
                  to fill in by hand, same as a Dispatch challan. */}
              <Field label="Delivered by (optional)" className="w-40">
                <Input
                  value={deliveredBy}
                  onChange={(e) => setDeliveredBy(e.target.value)}
                  placeholder="Driver or carrier"
                />
              </Field>
              <Field label="Received by (optional)" className="w-40">
                <Input
                  value={receivedBy}
                  onChange={(e) => setReceivedBy(e.target.value)}
                  placeholder="Person who signs"
                />
              </Field>
              <Button
                type="button"
                variant="secondary"
                onClick={submitTransfer}
                disabled={
                  pending || !transferLines.length || !transferDestination || overDrawn.length > 0
                }
              >
                {pending
                  ? "Recording…"
                  : `Record transfer${transferLines.length ? ` (${transferLines.length} item${transferLines.length === 1 ? "" : "s"})` : ""}`}
              </Button>
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

function MaterialRow({
  row,
  canConsume,
  canTransfer,
  canFlag,
  siteId,
  consumedValue,
  onConsumedChange,
  consumedMax,
  transferValue,
  onTransferChange,
  transferMax,
  pending: pendingQty,
}: {
  row: HeldRow;
  canConsume: boolean;
  canTransfer: boolean;
  canFlag: boolean;
  siteId: string;
  consumedValue: string;
  onConsumedChange: (value: string) => void;
  consumedMax: number;
  transferValue: string;
  onTransferChange: (value: string) => void;
  transferMax: number;
  /** Sum of what is currently typed into consume + transfer for this row,
   * whether or not it has been filed yet. */
  pending: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [panel, setPanel] = useState<"none" | "flag">("none");
  const [error, setError] = useState<string | null>(null);

  const inUse = row.quantity - row.flagged;
  const age = row.oldestISO ? describeAge(new Date(row.oldestISO)) : null;

  function runFlag(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await markForPickup({
        siteId,
        itemId: row.itemId,
        quantity: Number(formData.get("quantity") ?? 0),
        note: String(formData.get("note") ?? ""),
      });
      if (result.ok) {
        setPanel("none");
        router.refresh();
      } else setError(result.message);
    });
  }

  return (
    <div className="space-y-2 rounded-control border border-line p-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-bold text-ink">{row.name}</span>
        <span className="text-sm font-semibold text-ink-muted">
          {row.quantity} {row.baseUnit}
          {pendingQty > 0 && (
            <span className="ml-1 text-xs text-ink-subtle">
              · {pendingQty} {row.baseUnit} pending
            </span>
          )}
          {age && <span className="ml-2 text-xs text-ink-subtle">· here {age}</span>}
        </span>
      </div>

      {row.flagged > 0 && (
        <Badge tone="info">
          {row.flagged} {row.baseUnit} awaiting collection · {inUse} {row.baseUnit} in use
        </Badge>
      )}

      {error && <Alert tone="danger" className="text-xs">{error}</Alert>}

      <div className="flex flex-wrap items-center gap-2">
        {canConsume && (
          <label className="flex items-center gap-1.5 text-xs font-semibold text-ink-muted">
            consumed
            <Input
              type="number"
              min={0}
              max={consumedMax}
              inputMode="numeric"
              value={consumedValue}
              onChange={(e) => onConsumedChange(e.target.value)}
              className="w-24"
            />
          </label>
        )}
        {canTransfer && (
          <label className="flex items-center gap-1.5 text-xs font-semibold text-ink-muted">
            transfer
            <Input
              type="number"
              min={0}
              max={transferMax}
              inputMode="numeric"
              value={transferValue}
              onChange={(e) => onTransferChange(e.target.value)}
              className="w-24"
            />
          </label>
        )}
        {canFlag && (
          <Button
            type="button"
            onClick={() => setPanel(panel === "flag" ? "none" : "flag")}
            variant="secondary"
            size="sm"
          >
            {row.flagged > 0 ? "Update collection flag" : "Flag for collection"}
          </Button>
        )}
      </div>

      {panel === "flag" && (
        <form action={runFlag} className="space-y-2">
          <p className="text-xs font-semibold text-ink-subtle">
            Flagging labels material as not worth a trip yet. It stays company property and is
            never written off — set 0 to clear the flag.
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <Input
              name="quantity"
              type="number"
              min={0}
              max={row.quantity}
              inputMode="numeric"
              defaultValue={row.flagged || ""}
              required
              placeholder={row.baseUnit}
              className="w-24"
            />
            <Input name="note" placeholder="note (optional)" className="w-48" />
            <Button type="submit" disabled={pending} variant="secondary" size="sm">
              {pending ? "…" : "Save"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

function describeAge(from: Date): string {
  const days = Math.floor((Date.now() - from.getTime()) / 86_400_000);
  if (days < 1) return "since today";
  if (days === 1) return "1 day";
  if (days < 60) return `${days} days`;
  return `${Math.floor(days / 30)} months`;
}
