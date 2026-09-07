"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Send } from "lucide-react";
import { deleteShelf } from "@/lib/actions/shelf";
import {
  controlLabel,
  noticeFor,
  pendingLabel,
  type ControlMode,
  type Notice,
} from "@/lib/approvals/labels";
import Button from "@/components/ui/Button";
import Alert from "@/components/ui/Alert";

/** Deleting a shelf warns; it does not refuse. A shelf holds no history — see
 * `deleteShelf` for why that is a schema fact and not a leniency — so an
 * occupied one is a reason to say what will be lost, not a reason to block.
 *
 * What the warning must get right is WHICH loss. "This cannot be undone" on
 * its own invites the reading that stock is at stake, which is the one thing
 * that is not: quantities live on the item's packs and are only ever displayed
 * here. So the confirm step names the two real consequences, with counts, and
 * says plainly that no stock moves. A warning nobody can act on is the same as
 * no warning.
 *
 * In `request` mode the counts matter MORE, not less: they are the only thing
 * the requester can weigh before asking, and the frozen summary an admin reads
 * does not carry them. So the confirm step is unchanged apart from its verb,
 * and it additionally asks for a reason — see DeleteSiteButton for why that
 * field exists rather than being left to `reason: null`.
 */
export default function DeleteShelfButton({
  shelfId,
  shelfName,
  assignedBoxes,
  placedPacks,
  mode,
}: {
  shelfId: string;
  shelfName: string;
  /** Boxes on this shelf with an item assigned to them. */
  assignedBoxes: number;
  /** Open/scrap packs recorded as sitting in one of those boxes. */
  placedPacks: number;
  /** `do` deletes it; `request` asks an admin to. The page renders nothing for
   * `none`, so this never sees it. */
  mode: ControlMode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);

  const occupied = assignedBoxes > 0 || placedPacks > 0;
  const asking = mode === "request";

  function remove() {
    setNotice(null);
    startTransition(async () => {
      const result = await deleteShelf(shelfId, asking ? reason : undefined);
      if (!result.ok) {
        setNotice(noticeFor(result));
        setConfirming(false);
        return;
      }
      // This shelf's own page is gone, so do not navigate back onto it.
      router.replace("/shelf");
      router.refresh();
    });
  }

  return (
    <div className="space-y-2.5">
      {/* Outside the confirm branch so it survives the collapse back to the
          resting state — a raised request has to still be readable afterwards. */}
      {notice && <Alert tone={notice.tone}>{notice.message}</Alert>}

      {confirming ? (
        <>
          <Alert tone="warn">
            <p>
              {asking ? (
                <>
                  Ask an admin to delete <strong>{shelfName}</strong>? Nothing is removed
                  until one of them approves.
                </>
              ) : (
                <>
                  Delete <strong>{shelfName}</strong> permanently? This cannot be undone.
                </>
              )}
            </p>
            {occupied && (
              <p className="mt-1.5">
                It is still in use:{" "}
                {assignedBoxes > 0 && (
                  <>
                    <strong>
                      {assignedBoxes} box{assignedBoxes === 1 ? "" : "es"}
                    </strong>{" "}
                    {assignedBoxes === 1 ? "has" : "have"} an item assigned
                  </>
                )}
                {assignedBoxes > 0 && placedPacks > 0 && ", and "}
                {placedPacks > 0 && (
                  <>
                    <strong>
                      {placedPacks} open pack{placedPacks === 1 ? "" : "s"}
                    </strong>{" "}
                    {placedPacks === 1 ? "is" : "are"} recorded as sitting here
                  </>
                )}
                .
              </p>
            )}
            <p className="mt-1.5">
              <strong>No stock is lost.</strong> Quantities are never stored on a shelf —
              they come from each item&apos;s packs. Deleting this map forgets{" "}
              <em>where things sit</em>, nothing else
              {placedPacks > 0 && (
                <>
                  ; those {placedPacks} pack{placedPacks === 1 ? "" : "s"} become unplaced
                  and can be put in another box
                </>
              )}
              . You will need to re-enter the layout and re-assign the boxes to undo this.
            </p>
          </Alert>
          {asking && (
            <div className="space-y-1">
              <label
                htmlFor="delete-shelf-reason"
                className="text-sm font-semibold text-ink-muted"
              >
                Why? (required — the admin sees only this)
              </label>
              {/* Plain input, not the Field primitive: the delete is an
                  onClick rather than a form submit, so the value has to live in
                  state to reach the action at all. */}
              <input
                id="delete-shelf-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. this rack was dismantled last week"
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
          {controlLabel(mode, "Delete shelf", "delete this shelf")}
        </Button>
      )}

      <p className="text-xs font-semibold text-ink-subtle">
        Removes this shelf and its box layout. Stock is unaffected — only the record of
        where it sits.
        {asking && " An admin has to approve it before it happens."}
      </p>
    </div>
  );
}
