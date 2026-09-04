"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteShelf } from "@/lib/actions/shelf";
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
 */
export default function DeleteShelfButton({
  shelfId,
  shelfName,
  assignedBoxes,
  placedPacks,
}: {
  shelfId: string;
  shelfName: string;
  /** Boxes on this shelf with an item assigned to them. */
  assignedBoxes: number;
  /** Open/scrap packs recorded as sitting in one of those boxes. */
  placedPacks: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const occupied = assignedBoxes > 0 || placedPacks > 0;

  function remove() {
    setError(null);
    startTransition(async () => {
      const result = await deleteShelf(shelfId);
      if (!result.ok) {
        setError(result.message);
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
      {error && <Alert tone="danger">{error}</Alert>}

      {confirming ? (
        <>
          <Alert tone="warn">
            <p>
              Delete <strong>{shelfName}</strong> permanently? This cannot be undone.
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
          <div className="flex gap-2">
            <Button variant="danger" onClick={remove} disabled={pending}>
              {pending ? "Deleting…" : "Yes, delete it"}
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
        <Button variant="danger" onClick={() => setConfirming(true)}>
          <Trash2 size={14} />
          Delete shelf
        </Button>
      )}

      <p className="text-xs font-semibold text-ink-subtle">
        Removes this shelf and its box layout. Stock is unaffected — only the record of
        where it sits.
      </p>
    </div>
  );
}
