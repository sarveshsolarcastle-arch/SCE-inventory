import { redirect } from "next/navigation";
import { Download, DatabaseBackup } from "lucide-react";
import { can, currentUser } from "@/lib/permissions";
import { listBackups } from "@/lib/backup/github";
import PageHeader from "@/components/ui/PageHeader";
import Alert from "@/components/ui/Alert";
import EmptyState from "@/components/ui/EmptyState";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import { TableWrap, Table, THead, Th, Tr, Td } from "@/components/ui/Table";
import { buttonClasses } from "@/components/ui/Button";
import RestoreBackupButton from "@/components/RestoreBackupButton";
import RestoreFromFileForm from "@/components/RestoreFromFileForm";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export default async function BackupsPage() {
  const user = await currentUser();
  // Page-level gating is convenience; every action re-checks for itself.
  if (!can(user?.role, "backup:manage")) redirect("/dashboard");

  let backups: Awaited<ReturnType<typeof listBackups>> = [];
  let listError: string | null = null;
  try {
    backups = await listBackups();
  } catch (error) {
    listError = error instanceof Error ? error.message : "Could not reach GitHub";
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Backups"
        subtitle="A copy of the database is committed to GitHub every night, kept for 30 days."
        actions={
          <a href="/api/backups/download" className={buttonClasses("secondary")}>
            <Download size={14} />
            Download a copy
          </a>
        }
      />

      {backups.length <= 1 && !listError && (
        <Alert tone="warn">
          {backups.length === 0
            ? "No nightly backups yet — the scheduled job has not run, or hasn't been set up. " +
              "“Download a copy” still works for a manual copy right now."
            : "Only one nightly backup exists so far. Coverage improves every night this keeps running."}
        </Alert>
      )}

      {listError && (
        <Alert tone="danger">
          Could not list backups from GitHub: {listError}. This does not affect the nightly
          job itself, only this page&apos;s ability to show what&apos;s there.
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle icon={<DatabaseBackup size={14} />} tone="info">
            Nightly backups
          </CardTitle>
        </CardHeader>
        {backups.length === 0 ? (
          <EmptyState>Nothing here yet.</EmptyState>
        ) : (
          <TableWrap>
            <Table>
              <THead>
                <Tr>
                  <Th>Date</Th>
                  <Th>Size</Th>
                  <Th>Restore</Th>
                </Tr>
              </THead>
              <tbody>
                {backups.map((backup) => (
                  <Tr key={backup.name}>
                    <Td className="font-semibold text-ink">{backup.date}</Td>
                    <Td className="text-ink-muted">{formatSize(backup.size)}</Td>
                    <Td>
                      <RestoreBackupButton name={backup.name} date={backup.date} />
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle tone="warn">Restore from a file</CardTitle>
        </CardHeader>
        <CardBody className="space-y-3">
          <p className="text-sm font-semibold text-ink-muted">
            Use this only if GitHub is unreachable and you already have a backup file — for
            example one saved earlier with &ldquo;Download a copy&rdquo;.
          </p>
          <RestoreFromFileForm />
        </CardBody>
      </Card>
    </div>
  );
}
