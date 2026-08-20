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

Seed the admin user (idempotent):

```bash
npx tsx prisma/seed.ts
```

Default login is `admin@example.com` / `admin123` — **change this before any shared use.**

Apply schema changes:

```bash
npx prisma migrate dev --name <description>
```

> Prisma 7 requires an explicit driver adapter — plain `new PrismaClient()` throws. Use the
> singleton in [src/lib/prisma.ts](src/lib/prisma.ts).

## Documentation

- **[PROGRESS.md](PROGRESS.md)** — current state, data model, where things live, known gaps,
  and the design record. **Start here.** §10 is a handover guide for continuing the redesign.
- **[REDESIGN-PLAN.md](REDESIGN-PLAN.md)** — the six-phase redesign. Phase 1 is built;
  phases 2-6 are not. Records rejected alternatives and the reasoning behind each rule.
- [inventory_management.md.txt](inventory_management.md.txt) — the original problem statement.
- [storeroom-heavy-stock-plan.md](storeroom-heavy-stock-plan.md) — physical storage plan for
  heavy and humidity-sensitive stock. Procurement only; no bearing on the code.

## Status

Functional MVP, verified manually in the browser; production build passes. **Not deployed —
runs locally against a SQLite file, which has no backup.** No automated tests yet. See
PROGRESS.md §7.
