"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CorrectionResult } from "@/lib/actions/corrections";
import {
  controlLabel,
  noticeFor,
  pendingLabel,
  requestHint,
  type ControlMode,
  type Notice,
} from "@/lib/approvals/labels";
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
 * against a number they cannot see.
 *
 * In `request` mode (stage 8) that delta storage stops being a nicety and
 * becomes what makes the feature possible at all: the gap between counting and
 * applying is now however long an admin takes to answer, and only the SIZE of
 * the error survives legitimate movement in between. What gets applied on
 * approval is the correction they found, never the total they typed. */
export function AdjustStockForm({
  rows,
  baseUnit,
  action,
  mode,
}: {
  rows: CountRow[];
  baseUnit: string;
  action: (formData: FormData) => Promise<CorrectionResult>;
  /** `do` applies the adjustment; `request` asks an admin to. The page renders
   * nothing at all for `none`, so this never sees it. */
  mode: ControlMode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const asking = mode === "request";

  if (!open) {
    return (
      <div className="space-y-2.5">
        {/* The notice is rendered in the COLLAPSED state as well, because a
            raised request closes the form and the sentence is the only
            acknowledgement there is. Stage 6 lost this exact message twice,
            both times by unmounting the thing holding it. */}
        {notice && <Alert tone={notice.tone}>{notice.message}</Alert>}
        <Button onClick={() => setOpen(true)} variant="secondary">
          {controlLabel(mode, "Record a stock count", "correct this item's stock")}
        </Button>
      </div>
    );
  }

  return (
    <form
      action={(formData) =>
        startTransition(async () => {
          const result = await action(formData);
          if (result.ok) {
            setOpen(false);
            setNotice(null);
            router.refresh();
            return;
          }
          const next = noticeFor(result);
          setNotice(next);
          // A raised request collapses the form: there is nothing left to edit,
          // and re-submitting the same count would only collapse into the
          // pending request as a duplicate. A refusal keeps it open, because
          // the numbers in it are exactly what needs changing.
          if (next.tone === "info") setOpen(false);
        })
      }
      className="space-y-3 rounded-card border border-line-strong bg-surface p-3.5"
    >
      <p className="text-sm font-semibold text-ink-subtle">
        Enter what is physically on the shelf. The <em>difference</em> is what gets recorded —
        as an adjustment carrying your reason, so the correction stays visible rather than
        being disguised as an issue, and anything dispatched while you were counting is not
        wiped out by it.
        {asking && (
          <>
            {" "}
            An admin has to approve it first, and the difference is what they approve — so
            the wait cannot wipe out anything dispatched in the meantime either.
          </>
        )}
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

      {notice && <Alert tone={notice.tone}>{notice.message}</Alert>}

      <div className="flex gap-2">
        <Button type="button" onClick={() => setOpen(false)} variant="secondary">
          Cancel
        </Button>
        <Button type="submit" disabled={pending} variant="secondary">
          {pending
            ? pendingLabel(mode, "Recording…")
            : asking
              ? // The paragraph above already frames this as a request; the
                // button is the send, not a second "ask an admin to".
                "Send the request"
              : "Record count"}
        </Button>
      </div>

      {requestHint(mode) && (
        <p className="text-xs font-semibold text-ink-subtle">{requestHint(mode)}</p>
      )}
    </form>
  );
}

/** Undoes a movement recorded in error, restoring the exact prior state.
 * Distinct from a return, which creates new stock because material physically
 * comes back.
 *
 * The reason field is mandatory in both modes and is the same sentence either
 * way — "why are you undoing this" and "why are you asking me to undo this"
 * are one question — so the approval reason comes for free. */
export function ReverseButton({
  action,
  label,
  mode,
}: {
  action: (formData: FormData) => Promise<CorrectionResult>;
  label: string;
  /** `do` reverses it; `request` asks an admin to. The page renders nothing at
   * all for `none`, so this never sees it. */
  mode: ControlMode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const asking = mode === "request";

  if (!open) {
    return (
      <div className="space-y-1">
        {/* Kept in the collapsed state so the acknowledgement survives the
            panel closing — it is the only confirmation a requester gets, and
            this control sits in a table cell that nothing else explains. */}
        {notice && (
          <Alert tone={notice.tone} className="text-xs">
            {notice.message}
          </Alert>
        )}
        <button
          onClick={() => setOpen(true)}
          className="text-xs font-semibold text-ink-subtle underline hover:text-danger-ink"
        >
          {/* NOT controlLabel. This control lives in a ~60px transaction-history
              table cell, and "Ask an admin to reverse this" wraps to four lines
              in every row — the labels module cannot know that, so the call
              site makes the call. The full sentence is not lost: the panel this
              opens leads with "Ask an admin to undo this ISSUE of …". */}
          {asking ? "Request reversal" : "Reverse"}
        </button>
      </div>
    );
  }

  return (
    <form
      action={(formData) =>
        startTransition(async () => {
          const result = await action(formData);
          if (result.ok) {
            setOpen(false);
            setNotice(null);
            router.refresh();
            return;
          }
          const next = noticeFor(result);
          setNotice(next);
          // Same split as the count form: a raised request has nothing left to
          // edit, a refusal does.
          if (next.tone === "info") setOpen(false);
        })
      }
      className="space-y-2 rounded-control border border-warn-line bg-warn-soft p-2"
    >
      <p className="text-xs font-semibold text-warn-ink">
        {asking ? "Ask an admin to undo" : "Undo"} {label}? This restores the packs exactly as
        they were. It is not the same as a return, which would create new stock.
        {asking && " Nothing is undone until one of them approves."}
      </p>
      <Input name="reason" required placeholder="Reason (required)" />
      {notice && (
        <Alert tone={notice.tone} className="text-xs">
          {notice.message}
        </Alert>
      )}
      <div className="flex gap-2">
        <Button type="button" onClick={() => setOpen(false)} variant="secondary" size="sm">
          Cancel
        </Button>
        <Button type="submit" disabled={pending} variant="secondary" size="sm">
          {pending
            ? pendingLabel(mode, "Reversing…")
            : asking
              ? // NOT controlLabel: the surrounding paragraph already said
                // "Ask an admin to undo …", so composing the prefix a second
                // time here reads as "Ask an admin to send the request".
                "Send the request"
              : "Confirm reversal"}
        </Button>
      </div>
    </form>
  );
}
