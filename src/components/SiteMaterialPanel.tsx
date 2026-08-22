"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Boxes } from "lucide-react";
import {
  consumeAtSite,
  markForPickup,
  transferBetweenSites,
} from "@/lib/actions/siteLifecycle";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Field";
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
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const lines = rows
    .map((r) => ({ itemId: r.itemId, quantity: Number(consumed[r.itemId]) || 0 }))
    .filter((l) => l.quantity > 0);

  /** Consuming material that was flagged for collection is allowed — you do
   * sometimes use what you meant to retrieve — but it must not happen
   * silently, or the pickup list quietly loses entries. */
  function flaggedTouched() {
    return rows.filter(
      (r) => r.flagged > 0 && (Number(consumed[r.itemId]) || 0) > r.quantity - r.flagged
    );
  }

  function submitConsume(force = false) {
    setError(null);
    if (!lines.length) return;

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
      const result = await consumeAtSite(siteId, lines);
      if (result.ok) {
        setConsumed({});
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
              siteId={siteId}
              row={row}
              otherSites={otherSites}
              canConsume={canConsume}
              canTransfer={canTransfer}
              canFlag={canFlag}
              consumedValue={consumed[row.itemId] ?? ""}
              onConsumedChange={(v) => setConsumed((p) => ({ ...p, [row.itemId]: v }))}
            />
          ))}
        </div>

        {canConsume && rows.length > 0 && (
          <Button type="button" onClick={() => submitConsume()} disabled={pending || !lines.length}>
            {pending
              ? "Recording…"
              : `Record consumption${lines.length ? ` (${lines.length} item${lines.length === 1 ? "" : "s"})` : ""}`}
          </Button>
        )}
      </CardBody>
    </Card>
  );
}

function MaterialRow({
  siteId,
  row,
  otherSites,
  canConsume,
  canTransfer,
  canFlag,
  consumedValue,
  onConsumedChange,
}: {
  siteId: string;
  row: HeldRow;
  otherSites: { id: string; name: string }[];
  canConsume: boolean;
  canTransfer: boolean;
  canFlag: boolean;
  consumedValue: string;
  onConsumedChange: (value: string) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [panel, setPanel] = useState<"none" | "transfer" | "flag">("none");
  const [error, setError] = useState<string | null>(null);

  const inUse = row.quantity - row.flagged;
  const age = row.oldestISO ? describeAge(new Date(row.oldestISO)) : null;

  function runTransfer(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await transferBetweenSites({
        fromSiteId: siteId,
        toSiteId: String(formData.get("toSiteId") ?? ""),
        itemId: row.itemId,
        quantity: Number(formData.get("quantity") ?? 0),
      });
      if (result.ok) {
        setPanel("none");
        router.refresh();
      } else setError(result.message);
    });
  }

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
              max={row.quantity}
              inputMode="numeric"
              value={consumedValue}
              onChange={(e) => onConsumedChange(e.target.value)}
              className="w-24"
            />
          </label>
        )}
        {canTransfer && otherSites.length > 0 && (
          <Button
            type="button"
            onClick={() => setPanel(panel === "transfer" ? "none" : "transfer")}
            variant="secondary"
            size="sm"
          >
            Transfer
          </Button>
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

      {panel === "transfer" && (
        <form action={runTransfer} className="flex flex-wrap items-end gap-2">
          <Select name="toSiteId" required className="w-auto">
            <option value="">Transfer to…</option>
            {otherSites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          <Input
            name="quantity"
            type="number"
            min={1}
            max={row.quantity}
            inputMode="numeric"
            required
            placeholder={row.baseUnit}
            className="w-24"
          />
          <Button type="submit" disabled={pending} variant="secondary" size="sm">
            {pending ? "…" : "Move it"}
          </Button>
        </form>
      )}

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
