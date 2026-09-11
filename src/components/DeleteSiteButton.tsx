"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Send } from "lucide-react";
import { deleteSite } from "@/lib/actions/sites";
import { ATTACHMENT_KINDS_SUMMARY } from "@/lib/siteBlockers";
import {
  controlLabel,
  noticeFor,
  pendingLabel,
  type ControlMode,
  type Notice,
} from "@/lib/approvals/labels";
import Button from "@/components/ui/Button";
import Alert from "@/components/ui/Alert";

/** Deleting a site is the one irreversible thing on this page, so it asks
 * twice — inline rather than through `confirm()`, which cannot say WHY the
 * site is safe to remove. The second step names the site, because the reason
 * this button exists is duplicate rows that look identical at a glance.
 *
 * In `request` mode (stage 8) the same two steps raise an ApprovalRequest
 * instead. Three things change and each one is a claim that would otherwise be
 * false: the button is secondary rather than danger, because asking destroys
 * nothing; the confirm step asks for a REASON, because `deleteSite`'s optional
 * second argument is the only thing that reaches the admin explaining why —
 * without it every request lands in the queue with `reason: null`; and the
 * result is an info notice that STAYS PUT rather than a redirect to /sites,
 * because the site is still there.
 */
export default function DeleteSiteButton({
  siteId,
  siteName,
  mode,
}: {
  siteId: string;
  siteName: string;
  /** `do` deletes it; `request` asks an admin to. The page renders nothing at
   * all for `none`, so this never sees it. */
  mode: ControlMode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);

  const asking = mode === "request";

  function remove() {
    setNotice(null);
    startTransition(async () => {
      const result = await deleteSite(siteId, asking ? reason : undefined);
      if (!result.ok) {
        setNotice(noticeFor(result));
        setConfirming(false);
        return;
      }
      // The site's own page no longer exists, so stay off it.
      router.replace("/sites");
      router.refresh();
    });
  }

  return (
    <div className="space-y-2.5">
      {/* Rendered above the control and outside the confirm branch, so it
          survives the collapse back to the resting state. A raised request has
          to still be readable after the card re-renders — that message was
          lost twice during stage 6, both times by something unmounting the
          component that held it. */}
      {notice && <Alert tone={notice.tone}>{notice.message}</Alert>}

      {confirming ? (
        <>
          <Alert tone="warn">
            {asking ? (
              <>
                Ask an admin to delete <strong>{siteName}</strong>? They will see this
                request and can carry it out or turn it down. Nothing is removed until
                one of them approves.
              </>
            ) : (
              <>
                Delete <strong>{siteName}</strong> permanently? This cannot be undone.
              </>
            )}
          </Alert>

          {asking && (
            <div className="space-y-1">
              <label
                htmlFor="delete-site-reason"
                className="text-sm font-semibold text-ink-muted"
              >
                Why? (required — the admin sees only this)
              </label>
              {/* A plain input rather than the Field primitive: this is not a
                  form, the delete is an onClick, so the value has to live in
                  state to reach the action at all. */}
              <input
                id="delete-site-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. duplicate of Borivali Site, created by mistake"
                className="w-full rounded-control border border-line-strong bg-surface px-3 py-2 text-sm font-medium text-ink placeholder:text-ink-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          )}

          <div className="flex gap-2">
            <Button
              variant={asking ? "primary" : "danger"}
              onClick={remove}
              disabled={pending || (asking && reason.trim() === "")}
            >
              {pending
                ? pendingLabel(mode, "Deleting…")
                : asking
                  ? "Send the request"
                  : "Yes, delete it"}
            </Button>
            <Button
              variant="secondary"
              onClick={() => setConfirming(false)}
              disabled={pending}
            >
              Cancel
            </Button>
          </div>
        </>
      ) : (
        <Button
          variant={asking ? "secondary" : "danger"}
          onClick={() => setConfirming(true)}
        >
          {asking ? <Send size={14} /> : <Trash2 size={14} />}
          {controlLabel(mode, "Delete site", "delete this site")}
        </Button>
      )}

      <p className="text-xs font-semibold text-ink-subtle">
        Only possible while nothing is attached to this site — no {ATTACHMENT_KINDS_SUMMARY}.
        {asking && " An admin has to approve it before it happens."}
      </p>
    </div>
  );
}
