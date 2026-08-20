# Inventory Management System — Progress Handover

Last updated: 2026-08-20 (redesign phases 1-2 built — see §9)

> **§1-§8 describe the code as it stands today.** A six-phase redesign is under way;
> **phases 1-2 are built and folded in above**, phases 3-6 are not. §9 tracks what is still
> coming, and §10 is a handover guide for continuing it.

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
| Defective goods register | ✅ Done (returns only; deliveries in Phase 5) |
| Dashboard (totals, low-stock alerts, recent activity, suggestion panel) | ✅ Done |
| Shelf 2D map (front/back sides, box-type relabeling; contents derived from packs) | ✅ Done |
| Condition-based shelving (Fresh/Opened/Recyclable box types) | ✅ Done |
| Placement suggestions (usage-frequency based) | ✅ Done |
| Mobile-responsive layout | ✅ Done |
| Production build | ✅ Passes |
| Automated tests | ⚠️ 18 allocator unit tests (`npm test`); no coverage of the DB layer or UI |
| Roles: ADMIN / FINANCE / EMPLOYEE, capability-gated | ✅ Done (Phase 2) |
| Undo / stock adjustment | ❌ Phase 3 — **nothing can currently be corrected** |
| Bulk dispatch & delivery entry | ❌ Phases 4-5 |
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
- **Transaction** — type (`STOCK_IN` | `ISSUE` | `RETURN` | `OPEN_PACK` | `SCRAP`), quantity **always in the item's baseUnit**, item, optional site, user, note, timestamp, plus display-only `packSize`/`packCount`/`pieces` and a `defectiveQty` on returns.
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
    sites/                  list, new, [id] detail+edit+materials-on-site
    transactions/new/       Stock In / Issue / Return form
    shelf/                  list, new, [shelfId] 2D map, suggestions
    recycle/                offcuts below their item's scrap threshold
    defective/              damaged goods held for a supplier claim
    api/auth/[...nextauth]/ NextAuth route handler
  components/
    NavBar.tsx              top nav, shown only when logged in
    TransactionForm.tsx     client form: pack/pieces entry + the open-pack confirmation screen
    ShelfGrid.tsx           client component rendering the 2D shelf map (assign item, box type, front-row)
    NewShelfForm.tsx        client component: two-step shelf creation (size, then per-cell box type)
  lib/
    allocation.ts           PURE planner — best-fit cutting, opens, scrap. No DB, runs on both
                            server and client so the preview cannot disagree with the commit.
    allocation.test.ts      18 unit tests (`npm test`)
    packs.ts                DB side: recalcItemStock, openPack, commitAllocation, restock
    units.ts                pure formatting: formatStock, describeMovement, describeSlotContents
    auth.ts                 NextAuth config (credentials provider, JWT callbacks)
    prisma.ts               Prisma client singleton (with SQLite driver adapter)
    stock.ts                materialsAtSite() helper
    suggestions.ts          getPlacementSuggestions() — the frequency/placement engine
    boxTypes.ts             shared BOX_TYPES/BoxType
    actions/                server actions: items.ts, sites.ts, transactions.ts
                            (recordMovement, openPackAction), shelf.ts (updateSlotBoxType,
                            assignSlotItem)
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
- **Change the seeded admin password** and consider adding a "change password" flow — there isn't one yet.
- **Test coverage stops at the pure planner.** [allocation.ts](src/lib/allocation.ts) has 18 unit tests; [packs.ts](src/lib/packs.ts), which executes those plans against the database, has none. The subtlest code in the project lives there — `commitAllocation` resolves the planner's synthetic `new:<i>` pack ids onto rows it creates inside the same transaction. Deliberately deferred: the app is not in real use until the remaining phases land, so this is the thing to cover *before* it goes live, not now.
- **Nothing can be undone or corrected.** No delete, reverse, or adjust operation exists anywhere. Auto-scrap makes this sharper: a mistaken issue permanently writes off the offcut. Phase 3.
- **Existing items need reviewing after the Phase 1 migration** — everything defaulted to `DISCRETE`/no pack unit, which is right for screws and wrong for cable. Check `measure`, `packUnit` and `scrapThreshold` on each item.
- **Shelf tag codes are auto-generated and not editable** (`F1-1`, `B2-3`, etc., generated at shelf-creation time). If physical stickers don't match this scheme, either the seed logic needs adjusting or an edit-tag UI needs adding.
- **No file/photo attachments** on items or transactions — not requested, but a common ask for this type of tool.
- **No CSV export / reporting page** — dashboard covers the "what do we have / what's low / what's issued where" questions live, but there's no printable/exportable report yet.
- **npm audit** flags 3 high-severity issues, all in `prisma`'s own dev-time config-merging dependency (`deepmerge-ts`), not in runtime code — safe to ignore for now, but worth revisiting on the next `npm audit` pass since a fix will likely ship in a future Prisma release.
- **Shelf slot occupancy/quantity is transaction-driven, not manually editable** — see the design record in §8. Per-slot quantity is **not** reconciled against `Item.currentStock`; it is informational only.

## 8. Design Record — Condition-Based Shelving

*Consolidated here on 2026-08-20 from the former `condition-based-shelving-plan.md`, which was deleted because most of its decisions are being reversed and a standalone file would have contradicted the code.*

**Problem it solved.** The app had no concept of material *condition*, and an item could sit in at most one `ShelfSlot` in the whole system. In the real storeroom the same material splits into up to three physical groups — brand-new/unopened, opened/in-use, and recyclable scrap below a usable threshold (e.g. a wire offcut under ~15 m).

**Decisions taken (2026-08-19), as built:**

- **A fixed set of three box types**, not a configurable list: `FRESH`, `OPENED`, `RECYCLABLE`. Covers the real need without building admin UI for arbitrary box-type definitions.
- **One slot per item *per box type*** (`@@unique([itemId, boxType])`), relaxed from the original "one slot per item globally".
- **Box type is chosen per-cell at shelf-creation time** — [NewShelfForm.tsx](src/components/NewShelfForm.tsx) is two-step: size the grid, then click each cell to cycle its type.
- **No automated below-threshold rule.** Whether an offcut is "rarely useful" was judged a human call — staff decide and physically move it to the Recyclable box. No numeric field, no computed logic.
- **Slot occupancy is transaction-driven** (added same day, superseding an earlier version where staff typed quantities directly into slots). `applyTransactionToSlot()` in [transactions.ts](src/lib/actions/transactions.ts) applies a transaction's quantity as a delta to a chosen slot; Stock In and Return add, Issue draws down, a slot reaching zero empties itself. The shelf page offers only box-type relabeling and front-row marking. Per-slot quantity is informational and never reconciled against `Item.currentStock`.

**Status:** all of the above is built and working. The last three points are superseded by the planned work — see §9.

## 9. Redesign — Phase Status

A six-phase redesign is under way. **Phases 1 (packs, cut lengths, scrap) and 2 (roles) are built**; phases 3-6 (corrections, dispatch batch, delivery, site lifecycle) are not.

### Phase 1 — built 2026-08-20

- `Item.unit` → `baseUnit` + `packUnit`, plus `measure` (`CONTINUOUS`/`DISCRETE`) and `scrapThreshold`.
- **`PackStock`** — sealed packs grouped by size; two sealed 400 m rolls are interchangeable, so they are counted. A 400 m and a 600 m roll of the same wire are two sizes of one item, not two SKUs.
- **`OpenPack`** — opened packs tracked individually, because a 30 m and a 50 m offcut are *not* interchangeable.
- `Item.currentStock`/`scrapStock` are now a **cache**; `recalcItemStock()` in [src/lib/packs.ts](src/lib/packs.ts) is the only writer.
- **[src/lib/allocation.ts](src/lib/allocation.ts)** — pure planner. Best-fit (smallest pack that fits), longest pieces first, nothing opens without explicit approval, and a piece longer than any pack is a hard out-of-stock error rather than a prompt. 18 unit tests in [allocation.test.ts](src/lib/allocation.test.ts), run with `npm test`.
- Offcuts at or below `scrapThreshold` leave stock automatically and appear at `/recycle`. **Stock therefore drops by more than you issue** — cutting 340 m off a 350 m roll costs 350. That gap is measured waste, recorded as a `SCRAP` transaction.
- Returns carry an optional defective quantity → `/defective`, held for a supplier claim.
- **Shelf slots no longer store a quantity.** A box shows what its item's packs hold: Fresh → sealed, Opened → the open packs placed in it, Recyclable → scrap. `applyTransactionToSlot` is gone.

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

- **The 15-row dispatch grid (Phase 4) is the hard one.** A seven-column table does not work
  at 375px, and it is the screen employees will use most, most likely on a phone in a
  storeroom. It wants a card-per-row layout on narrow screens rather than a scrolling table —
  worth designing that way from the start, since retrofitting it is far more work.
- `inputMode="numeric"` on every quantity/length field — summons the number keypad on
  Android instead of the full keyboard. Trivial, and a large day-to-day difference.
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

### Still to come — what below will change

| Stated above | Changes to |
|---|---|
| §7: nothing can be undone or corrected | reversal + stocktake adjustment (Phase 3) |
| Stock-in is one row at a time | Excel-pasted dispatch batch (Phase 4) and delivery records (Phase 5) |
| Sites accumulate material forever | consumption, transfers, pickup flags (Phase 6) |

### Deviations from the Phase 1 plan, and why

Three things came up in the build that the plan had wrong:

1. **`STOCK_IN` stayed in the transaction form.** The plan removes it once the delivery grid lands (Phase 5). Doing that in Phase 1 left no way to add stock at all, so it stays — pack-aware, accepting a new pack size by typing it.
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

### The four invariants that must not be broken

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

- **The database contains test data I created while verifying Phase 1**, not real inventory:
  `WIRE-2.5` at 2000 m with a 10 m scrap offcut, `SCR-M4` at 291. Reseed or clear as needed.
- `CBL-200` and `SCR-M4` came through the Phase 1 migration as `DISCRETE` with no `packUnit`.
  Correct for screws, wrong for cable — **needs a human decision**, not a guess.
- Backups of `dev.db` are in `backups/` (gitignored). It is the only copy.

### Suggested order

Phases are numbered in dependency order and the plan explains why. Phase 2 (roles) is next and
is self-contained. **Phase 3 (corrections) matters more than its size suggests** — auto-scrap
means a mistaken issue now permanently destroys material, and there is currently no undo
anywhere in the app.

## 11. Related Documents

- **[REDESIGN-PLAN.md](REDESIGN-PLAN.md)** — the six-phase plan, with verification steps and, importantly, the alternatives that were rejected and why. **The main document for continuing work.**
- [inventory_management.md.txt](inventory_management.md.txt) — the original problem statement the project was built from.
- [storeroom-heavy-stock-plan.md](storeroom-heavy-stock-plan.md) — physical storage plan for heavy and humidity-sensitive stock (racking spec, VCI/sealed-case protection). Procurement and physical handling only; no bearing on the code.
