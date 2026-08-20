"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CorrectionResult } from "@/lib/actions/corrections";

const INPUT =
  "w-full rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900";
const SECONDARY =
  "rounded border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900";

export type CountRow = { key: string; label: string; current: number };

/** Records a physical count. Works at pack level because "set the quantity" is
 * ambiguous once an item holds both sealed packs and open remainders. */
export function AdjustStockForm({
  rows,
  baseUnit,
  action,
}: {
  rows: CountRow[];
  baseUnit: string;
  action: (formData: FormData) => Promise<CorrectionResult>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className={SECONDARY}>
        Record a stock count
      </button>
    );
  }

  return (
    <form
      action={(formData) =>
        startTransition(async () => {
          const result = await action(formData);
          if (result.ok) {
            setOpen(false);
            setError(null);
            router.refresh();
          } else setError(result.message);
        })
      }
      className="space-y-3 rounded border border-zinc-300 p-3 dark:border-zinc-700"
    >
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Enter what is physically on the shelf. The difference is recorded as an
        adjustment with your reason, so the correction stays visible rather than
        being disguised as an issue.
      </p>

      {rows.length === 0 && (
        <p className="text-sm text-zinc-500">
          Nothing in stock to count. Record a stock-in first.
        </p>
      )}

      {rows.map((row) => (
        <div key={row.key} className="flex items-center gap-2">
          <label className="flex-1 text-sm text-zinc-700 dark:text-zinc-300">
            {row.label}
            <span className="ml-1 text-zinc-500">
              (ledger says {row.current})
            </span>
          </label>
          <input
            name={row.key}
            type="number"
            min={0}
            inputMode="numeric"
            defaultValue={row.current}
            className={`${INPUT} w-28`}
          />
        </div>
      ))}

      <div className="space-y-1">
        <label className="text-sm text-zinc-600 dark:text-zinc-400">
          Reason (required)
        </label>
        <input
          name="reason"
          required
          placeholder={`e.g. annual count — 12 ${baseUnit} unaccounted`}
          className={INPUT}
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button type="button" onClick={() => setOpen(false)} className={SECONDARY}>
          Cancel
        </button>
        <button type="submit" disabled={pending} className={SECONDARY}>
          {pending ? "Recording…" : "Record count"}
        </button>
      </div>
    </form>
  );
}

/** Undoes a movement recorded in error, restoring the exact prior state.
 * Distinct from a return, which creates new stock because material physically
 * comes back. */
export function ReverseButton({
  action,
  label,
}: {
  action: (formData: FormData) => Promise<CorrectionResult>;
  label: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-zinc-500 underline hover:text-red-700 dark:hover:text-red-300"
      >
        Reverse
      </button>
    );
  }

  return (
    <form
      action={(formData) =>
        startTransition(async () => {
          const result = await action(formData);
          if (result.ok) {
            setOpen(false);
            setError(null);
            router.refresh();
          } else setError(result.message);
        })
      }
      className="space-y-2 rounded border border-amber-400 bg-amber-50 p-2 dark:border-amber-700 dark:bg-amber-950"
    >
      <p className="text-xs text-zinc-700 dark:text-zinc-300">
        Undo {label}? This restores the packs exactly as they were. It is not the
        same as a return, which would create new stock.
      </p>
      <input
        name="reason"
        required
        placeholder="Reason (required)"
        className={INPUT}
      />
      {error && (
        <p role="alert" className="text-xs text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button type="button" onClick={() => setOpen(false)} className={SECONDARY}>
          Cancel
        </button>
        <button type="submit" disabled={pending} className={SECONDARY}>
          {pending ? "Reversing…" : "Confirm reversal"}
        </button>
      </div>
    </form>
  );
}
