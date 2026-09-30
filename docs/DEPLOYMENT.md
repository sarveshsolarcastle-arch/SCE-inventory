# Deployment and operations

How the app runs in production, how to change it safely, and how the backups work.

## What runs where

| Piece | Where | Notes |
|---|---|---|
| The app | **Vercel** (auto-deploys from `master`) | Function region pinned to **`bom1` (Mumbai)** in `vercel.json`. |
| The database | **Turso** (hosted SQLite/libSQL), Mumbai region | Same region as the app on purpose. |
| Nightly backup | **GitHub Actions** (`.github/workflows/backup.yml`) | Dumps the database at about 00:30 IST and commits it to the repo's `backups` branch. Keeps the newest 30. |
| Backup UI | `/backups` page in the app (admin only) | List, download, restore. |

The live address at the time of writing is `sce-inventory.vercel.app`. The company owns the
Vercel project, the Turso database and the GitHub repository — confirm you have access to all
three (see [HANDOVER-CHECKLIST.md](HANDOVER-CHECKLIST.md)).

> **Keep the GitHub repository private.** It holds the source, and the `backups` branch holds
> full copies of the production database, including user password hashes and the company's
> stock and site data.

## Environment variables

Documented line by line in [`.env.example`](../.env.example). Summary:

| Variable | Where it is set | Purpose |
|---|---|---|
| `DATABASE_URL` | Vercel **and** GitHub Actions secret | `libsql://<your-db>.turso.io` in production. The app **refuses to start** in production without it. |
| `TURSO_AUTH_TOKEN` | Vercel **and** GitHub Actions secret | Credential for the Turso database. |
| `AUTH_SECRET` | Vercel | Signs login sessions. Generate a fresh random value per environment (`openssl rand -base64 32`). Changing it signs everyone out. |
| `AUTH_TRUST_HOST` | Vercel | `true` behind a proxy/host platform, otherwise login loops. |
| `GITHUB_BACKUP_TOKEN` | Vercel | Fine-grained, **read-only** GitHub token for this repo only (Contents: read). Only the `/backups` page needs it. |

GitHub Actions secrets live under *Settings → Secrets and variables → Actions*.

## Deploying a code change

1. Work locally against `dev.db` (see the developer guide). Run type check, lint and tests.
2. Push to `master`. Vercel builds and deploys automatically.
3. If the change includes a database migration, follow the next section — **order matters**.

Vercel is configured with an *Ignored Build Step* so pushes to the `backups` branch (which
contains only `.sql` files) do not trigger builds. Keep that setting.

## Migrating the production database

`prisma migrate deploy` **does not work against Turso** (`P1013`: the migration engine does not
understand `libsql://`). Use the bundled script instead:

```bash
npm run db:migrate:turso                 # status only: lists applied / pending. Writes nothing.
npm run db:migrate:turso -- --apply      # applies pending migrations
```

It reads `.env` (the production values), takes a full dump first, applies each pending
migration's SQL, and records it in Prisma's `_prisma_migrations` table so Prisma's own view stays
truthful. It stops if an already-applied migration file has been edited.

**Order of operations:**

- Migration is *additive* (new table, nullable column): migrate first, then deploy.
- Migration makes something **NOT NULL with no default**, or removes something old code uses:
  the old code and the new schema cannot coexist. Deploy the new code first so it is live at the
  moment you migrate, and do both in one short window.
- Always run it against a copy first: point `DATABASE_URL` at a scratch file and try.

## Backups

**Nightly:** the workflow runs `npm run db:backup` (a full SQL dump through
`src/lib/backup/dump.ts`) and commits `inventory-YYYY-MM-DD.sql` to the `backups` branch.

**Run one now:** GitHub → *Actions* → "Nightly database backup" → *Run workflow*.

**Restore (admin only):** open `/backups` in the app.
- *Restore* on a listed backup — you must type its date to confirm. The app takes a safety dump
  first, refuses to continue if that fails, and rolls back to it if the restore errors partway.
  A successful restore signs everyone out.
- *Download* gives a copy for off-site storage.
- *Restore from file* is the fallback if GitHub is unreachable.

**Restore is destructive** — it replaces every table. Do it deliberately, ideally right after a
fresh backup so the loss window is small.

> Not yet done at handover: a restore drill against the real production database. Do one (run
> the workflow, then restore that same night's backup) before relying on the button.

**If the repository is renamed or moved to another owner**, edit `OWNER` and `REPO` at the top of
`src/lib/backup/github.ts`; the Backups page reads from those names.

## Running it somewhere else

The app is a standard Next.js server: `npm ci && npm run build && npm start` (port 3000, or set
`PORT`). Any host that can run Node 20.9+ works, with the environment variables above. The
database can be a Turso database or a plain SQLite file (`DATABASE_URL="file:/path/to/inventory.db"`),
but a SQLite file must live on a **local disk** — never on a synced folder (Google Drive,
OneDrive, Dropbox), which corrupts SQLite. If you move away from `bom1`/Turso, revisit the
20-second transaction timeout in `src/lib/approvals/runOrRequest.ts` and the region note above.

The project's history records that a permanent offline installation on a drive carried between
office PCs was under consideration as the long-term setup; see REDESIGN-PLAN.md's Phase 8 section
for what was decided and why before acting on it.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| App will not start in production: "DATABASE_URL is not set" | The variable is missing on the host. Intentional refusal — set it. |
| Every write takes ~2 seconds | The function is running in a region far from the database. Check `vercel.json`. |
| Login page reloads forever | `AUTH_TRUST_HOST` not set, or `AUTH_SECRET` missing. |
| A user sees a blank page and cannot log in again | Stale session cookie for a deleted user. Clear the site's cookies (see PROGRESS.md §7). |
| `/backups` shows an error | `GITHUB_BACKUP_TOKEN` missing/expired, or `OWNER`/`REPO` in `github.ts` no longer match. |
| Nightly backup workflow fails | `DATABASE_URL` / `TURSO_AUTH_TOKEN` Actions secrets missing or rotated. |
| "Unknown argument" errors after a schema change | Stale generated client; run `npx prisma generate` and restart the dev server. |
