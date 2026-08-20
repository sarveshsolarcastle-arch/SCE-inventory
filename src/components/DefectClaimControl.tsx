"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateDefectiveStatus } from "@/lib/actions/deliveries";

const INPUT =
  "w-full rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900";
const SECONDARY =
  "rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900";

/** Moves one defective row along its claim lifecycle. A replacement always
 * arrives as an ordinary delivery — there is no separate "replacement" path —
 * so marking REPLACED means picking which delivery made good on it. */
export default function DefectClaimControl({
  defectiveId,
  status,
  deliveries,
}: {
  defectiveId: string;
  status: string;
  deliveries: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function run(formData: FormData) {
    startTransition(async () => {
      const result = await updateDefectiveStatus(defectiveId, formData);
      if (result.ok) {
        setOpen(false);
        setError(null);
        router.refresh();
      } else setError(result.message);
    });
  }

  if (status === "REPLACED") return <span className="text-xs text-zinc-500">settled</span>;

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className={SECONDARY}>
        {status === "QUARANTINED" ? "Mark claimed" : "Mark replaced"}
      </button>
    );
  }

  // QUARANTINED → CLAIMED needs no extra information, so it is a single click.
  if (status === "QUARANTINED") {
    return (
      <form action={run} className="space-y-1">
        <input type="hidden" name="status" value="CLAIMED" />
        {error && <p className="text-xs text-red-700 dark:text-red-300">{error}</p>}
        <div className="flex gap-1">
          <button type="button" onClick={() => setOpen(false)} className={SECONDARY}>
            Cancel
          </button>
          <button type="submit" disabled={pending} className={SECONDARY}>
            {pending ? "…" : "Confirm claimed"}
          </button>
        </div>
      </form>
    );
  }

  return (
    <form action={run} className="space-y-1">
      <input type="hidden" name="status" value="REPLACED" />
      <select name="replacedByDeliveryId" required className={INPUT}>
        <option value="">Which delivery replaced it?</option>
        {deliveries.map((d) => (
          <option key={d.id} value={d.id}>
            {d.label}
          </option>
        ))}
      </select>
      {deliveries.length === 0 && (
        <p className="text-xs text-zinc-500">
          Record the supplier&apos;s replacement as an ordinary delivery first.
        </p>
      )}
      {error && <p className="text-xs text-red-700 dark:text-red-300">{error}</p>}
      <div className="flex gap-1">
        <button type="button" onClick={() => setOpen(false)} className={SECONDARY}>
          Cancel
        </button>
        <button type="submit" disabled={pending} className={SECONDARY}>
          {pending ? "…" : "Confirm replaced"}
        </button>
      </div>
    </form>
  );
}
