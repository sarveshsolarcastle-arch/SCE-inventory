import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";

/** Shown when a form opened with rows already filled in from an earlier visit.
 * Without it a restored draft is indistinguishable from a bug, and a stale one
 * could be submitted by someone who thinks they are starting fresh. */
export default function DraftNotice({ onDiscard }: { onDiscard: () => void }) {
  return (
    <Alert tone="info" className="flex flex-wrap items-center justify-between gap-2">
      <span>
        Picked up where you left off — what you had typed here has been restored.
      </span>
      <Button type="button" variant="secondary" onClick={onDiscard}>
        Start over
      </Button>
    </Alert>
  );
}
