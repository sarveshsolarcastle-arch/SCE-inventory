"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { DecisionResult } from "@/lib/actions/approvals";
import { Input } from "@/components/ui/Field";
import Button from "@/components/ui/Button";
import Alert from "@/components/ui/Alert";

/* A client component rather than a bare `<form action={approveRequest.bind(…)}>`,
 * for one reason: a server-action form drops the RETURN VALUE, and the two
 * messages that matter most here ARE that return value —
 *
 *   "Another admin answered this first"          (the race)
 *   "Nothing was done — the operation refused: 1 dispatch attached"   (FAILED)
 *
 * Neither is visible from the refreshed page alone: the row simply changes
 * status, and the admin who clicked would be left guessing which of them had
 * happened. Mirrors CorrectionPanel's idiom exactly — useTransition, action as
 * a prop, Alert on failure, router.refresh() on success. */

function useDecision() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<DecisionResult>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      // On success the row leaves the queue, so the refresh IS the feedback.
      if (result.ok) {
        router.refresh();
        return;
      }
      // ON FAILURE, DELIBERATELY NO REFRESH. Found by testing this page: a
      // refused approval writes FAILED, which takes the row out of the pending
      // list — so refreshing unmounts this very component and takes the message
      // with it. The admin would see the card vanish and never learn whether it
      // was carried out, raced, or refused, which is precisely the outcome this
      // client component exists to prevent. The card stays put, saying what
      // happened, until they ask for a fresh queue.
      setError(result.message);
    });
  }

  return { pending, error, run, refresh: () => router.refresh() };
}

export function ApprovalDecision({
  approve,
  reject,
}: {
  approve: () => Promise<DecisionResult>;
  reject: (formData: FormData) => Promise<DecisionResult>;
}) {
  const { pending, error, run, refresh } = useDecision();
  const [declining, setDeclining] = useState(false);

  // Answered, but not the way the admin asked for — refused, or raced. The
  // decision buttons go away, because this row is no longer theirs to answer,
  // and the sentence stays until they take the fresh queue.
  if (error) {
    return (
      <div className="space-y-2.5">
        <Alert tone="danger">{error}</Alert>
        <Button variant="secondary" size="sm" onClick={refresh}>
          Show me the queue as it is now
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {declining ? (
        <form
          action={(formData) => run(() => reject(formData))}
          className="flex flex-wrap items-center gap-2"
        >
          <Input
            name="note"
            placeholder="Why not? (optional — they will see this)"
            className="w-64"
            autoComplete="off"
          />
          <Button type="submit" variant="danger" size="sm" disabled={pending}>
            {pending ? "Declining…" : "Confirm decline"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setDeclining(false)}
            disabled={pending}
          >
            Cancel
          </Button>
        </form>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => run(approve)} disabled={pending} size="sm">
            {pending ? "Working…" : "Approve and carry it out"}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setDeclining(true)}
            disabled={pending}
          >
            Decline
          </Button>
        </div>
      )}
    </div>
  );
}

export function WithdrawButton({ cancel }: { cancel: () => Promise<DecisionResult> }) {
  const { pending, error, run, refresh } = useDecision();

  // Same reasoning as above: the only failure here is "an admin already
  // answered it", and refreshing would replace the row before that sentence
  // could be read.
  if (error) {
    return (
      <div className="space-y-1.5">
        <Alert tone="danger">{error}</Alert>
        <Button variant="secondary" size="sm" onClick={refresh}>
          Refresh
        </Button>
      </div>
    );
  }

  return (
    <Button variant="secondary" size="sm" onClick={() => run(cancel)} disabled={pending}>
      {pending ? "Withdrawing…" : "Withdraw"}
    </Button>
  );
}
