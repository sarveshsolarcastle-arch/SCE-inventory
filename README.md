# SCE Inventory Management System

A web app for **Solar Castle Energy's** store room. It answers three questions the company
could not answer before:

1. **What do we have?** — a single record of every item, in packs (sealed) and cut lengths
   (opened), with a 2D map of the physical shelves.
2. **Where did it go?** — every dispatch to an installation site, every return, every
   consumption and transfer, each attributed to the person who did it.
3. **What must we reorder?** — low-stock alerts, defective-goods register, supplier claims.

It also prints the paperwork: **delivery challans** (store → site, site → site transfer,
paper-only site deliveries) and a per-site **material statement**, on A4, with sequential
challan numbers (`SCE/DC/0042`).

The original problem statement is in [inventory_management.md.txt](inventory_management.md.txt).

## Stack

| Layer | Choice |
|---|---|
| App | **Next.js 16** (App Router, React 19, TypeScript). One app: pages and server actions, no separate backend. |
| Database | **SQLite** through **Prisma 7**. Local file (`dev.db`) in development; **Turso** (hosted libSQL) in production. |
| Auth | **NextAuth v5** (credentials, JWT session), passwords hashed with bcrypt. |
| UI | **Tailwind CSS 4**, small shared primitives in `src/components/ui/`. |
| Tests | Node's built-in test runner (`node --test`). No Jest/Vitest. |
| Hosting | **Vercel** (region pinned to Mumbai, `bom1`) + Turso. Nightly database backup via GitHub Actions. |

## Quick start (local)

Requires **Node 20.9 or newer**.

```bash
npm install                 # also runs `prisma generate`
cp .env.example .env        # DATABASE_URL is already file:./dev.db; set AUTH_SECRET (see the file)
npx prisma migrate deploy   # create the tables in dev.db
npm run db:seed             # one account per role + sample items and sites
npm run dev                 # http://localhost:3000
```

> ⚠️ **Keep production credentials off your development machine.** Production values belong
> in the hosting provider's environment settings, not in a `.env` on a laptop. If you ever
> do need a `.env` that points at the hosted Turso database (for example to run a migration),
> put `DATABASE_URL="file:./dev.db"` in a `.env.local` so `next dev` stays local — and
> remember the Prisma CLI and `tsx scripts/*.ts` read **`.env` only** and ignore
> `.env.local`, so prefix those with `DATABASE_URL="file:./dev.db"`.
> Full explanation in [docs/DEVELOPER-GUIDE.md](docs/DEVELOPER-GUIDE.md#the-two-database-trap).

Seeded logins (**development only — never leave these on a real deployment**):

| Email | Password | Role |
|---|---|---|
| `admin@example.com` | `admin123` | Admin — everything |
| `finance@example.com` | `finance123` | Finance — day-to-day work including site edits, shelves and reversals; asks an admin only to delete a site or adjust stock |
| `employee@example.com` | `employee123` | Retired role, kept so old logins still work |

Useful commands:

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm test` | Unit tests (~250, a few minutes at most) |
| `npm run typecheck` | Type check — run before every commit (generates Next's route types first; a bare `tsc` fails on a fresh clone) |
| `npm run lint` | ESLint |
| `npm run build` | Production build |
| `npm run db:migrate:dev -- --name <what>` | Create and apply a new migration locally |
| `npm run db:studio` | Browse the database in Prisma Studio |
| `npm run db:seed:demo` | Fill `dev.db` with realistic demo data |
| `npm run db:migrate:turso` | Check migration status of the hosted database (`-- --apply` to apply) |
| `npm run db:backup` | Write a SQL dump into `backups/` |

## Where to read next

Read in this order — each document assumes the one before.

1. **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** — how the code is laid out, how a request
   travels through it, and the handful of ideas the whole design rests on.
2. **[docs/DEVELOPER-GUIDE.md](docs/DEVELOPER-GUIDE.md)** — working on it day to day: recipes
   for the common changes (new page, new permission, new database column…), testing, and the
   mistakes this codebase has already made once.
3. **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** — environment variables, Vercel, Turso,
   migrations in production, the nightly backup and how to restore.
4. **[docs/HANDOVER-CHECKLIST.md](docs/HANDOVER-CHECKLIST.md)** — what to do in the first
   week: rotate secrets, change passwords, confirm the backup job runs.
5. **[WORKFLOW.md](WORKFLOW.md)** — how the team is meant to *use* the system, screen by screen.
6. **[PROGRESS.md](PROGRESS.md)** — the detailed engineering record: data model, where every
   file lives, known gaps. **§10 is the handover guide.**
7. **[REDESIGN-PLAN.md](REDESIGN-PLAN.md)** — the design decisions **and the alternatives that
   were rejected, with reasons**. Read the reasoning before reversing a rule; re-deriving a
   rule from first principles tends to land on the answer that was already rejected.

Reference material:

- [docs/STATUS.md](docs/STATUS.md) — dated history of what was built and what was open.
- [NOMENCLATURE.md](NOMENCLATURE.md) — the naming standard to follow when adding an item to the catalogue.
- [REMOVED.md](REMOVED.md) — features that were built and later removed, and why.
- [SI-TAGGED-ITEMS.md](SI-TAGGED-ITEMS.md) — the items tagged `#SI` (matched to the solar-installation bill of materials).
- [storeroom-heavy-stock-plan.md](storeroom-heavy-stock-plan.md) — physical storage plan for
  heavy stock; procurement only, no bearing on the code.
- [.env.example](.env.example) — every environment variable and what breaks without it.

## Repository layout

```
prisma/           schema.prisma, migrations/ (one folder per change), seed.ts
src/app/          pages and route handlers (one folder per URL)
src/components/   shared React components; ui/ holds the small design primitives
src/lib/          business logic — allocation, corrections, challans, permissions…
src/lib/actions/  server actions: the write endpoints called from forms
src/lib/approvals/  the "finance asks, admin approves" machinery
src/proxy.ts      route protection (Next 16's name for middleware)
scripts/          maintenance and one-off data scripts — read the header before running any
docs/             the handover documents listed above
.github/workflows/ nightly database backup
```

## Operating notes

- **Production data is real.** The hosted database holds the company's actual stock. Scripts
  under `scripts/` that touch it require a typed confirmation argument on purpose.
- **Roles.** `ADMIN` and `FINANCE` are the two active roles. Since 2026-09-30 Finance does
  most things outright: receiving and dispatching stock, creating and editing sites, shelf
  work, and reversals. Only **deleting a site** and **stock-count adjustments** still go
  through the approval queue: Finance *requests*, an admin approves at `/approvals`, and the
  work then runs. Accounts and backups are admin-only and deliberately outside the queue.
  The authoritative tables are in `src/lib/capabilities.ts`; the machinery for the queue is
  kept (and older requests can still be decided) so a capability can be moved back behind
  approval by editing that one file.
- **`vercel.json` pins the region to `bom1`.** It looks like boilerplate. It is not: the
  database is in Mumbai and every SQL statement pays the round trip.
