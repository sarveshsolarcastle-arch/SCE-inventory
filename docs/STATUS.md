# Project status and history

Moved out of the README so the README can stay a short orientation. This is the running
record of what was built, when, and what was still open at the time. For the current
state of the code, trust the code and [PROGRESS.md](../PROGRESS.md); this file is history.

## Status

All seven phases — the six-phase functional redesign and the Phase 7 UI overhaul — are built
and verified in the browser; `npx tsc --noEmit` passes, `npm run lint` is clean, and `npm test`
runs 210 unit tests.

**Phase 8 — hosting — is in progress; re-planned 2026-08-25 into two parts.** Already built:
account management (`/users` for an admin, `/account` for everyone), a `DATABASE_URL` that
refuses to start in production rather than silently using a phantom local database, and a
repo that actually builds from a clean checkout.

- **Part A — a temporary hosted pilot** on Turso + Vercel, carrying **real stock data**.
  SQLite-compatible, so `provider = "sqlite"` and every migration stay as they are; only the
  Prisma adapter changes. **[vercel.json](../vercel.json) pins the function region to `bom1`
  (Mumbai) — do not remove it.** It is a two-line file and looks like boilerplate, but it is
  the entire fix for the "2-second lag after every write" reported on 2026-09-04: the
  function was defaulting to `iad1` (Washington DC) while the database sits in Mumbai, so
  every SQL statement paid a ~230 ms round trip and Prisma issues them sequentially. Full
  writeup in [REDESIGN-PLAN.md's "Reopened 2026-09-04" section](../REDESIGN-PLAN.md).
- **Part B — permanent offline production**, on a drive carried between 2-3 office PCs so a
  missing employee does not take the system with them. The client chose secure offline
  storage over convenient access.

**No data crosses between them.** At cutover, stock is physically recounted into an Excel
sheet and re-entered as an opening delivery. See
[REDESIGN-PLAN.md's Phase 8 section](../REDESIGN-PLAN.md) for the full plan, the rejected
alternatives, and the two decisions still open.

**Not production-ready yet.** Before real stock goes in:

- **⚠️ A stale session cookie locks a user out of the whole app, with no way back in**
  (found 2026-09-21, **not yet fixed**). `proxy.ts` decides "logged in" from the JWT
  signature alone — it never reads the database, and cannot, since Prisma will not run in
  the proxy. So a correctly-signed cookie naming a user row that no longer exists is waved
  through; the page then re-reads the row, finds nothing, and throws. There is no
  `error.tsx` anywhere in `src/app`, so with streaming SSR that throw leaves the browser on
  a blank page that buffers forever with no error and nothing in the server logs — and
  `/login` redirects anyone "logged in" to `/dashboard`, so the user cannot sign in again to
  clear it. Clearing site cookies is the only exit. The fix is an error-boundary pair plus a
  route handler that clears the cookie and lands on `/login`; see PROGRESS.md §7.
- **The write-through actions still have no test coverage.** The 210 tests cover the pure
  modules (allocation, corrections, matching, both paste parsers, site balances, adjustment deltas,
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
`Sr No. / Item / Description / Qty / Unit / Remarks` table, and Received By /
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
> live. Not built there: a batch `reverseTransfer`, and applying the two pending production
> migrations (left for a separate decision). See PROGRESS.md §7 for the full writeup, including
> the two claims from the review that turned out not to hold (SQLite's `LIKE` is already
> case-insensitive here) and a flagged follow-up (`/dispatches`/`/deliveries` have the same
> pre-existing missing-capability-check gap).
>
> ✅ **A batch `stock.reverseTransfer`, built 2026-09-10.** The gap above turned out to be
> worse than "un-batched": a `TRANSFER` never touches packs, so the existing pack-based
> reversal always refused it — reversing a transfer was not possible at all, one line or many.
> New `stock.reverseTransfer` operation (mirrors `reverseDispatch`'s all-or-nothing loop, but
> checks the destination site's current balance rather than replaying a pack plan, since none
> exists) reverses every line of a transfer under one reason and one approval. `ReverseButton`
> now appears on `/transfers/[id]`. See PROGRESS.md §7 for the full writeup.
>
> **`src/lib/company.ts` now carries the client's real name, address, phone, email and website**
> (filled in 2026-09-08, after being a stub with blank strings). Values still route through
> `companyContactLines()`, which drops any field left blank rather than printing an empty label —
> `gstin` is still empty for exactly that reason. The logo is a static file at
> [public/logo.png](../public/logo.png), rendered with a plain `<img>` rather than `next/image` (one
> caller, fixed file, no reason to add an optimization pass to the one path that has to survive
> `window.print()`). Letterhead was offered and declined — "print regular A4" — so the sheet
> stays self-contained.

> ✅ **Challan changes and two site shortcuts — 2026-09-24.** The challan table lost its
> Specification column (every challan shares `ChallanSheet`), the Material Statement now prints
> blank Received By / Delivered By blocks, the transfer challan reads "Transfer From: Solar
> Castle Energy" (the origin site is deliberately not printed), and the logo is larger.
> `/sites/[id]/challans` lists every challan for one site — store dispatches, direct-to-site,
> transfers in and out — with type and date filters and a link to each print page; it is
> reached from the site page and is not in the sidebar. **Site Delivery
> (`/site-deliveries/new`) is now a paper-only challan:** free-text lines (`DeliveryLine`),
> no Item, no Transaction, no effect on stock or on what a site holds; it warns, and never
> blocks, when a typed line matches a registered item. Older stock-backed direct-to-site
> deliveries stay as history, and the stock-moving `recordDelivery` `siteId` branch is kept
> but no page reaches it. The site page's **Stock_In & Stock_Out** button
> (`/sites/[id]/quick-add`) is the ordinary Stock_Out form, which first records a Stock_In for
> exactly the quantities entered and then the ordinary dispatch (`recordStockInThenDispatch`).
> The master ledger gained **Site Ledger** and **Delivery Ledger** filters. **The `DeliveryLine`
> migration (`20260924120356_paper_site_challan`) is applied to `dev.db` only — apply it to
> Turso with `npm run db:migrate:turso -- --apply` before deploying.**

See PROGRESS.md §7 for the full list and §9 for the Phase 8 status and server checklist.
