# Inventory Management System

Tracks components and materials in the company store, what has been issued to installation
sites, and what needs reordering — and prints a signed **Material Delivery Challan** for each
dispatch. Built from the brief in
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
>
> ⚠️ **`.env.local` does not protect the Prisma CLI.** `prisma.config.ts` does
> `import "dotenv/config"`, and dotenv loads `.env` alone — it has no notion of Next's
> `.env.local` precedence. So `prisma migrate`, `prisma studio`, `prisma generate` and any
> plain `npx tsx scripts/*.ts` all resolve `DATABASE_URL` to the **live pilot**. Prefix them:
> `DATABASE_URL="file:./dev.db" npx prisma migrate deploy`. Treat an unprefixed Prisma command
> as pointed at production.

Seed one account per role plus item/site fixtures (idempotent):

```bash
npx tsx prisma/seed.ts
```

| Login | Password | Can |
|---|---|---|
| `admin@example.com` | `admin123` | everything: the above plus reverse, adjust, sites, shelves, accounts, backups |
| `finance@example.com` | `finance123` | the day-to-day job — receive deliveries, manage items, dispatch, return, consume, transfer, flag for collection. Can *ask* an admin to reverse, adjust, or change sites and shelves |
| `employee@example.com` | `employee123` | **retired 2026-09-05.** Still works, no longer assigned; finance now covers the same ground |

**Change all three before any shared use.** Roles *were* workspaces rather than levels; since
2026-09-05 finance is the combined operational role and admin is separated by *kind* — rewriting
history, changing structure, accounts and backups. The tables themselves are in
[src/lib/capabilities.ts](src/lib/capabilities.ts) (kept import-free so they can be unit-tested);
[src/lib/permissions.ts](src/lib/permissions.ts) re-exports them with the auth-aware half.

> **Note what this gave up.** One finance account can now receive goods *and* dispatch them with
> nobody else involved. That separation was a real control; retiring the employee account traded
> it away deliberately. Phase 11 Part 2 (built 2026-09-07) gives some of it back: finance
> *requests* the admin-only actions and any admin approves, with the work recorded against
> whoever asked.
>
> ⛔ **Accounts and backups are outside that queue permanently, and this is not an unfinished
> corner.** `user:manage` is excluded because an approval flow that can mint an admin is not an
> approval flow — "make me an admin" would be one approval away from granting the power to
> approve, and every other restriction becomes decorative. `backup:manage` is excluded because
> `restoreDatabase` drops and recreates every table, `ApprovalRequest` included: an approved
> restore would erase the row that authorised it *and* the record of who approved it, destroying
> its own audit trail as its last act. The first is the client's explicit instruction; the second
> is a fact about what restore does. Both are enforced by invariants in `capabilities.test.ts`
> and `args.test.ts`. See PROGRESS.md §9 and REDESIGN-PLAN.md.

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
  backup restore must stay outside that queue — the two conclusions in that section most likely
  to be re-derived wrongly later. **All three parts are built** as of 2026-09-07; the migration
  is applied locally only. Its "Decided 2026-09-08" section carries **the delivery challan** —
  why it extends Dispatch rather than standing alone, why the challan number needed a counter
  table, and the three rules (no reversed lines, no mixed-unit total, no typeable number) that
  a later reader will otherwise be tempted to soften.
- **[WORKFLOW.md](WORKFLOW.md)** — the operating manual for the three-person team: who does
  what, in what order, on which screen, and what must be true before the next person starts.
  Read it alongside the capability tables — it is explicit that the Finance A / Finance B
  split is **an agreement between people, not a rule the software enforces**, which is the
  kind of thing that otherwise gets assumed the wrong way round.
- [.env.example](.env.example) — every environment variable, and what breaks without it.
- [inventory_management.md.txt](inventory_management.md.txt) — the original problem statement.
- [storeroom-heavy-stock-plan.md](storeroom-heavy-stock-plan.md) — physical storage plan for
  heavy and humidity-sensitive stock. Procurement only; no bearing on the code.

## Status

All seven phases — the six-phase functional redesign and the Phase 7 UI overhaul — are built
and verified in the browser; `npx tsc --noEmit` passes, `npm run lint` is clean, and `npm test`
runs 168 unit tests.

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

- **The write-through actions still have no test coverage.** The 168 tests cover the pure
  modules (allocation, corrections, matching, paste parsing, site balances, adjustment deltas,
  capability tables, approval argument parsing/summaries/outcomes/labels, nav active-link
  matching, database-URL resolution, challan number formatting) and — **added 2026-09-08** —
  `packs.ts` itself, exercised against a real freshly-migrated SQLite database rather than a
  mock. That closes the harder half: `commitAllocation`'s synthetic `new:<i>` pack-id
  resolution was the subtlest code in the project and was singled out by name as untested.
  **Still untested:** `recordDispatch`, `recordDelivery` and the site lifecycle — all call
  `requireCapability`, which reads the NextAuth session, so reaching them needs auth mocking
  that does not exist yet. This remains the largest outstanding risk, and **Part A puts real
  stock through exactly that code with no parallel record to catch a mistake.** It is not
  theoretical: recording a stock count was broken from the day it was built until 2026-09-05,
  and every phase-level verification list said "passed".
- **Part A is deployed**, and the database now has a nightly automated backup with an
  admin-only restore page (see PROGRESS.md's Phase 9). Still open: the live restore drill —
  restoring against the real database at least once to prove the button works, not just the
  underlying dump/restore logic.
- ⚠️ **The seeded passwords above are still in place, and the pilot now holds the client's
  real catalogue.** `admin@example.com` / `admin123` currently signs in to production. This
  was a known gap while the database was empty; it is a live one now. Change all three in the
  app, and consider deactivating the two example accounts entirely — the three real
  `@solarcastle.in` logins do not need them.

**Phase 11, decided 2026-09-05 — all three parts built, the last on 2026-09-07.** The employee
role folds into finance, and finance gets an approval queue for the admin-only actions (any admin
can answer; the first to do so clears it for everyone). Three independent parts:

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
- ✅ **Part 2 — the approval workflow. Done 2026-09-07**, across ten staged commits.
  A finance user raises a request from a real control — every one of the twelve now says so,
  "Ask an admin to delete this site", "Request reversal" — every admin sees it at `/approvals`
  with a **live pre-check** of what would happen *now*, and approving **runs the operation**,
  recorded against whoever asked. The claim and the work share one transaction, so two admins
  answering at once cannot double-execute and a refusal leaves nothing half-done. Eleven write
  actions were rewired through a single gate and **admin behaviour is unchanged** — a
  twelve-flow regression walkthrough was run three times over the course of the work.

  **Two caveats before this goes near the pilot.** The `ApprovalRequest` migration is applied
  locally only when this was written; it **has since been applied to the pilot** (verified
  2026-09-08 — only Phase 12's `delivery_challan` is pending there now). And
  `vercel.json`'s `"regions": ["bom1"]` has stopped being a performance tweak: the approve path
  runs the claim and the work in one transaction with an explicit 20s timeout, which is
  comfortable at Mumbai latency and unreachable without it.

PROGRESS.md §9 has the summary; REDESIGN-PLAN.md's "Decided 2026-09-05" section has the
reasoning and the four traps.

**Phase 12 — the Material Delivery Challan — built 2026-09-08.** A printable A4 delivery note
for a dispatch, at `/dispatches/[id]/challan`: company block, party and shipping blocks, a
`Sr No. / Item / Description / Specification / Qty / Unit / Remarks` table, and Received By /
Delivered By signature blocks. Built as an **extension of Dispatch to Site**, not a separate
feature — `Dispatch` was already a header row with its lines hanging off it as `ISSUE`
transactions. Restyled the same day, once real data existed to check it against — navy banding
matching the client's own template, the client's logo and real company details, and a
row-density pass (a two-column split of what used to be a stacked cell, tighter padding
throughout) to fit roughly 30 lines on one A4 sheet instead of spilling onto a second, near-empty
one. See REDESIGN-PLAN.md's "Follow-up, same day" note under Phase 12.

- `Site` gained `customerName`, `address` and `projectCode`. `location` was deliberately not
  repurposed: it renders inside every site `<select>`, where a postal address is unreadable.
- `Dispatch` gained a unique auto-generated `challanNo` (`SCE/DC/0042`), plus `deliveredBy` and
  `receivedBy`. The existing free-text `reference` is now labelled **"Their reference"** — it is
  the other party's document number and was never suitable as ours.
- Numbers come from a `Sequence` counter incremented atomically inside the dispatch's own
  transaction, so a batch that fails on row 9 does not burn a number. `max()+1` was rejected as
  a read-then-write race; Prisma on SQLite can only autoincrement the `@id` column.
- First `@media print` block in the app. Anything marked `data-print="hide"` is dropped, and the
  light palette is forced regardless of `[data-theme]` — the dark toggle is a data attribute, so
  a dark challan would otherwise print as a black page.

**Three behaviours that look like bugs and are not.** Reversed lines never print, and a fully
reversed dispatch shows a refusal instead of a sheet — a signed challan listing material that
was pulled back is a false record. The Total row is suppressed when lines use different units,
because 150 m of wire plus 40 screws is not 190 of anything. And the challan number cannot be
typed or edited.

> ✅ **The opening stock is loaded, 2026-09-09.** 103 items on both databases from the
> client's pack-structure sheet — `python scripts/build-stock-import.py "<xlsx>"` to rebuild the
> JSON, then `npx tsx scripts/import-stock.ts --yes-import <fragment>`. Stock is created as
> `PackStock`/`OpenPack` rows with `recalcItemStock` deriving the total; **never** by writing
> `Item.currentStock`, which is a cache that the first dispatch would recompute to zero. There
> are deliberately **no ledger rows** behind the opening balance.
>
> ✅ **Both databases were migrated and wiped on 2026-09-08**, at the client's request —
> everything except `User` rows. All 6 accounts survived, including the three real
> `@solarcastle.in` logins. The pilot now holds 0 rows in every operational table, with the
> challan counter at 0 so the first real challan is `SCE/DC/0001`. Verified by re-reading the
> live database afterwards.
>
> Restore points, if any of it is wanted back:
> `backups/PRE-WIPE-inventory-2026-09-08.sql` (454 rows) and
> `backups/pre-migration-2026-09-08T11-17-38-088Z.sql`. Beyond stock figures, that included
> seven real Goa sites and the ten-item catalogue.
>
> ⚠️ **If you ever repeat this sequence: deploy before migrating.** The migration makes
> `Dispatch.challanNo` NOT NULL with no default, so any build predating the challan commit
> fails on every batch dispatch in the gap between migrating and deploying. It was clear here
> only because Vercel had already auto-deployed. And migrate before wiping — the reset rewinds
> the challan counter and needs the `Sequence` table to exist.
>
> ✅ **A `/ledger` page and pagination, built 2026-09-09.** Adjustment reasons and notes were
> being written to every stock count and rendered nowhere — visible only in the dashboard's
> ten-row Recent Activity or a single item's 50-row history, and not at all on a site page,
> since an `ADJUSTMENT` carries no `siteId`. `/ledger` shows every transaction, filterable by
> type, with reason and note as their own columns; item, site and dashboard pages link into it.
> `/dispatches` and `/deliveries`, previously unbounded queries, are now paginated 50/page
> alongside it via `src/lib/pagination.ts`. A companion idea — purging old transactions to save
> Turso quota — was investigated and dropped: the database is 344 KiB and would take roughly
> 1,000 years to fill the free tier, while site balances are derived by replaying the **entire**
> ledger, so purging anything would have silently emptied every site's holding past the cutoff.
> See PROGRESS.md §7 for the full writeup, including the `?page=99999` clamp bug it turned up.
>
> ✅ **Transfer challans, a site material statement, and a shared "remaining" figure — built
> 2026-09-09.** A site-to-site transfer used to write a bare `TRANSFER` row with no document
> behind it — the only ledger row type with no challan link. A new `Transfer` model (mirrors
> `Dispatch`, its own `SCE/TC/…` series) groups a whole batch under one challan, via
> `transferBatch` in `siteLifecycle.ts` — all-or-nothing inside one transaction, so a line
> exceeding stock refuses the whole batch rather than partially committing. New pages
> `/transfers`, `/transfers/[id]`, `/transfers/[id]/challan`. Separately, `/sites/[id]/challan`
> prints a Material Statement — everything a site currently holds, on one sheet, numbered by
> date (`SCE/MS/<yyyy-mm-dd>`) rather than a Sequence counter, since it is a reprintable live
> balance, not a distinct consignment. And a real UX bug in `SiteMaterialPanel`: consume and
> transfer inputs used to cap independently at the same raw quantity, so typing the full amount
> into one left the other still offering it. One derived `remaining` figure now governs both.
> **The transfer backfill migration was tested against a scratch database seeded with three
> out-of-order rows before being trusted** — this repo shipped the "every row numbers to 1" bug
> once already (commit `78a5454`, caught only because `dev.db` held a single row at the time).
> See PROGRESS.md §7 for the full writeup.
>
> ✅ **Four bugs from a review of the above, fixed 2026-09-10.** HIGH: `/ledger?from=<garbage>`
> 500'd — an unvalidated date param reached Prisma as an Invalid Date. Fixed with new
> `src/lib/dateFilter.ts` (6 tests). Two MEDIUM: the Material Statement still read as a delivery
> challan (hardcoded "Delivery Challan For" heading + empty signature blocks a customer could
> sign) — `ChallanSheet` gained `partyHeading`/`showSignatures` props; and `SI-TAGGED-ITEMS.md`
> named four SKUs that don't exist in the live catalogue — three corrected against production,
> the fourth flagged unconfirmed rather than guessed. LOW: the statement's reference (UTC) and
> printed date (server-local) could disagree by a day — both now built from the same local
> calendar day. Two latent risks closed: the transfer backfill migration aborted entirely on any
> legacy row with a NULL `fromSiteId` — reproduced against a scratch database and fixed with a
> NOT NULL guard on both the insert and the linking update; and `/transfers` was missing the
> direct `requireCapability` check every other new route has. `SiteBlockerCounts` also gained a
> `transfers` field so a site-delete refusal names "N transfer challans" specifically — verified
> live. Not built: a batch `reverseTransfer` (deferred — new functionality touching the approvals
> runtime) and applying the two pending production migrations (left for a separate decision).
> See PROGRESS.md §7 for the full writeup, including the two claims from the review that turned
> out not to hold (SQLite's `LIKE` is already case-insensitive here) and a flagged follow-up
> (`/dispatches`/`/deliveries` have the same pre-existing missing-capability-check gap).
>
> **`src/lib/company.ts` now carries the client's real name, address, phone, email and website**
> (filled in 2026-09-08, after being a stub with blank strings). Values still route through
> `companyContactLines()`, which drops any field left blank rather than printing an empty label —
> `gstin` is still empty for exactly that reason. The logo is a static file at
> [public/logo.png](public/logo.png), rendered with a plain `<img>` rather than `next/image` (one
> caller, fixed file, no reason to add an optimization pass to the one path that has to survive
> `window.print()`). Letterhead was offered and declined — "print regular A4" — so the sheet
> stays self-contained.

See PROGRESS.md §7 for the full list and §9 for the Phase 8 status and server checklist.
