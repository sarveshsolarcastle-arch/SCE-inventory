"use client";

import { useState, useTransition } from "react";
import { History } from "lucide-react";
import { restoreFromGithub } from "@/lib/actions/backup";
import Button from "@/components/ui/Button";
import Alert from "@/components/ui/Alert";
import { Field, Input } from "@/components/ui/Field";

/** Restore is the most destructive action in the app — it overwrites every
 * table — so it asks for more than DeleteSiteButton's two-step confirm: the
 * admin must type the backup's own date before the danger button unlocks.
 * On success the server action itself signs everyone out and redirects to
 * /login, so there is nothing to do here after a successful restore. */
export default function RestoreBackupButton({ name, date }: { name: string; date: string }) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);

  function restore() {
    setError(null);
    startTransition(async () => {
      const result = await restoreFromGithub(name);
      if (!result.ok) {
        setError(result.message);
      }
      // On success the action redirects to /login itself.
    });
  }

  if (!confirming) {
    return (
      <>
        {error && <Alert tone="danger">{error}</Alert>}
        <Button variant="danger" size="sm" onClick={() => setConfirming(true)}>
          <History size={14} />
          Restore
        </Button>
      </>
    );
  }

  return (
    <div className="space-y-2.5">
      <Alert tone="danger">
        This replaces every row in the live database with the <strong>{date}</strong> backup.
        Everything recorded since then is lost, and everyone — including you — is signed out.
        Type <strong>{date}</strong> to confirm.
      </Alert>
      <Field label="Type the date to confirm">
        <Input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={date}
          autoFocus
        />
      </Field>
      <div className="flex gap-2">
        <Button variant="danger" onClick={restore} disabled={pending || typed !== date}>
          {pending ? "Restoring…" : `Yes, restore to ${date}`}
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            setConfirming(false);
            setTyped("");
          }}
          disabled={pending}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
