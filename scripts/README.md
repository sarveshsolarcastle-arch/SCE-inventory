# Scripts

Maintenance and data scripts. Run with `npx tsx scripts/<name>.ts` unless a package script is
listed. **Read the comment at the top of a script before running it** — each one says what it
changes and why it exists.

## Read this first

- `tsx` scripts load **`.env` only** (not `.env.local`). If your `.env` points at the
  production database, a script will run against production. Prefix the command with the
  database you mean: `DATABASE_URL="file:./dev.db" npx tsx scripts/...`.
- Every script that writes requires a `--yes-...` flag **followed by a fragment of the database
  URL** it expects to hit, and refuses if the fragment does not appear in the real URL. Typing it
  is the confirmation. Do not weaken this.
- Scripts that change production take a full dump first (`dumpDatabase()`); some are report-only
  unless given the apply flag.

## Reusable tools

| Script | Run with | What it does |
|---|---|---|
| `apply-migrations-turso.ts` | `npm run db:migrate:turso` (`-- --apply` to write) | Applies Prisma migrations to the hosted Turso database, which `prisma migrate deploy` cannot reach. Status-only by default. |
| `backup-database.ts` | `npm run db:backup` | Writes a full SQL dump to `backups/inventory-<date>.sql`. Used by the nightly GitHub Actions job. |
| `seed-demo.ts` | `npm run db:seed:demo` | Loads a showcase dataset into a **local** database for demos and manual testing. Wipes operational data first (keeps users). |
| `reset-data.ts` | `--yes-wipe <fragment>` | Erases all operational data and keeps user accounts. Destructive. |
| `import-stock.ts` | `--yes-import <fragment>` | Loads an opening stock catalogue from `stock-import.json` as packs, with no ledger rows. |
| `build-stock-import.py` | `python scripts/build-stock-import.py "<xlsx>"` | Builds `stock-import.json` from the client's pack-structure spreadsheet (needs `openpyxl`). |

## One-off scripts (a record of what was done to production — do not re-run)

These were written for specific corrections in September 2026 and are kept as worked examples of
how to change production data safely, and as a record of what changed. Their inputs and
assumptions (exact item names, a database in a particular state) no longer hold.

| Script | Purpose |
|---|---|
| `replace-stock-2026-09.ts` (+ `stock-import-2026-09.json`, `build-stock-import-2026-09.py`) | Replaced the whole catalogue and opening stock with the client's updated sheet. |
| `apply-stock-corrections-2026-09-21.ts` | Applied the client's renames, splits and new items after a recount. |
| `apply-stock-deliveries-2026-09-21.ts` | Added three delivery lists as additive stock. |
| `apply-backfill-dispatches-2026-09-21.ts` | Backfilled the first ledger entries: material that had gone straight out to sites. |
| `fix-continuous-issues-2026-09-21.ts` | Repaired rows the backfill wrote incorrectly for length-based items. |
| `cleanup-prod-2026-09-24.ts` | Removed mistaken "Z Remove" items and dev-team adjustment rows before handover. |
| `restore-z-remove-2026-09-24.ts` | Put the "Z Remove" items back from a backup, touching nothing else. |

## Writing a new production script

Copy the structure of `cleanup-prod-2026-09-24.ts`: default to a report, require the
confirmation fragment, dump first, do the change in one transaction, print what changed. Try it on
a copy of the data (`dev.db`) before pointing it anywhere real.
