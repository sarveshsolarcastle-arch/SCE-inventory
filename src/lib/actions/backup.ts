"use server";

import { revalidatePath } from "next/cache";
import { signOut } from "@/lib/auth";
import { NotPermittedError, requireCapability } from "@/lib/permissions";
import { fetchBackup } from "@/lib/backup/github";
import { restoreDatabase, type RestoreResult } from "@/lib/backup/restore";

/** Authorizes a restore request. Every entry point below calls this first —
 * restore is the single most destructive action in the app, so there is no
 * page-only gate here the way ledger:view pages sometimes get away with. */
async function authorize(): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await requireCapability("backup:manage");
    return { ok: true };
  } catch (error) {
    if (error instanceof NotPermittedError) {
      return { ok: false, message: "Your account cannot restore backups" };
    }
    return { ok: false, message: "Not signed in" };
  }
}

/** Restores from one of the nightly GitHub backups, by filename.
 *
 * On success the current session's admin row may no longer exist in the
 * restored data — session tokens are stateless and would keep asserting
 * powers the restored database no longer grants — so every signed-in user is
 * forced back to /login, exactly as AppShell's own sign-out button does.
 */
export async function restoreFromGithub(name: string): Promise<RestoreResult> {
  const auth = await authorize();
  if (!auth.ok) return auth;

  let sql: string;
  try {
    sql = await fetchBackup(name);
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not fetch that backup",
    };
  }

  const result = await restoreDatabase(sql);
  if (!result.ok) return result;

  revalidatePath("/", "layout");
  await signOut({ redirectTo: "/login" });
  return result; // unreachable — signOut() above redirects
}

/** Restores from a `.sql` dump uploaded through the "Restore from a file"
 * fallback, for the case where GitHub itself is unreachable. Same shape and
 * same forced sign-out as restoreFromGithub. */
export async function restoreFromUpload(formData: FormData): Promise<RestoreResult> {
  const auth = await authorize();
  if (!auth.ok) return auth;

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Choose a .sql backup file first" };
  }

  const sql = await file.text();
  const result = await restoreDatabase(sql);
  if (!result.ok) return result;

  revalidatePath("/", "layout");
  await signOut({ redirectTo: "/login" });
  return result; // unreachable — signOut() above redirects
}
