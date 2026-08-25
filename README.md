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
  live on a synced drive, and why the "SQLite stays" hosting decision was reversed.
- [.env.example](.env.example) — every environment variable, and what breaks without it.
- [inventory_management.md.txt](inventory_management.md.txt) — the original problem statement.
- [storeroom-heavy-stock-plan.md](storeroom-heavy-stock-plan.md) — physical storage plan for
  heavy and humidity-sensitive stock. Procurement only; no bearing on the code.

## Status

All seven phases — the six-phase functional redesign and the Phase 7 UI overhaul — are built
and verified in the browser; `npx tsc --noEmit` and `npm run build` pass, and `npm test` runs
70 unit tests.

**Phase 8 — hosting — is in progress (2026-08-23).** Account management (`/users` for an
admin, `/account` for everyone), a `DATABASE_URL` that refuses to start in production rather
than silently using a phantom local database, and a repo that actually builds from a clean
checkout. **The SQLite→Postgres migration has not started** — it is blocked on provisioning a
database. See [REDESIGN-PLAN.md's Phase 8 section](REDESIGN-PLAN.md).

**Not production-ready yet.** Before real stock goes in:

- **The database layer has no test coverage.** The 70 tests cover the pure modules
  (allocation, corrections, matching, paste parsing, site balances, nav active-link matching,
  database-URL resolution). Everything that writes to the database — `packs.ts`,
  `recordDispatch`, `recordDelivery`, the site lifecycle — has none. This is the largest
  outstanding risk, and the coming Postgres switch touches exactly that code.
- **Not deployed**, and the database has **no scheduled backup** — cheapest thing to fix,
  most expensive to skip. Whatever the backup, restore it once to prove it works.
- The seeded passwords above are still in place. You can now change them in the app.

See PROGRESS.md §7 for the full list and §9 for the Phase 8 status and server checklist.
