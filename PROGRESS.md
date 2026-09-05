# Inventory Management System — Progress Handover

Last updated: 2026-09-05 (**Phase 8 Part A — the hosted pilot — is live**; **Phase 11 — role
consolidation and admin approvals — is decided; Parts 1 and 3 are BUILT, Part 2 is not**
— see §9)

> **§1-§8 describe the code as it stands today.** The six-phase functional redesign and
> Phase 7 (UI overhaul) are **complete**. **Phase 8 Part A (the hosted pilot) is deployed**:
> account management and the `DATABASE_URL` fail-fast landed 2026-08-23; the libSQL adapter
> swap, Turso database, and Vercel deployment landed 2026-08-25. The app is live at
> **sce-inventory.vercel.app**, on Turso, seeded — with the default passwords still in
> place (open task, see below). Part B (offline production) has not started. §9 records what
> each phase delivered, and §10 is the handover guide.
>
> **The hosting requirement has changed twice, and decisions were reversed each time.** It is
> now a temporary **hosted pilot** (Part A) followed by permanent **offline** production on a
> drive carried between office PCs (Part B). SQLite stays throughout. Read §9's Phase 8 entry
> and REDESIGN-PLAN.md's Phase 8 section together before touching any of it — several
> decisions in this repo are marked superseded, and one was reversed and then partly restored.

## 1. Purpose

Built to solve three problems stated in [inventory_management.md.txt](inventory_management.md.txt):
1. No centralized stock records.
2. Manual stock verification/restocking.
3. No record of materials taken to installation sites.

Plus two follow-up requirements added mid-build:
4. Track how frequently a material is issued and suggest moving frequently-used items to more accessible shelf positions.
5. A 2D visual map of a physical 2-way shelf (front/back sides), showing which box each item sits in, matched to physical stickers/tags, and updatable from the app.

## 2. Status: functional MVP, verified end-to-end in browser

All core flows below were manually tested in a running dev server and confirmed working. `npx next build` passes with no type errors.

| Module | Status |
|---|---|
| Auth (login/logout, route protection) | ✅ Done |
| Items (CRUD, search, low-stock flag) | ✅ Done |
| Sites (CRUD, materials currently on-site) | ✅ Done |
| Transactions (Stock In / Issue / Return, atomic stock updates) | ✅ Done |
| Packs & cut lengths (sealed/opened, best-fit allocation, scrap threshold) | ✅ Done (Phase 1) |
| Defective goods register (+ supplier claim lifecycle) | ✅ Done (returns and deliveries) |
| Dashboard (totals, low-stock alerts, recent activity, suggestion panel) | ✅ Done |
| Shelf 2D map (front/back sides, box-type relabeling; contents derived from packs) | ✅ Done |
| Condition-based shelving (Fresh/Opened/Recyclable box types) | ✅ Done |
| Placement suggestions (usage-frequency based) | ✅ Done |
| Mobile-responsive layout | ✅ Done |
| Production build | ✅ Passes |
| Automated tests | ⚠️ 86 unit tests (`npm test`): allocator, corrections, matching, paste parsing, site balances/FIFO age/pickup clamp, adjustment deltas, nav active-link matching, database-URL resolution; **no coverage of the DB layer or UI** |
| Roles: ADMIN / FINANCE, capability-gated | ✅ Done (Phase 2); **consolidated 2026-09-05** (Phase 11 Part 1) — FINANCE absorbed the retired EMPLOYEE role and is now the combined operational role. EMPLOYEE still exists and still works, but is no longer assigned. The admin approval queue (Part 2) is **not built** |
| Corrections: reversal and stocktake adjustment | ✅ Done (Phase 3) |
| Bulk dispatch to site, from Excel paste | ✅ Done (Phase 4) |
| Delivery entry (to store or direct to site) | ✅ Done (Phase 5) |
| Site lifecycle: consumption, transfers, pickup flags, cross-site view | ✅ Done (Phase 6) |
| UI overhaul + mobile web | ✅ Done (Phase 7) — light theme + user dark toggle, grouped sidebar, `src/components/ui/` primitives |
| User accounts | ✅ Done (Phase 8) — admin `/users` page, self-service `/account`, deactivation |
| Deployment | ✅ **Part A live** (Phase 8) — deployed at sce-inventory.vercel.app, on Turso. Still open: seeded passwords unchanged. Part B (offline production) not started |
| Shelf deletion | ✅ **Done** (2026-09-04) — admin-only `deleteShelf`, its own `shelf:delete` capability rather than `shelf:manage`. Warns with counts on an occupied shelf instead of blocking, because a shelf holds placement and no history; open packs in it are unplaced, never deleted, and no stock moves. See REDESIGN-PLAN.md's "Decided 2026-09-04" section |
| Database backups | ✅ **Automated, live** (Phase 9) — nightly GitHub Actions job dumps the database to the repo's `backups` branch (30-day retention), and an admin-only `/backups` page restores from any of them, or from an uploaded file, with no terminal required. Secrets set, deployed to Production. Still open: the live restore drill (see Phase 9 notes). Part B still needs a second drive |
| Slow writes on the live deployment | ✅ **Root-caused and fixed** (Phase 10, 2026-09-04) — **not** a Turso or read-after-write problem. The Vercel function ran in `iad1` (Washington DC) while the database sits in `aws-ap-south-1` (Mumbai), so every SQL statement cost a ~230 ms round trip and a write path issuing 10-25 of them sequentially took 2-5 s. Fixed by [vercel.json](vercel.json) pinning the region to `bom1`. **Needs a deploy, then the two-step verification in Phase 10.** The proposed Supabase migration is **closed — paused by the user 2026-09-04**; Part A stays on Turso |

## 3. Tech Stack

- **Next.js 16** (App Router, TypeScript, Turbopack) — single app, UI + API/server actions together.
- **Prisma ORM 7** + **SQLite** (`dev.db` in project root) via the `@prisma/adapter-better-sqlite3` driver adapter (Prisma 7 requires an explicit driver adapter — plain `new PrismaClient()` will throw).
- **NextAuth v5 (beta)**, credentials provider, JWT session strategy. Route protection via `src/proxy.ts` (Next.js renamed the old `middleware.ts` convention to `proxy.ts` in this version).
- **Tailwind CSS 4** for styling.
- **bcryptjs** for password hashing.

Chosen deliberately for low maintenance: one codebase, one process, no separate backend to deploy or keep in sync.

## 4. How to Run It

```bash
cd "C:\Users\Kavita\Desktop\inventory management"
npm install        # if node_modules isn't present
npm run dev         # http://localhost:3000
```

Seeded logins, one per role (**change these before any real/shared use**):
- `admin@example.com` / `admin123`
- `finance@example.com` / `finance123` — receives stock, cannot issue it
- `employee@example.com` / `employee123` — moves stock to/from sites, cannot receive it

To re-seed users and item fixtures (idempotent, safe to re-run):
```bash
npx tsx prisma/seed.ts
```

To apply schema changes:
```bash
npx prisma migrate dev --name <description>
```

A `.claude/launch.json` is present so Claude Code's browser preview tool can start the dev server directly.

## 5. Data Model (`prisma/schema.prisma`)

- **User** — id, name, email, passwordHash, role (`ADMIN` | `FINANCE` | `EMPLOYEE`), `isActive`. Accounts are **deactivated, never deleted**: every `Transaction` carries a `userId` and that trail is the answer to the brief's third problem, so removing a leaver would punch holes in it.
- **Item** — id, name, sku, category, `baseUnit` (what stock is counted in: m, pcs), `packUnit` (roll/packet; null = unpackaged), `measure` (`CONTINUOUS` | `DISCRETE`), `scrapThreshold`, minStock, `currentStock`, `scrapStock`
- **PackStock** — sealed packs grouped by size (`@@unique([itemId, packSize])`). Two sealed 400 m rolls are interchangeable, so they are counted, not tracked individually. A 400 m and a 600 m roll of the same wire are two sizes of **one** item.
- **OpenPack** — an opened pack, tracked individually with its own `remaining`, because a 30 m and a 50 m offcut are *not* interchangeable. `state` is `OPEN` or `SCRAP`; optionally points at the shelf slot it physically sits in.
- **DefectiveItem** — goods that exist but are not stock, held for a supplier claim. `source` `DELIVERY` | `RETURN`, `status` `QUARANTINED` | `CLAIMED` | `REPLACED`.
- **Site** — id, name, location, notes
- **Transaction** — type (`STOCK_IN` | `ISSUE` | `RETURN` | `OPEN_PACK` | `SCRAP` | `ADJUSTMENT` | `REVERSAL` | `CONSUME` | `TRANSFER`), quantity **always in the item's baseUnit**, item, optional site, user, note, timestamp, plus display-only `packSize`/`packCount`/`pieces`, a `defectiveQty` on returns, `appliedPlan`/`reason`/`reversedAt` for corrections, `dispatchId`/`deliveryId` grouping, and `fromSiteId` (TRANSFER origin; `siteId` is then the destination).
- **Dispatch** — groups the ISSUE rows of one batch dispatch to a site.
- **Delivery** — one challan received: supplier, reference, and `siteId` (null = into the store; set = delivered direct to that site).
- **SitePickup** — material at a site flagged as awaiting collection. `@@unique([siteId, itemId])`. Its `quantity` is clamped by `reconcileSitePickups` after every movement, because at-site balances are derived rather than stored.
- **Shelf** — id, name, rows, columns (a physical 2-sided shelf unit)
- **ShelfSlot** — shelf, side, row, column, tagCode (matches the physical sticker), isFrontRow, boxType, optional assigned item. **No quantity column.**

### Two rules the whole model rests on

**`Item.currentStock` and `scrapStock` are a cache.** `PackStock` and `OpenPack` are the truth:

```
currentStock = Σ(packSize × sealedCount) + Σ(OpenPack.remaining where OPEN)
scrapStock   =                             Σ(OpenPack.remaining where SCRAP)
```

`recalcItemStock()` in [src/lib/packs.ts](src/lib/packs.ts) is the **only** writer, so there is one place for drift to be prevented.

**A shelf slot stores which item is in a box, never how much.** Contents are derived: a Fresh box shows the item's `PackStock`, an Opened box shows the `OpenPack` rows placed in it, a Recyclable box shows its `SCRAP` rows. The map therefore cannot drift out of step with stock. Assigning an item to an Opened or Recyclable box adopts that item's not-yet-placed packs of the matching state.

### Allocation

Issuing continuous material goes through the pure planner in [src/lib/allocation.ts](src/lib/allocation.ts):

- A bare quantity means **one continuous piece**; pieces are pieces only when entered as pieces.
- **Best-fit**: always cut from the smallest open pack that fits. No exception for stubs — that variant never consumes small packs, so the open pile grows forever.
- **Nothing opens implicitly.** A request needing a sealed pack stops for explicit confirmation, which is where someone reconsiders asking for 150 m when two 75 m runs would come off the offcuts.
- A piece longer than any pack is a **hard out-of-stock error**, not a prompt — opening cannot help.
- An offcut left at or below `scrapThreshold` stops being stock and moves to `/recycle`. **Stock therefore drops by more than you issue**: cutting 340 m off a 350 m roll costs 350. That gap is measured waste, recorded as a `SCRAP` transaction. A remainder of exactly 0 is used up, not scrapped.
- Discrete items pool across packs and never scrap; continuous items cannot pool.

Usage frequency and placement suggestions are **computed on the fly** from `Transaction` rows — no separate tracking table. See `src/lib/suggestions.ts`: ranks items by `ISSUE` count over the last 30 days, and for any high-frequency item not in a front-row slot, suggests swapping it with whatever lower-frequency item currently occupies a front-row slot.

## 6. Where Things Live

```
src/
  app/
    login/                  sign-in page
    dashboard/              stats, low-stock alerts, recent activity, suggestion panel
    items/                  list, new, [id] detail+edit+history
    sites/                  list (with on-site summaries), new, [id] detail+edit+
                            materials panel (consume / transfer / flag for collection);
                            activity groups dispatch lines instead of listing them loose
    at-sites/               cross-site "Material at Sites" view — quantities, flagged
                            amounts, FIFO age; filter by awaiting-collection, sort by age
    transactions/new/       Issue / Return form (single row; Stock In removed in Phase 5)
    users/                  ADMIN-only account management (Phase 8) — create, set role,
                            deactivate, reset password
    account/                self-service: your role, and change your own password.
                            NOT capability-gated — every signed-in account may use it
    dispatches/             list, new (Excel-paste batch review), [id] detail+reverse
    deliveries/             list, new (3-row grid, store or direct-to-site), [id] detail
    shelf/                  list, new, [shelfId] 2D map, suggestions
    recycle/                offcuts below their item's scrap threshold
    defective/              damaged goods held for a supplier claim
    api/auth/[...nextauth]/ NextAuth route handler
  components/
    AppShell.tsx            server component: the only place auth()/can() are called for nav;
                            renders the sidebar + mobile drawer + topbar, or children bare when
                            logged out. Replaced NavBar.tsx (deleted in Phase 7).
    ThemeScript.tsx         inline <script> that applies the saved theme before first paint
    ThemeToggle.tsx         "use client" light/dark toggle, mounted in the sidebar footer and
                            on the login page
    nav/                    navLinks.ts (data), icons.ts (IconName → LucideIcon, client-only),
                            activeHref.ts (PURE, longest-match-wins + activeHref.test.ts),
                            SidebarNav.tsx, MobileNav.tsx
    ui/                     the Phase 7 primitives layer — Button, Card, Badge, tones.ts, Field
                            (+Input/Select/Textarea), Table (+SortableTh), PillToggle, Alert,
                            PageHeader, StatCard, EmptyState, FilterPills, SearchBar. No
                            primitive carries "use client"; conflict-prone ones take explicit
                            props (Tr tone, Input invalid) rather than relying on className
                            override order.
    TransactionForm.tsx     client form: pack/pieces entry + the open-pack confirmation screen
    DispatchBatchForm.tsx   client form: paste → parse → match → plan → review, one card per
                            row at every viewport width (mobile-first, no table)
    DeliveryForm.tsx        client form: 3-row goods-received grid, store or direct-to-site,
                            per-row defective count
    DefectClaimControl.tsx  QUARANTINED → CLAIMED → REPLACED, linking the replacing delivery
    SiteMaterialPanel.tsx   per-item consume / transfer / flag-for-collection on a site,
                            with the "this is marked for collection" warning
    CorrectionPanel.tsx     AdjustStockForm, ReverseButton (shared by items and dispatches)
    ShelfGrid.tsx           client component rendering the 2D shelf map (assign item, box type, front-row)
    NewShelfForm.tsx        client component: two-step shelf creation (size, then per-cell box type)
  lib/
    allocation.ts           PURE planner — best-fit cutting, opens, scrap, planBatch. No DB,
                            runs on both server and client so the preview cannot disagree
                            with the commit.
    allocation.test.ts      18 unit tests (`npm test`)
    matching.ts             PURE item-name matcher — Dice coefficient over bigrams;
                            exact/suggested/ambiguous/unmatched
    matching.test.ts        6 unit tests
    dispatchPaste.ts        PURE paste parser — Excel TSV → {name, quantity} rows,
                            header-row skipping
    dispatchPaste.test.ts   7 unit tests
    packs.ts                DB side: recalcItemStock, openPack, commitAllocation, restock
    corrections.ts          PURE: AppliedPlan record, findReversalObstacles
    corrections.test.ts     10 unit tests
    units.ts                pure formatting: formatStock, describeMovement, describeSlotContents
    auth.ts                 NextAuth config (credentials provider, JWT callbacks)
    prisma.ts               Prisma client singleton (with SQLite driver adapter)
    siteBalance.ts          PURE site arithmetic — siteDelta (transfer-aware),
                            oldestContributingDate (FIFO age), effectiveFlagged (the
                            read-time clamp that makes a stale pickup flag unshowable)
    siteBalance.test.ts     17 unit tests
    stock.ts                DB side: materialsAtSite, itemQuantityAtSite,
                            materialAcrossSites
    sitePickups.ts          reconcileSitePickups — persists the clamp and deletes emptied
                            rows. HOUSEKEEPING ONLY; correctness comes from effectiveFlagged
    suggestions.ts          getPlacementSuggestions() — the frequency/placement engine
    boxTypes.ts             shared BOX_TYPES/BoxType
    permissions.ts          capability table — see §"Permissions" below. currentUser()
                            re-reads the User row rather than trusting the JWT, so
                            deactivation and role changes bind on the next request
    databaseUrl.ts          resolveDatabaseUrl() — throws in production rather than
                            falling back to a phantom local database (Phase 8)
    databaseUrl.test.ts     7 unit tests
    actions/                server actions: items.ts, sites.ts, transactions.ts
                            (recordMovement, openPackAction), shelf.ts (updateSlotBoxType,
                            assignSlotItem), corrections.ts (reverseTransaction,
                            reverseDispatch, adjustStock), dispatches.ts (recordDispatch),
                            deliveries.ts (recordDelivery, updateDefectiveStatus),
                            siteLifecycle.ts (consumeAtSite, transferBetweenSites,
                            markForPickup), users.ts (createUser, setUserRole,
                            setUserActive, resetUserPassword, changeOwnPassword),
                            backup.ts (restoreFromGithub, restoreFromUpload — Phase 9)
    backup/                 dump.ts, restore.ts, github.ts — one shared dump/restore
                            implementation for the nightly job, /backups, and the safety
                            copy taken before every restore (Phase 9)
  proxy.ts                  route-protection middleware (Next.js 16 naming)
prisma/
  schema.prisma
  seed.ts                   admin user + wire/screws/inverter fixtures + two sites
  migrations/
scripts/
  backup-database.ts         `npm run db:backup` — used by the nightly job and by hand
backups/                    local dumps and manual dev.db copies (gitignored) — the
                            durable copies live on the repo's `backups` branch instead
.github/workflows/
  backup.yml                 nightly cron → dumps → commits to the `backups` branch
```

**Permissions live in one place: [src/lib/permissions.ts](src/lib/permissions.ts).** Roles are *workspaces*, not levels — FINANCE receives stock and cannot issue it; EMPLOYEE moves stock to and from sites and cannot receive it; ADMIN does everything. Every server action calls `requireCapability(...)` for itself: `proxy.ts` route-gating and the filtered nav are convenience only, because a server action can be invoked regardless of what the page rendered.

## 7. Known Gaps / Suggested Next Steps

- **✅ Slow writes on the live deployment (Phase 10) — root-caused and fixed 2026-09-04.**
  It was **not** read-after-write latency and not a Turso problem: the Vercel function ran in
  `iad1` (Washington DC) against a database in `aws-ap-south-1` (Mumbai), ~230 ms per SQL
  statement, and Prisma's interactive transactions issue 10-25 of them **sequentially**.
  [vercel.json](vercel.json) now pins the function region to `bom1` (Mumbai). **Still open:
  deploy it and run the verification** — `curl -sI https://sce-inventory.vercel.app/login`
  must show `x-vercel-id: bom1::bom1::`, not `bom1::iad1::`. Full writeup, including why the
  cookie workaround and the Supabase migration were both aimed at the wrong thing:
  [REDESIGN-PLAN.md's "Reopened 2026-09-04" section](REDESIGN-PLAN.md).
- **Not deployed yet.** The plan is now **two parts**: a temporary hosted pilot on Turso + Vercel carrying **real stock data**, then permanent **offline** production on a drive carried between 2-3 office PCs. **SQLite stays throughout** — `provider = "sqlite"` never changes, and Turso is SQLite-compatible, so every existing migration remains valid and only the Prisma adapter is swapped. **No data crosses the cutover**: stock is physically recounted into an Excel sheet and re-entered as an opening delivery. The full plan, including what was reversed and why, is in [REDESIGN-PLAN.md's Phase 8 section](REDESIGN-PLAN.md) — read it before changing any of it. (This bullet previously recorded "a real server behind real HTTPS, SQLite therefore stays, no code changes". That conclusion happens to survive; its premise does not.)
- **Change the seeded passwords** — all three accounts (`admin`/`finance`/`employee`), not just admin. There is now a self-service flow at `/account` and an admin reset at `/users`, so this no longer needs a code change — but the seeded passwords are still in place.
- **⚠️ Test coverage stops at the pure modules, and the reason for deferring the rest has expired.** The 86 tests cover [allocation.ts](src/lib/allocation.ts), [corrections.ts](src/lib/corrections.ts), [matching.ts](src/lib/matching.ts), [dispatchPaste.ts](src/lib/dispatchPaste.ts), [siteBalance.ts](src/lib/siteBalance.ts), [adjustment.ts](src/lib/adjustment.ts) and [activeHref.ts](src/components/nav/activeHref.ts). **Everything that writes to the database has none**: [packs.ts](src/lib/packs.ts), `recordDispatch`, `recordDelivery`, and the whole site lifecycle. The subtlest code in the project is in there — `commitAllocation` resolves the planner's synthetic `new:<i>` pack ids onto rows it creates inside the same transaction. This was deferred on the grounds that "the app is not in real use until the remaining phases land"; **they have all landed**, and the untested surface grew with each one. This is now the single most valuable outstanding item.
- ✅ **Corrections exist** (Phase 3): a movement can be reversed — restoring the exact prior pack state, and refusing when the packs have moved on since — and a physical count can be recorded as an `ADJUSTMENT` with a mandatory reason. Both are `ADMIN`-only. A whole dispatch can be reversed atomically (Phase 4).
- ✅ **Existing items reviewed after the Phase 1 migration** (2026-08-20, during Phase 4). `CBL-200` and `SCR-M4` were the two that predated the pack model; both checked — see §9's Phase 4 note and §10's "State of the working copy". Any *new* item added later still needs `measure`, `packUnit` and `scrapThreshold` set correctly at creation, same as always.
- ✅ **The app refuses to start against a phantom database** (Phase 8). [prisma.ts](src/lib/prisma.ts) used to read `process.env.DATABASE_URL ?? "file:./dev.db"`, so a production server with the variable unset started *successfully* against an empty file in its working directory — no error raised, an inventory that merely looks empty, and every write landing somewhere the next deploy deletes. [databaseUrl.ts](src/lib/databaseUrl.ts) now throws in production while keeping the dev default, covered by 7 tests. The previous guard was a checklist item in this document, which is the weakest enforcement available for a failure nobody can see happening.
- ✅ **Deactivation is not a silent no-op** (Phase 8). Sessions are JWTs, so a deactivated account would have kept working until its token expired and a demoted one would have kept its old powers — neither visible. `currentUser()` in [permissions.ts](src/lib/permissions.ts) now re-reads the row instead of trusting the token, at the cost of one indexed lookup per call.
- ✅ **The Arial-font bug is fixed** (Phase 7): [globals.css](src/app/globals.css) no longer sets `font-family: Arial` on `body`, so the Geist font [layout.tsx](src/app/layout.tsx) loads now actually renders.
- ✅ **Dark mode is now a user toggle** (Phase 7), not OS-only. `@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *));` in globals.css overrides Tailwind's built-in `dark:` variant, an inline `<script>` (`ThemeScript.tsx`) applies the saved choice before first paint, and `ThemeToggle.tsx` (sidebar footer + login page) flips `data-theme` and persists to `localStorage`.
- ✅ **`src/components/ui/` now exists** (Phase 7) — Button, Card, Badge, Field/Input/Select/Textarea, Table/SortableTh, PillToggle, Alert, PageHeader, StatCard, EmptyState, FilterPills, SearchBar, plus `tones.ts` as the single badge-tone source of truth. The three separate badge tone maps, the copy-pasted pill toggle, and the four duplicate `Field` helpers are gone.
- **Shelf tag codes are auto-generated and not editable** (`F1-1`, `B2-3`, etc., generated at shelf-creation time). If physical stickers don't match this scheme, either the seed logic needs adjusting or an edit-tag UI needs adding.
- **No file/photo attachments** on items or transactions — not requested, but a common ask for this type of tool.
- **No CSV export / reporting page** — dashboard covers the "what do we have / what's low / what's issued where" questions live, but there's no printable/exportable report yet.
- **Discontinuing an item — decided 2026-08-27, not built.** There is no way to retire or remove an item today: [items.ts](src/lib/actions/items.ts) has `createItem` and `updateItem` and nothing else. So an item the company stops carrying runs down to zero and then sits below `minStock` **forever**, raising a low-stock alert nobody will ever action — and a low-stock list with permanent noise in it is a list people stop reading. Deleting it is not the fix, and the schema refuses it anyway: `itemId` is a required relation on `Transaction`, `PackStock`, `OpenPack`, `DefectiveItem` and `SitePickup`, so a delete would take the ledger with it. Same answer as accounts, which are deactivated rather than deleted, for the same reason. **The decision is a `discontinued` boolean that suppresses the alert** — and, critically, the low-stock rule moves into **one** predicate instead of the three independent `currentStock < minStock` derivations that exist now ([dashboard](src/app/dashboard/page.tsx:42), [items list](src/app/items/page.tsx:71), and `src/app/items/[id]/page.tsx:79`). Miss one of the three and a suppressed alert is indistinguishable from a healthy item. Pickers are deliberately left alone — stock already on the shelf stays issuable. Full scope, rejected alternatives and verification steps are in [REDESIGN-PLAN.md's cross-phase notes](REDESIGN-PLAN.md).
- **npm audit** flags 3 high-severity issues, all in `prisma`'s own dev-time config-merging dependency (`deepmerge-ts`), not in runtime code — safe to ignore for now, but worth revisiting on the next `npm audit` pass since a fix will likely ship in a future Prisma release.
- ✅ **Shelf slots no longer store a quantity at all** (Phase 1), so the drift this entry used to warn about is gone: a box's contents are *derived* from the item's packs. See §5 and the design record in §8, whose last three points this reversed.

## 8. Design Record — Condition-Based Shelving

*Consolidated here on 2026-08-20 from the former `condition-based-shelving-plan.md`, which was deleted because most of its decisions are being reversed and a standalone file would have contradicted the code.*

**Problem it solved.** The app had no concept of material *condition*, and an item could sit in at most one `ShelfSlot` in the whole system. In the real storeroom the same material splits into up to three physical groups — brand-new/unopened, opened/in-use, and recyclable scrap below a usable threshold (e.g. a wire offcut under ~15 m).

**Decisions taken (2026-08-19), as built:**

- **A fixed set of three box types**, not a configurable list: `FRESH`, `OPENED`, `RECYCLABLE`. Covers the real need without building admin UI for arbitrary box-type definitions.
- **One slot per item *per box type*** (`@@unique([itemId, boxType])`), relaxed from the original "one slot per item globally".
- **Box type is chosen per-cell at shelf-creation time** — [NewShelfForm.tsx](src/components/NewShelfForm.tsx) is two-step: size the grid, then click each cell to cycle its type.
- **No automated below-threshold rule.** Whether an offcut is "rarely useful" was judged a human call — staff decide and physically move it to the Recyclable box. No numeric field, no computed logic.
- **Slot occupancy is transaction-driven** (added same day, superseding an earlier version where staff typed quantities directly into slots). `applyTransactionToSlot()` in [transactions.ts](src/lib/actions/transactions.ts) applies a transaction's quantity as a delta to a chosen slot; Stock In and Return add, Issue draws down, a slot reaching zero empties itself. The shelf page offers only box-type relabeling and front-row marking. Per-slot quantity is informational and never reconciled against `Item.currentStock`.

**Status: this is a historical record of what was decided on 2026-08-19, kept because it
explains *why* — three of its five decisions have since been reversed, and the reasoning is
what stops them being re-derived.** What actually holds today:

| Decision above | Now |
|---|---|
| Three fixed box types `FRESH`/`OPENED`/`RECYCLABLE` | ✅ still true |
| Box type chosen per-cell at shelf creation | ✅ still true |
| One slot per item per box type (`@@unique([itemId, boxType])`) | ❌ **reversed in Phase 1** — the unique constraint is gone, so a large arrival can fill several boxes of one condition |
| No automated below-threshold rule; staff decide what is scrap | ❌ **reversed in Phase 1** — an offcut at or below `scrapThreshold` leaves stock automatically. Deliberate: back then `currentStock` was a single number with no concept of an offcut, so there was nothing to automate against |
| Slot occupancy is transaction-driven via `applyTransactionToSlot` | ❌ **reversed in Phase 1** — `ShelfSlot.quantity` and `applyTransactionToSlot` were both **deleted**. Contents are derived from the item's packs, so the map cannot drift. Carrying the old behaviour forward would have got worse, since a 15-row dispatch skips slots entirely |

## 9. Redesign — Phase Status

**All six functional phases are built and verified**: 1 (packs, cut lengths, scrap),
2 (roles), 3 (corrections), 4 (dispatch batch), 5 (delivery entry) and 6 (site lifecycle).
**Phase 7 (UI overhaul + mobile web) is also built and verified**, on 2026-08-21 — see its
as-built note below. **Phase 8 (hosting) is in progress** — see its entry below for what has
landed and what the remaining blocker is. **Phase 11 (role consolidation + admin approvals) is
decided but NOT built** — every entry above it describes code that exists; that one does not.

### Phase 1 — built 2026-08-20

- `Item.unit` → `baseUnit` + `packUnit`, plus `measure` (`CONTINUOUS`/`DISCRETE`) and `scrapThreshold`.
- **`PackStock`** — sealed packs grouped by size; two sealed 400 m rolls are interchangeable, so they are counted. A 400 m and a 600 m roll of the same wire are two sizes of one item, not two SKUs.
- **`OpenPack`** — opened packs tracked individually, because a 30 m and a 50 m offcut are *not* interchangeable.
- `Item.currentStock`/`scrapStock` are now a **cache**; `recalcItemStock()` in [src/lib/packs.ts](src/lib/packs.ts) is the only writer.
- **[src/lib/allocation.ts](src/lib/allocation.ts)** — pure planner. Best-fit (smallest pack that fits), longest pieces first, nothing opens without explicit approval, and a piece longer than any pack is a hard out-of-stock error rather than a prompt. 18 unit tests in [allocation.test.ts](src/lib/allocation.test.ts), run with `npm test`.
- Offcuts at or below `scrapThreshold` leave stock automatically and appear at `/recycle`. **Stock therefore drops by more than you issue** — cutting 340 m off a 350 m roll costs 350. That gap is measured waste, recorded as a `SCRAP` transaction.
- Returns carry an optional defective quantity → `/defective`, held for a supplier claim.
- **Shelf slots no longer store a quantity.** A box shows what its item's packs hold: Fresh → sealed, Opened → the open packs placed in it, Recyclable → scrap. `applyTransactionToSlot` is gone.

### Phase 4 — built 2026-08-20

New `Dispatch` model groups a 15+-line Excel-pasted allocation into one event. Flow is
paste → parse → match → plan → review → commit, all client-side until submit; commit is one
`prisma.$transaction` running the *same* `commitAllocation` a single-row issue uses, once
per line in row order, so later rows see the stock earlier rows just took. Reversal extends
the Phase 3 primitive to a whole dispatch atomically. Full detail, verification results, and
the three deviations from the original plan are in
[REDESIGN-PLAN.md's "Phase 4 — as built"](REDESIGN-PLAN.md) — worth reading before touching
this code, since it records *why* the paste parser is a separate file, why the review screen
has no table markup at all, and how batch reversal works without a single-row DB
representation.

### Phase 5 — built 2026-08-20

New `Delivery` model records goods received: supplier, challan reference, and above all
**destination**. `siteId = null` is the ordinary path (packs land in the store);
`siteId` set means the material never touches the store, and each line writes a
**`STOCK_IN` + `ISSUE` pair sharing one `deliveryId`**, netting to zero at the office. That
pairing is what lets `materialsAtSite`, the return guard and every dashboard keep working
untouched — and it is why returning leftovers from a direct-delivered site now succeeds
where it used to be rejected. Deliveries only ever add material, so nothing here touches the
allocator. Defective goods **never enter stock at all**: ten arriving with two damaged
records 8 in and 2 quarantined, not 10-then-minus-2.

**The one non-obvious consequence, fixed in the same phase:**
[suggestions.ts](src/lib/suggestions.ts) now excludes `ISSUE` rows carrying a `deliveryId`
from its ranking `groupBy`. Without that, an item delivered straight to site twenty times
would climb the usage ranking and be recommended a prime front-row picking slot it is never
picked from — material that never sat on the shelf at all. This is the one place where
"the pairing changes nothing downstream" turned out to be false.

Full verification results and the two deviations are in
[REDESIGN-PLAN.md's "Phase 5 — as built"](REDESIGN-PLAN.md).

### Phase 6 — built 2026-08-20

The last functional phase. Four related things, and the one that finally spends the budget
every earlier phase preserved:

- **`CONSUME`** — material used up at a site. Zero delta to store `currentStock`; negative
  against the site. **This is the change to `materialsAtSite` that Phases 1-5 were all shaped
  around avoiding** — it now reads `ISSUE − RETURN − CONSUME`, plus the transfer terms.
  Because the return guard reads the same function, it refuses returns of consumed material
  for free.
- **`TRANSFER`** — site A → B without passing through the store, with `fromSiteId` as origin
  and `siteId` as destination. A **dedicated type**, unlike direct-to-site delivery's
  `STOCK_IN`/`ISSUE` pairing: pairing would create an `OpenPack` on the way in and consume it
  on the way out, churning pack state for material that never goes near the shelf. A transfer
  touches **no packs at all**.
- **`SitePickup`** — "not lost, not consumed, just not worth a trip yet". It exists to stop a
  specific accident: if `CONSUME` were the only way to clear a site's list, someone tidying up
  would eventually write off wire sitting retrievable on a roof. Flagging labels material;
  it never moves it. `reconcileSitePickups` clamps the flag after every movement.
- **`/at-sites`** — the cross-site view, with FIFO age (see
  [siteBalance.ts](src/lib/siteBalance.ts)); a plain "earliest issue date" would overstate age
  whenever material was returned and re-issued.
- **Reorder annotation** — low-stock alerts now read "+ N at 2 sites (not counted)". Shown,
  deliberately never counted: reorder levels stay store-only so the app never implies
  material it cannot hand over today.

Full verification results and the three deviations are in
[REDESIGN-PLAN.md's "Phase 6 — as built"](REDESIGN-PLAN.md).

### Phase 7 — UI overhaul + mobile web ✅ BUILT 2026-08-21

**Built in one session, all 14 steps, in order.** Phases 2-6 deliberately built **plain UI in
the existing house style**, on the grounds that a later redesign would discard any polish
added then. All six had landed, so Phase 7 was planned, approved, and then built on
2026-08-21.

Full design record — the direction, the decisions, the alternatives rejected, and the
as-built note — is in [REDESIGN-PLAN.md's "Phase 7" section](REDESIGN-PLAN.md). The
step-by-step working checklist that guided the build lives outside the repo at
`C:\Users\Kavita\.claude\plans\c-users-kavita-downloads-ui-examples-i-ethereal-swan.md`.

**What changed**, in one paragraph: light theme by default with a *user* dark toggle (dark
previously followed the OS only), a grouped left sidebar (`AppShell` + `nav/`) replacing the
13-link top bar, a teal accent, and a real `src/components/ui/` primitives layer. There had
been **no design system at all** — three separate badge tone maps, the pill toggle
copy-pasted in three files, four duplicate `Field` helpers — all now gone. Search and
sortable columns landed on the items list; the dashboard gained three more stat cards
(Material at Sites, Awaiting Collection, Open Claims).

**Two live bugs fixed along the way:** [globals.css](src/app/globals.css) no longer sets
`font-family: Arial` on `body` — the Geist font [layout.tsx](src/app/layout.tsx) loads now
actually renders — and dark mode is now a user choice, not OS-only.

**The constraint held: markup only.** `git status` against `src/lib`, `src/lib/actions`, and
`prisma/schema.prisma` shows zero changes. The two agreed exceptions were used exactly as
scoped — the search/sort `searchParams` reads in `items/page.tsx`, and the extra dashboard
reads via `materialAcrossSites()` plus one `prisma.defectiveItem.count()` call for the Open
Claims stat, both inside `dashboard/page.tsx`. **`npm test` stayed green throughout** (58 → 63,
the 5 new ones covering the pure `activeHref.ts`) — the tripwire never tripped.

**All six interactions that had to survive verbatim were exercised by hand and confirmed
unchanged** — the pack-open confirmation screen (full form replacement; "Go back and revise"
restores state exactly), the dispatch per-row open approval (resets on any edit to that row —
verified directly), the consume-vs-pickup-flag warning (both "Go back" and "Consume anyway"
paths verified against the real database), the shelf popover (single-open, resets on
Front/Back switch), the shelf wizard, and the inline expand-in-place forms. See
REDESIGN-PLAN.md's Phase 7 "as built" note for exactly how each was checked, and for the one
bug verification found — which was in a test script, not the app (a generic
`document.querySelector('form')` grabbing the sign-out form instead of the intended one).

**Settled: this stays a web app.** No native Android app, so **no HTTP API is needed** — the
existing Next.js server actions are fine, and nothing about phases 2-6 has to change to
accommodate a mobile client. The Android work is browser optimisation on a phone, plus a
proper domain.

**Architectural note that outlives the redesign:** business logic stays out of components and
out of server actions. `allocation.ts` is pure and framework-agnostic; `packs.ts` takes a
transaction client and knows nothing about Next. A redesign then touches only markup.

**Mobile checklist for the overhaul** (recorded before planning so it was not rediscovered
later — folded into the Phase 7 plan on 2026-08-21). **Scope note: the user chose
desktop-first, mobile-usable**, which narrows the original "mobile web" brief. These items
still apply; re-optimising layouts for the phone does not.

- ✅ **Both batch screens were built card-per-row from the start** — the dispatch review
  (Phase 4) and the delivery grid (Phase 5), no table markup at all at any width, each
  confirmed at 375px with zero horizontal scroll and `inputMode="numeric"` on every number
  field. These were the two screens the checklist worried about, and neither needs
  retrofitting.
- ✅ **`inputMode="numeric"` added to every quantity/length field in [TransactionForm.tsx](src/components/TransactionForm.tsx)** (Phase 7) — summons the number keypad on Android instead of the full keyboard.
- Touch targets on the shelf grid cells and their popover — carried forward from the
  original sizing (the grid cells were already 96px tall; not deliberately revisited).
- Keep the existing `overflow-x-auto` wrapper on every table; it is already the house pattern
  and is what stops wide tables breaking the page.
- `<datalist>` typeahead (used by the item pickers) works on Android Chrome — no replacement
  needed.
- Optional: a web app manifest makes it installable to the home screen with no other change.

### Phase 8 — Hosting 🔨 IN PROGRESS (started 2026-08-22; Part A deployed 2026-08-25)

**The requirement turned out not to be "put it on a server".** It was *other people in the
office need to use it* — under 10 users, office hours, on the PCs they already have, with
nobody available to administer anything. That exposed a single point of failure: if the app
runs on one employee's PC, that person being on leave takes the app **and the database**
with them.

**Then on 2026-08-25 it changed again, and this one reshaped the phase.** The client prefers
**secure offline storage even at the cost of restricted access**. Hosting is therefore not
the destination but a **testing period**; production is a machine in the office. Phase 8 is
now **Part A (hosted pilot) and Part B (offline production)**.

**Four decisions, all recorded in full in
[REDESIGN-PLAN.md's Phase 8 section](REDESIGN-PLAN.md)** — read it before changing any:

1. **Putting the SQLite file on Google Drive was rejected.** It corrupts the database:
   sync clients ignore SQLite's file locks, the `-wal`/`-shm` sidecars sync out of order,
   uploads catch mid-write pages, and two PCs produce `data (1).db` rather than a merge.
   Silent, and fatal to a ledger. Drive keeps a valid role as the destination for **daily
   dump files**, which are static and safe to sync — that is not a contradiction.
2. **SQLite → managed Postgres was decided on 2026-08-23 and superseded on 2026-08-25.**
   It was right while hosting was permanent. With production offline on a file, Postgres
   would mean SQLite → Postgres → SQLite: two ports to arrive where we started, both
   through the untested write path.
3. **`provider = "sqlite"` end to end.** Turso (libSQL) for Part A — SQLite-compatible, so
   migrations stay valid and only the adapter changes (`@prisma/adapter-libsql`, verified
   at 7.9.1, matching the installed Prisma). A plain file for Part B.
4. **No data crosses the cutover.** Stock is counted physically, written to Excel, and
   entered as an opening **delivery** — *not* an adjustment, which cannot create stock on a
   fresh database. The recount is against physical reality, so pilot errors cannot propagate
   into production.

**Built and committed** (`3e56f28`):

- **`DATABASE_URL` fail-fast** — see the entry in §7. This *replaces* the old checklist item
  below about pointing it outside the deploy directory: that advice still holds, but it is
  no longer the only thing standing between a typo and a lost ledger.
- **Account management** — `/users` (admin) and `/account` (everyone), `user:manage`,
  `User.isActive`, lockout guards. `currentUser()` re-reads the row so deactivation and
  role changes take effect immediately rather than at token expiry.
- **Deployability** — `npm ci && npm run build` previously failed on a clean checkout.

**Part A is live (2026-08-25, `ab90370`).** The adapter was swapped to
`@prisma/adapter-libsql` (7.9.1) in [prisma.ts](src/lib/prisma.ts) and
[seed.ts](prisma/seed.ts); `.env.example` documents `TURSO_AUTH_TOKEN` and the
`libsql://` URL form. All 10 existing migrations and the seed data were applied to the
Turso database, the repo was pushed to
[github.com/sarveshsolarcastle-arch/SCE-inventory](https://github.com/sarveshsolarcastle-arch/SCE-inventory),
and it is deployed on Vercel at **sce-inventory.vercel.app** with `AUTH_TRUST_HOST=true` and
a fresh `AUTH_SECRET`. Verified end to end in production: login, dashboard, real data from
Turso, no errors.

> **⚠️ `prisma migrate deploy` does not work against a `libsql://` URL** — it fails with
> `P1013: scheme not recognized`, confirmed against Prisma's own docs, which say migrations
> against Turso go through direct SQL execution, not the CLI's migrate engine. The 10
> existing migrations were applied with `@libsql/client`'s `executeMultiple()` (its own docs
> recommend this specifically for migration scripts) via a one-off script, run once and
> discarded. **Any future schema change needs the same manual step** — write the migration
> normally with `prisma migrate dev` against the local SQLite file, then apply the resulting
> `migration.sql` to Turso with `executeMultiple()` (or the Turso CLI) by hand. `npm run
> db:migrate` only works against a `file:` URL.

**Still open on Part A**:
- **Seeded passwords are still the defaults** (`admin123` / `finance123` / `employee123`) on
  a public URL — the biggest live risk right now. Change via `/users`; each account should
  get its own distinct password, since `Transaction.userId` is the accountability trail and
  a shared password defeats it.
- **Automated daily dump to Google Drive** — not set up yet. Dated filenames, keep ~30,
  restore one before trusting it.
- **Spot-count the wire and screws mid-pilot** — the only independent check on the untested
  write path, per the plan.

> **The Part A database is Turso, and that is not an open question.** Neon — or any Postgres,
> free or paid — is rejected here: it reinstates the SQLite → Postgres → SQLite double port
> this phase was re-planned to avoid, both passes running through untested write-path code.
> Being free does not change that; the cost was never money. The **app host** (Vercel vs
> Cloudflare Workers) is a separate question that touches no database code and blocked
> nothing — Vercel was used.
>
> **Provisioning the accounts and handling the auth token was the user's to do**, not an
> agent's, and that is how it happened — the agent wrote no credentials into the repo.

**Still to do — Part B**: a self-contained drive (built app + `node_modules` + portable Node
+ the database + `start.bat`), the path computed from `%~dp0` so changing drive letters
cannot silently point `DATABASE_URL` at nothing, a second drive as the backup, and the
cutover recount.

**Decided 2026-08-25: free tiers for Part A.** Turso's free-tier cross-tenant exposure risk
and Vercel Hobby's non-commercial restriction are therefore **accepted, not mitigated** —
with real client data on it. Both are monthly subscriptions, so either can be switched on
mid-pilot if the risk stops feeling theoretical. See REDESIGN-PLAN.md for what each is.

**Two decisions still open**: whether Part B is reachable from outside the office at all
(**LAN-only is the default until decided**), and how long Part A runs before the cutover —
the second has never been discussed and is the one most likely to drift.

> **⚠️ Part B invariant: exactly one PC runs the app at a time, and physical possession of
> the drive is what enforces it.** A database on a drive plugged into one machine cannot be
> opened by a second. That stops being true the moment someone shares the drive over the
> network to be helpful — which is the Google Drive corruption reached by another route.
> **Never share the drive.** Stop the app before ejecting, too.

#### Server checklist — still current

- `npm run build` + `npm start`. **Never `npm run dev` in production.**
- A process manager (systemd unit or pm2) so it survives reboots.
- TLS at a reverse proxy. Caddy is the least work — automatic Let's Encrypt issuance and
  renewal; nginx + certbot otherwise.
- **`AUTH_TRUST_HOST=true`** — NextAuth v5 behind a reverse proxy otherwise rejects requests
  or builds wrong callback URLs. Environment variable only, no code change.
- A **fresh `AUTH_SECRET`**, not the development one.
- Change the seeded `admin@example.com` / `admin123` password before anyone else has access.
- ~~A scheduled backup~~ — **done (Phase 9)**: `.github/workflows/backup.yml` runs nightly,
  secrets set, live on Production. See [.env.example](.env.example) and Phase 9's notes below
  for what's still worth doing once — the live restore drill.
- See [.env.example](.env.example) for the full variable contract.
- **Regenerate `package-lock.json` whenever dependencies move between sections.** `npm ci`
  refuses a package.json/lock mismatch outright, so a stale lock breaks the deploy at step
  one. This was nearly shipped once.

### Phase 9 — Automated backups ✅ BUILT 2026-09-01

**Why now:** Part A's move to Turso (Phase 8) removed the one thing that made backups easy —
a local `dev.db` file anyone could copy. Nothing filled that gap: the item sat as "manual
copies only, no schedule" through Phase 8. Requirements from the user: free forever (no new
paid account), and a restore simple enough for someone with no coding background — the
WhatsApp-restoring-your-chats bar, not a terminal session.

**What decided the design:** the restore side. For the app to offer "restore from the latest
backup" as a button rather than "go find a file", the backup has to live somewhere the app
itself can read back through an API. That ruled out a plain cloud storage bucket (a new
account, credentials to manage) and pointed at the private GitHub repo the project already
has — free, and both writable by a scheduled job and readable by the app.

**How it works:**
- `.github/workflows/backup.yml` — nightly cron (`workflow_dispatch` too, for an on-demand
  run), dumps the database with `npm run db:backup`, commits it to the repo's `backups`
  branch, prunes to the newest 30.
- `src/lib/backup/dump.ts` — the one dump implementation, shared by the nightly job, the
  in-app "Download a copy" button, and the safety copy `restore.ts` takes before overwriting
  anything. Reads DDL straight from `sqlite_schema` and `SELECT *`s every table it finds
  there, rather than going through Prisma Client or a fixed model list — so it reflects what
  is actually in the database, not what the current schema claims should be there. In
  practice that is the 12 app tables and nothing else: `_prisma_migrations` was never
  created on the live Turso database, because migrations there were applied as raw SQL
  rather than through `prisma migrate deploy` (see Phase 8's notes on why). If it is ever
  created, the dump picks it up automatically.
- `src/lib/backup/restore.ts` — takes a safety dump first, refuses to proceed if that fails,
  and rolls back to it if the new script errors partway through.
- `src/lib/backup/github.ts` — lists and fetches dumps from the `backups` branch, using a
  read-only `GITHUB_BACKUP_TOKEN`.
- `/backups` (admin-only, new `backup:manage` capability) — lists nightly backups with a
  Restore button per row (type-the-date confirmation, since this is more destructive than
  anything else in the app), a Download button for a manual off-site copy, and a
  restore-from-uploaded-file fallback for when GitHub itself is unreachable.
- A successful restore signs out every session (the restored data may not contain the
  session's own user row) via the same `signOut({ redirectTo: "/login" })` AppShell's own
  sign-out button uses.

**Setup — done 2026-09-03:** `DATABASE_URL` and `TURSO_AUTH_TOKEN` are set as GitHub repo
secrets (Settings → Secrets and variables → Actions), and `GITHUB_BACKUP_TOKEN` (read-only,
fine-grained, this repo only) is set in Vercel's shared environment variables, linked to this
project, Production included. Also set: Vercel's **Ignored Build Step**
(Settings → Git) skips builds on the `backups` branch — without it, every nightly commit the
workflow makes was triggering a doomed Preview deployment (that branch has no app in it, only
`.sql` files), cluttering the Deployments list and burning build minutes for nothing. Code is
live on Production as of commit `193c268`.

**Verified so far:** `dumpDatabase()` run against the live Turso database (441 rows, all 12
tables, plausible counts), and that exact dump reloaded into a scratch local SQLite file —
every row count matched and spot-checked rows (dates, JSON, nulls) round-tripped correctly.
The app itself, pointed at that restored scratch copy, rendered `/sites` and `/backups`
correctly.

**Not yet done: the live restore drill.** Nobody has yet hit Restore on `/backups` against
the real production database. Plan: trigger the nightly workflow manually
(Actions → "Nightly database backup" → Run workflow) in the evening, confirm it succeeds and
a dump lands on the `backups` branch, then immediately restore to that same backup — a
same-night restore keeps the loss window near zero even if something is wrong. Do this once
before trusting the button unsupervised — an untested backup is a guess.

### Phase 10 — slow writes on the live deployment ✅ root-caused and fixed 2026-09-04

**Reported as:** a read-after-write consistency problem on Turso — roughly a 2-second gap
between clicking something that writes and the result showing up.

**What it actually was:** geography. The Vercel function was running in **`iad1`**
(Washington DC) — the platform default, never overridden because there was no `vercel.json`
— while the database is in **`aws-ap-south-1`** (Mumbai, it is in the hostname). Every SQL
statement was a ~230 ms transcontinental round trip, and Prisma's interactive
`$transaction` issues its statements **sequentially**, so a write path like
`recordTransaction` → `commitAllocation` (10-25 statements) took 2-5 seconds. The header on
the live site said so outright:

```
x-vercel-id: bom1::iad1::zd9l4-...
             ^^^^  ^^^^ the function runs here
             edge
```

Measured against that same production database from Mumbai, a warm `SELECT 1` is **15 ms**
and ten sequential ones total **163 ms**. The database was never slow — it was 15 ms from
the people using it and 230 ms from the server serving them.

**The fix:** [vercel.json](vercel.json) — `{"regions": ["bom1"]}`, Vercel's Mumbai region,
the same city as the database. Per-statement cost drops from ~230 ms to low single digits.
JSON takes no comments, so **do not delete that file as empty-looking config**; the
reasoning is in REDESIGN-PLAN.md.

**Not yet verified — it needs a deploy.** After deploying, confirm
`curl -sI https://sce-inventory.vercel.app/login | grep x-vercel-id` reports
`bom1::bom1::`. If it still says `iad1`, Vercel's project-level Function Region setting is
overriding the file.

**Why the two proposed remedies were both aimed elsewhere.** The cookie-based workaround the
user found is real, but it addresses Turso **embedded/read replicas** — and
[src/lib/prisma.ts](src/lib/prisma.ts) configures no `syncUrl` and no replica, so reads and
writes hit the same node and nothing could be stale. The Supabase migration was proposed as
the fix for *this* error; since this error was a region setting, it needs a fresh argument
if it is still wanted. Postgres in `us-east-1` behind an `iad1` function would have been
fast for the same reason this fix is fast, and would have credited Supabase for it.

**Closed 2026-09-04 by the user: Supabase stays paused.** No separate repo, host or
database; nothing to terminate later; Part A continues on Turso. Treat this as a closed
ticket rather than a deferred one — reopening it needs a new reason, not this one.

### Phase 11 — FINANCE absorbs EMPLOYEE, and asks an admin for the rest 📋 DECIDED 2026-09-05, NOT BUILT

**Nothing in this phase is written yet.** The design is settled with the user and recorded in
[REDESIGN-PLAN.md](REDESIGN-PLAN.md) ("Decided 2026-09-05"), which is the durable version. The
file-by-file implementation plan is at
`C:\Users\Kavita\.claude\plans\hazy-weaving-spring.md` — **outside the repo, so do not rely on
it**; if it is gone, REDESIGN-PLAN.md carries every decision and its reasoning.

**The requirement.** The employee account is being retired and finance takes over its work
outright — an accepted takeover, the user's words. Separately, finance should be able to attempt
the admin-only housekeeping without an admin present: the attempt becomes an approval request
that every admin sees, and the first admin to answer it decides it and clears it for everyone.
In-app only — no email, no push. Account management stays hard admin-only.

**Three parts, shipped separately because their risk profiles differ by an order of magnitude.**

| Part | What | Size | Risk | Status |
|---|---|---|---|---|
| 1 | Five employee capabilities added to the FINANCE array | ~1 hr | Low — one code table, no migration | ✅ **BUILT 2026-09-05** |
| 3 | `adjustStock` stores a delta instead of an absolute count | ~½ day | **Highest** — the only stock arithmetic touched | ✅ **BUILT 2026-09-05** |
| 2 | The approval workflow: `ApprovalRequest`, an operations registry, `/approvals` | 3-5 days | Medium — permission layer and UI, no ledger maths | ❌ not built |

Recommended order was **1 → 3 → 2**. **Part 3 went first in the end** and that was right: it
fixed two live bugs that had nothing to do with approvals, and shipping it alone kept the only
stock-arithmetic change of the three isolated. Parts 1 and 2 are unchanged and still in that
order. Part 2 is the only one that rewires existing write actions.

**Two things found while planning that changed what needed doing:**

- **`item:manage` was already FINANCE's.** "Let finance add a new item type" was on the original
  request list; finance has been able to do it since Phase 1. No work.
- **`adjustStock` had a live bug** — an absolute write, so a dispatch landing between opening the
  count form and pressing Submit was silently erased. Fixed by Part 3, below.

**And a second, worse bug found while executing Part 3, which the planning had missed.**
`adjustStock` validated *every* field of the submitted form as a non-negative integer, including
the `reason` the same form posts. `Number("annual count")` is `NaN`, so **every adjustment
carrying a real reason was refused** and no stock count could ever be recorded — the feature had
never worked since Phase 3 built it. The symptom was in plain sight and nobody had read it: zero
`ADJUSTMENT` rows in a development database that had been through every phase's verification.
Phase 3's own as-built note only ever claims the *reversal* path was exercised in the browser.
Fixed first, on its own (`0b89701`), because the delta change could not otherwise be observed at
all. **The lesson worth carrying: a verification list that says "✅ passed" phase-wide can still
hide an item nobody actually ran** — §7's warning about DB-layer coverage is not theoretical.

**Excluded from the approval flow on purpose, and the reasoning matters:** `user:manage`, because
an approval flow that can mint an admin is not an approval flow; and `backup:manage`, because
`restoreDatabase` drops and recreates every table — an approved restore would erase the request
row that authorised it and the record of who approved it. Neither is a preference to revisit
casually.

**The trap most likely to be walked into.** The obvious way to give the approval path access to
an action's body is to export an unguarded core from the action file. Every one of those files
carries a top-level `"use server"`, which makes **every async export a network-reachable
endpoint** — so that refactor publishes an unauthenticated delete. The bodies move to plain
modules under `src/lib/approvals/ops/` instead. See REDESIGN-PLAN.md for the other three.

**Before starting Part 2, read** the regression gate in REDESIGN-PLAN.md's verification list. It
rewires eleven live write actions on a deployment carrying real stock, and the DB layer still has
no test coverage (§7, and the standing warning in §10) — the twelve-flow admin walkthrough is
standing in for the tests that do not exist.

#### Part 1 — as built, 2026-09-05

Five capabilities (`stock:issue`, `stock:return`, `stock:consume`, `stock:transfer`,
`site:pickup`) added to the `FINANCE` array in [permissions.ts](src/lib/permissions.ts), kept as
their own commented block so the takeover stays legible rather than merging invisibly into the
list above it. **No migration** — a code table, not a column. Everything else falls out on its
own, exactly as planned: `AppShell` filters the nav on `can()` so the Stock Out group appears,
`proxy.ts` maps `/transactions/new` and `/dispatches/new` to `stock:issue`, and
`recordMovement`'s `CAPABILITY_FOR_TYPE` lookup starts passing.

**`EMPLOYEE` is retired, not removed.** Its capability list is untouched so existing logins keep
working and every `Record<Role, …>` stays total. What changed is that it is no longer *granted*:
`/users` now defaults new accounts to Finance and labels the option "Employee — retired, do not
assign". Both `ROLE_BLURB` maps and the `///` comment on `enum Role` were rewritten in the same
change — the old text said finance "cannot issue stock", which the commit itself made false, and
a doc that contradicts the code is worse than no doc because it is trusted.

**Verified in the browser as `finance@example.com`, against the local copy:**
- Nav gained the **Stock Out** group; Settings still shows only "Your account".
- **Issued 10 Cable Ties to Kandivali through the real form.** Stock 217 → 207, and the row
  reads `ISSUE | 10 | by Finance (FINANCE)` — the attribution `Transaction.userId` exists for.
- Site page gained consume / transfer / flag-for-collection.
- **The server still refuses what finance must not have**, which is the check that matters:
  submitting the site edit form as finance left the site name **unchanged** in the database
  (`NotPermittedError`), and `/users`, `/backups` and `/sites/new` all still bounce to
  `/dashboard`. The item page offers finance no "Record a stock count" and no Reverse.
- The retired `employee@example.com` still signs in and still works.
- `npm test` 86/86, `tsc` clean, `npm run build` passes.

**One fix folded in, because Part 1 promoted it from latent to daily.**
[sites/[id]/page.tsx](src/app/sites/[id]/page.tsx) rendered the Edit Site form
*unconditionally* while `updateSite` requires `site:manage` — so a non-admin got a form that
threw `NotPermittedError` into the error boundary on save. That was survivable while only
employees saw it. Finance now uses site pages every day for consumption and transfers, so the
card is gated and non-admins get a read-only panel instead. Confirmed live before fixing: the
form rendered, the save 500'd, the site was not renamed.

**Still outstanding for Part 2:** `shelf/[shelfId]/page.tsx:46` derives `isAdmin` from a
hardcoded `role === "ADMIN"` rather than `can()`. Harmless today — finance has no `shelf:manage`
either way — but it must move to a capability check before Part 2, or finance will have nothing
to click and therefore nothing to request.

#### Part 3 — as built, 2026-09-05 (`0b89701`, `45aea35`)

Two commits, deliberately: the reason-validation bug first, because until it was fixed the delta
change could not be observed at all — a count never reached the arithmetic.

New pure [src/lib/adjustment.ts](src/lib/adjustment.ts) (`planAdjustment`, `computeDelta`,
`describeRefusal`, `describeAdjustment`) with 16 tests, 70 → **86**. It imports nothing, matching
the `allocation.ts` / `packs.ts` split: it plans against the packs as they are at apply time, and
`actions/corrections.ts` executes the plan with `increment`/`decrement` rather than assignment.
`CorrectionPanel` posts a hidden `ledger_<key>` beside each count, and the `ADJUSTMENT` doc
comment in `schema.prisma` now says the row stores a correction of known size. **No migration** —
the comment is the only schema change, so Turso needed nothing.

Rows the counter agreed with write nothing at all, so an unchanged line cannot be refused because
an unrelated pack moved underneath it. Two failure modes remain and **both are loud**, which is
the whole gain: an open pack used up or scrapped since the count refuses the entire adjustment (a
30 m and a 50 m remainder are not interchangeable, so a partial count is not a count), and a
correction that would drive a figure below zero refuses rather than clamps.

**Verified in the browser, two tabs, against a local copy — not the pilot.** Tab 1 held the count
form on `WIRE-2.5` showing 3 sealed 100 m rolls; tab 2 then opened one, leaving 2 sealed and a new
100 m open pack; tab 1, never reloaded, submitted a count of 4. Result: **3 sealed and the opened
pack untouched**. The absolute write would have set 4 and left the open pack in place, inventing
100 m from nothing with no error anywhere. Then sealed was driven to 1 and a count of 0 submitted
against the stale ledger of 3 — refused with *"there is now only 1 to apply -3 to"*, nothing
written, not clamped. Console clean on both tabs.

**Three departures from the plan**, all deliberate:

1. **The note carries no timestamps.** REDESIGN-PLAN's example reads *"Counted 13 at 10:05 …
   Applied at 12:40"*, but the form submits no count time and render time is not count time, so
   the figure would have been invented. The two ledger totals carry what matters instead:
   *"Counted 2600 m against a ledger of 2500 (+100). Applied to a ledger of 2500, giving 2600."*
   Part 2 gets a real count time for free from `ApprovalRequest.createdAt`.
2. **A count with no paired `ledger_` field is refused**, not silently applied as an absolute
   write — a fallback would reintroduce exactly the bug being removed. A stale cached page
   therefore gets *"This count form is out of date — reload the item page and count again."*
3. **Refusals are collected, not first-fail**, matching `recordDelivery`/`recordDispatch`.

**Deliberately NOT fixed here, and still true:** `adjustStock` does not re-evaluate the scrap
threshold, so a count can leave a remainder at or below it still marked `OPEN` and still counted
as stock, where `addOpenPack` and `commitAllocation` would scrap it. Pre-existing and unchanged.
Fixing it means deciding whether an adjustment also writes a `SCRAP` row — and if it does,
`quantity = |after − before|` starts conflating a count correction with a reclassification, which
is a second decision that does not belong in a change shipped for its arithmetic. **Its own
ticket.**

### Resolved by the redesign — all of it has now landed

| Originally stated | Resolved by |
|---|---|
| ~~§7: nothing can be undone or corrected~~ | ✅ reversal + stocktake adjustment (Phase 3) |
| ~~Stock-in is one row at a time~~ | ✅ dispatch batch (Phase 4) and delivery records (Phase 5) |
| ~~Sites accumulate material forever~~ | ✅ consumption, transfers, pickup flags (Phase 6) |

### Deviations from the Phase 1 plan, and why

Three things came up in the build that the plan had wrong:

1. **`STOCK_IN` stayed in the transaction form** — through Phases 1-4, because removing it before the delivery grid existed would have left no way to add stock at all. ✅ **Resolved in Phase 5:** the delivery grid landed, so the `STOCK_IN` option was removed from the form's type select as originally planned. `recordTransaction` keeps its `STOCK_IN` branch — still correct, still capability-gated — only the UI option went.
2. **Assigning an item to an Opened/Recyclable box adopts its unplaced packs.** Nothing else ever set `OpenPack.shelfSlotId`, so those boxes would have stayed permanently empty.
3. **Empty boxes say what kind of stock is missing** ("no sealed packs", "nothing open here") rather than "empty", which read as though the item had no stock when it merely had none of that condition.

## 10. Handover — Picking Up Phase 8 and What Remains

Written for whoever continues this next. Read in this order: **§1-§9 above**, then
**[REDESIGN-PLAN.md](REDESIGN-PLAN.md)**, then the source files named below.

**Phases 1-7 are all built.** What remains is Phase 8 (hosting, §9's deployment checklist)
and — more urgently — **DB-layer test coverage**, which is still the largest outstanding
risk. See "What to do next" below.

**If you are changing the UI**, read [REDESIGN-PLAN.md's Phase 7 section](REDESIGN-PLAN.md)
first, especially the six interactions that must survive verbatim and the markup-only
constraint. Both still bind: they describe how the UI is built, not merely how it was built
once. Items 3 and 4 below matter less for UI work than for anything touching stock, but the
invariants in the next subsection always bind.

### Read these before touching anything

1. **[AGENTS.md](AGENTS.md)** — this is **not** the Next.js you may know. Version 16 renamed
   `middleware.ts` to `proxy.ts`, and Prisma 7 requires an explicit driver adapter. Read the
   bundled docs in `node_modules/next/dist/docs/` before writing framework code; do not go
   from memory. **Phase 7 depends on this directly** — the theme-without-flash recipe it
   needs is at `node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md`.
2. **[REDESIGN-PLAN.md](REDESIGN-PLAN.md)** — all phases, with per-phase verification
   steps. **It records rejected alternatives and why.** Re-deriving those rules from scratch
   lands on the rejected answer; the reasoning is the valuable part.
3. **[src/lib/allocation.ts](src/lib/allocation.ts)** — the pure planner. The heart of the
   system, and the file to understand first.
4. **[src/lib/allocation.test.ts](src/lib/allocation.test.ts)** — 18 tests that encode every
   allocation rule as an executable example. **Faster to read than the prose.** `npm test`.

### The five invariants that must not be broken

Everything downstream assumes these. Breaking one corrupts stock silently rather than loudly.

1. **`Transaction.quantity` is ALWAYS in the item's `baseUnit`**, for every transaction type.
   `materialsAtSite`, the return guard and the suggestion ranking all depend on it being
   uniform. `packSize`/`packCount`/`pieces` are display metadata — never do arithmetic on them.
2. **`Item.currentStock`/`scrapStock` are a cache.** `PackStock` + `OpenPack` are the truth.
   `recalcItemStock()` is the only writer; call it at the end of anything touching packs.
3. **Nothing opens a sealed pack implicitly.** `openPack()` in
   [packs.ts](src/lib/packs.ts) is the single entry point, and it is only ever called from an
   explicit user confirmation. That friction is a feature, not an oversight — see the
   "reconsideration case" in the plan.
4. **A shelf slot never stores a quantity.** Contents derive from the item's packs.
5. **A site's holding is derived from the ledger, never stored** — see
   [siteBalance.ts](src/lib/siteBalance.ts) — and so is the *effective* pickup flag.
   `SitePickup.quantity` is an **intent**, not a fact: every read path runs it through
   `effectiveFlagged(stored, held)`, so a flag can never be shown claiming more than the site
   holds. `reconcileSitePickups` persists the clamp and deletes emptied rows, but it is
   **housekeeping, not the guarantee** — a writer that forgets to call it leaves an untidy
   row, not a wrong number. That split is deliberate: the failure mode is silent, so it is
   enforced by derivation rather than by every future writer remembering a convention.

### Traps that are not obvious from the code

- **`planAllocation` mutates the snapshot it is given.** That is deliberate — it is how
  `planBatch` threads one inventory through many rows so they compete for stock realistically.
  Pass `cloneSnapshot()` if you need the original intact.
- **`commitAllocation` re-plans inside the transaction** rather than replaying the client's
  plan, then aborts if the fresh plan needs more opens than were approved. Someone else may
  have drawn stock between preview and submit.
- **Synthetic pack ids.** The planner emits `new:<i>` for packs it would open, indexed against
  `plan.opens`. `commitAllocation` creates those rows in order and maps the ids. This is the
  subtlest code in the project and has no test coverage.
- **Scrap means stock drops by more than you issue.** Cutting 340 m off a 350 m roll costs
  350 with a 15 m threshold. Not a bug.
- **The pure modules run on the client too.** `allocation.ts` and `units.ts` must stay free of
  Node and Prisma imports, or the transaction form breaks.
- **Every async export of a `"use server"` file is a network-reachable endpoint.** All of
  `src/lib/actions/*.ts` carries a top-level `"use server"`, so exporting a helper "just for
  internal use" from one of them publishes it as an unauthenticated RPC. Anything that must be
  callable without `requireCapability` in front of it belongs in a plain module elsewhere under
  `src/lib/`. Noted 2026-09-05 while planning Phase 11, where the obvious refactor would have
  published an unauthenticated `deleteSite`.
- **A stock count stores the correction, not the count.** `adjustStock` applies
  `counted − theLedgerFigureTheFormDisplayed` with `increment`/`decrement`, never an assignment,
  because the size of an error survives legitimate movement between the count and its application
  while a total does not. The count form must therefore keep posting its hidden `ledger_<key>`
  inputs — strip them and every adjustment is refused as out-of-date, which is the intended
  failure, but it *is* a failure. Fixed 2026-09-05 (was an absolute write, which silently erased
  anything dispatched mid-count). See [src/lib/adjustment.ts](src/lib/adjustment.ts).
- **Validate only the fields you mean to.** `adjustStock` used to run every entry of its
  `FormData` through a number check, which swept up the `reason` posted by the same form and
  refused every real count for two phases without anyone noticing. Select fields by name first,
  validate second — and remember that a form's `FormData` carries more than the inputs you were
  thinking about.

### State of the working copy

- ⚠️ **`.env` points `DATABASE_URL` at the live Turso pilot — the client's real stock.** Next
  loads `.env` for `next dev` too, so `npm run dev` on this machine wrote *straight into
  production*, and a stock count or a dispatch recorded "just to check" landed on real
  inventory. A gitignored **`.env.local`** now pins `DATABASE_URL="file:./dev.db"` and Next
  loads it ahead of `.env`. Added 2026-09-05 while verifying Phase 11 Part 3. **Confirm it is
  there before browser-testing anything that writes**, and never verify a write path against a
  `libsql://` URL. This stops mattering at the Part B cutover, when production becomes a file
  on a carried drive.
- **The local `dev.db` contains test data created while verifying Phases 1-6 and Phase 11
  Part 3**, not real inventory: `WIRE-2.5` **2600 m** across sealed rolls and returned offcuts,
  `SCR-M4` 231, `CBL-200` 217, `INV-5K` 10; a reversed test dispatch, two test deliveries (one
  direct to Kandivali, one a claim replacement), a settled defective claim, consumed/transferred
  material at Kandivali and Borivali, and — from the Part 3 verification — **two `ADJUSTMENT`
  rows and three 100 m packs opened to force the mid-count race**. **Reseed or clear before real
  stock goes in.**
- ⚠️ **Another session wrote to this database mid-work on 2026-08-20** — two `STOCK_IN` rows
  on `CBL-200` (+17, +13) arrived through the old Stock In form while Phase 4/5 were being
  built. Harmless here since it is all test data, but worth knowing that `dev.db` had
  concurrent writers, and that the Stock In UI path they used has since been removed
  (Phase 5). The server action still accepts `STOCK_IN`; only the form option went.
- ✅ `CBL-200` and `SCR-M4` were reviewed (2026-08-20, during Phase 4). `CBL-200` ("Cable
  Tie 200mm") is a discrete fastener despite its "Cables" category, not continuous wire —
  `DISCRETE`/no `packUnit` was already correct and is unchanged. `SCR-M4` had `packUnit`
  stuck at `null` because `seed.ts`'s upsert never updates an existing row's fields; it is
  now `"packet"`, matching the fixture's own intent. See REDESIGN-PLAN.md's "Phase 4 — as
  built" for the reasoning.
- Backups of `dev.db` are in `backups/` (gitignored). It is the only copy.

### What to do next

**Phases 1-7 are built. Phase 8 is in progress** — accounts, the `DATABASE_URL` fail-fast
and the build prerequisites landed 2026-08-23. The database work has not started.

**Newest work, and where a fresh agent should probably start: Phase 11** (§9) — the employee
role folds into finance, and finance gets an approval queue for the admin-only housekeeping.
Decided in full with the user on 2026-09-05. **Parts 1 and 3 are built; Part 2 is not**:

- **Part 1** — ✅ **BUILT 2026-09-05.** See the as-built note in §9. Folded in one fix it made
  urgent: the site page's Edit form used to render for everyone while `updateSite` required
  `site:manage`.
- **Part 3** — ✅ **BUILT 2026-09-05** (`0b89701`, `45aea35`). See the as-built note in §9.
- **Part 2** (3-5 days) — the approval workflow. Rewires eleven live write actions, so read the
  regression gate first. Three things the plan does not cover, one now cleared:
  - ✅ **The migration path exists again, and the pilot is ready for it.**
    `prisma migrate deploy` cannot reach Turso (`P1013`, see the Phase 8 section) and the
    one-off script used for the first ten migrations had been discarded, so an eleventh had
    **no path to the live pilot**. [scripts/apply-migrations-turso.ts](scripts/apply-migrations-turso.ts)
    replaces it — `npm run db:migrate:turso`, status-only by default.
    Running it revealed the pilot had **no `_prisma_migrations` table at all**: the August
    script applied the SQL and recorded nothing, so a naive apply would have tried to create
    every table over live data. Its schema was verified column-for-column against the local
    database (all twelve tables matched) and then **baselined on 2026-09-05**; it now reports
    all ten applied, nothing pending, and the live app was unaffected. The eleventh migration
    can go straight through `npm run db:migrate:turso -- --apply`.
  - ⚠️ `approveRequest` puts the claim and the work in one `$transaction` against Prisma's 5s
    default timeout; `reverseDispatch` on a 15-line batch is 90+ sequential statements, which
    fits only because `vercel.json` pins the function to Mumbai. Set an explicit `timeout` —
    and note that file stops being a performance tweak and becomes a correctness dependency.
  - ⚠️ Inherited from Part 1: `shelf/[shelfId]/page.tsx:46` gates the whole `ShelfGrid` popover
    on a hardcoded `role === "ADMIN"` rather than `can()`, so finance would have nothing to
    click and therefore nothing to request.

Full reasoning, the rejected alternatives, and the four traps are in
[REDESIGN-PLAN.md](REDESIGN-PLAN.md)'s "Decided 2026-09-05" section. Read it before writing
anything — two of the traps (the `"use server"` export hazard, and why `backup:manage` cannot be
approvable) are the kind that get re-derived wrongly.

**The immediate next step (Part A)**: provision a Turso database, swap the adapter to
`@prisma/adapter-libsql`, deploy to Vercel, change the seeded passwords, and set up the
automated daily dump. The provider, schema and migrations are all untouched. See
[REDESIGN-PLAN.md's Phase 8 section](REDESIGN-PLAN.md) — it records what was reversed,
superseded and re-derived, so read it before re-litigating any of it.

**⚠️ The biggest gap is now live, not hypothetical.** Part A runs the client's **real stock**
through the untested write path, with **no parallel record to catch it** — the Excel sheet is
written once at cutover, not kept alongside. The cutover recount bounds the damage (production
starts from a physical count, so pilot errors cannot propagate) but does not prevent it.
Mid-pilot spot counts on two or three high-movement items are the only check in place.

**Before this goes into real use, cover the DB layer with tests.** This is still the single
most valuable outstanding item, and the justification for deferring it has run out. The
argument was always "the app is not in real use until the remaining phases land" — the
functional ones have landed. Meanwhile the untested surface has grown considerably:
`packs.ts` (including `commitAllocation`'s synthetic `new:<i>` pack-id resolution, still the
subtlest code in the project), `recordDispatch`, `recordDelivery`, and the whole of Phase 6.
The pure modules are well covered at 86 tests; **everything that actually writes to the
database has none**. On 2026-09-05 that gap cashed in: `adjustStock` had been refusing every
stock count since Phase 3 built it, and no test, no build and no phase verification caught it —
the bug lived in the six lines between a `"use server"` boundary and a Prisma call, which is
precisely the band nothing covers.

The other pre-live items, in rough order of cost-to-skip:

1. ~~A scheduled backup~~ — **done (Phase 9)**. Nightly GitHub Actions job, `/backups` page
   for one-click restore, secrets set, live on Production. One thing still worth doing once,
   not code: the live restore drill in Phase 9's notes below — hit Restore against the real
   database at least once, right after a fresh nightly backup, before trusting it unsupervised.
2. **Change the seeded passwords** before anyone else has an account. This no longer needs a
   code change: `/account` for your own, `/users` for an admin reset.
3. The rest of Phase 8's server checklist (§9) — `AUTH_SECRET`, `AUTH_TRUST_HOST`, a process
   manager, TLS.

## 11. Related Documents

- **[REDESIGN-PLAN.md](REDESIGN-PLAN.md)** — the phase plan (1-7 built, **8 in progress**, **11 decided but not built**), with verification steps and, importantly, the alternatives that were rejected and why. **The main document for continuing work.** Its Phase 8 section records two things you will otherwise re-derive wrongly: why the SQLite file cannot live on Google Drive, and why the "SQLite stays" hosting decision was reversed. Its "Decided 2026-09-05" section carries Phase 11 in full — including why `user:manage` and `backup:manage` must never become approvable, and why the approval path cannot call an exported core from a `"use server"` file.
- [.env.example](.env.example) — every environment variable the app reads, with the consequence of getting each one wrong.
- `C:\Users\Kavita\.claude\plans\c-users-kavita-downloads-ui-examples-i-ethereal-swan.md` — the Phase 7/8 working checklist. **Outside the repo**, so it is not a durable record; REDESIGN-PLAN.md's phase sections are.
- `C:\Users\Kavita\.claude\plans\hazy-weaving-spring.md` — the Phase 11 implementation plan: file-by-file changes, the staged sequence, and the end-to-end verification script. **Outside the repo**, same caveat — REDESIGN-PLAN.md's "Decided 2026-09-05" section holds every decision and its reasoning, and is what to trust if the two disagree or the file is missing.
- [inventory_management.md.txt](inventory_management.md.txt) — the original problem statement the project was built from.
- [storeroom-heavy-stock-plan.md](storeroom-heavy-stock-plan.md) — physical storage plan for heavy and humidity-sensitive stock (racking spec, VCI/sealed-case protection). Procurement and physical handling only; no bearing on the code.
