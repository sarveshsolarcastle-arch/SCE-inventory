"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateDefectiveStatus } from "@/lib/actions/deliveries";
import { Select } from "@/components/ui/Field";
import Button from "@/components/ui/Button";
import Alert from "@/components/ui/Alert";

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

  if (status === "REPLACED") return <span className="text-xs font-semibold text-ink-subtle">settled</span>;

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} variant="secondary" size="sm">
        {status === "QUARANTINED" ? "Mark claimed" : "Mark replaced"}
      </Button>
    );
  }

  // QUARANTINED → CLAIMED needs no extra information, so it is a single click.
  if (status === "QUARANTINED") {
    return (
      <form action={run} className="space-y-1">
        <input type="hidden" name="status" value="CLAIMED" />
        {error && <Alert tone="danger" className="text-xs">{error}</Alert>}
        <div className="flex gap-1">
          <Button type="button" onClick={() => setOpen(false)} variant="secondary" size="sm">
            Cancel
          </Button>
          <Button type="submit" disabled={pending} variant="secondary" size="sm">
            {pending ? "…" : "Confirm claimed"}
          </Button>
        </div>
      </form>
    );
  }

  return (
    <form action={run} className="space-y-1">
      <input type="hidden" name="status" value="REPLACED" />
      <Select name="replacedByDeliveryId" required>
        <option value="">Which delivery replaced it?</option>
        {deliveries.map((d) => (
          <option key={d.id} value={d.id}>
            {d.label}
          </option>
        ))}
      </Select>
      {deliveries.length === 0 && (
        <p className="text-xs font-semibold text-ink-subtle">
          Record the supplier&apos;s replacement as an ordinary delivery first.
        </p>
      )}
      {error && <Alert tone="danger" className="text-xs">{error}</Alert>}
      <div className="flex gap-1">
        <Button type="button" onClick={() => setOpen(false)} variant="secondary" size="sm">
          Cancel
        </Button>
        <Button type="submit" disabled={pending} variant="secondary" size="sm">
          {pending ? "…" : "Confirm replaced"}
        </Button>
      </div>
    </form>
  );
}
