import { createClient } from "@libsql/client";
import { resolveDatabaseUrl } from "@/lib/databaseUrl";
import { dumpDatabase } from "./dump";

export type RestoreResult = { ok: true } | { ok: false; message: string };

/** Overwrites the live database with `sql` (a dump produced by dumpDatabase).
 *
 * Takes a safety dump of the CURRENT database first and restores it if the
 * new script fails partway through. SQLite's DDL is not fully transactional
 * across a dropped-and-recreated table, so `executeMultiple`'s own
 * transaction is not enough on its own to guarantee an all-or-nothing
 * outcome — this is the belt alongside that braces.
 */
export async function restoreDatabase(sql: string): Promise<RestoreResult> {
  let safety;
  try {
    safety = await dumpDatabase();
  } catch (error) {
    return {
      ok: false,
      message:
        "Could not take a safety copy of the current database before restoring, " +
        "so nothing was touched. " +
        (error instanceof Error ? error.message : String(error)),
    };
  }

  const client = createClient({
    url: resolveDatabaseUrl(),
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  try {
    await client.executeMultiple(sql);
  } catch (error) {
    const restoreError = error instanceof Error ? error.message : String(error);
    try {
      await client.executeMultiple(safety.sql);
    } catch (rollbackError) {
      return {
        ok: false,
        message:
          `Restore failed (${restoreError}) AND the automatic rollback to the ` +
          `pre-restore state also failed (${
            rollbackError instanceof Error ? rollbackError.message : String(rollbackError)
          }). The database may be in a partial state — restore again from a known-good backup immediately.`,
      };
    }
    return {
      ok: false,
      message: `Restore failed and was rolled back to the state before it started. ${restoreError}`,
    };
  } finally {
    client.close();
  }

  return { ok: true };
}
