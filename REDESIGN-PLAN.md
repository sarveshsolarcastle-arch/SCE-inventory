# Packs & Cut Lengths · Role-Scoped Workspaces · Bulk Dispatch & Delivery

> **This is the working plan for phases 1-8. Phases 1-4 are built; 5-6 are not.**
> Read [PROGRESS.md](PROGRESS.md) first for current state, then this for what to build next.
>
> Everything here was decided in conversation with the user over a long session. **The
> rationale matters as much as the decisions** — several sections record alternatives that
> were tried and rejected for concrete reasons (the best-fit exception, sealed returns,
> per-SKU pack sizes, a dedicated `SITE_DELIVERY` type). Re-deriving those from first
> principles will land on the rejected answer, so read the reasoning before changing a rule.

## Context

Five problems, each reframing the next.

**1. Units are wrong at the root.** `Item.unit` is one string and `currentStock` one Int
([schema.prisma:50-52](prisma/schema.prisma:50)). But a wire *roll* is counted in ones and
twos while the wire is measured in metres; a screw *packet* likewise. The app can hold
"5 wire" and nobody can tell whether that's five rolls or five metres. Worse, one delivery
can bring a 400 m and a 600 m roll of the same wire.

**2. Every account sees every feature.** `recordTransaction` has *no* role check — any
signed-in user can stock in, issue, or return. [proxy.ts](src/proxy.ts) checks only that
you are logged in, never who you are.

**3. Dispatches to site are bulk, and come from a spreadsheet.** A site allocation is
**15+ different items**, pasted from Excel, holding item and quantity only. The single-row
form ([TransactionForm.tsx](src/components/TransactionForm.tsx)) cannot take them at all,
and `recordTransaction` ends in `redirect()`
([transactions.ts:130](src/lib/actions/transactions.ts:130)) so each one navigates away.

**4. Restocking trickles.** Deliveries arrive a few item types at a time as things run
out — cables today, something else tomorrow — not as one enormous challan.

> **Corrected mid-planning.** This plan originally assumed the opposite: huge deliveries,
> small withdrawals. That was wrong, and the correction matters — but note what it does
> *not* change. The original complaint was that stock-in **quantities** are huge, and huge
> quantity is a different problem from many line items. **Phase 1 solves the quantity
> problem**: 50 rolls of 400 m cable is *one row* (pack size 400, count 50). The multi-row
> delivery grid was answering a line-count problem that does not exist. So the delivery
> grid shrinks in importance and the **dispatch batch becomes the main event**.

**5. Material is sometimes delivered straight to a site**, never entering the store, and
only the opened leftovers come back. The app cannot express this — and worse, it actively
blocks it. `materialsAtSite` computes a site's holding as `ISSUE − RETURN`
([stock.ts:13](src/lib/stock.ts:13)), so material never issued from the office leaves the
site at **0**, and the return guard
([transactions.ts:85-98](src/lib/actions/transactions.ts:85)) refuses the leftovers
outright. Recording it as an ordinary stock-in is worse still: the store would show wire it
does not physically have, and reordering would be decided against stock sitting on a roof.

> **Status: Phases 1-4 are BUILT and verified (2026-08-20).** Phases 5-6 are not started.
> See "Phase 1 — as built" below for the three places reality diverged from this plan, and
> "Phase 4 — as built" for that phase's own deviations.

| Phase | Delivers |
|---|---|
| 1 | ✅ **DONE** — base units, packs, cut lengths, scrap, single-item issue with confirm |
| 2 | ✅ **DONE** — `ADMIN` / `FINANCE` / `EMPLOYEE` and capability gating |
| 3 | ✅ **DONE** — corrections: reversal and stocktake adjustment |
| 4 | ✅ **DONE** — Excel-pasted dispatch batch with review screen (employee) |
| 5 | delivery entry (finance), to the store **or direct to a site** |
| 6 | site material lifecycle — consumption, pickup, transfers, cross-site view |
| 7 | **UI overhaul + mobile web** — deferred; see below |
| 8 | **Hosting on a proper domain** — deferred; see below |

## Deferred: UI overhaul, mobile web, hosting (phases 7-8)

Deferred by the user, who will not use the app in anger until the functional phases are done.

**Settled: it stays a web app.** No native Android app — the Android requirement is the *web
app working well on a phone*. So **no HTTP API is needed**; Next.js server actions are fine
and nothing in phases 2-6 has to change to accommodate a mobile client.

**Build plain, not polished.** Phases 2-6 use the existing Tailwind house style and the
standard table/form shells, and stop. No animation, no bespoke components, no visual tuning —
it would be thrown away. Likewise no browser-verification overhead beyond proving a flow
works, and no new test scaffolding.

**Keep logic out of components.** The Phase 1 split is the pattern:
[allocation.ts](src/lib/allocation.ts) pure and framework-agnostic,
[packs.ts](src/lib/packs.ts) taking a transaction client and knowing nothing about Next,
server actions as thin wrappers. A redesign then touches only markup.

### Mobile checklist, recorded now

- **The 15-row dispatch grid (Phase 4) is the hard one.** A seven-column table does not work
  at 375px, and it is the screen employees use most — probably on a phone, in a storeroom.
  It wants a card-per-row layout on narrow screens, which is much cheaper to design in from
  the start than to retrofit. **This is the one mobile consideration that should influence
  Phase 4 as it is built, not be left to Phase 7.**
- `inputMode="numeric"` on every quantity/length field — number keypad instead of full
  keyboard on Android. Trivial change, large daily difference.
- Touch targets on the shelf grid cells and popover, currently mouse-sized.
- Keep the `overflow-x-auto` table wrapper — already the house pattern.
- `<datalist>` typeahead works on Android Chrome; no replacement needed.
- Optional: a web app manifest makes it installable to the home screen.

### Hosting: SETTLED — a real server with HTTPS

Decided with the user: a proper server behind real HTTPS, **not serverless**.

**This means SQLite stays and there are no code changes.** The Postgres migration that
serverless would have forced — new datasource provider, swapped driver adapter, and
*every migration regenerated* because the existing SQL is SQLite-specific — is not needed.
That also removes the pressure to decide before Phase 4; deployment can genuinely wait.

Checklist for when it happens (Phase 8):

- Run `npm run build` + `npm start`, **never `npm run dev`** in production.
- A process manager (systemd unit or pm2) so it survives reboots.
- TLS at a reverse proxy — Caddy is the least work, since it obtains and renews Let's
  Encrypt certificates automatically; nginx + certbot otherwise.
- **`DATABASE_URL` must point at an absolute path outside the deployment directory** — e.g.
  `file:/var/lib/inventory/data.db`. Left as the current relative `file:./dev.db`, a redeploy
  that replaces the app folder takes the entire inventory history with it.
- **`AUTH_TRUST_HOST=true`** — NextAuth v5 behind a reverse proxy rejects requests or builds
  wrong callback URLs without it. Env var only, no code change.
- A **fresh `AUTH_SECRET`** for production, not the development one.
- Change the seeded `admin@example.com` / `admin123` password before anyone else has access.
- A scheduled backup of the database file. This is the item most likely to be skipped and
  the most expensive to have skipped.

**Why corrections come third.** Nothing in the app can currently be undone — no `delete`,
`reverse` or `adjust` operation exists anywhere. That is survivable at one row per person,
and stops being survivable the moment one paste commits fifteen rows. Auto-scrap sharpens
it further: a mistaken issue *permanently destroys* the offcut, and deleting a row would not
bring it back. So the safety net goes in **before** the tools that can create big mistakes.

**Calibration:** dispatches and deliveries both run roughly **weekly**, not daily. Fifteen
items a week is modest volume — build both flows correctly, but do not gold-plate for
throughput. Paste earns its place because the list *originates* in Excel, not because of
volume.

---

## The units model

### Sealed and opened packs are different kinds of thing

Two sealed 400 m rolls are **interchangeable** — counting them loses nothing. Two opened
rolls are **not**: one holds 30 m, one holds 50 m, and which you reach for is the whole
question. Pooling opened stock destroys exactly the information needed to answer *"can I
cut 60 m?"*

So: **sealed packs stay grouped by size; opened packs get individual rows.** That stays
cheap because you only ever have a handful of open rolls — the bulk of stock is sealed,
and sealed stays grouped.

```
Wire 2.5mm
  sealed:  400m × 3,  600m × 2     ← grouped, fungible
  opened:  [50m] [30m] [20m]       ← individual, each a physical roll
```

### Continuous vs discrete

The two motivating examples behave oppositely:

| | 60 from `{30, 20, 10}` | Satisfiability reads |
|---|---|---|
| **Wire** (continuous, m) | impossible — needs one length | the **largest** row |
| **Screws** (discrete, pcs) | fine — pour together, count 60 | the **sum** of rows |

One `OpenPack` model serves both. Discrete items auto-merge their rows (genuinely
fungible); continuous items keep them separate. The `measure` flag changes only `max` vs
`sum`, not the schema.

### Cut lengths

For continuous items a bare quantity is ambiguous — 200 m could be one run or four 50 m
runs, with completely different answers. **Decision: a bare number means one continuous
piece.** Pieces are pieces only when entered as pieces (`50 m × 4`).

If no single roll can supply a requested piece — 500 m wanted, largest roll 400 m — that
is a **hard out-of-stock error**. Wire is not joined to make up a run.

**A dispatch line may instead be whole sealed rolls.** Confirmed with the user: some jobs
take cut lengths, others take an uncut roll to be cut on site. So a continuous row carries
*either* cut pieces, *or* a count of sealed rolls, *or* both — and whole rolls bypass the
allocator entirely, exactly as direct-to-site deliveries do.

### Opening a pack is always a deliberate act

**Nothing opens automatically.** When a request cannot be met from already-open rolls, the
app stops, shows what it would have to do, and waits for someone to click.

This is friction on purpose. The ground team asks for "150 m", the app answers *"no open
roll can give 150 m — this needs opening a sealed 400 m roll, leaving 250 m open"*, and
that is the moment they realise they actually wanted **two 75 m runs**, which the offcuts
already cover. Opening silently would have burned a fresh roll and never surfaced the
question. The prompt is where waste gets prevented, so it must not be skippable.

Three outcomes rather than two:

| Situation | Behaviour |
|---|---|
| Open rolls can cover it | proceeds directly, no prompt |
| Needs a sealed pack opened | **stop and confirm**, showing the plan and its cost |
| No single pack could *ever* supply the piece | hard out-of-stock error |

**At batch scale the prompt becomes a screen, not a modal.** A dispatch is 15+ rows, so
several may each need a roll opened — sequential popups would be unusable, and would
destroy the reconsideration the prompt exists for, since nobody deliberates over row 12 in
a queue. Instead the whole batch is planned at once and reviewed in one table, rows needing
an open flagged and editable in place. Seeing *"this job will open four fresh rolls"* in one
view makes the cost more visible than any sequence of popups. Since dispatch is now the
primary workflow, this screen is what employees look at every time.

### Allocation: best-fit, no exceptions

**Always cut from the smallest open roll that fits.** An earlier draft added "…unless that
leaves a sub-threshold stub, then use the next roll up". That is wrong and was rejected —
traced on `{50, 30, 20}`, threshold 15, needing 25 m:

| | With the exception | Best-fit always |
|---|---|---|
| Picks | skips the 30, cuts the 50 | cuts the 30 |
| Leaves | `{30, 25, 20}` — three rolls, the 30 never touched | `{50, 20}`, 5 m written off |

The exception grows the open pile forever and never consumes small rolls. Best-fit works
*because* scrap is auto-removed behind it.

### Scrap threshold

Per-item, human-set, **continuous items only** (15 m of wire is useless; 15 m of sleeve is
not; three loose screws are still three screws — discrete items have no threshold at all).

At or below the threshold, an offcut **stops being stock**: excluded from totals, moved to
the recycle list automatically. A remainder of exactly `0` is not scrap — the roll is
simply used up and its row goes.

> This **reverses** the decision recorded in `condition-based-shelving-plan.md`
> ("No automated below-threshold rule… staff decide"). Deliberate: back then `currentStock`
> was a single number with no concept of an offcut, so there was nothing to automate
> against. Now there is. Nothing is deleted — a scrapped roll keeps its row, reclassified,
> so the recycle list is a query and maps onto the existing `RECYCLABLE` box type.

**Consequence to be aware of:** cutting 390 m off a 400 m roll at a 15 m threshold drops
total stock by **400**, not 390. Stock arithmetic will not tie out to "issued = removed".
That gap is *measured waste*, recorded as its own `SCRAP` event — it answers how much wire
is lost to offcuts, on which items, and whether a threshold is set sensibly.

---

# Phase 1 — Base units, packs, cut lengths, scrap ✅ BUILT

> **As built, 2026-08-20.** Migration `20260820140000_packs_units_scrap_defects` applied
> (hand-edited to rename `unit` → `baseUnit` rather than drop it, and to seed one `OpenPack`
> per item from existing stock). Files added: [allocation.ts](src/lib/allocation.ts) (pure
> planner), [allocation.test.ts](src/lib/allocation.test.ts) (18 tests, `npm test`),
> [packs.ts](src/lib/packs.ts) (DB executor), [units.ts](src/lib/units.ts) (formatting),
> `/recycle`, `/defective`. `applyTransactionToSlot` and `ShelfSlot.quantity` deleted.
> Verified in the browser: two pack sizes under one SKU (`3×400 + 2×600 sealed` = 2400 m);
> the open prompt firing and picking the 400 not the 600; issuing 340 m dropping stock by
> **350** with the 10 m offcut landing in `/recycle`; the invariant holding for all items.
>
> **Three deviations from what is written below:**
>
> 1. **`STOCK_IN` was NOT removed from the transaction form.** This plan drops it in Phase 5
>    when the delivery grid arrives. Removing it here left *no way to add stock at all*, so
>    it stays — now pack-aware, and a pack size new to an item is entered by typing it.
> 2. **Assigning an item to an Opened/Recyclable box adopts its unplaced packs.** Nothing
>    else ever set `OpenPack.shelfSlotId`, so without this those boxes stay permanently
>    empty. `assignSlotItem` in [shelf.ts](src/lib/actions/shelf.ts) does the adoption.
> 3. **Empty boxes name the missing condition** — "no sealed packs" / "nothing open here"
>    rather than "empty", which read as though the item had no stock when it had none *of
>    that kind*.
>
> Also: `previewIssue` was written and then deleted — the form runs the pure planner
> client-side instead, so a server round-trip per keystroke was never needed.

## Schema — [prisma/schema.prisma](prisma/schema.prisma)

```prisma
enum MeasureType { CONTINUOUS  DISCRETE }
enum PackState   { OPEN  SCRAP }

model Item {
  baseUnit       String      @default("pcs")   // renamed from `unit`: m, pcs
  packUnit       String?                       // "roll", "packet"; null = not packaged
  measure        MeasureType @default(DISCRETE)
  scrapThreshold Int?                          // CONTINUOUS only; null for DISCRETE
  currentStock   Int         @default(0)       // cached: sealed + usable open, excludes scrap
  scrapStock     Int         @default(0)       // cached: sum of SCRAP rows
  minStock       Int         @default(0)       // base units
  sealedPacks    PackStock[]
  openPacks      OpenPack[]
}

model PackStock {                               // sealed, fungible, grouped by size
  id          String @id @default(cuid())
  item        Item   @relation(fields: [itemId], references: [id])
  itemId      String
  packSize    Int
  sealedCount Int    @default(0)
  @@unique([itemId, packSize])
}

model OpenPack {                                // opened, individual
  id           String    @id @default(cuid())
  item         Item      @relation(fields: [itemId], references: [id])
  itemId       String
  remaining    Int
  originalSize Int?
  state        PackState @default(OPEN)
  openedAt     DateTime  @default(now())
  @@index([itemId, state])
}
```

## Shelf contents derived from packs

`ShelfSlot.quantity` is maintained by `applyTransactionToSlot`
([transactions.ts:15-50](src/lib/actions/transactions.ts:15)) and is already "informational,
not reconciled" (`PROGRESS.md` §7). Carrying that forward would make it worse, because the
15-row dispatch batch skips slots entirely — the highest-volume operation would never update
them. So the shelf map stops being maintained and starts being **derived**.

The split follows the same fungible-vs-individual line as the rest of the model:

| Box type | Slot shows | Why |
|---|---|---|
| `FRESH` | the item's `PackStock` totals | sealed packs are **fungible** — which sealed roll sits in which box is not a real question |
| `OPENED` | the `OpenPack` rows assigned to that slot | an opened roll is an **individual physical object**, so it can name its box |
| `RECYCLABLE` | that item's `SCRAP` rows | same — individual offcuts |

So `OpenPack` gains `shelfSlotId String?`, set when a pack is opened ("which box did you put
it in?") or from the shelf page. `ShelfSlot.itemId` **stays** — which item lives in a box is
a physical placement fact, not derivable — but `ShelfSlot.quantity` is **deleted**.

What this removes: `applyTransactionToSlot` entirely, the `shelfSlotId` field on every
transaction form, the per-row slot dropdown from the delivery grid, and the "no two rows may
target the same slot" validation that dropdown required. **Net less code than carrying the
old behaviour forward**, and the shelf map becomes correct by construction rather than
correct-if-everyone-remembers-to-pick-a-slot.

An item occupying two `FRESH` slots shows the same aggregate on both, flagged as split
across boxes. That is a real loss of precision and an acceptable one: sealed packs of a size
are interchangeable, so "how many are in *this* box" has no operational answer worth storing.
Removing `@@unique([itemId, boxType])` is still required so an item *can* hold two boxes of
one condition.

## Defective goods

Structurally the same shape as scrap — physically present, **not counted as stock** — but it
cannot reuse `PackState`, because **scrap is always a partial length while a defective item
can be a whole sealed pack**. A supplier sends three rolls and one is visibly damaged: that
roll is sealed *and* defective, and `OpenPack` only represents opened material. So it gets
its own record, able to hold either sealed packs or a loose quantity:

```prisma
enum DefectSource { DELIVERY  RETURN }         // store-found defects ruled out with the user
enum DefectStatus { QUARANTINED  CLAIMED  REPLACED }

model DefectiveItem {
  id            String       @id @default(cuid())
  item          Item         @relation(fields: [itemId], references: [id])
  itemId        String
  quantity      Int                            // base units
  packSize      Int?                           // set when it is whole sealed packs
  packCount     Int?
  source        DefectSource
  delivery      Delivery?    @relation(fields: [deliveryId], references: [id])
  deliveryId    String?                        // arrived damaged
  transaction   Transaction? @relation(fields: [transactionId], references: [id])
  transactionId String?                        // the RETURN that brought it back
  site          Site?        @relation(fields: [siteId], references: [id])
  siteId        String?
  status        DefectStatus @default(QUARANTINED)
  replacedBy    Delivery?    @relation("Replacement", fields: [replacedByDeliveryId], references: [id])
  replacedByDeliveryId String?                 // the delivery that made good on the claim
  note          String?
  reportedAt    DateTime     @default(now())
  user          User         @relation(fields: [userId], references: [id])
  userId        String
  @@index([itemId, status])
}
```

**The two sources behave differently, deliberately:**

- **On a delivery, defective goods never enter stock at all.** Ten arrive, two are damaged →
  the delivery records **8 good and 2 defective**. Nothing is added and then removed, so
  stock is never briefly inflated by goods that were never good. No `Transaction` is written
  for the defective portion, because it never became stock.
- **On a return, the `RETURN` still fires** so the *site's* balance is correct — the material
  really did leave the site — but the defective portion becomes a `DefectiveItem` instead of
  an `OpenPack`, so `currentStock` does not rise. A partial case is normal (40 m back, 10 m
  of it damaged), so `Transaction.defectiveQty Int?` records the quarantined portion of a
  return; the good remainder (`quantity − defectiveQty`) becomes an `OpenPack` as usual.

Replacements arrive as **an ordinary delivery** — one path for everything that arrives — with
the defective row marked `REPLACED` and linked via `replacedByDeliveryId`, so an unfulfilled
claim is a query rather than someone's memory.

New page **`/defective`**: quarantined goods grouped by item, showing source, age, and claim
status, so finance can chase what suppliers owe. Kept separate from `/recycle` because the
workflows differ — scrap gets disposed of, defects get claimed.

Capabilities: `defect:flag` for `FINANCE` and `EMPLOYEE` (whoever is receiving the goods),
`defect:resolve` for `FINANCE` and `ADMIN` (chasing the supplier is finance's job).

**Invariants**, both maintained by one helper `recalcItemStock(tx, itemId)`:

```
currentStock = Σ(packSize × sealedCount) + Σ(OpenPack.remaining where state = OPEN)
scrapStock   =                             Σ(OpenPack.remaining where state = SCRAP)
```

`PackStock` and `OpenPack` are the truth; both `Item` columns are caches, kept only so the
existing low-stock queries ([dashboard/page.tsx:17](src/app/dashboard/page.tsx:17),
[items/page.tsx:67](src/app/items/page.tsx:67)) keep working untouched. Exactly one
function writes them, so there is a single place to prevent drift.

## Transaction changes

`Transaction.quantity` **stays in base units, always** — the constraint that keeps
`materialsAtSite` ([stock.ts:13](src/lib/stock.ts:13)), the ISSUE/RETURN guards and the
suggestion ranking working unchanged. Add `packSize Int?` / `packCount Int?` (how it was
entered, display only) and `pieces String?` (JSON `[{length, count}]`).

Two new `TransactionType` members:

| | quantity | Δ `currentStock` | meaning |
|---|---|---|---|
| `OPEN_PACK` | pack size | **0** | sealed → open |
| `SCRAP` | remainder | **−remainder** | open → recycle, at/below threshold |

Safe against existing readers: [stock.ts:6](src/lib/stock.ts:6) and
[suggestions.ts:27](src/lib/suggestions.ts:27) both filter by type explicitly, so neither
sees them; the dashboard's Recent Activity will, which is wanted.

## New — [src/lib/units.ts](src/lib/units.ts)

Pure, no DB, usable from server and client:
`totalBase()`, `formatQuantity(item, base)` → `"2740 m"`,
`formatStock()` → `"3×400 m + 2×600 m sealed · 50/30/20 m open"` (or `"12 pcs"` when
`packUnit` is null), `describePieces()` → `"4 × 50 m"`.

## New — [src/lib/packs.ts](src/lib/packs.ts)

All take a `Prisma.TransactionClient`.

- `recalcItemStock(tx, itemId)` — recomputes both cached columns.
- `addPacks(tx, itemId, packSize, count)` — `upsert` on `[itemId, packSize]`.
- `settle(tx, openPack, userId)` — after a cut: `remaining == 0` → delete the row;
  `0 < remaining <= scrapThreshold` → `state = SCRAP` + log `SCRAP`; else leave `OPEN`.
- **`planAllocation(item, openPacks, sealedPacks, request)` — pure, no DB, no writes.**
  The heart of the design. Returns:
  ```ts
  { cuts:   { openPackId, length, remainderAfter }[],
    opens:  { packSize, count }[],      // sealed packs that WOULD need opening
    scrap:  { length }[],               // remainders that would fall at/below threshold
    impossible?: { length, largestAvailable } }
  ```
  Continuous: pieces longest first, each taking the `OPEN` row with the *smallest*
  `remaining` that still fits; if none fits, record the smallest sealed size `>= length`
  in `opens` (and reason about it as open for later pieces); if no sealed size fits either,
  set `impossible`. Discrete: draw from the merged open row, adding `opens` when short; no
  scrap. **Whole sealed rolls in the request bypass all of this** — they are decremented
  directly and never appear in `cuts`, `opens` or `scrap`.
  Because it is pure, the same function drives the review screen, the tests, and the
  commit — the preview cannot drift from what actually happens. It also runs **client-side**
  (the page ships the item's packs to the browser), so a batch re-plans instantly as rows
  are edited, with the server re-planning authoritatively at commit.
- `planBatch(itemsById, packsByItem, rows[])` — threads a **simulated inventory** through
  the rows in order, so rows compete for stock exactly as they will in reality. Without
  this, two rows would each be told they can have the same 95 m roll. A consequence worth
  knowing: editing row 3 can change row 11's plan, so the whole batch re-plans on any edit —
  cheap, because the function is pure and in-memory.
- `openPack(tx, itemId, packSize, userId)` — the **only** thing that opens a pack.
  Decrement `sealedCount`, create the `OpenPack`, log `OPEN_PACK`. Called from the explicit
  confirm and from a standalone "Open a pack" button on the item page — never implicitly.
- `commitIssue(tx, item, request, approvedOpens, userId)` — re-runs `planAllocation`
  **inside the transaction** against freshly-read rows, then applies it. If the fresh plan
  needs opens beyond `approvedOpens` — because someone else drew stock between preview and
  submit — it aborts and re-prompts rather than opening a roll nobody agreed to.

## UI in this phase

- **Item forms** ([items/new](src/app/items/new/page.tsx),
  [items/[id]](src/app/items/[id]/page.tsx)) gain `baseUnit`, `packUnit`, `measure`, and
  `scrapThreshold` (shown only when `measure = CONTINUOUS`).
  **Drop the "Starting stock" field** ([items/new/page.tsx:15-20](src/app/items/new/page.tsx:15)) —
  it writes `currentStock` with no `Transaction` row, so seeded stock has no audit trail,
  and `updateItem` omits `currentStock` ([items.ts:54](src/lib/actions/items.ts:54)) so it
  can never be corrected. Stock comes from a delivery instead, auditably.
- **[TransactionForm.tsx](src/components/TransactionForm.tsx)** — for a continuous item,
  a repeatable `length × count` pieces editor **plus** a separate "whole sealed rolls" count
  (some jobs take an uncut roll); a bare quantity is submitted as one piece. For discrete, a
  single quantity as today.
  **Submitting runs `planAllocation` first and shows the result before anything is written.**
  When the plan needs no opens it commits straight away. When it does, the form switches to
  a confirmation state spelling out the cost — *"No open roll can provide 150 m. This will
  open a sealed 400 m roll, leaving 250 m open. Your open rolls: 50 m, 30 m, 20 m."* — plus
  any scrap the cut would create, with **"Open the roll and issue"** and **"Go back and
  revise"** side by side. Revise is the point of the screen, so it is not a secondary
  action. The approved opens ride along with the submit so `commitIssue` can verify nothing
  changed underneath.
  **Returns are always offcuts** — confirmed with the user that nothing unopened ever comes
  back from a site, so there is no sealed-return path, no checkbox and no length-matching
  guess. A return reuses the same `length × count` editor (several offcuts can come back at
  once); each length becomes its own `OpenPack`, going straight to `SCRAP` if at/below
  threshold. Discrete returns pool into the merged open row. The existing "cannot return
  more than what's currently at the site" guard
  ([transactions.ts:93](src/lib/actions/transactions.ts:93)) works unchanged, comparing
  base-unit totals.
  **Each returned line carries an optional "defective" quantity** — a small field, since most
  returns are fine. It must not exceed the returned quantity. The defective portion goes to
  `DefectiveItem` (source `RETURN`), the rest becomes an `OpenPack`.
- **Item page** gains an explicit **"Open a pack"** button (choose the size), for when the
  storeman opens a roll at the shelf rather than as part of an issue. Same `openPack`
  helper, same `OPEN_PACK` record.
- **New `/recycle`** — scrapped offcuts grouped by item, with totals. Suggests the
  `RECYCLABLE` slot, matching how [/shelf/suggestions](src/lib/suggestions.ts) advises
  rather than acts.

## Call sites to update (10, across 8 files)

`unit` → `baseUnit`, stock rendering → `formatStock`:
[suggestions.ts:7,79](src/lib/suggestions.ts:7),
[dashboard/page.tsx:50](src/app/dashboard/page.tsx:50),
[items/page.tsx:95](src/app/items/page.tsx:95),
[items/[id]/page.tsx:36,88](src/app/items/[id]/page.tsx:36),
[sites/[id]/page.tsx:69](src/app/sites/[id]/page.tsx:69),
[TransactionForm.tsx:6](src/components/TransactionForm.tsx:6),
[transactions.ts:81,95](src/lib/actions/transactions.ts:81),
[items.ts:22,45](src/lib/actions/items.ts:22).

## Migration

`prisma migrate dev --create-only`, then hand-edit before applying:

```sql
-- existing stock has no pack history; treat it all as one open pack per item
INSERT INTO "OpenPack" ("id","itemId","remaining","state","openedAt")
SELECT lower(hex(randomblob(16))), "id", "currentStock", 'OPEN', CURRENT_TIMESTAMP
FROM "Item" WHERE "currentStock" > 0;
```

`MeasureType`, `PackState` and the new `TransactionType` members are `TEXT` + `CHECK`
under SQLite, so those tables rebuild — verify the generated SQL preserves rows.
Validate on save that `scrapThreshold < min(packSize)`, or a delivery would scrap itself
on arrival.

**Migration risk is low but not zero.** The database currently holds demo data only —
verified: 2 items, 8 transactions, 1 user, 1 shelf with 40 slots (2 occupied), 1 site. Still,
**take a copy of `dev.db` before migrating**; it is the only one.

Every existing item defaults to `measure: DISCRETE` with all its stock as a single
`OpenPack`. That is right for screws and wrong for wire, so **review both existing items
after migrating** and set `measure`, `packUnit` and `scrapThreshold` by hand. At two items
this is a two-minute job; it would not be at two hundred.

---

# Phase 2 — Roles and workspaces ✅ BUILT

> **As built, 2026-08-20.** Migration `20260820150000_roles_finance_employee` (hand-edited to
> map `STAFF` → `EMPLOYEE`; Prisma's diff copies the column verbatim, which would leave rows
> holding a value the client cannot decode — and SQLite stores enums as plain TEXT, so that
> fails at *read* time rather than at migration time, which is worse).
> [permissions.ts](src/lib/permissions.ts) added; the `requireAdmin` helper deleted from all
> three action files. `proxy.ts` gates routes, `NavBar` filters links, the dashboard offers
> only the actions a role holds, and the seed creates one account per role.
>
> **Verified:** finance sees no "Issue / Return" and is bounced from `/transactions/new` and
> `/sites/new`; employee is bounced from `/items/new`. Critically, the item page's "Open a
> pack" button was *rendered* for finance and the server **still rejected the action** with
> `NotPermittedError(stock:issue)`, stock unchanged — proving the guard is the action, not
> the hidden button. The button is now also hidden, for UX rather than safety.
>
> Seeded accounts: `admin@example.com` / `admin123`, `finance@example.com` / `finance123`,
> `employee@example.com` / `employee123`.
>
> **Deviation:** `HOME_FOR_ROLE` points every role at `/dashboard` rather than separate
> landing pages — the dashboard already reshapes itself per role, so separate homes would
> add a redirect without adding anything.

`Role` becomes `ADMIN | FINANCE | EMPLOYEE`. Role is already in the JWT
([auth.ts:31-43](src/lib/auth.ts:31)), so route gating needs no DB query — the plumbing
exists and is unused. Hand-edit the migration to add, before the constraint rebuild:

```sql
UPDATE "User" SET "role" = 'EMPLOYEE' WHERE "role" = 'STAFF';
```

## New — [src/lib/permissions.ts](src/lib/permissions.ts)

```ts
export type Capability =
  | "delivery:record" | "stock:issue" | "stock:return" | "stock:consume"
  | "stock:transfer" | "site:pickup" | "item:manage" | "site:manage" | "shelf:manage"
  | "ledger:view" | "defect:flag" | "defect:resolve"
  | "stock:reverse" | "stock:adjust";        // ADMIN only — these rewrite history

const CAPABILITIES: Record<Role, Capability[]> = {
  ADMIN:    [/* all */],
  FINANCE:  ["delivery:record", "item:manage", "ledger:view",
             "defect:flag", "defect:resolve"],
  EMPLOYEE: ["stock:issue", "stock:return", "stock:consume", "stock:transfer",
             "site:pickup", "ledger:view", "defect:flag"],
};
export function can(role, capability): boolean
export async function requireCapability(capability)   // throws
export const HOME_FOR_ROLE: Record<Role, string>
```

`requireCapability` replaces the `requireAdmin` helper copy-pasted verbatim into
[items.ts:8](src/lib/actions/items.ts:8), [sites.ts:8](src/lib/actions/sites.ts:8) and
[shelf.ts:9](src/lib/actions/shelf.ts:9) — delete all three.

## Enforcement, three layers

1. **[proxy.ts](src/proxy.ts)** — route→capability table in the existing `auth()` wrapper;
   redirect to `HOME_FOR_ROLE` on a miss.
2. **Every server action** — `requireCapability(...)` as the first line. **The layer that
   matters**: `proxy` guards pages, not action endpoints, and actions are directly
   invocable. `recordTransaction` gets a *type-dependent* check (`ISSUE` → `stock:issue`,
   `RETURN` → `stock:return`, `STOCK_IN` → `delivery:record`) so finance cannot POST an issue.
3. **UI** — `NavBar` filters links; pages hide action buttons.

| | Finance | Employee | Admin |
|---|---|---|---|
| Dispatch to site (Excel batch) | — | ✅ | ✅ |
| Returns · Site-to-site transfer | — | ✅ | ✅ |
| Deliveries · Record | ✅ | view | ✅ |
| Mark consumed · Flag for collection | — | ✅ | ✅ |
| Material at Sites view | view | ✅ | ✅ |
| Flag defective goods | ✅ | ✅ | ✅ |
| Chase / resolve supplier claims | ✅ | — | ✅ |
| Items | ✅ + create | view | ✅ |
| Sites · Shelf · Recycle | view | view | ✅ |
| **Reverse · Adjust stock** | — | — | ✅ |

The employee side is now the **heavier** half: dispatch is the batch tool with allocation
planning, while finance's delivery entry is comparatively plain. The separation is still
real — neither can perform the other's action.

[dashboard/page.tsx](src/app/dashboard/page.tsx) becomes one role-scoped landing page:
shared stat cards and low-stock list, then a branch — finance gets recent deliveries and
"Record delivery", employees get "New dispatch" / "Record return". `StatCard`
([dashboard/page.tsx:132](src/app/dashboard/page.tsx:132)) and the Recent Activity table
are reused as-is.

**Extend [seed.ts](prisma/seed.ts) — it currently seeds *only* an admin user**, no items and
no sites, so none of the verification steps below can run against a fresh database as
written. Seed one account per role, plus a small fixture set: a continuous item (wire, with
pack sizes and a threshold), a discrete packaged item (screws), and an unpackaged one (an
inverter), plus two sites. The verification numbers throughout this document assume those
fixtures.

---

# Phase 3 — Corrections: reversal and adjustment ✅ BUILT

> **As built, 2026-08-20.** Migrations `20260820160000_corrections` and
> `20260820161000_reversed_at`. New [corrections.ts](src/lib/corrections.ts) (pure: the
> AppliedPlan record and `findReversalObstacles`), [actions/corrections.ts](src/lib/actions/corrections.ts),
> and [CorrectionPanel.tsx](src/components/CorrectionPanel.tsx). 10 more unit tests, 28 total.
>
> **Verified:** an ISSUE that opened a 400 m roll and cut 120 m (leaving `1×400 + 2×600
> sealed · 280 m open`, 1880 m) reversed back to `2×400 + 2×600 sealed`, 2000 m exactly —
> the open pack deleted and the sealed roll restored, *not* a compensating +120 m that would
> have left a stray open pack. The original ISSUE shows as "reversed" with a REVERSAL row
> above it; nothing is deleted.
>
> **Deviations:**
> 1. **A scalar `Transaction.reversedAt` mirrors the `reversedBy` relation.** Prisma's
>    `groupBy` does **not** accept relation filters — `reversedBy: null` throws there, which
>    broke the placement suggestions. Aggregations filter on the scalar.
> 2. **`REVERSAL` and `ADJUSTMENT` are distinct transaction types**, and neither can itself
>    be reversed — record a further correction instead.
> 3. **A reversed movement is excluded from aggregation rather than cancelled by an opposing
>    row.** `materialsAtSite` and the suggestion ranking filter `reversedAt: null`, so a
>    reversed issue vanishes from a site balance instead of netting to zero.
> 4. **Movements recorded before this phase are not reversible** — they carry no
>    `appliedPlan`, so the UI offers no Reverse control and the action refuses with a message
>    pointing at adjustment. Correct, and worth knowing when testing against old data.

Two different problems that are easy to conflate, and must not be:

| | Means | Restores |
|---|---|---|
| **Reversal** | "this was recorded in error — it never happened" | the exact prior state |
| **Adjustment** | "the shelf and the app disagree — the shelf is right" | nothing; it records a new truth |
| *(Return)* | "it happened, and now it's coming back" | already exists — normal return flow |

A reversal must put the 75 m back *on the roll it came off*. A return creates a new 75 m
offcut, because physically that is what comes back. Conflating them silently corrupts the
pack state.

## Reversal

`ADJUSTMENT` aside, nothing is ever deleted: reversal writes **compensating entries** and
marks the original as reversed, so the audit trail keeps both halves.

The hard part is packs. A dispatch that cut 75 m from a 95 m roll (leaving 20 m) and
scrapped a 5 m stub cannot be undone by negating quantities — it has to restore that roll to
95 m, un-scrap the stub, and possibly un-open a pack that was opened for it.

**So capture what was done.** `Dispatch` and `Delivery` (and single transactions) store the
applied plan as JSON — `appliedPlan String?` — recording every pack touched and its before
and after values.

**And refuse when the world has moved on.** Reversal first checks that every affected pack
still holds exactly what the plan left it with. If someone has cut that roll again since,
restoring it would invent wire that no longer exists — so the reversal is **rejected with an
explanation** pointing the user at an adjustment instead. Being honest about the limit is
what makes the safe path trustworthy.

`reverseTransaction` / `reverseDispatch` / `reverseDelivery` share one primitive:

```
verify appliedPlan still matches current state
  → restore OpenPack.remaining, PackStock.sealedCount, un-scrap SCRAP rows
  → write compensating transactions carrying a mandatory reason
  → mark the original reversed
  → recalcItemStock
```

Phase 3 builds the primitive plus **reverse a single transaction**; Phases 4 and 5 wire
"reverse this whole batch" on top when dispatches and deliveries exist. Capturing
`appliedPlan` from the start is what makes that possible — so `Transaction` carries
`appliedPlan String?` too, not just `Dispatch` and `Delivery`.

**Reversal must unwind everything a batch created, not just the stock.** A delivery can also
have produced `DefectiveItem` rows (Phase 5) and a return can have produced both defective
rows and `SCRAP`. Reversing has to delete those too, and must **refuse** if a defective row
has already moved past `QUARANTINED` — once a claim is filed with the supplier, the record is
no longer ours alone to erase.

## Adjustment

When the shelf holds 340 m and the app says 380 m there is currently **no legal way to make
them agree** — stock only moves through transactions — so someone will eventually invent a
fake issue to force it, corrupting the site consumption data. Your original brief names
*"Manual Stock Verification"* as problem #2, so this is arguably in the original scope.

With packs, "set the real quantity" is ambiguous — sealed or loose? So adjustment works at
**pack level**: the item page shows the current breakdown (`3×400 m sealed · 50/30/20 m
open`) with each number editable. On save the app computes the net delta, writes the pack
rows, and records **one `ADJUSTMENT` transaction with a mandatory reason**. Delta may be
negative or positive. Nothing is hidden: the ledger shows the correction as a correction.

New capabilities `stock:reverse` and `stock:adjust`, **`ADMIN` only** — these are the two
operations that can rewrite history, so they sit with the person accountable for it.

---

# Phase 4 — Dispatch to site, from Excel ✅ BUILT

> **As built, 2026-08-20.** Migration `20260820170000_dispatch_batch` applied (purely
> additive: new `Dispatch` table, nullable `Transaction.dispatchId` — no hand-editing
> needed). New [src/lib/matching.ts](src/lib/matching.ts) (Dice-coefficient matcher),
> [src/lib/dispatchPaste.ts](src/lib/dispatchPaste.ts) (paste parser),
> [src/lib/actions/dispatches.ts](src/lib/actions/dispatches.ts) (`recordDispatch`),
> [src/components/DispatchBatchForm.tsx](src/components/DispatchBatchForm.tsx),
> `/dispatches`, `/dispatches/new`, `/dispatches/[id]`. 13 more unit tests (matching +
> parsing), 41 total.
>
> **Verified in the browser:** a pasted sheet with a header row, an exact match
> (Screws M4), and a typo'd match ("wire 2.5mm sq" → suggested Wire 2.5mm², requiring an
> explicit "✓ Use" click before its quantity filled in — never silently accepted) all
> resolved correctly; a nonsense line came back "no match — pick manually" and blocked
> submit; the wire row correctly demanded approval to open a 400 m roll before submitting.
> Committing wrote two `ISSUE` rows sharing one `dispatchId`, cut the roll and pooled the
> screws exactly as `commitAllocation` does for a single-row issue. Reversing the dispatch
> (§ below) restored both items to their exact prior pack state in one action. The site
> page groups the dispatch into one "DISPATCH — 2 items" activity row instead of two loose
> lines. At 375px width the review screen has zero horizontal scroll — see the mobile note
> below.
>
> **Three deviations from what is written below:**
>
> 1. **The paste parser is its own file, [dispatchPaste.ts](src/lib/dispatchPaste.ts),
>    not folded into `matching.ts`.** `matching.ts` stayed scoped to *matching a name to
>    an item*, which is the part with real algorithmic content (Dice coefficient); parsing
>    TSV into `{name, quantity}` rows is a different, simpler concern, and splitting it
>    kept both files focused enough to unit-test independently.
> 2. **The review screen is a single card-per-row layout at every width, not a table that
>    becomes cards below a breakpoint.** The plan's mobile checklist called the 15-row grid
>    "the hard one" and asked for cards on narrow screens; maintaining two markup shapes
>    for the same data risked them drifting apart, so there is only one shape, and it never
>    needs a horizontal scroll wrapper at any width.
> 3. **Batch reversal writes one `REVERSAL` transaction per original `ISSUE` line, not a
>    single row.** The per-transaction reversal primitive from Phase 3
>    (`findReversalObstacles` / `applyInverse`) operates on one movement's `appliedPlan` at
>    a time, so there is no natural single-row representation of "undo 15 movements." What
>    was extracted instead is a shared `reverseMovementTx` helper
>    ([actions/corrections.ts](src/lib/actions/corrections.ts)) that `reverseTransaction`
>    and the new `reverseDispatch` both call, looped inside ONE `prisma.$transaction` for
>    dispatches so a mid-batch obstacle aborts the whole reversal rather than leaving it
>    half-undone. Every compensating `REVERSAL` row carries the same `dispatchId` as the
>    `ISSUE` it undoes, so the dispatch and site pages render it as one grouped event even
>    though the database holds N rows — satisfying "one reversal event in history" as a UI
>    property, not a schema one.
>
> **Also folded into this phase, per explicit request:** `CBL-200` ("Cable Tie 200mm") and
> `SCR-M4` (Screws M4) — flagged in §10 as needing human review after the Phase 1
> migration — were reviewed. `CBL-200` is a discrete plastic fastener, not continuous
> cable/wire despite its category "Cables"; `DISCRETE` with no `packUnit` is correct as
> migrated and was left unchanged. `SCR-M4` predates the `packUnit` field reaching its row
> — `seed.ts`'s `upsert` never updates an existing item, so it stayed `packUnit: null` even
> after the fixture definition specified `"packet"`. Corrected to `packUnit: "packet"` by
> direct field update (measure was already correctly `DISCRETE`); its existing loose
> `OpenPack` rows are untouched, since packUnit only governs how *future* deliveries are
> entered.

The primary daily workflow. A site allocation is **15+ items**, pasted from a spreadsheet
holding **item and quantity only** — no piece breakdown — so pieces are resolved on the
review screen, and only for continuous items.

## Schema — the dispatch document

Deliveries get a grouping record; dispatches must too. Without one, fifteen items sent on
Tuesday are fifteen unrelated `ISSUE` rows and the site page becomes a wall of movements
with no way to ask *"what went to Kandivali on the 3rd?"*

```prisma
model Dispatch {
  id           String        @id @default(cuid())
  reference    String?       // dispatch / challan number
  site         Site          @relation(fields: [siteId], references: [id])
  siteId       String
  dispatchedAt DateTime      @default(now())
  note         String?
  user         User          @relation(fields: [userId], references: [id])
  userId       String
  transactions Transaction[]
  @@index([dispatchedAt])
  @@index([siteId])
}
```

`Transaction` gets `dispatchId String?` + relation + index — optional, so existing rows stay
valid. Returns can later point at the dispatch they came from.

## Flow

**Paste → parse → match → plan → review → commit.** Nothing is written until the last step.

1. **Paste** into a textarea. Excel copies as TSV, so split on newlines and tabs; skip a
   header row when the first line looks like labels; tolerate extra columns and units in the
   quantity cell (`"150 m"` → `150`).
2. **Match** each name to an item — new [src/lib/matching.ts](src/lib/matching.ts). Exact SKU,
   then exact name, then fuzzy via Dice coefficient over character trigrams (~30 lines, no
   dependency, in keeping with the codebase's zero-library style). Score > 0.6 pre-fills as
   a *suggestion*; below that the row is *unmatched*; near-tied top scores are *ambiguous*.
   Suggestions and ambiguities are always shown for confirmation — never silently accepted.
3. **Plan** the whole batch with `planBatch`, so rows compete for stock realistically.
4. **Review** — the heart of the phase, below.
5. **Commit** — one `prisma.$transaction`, **all-or-nothing**: nothing is written unless
   every row is valid, so the recorded dispatch always matches the paper list.

## The review screen — [src/components/DispatchBatchForm.tsx](src/components/DispatchBatchForm.tsx)

Header: site (one per dispatch), reference, date, note. Then one row per pasted line:

| Column | Behaviour |
|---|---|
| Source text | what the sheet said, kept for reference |
| Item | picker pre-filled from matching, badged **exact** / **suggested** / **unmatched** |
| Quantity | editable |
| Form | **continuous items only** — *cut pieces* (`length × count`) or *whole sealed rolls* (count, and which size), or both. Whole rolls skip the allocator entirely. Discrete rows show nothing here |
| Plan | `cut 75 from 95` · `2 sealed 400 m rolls` · ⚠ `needs a 400 m roll opened` · ✗ `out of stock` |

A summary banner aggregates it: *"3 rows need a fresh roll opened · 1 unmatched item ·
2 rows out of stock."* Submit stays disabled while any row is unmatched or impossible;
rows needing an open require explicit acknowledgement, exactly as the single-item confirm
does. Starts at **15 blank rows**, "Add row" for more, pasting grows the table to fit.

Row-editing pieces (standard table shell, `<datalist>` item picker) are built here and
**reused by the delivery grid in Phase 5** — dispatch is the more demanding of the two, so
it sets the pattern rather than inheriting it.

## Server — [src/lib/actions/dispatches.ts](src/lib/actions/dispatches.ts)

`recordDispatch(prevState, formData)`: hidden-JSON `lines` payload following the existing
idiom from [NewShelfForm.tsx:94](src/components/NewShelfForm.tsx:94) →
[shelf.ts:33-38](src/lib/actions/shelf.ts:33); `requireCapability("stock:issue")`; all
errors collected rather than first-fail; `{ errors: { rowIndex, message }[] }` back.

Inside the transaction it creates the `Dispatch`, re-runs `planBatch` against freshly-read
packs, and **aborts if the plan now needs opens beyond those approved** — the stale-approval
guard from Phase 1, at batch scale. Per row it writes an `ISSUE` (`quantity` in base units,
`dispatchId` set) plus any `OPEN_PACK` and `SCRAP` records the plan produced.

No slot column is needed: after Phase 1 the shelf map derives itself from packs, so there is
nothing per-row to pick and nothing to drift.

## Pages

[dispatches/new](src/app/dispatches/new/page.tsx), [dispatches](src/app/dispatches/page.tsx)
(history: date, reference, site, line count, totals), and
[dispatches/[id]](src/app/dispatches/[id]/page.tsx). The site page's activity list groups by
dispatch rather than showing loose rows.

---

# Phase 5 — Delivery entry

Deliveries **trickle** — typically one or two item types as stock runs out — so this is the
lighter of the two flows. The multi-row grid still earns its place for the occasional larger
challan and handles a single row perfectly well, but it opens with **3 blank rows, not 15**,
and gets no paste (ruled out with the user). What matters most here is not the grid but the
`Delivery` record: supplier, challan reference, and destination.

## Schema

```prisma
model Delivery {
  id           String        @id @default(cuid())
  reference    String?       // challan / invoice number
  supplier     String?
  receivedAt   DateTime      @default(now())
  note         String?
  site         Site?         @relation(fields: [siteId], references: [id])
  siteId       String?       // null = into the store; set = delivered direct to that site
  user         User          @relation(fields: [userId], references: [id])
  userId       String
  transactions Transaction[]
  @@index([receivedAt])
}
```

`Transaction` gets `deliveryId String?` + relation + index. `User` gets `deliveries Delivery[]`.

## Destination: store or direct to site

One destination for the whole challan (a supplier splitting a shipment is recorded as two
deliveries), chosen once in the header — no per-row column.

- **`siteId = null`** — the ordinary path: packs land in the store.
- **`siteId` set** — the material never touches the store. Each line writes **two**
  transactions sharing the `deliveryId`: a `STOCK_IN` and an immediate `ISSUE` to that site,
  netting to zero at the office.

That pairing looks like bookkeeping sleight of hand and is deliberate: **every downstream
guard then works unchanged.** `materialsAtSite` sees the `ISSUE`, so the site correctly
holds the material, so returning the opened leftovers passes the return guard, so the
purchase still shows in finance's records. A dedicated `SITE_DELIVERY` type would instead
mean editing `materialsAtSite`, the return guard, the dashboards and the site pages, with a
chance of missing one. The paired rows share a `deliveryId`, so the UI renders them as a
single event — *"Delivered direct to Kandivali site"* — not a puzzling stock-in-then-issue.

Two consequences of the pack model, both simplifying:

- Direct-to-site material is **always fresh** (confirmed with the user), so sealed packs
  never touch the allocator — no cut planning, no open-a-pack prompt.
- **⚠ It corrupts the shelf placement suggestions unless fixed.**
  [suggestions.ts:25-30](src/lib/suggestions.ts:25) ranks items by how often they were
  `ISSUE`d, to decide who deserves a front-row slot. Direct-to-site deliveries write `ISSUE`
  rows for material **that never sat on the shelf at all** — so an item delivered straight to
  site twenty times would climb the ranking and be recommended a prime picking slot it is
  never picked from. Fix in the same phase: exclude `ISSUE` rows carrying a `deliveryId`
  from that `groupBy`. Caught by re-reading the code after designing the pairing; it is the
  one place where "the pairing changes nothing downstream" turned out to be false.
- **No pack rows are created in the store**, since the material was never there;
  `currentStock` is untouched, which is the honest answer. Leftovers later arrive as
  `OpenPack` rows — already how *all* returns work. So the return side needs **no new logic
  at all**.

## Shelf slots — nothing to do here

Handled in Phase 1 by deriving slot contents from packs, which deletes
`applyTransactionToSlot`, `ShelfSlot.quantity`, and the per-row slot dropdown this phase
would otherwise have needed. The delivery grid therefore has **no slot column** and no
"two rows must not target the same slot" rule.

## Server — [src/lib/actions/deliveries.ts](src/lib/actions/deliveries.ts)

`recordDelivery(prevState, formData)`, same shape as `recordDispatch`. Validation, all
before any write, collecting every error: `requireCapability("delivery:record")`; ≥1 line;
every `itemId` resolves; `Number.isInteger(n) && n > 0` — stricter than
`recordTransaction`'s `Number.isFinite`
([transactions.ts:69](src/lib/actions/transactions.ts:69)), which lets `2.5` reach an `Int`;
a packaged item needs `packSize` when `packCount > 0`, an unpackaged one must not carry one;
`packSize > scrapThreshold`; and no more defective than delivered on any row.

On success, one `prisma.$transaction`: create the `Delivery`; per line `addPacks(...)` and/or
an `OpenPack`, plus a `DefectiveItem` for any defective portion; then `recalcItemStock` and
`transaction.createMany`. Revalidate as
[transactions.ts:124-129](src/lib/actions/transactions.ts:124) does, plus `/deliveries`.

## UI

[src/components/DeliveryForm.tsx](src/components/DeliveryForm.tsx) reuses the row-editing
components from Phase 4. Columns: Item · Pack size · Packs · **Defective** · Loose · Total ·
remove. The defective column is a small optional count, blank on nearly every row —
entering `2` against a line of `10` records **8 into stock and 2 into quarantine**, with the
`DefectiveItem` row linked to this delivery (source `DELIVERY`). The row's stock total
visibly drops to the good quantity, so nobody has to remember which number counted.
Pack columns disable themselves for items with no `packUnit`; pack size offers the sizes
already on record (from `PackStock`) plus free text for a new one — this is where "a 400 m
and a 600 m roll" is entered with no setup. Live per-row total (`5 × 400 m = 2000 m`).

Pages: [deliveries/new](src/app/deliveries/new/page.tsx),
[deliveries](src/app/deliveries/page.tsx), [deliveries/[id]](src/app/deliveries/[id]/page.tsx).
`STOCK_IN` leaves the type `<select>`
([TransactionForm.tsx:50](src/components/TransactionForm.tsx:50)); that page becomes
"Issue / Return" for one-off movements. `recordTransaction` keeps its `STOCK_IN` branch —
still correct, still gated — only the UI option goes.

---

# Phase 6 — Site material lifecycle

Four related things: closing material out when it is used up, marking material staying put
until someone can collect it, moving it directly between sites, and seeing all of it at once.

## Consumption at site

Today nothing ever leaves a site except by coming back. A site's list is really "everything
ever sent here, minus what returned", so it grows forever and stops describing what is
actually on site. With direct-to-site deliveries feeding into it too, that drift gets worse.

New `TransactionType.CONSUME`: quantity in base units, **zero delta to `currentStock`** —
the material left the store when it was issued; consuming it at a site does not touch store
stock — and negative against the site's holding.

**This forces the one change to [stock.ts](src/lib/stock.ts) I earlier said would not be
needed.** `materialsAtSite` becomes `ISSUE − RETURN − CONSUME`: add `CONSUME` to the type
filter ([stock.ts:6](src/lib/stock.ts:6)) and subtract it in the reducer
([stock.ts:13](src/lib/stock.ts:13)). Because the return guard reads the same function, it
correctly stops anyone returning material already booked as consumed. `suggestions.ts`
filters `type: "ISSUE"` explicitly and is unaffected.

Sites hold no pack state (packs are a store-side concept), so `CONSUME` is a plain number:
no allocator, no scrap, no open-pack prompt. If 60 m of wire went to a site and 50 m is
consumed, the remaining 10 m comes home as an offcut through the normal return path.

**UI** — [sites/[id]/page.tsx](src/app/sites/[id]/page.tsx) already lists what a site holds
via `materialsAtSite` ([line 69](src/app/sites/[id]/page.tsx:69)). Add a "consumed" column
to that existing table and a single submit, so a whole site visit is recorded in one pass.
New capability `stock:consume`, granted to `EMPLOYEE` and `ADMIN`.

## Site-to-site transfers

Material does move A → B without returning to the office. Today the only way to record that
is return-then-issue, which claims a store visit that never happened — the same lie removed
for direct deliveries.

New `TransactionType.TRANSFER` plus one column, `Transaction.fromSiteId String?`, with
`siteId` holding the destination. `materialsAtSite(S)` then reads:

```
+ ISSUE(siteId=S)  − RETURN(siteId=S)  − CONSUME(siteId=S)
+ TRANSFER(siteId=S)                   − TRANSFER(fromSiteId=S)
```

**Why a dedicated type here, when direct-to-site deliveries used a pair of existing types
instead?** The pairing worked there precisely because it avoided touching `materialsAtSite`.
That argument is already spent — `CONSUME` changes that function in this same phase — and
pairing would be actively worse for a transfer: a `RETURN` into the store would create an
`OpenPack`, and the following `ISSUE` would immediately consume it, churning pack state for
material that never came within a mile of the shelf. A transfer touches **no packs at all**,
which is the honest model: packs are a store-side concept, and this material never returns
to the store.

Guarded against what site A actually holds, reusing the same check as returns. New
capability `stock:transfer`, granted to `EMPLOYEE` and `ADMIN`.

## Stranded material awaiting collection

Sometimes the remainder at a site is too small, or the site too far, for a return trip to be
worth more than the material. That material is **not lost and not consumed** — it stays
company property and gets collected whenever someone is next heading that way.

**The model already holds this.** Material issued and never returned stays attributed to its
site forever — nothing expires or is written off. What is missing is the ability to tell
*"the crew is still using this"* from *"we have given up collecting this for now"*, and that
distinction matters for a specific reason: if the only way to clear a site's list is
`CONSUME`, someone tidying up **will** book stranded material as consumed, writing off wire
that is sitting on a roof entirely retrievable. That is exactly the "marked lost" outcome to
avoid, reached by accident.

At-site quantities are derived from the ledger, not stored, so the mark needs its own record
layered on top rather than a column to flip:

```prisma
model SitePickup {
  id       String   @id @default(cuid())
  site     Site     @relation(fields: [siteId], references: [id])
  siteId   String
  item     Item     @relation(fields: [itemId], references: [id])
  itemId   String
  quantity Int      // base units flagged for collection
  note     String?
  markedAt DateTime @default(now())
  user     User     @relation(fields: [userId], references: [id])
  userId   String
  @@unique([siteId, itemId])
}
```

`quantity` must never exceed what the site actually holds, so `reconcileSitePickups(tx,
siteId, itemId)` runs after **every** transaction touching that pair — clamping the flag
down when material is returned or consumed, and deleting the row once the balance reaches
zero. Without it a stale flag would claim more than the site has.

Consuming flagged material **warns rather than blocks** — *"200 m here is marked for
collection; consuming it removes it from the pickup list"* — since occasionally you really
do use what you had planned to retrieve. New capability `site:pickup`, granted to `EMPLOYEE`
and `ADMIN`: the judgement that a trip is uneconomical is the admin's, but the person on the
ground knows what got left, so both can mark. Say if that should be admin-only.

## Material at Sites — the cross-site view

The sites list today shows **name and location only**
([sites/page.tsx:22-35](src/app/sites/page.tsx:22)), so answering *"what is still out there
and where"* means opening every site page in turn. New page, on the nav: every site holding
material, its items and quantities, how much of each is flagged for collection, and **how
long it has been there**.

Age is what turns a list into a pickup plan — *"Kandivali: 340 m wire, 45 screws, oldest
4 months"* answers whether the detour is worth it. Computed FIFO: walk that site+item's
transactions chronologically keeping a running balance, and take the date of the oldest
`ISSUE` still contributing to it — the same shape as the existing reducer in
[stock.ts:11-15](src/lib/stock.ts:11). A plain "earliest issue date" would overstate age
whenever material was returned and re-issued. Filter by *awaiting collection only*, sort by
age or site. Also enrich the near-empty site cards with a one-line summary.

## Reorder awareness

Material at sites is **not** in `currentStock`, which is store-only — so a low-stock alert
can tell you to buy wire while 300 m sits stranded across three sites. Per the user's
decision it is **shown but not counted**: the dashboard's low-stock list
([dashboard/page.tsx:43-59](src/app/dashboard/page.tsx:43)) gains *"+ 300 m at 3 sites"*
beside each low item, from one `groupBy` over site transactions. Reorder levels stay
store-only, so the app never implies material it cannot hand over today is available.

---

## Operational notes

**Deployment is deliberately not in this plan.** It runs on one machine for now, so the
SQLite file staying local is fine. Revisit before other people get accounts: roles imply
separate machines, and the database has to live somewhere both can reach. SQLite handles
that perfectly well once it is on a shared box — the open question is only which box.

**Backups are not optional even for a single-user setup.** `dev.db` is one file holding the
entire inventory history, and there is none. A scheduled copy — even a daily
`sqlite3 dev.db ".backup"` into a dated file, or just a synced folder — should exist before
real stock data goes in, not after. This is the cheapest item in the whole document and the
most expensive one to skip.

## Tests — worth adding, and cheap here

The project has **no tests at all**, and `PROGRESS.md` §7 already flags the atomicity and
validation in `transactions.ts` as "the most safety-critical piece". This plan makes that
considerably more true.

But it also makes testing unusually easy: `planAllocation` and `planBatch` are **pure
functions** — no database, no framework — and they hold the densest, highest-risk logic in
the whole design (best-fit selection, scrap thresholds, batch state threading, the
impossible case). Every numbered scenario in the verification list below that concerns
allocation can be written as a unit test in a few lines.

Use **`node:test`** — built into Node, zero dependencies, matching the codebase's
no-library style. A `npm test` script and one `packs.test.ts` covering the allocator would
catch the exact class of bug the manual checklist is trying to catch by hand, on every
change rather than once.

## Documentation to update

`PROGRESS.md` describes the current design and will be actively wrong afterwards — line 78
states that `Item.currentStock` "can never drift apart" from the audit trail, whereas this
plan deliberately makes it a **cache** of `PackStock` + `OpenPack`. `condition-based-shelving-plan.md`
also records the "no automated below-threshold rule" decision this plan reverses. Both should
be updated as part of the work, not left to contradict the code.

## Parked — raised, not yet decided

**1. `Transaction` is becoming a wide table.** Across these phases it gains `packSize`,
`packCount`, `pieces`, `defectiveQty`, `deliveryId`, `dispatchId`, `fromSiteId` and
`appliedPlan` — eight nullable columns, most null on most rows — plus five new enum members
(`OPEN_PACK`, `SCRAP`, `CONSUME`, `TRANSFER`, `ADJUSTMENT`). At SQLite scale with a few
thousand rows this is pragmatic and I would still do it, but it is real design debt: the
alternative is a `TransactionDetail` side table. Flagging it as an accepted trade-off rather
than an oversight.

**2. Recent Activity will turn into noise.** The dashboard shows the last 10 transactions
([dashboard/page.tsx:107-116](src/app/dashboard/page.tsx:107)). With `OPEN_PACK`, `SCRAP`,
`CONSUME`, `TRANSFER` and `ADJUSTMENT` all landing in the same table, and a single dispatch
writing 15+ rows at once, that panel will show bookkeeping chatter from one batch instead of
a useful picture. It should either filter to real movements or group by dispatch/delivery.

Smaller points, noted in passing and still undecided:

- Raising a `scrapThreshold` later does not re-evaluate offcuts already above the old one.
- Low stock reports base units (*"need 200 m"*) but purchasing happens in **rolls** — a
  reorder view in packs would be more actionable.
- `Transaction.userId` is who *recorded* it, not who *took* the material. The brief's
  problem #3 is about accountability for material going to sites, so those may want to be
  separate fields.

## Out of scope (flagged, not built)

- **Excel paste on the delivery grid** — ruled out with the user; deliveries stay typed.
  The Phase 4 parser is standalone, so wiring it in later is small if supplier challans
  start arriving as spreadsheets.
- Barcode / scanner entry.
- Learned name aliases — fuzzy matching is confirmed on the review screen every time.
  Worth revisiting once real sheets show which corrections repeat.
- Per-roll traceability (which physical roll went to which site).
- Joining offcuts to make up a run — an explicit hard error instead.
- Sealed/unopened returns — ruled out, not overlooked. If untouched rolls ever start coming
  back, add a "returned unopened" flag routing the length to `PackStock` instead of an
  `OpenPack`.
- **Pack state at sites** — a site holds plain base-unit quantities, not rolls. Leftovers
  only become packs again when they return to the store.
- Splitting one challan between the store and a site — record two deliveries instead.
- Editing a committed batch line by line — reversal replaces the whole thing, then it is
  re-entered. Partial edits would fight the pack-restore check in Phase 3.
- Approval workflows (employee requests → finance approves).
- Per-slot counts of *sealed* packs — sealed packs of a size are fungible, so "how many are
  in this particular box" has no operational answer worth storing.

## Verification

Run after each phase, not only at the end.

**Phase 1 — units, cuts, scrap** ✅ *passed 2026-08-20; 2, 4, 5, 8-14 are covered by
`npm test`, the rest checked in the browser*
1. Migrate, generate, reseed; pre-existing items keep their totals, now as one `OpenPack`.
2. "Wire 2.5 mm": `CONTINUOUS`, `m`, `roll`, threshold 15. Add 3×400 + 2×600 sealed →
   reads `3×400 m + 2×600 m sealed`, total **2740 m**.
3. **Nothing opens without a click.** With no rolls open, issue one continuous 50 m. The
   form must **stop** and say it needs to open a 400 m roll — no write yet. Cancel: stock
   unchanged, no `OPEN_PACK` row. Repeat and confirm: open `[350]`, total 2690 m.
4. **The reconsideration case — the reason this exists.** Open rolls `{100, 95}`, threshold
   15. Ask for a continuous **150 m**: no single roll holds 150, so it must **prompt** to
   open a sealed 400 m roll. Go back and re-enter as **`75 m × 2`** — now it must proceed
   with **no prompt at all**, cutting 75 from the 95 and 75 from the 100, leaving `{25, 20}`.
   Same 150 m issued; one fresh roll saved because the prompt made someone state what they
   actually needed.
5. **Best-fit:** with open rolls `{50, 30, 20}` issue 25 m. Must cut the **30**, not the 50.
   Leaves `{50, 20}`, and the 5 m remainder becomes `SCRAP` — total drops by 30, not 25.
6. **Preview matches reality:** the confirmation screen's stated cuts, opens and scrap must
   match exactly what the item page shows afterwards — same `planAllocation` both sides.
7. **Stale approval:** two tabs both at the confirm screen; commit one, then the other. The
   second must re-plan and re-prompt rather than silently opening a second roll.
8. **Exactly zero:** issue 20 m against the 20 m roll → row disappears, **no** scrap event.
9. **At threshold:** leave exactly 15 m with a 15 m threshold → scrap (at *or* below).
10. **Hard error, not a prompt:** request a continuous 500 m with a 400 m largest roll →
   out-of-stock error naming the largest available. It must **not** offer to open anything,
   since opening cannot help; nothing written.
11. **Whole rolls bypass the allocator:** issue 2 sealed 400 m rolls with offcuts present —
   no cut planning, no prompt, offcuts untouched, `sealedCount` drops by 2.
12. **Discrete:** 60 screws from open packets of 30/20/10 succeeds by pooling; running short
   prompts to open a packet; no threshold field on the item form.
13. **Standalone open:** the item page's "Open a pack" button opens a chosen size and logs
   `OPEN_PACK`, with no issue involved.
14. **Return:** two offcuts (40 m and 12 m) in one return, threshold 15 → the 40 m becomes an
   open roll, the 12 m lands straight in `/recycle`, neither treated as sealed. Returning
   more than the site holds still fails.
15. Unpackaged item (an inverter, `packUnit` null) behaves exactly as before.
16. **Defective on return:** return 40 m of which 10 m is defective. The site loses the full
   **40** (its balance must be right), but the store gains only **30** as an `OpenPack`; the
   10 m appears in `/defective` with source `RETURN`. Marking more defective than returned
   is rejected.
17. **Defective is not stock:** the quarantined 10 m must not appear in `currentStock`, must
   not satisfy an issue, and must not count toward `minStock`.
18. **Shelf derives itself:** assign wire to a `FRESH` box and an `OPENED` box. The FRESH box
   shows the sealed totals, the OPENED box shows only the open rolls placed in it. Issue
   enough to consume an open roll → it disappears from that box **with no slot field
   anywhere in the form**. Confirm `ShelfSlot.quantity` and `applyTransactionToSlot` are
   gone from the codebase, not merely unused.
19. **Split boxes:** put the same item in two `FRESH` boxes. Both render the aggregate,
   marked as split — and neither the old `@@unique` nor any per-slot number blocks it.
20. **Allocator unit tests** (`node:test`): the best-fit choice, at-threshold scrap, the
   exactly-zero case, the impossible case, whole rolls bypassing the allocator, discrete
   pooling, and `planBatch` threading two rows against one roll. These cover checks 4-12
   above without a browser.

**Phase 2 — roles**
1. Finance: nav shows Deliveries, no Dispatch; can create an item; `/sites/new` redirects
   away. Employee: the mirror image.
2. **Server-side enforcement — the one that matters.** As finance, replay the
   `recordTransaction` POST with `type=ISSUE` from devtools. Must be **rejected**, not
   merely hidden. Same for an employee calling `recordDelivery`.

**Phase 3 — corrections**
1. **Adjustment:** an item reads `3×400 m sealed · 50 m open` (1250 m). Count it as
   `2×400 m sealed · 50 m open`, save with a reason → total 850 m, one `ADJUSTMENT` row of
   −400 carrying the reason. A blank reason is rejected.
2. **Clean reversal:** issue 75 m cutting a 95 m roll to 20 m and scrapping a 5 m stub.
   Reverse it → the roll is back at **95 m**, the scrap row is gone, `currentStock` matches
   exactly what it was before, and both the original and its compensating entries remain in
   history.
3. **Reversal refuses when the world moved on — the key safety test.** Repeat the issue,
   then cut that same roll again, *then* try to reverse the first issue. It must be
   **rejected** with an explanation pointing at adjustment, not silently restore wire that
   no longer exists.
4. **Reversal ≠ return:** reversing a 75 m issue restores the original roll; *returning*
   75 m creates a new 75 m offcut. Confirm the two produce different pack state.
5. **Admin only:** an employee and a finance account both get rejected server-side when
   replaying the reverse and adjust action POSTs.

**Phase 4 — dispatch** ✅ *checked 2026-08-20; 1, 2, 9, 10 verified in the browser
(paste/header-skip, exact/suggested/typo matching, dispatchId grouping, full reversal);
matching's ambiguous-tie case and the parser's edge cases are covered by
`matching.test.ts`/`dispatchPaste.test.ts` rather than re-checked by hand; 3-8 rely on the
same `planBatch`/`commitAllocation` machinery already covered by `allocation.test.ts` and
were not separately re-run for this batch path*
1. **Paste** 15+ rows copied from a real Excel sheet, header row included. Parses into the
   table, header skipped, `"150 m"` read as `150`.
2. **Matching:** a typo'd name ("wire 2.5mm sq") pre-fills as a *suggestion*; a nonsense
   name is *unmatched* and blocks submit; two similarly-named SKUs flag as *ambiguous*
   rather than one being silently chosen.
3. **Rows compete for stock — the batch-specific bug to hunt.** Two rows each asking 75 m
   with only one 95 m roll open: the first plans a cut, the second must show ⚠ needs a roll
   opened. If both show a clean cut, `planBatch` is not threading simulated state.
4. **Re-plan on edit:** change row 3's quantity and row 11's plan updates without a reload.
5. **Cut vs whole roll:** one row as `75 m × 2` (cut) and another as 2 whole 400 m rolls in
   the same dispatch — the cut row plans cuts, the roll row shows no cut planning at all.
6. **Pieces only where relevant:** wire rows offer the form control; screw rows don't.
7. **All-or-nothing:** with one row out of stock, submit writes **nothing** — no partial
   dispatch, no orphaned `OPEN_PACK`, and the typed rows survive on screen.
8. **Batch stale approval:** two tabs at the review screen, commit one then the other. The
   second re-plans and re-prompts.
9. **The document:** the dispatch appears as one event with its reference, and the site page
   groups those 15 rows under it instead of listing them loose.
10. **Batch reversal** (builds on Phase 3): reverse a 15-row dispatch → every row's packs
   restored, site holdings back to zero, one reversal event in history.

**Phase 5 — delivery**
1. A one-line delivery (the common case) is quick: item, pack size, count, submit.
2. A 3-line delivery with a new pack size and one unpackaged item commits in one submit;
   `/items` totals rise by exactly the line totals; no open prompt ever appears, since
   deliveries only add sealed stock; the shelf map reflects the new sealed counts without
   anyone picking a slot.
3. **Defective on delivery:** a line of 10 with 2 marked defective adds **8** to stock, not
   10 then minus 2 — `currentStock` must never briefly show 10. The 2 appear in
   `/defective` with source `DELIVERY`, linked to this delivery.
4. **Claim lifecycle:** mark that row `CLAIMED`, then record the supplier's replacement as an
   ordinary delivery and link it — the row reads `REPLACED`, and outstanding claims are a
   query, not someone's memory.
5. **Direct to site:** 3 sealed 400 m rolls direct to a site. Store `currentStock`
   **unchanged**, no `PackStock` row created, site shows 1200 m, rendered as one
   "direct to site" event.
6. **The failure this fixes:** return a 40 m offcut from that site. It must be **accepted** —
   before this phase the return guard rejected it because the site's net was 0 — and land in
   the store as an `OpenPack`.
7. **Validation:** rows with `0`, `2.5`, no item, a pack size on an unpackaged item, a pack
   size below the scrap threshold, and more defective than delivered → in-page errors per
   row, no partial write, typed data still on screen.

**Phase 6 — site lifecycle**
1. Site holds 1200 m; mark 1000 m consumed. Site drops to 200 m, store `currentStock`
   **untouched**, a `CONSUME` row appears.
2. **Guard still binds:** try to return 300 m from that site → rejected, only 200 m there.
   Return 200 m → accepted, site reaches zero.
3. **Transfer A → B:** move 500 m from site A to site B. A drops by 500, B rises by 500,
   store `currentStock` is **untouched**, and **no pack rows change at all** — if an
   `OpenPack` appears or disappears, the transfer is wrongly routing through the store.
4. **Transfer is guarded:** transferring more than A holds is rejected; after transferring,
   B can return material to the store and A cannot.
5. **Flag for collection:** mark 150 m of a site's 200 m as awaiting pickup. Site page
   splits into in-use and to-collect; store `currentStock` is **untouched** — flagging
   labels stock, it does not move it.
6. **The clamp — the bug to hunt.** With 150 m flagged, return 100 m (leaving 100 m at
   site). The flag must clamp to 100, not keep claiming 150. Return the rest → the
   `SitePickup` row disappears. Transferring flagged material away must clamp it too.
7. **Consume warns, doesn't block:** consuming flagged material shows the warning naming the
   flagged quantity, and proceeds when confirmed.
8. **Material at Sites:** lists every site holding material, quantities, flagged amounts and
   age. Return material and re-issue it — age must reflect the *new* issue under FIFO.
9. **Reorder annotation:** an item below `minStock` with stock at two sites shows
   "+ N at 2 sites" — and its low-stock status is **unchanged**, since at-site material is
   shown but never counted.

**All phases**
1. `npx tsc --noEmit` and `npm run build`.
