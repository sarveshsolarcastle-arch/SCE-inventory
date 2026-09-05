# Packs & Cut Lengths · Role-Scoped Workspaces · Bulk Dispatch & Delivery

> **This is the working plan for phases 1-8. Phases 1-7 are built; phase 8 (hosting) is
> IN PROGRESS — Part A, the hosted pilot, is deployed and live at sce-inventory.vercel.app
> on Turso (2026-08-25). Part B, permanent offline production, has not started. SQLite is
> kept throughout, per plan. The 2026-09-04 "Turso latency" report is root-caused and fixed
> — it was a Vercel region misconfiguration, not a database problem; see the Reopened
> section near the end.**
>
> **Phase 11 (roles and admin approvals, decided 2026-09-05) is partly built. Part 1 — FINANCE
> absorbing the retired EMPLOYEE role — and Part 3 — stock counts storing a correction rather
> than a snapshot — both landed 2026-09-05, the latter along with a two-phases-old bug that had
> stopped stock counts working at all. Part 2, the approval queue itself, is not started and is
> blocked on a Turso migration script that does not exist yet.** See "Decided 2026-09-05" in the
> cross-phase notes.
>
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

> **Status: ALL SIX FUNCTIONAL PHASES ARE BUILT and verified (2026-08-20), and Phase 7 (UI
> overhaul + mobile web) is built and verified (2026-08-21).**
>
> Phase 7's design decisions and its "as built" note are recorded in the **Phase 7** section
> at the end of this file. **Phase 8 (hosting) is in progress; re-planned 2026-08-25** into
> two parts — a hosted pilot on real data, then permanent offline production on a carried
> drive. See the Phase 8 section, which records how the requirement changed **twice** and
> which database decisions were reversed, superseded, or re-derived as a result.
>
> Each *built* phase has an "as built" note recording where reality diverged from this plan —
> read it before changing that phase's code.

| Phase | Delivers |
|---|---|
| 1 | ✅ **DONE** — base units, packs, cut lengths, scrap, single-item issue with confirm |
| 2 | ✅ **DONE** — `ADMIN` / `FINANCE` / `EMPLOYEE` and capability gating |
| 3 | ✅ **DONE** — corrections: reversal and stocktake adjustment |
| 4 | ✅ **DONE** — Excel-pasted dispatch batch with review screen (employee) |
| 5 | ✅ **DONE** — delivery entry (finance), to the store **or direct to a site** |
| 6 | ✅ **DONE** — site material lifecycle: consumption, pickup, transfers, cross-site view |
| 7 | ✅ **DONE** — UI overhaul + mobile web; full record at the end of this file |
| 8 | 🔨 **IN PROGRESS** — accounts, `DATABASE_URL` fail-fast and build prerequisites done; **Part A** (Turso + Vercel pilot) and **Part B** (offline, carried drive) both pending |
| 11 | 🔨 **PARTS 1 AND 3 DONE** — roles and admin approvals (decided 2026-09-05, in the cross-phase notes). Part 1 (FINANCE absorbs the retired EMPLOYEE role) and Part 3 (adjustments store the correction) built; Part 2 (the approval queue) not started |

## Why 7-8 were deferred, and what has changed since

Deferred by the user, who would not use the app in anger until the functional phases were
done. **That condition is now met** — phases 1-6 landed on 2026-08-20, and **Phase 7 landed
on 2026-08-21** (see the Phase 7 section at the end of this file). **Phase 8 began on
2026-08-22** once the requirement turned out to be "other people need accounts", not just
"put it on a server".

What follows in this section is the reasoning that shaped the deferral. It is kept because it
still explains *why the code is the shape it is* — particularly why phases 2-6 shipped
deliberately plain UI, which is exactly what Phase 7 now replaces.

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

> **Folded into the Phase 7 plan on 2026-08-21.** The first item resolved itself — both batch
> screens were built card-per-row from the start — and the rest are carried into Phase 7's
> steps. Kept here as the record of what was anticipated, and when.

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

### Hosting: SETTLED — a real server with HTTPS ⚠️ SUPERSEDED 2026-08-23, partly restored 2026-08-25

> **Reversed once, then half of it came back — read both steps or the history looks
> incoherent.** On 2026-08-23 this was reversed outright in favour of managed Postgres. On
> 2026-08-25 the requirement changed again (production is *offline*, hosting is only a
> testing period), which **restores this section's conclusion that SQLite stays** — but for
> an entirely different reason than the one given below, and *not* its "real server with
> HTTPS" premise, which remains dead.
>
> The reasoning below still explains why phases 1-7 were free to assume SQLite, so it is
> kept. See **Phase 8** at the end of this file for the decision actually in force.

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
- ~~A scheduled backup of the database file~~ — **done**: nightly GitHub Actions job plus an
  admin-only `/backups` restore page, live on Production. See PROGRESS.md's Phase 9 section.

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

> ⚠️ **This table is the Phase 2 record, and the Finance column is out of date.** Phase 11
> Part 1 (2026-09-05) gave FINANCE every capability shown here under Employee, and retired the
> Employee account. Read the two columns as merged; see "Decided 2026-09-05" below.

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

# Phase 5 — Delivery entry ✅ BUILT

> **As built, 2026-08-20.** Migration `20260820180000_delivery_entry` (additive: new
> `Delivery` table, nullable `Transaction.deliveryId`, and the two `DefectiveItem` fields
> that were specified back in Phase 1 but could not be created until `Delivery` existed —
> `deliveryId` and `replacedByDeliveryId`). New
> [src/lib/actions/deliveries.ts](src/lib/actions/deliveries.ts) (`recordDelivery`,
> `updateDefectiveStatus`), [src/components/DeliveryForm.tsx](src/components/DeliveryForm.tsx),
> [src/components/DefectClaimControl.tsx](src/components/DefectClaimControl.tsx),
> `/deliveries`, `/deliveries/new`, `/deliveries/[id]`. `STOCK_IN` removed from the
> transaction form's type select as planned; `recordTransaction` keeps its branch.
>
> **Verified in the browser, all seven checks below:**
> - **Defective on delivery (3):** 10 inverters with 2 damaged. The live row total read
>   *"8 pcs into stock · 2 pcs quarantined"* before submit, and stock went 0 → **8**, never
>   10-then-minus-2 — one `STOCK_IN:8`, no compensating row.
> - **Direct to site (5):** 3 sealed 400 m rolls to Kandivali. Store `currentStock`
>   **unchanged at 2000**, **no `PackStock` row created** (still `2×400, 2×600`), site holds
>   **1200 m**, rendered as one "Delivered direct to…" event rather than a stock-in-then-issue.
> - **The failure this fixes (6):** returned a 40 m offcut from that site — **accepted**,
>   where before this phase the return guard rejected it because the site's net was 0. It
>   landed in the store as a new 40 m `OpenPack`; store 2000 → 2040, site 1200 → 1160.
> - **The suggestions trap:** WIRE-2.5 now has 3 unreversed `ISSUE` rows but only **2** count
>   toward the placement ranking — the delivery's paired `ISSUE` is excluded, as required.
> - **Claim lifecycle (4):** QUARANTINED → CLAIMED → REPLACED, with the replacement recorded
>   as an ordinary delivery and linked; outstanding count fell from 2 to 1.
> - **Validation (7):** a pack size below the scrap threshold, more defective than delivered,
>   and a quantity with no item — all three reported **per row simultaneously**, nothing
>   written, typed data still on screen.
> - **Mobile:** zero horizontal scroll at 375px; all 12 number inputs carry
>   `inputMode="numeric"`.
>
> **Two deviations from what is written below:**
>
> 1. **`recordDelivery` takes a typed object, not `(prevState, formData)`.** The plan
>    specifies the `useActionState` shape, but Phase 4's `recordDispatch` had already settled
>    on a plain typed argument, and a delivery line carries the same mix of numbers and nulls
>    that survives a round-trip through `FormData` badly. Matching the sibling action mattered
>    more than matching the plan's shape — the two are now read side by side. Per-row errors
>    still come back as the specified `{ rowIndex, message }[]`.
> 2. **Damage is subtracted from the loose portion first, then from whole packs.** The plan
>    says a line records "8 good and 2 defective" without saying *which* 8. With a line that
>    mixes packs and loose material the split is ambiguous, and taking damage off the loose
>    part first keeps sealed packs intact wherever the arithmetic allows — a sealed pack is
>    the more useful thing to preserve, and a partially-damaged pack is not representable in
>    `PackStock` anyway. The `DefectiveItem` records `packSize`/`packCount` only when the
>    damaged quantity divides exactly into whole packs; otherwise it is recorded as loose.

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

# Phase 6 — Site material lifecycle ✅ BUILT

> **As built, 2026-08-20.** Migration `20260820190000_site_lifecycle` (new `SitePickup`
> table, `Transaction.fromSiteId`, and the `CONSUME`/`TRANSFER` enum members — the
> Transaction table rebuild preserved every existing column). New
> [src/lib/siteBalance.ts](src/lib/siteBalance.ts) (pure),
> [src/lib/sitePickups.ts](src/lib/sitePickups.ts) (the reconcile helper),
> [src/lib/actions/siteLifecycle.ts](src/lib/actions/siteLifecycle.ts),
> [src/components/SiteMaterialPanel.tsx](src/components/SiteMaterialPanel.tsx),
> `/at-sites`. `materialsAtSite` rewritten. 17 more unit tests, 58 total.
>
> **Verified in the browser, all nine checks below:**
> - **Consumption (1):** Kandivali held 1160 m; consumed 1000 → site **160 m**, store
>   `currentStock` **untouched at 2040**, a `CONSUME` row in the ledger.
> - **The guard still binds (2):** returning 300 m from that site was refused with
>   *"Cannot return more than what's currently at the site (160 m)"* — the post-consumption
>   figure, so the guard picked up `CONSUME` for free by reading the same function.
> - **Transfer (3):** 100 m Kandivali → Borivali. Origin 160 → 60, destination 390 → 490,
>   store `currentStock` untouched, and **no pack rows changed at all** — the plan's own
>   criterion for proving it is not routing through the store.
> - **Transfer is guarded (4):** with the client `max` attribute stripped in devtools, a
>   500 m transfer was still rejected server-side — *"the origin site holds only 160 m"*.
> - **Flagging (5):** 450 m of Borivali's 490 m flagged → the row split into
>   *"450 m awaiting collection · 40 m in use"*, store stock untouched.
> - **The clamp — the bug to hunt (6):** returned 150 m leaving 340 → the flag clamped
>   **450 → 340** on its own. Consuming 100 more clamped it **340 → 240**. Returning the
>   last 240 **deleted the `SitePickup` row** entirely.
> - **Consume warns, does not block (7):** consuming flagged material showed
>   *"340 m … is marked for collection; consuming this much removes it from the pickup
>   list"* with **Go back** / **Consume anyway**, and proceeded on confirmation.
> - **Material at Sites (8):** lists every site holding material with quantities, flagged
>   amounts and FIFO age; filters for awaiting-collection and oldest-first.
> - **Reorder annotation (9):** an item forced below `minStock` showed
>   *"+ 49 pcs at 2 sites (not counted)"* beside it, with its low-stock status unchanged.
>
> **Three deviations from what is written below:**
>
> 1. **The balance arithmetic lives in a new pure module,
>    [siteBalance.ts](src/lib/siteBalance.ts), with [stock.ts](src/lib/stock.ts) reduced to
>    the DB side.** The plan describes editing `stock.ts` in place. But `stock.ts`
>    **instantiates the Prisma client at module scope**, so importing it at all requires a
>    database — no import style avoids that, and a unit test cannot depend on one. (The
>    `@/` alias not resolving under `node --test` is a real but lesser obstacle; a relative
>    path works around it, whereas the module-scope client cannot be worked around.)
>    `siteDelta` and `oldestContributingDate` are exactly the kind of logic that should be
>    tested, so they moved to a module that imports nothing. This follows the codebase's own
>    allocation.ts / packs.ts split. `stock.ts` re-exports them, so callers are unchanged.
> 2. **The pickup flag is clamped on READ, not merely reconciled on write.** The plan says
>    `reconcileSitePickups` runs "after every transaction touching that pair", which makes
>    correctness depend on every present and future writer remembering to call it — and there
>    is no single chokepoint that would enforce it. That is the weakest possible enforcement
>    for a failure that is **silent**: a flag quietly claims material a site no longer holds
>    and nothing errors. The first draft of this phase proved the point by missing the call
>    in `recordDelivery` (harmless there, since that path only raises a balance — but nothing
>    caught it).
>
>    So `SitePickup.quantity` is treated as an **intent**, and the number every read path
>    actually uses is `effectiveFlagged(stored, held)` — derived, and structurally incapable
>    of exceeding the balance. `reconcileSitePickups` still runs from all six write paths,
>    but only to persist the clamp and delete emptied rows: housekeeping, not the guarantee.
>    Same reasoning as `ShelfSlot` storing no quantity in Phase 1 — derived contents cannot
>    drift. **Verified by planting a `9999` flag directly in the database against a site
>    holding 60 m: both the site page and `/at-sites` reported 60 m.** Six unit tests cover
>    the clamp.
> 3. **The site activity list is queried with an explicit `OR`, not through the `transactions`
>    relation.** That relation only matches `siteId`, so a transfer OUT of a site would never
>    have appeared in that site's own activity feed. Transfers also render directionally
>    (*"TRANSFER OUT to Borivali Site"* / *"TRANSFER IN from Kandivali Site"*), since one row
>    means opposite things depending on which site page you are reading.
>
> **Also fixed here, a Phase 5 bug found by the console check:**
> [DeliveryForm.tsx](src/components/DeliveryForm.tsx) built its pack-size `<datalist>` ids
> from a module-level counter, which advances independently on the server and in the browser
> — every load logged a React hydration mismatch. Now `useId()`, which is SSR-stable.
> `DispatchBatchForm` uses the same counter but only as a React key, never in a DOM
> attribute, so it was never affected.

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

# Phase 7 — UI overhaul and mobile web ✅ BUILT

> **As built, 2026-08-21.** All 14 steps landed in one session, in order, each checkpointed
> with `npx tsc --noEmit`, `npx next build`, `npm test` (58 → 63 tests, the 5 new ones for
> `activeHref.ts`), and a browser pass reading console output on every check. `git status`
> against `src/lib`, `src/lib/actions`, and `prisma/schema.prisma` shows **zero changes** —
> the markup-only constraint held exactly as written. Every one of the six preserved
> interactions was exercised by hand in the running app and behaved identically to before:
> the pack-open confirmation (full form replacement, "Go back and revise" restores state —
> verified by inspecting form field values after going back), the dispatch per-row open
> approval resetting on any edit to that row (verified directly: approve → edit the same
> field → the "✓ Approved" state and the approval button's visibility both flip back),
> `errorRowKey` row highlighting (wiring preserved, not independently re-triggered), the
> consume-vs-pickup-flag two-step warning (Go back / Consume anyway, both paths verified
> against the real database), the shelf popover (single-open via `openSlotId`, resets on
> Front/Back switch, closes on both mini-form submits but deliberately not on the front-row
> toggle — that asymmetry was in the original code and was preserved rather than "fixed"),
> and the shelf wizard's two-step flow with click-to-cycle box type. Mobile checked at 375px
> on the dispatch batch review (the screen the plan called "the hard one") and the items
> list: zero horizontal page scroll on either. Dark mode checked via the compiled-CSS grep
> (`[data-theme="dark"]` appears 84 times across 41 `dark:` utilities, `prefers-color-scheme`
> appears zero times) and by setting the OS to dark while the app was set to light, which
> stayed fully light.
>
> **One real bug was found and fixed during verification, and it was in the test, not the
> app.** `document.querySelector('form').requestSubmit()` — used to script form submission
> from outside the browser — grabbed **AppShell's sign-out form**, not the page's content
> form, because the sign-out form renders earlier in the DOM (inside the shared header) than
> anything in `<main>`. Submitting it repeatedly signed the session out mid-test, which
> looked exactly like an auth bug the first two times it happened. The fix was scoping every
> subsequent submit to the specific button/form under test, not a code change — nothing in
> the app was ever broken. Worth recording here because the same trap would catch a future
> session running scripted UI checks against any authenticated page.
>
> **Deviations from the plan below:** none structural. `SortableTh` (listed under Step 2)
> was wired up immediately on `items/page.tsx` rather than held for Step 4, since the plan
> itself says Step 2's job is to "exercise nearly every primitive" and a sortable list is
> the natural place to prove a sortable-header primitive. `shelf/[shelfId]/page.tsx` (the
> shelf detail page hosting `ShelfGrid`) is not named explicitly anywhere in the plan's
> per-step file lists; it was converted alongside `ShelfGrid` in Step 9, since shipping the
> primitive without its only real page host would have been untestable. Sidebar tokens
> (`--color-sidebar*`) were added in Step 3, not Step 1, since the plan's Step 1 scope is
> explicitly foundation-without-page-markup and the sidebar didn't exist yet to need them.
>
> Everything else matches the plan as written below, including the primitives table, the
> nav grouping, the dark-variant mechanism, and the 14-step order.

The trigger: phases 2-6 deliberately shipped plain UI (see "Build plain, not polished"
above), so the app now has complete functionality wearing the bare Bootstrap-era look of a
2010 PHP admin panel. The deferral's own condition — "not in real use until the functional
phases land" — has expired.

## The problem, stated precisely

**There is no design system at all.** Not "an inconsistent one" — none. Every component
redefines its own `INPUT`, `PRIMARY` and `BADGE` class strings locally. Concretely:

- **Three separately-maintained badge tone maps**: `BADGE_TONE` in
  [DispatchBatchForm.tsx](src/components/DispatchBatchForm.tsx), `BOX_TYPE_BADGE` in
  **both** [ShelfGrid.tsx](src/components/ShelfGrid.tsx) and
  [NewShelfForm.tsx](src/components/NewShelfForm.tsx), plus `STATUS_BADGE` in
  [defective/page.tsx](src/app/defective/page.tsx) — overlapping palettes, no shared source.
- **The pill/segmented toggle is copy-pasted verbatim in three files** (DeliveryForm,
  ShelfGrid, NewShelfForm), and the `role="alert"` error box in three more.
- **Four duplicate `Field` helpers** across `items/new`, `sites/new`, `items/[id]`, `sites/[id]`.
- **Dark mode responds only to the OS**, via `@media (prefers-color-scheme: dark)` — the user
  cannot choose.
- **[globals.css](src/app/globals.css) sets `font-family: Arial` on `body`**, silently
  overriding the Geist font [layout.tsx](src/app/layout.tsx) loads. A live bug, unnoticed
  since the project was scaffolded.

## Design direction — settled with the user, from three reference images

The user supplied three references: a light cloud-storage app, a dark "Command Center"
security dashboard, and a stock PHP inventory tool.

**The PHP tool is the baseline being left** — it is roughly what the app looks like today.
**The Command Center supplies the structure** (sidebar, stat-card row, badge-coded tables,
search/filter row), because that maps one-to-one onto what this app actually holds: low-stock
flags, transaction types, claim statuses, box types. **The cloud app supplies the warmth**
(rounded cards, soft shadows, a coloured sidebar on a light body).

| Decision | Choice | Why |
|---|---|---|
| Theme | **Light default**, dark as a *user toggle* | Read on a shared office PC and on a phone in a storeroom, in daylight — not a security console. Dark stays available, but chosen, not imposed by the OS |
| Navigation | **Left sidebar**, grouped into labelled sections | 13 links already wrap awkwardly in the top bar. Groups (Overview · Stock In · Stock Out · Where It Is · Exceptions) mirror how the *roles* already split |
| Accent | **Teal/blue** | Reads operational rather than corporate; neutral enough to carry both inbound and outbound actions |
| Icons | **`lucide-react`** — one new dependency | Both references lean on icons for scannability; hand-rolling ~15 SVGs costs more to maintain than it saves |
| Device | **Desktop-first**, mobile usable | Chosen by the user against the alternatives. Note this *narrows* the original Phase 7 brief, which read "mobile web" as co-equal |
| Tables | **Search + sortable columns**, server-side via URL params | Bookmarkable and shareable, no new dependency, extends the `?q=` pattern already in `items/page.tsx` |
| Pagination | **Not yet** | Premature at a few dozen rows. Deliberately deferred, not overlooked |
| Dashboard | A few **more stat cards** | Material at Sites, Awaiting Collection, open claims — all derivable from existing lib functions |

## The rule this phase must not break

**Markup only.** Business logic stays in `src/lib/`; components stay dumb. This is the
architectural bet phases 1-6 preserved specifically so that a redesign would be cheap:
`allocation.ts` is pure and framework-agnostic, `packs.ts` takes a transaction client and
knows nothing about Next.

**Two agreed exceptions**, both confined to `page.tsx` files, both using functions that
already exist: the search/sort `searchParams` reads, and the extra dashboard reads via
`materialAcrossSites()`. Nothing under `src/lib/` changes except one new pure module
(`activeHref.ts`, with its own test).

**`npm test` is the tripwire.** Those 58 tests cover pure modules this phase must never
touch. A failure means the markup-only constraint was breached — it is not a test to fix.

## Six interactions that must survive verbatim

Catalogued before any work starts, because each is subtle, deliberate, and would be easy to
"tidy" into something worse. These are the reason the interactive components are converted
**last**, when every primitive is already proven on static pages.

1. **[TransactionForm](src/components/TransactionForm.tsx)** — the pack-open confirmation is
   a **full form replacement**, not a modal, and "Go back and revise" restores prior form
   state intact. This is invariant #3 ("nothing opens implicitly") wearing a UI; the friction
   *is* the feature.
2. **[DispatchBatchForm](src/components/DispatchBatchForm.tsx)** — the per-row "Approve
   opening this pack" acknowledgment **resets on any edit to that row**, plus `errorRowKey`
   row highlighting on server rejection.
3. **[SiteMaterialPanel](src/components/SiteMaterialPanel.tsx)** — the two-step "this consume
   would clear a pickup flag" warning (Go back / Consume anyway), and the per-row
   single-open-panel toggle.
4. **[ShelfGrid](src/components/ShelfGrid.tsx)** — the per-cell popover: admin-gated,
   single-open via `openSlotId`, auto-closing per mini-form submit, **reset on Front/Back
   switch**.
5. **[NewShelfForm](src/components/NewShelfForm.tsx)** — two-step wizard in client state with
   no route change, plus click-to-cycle box type.
6. **[DefectClaimControl](src/components/DefectClaimControl.tsx) /
   [CorrectionPanel](src/components/CorrectionPanel.tsx)** — inline expand-in-place toggles,
   no modals.

## Decisions taken during planning, with the alternatives rejected

**Dark mode moves to `data-theme`, not `.dark`, and not a cookie.** One
`@custom-variant dark (&:where([data-theme="dark"], …))` line in `globals.css` overrides
Tailwind's built-in variant, so **every existing `dark:` utility across 20 pages and 9
components keeps working with zero edits** — only the trigger changes.
Next 16 ships the exact recipe at
`node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md` §"Themes",
and it is written around `data-theme`. *Rejected: a cookie* — it buys server-side correctness
the app cannot use, since the shell is already fully dynamic via `auth()`.

**`@theme inline` is load-bearing, not cosmetic.** Without `inline`, Tailwind resolves
`var(--surface)` once at `:root` computed-value time and a `[data-theme="dark"]` override
never reaches descendants. This is also why the existing `@theme inline` block must stay that way.

**No primitive carries `"use client"`.** A directive-free component compiles as server when
imported from a server file and client when imported from a client file — which is what
`Button`/`Input`/`Badge` need, since they are used in both graphs. Only the shell components
(`SidebarNav`, `MobileNav`, `ThemeToggle`) get the directive. *Rejected: a `ui/index.ts`
barrel* — re-exporting server-safe and client modules together drags client code into server
graphs.

**Conflict-prone primitives take explicit props, not `className` overrides.** There is no
`tailwind-merge` here, and competing Tailwind declarations resolve by **CSS source order, not
prop order** — so `<Tr className="border-red-500">` over a base `border-line` can silently
lose. That would break interaction #2's error highlighting invisibly. Hence `Tr tone="danger"`,
`Input invalid`, `Card tone`. *Rejected: adding `clsx`/`tailwind-merge`* — two dependencies to
paper over a problem that explicit props solve outright.

**Capability filtering stays server-side.** `AppShell` is the only place `auth()` and `can()`
are called; the client nav receives a pre-filtered plain array. Moving the filter client-side
would leak only cosmetically — `proxy.ts` and `requireCapability` still enforce — but it would
break the single-source-of-truth model in [permissions.ts](src/lib/permissions.ts).
Related: **icons cross the boundary as strings**, resolved via a map inside the client
component, because passing a `LucideIcon` function from a server component throws.

**Nav active state is longest-match-wins**, as a pure `activeHref.ts` with its own test. A
naive `startsWith` lights both *Dispatches* and *Dispatch to Site* on `/dispatches/new`.
`npm test`'s `src/**/*.test.ts` glob picks the test up for free.

**No route groups.** `(app)` / `(auth)` is the textbook answer for "login has no sidebar", but
it means moving ~20 page directories for zero URL change. A conditional in `AppShell` — no
session, render children bare — achieves the same thing in one `if`, and preserves today's
behaviour of `NavBar` returning `null`.

**`Card` never sets `overflow-hidden`; only `TableWrap` may.** The shelf grid already sits
inside an `overflow-x-auto`, and its popovers are absolutely positioned inside it. A rounded
card that clips its overflow would silently sever interaction #4.

**Table headers stay non-sticky.** `position: sticky` needs `overflow-y: visible`, which
fights the horizontal scroll container the house pattern depends on. Not a fight this design
needs.

## Order of work

Fourteen steps, each leaving the app building and working — no big-bang. Risk ascends
monotonically: the two riskiest things sit at opposite ends.

**Step 0** — mock up three screens (Dashboard, Items list, Shelf map) and get sign-off before
any code. **Step 1** — foundation alone: tokens, the variant switch, the theme toggle, the
font fix, *no page markup*. **Step 2** — the `src/components/ui/` primitives, proven on
`items/page.tsx` only. **Step 3** — the sidebar shell. **Steps 4-7** — static pages, bulk work.
**Steps 8-13** — the interactive components, easiest first, `DispatchBatchForm` last.
**Step 14** — sweep for survivors and update the docs.

**Step 1 ships alone for two reasons.** The variant switch is all-or-nothing — a typo makes
~every `dark:` utility compile to nothing, silently, across 20 pages — so it needs the
compiled-CSS check to itself. And removing the Arial rule changes text metrics everywhere;
tables will reflow. **That reflow is the fix landing, not a regression**, and bundling it with
other work guarantees it gets misattributed.

**Verifying the variant switch** (the one change that fails silently): build, then grep
`.next/static/css/*.css` — `[data-theme="dark"]` must appear many times and
`prefers-color-scheme` must not wrap the `zinc-` utilities. Then set the **OS** to dark while
the app is on light: it must stay light. That last check is what catches a leftover media block.

**A dev-only trap worth naming**: React Strict Mode's dev remount clears `data-theme` off
`<html>`, so without the `useLayoutEffect` re-apply the Next doc prescribes, dev looks broken
while production is fine — the classic setup for a wrong "fix".

## Full plan

The step-by-step implementation plan, with the primitives table, file paths and the risk
register, lives outside the repo at
`C:\Users\Kavita\.claude\plans\c-users-kavita-downloads-ui-examples-i-ethereal-swan.md`.
**This section is the durable record**; that file is the working checklist. When Phase 7 is
built, this section gains an "as built" note like every other phase, and the deviations get
recorded here.

# Phase 8 — Hosting 🔨 IN PROGRESS

Planned 2026-08-22; first three parts built and committed 2026-08-23 (`3e56f28`).
**Re-planned 2026-08-25**, when the requirement changed a second time. The phase now has
two parts — **A: a hosted pilot, on real data, temporary. B: offline production in the
office, permanent.** **Part A deployed and live 2026-08-25** (`ab90370`, sce-inventory.vercel.app).
Part B has not started.

## What changed the requirement — twice

Phase 8 was always "put it on a server". The requirement that actually arrived was
different: **other people in the office need to use it** — under 10 users, office hours,
on the PCs they already have, with nobody available to administer a server.

That surfaced a real single point of failure the user named precisely: if the app runs on
one employee's PC, that person being on leave takes the app *and the database* with them.

**Then it changed again on 2026-08-25, and this one is load-bearing.** The client prefers
**secure offline storage even at the cost of restricted access**. So hosting is not the
destination — it is a **testing period**. Production is a machine in the office that never
faces the public internet.

That single fact re-prices every database decision below, because a hosted database went
from *permanent home* to *temporary venue*. Read the two sections that follow together:
the first was right for the premise it had, and the second is what replaced it.

## Rejected: the SQLite file on Google Drive

The user's proposed fix was to put `dev.db` on a shared Drive so any PC could host. **This
corrupts the database**, and the reasoning is worth keeping because the idea is a natural
one to have twice:

- SQLite coordinates concurrent access through **file locks**, which sync clients do not
  honour — they treat the database as an opaque blob to copy.
- It is not one file. `data.db` has `-wal` and `-shm` sidecars which Drive syncs
  **independently and out of order**, so the main file and its write-ahead log arrive
  mismatched. That is corruption, not staleness.
- Drive uploads while writes are in flight, producing **torn pages**.
- Two PCs opening it is not a merge but last-writer-wins, "resolved" into a second file
  named `data (1).db`. A day of stock movements disappears with nothing raised anywhere.

**The diagnosis was right though, and the fix keeps it**: decoupling the database from any
one machine is correct. What the two parts do *not* share is the mechanism. Part A uses a
database that speaks a **network protocol** instead of a file that gets copied. Part B keeps
the file but moves it onto a **drive that is physically carried**, so exactly one machine can
open it at a time — see Part B's invariant.

Drive keeps a valid role either way: as the destination for **daily dump files**, which are
static, closed, and perfectly safe to sync. The rejection above is about a *live* database,
not a backup artifact — worth stating plainly, because "Drive rejected" and "Drive used for
backups" otherwise read as a contradiction.

## Reversed, then superseded: SQLite → managed Postgres

**This decision is no longer in force.** It is kept in full because it was correct for the
premise it had, and because the next person will otherwise re-derive it.

The reasoning was: the "SQLite stays" decision priced the Postgres port as "every migration
regenerated", which assumed *preserving migration history* — but with no production data you
**baseline** instead: delete the migrations, generate one `init`. Verified facts that made
the port small, and which remain true:

- **Zero raw SQL** in app code — no `$queryRaw`/`$executeRaw` outside the generated client.
- **No SQLite-specific column types** — no `@db.` annotations, no `Decimal`/`Bytes`/`Json`.
- 8 enums, which Prisma maps to native Postgres enums with no schema text change.

**What killed it: production is offline, on a file.** Postgres for the pilot would mean
SQLite → Postgres → SQLite — **two ports to arrive where we started**, both running straight
through the write path that has no test coverage. The port being individually cheap does not
make doing it twice sensible.

Postgres remains the right answer if the client ever chooses to stay hosted. Everything
above still applies if that happens.

## In force: `provider = "sqlite"` end to end

**Turso (libSQL) for the pilot.** It is SQLite-compatible, so the datasource provider never
changes and **every existing migration in `prisma/migrations/` stays valid** — no
regeneration, no baseline, no dialect change. Verified: `@prisma/adapter-libsql` publishes
**7.9.1**, matching the installed Prisma exactly.

The code change is the adapter alone — `@prisma/adapter-better-sqlite3` →
`@prisma/adapter-libsql` in [prisma.ts](src/lib/prisma.ts) and [seed.ts](prisma/seed.ts) —
because `resolveDatabaseUrl()` already isolates the URL. Confirm the constructor against the
package's own types rather than from memory, per AGENTS.md.

**Then production is a file on a drive in the office**, and the pilot's adapter is swapped
back. The cutover is not a migration at all — see "No data crosses the cutover" below.

Trade-offs accepted, not overlooked: **the pilot is down if office internet is down** (it is
a pilot), **free tiers can change terms** (which is why the daily dump is not optional), and
`better-sqlite3` is synchronous where libSQL is async — Prisma abstracts that, but it is the
kind of difference that surfaces at the edges, so Part A is where to watch for it.

## Built (2026-08-23)

**Fail-fast on `DATABASE_URL`.** [prisma.ts](src/lib/prisma.ts) read
`process.env.DATABASE_URL ?? "file:./dev.db"`, so a production server with the variable
unset started *successfully* against an empty database in its working directory — no error,
and every write landing somewhere the next deploy deletes. The only guard was a checklist
item in this document, which is the weakest available enforcement for an invisible failure.
Now [databaseUrl.ts](src/lib/databaseUrl.ts), pure and covered by 7 tests.

**Accounts.** There was no way to create a user — `prisma/seed.ts` was the only code that
ever created one or hashed a password, so "give my colleagues access" was blocked on a code
edit. Adds `/users` (admin), `/account` (everyone), a `user:manage` capability and
`User.isActive`. Accounts are **deactivated, never deleted**, because `Transaction.userId`
is the accountability trail. Guarded against lockout: you cannot change your own role,
deactivate yourself, or deactivate the last active admin.

> **Sessions are JWTs, so deactivation was a silent no-op** — a deactivated account kept
> working until its token expired, and a demoted one kept its old powers. `currentUser()`
> now re-reads the row rather than trusting the token, so both take effect on the next
> request. That is one indexed lookup per call, bought deliberately.

**Deployability.** `npm ci && npm run build` *failed* on a clean checkout —
`src/generated/prisma` is gitignored and nothing ran `prisma generate`. Fixed, plus
`engines`, `.env.example`, and `tsx`/`dotenv` moved to `dependencies` so `npm ci --omit=dev`
can still seed. **Regenerate the lockfile when moving deps between sections**: `npm ci`
refuses a package.json/lock mismatch outright, so a stale lock breaks the deploy at step one.

## Part A — the hosted pilot (Turso + Vercel) — 🟢 LIVE (deployed 2026-08-25)

Temporary, and it carries **real stock data** — the client is trialling the app on their
actual inventory, not fixtures. That is the decision everything else in Part A answers to.

1. ✅ **Turso database provisioned.** Adapter swapped to `@prisma/adapter-libsql` in
   [prisma.ts](src/lib/prisma.ts) and [seed.ts](prisma/seed.ts) (`ab90370`). Provider,
   schema and migrations untouched, as planned.
2. ✅ **Deployed to Vercel** at **sce-inventory.vercel.app**, repo pushed to
   [github.com/sarveshsolarcastle-arch/SCE-inventory](https://github.com/sarveshsolarcastle-arch/SCE-inventory),
   `AUTH_TRUST_HOST=true` and a fresh `AUTH_SECRET` set. Verified end to end in production:
   login, dashboard, real data from Turso, no errors.
   ⚠️ **Not yet done: the three seeded passwords are still `admin123` / `finance123` /
   `employee123`, live on a public URL.** This is the single biggest open risk right now —
   change it via `/users`, and give each account its own distinct password (a shared
   password defeats the accountability `Transaction.userId` exists for).
3. ✅ **Daily automated dump — done, not to Google Drive.** Built as a nightly GitHub Actions
   job instead (see PROGRESS.md's Phase 9): free-forever, and the destination the app itself
   can read back through an API, which a Drive folder cannot offer. Dated filenames, keeps
   the newest 30. **Still open: restore one against the real database to prove it, per Phase
   9's notes** — the underlying dump/restore logic has been verified against a scratch copy,
   but nobody has yet hit Restore against production itself.
4. ❌ **Spot-count two or three high-movement items mid-pilot — not done yet.** The wire and
   the screws. Ten minutes. This is the only independent check on the untested write path
   during Part A (see "Rejected" below: there is no parallel record), and a systematic
   pack-handling bug shows up on cut-and-opened items first.

> **⚠️ `prisma migrate deploy` does not work against Turso.** It fails with `P1013: scheme
> not recognized` — Prisma's CLI migration engine does not understand `libsql://`, confirmed
> against Prisma's own docs, which say Turso migrations go through direct SQL execution
> instead. The 10 existing migrations were applied once with `@libsql/client`'s
> `executeMultiple()` (its own docs recommend this for migration scripts), via a one-off
> script that was run once and discarded. **Any future schema change against Turso needs the
> same manual step**: `prisma migrate dev` locally against the SQLite file as normal, then
> apply the generated `migration.sql` to Turso by hand with `executeMultiple()` or the Turso
> CLI. `npm run db:migrate` (`prisma migrate deploy`) only works against a `file:` URL —
> useful for Part B, not Part A.

**Known and accepted:** Turso's free tier archives a database after 10 days idle — moot
under daily use, and reversible with `turso group unarchive`. More seriously, Turso's
2023-12-04 incident caused **data loss *and* cross-tenant exposure in free-tier databases**,
triggered by free-tier scale-to-zero. The daily dump covers the loss half; nothing covers the
exposure half. Vercel's Hobby plan is **non-commercial only**, and a client's live inventory
is commercial use — the exposure is account termination taking the deployment with it. Both
would be answered by the paid tiers; **free was chosen on 2026-08-25 and both risks are
accepted** — see "Decided: free tiers for Part A" below for what that means in practice.

## Part B — offline production, on a carried drive

The permanent home. One drive, moved between 2-3 office PCs so a missing employee does not
take the system with them.

**On the drive, self-contained** so the spare machines need no setup:

- the built app (`.next`, `node_modules`, `package.json`)
- the SQLite database file
- **portable Node.js** — the Windows `.zip` build, which runs from any path
- `start.bat`, the only sanctioned way to run it

**Four things that must be right:**

1. **Drive letters change between machines** (D: here, E: there). `start.bat` must compute
   the database path from its own location (`%~dp0`), never a hardcoded letter. This failure
   is invisible to [databaseUrl.ts](src/lib/databaseUrl.ts) — the variable *is* set, just
   pointing nowhere, which is the exact class of silent failure Phase 8 was opened to remove.
2. **INVARIANT: exactly one PC runs it at a time — and physical possession enforces this.**
   A database that exists only on a drive plugged into one machine cannot be opened by a
   second. That is structural, not a rule anyone has to remember. **It stops being true the
   moment someone shares the drive over the network to be helpful** — which is the same
   corruption as the Google Drive rejection above, reached by a different route. Never share
   the drive.
3. **Stop the app before ejecting.** Unplugging mid-write is the one thing that can corrupt
   the file.
4. **One drive is one copy.** A second drive, swapped or synced daily, is not optional — it
   is the offline equivalent of Part A's dump. Prefer an **external SSD over a spinning
   HDD**: faster, and no moving parts to damage in something carried between desks.

**LAN access needs no code changes.** `next start`, a Windows Firewall rule for the port,
other PCs at `http://<host-ip>:3000`, and `AUTH_TRUST_HOST=true` — NextAuth v5 otherwise
builds wrong callback URLs for a non-localhost host. Note that over plain `http://` the
session cookie cannot carry the `Secure` flag; acceptable on a trusted office network.

**Reaching it from outside the office is UNDECIDED — see below.**

## No data crosses the cutover

There is no migration between Part A and Part B. **Pilot data is abandoned deliberately.**
On the last day, stock is counted physically, written into an Excel file, and typed into a
fresh database.

This is better than migrating, for a reason worth keeping: the cutover count is against
**physical reality, not the app's belief about it**. So whatever the untested write path got
wrong during Part A dies at cutover instead of propagating into production. It bounds the
pilot's risk to the pilot. What is lost is the pilot's transaction ledger — accepted, since
a testing period's history is not worth a data migration.

**⚠️ Opening stock cannot be entered with `adjustStock`.** This was checked, not assumed.
`countRows` in [items/[id]/page.tsx:56](src/app/items/[id]/page.tsx:56) is built entirely
from **existing** `packStock` and `openPacks` rows, so on a fresh database the form has
nothing to render and says so: *"Nothing in stock to count. Record a stock-in first."* And in
[corrections.ts:211](src/lib/actions/corrections.ts:211) open packs are keyed by existing
pack id — updated or deleted, never created. **Adjustment corrects stock that exists; it
cannot conjure it.**

**Opening stock enters as a Delivery.** [deliveries.ts:26](src/lib/actions/deliveries.ts:26)
takes `packSize` / `packCount` / `loose` per line, and the pack size **may be new to the
item** — which is exactly the opening-balance case. This also gives better provenance:
stock arrives as a real `STOCK_IN` with a delivery behind it, consistent with the Phase 5
decision to remove starting-stock-at-creation *because* it wrote `currentStock` with no
transaction behind it.

**The cutover Excel is a stocktake, not an export.** Totals cannot be re-entered — the app
stores pack structure, and the allocator works on it. Per item:

| SKU | packSize | packCount | loose |
|---|---|---|---|
| WIRE-2.5 | 400 | 5 | 0 |
| WIRE-2.5 | 600 | 1 | 0 |
| WIRE-2.5 | — | 0 | 30 |

Two traps: **one line creates one open pack**, so three offcuts of 30/50/120 m are three
lines, not one line of 200 m — collapsing them destroys the distinction open packs exist to
preserve. And **offcuts at or below `scrapThreshold` land in the recycle list on arrival**,
which is correct but looks like a bug on cutover day.

The same activity is the first run of the maintenance-day count, if that feature lands first.

## Rejected alternatives (Phase 8 re-plan, 2026-08-25)

- **SQLite → Postgres → SQLite.** Two ports to end where we started, both through untested
  write-path code. Superseded by keeping `provider = "sqlite"` throughout.
- **Neon, or any Postgres, for Part A** — including on a free tier. This is the bullet above
  wearing a different name, and it has been re-opened more than once on the grounds that Neon
  is free and has a better free-tier safety record than Turso. Both are true and neither
  changes the answer: the cost of Postgres here is not money, it is **two ports through
  untested write-path code to arrive back at SQLite**. Only revisit if production stops being
  offline.
- **Migrating pilot data at cutover.** Unnecessary once history is expendable, and a physical
  recount is *more* accurate than carrying the app's possibly-drifted numbers forward.
- **`adjustStock` for opening balances.** Structurally impossible — see above.
- **A parallel Excel record kept throughout the pilot.** Considered as a live cross-check on
  the untested write path; the user chose a single cutover count instead. The consequence is
  recorded honestly in Part A step 4: during the pilot nothing independently checks the app.
- **Sharing the drive over the network so several PCs can run Part B at once.** Same
  corruption class as the Google Drive rejection. The one-at-a-time invariant is the design.
- **Postgres locally for Part B.** One provider end to end would be tidy, but Postgres on a
  drive carried between machines is far more fragile than a single file, and needs a service
  installed on every host PC. SQLite is the right database for this shape.

## Decided 2026-08-25: free tiers for Part A

Paid tiers (~$25/mo, ending at cutover) would have removed the free-tier scale-to-zero
mechanism behind Turso's 2023 incident and Vercel's commercial-use restriction. **The user
chose free**, so both risks are **accepted, not mitigated**:

- **Cross-tenant exposure on Turso's free tier is uncovered.** The daily dump answers data
  loss; nothing answers a leak. Real client stock data is on this.
- **Vercel Hobby is non-commercial only**, and this is a client's live inventory. The
  exposure is account termination taking the deployment with it — recoverable from the daily
  dump, but the pilot would stop dead.

Recorded as an accepted trade-off rather than an oversight, and cheap to revisit: both are
per-month subscriptions, so either can be switched on mid-pilot if the risk stops feeling
theoretical.

### The database for Part A is Turso. This is not open.

Stated separately because it keeps being re-opened. **Neon — or any other Postgres, free or
paid — is rejected for Part A**, and being free does not earn it a second hearing. Postgres
reinstates exactly the SQLite → Postgres → SQLite double port that this phase was re-planned
to avoid: two ports to arrive where we started, both through write-path code with no test
coverage. See "Reversed, then superseded" above; the reasoning is unchanged by price.

✅ **Done (`ab90370`, 2026-08-25).** `@prisma/adapter-libsql` (7.9.1) installed, adapter
swapped in [prisma.ts](src/lib/prisma.ts) and [seed.ts](prisma/seed.ts), auth-token variable
added to `.env.example`. Provider, schema and migrations untouched, as expected.

### The app host is a separate question, and it did not block the above

**Vercel was used**, at sce-inventory.vercel.app. Cloudflare Workers' free tier permits
commercial use and would have removed the Vercel non-commercial risk for nothing, but was not
evaluated under time pressure to get Part A live — worth half an hour to test later if the
Vercel Hobby non-commercial restriction becomes a real problem before the pilot's cutover.

**Turso runs on either**, so this choice touched no database code.

> **Provisioning was the user's to do, not an agent's, and that is how it happened.** The
> user created the Turso database, generated the auth token, created the GitHub repo, and
> set Vercel's environment variables directly in Vercel's dashboard. The agent never held the
> Turso or Vercel account credentials — only the resulting `DATABASE_URL` and
> `TURSO_AUTH_TOKEN`, written to the gitignored local `.env` for the pre-deploy smoke test.

## Reopened 2026-09-04: slow writes on the live deployment ✅ ROOT-CAUSED AND FIXED 2026-09-04

> **Resolved.** It was **not** a read-after-write consistency problem, and not a Turso
> problem at all. The application server was running **11,000 km from its database**, and
> every SQL statement paid the flight. Fix: one file, [vercel.json](vercel.json), pinning the
> function region to Mumbai. The original report and the reasoning are kept below, because
> the wrong hypothesis is the instructive part.

### The report

A noticeable delay (roughly 2 seconds) between clicking something that writes and the result
actually showing up. Reported by the user from the running pilot. Read as a *read-after-write
consistency* problem — the write lands, but the next read does not see it yet.

### What it actually was

Measured against the live deployment on 2026-09-04:

```
$ curl -sI https://sce-inventory.vercel.app/login | grep x-vercel-id
x-vercel-id: bom1::iad1::zd9l4-...
             ^^^^  ^^^^
             edge  the function actually runs HERE
```

- **The function runs in `iad1`** — Washington DC. Vercel's default region, never overridden,
  because there was no `vercel.json`.
- **The database is in `aws-ap-south-1`** — Mumbai. It is in the hostname:
  `libsql://sce-inventory-cosmosorigin.aws-ap-south-1.turso.io`.

So every single SQL statement was a Washington → Mumbai → Washington round trip, ~230 ms.
Not per request — **per statement**. Prisma's interactive `$transaction` issues its statements
sequentially over one libSQL connection, so they add up rather than overlap:

| Path | Sequential statements | At ~230 ms each |
|---|---|---|
| `currentUser()` on every request | 1 | 0.2 s |
| A page render (`Promise.all`, so mostly parallel) | 2-4 waves | 0.5-0.9 s |
| `recordTransaction` — an ISSUE, via `commitAllocation` | ~10-25 | **2.3-5.7 s** |

A write followed by a re-render pays both. That is the reported 2 seconds, and the reason it
was worst on exactly the actions that write.

**Measured from Mumbai for comparison** — the same production database, same auth token, from
the office's own network:

```
warm SELECT 1, median of 5             15 ms      (vs ~230 ms from iad1)
10 sequential SELECT 1                163 ms
10 statements in one batch()           35 ms
interactive txn: 10 reads + commit    197 ms
```

The database was never slow. It was 15 ms away from the people using it and 230 ms away from
the server serving them.

### Why the read-after-write reading was wrong, and how to be sure

It is a reasonable guess — the symptom (write, then a stale-looking read) is exactly what
replica lag looks like. But this deployment **cannot** have replica lag:
[prisma.ts](src/lib/prisma.ts) points `PrismaLibSql` at one URL, with **no `syncUrl` and no
embedded replica**. Reads and writes go to the same node. There is nothing to be stale
against.

This also disposes of the cookie-based workaround the user found while researching. It is
real, but it addresses Turso **embedded replicas / read replicas** — passing a replication
index back so a subsequent read waits for that write to arrive. Applied here it would have
been a no-op wrapped around code that had no replica to wait for, and the 2 seconds would
have stayed exactly where they were.

**The general lesson, and the reason this is written out at length:** the symptom named the
suspect. "Slow after a write" sounded like consistency, so the search went to consistency,
and from there to a rewrite onto a different database. The measurement that settled it —
reading one response header — took under a minute and pointed somewhere else entirely.
Measure before migrating.

### The fix

```json
// vercel.json
{ "regions": ["bom1"] }
```

`bom1` is Vercel's Mumbai region — same city as `aws-ap-south-1`, so the per-statement cost
falls from ~230 ms to low single-digit milliseconds. The 25-statement write path goes from
~5 s to well under 200 ms. It also shortens the trip for the users, who are in the same
office.

JSON permits no comments, so the reasoning lives here and in [README.md](README.md) rather
than in the file. **Do not delete `vercel.json` as an empty-looking config** — it is the
whole fix.

### Verification — do this after the next deploy

1. `curl -sI https://sce-inventory.vercel.app/login | grep x-vercel-id` → the **second**
   segment must read `bom1`, not `iad1`. If it still says `iad1`, the setting did not take;
   check Vercel's project-level Function Region, which can override this file.
2. Sign in and issue stock against an item that needs a roll opened — the heaviest write
   path. It should feel immediate rather than a beat behind.
3. Read the browser console on that check, not just the timing.

**If the region will not change.** Vercel's plans have at times restricted which regions a
Hobby project may pick. If `iad1` persists after a deploy with this file in it, the setting
is being refused, not ignored — the fallbacks, in order of preference: set the Function
Region in the Vercel project settings UI (same effect, different mechanism); or move the
**database** to a region near `iad1`. Prefer the first. Moving the database is the strictly
worse trade here — the users are all in the same Indian office, so a US database makes their
*own* requests slower even once the function-to-database hop is short. The whole point of
`bom1` is that it is close to both.

### The Supabase migration — CLOSED, paused by the user 2026-09-04

> **Decided by the user on 2026-09-04, once the region was found to be the cause: Supabase
> stays paused.** No separate repo, no separate host, no second database, nothing to
> terminate later. Part A continues on Turso. This is a closed ticket, not a deferred one —
> reopening it needs a new reason, not this one. The reasoning is kept below because the
> argument, not the verdict, is what stops it reopening on the same grounds.



The user proposed moving to Supabase (Postgres) as two completely separate deployments, on
the grounds that Supabase is more stable. That proposal was a response to *this* error, and
this error was a misconfigured region. **Postgres in `us-east-1` behind a function in `iad1`
would have been fast for the same reason this fix is fast — proximity — and would have been
read as "Supabase fixed it", teaching the wrong lesson at the cost of a rewrite and a
discarded dataset.**

The earlier decision above ("the database for Part A is Turso") therefore stands, and stands
on its original grounds. If Supabase is still wanted, it needs a *new* argument — this one is
spent.

## Open decisions — do not treat these as settled

1. **Whether Part B is reachable from outside the office.** Three routes, not equivalent:
   router port-forwarding (advised against — a Windows PC doing other work, publicly
   exposed, unpatched); a tunnel such as Cloudflare Tunnel (no open ports, traffic via a
   third party); or a private mesh VPN such as Tailscale (device-authenticated, nothing
   public). **The first two partly undo the reason for going offline**; the third does not.
   Still under discussion — LAN-only is the default until it is decided.
2. **How long Part A runs, and when the cutover count happens.** Never discussed, and it is
   load-bearing: it sets how long real client data sits on a free tier with both risks above
   accepted, and the cutover is a physical stocktake that has to be scheduled with the people
   who will do the counting. An open-ended pilot is the version of this that drifts.

## Still outstanding regardless

**DB-layer test coverage.** Unchanged as the largest risk, and Part A now runs **real stock**
through it. The 86 tests are all pure and will pass unchanged after the adapter swap **while
proving nothing about it**. The cutover recount bounds the damage; it does not prevent it.

# Cross-phase notes

## Documentation to update ✅ DONE

> **Resolved during Phase 1 (2026-08-20); kept as the record of what was caught.** Both items
> below are fixed: `PROGRESS.md` §5 now states plainly that `currentStock` is a cache, and
> `condition-based-shelving-plan.md` was **deleted**, its reasoning consolidated into
> `PROGRESS.md` §8 with a table marking which of its five decisions were reversed.
>
> **The principle generalises and still applies** — including to Phase 7: a doc that
> contradicts the code is worse than no doc, because it is trusted. Update the docs as part
> of the work, not after it.

The original note: `PROGRESS.md` describes the current design and will be actively wrong
afterwards — line 78 states that `Item.currentStock` "can never drift apart" from the audit
trail, whereas this plan deliberately makes it a **cache** of `PackStock` + `OpenPack`.
`condition-based-shelving-plan.md` also records the "no automated below-threshold rule"
decision this plan reverses. Both should be updated as part of the work, not left to
contradict the code.

## Decided 2026-09-04: deleting a shelf — a real delete, with a warning ✅ BUILT

**The question.** Shelves accumulate: a layout entered wrongly, a test shelf, a unit
physically taken out of the storeroom. Until now a shelf, once created, was on the map
forever — [shelf.ts](src/lib/actions/shelf.ts) had `createShelf`, `updateSlotBoxType`,
`assignSlotItem` and `toggleFrontRow`, and nothing that removed anything.

**Why this gets a real delete when items and users do not.** The rule elsewhere in this
codebase is *flag it, never delete it* — `User.isActive`, and the `discontinued` decision
directly above. Both exist because the schema makes deletion destructive: every
`Transaction` carries a required `itemId` and a `userId`, so removing either punches holes
in the ledger.

**A shelf carries none of that.** Nothing in the schema references a shelf except its own
slots. `ShelfSlot.itemId` is nullable — the one item relation in the schema that is — and a
slot stores **no quantity at all**, by the Phase 1 design: a box displays whatever its
item's `PackStock` and `OpenPack` rows currently hold. So deleting a shelf destroys
*placement* — where things sit — and no history whatsoever. A shelf is furniture, not a
record. The flag-don't-delete reasoning simply does not transfer, and applying it here out
of consistency would be cargo-culting the conclusion without its premise.

**Warn, do not block** (decided with the user). `deleteSite` *blocks* when anything is
attached, and that asymmetry is deliberate: `Transaction.siteId` is an optional relation, so
Prisma's default `SetNull` means deleting a used site would silently blank the siteId on
every movement — the ledger would still balance while quietly forgetting where material
went. There is no equivalent failure for a shelf, so an occupied shelf is a reason to say
what will be lost, not a reason to refuse.

The warning therefore names the real consequence with counts — *"5 boxes have an item
assigned, and 5 open packs are recorded as sitting here"* — and states plainly that **no
stock is lost**. That sentence is the point of the whole control: "this cannot be undone"
alone invites the reading that stock is at stake, which is the one thing that is not.

### The two ordering details that are not optional

Both are in `deleteShelf`, and both are silent if got wrong:

1. **Open packs are unplaced explicitly, not left to the foreign key.**
   `OpenPack.shelfSlotId` is declared `ON DELETE SET NULL`, so in principle the database
   would handle it — but only under `PRAGMA foreign_keys=ON`, which is per-connection state
   this code does not own. If it were ever off, packs would keep pointing at slot ids that
   no longer exist and **nothing would report an error**: the shelf map would just stop
   showing packs the item still holds. One `updateMany` removes the dependency. Same
   statement `assignSlotItem` already uses when a box changes hands.
2. **Slots are deleted before the shelf.** `ShelfSlot.shelfId` is `ON DELETE RESTRICT`, so
   deleting the shelf first fails outright.

All three statements run in one `$transaction`, so a shelf cannot end up half-demolished.

### Admin only — and a separate capability, not `shelf:manage`

`shelf:manage` is admin-only *today*, but only because of how `CAPABILITIES` happens to be
filled in. Granting it to FINANCE later — a plausible thing to want, since relabelling a box
is routine work — would hand over the delete silently along with it. So this is its own
`shelf:delete` capability, held by ADMIN alone. Relabelling a box and demolishing the shelf
it sits on are different-sized actions and should not share a key. Invariant 5's pattern
again: make the wrong state underivable rather than remembering not to derive it.

### Verification ✅ *all passed 2026-09-04, checked in the browser against a local copy*

1. **Occupied shelf, the case that matters.** Delete "Shelf A" (5 assigned boxes, 5 placed
   packs). Shelves 4 → 3 and slots 160 → 120, but `OpenPack` rows stay at **12** with the
   5 merely unplaced (`shelfSlotId` null, not deleted), and `PackStock`, total open-pack
   remaining, `Transaction` count and every `Item.currentStock` are **unchanged**.
2. **No dangling references.** `SELECT count(*) FROM OpenPack WHERE shelfSlotId IS NOT NULL
   AND shelfSlotId NOT IN (SELECT id FROM ShelfSlot)` must be **0** afterwards. This is the
   check that catches detail 1 above going wrong, and it is invisible from the UI.
3. **The warning states the counts**, and says no stock is lost.
4. **Server-side enforcement, not a hidden button.** As EMPLOYEE the control is absent —
   then replay the action POST with its `Next-Action` id from devtools. Must return
   `{"ok":false,"message":"Your account cannot delete shelves"}` and leave the shelf
   standing. *(Verified: it does.)*
5. Read the browser console on every check, not just the screenshot.

### Not covered by a test, and why

`permissions.ts` imports `auth` and `prisma` at module scope, so it cannot be imported by
the pure `node:test` suite the way `databaseUrl.ts` can. The admin-only rule is therefore
verified by the replay in check 4 and by nothing automated. Making it testable means lifting
`Capability`/`CAPABILITIES`/`can` into a pure module — worth doing, deliberately not done
here, since it is a refactor of a security-critical file and belongs in its own change.

## Decided 2026-08-27: discontinuing an item — flag it, never delete it

**The question.** An item is catalogued, then the company stops carrying it. Can it be taken
off the items list?

**Today it cannot.** [items.ts](src/lib/actions/items.ts) has `createItem` and `updateItem`
and nothing else — no delete action, no `item:delete` capability in
[permissions.ts](src/lib/permissions.ts), no control anywhere on the item page. An item, once
created, is in the list forever.

**Deleting is the wrong fix, and the schema already refuses it.** `itemId` is a *required*
relation on `Transaction`, `PackStock`, `OpenPack`, `DefectiveItem` and `SitePickup`; only
`ShelfSlot.itemId` is nullable. So a hard delete succeeds only for an item that never moved,
and for anything with history the database says no — correctly, because forcing it through
would mean deleting the transactions that reference it, and last year's dispatches would stop
adding up. This is the same answer already reached for accounts: `User.isActive` exists
because every `Transaction` carries a `userId` and deleting a leaver punches holes in the
trail. Items carry that trail more strongly still — *every* transaction has an `itemId`.

**The decision: a `discontinued` flag, whose primary job is silencing the low-stock alert.**
A discontinued item runs down to zero and then sits below `minStock` forever, raising an
alert that will never be actioned. That is not cosmetic. A low-stock list with permanent
noise in it is a list people stop reading, which is precisely the failure the reorder
feature exists to prevent.

### Scope

- `discontinued Boolean @default(false)` on `Item`. Eleventh migration; a defaulted boolean
  is a plain `ALTER TABLE` on SQLite, so Turso needs nothing special for it.
- **One predicate owns the low-stock rule**, with the flag folded into it — see below.
- A toggle on the item detail page under `item:manage`, reversible.
- A badge in the items list, so a quiet item shows *why* it is quiet instead of looking like
  an item nobody set a minimum for.
- Discontinued items **stay** in `/items`, in history, in reports and in the dashboard's
  activity. Nothing is hidden; one alert is silenced.

### The part that must not be got wrong

The low-stock rule is currently re-derived in three places, each computing
`currentStock < minStock` independently:

| Where | What it drives |
|---|---|
| [dashboard/page.tsx:42](src/app/dashboard/page.tsx:42) | the low-stock list, and hanging off it the *"+ 300 m at 3 sites"* lookup |
| [items/page.tsx:71](src/app/items/page.tsx:71) | the row badge in the items table |
| `src/app/items/[id]/page.tsx:79` | the "Below minimum" badge on the detail page |

Adding `&& !item.discontinued` to three call sites is the weak form of this change: miss one
and the dashboard goes quiet while the items table still flags the item, or the reverse — and
nobody notices, because a **missing** alert looks exactly like a healthy item. So the flag
lands as a single predicate, `isBelowMinimum(item)`, that all three read through, and a fourth
low-stock surface added later inherits the rule instead of forgetting it. Same reasoning as
`effectiveFlagged` in [siteBalance.ts](src/lib/siteBalance.ts) and `resolveDatabaseUrl` in
[databaseUrl.ts](src/lib/databaseUrl.ts): make the wrong state underivable rather than
documenting that nobody should derive it. Invariant 5's pattern, applied to a smaller thing.

### Deliberately not in scope

- **Removing discontinued items from the pickers** — the dispatch, delivery, transaction and
  shelf-assignment dropdowns. That changes what people can do day to day, and it is the wrong
  default anyway: an item with 40 m still on the shelf should stay issuable until the stock is
  actually gone. Revisit once the flag has been in real use.
- **A real delete for a never-used item** — created five minutes ago with a typo in the SKU —
  gated on zero transactions, packs, defects and pickups. Reasonable on its own, but a
  separate decision: folding it into the same control would blur "we stopped stocking this"
  with "this was a mistake".
- **Refusing the flag while stock remains.** An item still on the shelf is being run down,
  not yet gone. Warn on the toggle; do not block. The flag records purchasing intent, and the
  stock reaches zero on its own.

### Verification

1. An item below its minimum shows the alert on all three surfaces. Flag it discontinued —
   all three go quiet **together**. Unflag — all three come back together.
2. A discontinued item still appears in `/items`, still opens, still shows its full history,
   and still appears in every item picker.
3. Issue against a discontinued item that still holds stock: works normally, packs and all.
4. The dashboard's *"+ N at M sites"* line disappears with the suppressed alert — it hangs
   off the low-stock list, so this should fall out for free. Confirm that it does.

## Decided 2026-09-05: FINANCE absorbs EMPLOYEE, and asks an admin for the rest 🔨 PARTS 1 AND 3 BUILT; PART 2 NOT

**This reverses an earlier call.** "Approval workflows (employee requests → finance approves)"
sat in *Out of scope* below since the original plan. The requirement changed: the employee
account is being retired, and the client wants finance to reach the admin-only housekeeping
without an admin sitting at the machine. The direction is also inverted from the old note —
it is **finance requesting, admin approving**, not the reverse. The out-of-scope line has been
struck through accordingly.

Three separable changes, deliberately sized and shipped apart because their risk profiles are
nothing alike. The full implementation plan — file-by-file, with the staged sequence — lives at
`C:\Users\Kavita\.claude\plans\hazy-weaving-spring.md`. **That file is outside the repo and is
therefore not durable; this section is the record.**

### Part 1 — fold EMPLOYEE into FINANCE (≈1 hour, no migration) ✅ BUILT

> **As built, 2026-09-05.** Exactly as written below: the five capabilities added to the
> `FINANCE` array as their own commented block, both false comments rewritten
> (`permissions.ts`'s header and the `///` on `enum Role`), and both `ROLE_BLURB` maps updated.
> `EMPLOYEE` kept and documented as retired. **No migration.**
>
> **One addition the plan does not mention:** `/users` now defaults a new account to **Finance**
> and labels the option *"Employee — retired, do not assign"*. "Stop granting it" is a rule
> someone has to remember; a picker that still defaulted to Employee would have kept handing it
> out. Same instinct as the rest of this file — make the wrong state harder to derive than to
> avoid.
>
> **Verified as `finance@example.com` against a local copy** (never the pilot): the Stock Out nav
> group appeared; **10 Cable Ties were issued to Kandivali through the real form**, stock 217 →
> 207, recorded as `ISSUE | 10 | by Finance (FINANCE)`; the site page gained
> consume/transfer/flag. And the boundary held **server-side**, which is the only check worth
> anything here — submitting the site edit form as finance left the name unchanged in the
> database, and `/users`, `/backups` and `/sites/new` all still bounced. The retired employee
> account still signs in and still works. `npm test` 86/86, `tsc` clean, `npm run build` passes.
>
> **A pre-existing bug fixed in the same change, because Part 1 promoted it from latent to
> daily.** [sites/[id]/page.tsx](src/app/sites/[id]/page.tsx) rendered the Edit Site form
> unconditionally while `updateSite` requires `site:manage`, so a non-admin got a form that threw
> `NotPermittedError` into the error boundary on save — reproduced live before fixing. Finance
> now uses site pages every day, so the card is gated and non-admins get a read-only panel. This
> is the bug §6 of the plan predicted would be fixed "incidentally" by Part 2's re-labelling; it
> could not wait that long.
>
> **Not done, and needed before Part 2:** `shelf/[shelfId]/page.tsx:46`'s hardcoded `isAdmin`,
> below. It is harmless today because finance holds no `shelf:manage` either way.

The five employee capabilities — `stock:issue`, `stock:return`, `stock:consume`,
`stock:transfer`, `site:pickup` — are added to the FINANCE array in
[permissions.ts](src/lib/permissions.ts). Nothing else needs editing: the nav gains the Stock Out
group because [AppShell.tsx](src/components/AppShell.tsx) filters on `can()`, `/transactions/new`
and `/dispatches/new` open because [proxy.ts](src/proxy.ts) maps them to `stock:issue`, and
`recordMovement`'s `CAPABILITY_FOR_TYPE` lookup starts passing. It is a code table, not a column.

**Two comments become false and must be rewritten in the same commit.** The header at
`permissions.ts:5-14` ("Roles are workspaces, not permission levels … FINANCE brings stock in and
cannot issue it") and the `///` comment on `enum Role` in
[schema.prisma](prisma/schema.prisma), which lands in the generated client. In a codebase where
the comments carry the reasoning, leaving them stating the opposite of the code is a defect, not
untidiness.

**The `EMPLOYEE` role stays in the enum.** Removing it means a migration with a hand-written data
backfill — the precedent is `20260820150000_roles_finance_employee`, which renamed STAFF →
EMPLOYEE exactly that way — and it breaks existing employee logins plus every `Record<Role, …>`
map in the app. Leave it, document it as retired, stop granting it, and move accounts to FINANCE
one at a time from `/users`. `ROLE_BLURB` in [users/page.tsx](src/app/users/page.tsx) and
[account/page.tsx](src/app/account/page.tsx) should say it is retired.

**One file the plan's list misses, found 2026-09-05.**
[shelf/[shelfId]/page.tsx:46](src/app/shelf/[shelfId]/page.tsx:46) derives `const isAdmin = role
=== "ADMIN"` — a hardcoded role test, not `can()` — and that prop gates the entire `ShelfGrid`
popover. Left as it is, finance gets a shelf map whose cells do not open, so under Part 2 there
is nothing for them to request. It is a standing inconsistency independent of this change:
granting `shelf:manage` to FINANCE today would leave the controls hidden anyway. Same page reads
its role from the JWT via `auth()` rather than `currentUser()`, so a just-demoted user keeps the
controls until their token turns over — cosmetic, since the actions re-check, but worth knowing.

**A control being given up, which should be named rather than discovered later.** After Part 1
one FINANCE account can receive goods *and* dispatch them with nobody else in the loop. That
separation was not incidental — it is what `permissions.ts`'s header, the `Role` doc comment and
both `ROLE_BLURB` maps all describe, and it is the reason the seeded accounts were never meant to
share a password. Retiring the employee account is the client's decision and this plan follows
it; the point is that the doc must say what was traded away, or a future reader will read the
merge as tidying rather than as a deliberate loosening.

Net effect once built: **FINANCE is ADMIN minus accounts and backups**, with five capabilities
reachable only through an approval.

### Part 2 — the approval workflow (≈3-5 days)

A FINANCE user attempting an admin-only action is no longer refused; the attempt becomes an
`ApprovalRequest` row. Every admin sees it, the first admin to answer decides it, and it leaves
the queue for everyone. In-app only — no email, no push, no polling: a server-rendered pill in
the [AppShell](src/components/AppShell.tsx) header plus an `/approvals` page, fresh on every
navigation because `AppShell` already calls `auth()` and is therefore dynamic.

Requestable: `site:manage`, `shelf:manage`, `shelf:delete`, `stock:reverse`, `stock:adjust`.

**Two capabilities are deliberately NOT requestable, and this is the part most likely to be
re-litigated wrongly:**

- **`user:manage`.** An approval flow that can mint an admin is not an approval flow. Account
  management stays hard admin-only, at the client's explicit instruction.
- **`backup:manage`.** `restoreDatabase` in [restore.ts](src/lib/backup/restore.ts) drops and
  recreates every table. An approved restore would erase the `ApprovalRequest` row that
  authorised it *and* the record of which admin approved it. The feature would delete its own
  audit trail. This is not a policy preference — it is a fact about what restore does.

`item:manage` needed no work: it was **already** in the FINANCE list, so finance has been able to
add item types all along. The original request listed it as an admin feature to unlock; it wasn't
one.

#### The four things that must not be got wrong

**1. The operation bodies must move out of the `"use server"` files.**
[sites.ts](src/lib/actions/sites.ts), [shelf.ts](src/lib/actions/shelf.ts) and
[corrections.ts](src/lib/actions/corrections.ts) carry a top-level `"use server"`, which makes
**every async export a network-reachable RPC endpoint.** The obvious refactor — leave the body
where it is and export an unguarded `deleteSiteCore` for the approval path to call — publishes an
unauthenticated delete. That is exactly the hazard `permissions.ts:134-138` already warns about
("actions are directly invocable — anyone can replay the POST"). The bodies go to plain modules
under `src/lib/approvals/ops/`, and the action files keep only thin guarded wrappers. Imports
then run one way — `actions → registry → ops` — so no cycle is possible, and the domain logic
becomes reachable by a test for the first time.

**2. The claim and the work share one transaction.** Two admins clicking Approve at the same
instant must not run the operation twice. The lock is a conditional update whose row count is the
guard, *inside* the same `$transaction` as the work:

```ts
const claim = await tx.approvalRequest.updateMany({
  where: { id, status: "PENDING" },          // ← the guard
  data: { status: "APPROVED", decidedById: admin.id, decidedAt: new Date() },
});
if (claim.count === 0) throw new AlreadyAnswered();
await op.execute(tx, args, row.requestedById);
```

SQLite/libsql serialises write transactions, so the second admin cannot start writing until the
first commits — at which point `WHERE status = 'PENDING'` matches nothing. Sharing the
transaction is what removes the crash window: a failure mid-flight rolls the claim back too, so
the request is simply still pending and **no `EXECUTING` state is needed**. It is also what makes
`FAILED` honest — it means "nothing happened, here is why", never "half happened".

One trap: **do not map SQLITE_BUSY to `FAILED`.** Under contention Prisma surfaces a busy/timeout
error from the transaction; treating that as an operation refusal burns a perfectly good request.
Detect it and ask the admin to retry — the one case where the row must stay `PENDING`.

**3. Asking is not a permission.** `canRequest` lives in a **second table**, `REQUESTABLE`, never
as a softening of `can()` — every `requireCapability` in the app depends on `can()` meaning "may
do it, now, alone". `requireCapability` is unchanged and stays the hard gate. The queue itself
splits into two capabilities, `approval:view` (ADMIN + FINANCE, so finance can follow its own
requests) and `approval:decide` (ADMIN), for the same reason `shelf:manage` and `shelf:delete`
are split at `permissions.ts:29-35`. With the split, the nav filter and `NavLink`'s type need no
change at all.

The three tables move to a new pure `src/lib/capabilities.ts` so they can finally be tested:
`permissions.ts` imports `@/lib/auth` and `@/lib/prisma`, and the `@/` alias does not resolve
under `node --experimental-strip-types`, which is why there is no `permissions.test.ts` today.
The invariants — the two tables disjoint, `user:manage`/`backup:manage` in no requestable list,
`approval:decide` implying `approval:view` — become a failing build rather than a comment.
Invariant 5's pattern again: make the wrong state underivable.

**4. The summary is built server-side and frozen; the pre-check is live.** `ApprovalRequest.summary`
is written from the row as it then was, never from a requester-supplied label — otherwise finance
could label a delete of site A as "delete site B" and phish an approval. It is frozen because the
site may be renamed or gone by the time an admin looks. The *live* truth comes from re-running the
operation's own preconditions at render time, so the admin reads "this will now fail: 1 dispatch
attached" before clicking. For reversals that re-check is the existing `findReversalObstacles` /
`describeObstacle` — the admin sees the same sentence the operation itself would produce.

#### Two execution blockers found on 2026-09-05, while reviewing this plan against the code

Neither is a design problem; both stop Part 2 landing if they are not dealt with first.

**1. An eleventh migration has no path to the live pilot.** The staged sequence says
`npx prisma migrate dev --name approval_requests`, which is right locally — but
`prisma migrate deploy` **cannot reach Turso** (`P1013: scheme not recognized`, recorded in the
Phase 8 section above), and the one-off `executeMultiple()` script that applied the first ten
migrations *was run once and discarded*. `scripts/` holds only `backup-database.ts`. So the
migration would land on `dev.db` and silently never reach production. **Write and commit a
`scripts/apply-migration-turso.ts` before stage 2**, and take a dump first — this is the first
schema change against a database carrying the client's real stock.

**2. The approve path's transaction is now coupled to `vercel.json`.** `approveRequest` puts the
claim and the work in **one** `prisma.$transaction`, whose interactive timeout defaults to 5s.
The heaviest operation is `stock.reverseDispatch`, which loops `reverseMovementTx` over every
`ISSUE` line — a 15-row dispatch is 90+ sequential statements. At the ~15 ms per statement
measured from Mumbai that is about 1.4s, comfortable. At the ~230 ms it was paying before the
region fix it would have been roughly 20s, and would have timed out *every time*. Set an explicit
`timeout`, and note in the code that `vercel.json` has stopped being a performance tweak and
become a correctness dependency — the warning above about not deleting it now protects this
feature too.

#### A naming collision

"Approval" is already taken and means something unrelated: `ApprovedOpens`
([packs.ts:160](src/lib/packs.ts)) and `needsApproval` in `transactions.ts` / `dispatches.ts` are
the **in-request** handshake where the user confirms "yes, break open 2 sealed packs" — same
request, same user, nothing to do with roles. The new feature lives under `ApprovalRequest` /
`approvals/` and must not reuse those names.

### Part 3 — adjustments store the correction, not the count (≈½ day) ✅ BUILT

> **As built, 2026-09-05.** Two commits: `0b89701` then `45aea35`. New pure
> [adjustment.ts](src/lib/adjustment.ts) (`planAdjustment` / `computeDelta` / `describeRefusal` /
> `describeAdjustment`) with 16 tests, 70 → **86**; `adjustStock` rewritten to plan-then-execute
> against freshly-read packs, applying `increment`/`decrement` rather than assignment;
> `CorrectionPanel` posts a hidden `ledger_<key>` beside each count; the `ADJUSTMENT` doc comment
> in `schema.prisma` rewritten. **No migration** — the comment is the only schema change, so
> Turso needed nothing.
>
> **A worse bug was found underneath this one, and it had to be fixed first.** `adjustStock`
> validated *every* entry of the submitted `FormData` as a non-negative integer — including the
> `reason` the same form posts. `Number("annual count")` is `NaN`, so **every adjustment carrying
> a real reason was refused** with "Counted quantities must be whole numbers of zero or more",
> and nothing was written. Only a numeric reason got through, and that set no counts. So
> recording a stock count had **never once worked** since Phase 3 built it. The evidence was
> sitting in plain sight: zero `ADJUSTMENT` rows in a development database that had been through
> every phase's verification. Phase 3's own as-built note claims only the *reversal* path was
> exercised in the browser — the adjustment half of its verification list was written and never
> run. Fixed in `0b89701`, on its own, because until it was the delta change could not be
> observed at all.
>
> **⚠️ Which means the verification below is wrong where it says "the old code gives 13".** It
> did not; it returned a validation error. That before/after never existed. The real
> demonstration, run instead, is in the next paragraph.
>
> **Verified in the browser, two tabs, against a local `file:./dev.db` copy — never the pilot.**
> Tab 1 held the count form on `WIRE-2.5` showing 3 sealed 100 m rolls. Tab 2 then opened one
> (a real movement through `openPackAction`), leaving **2 sealed and a new 100 m open pack**.
> Tab 1, never reloaded, submitted a count of **4** — a +1 correction against the ledger of 3 it
> was still displaying. Result: **3 sealed, and the opened pack untouched**, note reading
> *"Counted 2600 m against a ledger of 2500 (+100). Applied to a ledger of 2500, giving 2600."*
> The absolute write would have set sealed to 4 and left the open pack in place, inventing 100 m
> from nothing with no error anywhere — the silent failure this section predicted, reproduced
> and then removed. Then sealed was driven to 1 and a count of 0 submitted against the stale
> ledger of 3: **refused** — *"Applying this count would leave sealed 100 packs at -2: … there is
> now only 1 to apply -3 to."* Nothing written, not clamped. Console clean on both tabs.
> `npm test` 86/86, `tsc --noEmit` clean.
>
> **Three deviations from what is written below**, all deliberate:
>
> 1. **The note carries no timestamps.** The example below reads *"Counted 13 at 10:05 … Applied
>    at 12:40"*, but the form submits no count time, and render time is not count time — the
>    figure would have been invented, which in a record whose whole job is honesty is worse than
>    omitting it. The two ledger totals carry what matters. Part 2 gets a real count time for
>    free from `ApprovalRequest.createdAt`, and that is the moment to add it.
> 2. **A count arriving with no paired `ledger_` field is refused**, not quietly applied as an
>    absolute write. A fallback would silently reintroduce the exact bug being removed, so a
>    stale cached page gets *"This count form is out of date — reload the item page and count
>    again."*
> 3. **Refusals are collected rather than thrown on the first**, matching `recordDelivery` and
>    `recordDispatch`. The caller still refuses the whole adjustment if any survive.
>
> **Deliberately NOT fixed, and still true: `adjustStock` does not re-evaluate the scrap
> threshold.** A count can leave a remainder at or below it still marked `OPEN` and still counted
> as stock, where `addOpenPack` and `commitAllocation` would have scrapped it — and a physical
> count is exactly when someone discovers a roll is nearly gone. Pre-existing, unchanged here,
> and left alone on purpose: fixing it means deciding whether an adjustment also writes a `SCRAP`
> row, and if it does, `quantity = |after − before|` starts conflating a count correction with a
> reclassification. That is a second decision, and it does not belong inside a change shipped for
> its arithmetic. **Its own ticket.**

**This is a live bug, found while planning Part 2, and it is worth fixing whether or not Part 2
is ever built.**

`adjustStock` ([corrections.ts:168-241](src/lib/actions/corrections.ts)) records an **absolute**
count: it *sets* `sealedCount = counted` and `remaining = counted`. That is stale the moment
anything legitimate happens after the count is taken. Nothing stops a dispatch landing between
opening the count form and pressing Submit, and the absolute write silently erases it. An
approval queue widens the window from seconds to hours; it did not create it.

**The fix: the UI stays a count, the storage becomes a delta.** A human must count what is on the
shelf — asking them to type "+3" is asking them to do arithmetic against a number they cannot
see. So the form keeps its "enter what is physically there" field and its "(ledger says 10)"
label, and additionally submits the ledger figure it *displayed* as a hidden input. The server
stores `counted − ledgerTheCounterSaw` and applies it with `{ increment: delta }` — already the
house idiom, used by `addPacks` at [packs.ts:75-79](src/lib/packs.ts).

> Ledger says 10; the shelf holds 13 — three packs received last month, never booked in. The
> correction is filed at 10am. At 11am two packs are legitimately dispatched: ledger 8, shelf 11.
> Approved at noon.
>
> - **Absolute:** sets sealed to 13, re-inventing the two dispatched packs. No error anywhere.
> - **Delta:** 8 + 3 = 11. Correct.

A delta captures the **size of the error**, which is invariant under legitimate movement. It also
removes a silent failure: opening a sealed pack decrements `sealedCount` and creates an
`OpenPack`, and the absolute write overwrites that decrement and silently re-invents the opened
pack. Under a delta the correction applies to the new lower figure and the new pack is left alone
— right, because the counter never made a claim about it.

Two cases remain, both **loud**, with no silent one left:

1. **A pack being corrected was deleted meanwhile.** A delta cannot apply to a row that is gone,
   and the packs cannot be pooled instead — the whole point of `OpenPack` is that a 30 m and a
   50 m remainder are not interchangeable. Refuse the whole adjustment; a partial count is not a
   count.
2. **The result would go negative** — new failure mode. Sealed 10, correction −4, then 8 get
   dispatched: applying gives −2. **Refuse, never clamp.** `remaining` must likewise stay within
   `(0, originalSize]`, and a delta landing on exactly 0 deletes the pack, the same rule as
   today's `counted === 0`.

`Transaction.note` has two moments to describe now, e.g. *"Counted 13 at 10:05 against a ledger of
10 (+3). Applied at 12:40 to a ledger of 8, giving 11."* `quantity` stays `Math.abs(after -
before)` — the real effect on stock, which is what the reports aggregate. The `///` comment on
`TransactionType.ADJUSTMENT` should say the row stores a correction of known size, not a snapshot.

**Do not generalise this to reversals.** `stock:reverse` refuses when the world has moved *on
purpose* — `appliedPlan` exists so that restoring a roll which has since been cut cannot invent
wire that no longer exists. A delta would break that. Part 3 is `stock.adjust` only.

**This is the highest-risk item in the whole plan despite being the smallest**, because it is the
only one that touches stock arithmetic on a live deployment carrying real stock. Ship it alone,
verify it alone, before anything in Part 2 lands.

### Deliberately not in scope

- **Real-time notification.** No email, no push, no polling — the client asked for a plain in-app
  request. An admin sitting still on a page sees nothing until they navigate. Revisit only if
  that actually bites.
- **Employees requesting anything.** `REQUESTABLE.EMPLOYEE` is empty. The role is being retired;
  giving it a new power on the way out makes no sense.
- **Approving on someone's behalf, or delegating.** One admin, one click, one row.
- **An expiry on stale pending requests.** Worth revisiting once there is evidence they pile up.

### Verification

Beyond the per-part checks in the plan file, three that matter most:

1. **The regression gate, as ADMIN, before any finance path is touched.** All twelve rewired
   flows — create/edit/delete site, create/delete shelf, relabel a box, assign an item, toggle
   front-row, reverse a transaction, reverse a dispatch, record a count — must behave exactly as
   before, redirects included. Part 2 rewires eleven live write actions on a deployment with no
   test coverage below the pure-function layer; this walkthrough is the only thing standing in
   for those tests.
2. ~~**Part 3, with no approval involved.** Item with 10 sealed packs. Open the count form, and in
   a second tab dispatch 2 of them. Submit a count of 13. The answer must be **11**. Today's code
   gives 13.~~ ✅ **Done 2026-09-05, but read the correction.** "Today's code gives 13" was
   false — it gave a validation error, because the reason field was being validated as a number
   (see the as-built note above). The shape of the check was right and was run with the movement
   supplied by opening a sealed pack rather than dispatching: form showing 3 sealed, one opened
   in a second tab leaving 2, count of 4 submitted from the stale form → **3**, with the newly
   opened pack untouched. Plus the negative refusal and the pack-gone refusal.
3. **The race.** The same pending request open in two admin tabs; approve in both. The second
   returns "another admin answered this first", and the operation ran exactly once.

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
- ~~Approval workflows (employee requests → finance approves).~~ **Reversed 2026-09-05** — see
  "FINANCE absorbs EMPLOYEE, and asks an admin for the rest" above. Note the direction is also
  inverted from what this line assumed: it is **finance requesting, admin approving**. Decided in
  full; the queue itself (Part 2) is not built, though Parts 1 and 3 of the same decision — the
  role merge, and the adjustment delta, both of which stand alone — landed 2026-09-05.
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

**Phase 5 — delivery** ✅ *all 7 passed 2026-08-20, checked in the browser; see
"Phase 5 — as built" above for the numbers each one produced*
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

**Phase 6 — site lifecycle** ✅ *all 9 passed 2026-08-20, checked in the browser; see
"Phase 6 — as built" above for the numbers each produced. The FIFO age logic and the
transfer-aware delta are additionally covered by `siteBalance.test.ts`.*
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

**Phase 7 — UI overhaul** ✅ *all 8 passed 2026-08-21, checked as each step landed. See the
"as built" note at the top of the Phase 7 section for the one thing verification caught (a
test-script bug, not an app bug) and how each item below was actually checked.*
1. **The variant switch, immediately after step 1** — build, then grep
   `.next/static/css/*.css`: `[data-theme="dark"]` appears many times, and
   `prefers-color-scheme` does **not** wrap the `zinc-` utilities. This is the check that
   catches a silent failure across all 20 pages.
2. **Theme is chosen, not inherited:** set the **OS** to dark with the app on light — it must
   stay fully light. Toggle to dark, reload → the choice persists with **no flash** of the
   wrong theme on first paint.
3. **Roles drive the sidebar:** sign in as admin, finance and employee; the visible links must
   match `CAPABILITIES` in [permissions.ts](src/lib/permissions.ts) exactly. Then replay a
   server action the role lacks — still **rejected**, since the nav is convenience only.
4. **Active nav state:** `/dispatches` and `/dispatches/new` must light *one* link each, not
   both. Covered by `activeHref.test.ts`, confirmed once in the browser.
5. **The six preserved interactions**, each exercised by hand — see the list above. The two
   that fail *silently* rather than visibly: the dispatch per-row open-approval must still
   reset when that row is edited (a stale approval is a wrong write, not a cosmetic bug), and
   the shelf popover must not be clipped by any new card wrapper.
6. **Mobile at 375px:** drawer opens, closes on link click and on Escape; no horizontal page
   scroll; the dispatch and delivery card-per-row screens still hold.
7. **`npm test` stays green throughout.** A failure means the markup-only rule was breached.
8. **Read the browser console on every check**, not just the screenshot — twice in this
   project a "verified" that skipped the console missed a real bug.

**All phases**
1. `npx tsc --noEmit` and `npm run build`.
