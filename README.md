# Inventory Management System

Tracks components and materials in the company store, what has been issued to installation
sites, and what needs reordering. Built from the brief in
[inventory_management.md.txt](inventory_management.md.txt).

Single Next.js 16 app (App Router, server actions — no separate backend), Prisma 7 over
SQLite, NextAuth credentials login, Tailwind 4.

## Run it

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

> ⚠️ **Check which database you are about to write to.** `.env` points `DATABASE_URL` at the
> live Turso pilot, which holds the client's real stock — and Next loads `.env` for `next dev`
> as well, so without an override `npm run dev` writes straight into production. A gitignored
> `.env.local` pinning `DATABASE_URL="file:./dev.db"` takes precedence and is what you want
> locally. Nothing in the app tells you which one you are on, so check before recording
> anything.

Seed one account per role plus item/site fixtures (idempotent):

```bash
npx tsx prisma/seed.ts
```

| Login | Password | Can |
|---|---|---|
| `admin@example.com` | `admin123` | everything: the above plus reverse, adjust, sites, shelves, accounts, backups |
| `finance@example.com` | `finance123` | the day-to-day job — receive deliveries, manage items, dispatch, return, consume, transfer, flag for collection |
| `employee@example.com` | `employee123` | **retired 2026-09-05.** Still works, no longer assigned; finance now covers the same ground |

**Change all three before any shared use.** Roles *were* workspaces rather than levels; since
2026-09-05 finance is the combined operational role and admin is separated by *kind* — rewriting
history, changing structure, accounts and backups. See
[src/lib/permissions.ts](src/lib/permissions.ts).

> **Note what this gave up.** One finance account can now receive goods *and* dispatch them with
> nobody else involved. That separation was a real control; retiring the employee account traded
> it away deliberately. Phase 11 Part 2 (not built) will let finance *request* the admin-only
> actions, with any admin approving — accounts and backups stay outside that queue permanently.
> See PROGRESS.md §9.

Run the tests:

```bash
npm test
```

Apply schema changes locally:

```bash
npx prisma migrate dev --name <description>
```

Then apply the same migration to the hosted pilot — **`prisma migrate deploy` cannot do this**,
because Prisma's migration engine does not understand `libsql://` (`P1013`):

```bash
npm run db:migrate:turso
```

That is a read-only status check. Add `-- --apply` to actually apply, which takes a dump first.
It reads `.env` (the deployment database), not `.env.local`.

> Prisma 7 requires an explicit driver adapter — plain `new PrismaClient()` throws. Use the
> singleton in [src/lib/prisma.ts](src/lib/prisma.ts).
>
> **Restart the dev server after any `prisma generate`.** It caches the client, and schema
> changes otherwise surface as baffling "Unknown argument" errors that look like code bugs.

## Documentation

- **[PROGRESS.md](PROGRESS.md)** — current state, data model, where things live, known gaps,
  and the design record. **Start here.** §10 is the handover guide.
- **[REDESIGN-PLAN.md](REDESIGN-PLAN.md)** — the redesign. **Phases 1-7 are built**
  (functional redesign, then the UI overhaul); **8 (hosting) is in progress**. Each built
  phase carries an "as built" note. **It records rejected alternatives and why** —
  re-deriving those rules from first principles lands on the rejected answer, so read the
  reasoning before changing one. Phase 8 in particular records why the SQLite file must not
  live on a synced drive, and how the hosting decision was reversed and then partly restored
  as the requirement changed twice — read both steps, or the history reads as incoherent.
  Its cross-phase notes also carry the 2026-08-27 decision on **discontinuing an item** —
  flagged, never deleted, because every transaction carries an `itemId`. Decided in full,
  not yet built. And the 2026-09-05 decision on **roles and approvals** (Phase 11) — finance
  absorbs the employee role, and gains an admin-approval queue for the rest. It reverses the
  earlier "approval workflows are out of scope" call, and records why account management and
  backup restore must stay outside that queue. **Part 3 of it is built** (stock counts store a
  correction, not a snapshot); Parts 1 and 2 are not.
- [.env.example](.env.example) — every environment variable, and what breaks without it.
- [inventory_management.md.txt](inventory_management.md.txt) — the original problem statement.
- [storeroom-heavy-stock-plan.md](storeroom-heavy-stock-plan.md) — physical storage plan for
  heavy and humidity-sensitive stock. Procurement only; no bearing on the code.

## Status

All seven phases — the six-phase functional redesign and the Phase 7 UI overhaul — are built
and verified in the browser; `npx tsc --noEmit` and `npm run build` pass, and `npm test` runs
86 unit tests.

**Phase 8 — hosting — is in progress; re-planned 2026-08-25 into two parts.** Already built:
account management (`/users` for an admin, `/account` for everyone), a `DATABASE_URL` that
refuses to start in production rather than silently using a phantom local database, and a
repo that actually builds from a clean checkout.

- **Part A — a temporary hosted pilot** on Turso + Vercel, carrying **real stock data**.
  SQLite-compatible, so `provider = "sqlite"` and every migration stay as they are; only the
  Prisma adapter changes. **[vercel.json](vercel.json) pins the function region to `bom1`
  (Mumbai) — do not remove it.** It is a two-line file and looks like boilerplate, but it is
  the entire fix for the "2-second lag after every write" reported on 2026-09-04: the
  function was defaulting to `iad1` (Washington DC) while the database sits in Mumbai, so
  every SQL statement paid a ~230 ms round trip and Prisma issues them sequentially. Full
  writeup in [REDESIGN-PLAN.md's "Reopened 2026-09-04" section](REDESIGN-PLAN.md).
- **Part B — permanent offline production**, on a drive carried between 2-3 office PCs so a
  missing employee does not take the system with them. The client chose secure offline
  storage over convenient access.

**No data crosses between them.** At cutover, stock is physically recounted into an Excel
sheet and re-entered as an opening delivery. See
[REDESIGN-PLAN.md's Phase 8 section](REDESIGN-PLAN.md) for the full plan, the rejected
alternatives, and the two decisions still open.

**Not production-ready yet.** Before real stock goes in:

- **The database layer has no test coverage.** The 86 tests cover the pure modules
  (allocation, corrections, matching, paste parsing, site balances, adjustment deltas, nav
  active-link matching, database-URL resolution). Everything that writes to the database —
  `packs.ts`, `recordDispatch`, `recordDelivery`, the site lifecycle — has none. This is the
  largest outstanding risk, and **Part A puts real stock through exactly that code with no
  parallel record to catch a mistake.** It is not a theoretical risk: recording a stock count
  was broken from the day it was built until 2026-09-05, and every phase-level verification
  list said "passed".
- **Part A is deployed**, and the database now has a nightly automated backup with an
  admin-only restore page (see PROGRESS.md's Phase 9). Still open: the live restore drill —
  restoring against the real database at least once to prove the button works, not just the
  underlying dump/restore logic.
- The seeded passwords above are still in place. You can now change them in the app.

**Phase 11, decided 2026-09-05 — Parts 1 and 3 are built, Part 2 is not.** The employee role
folds into finance, and finance gets an approval queue for the admin-only actions (any admin can
answer; the first to do so clears it for everyone). Three independent parts:

- ✅ **Part 1 — done 2026-09-05.** Finance absorbed the five employee capabilities. No migration;
  the employee role is retired rather than removed, so existing logins keep working. Verified as
  finance in the browser: issued stock to a site (attributed to the finance account), gained the
  Stock Out nav group and the consume/transfer/flag controls, and was still refused `site:manage`
  **by the server**, not merely by a hidden button.
- ✅ **Part 3 — done 2026-09-05.** A stock count now records the *correction*, not the count, so
  a dispatch landing between opening the count form and submitting it is no longer erased. It
  also turned up a worse bug it was sitting on: `adjustStock` validated the `reason` field as a
  number, so **recording a stock count had never once worked** since Phase 3 built it. Both
  fixed; see PROGRESS.md §9 for the as-built note.
- ❌ **Part 2** (3-5 days) — the approval workflow itself. Both structural prerequisites are now
  **cleared**: `npm run db:migrate:turso` applies migrations Prisma cannot (and the pilot has
  been baselined), and the shelf grid reads `shelf:manage` rather than a hardcoded role. What
  remains is the feature itself, plus an explicit `timeout` on the approve path's transaction.

PROGRESS.md §9 has the summary; REDESIGN-PLAN.md's "Decided 2026-09-05" section has the
reasoning and the four traps.

See PROGRESS.md §7 for the full list and §9 for the Phase 8 status and server checklist.
