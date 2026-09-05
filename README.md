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
| `admin@example.com` | `admin123` | everything, including reverse and adjust |
| `finance@example.com` | `finance123` | receive deliveries, manage items — **cannot issue stock** |
| `employee@example.com` | `employee123` | dispatch, return, consume, transfer — **cannot receive stock** |

**Change all three before any shared use.** Roles are *workspaces*, not levels — see
[src/lib/permissions.ts](src/lib/permissions.ts).

> **This table describes the code as it stands.** A decided-but-unbuilt change (Phase 11,
> 2026-09-05) retires the employee account into finance and lets finance *request* the
> admin-only actions, with any admin approving. Once it lands, finance is admin minus accounts
> and backups, and the "roles are workspaces" line above stops being true. See PROGRESS.md §9.

Run the tests:

```bash
npm test
```

Apply schema changes:

```bash
npx prisma migrate dev --name <description>
```

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

**Phase 11, decided 2026-09-05 — Part 3 is built, Parts 1 and 2 are not.** The employee role
folds into finance, and finance gets an approval queue for the admin-only actions (any admin can
answer; the first to do so clears it for everyone). Three independent parts:

- ✅ **Part 3 — done 2026-09-05.** A stock count now records the *correction*, not the count, so
  a dispatch landing between opening the count form and submitting it is no longer erased. It
  also turned up a worse bug it was sitting on: `adjustStock` validated the `reason` field as a
  number, so **recording a stock count had never once worked** since Phase 3 built it. Both
  fixed; see PROGRESS.md §9 for the as-built note.
- ❌ **Part 1** (~1 hr) — the capability merge. Note its plan misses `shelf/[shelfId]/page.tsx`,
  which gates the shelf grid on a hardcoded `role === "ADMIN"` rather than `can()`.
- ❌ **Part 2** (3-5 days) — the approval workflow itself. **Blocked on tooling:** it needs an
  eleventh migration, and `prisma migrate deploy` cannot reach Turso — the script used for the
  first ten was discarded, so one has to be written and committed first.

PROGRESS.md §9 has the summary; REDESIGN-PLAN.md's "Decided 2026-09-05" section has the
reasoning and the four traps.

See PROGRESS.md §7 for the full list and §9 for the Phase 8 status and server checklist.
