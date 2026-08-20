"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  consumeAtSite,
  markForPickup,
  transferBetweenSites,
} from "@/lib/actions/siteLifecycle";

const INPUT =
  "w-full rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900";
const PRIMARY =
  "rounded bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900";
const SECONDARY =
  "rounded border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900";

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
    <div className="space-y-3 rounded border border-zinc-200 p-4 dark:border-zinc-800">
      <h2 className="font-medium text-zinc-900 dark:text-zinc-50">
        Materials Currently at This Site
      </h2>

      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}

      {warning && (
        <div className="space-y-2 rounded border border-amber-400 bg-amber-50 p-2 text-sm dark:border-amber-700 dark:bg-amber-950">
          <p className="text-amber-800 dark:text-amber-300">{warning}</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setWarning(null)} className={SECONDARY}>
              Go back
            </button>
            <button
              type="button"
              onClick={() => submitConsume(true)}
              disabled={pending}
              className={SECONDARY}
            >
              Consume anyway
            </button>
          </div>
        </div>
      )}

      {rows.length === 0 && (
        <p className="py-4 text-center text-sm text-zinc-500 dark:text-zinc-500">
          Nothing currently at this site.
        </p>
      )}

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
        <button
          type="button"
          onClick={() => submitConsume()}
          disabled={pending || !lines.length}
          className={PRIMARY}
        >
          {pending
            ? "Recording…"
            : `Record consumption${lines.length ? ` (${lines.length} item${lines.length === 1 ? "" : "s"})` : ""}`}
        </button>
      )}
    </div>
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
    <div className="space-y-2 rounded border border-zinc-200 p-2 dark:border-zinc-800">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-medium text-zinc-900 dark:text-zinc-50">{row.name}</span>
        <span className="text-sm text-zinc-600 dark:text-zinc-400">
          {row.quantity} {row.baseUnit}
          {age && <span className="ml-2 text-xs text-zinc-500">· here {age}</span>}
        </span>
      </div>

      {row.flagged > 0 && (
        <p className="text-xs text-sky-700 dark:text-sky-400">
          {row.flagged} {row.baseUnit} awaiting collection · {inUse} {row.baseUnit} in use
        </p>
      )}

      {error && (
        <p role="alert" className="text-xs text-red-700 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {canConsume && (
          <label className="flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-400">
            consumed
            <input
              type="number"
              min={0}
              max={row.quantity}
              inputMode="numeric"
              value={consumedValue}
              onChange={(e) => onConsumedChange(e.target.value)}
              className={`${INPUT} w-24`}
            />
          </label>
        )}
        {canTransfer && otherSites.length > 0 && (
          <button
            type="button"
            onClick={() => setPanel(panel === "transfer" ? "none" : "transfer")}
            className={SECONDARY}
          >
            Transfer
          </button>
        )}
        {canFlag && (
          <button
            type="button"
            onClick={() => setPanel(panel === "flag" ? "none" : "flag")}
            className={SECONDARY}
          >
            {row.flagged > 0 ? "Update collection flag" : "Flag for collection"}
          </button>
        )}
      </div>

      {panel === "transfer" && (
        <form action={runTransfer} className="flex flex-wrap items-end gap-2">
          <select name="toSiteId" required className={`${INPUT} w-auto`}>
            <option value="">Transfer to…</option>
            {otherSites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <input
            name="quantity"
            type="number"
            min={1}
            max={row.quantity}
            inputMode="numeric"
            required
            placeholder={row.baseUnit}
            className={`${INPUT} w-24`}
          />
          <button type="submit" disabled={pending} className={SECONDARY}>
            {pending ? "…" : "Move it"}
          </button>
        </form>
      )}

      {panel === "flag" && (
        <form action={runFlag} className="space-y-2">
          <p className="text-xs text-zinc-500 dark:text-zinc-500">
            Flagging labels material as not worth a trip yet. It stays company
            property and is never written off — set 0 to clear the flag.
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <input
              name="quantity"
              type="number"
              min={0}
              max={row.quantity}
              inputMode="numeric"
              defaultValue={row.flagged || ""}
              required
              placeholder={row.baseUnit}
              className={`${INPUT} w-24`}
            />
            <input name="note" placeholder="note (optional)" className={`${INPUT} w-48`} />
            <button type="submit" disabled={pending} className={SECONDARY}>
              {pending ? "…" : "Save"}
            </button>
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
