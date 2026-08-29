"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteSite } from "@/lib/actions/sites";
import Button from "@/components/ui/Button";
import Alert from "@/components/ui/Alert";

/** Deleting a site is the one irreversible thing on this page, so it asks
 * twice — inline rather than through `confirm()`, which cannot say WHY the
 * site is safe to remove. The second step names the site, because the reason
 * this button exists is duplicate rows that look identical at a glance. */
export default function DeleteSiteButton({
  siteId,
  siteName,
}: {
  siteId: string;
  siteName: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function remove() {
    setError(null);
    startTransition(async () => {
      const result = await deleteSite(siteId);
      if (!result.ok) {
        setError(result.message);
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
      {error && <Alert tone="danger">{error}</Alert>}

      {confirming ? (
        <>
          <Alert tone="warn">
            Delete <strong>{siteName}</strong> permanently? This cannot be undone.
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
          Delete site
        </Button>
      )}

      <p className="text-xs font-semibold text-ink-subtle">
        Only possible while nothing is attached to this site — no movements,
        dispatches or deliveries.
      </p>
    </div>
  );
}
