# Inventory Management System — Progress Handover

Last updated: 2026-08-20 (**all six functional redesign phases built** — see §9)

> **§1-§8 describe the code as it stands today.** The six-phase functional redesign is
> **complete**; what remains is Phase 7 (UI overhaul + mobile web) and Phase 8 (hosting),
> both deferred by decision. §9 records what each phase delivered, and §10 is the handover
> guide.

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
| Automated tests | ⚠️ 58 unit tests (`npm test`): allocator, corrections, matching, paste parsing, site balances/FIFO age/pickup clamp; **no coverage of the DB layer or UI** |
| Roles: ADMIN / FINANCE / EMPLOYEE, capability-gated | ✅ Done (Phase 2) |
| Corrections: reversal and stocktake adjustment | ✅ Done (Phase 3) |
| Bulk dispatch to site, from Excel paste | ✅ Done (Phase 4) |
| Delivery entry (to store or direct to site) | ✅ Done (Phase 5) |
| Site lifecycle: consumption, transfers, pickup flags, cross-site view | ✅ Done (Phase 6) |
| UI overhaul + mobile web | ❌ Phase 7 — deferred by decision |
| Deployment | ❌ Not deployed anywhere — runs locally only |
| Database backups | ⚠️ Manual copies in `backups/` only — no schedule |

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

- **User** — id, name, email, passwordHash, role (`ADMIN` | `FINANCE` | `EMPLOYEE`)
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
    dispatches/             list, new (Excel-paste batch review), [id] detail+reverse
    deliveries/             list, new (3-row grid, store or direct-to-site), [id] detail
    shelf/                  list, new, [shelfId] 2D map, suggestions
    recycle/                offcuts below their item's scrap threshold
    defective/              damaged goods held for a supplier claim
    api/auth/[...nextauth]/ NextAuth route handler
  components/
    NavBar.tsx              top nav, shown only when logged in
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
    permissions.ts          capability table — see §"Permissions" below
    actions/                server actions: items.ts, sites.ts, transactions.ts
                            (recordMovement, openPackAction), shelf.ts (updateSlotBoxType,
                            assignSlotItem), corrections.ts (reverseTransaction,
                            reverseDispatch, adjustStock), dispatches.ts (recordDispatch),
                            deliveries.ts (recordDelivery, updateDefectiveStatus),
                            siteLifecycle.ts (consumeAtSite, transferBetweenSites,
                            markForPickup)
  proxy.ts                  route-protection middleware (Next.js 16 naming)
prisma/
  schema.prisma
  seed.ts                   admin user + wire/screws/inverter fixtures + two sites
  migrations/
backups/                    manual dev.db copies (gitignored)
```

**Permissions live in one place: [src/lib/permissions.ts](src/lib/permissions.ts).** Roles are *workspaces*, not levels — FINANCE receives stock and cannot issue it; EMPLOYEE moves stock to and from sites and cannot receive it; ADMIN does everything. Every server action calls `requireCapability(...)` for itself: `proxy.ts` route-gating and the filtered nav are convenience only, because a server action can be invoked regardless of what the page rendered.

## 7. Known Gaps / Suggested Next Steps

- **Not deployed yet** — local-only for now. **Decided: a real server behind real HTTPS on a proper domain, not serverless.** SQLite therefore stays and **no code changes are needed** for hosting. (Serverless would have forced a Postgres port: new datasource provider, a swapped driver adapter, and every migration regenerated, since the existing SQL is SQLite-specific — `PRAGMA`, the table-rebuild pattern, `TEXT` enums. Avoided.) See §9 for the deployment checklist.
- **Change the seeded passwords** — all three accounts (`admin`/`finance`/`employee`), not just admin — and consider adding a "change password" flow, since there isn't one yet.
- **⚠️ Test coverage stops at the pure modules, and the reason for deferring the rest has expired.** The 58 tests cover [allocation.ts](src/lib/allocation.ts), [corrections.ts](src/lib/corrections.ts), [matching.ts](src/lib/matching.ts), [dispatchPaste.ts](src/lib/dispatchPaste.ts) and [siteBalance.ts](src/lib/siteBalance.ts). **Everything that writes to the database has none**: [packs.ts](src/lib/packs.ts), `recordDispatch`, `recordDelivery`, and the whole site lifecycle. The subtlest code in the project is in there — `commitAllocation` resolves the planner's synthetic `new:<i>` pack ids onto rows it creates inside the same transaction. This was deferred on the grounds that "the app is not in real use until the remaining phases land"; **they have all landed**, and the untested surface grew with each one. This is now the single most valuable outstanding item.
- ✅ **Corrections exist** (Phase 3): a movement can be reversed — restoring the exact prior pack state, and refusing when the packs have moved on since — and a physical count can be recorded as an `ADJUSTMENT` with a mandatory reason. Both are `ADMIN`-only. A whole dispatch can be reversed atomically (Phase 4).
- ✅ **Existing items reviewed after the Phase 1 migration** (2026-08-20, during Phase 4). `CBL-200` and `SCR-M4` were the two that predated the pack model; both checked — see §9's Phase 4 note and §10's "State of the working copy". Any *new* item added later still needs `measure`, `packUnit` and `scrapThreshold` set correctly at creation, same as always.
- **Shelf tag codes are auto-generated and not editable** (`F1-1`, `B2-3`, etc., generated at shelf-creation time). If physical stickers don't match this scheme, either the seed logic needs adjusting or an edit-tag UI needs adding.
- **No file/photo attachments** on items or transactions — not requested, but a common ask for this type of tool.
- **No CSV export / reporting page** — dashboard covers the "what do we have / what's low / what's issued where" questions live, but there's no printable/exportable report yet.
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
Phases 7 (UI overhaul + mobile web) and 8 (hosting) remain, both deferred by decision.

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

### Deferred by decision: UI overhaul + mobile web (Phase 7), hosting (Phase 8)

Neither is started, and the app will not be in real use until the functional phases land.
Phases 2-6 therefore build **plain UI in the existing house style** — a later redesign would
discard any polish added now.

**Settled: this stays a web app.** No native Android app, so **no HTTP API is needed** — the
existing Next.js server actions are fine, and nothing about phases 2-6 has to change to
accommodate a mobile client. The Android work is browser optimisation on a phone, plus a
proper domain.

**Architectural note that outlives the redesign:** business logic stays out of components and
out of server actions. `allocation.ts` is pure and framework-agnostic; `packs.ts` takes a
transaction client and knows nothing about Next. A redesign then touches only markup.

**Mobile checklist for the overhaul** (recorded now so it is not rediscovered later):

- ✅ **Both batch screens were built card-per-row from the start** — the dispatch review
  (Phase 4) and the delivery grid (Phase 5), no table markup at all at any width, each
  confirmed at 375px with zero horizontal scroll and `inputMode="numeric"` on every number
  field. These were the two screens the checklist worried about, and neither needs
  retrofitting.
- `inputMode="numeric"` on the remaining quantity/length fields — the single-row
  [TransactionForm.tsx](src/components/TransactionForm.tsx) still lacks it. Summons the
  number keypad on Android instead of the full keyboard; trivial, and a large daily
  difference.
- Touch targets on the shelf grid cells and their popover, which are currently sized for a
  mouse.
- Keep the existing `overflow-x-auto` wrapper on every table; it is already the house pattern
  and is what stops wide tables breaking the page.
- `<datalist>` typeahead (used by the item pickers) works on Android Chrome — no replacement
  needed.
- Optional: a web app manifest makes it installable to the home screen with no other change.

### Deployment checklist (Phase 8) — real server, real HTTPS

SQLite stays; nothing in the code changes. What the server needs:

- `npm run build` + `npm start`. **Never `npm run dev` in production.**
- A process manager (systemd unit or pm2) so it survives reboots.
- TLS at a reverse proxy. Caddy is the least work — automatic Let's Encrypt issuance and
  renewal; nginx + certbot otherwise.
- **`DATABASE_URL` pointing at an absolute path outside the deploy directory**, e.g.
  `file:/var/lib/inventory/data.db`. Left as the current relative `file:./dev.db`, a redeploy
  that replaces the app folder destroys the entire inventory history.
- **`AUTH_TRUST_HOST=true`** — NextAuth v5 behind a reverse proxy otherwise rejects requests
  or builds wrong callback URLs. Environment variable only, no code change.
- A **fresh `AUTH_SECRET`**, not the development one.
- Change the seeded `admin@example.com` / `admin123` password before anyone else has access.
- A scheduled backup of the database file — the item most likely to be skipped, and the most
  expensive to have skipped.

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

## 10. Handover — Picking Up Phases 2-6

Written for whoever continues this next. Read in this order: **§1-§9 above**, then
**[REDESIGN-PLAN.md](REDESIGN-PLAN.md)**, then the four source files named below.

### Read these before touching anything

1. **[AGENTS.md](AGENTS.md)** — this is **not** the Next.js you may know. Version 16 renamed
   `middleware.ts` to `proxy.ts`, and Prisma 7 requires an explicit driver adapter. Read the
   bundled docs in `node_modules/next/dist/docs/` before writing framework code; do not go
   from memory.
2. **[REDESIGN-PLAN.md](REDESIGN-PLAN.md)** — all six phases, with per-phase verification
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

### State of the working copy

- **The database contains test data created while verifying Phases 1-6**, not real
  inventory: `WIRE-2.5` around 2430 m across sealed rolls and returned offcuts, `SCR-M4` 291,
  `CBL-200` 119, `INV-5K` 10; a reversed test dispatch, two test deliveries (one direct to
  Kandivali, one a claim replacement), a settled defective claim, and consumed/transferred
  material at Kandivali and Borivali. **Reseed or clear before real stock goes in.**
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

**All six functional phases are built.** The remaining work is Phases 7 (UI overhaul +
mobile web) and 8 (hosting), both deferred by decision — and one thing that is neither.

**Before this goes into real use, cover the DB layer with tests.** This is now the single
most valuable outstanding item, and the justification for deferring it has run out. The
argument was always "the app is not in real use until the remaining phases land" — they have
landed. Meanwhile the untested surface has grown considerably: `packs.ts` (including
`commitAllocation`'s synthetic `new:<i>` pack-id resolution, still the subtlest code in the
project), `recordDispatch`, `recordDelivery`, and the whole of Phase 6. The pure modules are
well covered at 52 tests; **everything that actually writes to the database has none**.

The other pre-live items, in rough order of cost-to-skip:

1. **A scheduled backup of `dev.db`** — cheapest thing in this document, most expensive to
   have skipped. Currently manual copies only.
2. **Change the seeded passwords** before anyone else has an account.
3. Phase 8's deployment checklist (§9), where `DATABASE_URL` pointing outside the deploy
   directory is the item that silently destroys all history if missed.

## 11. Related Documents

- **[REDESIGN-PLAN.md](REDESIGN-PLAN.md)** — the six-phase plan, with verification steps and, importantly, the alternatives that were rejected and why. **The main document for continuing work.**
- [inventory_management.md.txt](inventory_management.md.txt) — the original problem statement the project was built from.
- [storeroom-heavy-stock-plan.md](storeroom-heavy-stock-plan.md) — physical storage plan for heavy and humidity-sensitive stock (racking spec, VCI/sealed-case protection). Procurement and physical handling only; no bearing on the code.
