"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CorrectionResult } from "@/lib/actions/corrections";
import { Input } from "@/components/ui/Field";
import Button from "@/components/ui/Button";
import Alert from "@/components/ui/Alert";

export type CountRow = { key: string; label: string; current: number };

/** Records a physical count. Works at pack level because "set the quantity" is
 * ambiguous once an item holds both sealed packs and open remainders.
 *
 * Each row posts TWO numbers: what was counted, and — as a hidden input — the
 * ledger figure this form displayed while they were counting. The server stores
 * the difference rather than the count, so a dispatch landing between opening
 * this form and submitting it is not silently erased. See src/lib/adjustment.ts.
 * Keeping the visible field a count is deliberate: a human counts what is on
 * the shelf, and asking them for "+3" would be asking them to do arithmetic
 * against a number they cannot see. */
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
      <Button onClick={() => setOpen(true)} variant="secondary">
        Record a stock count
      </Button>
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
      className="space-y-3 rounded-card border border-line-strong bg-surface p-3.5"
    >
      <p className="text-sm font-semibold text-ink-subtle">
        Enter what is physically on the shelf. The <em>difference</em> is what gets recorded —
        as an adjustment carrying your reason, so the correction stays visible rather than
        being disguised as an issue, and anything dispatched while you were counting is not
        wiped out by it.
      </p>

      {rows.length === 0 && (
        <p className="text-sm font-semibold text-ink-subtle">
          Nothing in stock to count. Record a stock-in first.
        </p>
      )}

      {rows.map((row) => (
        <div key={row.key} className="flex items-center gap-2">
          <label className="flex-1 text-sm font-semibold text-ink">
            {row.label}
            <span className="ml-1 text-ink-subtle">(ledger says {row.current})</span>
          </label>
          {/* The figure shown in the label, travelling with the count so the
              server can work out the size of the error rather than trusting a
              total that may be stale by the time it is applied. */}
          <input type="hidden" name={`ledger_${row.key}`} value={row.current} />
          <Input
            name={row.key}
            type="number"
            min={0}
            inputMode="numeric"
            defaultValue={row.current}
            className="w-28"
          />
        </div>
      ))}

      <div className="space-y-1">
        <label className="text-sm font-semibold text-ink-muted">Reason (required)</label>
        <Input name="reason" required placeholder={`e.g. annual count — 12 ${baseUnit} unaccounted`} />
      </div>

      {error && <Alert tone="danger">{error}</Alert>}

      <div className="flex gap-2">
        <Button type="button" onClick={() => setOpen(false)} variant="secondary">
          Cancel
        </Button>
        <Button type="submit" disabled={pending} variant="secondary">
          {pending ? "Recording…" : "Record count"}
        </Button>
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
        className="text-xs font-semibold text-ink-subtle underline hover:text-danger-ink"
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
      className="space-y-2 rounded-control border border-warn-line bg-warn-soft p-2"
    >
      <p className="text-xs font-semibold text-warn-ink">
        Undo {label}? This restores the packs exactly as they were. It is not the same as a
        return, which would create new stock.
      </p>
      <Input name="reason" required placeholder="Reason (required)" />
      {error && (
        <Alert tone="danger" className="text-xs">
          {error}
        </Alert>
      )}
      <div className="flex gap-2">
        <Button type="button" onClick={() => setOpen(false)} variant="secondary" size="sm">
          Cancel
        </Button>
        <Button type="submit" disabled={pending} variant="secondary" size="sm">
          {pending ? "Reversing…" : "Confirm reversal"}
        </Button>
      </div>
    </form>
  );
}
