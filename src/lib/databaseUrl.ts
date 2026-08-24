/* -------------------------------------------------------------------------
 * Resolving the database URL — the one deployment decision that fails silently.
 *
 * The previous form was `process.env.DATABASE_URL ?? "file:./dev.db"`, which
 * meant a production server with the variable unset started **successfully**
 * against an empty SQLite file created in whatever the working directory
 * happened to be. Nothing errors. The inventory simply looks empty, and
 * anything written into it lands in a file the next deploy deletes.
 *
 * A checklist item in PROGRESS.md was the only thing standing between that and
 * a lost ledger, which is the weakest available enforcement for a failure that
 * is invisible when it happens. So the fallback is refused where it is
 * dangerous and kept where it is convenient: development gets the local file,
 * production must be told explicitly.
 *
 * Same reasoning as `effectiveFlagged` in siteBalance.ts — make the wrong state
 * underivable rather than documenting that nobody should derive it.
 * ---------------------------------------------------------------------- */

/** The local development database. Never used when NODE_ENV is "production". */
export const DEV_DATABASE_URL = "file:./dev.db";

export type DatabaseEnv = {
  DATABASE_URL?: string | undefined;
  NODE_ENV?: string | undefined;
};

/**
 * The database URL for this process.
 *
 * @throws in production when `DATABASE_URL` is missing or blank, rather than
 * quietly falling back to a phantom local database.
 */
export function resolveDatabaseUrl(env: DatabaseEnv = process.env): string {
  const url = env.DATABASE_URL?.trim();
  if (url) return url;

  if (env.NODE_ENV === "production") {
    throw new Error(
      "DATABASE_URL is not set. Refusing to start: without it this process " +
        "would run against an empty database in its working directory, " +
        "reporting no error while losing every write. Set DATABASE_URL in the " +
        "environment — see .env.example.",
    );
  }

  return DEV_DATABASE_URL;
}
