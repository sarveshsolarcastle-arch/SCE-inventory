"use client";

import { useRef, useState, useTransition } from "react";
import { UploadCloud } from "lucide-react";
import { restoreFromUpload } from "@/lib/actions/backup";
import Button from "@/components/ui/Button";
import Alert from "@/components/ui/Alert";

/** The fallback path for when GitHub itself is unreachable: restore from a
 * `.sql` file the admin already has a copy of (e.g. one downloaded earlier
 * via "Download a copy", or pulled by hand from the repo). Same destructive
 * weight as RestoreBackupButton, so it gets the same two-step confirm. */
export default function RestoreFromFileForm() {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function submit() {
    const form = formRef.current;
    if (!form) return;
    setError(null);
    const formData = new FormData(form);
    startTransition(async () => {
      const result = await restoreFromUpload(formData);
      if (!result.ok) {
        setError(result.message);
      }
      // On success the action redirects to /login itself.
    });
  }

  return (
    <form
      ref={formRef}
      className="space-y-2.5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!confirming) {
          setConfirming(true);
          return;
        }
        submit();
      }}
    >
      {error && <Alert tone="danger">{error}</Alert>}

      <input
        type="file"
        name="file"
        accept=".sql"
        required
        onChange={(e) => {
          setFileName(e.target.files?.[0]?.name ?? null);
          setConfirming(false);
        }}
        className="block w-full text-sm text-ink-muted file:mr-3 file:rounded-control file:border file:border-line-strong file:bg-surface file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-ink hover:file:bg-surface-sunken"
      />

      {confirming && fileName && (
        <Alert tone="danger">
          This replaces every row in the live database with the contents of{" "}
          <strong>{fileName}</strong>. Everyone — including you — is signed out.
        </Alert>
      )}

      <div className="flex gap-2">
        <Button type="submit" variant="danger" disabled={pending || !fileName}>
          <UploadCloud size={14} />
          {pending
            ? "Restoring…"
            : confirming
              ? "Yes, restore from this file"
              : "Restore from a file"}
        </Button>
        {confirming && (
          <Button
            type="button"
            variant="secondary"
            onClick={() => setConfirming(false)}
            disabled={pending}
          >
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
