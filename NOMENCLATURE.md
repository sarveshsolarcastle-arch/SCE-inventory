# Item Naming Standard

Last updated: 2026-09-09. For whoever adds a new Item to the catalogue — this is the rule to
follow so the 115th item is findable the same way as the 1st.

Built from two sources: the 114 items already live in the database, and the "Pack Structure"
audit of the physical stock sheet. Every "before" example below is a real name already in the
catalogue — not a hypothetical. That catalogue grew organically with no naming rule, which is
exactly why search is hard today: the same concept (colour, a cable's size, a bolt's length) is
written five different ways depending on who typed it in and when.

This standard is for **items added from now on**. It does not require renaming the 114 that
already exist — that's a separate cleanup, only worth doing if search pain justifies it.

---

## 1. The name: three parts, in order

```
<Item> - <Spec> - <Variant>
```

- **`<Item>`** — what it fundamentally is. Title Case. No brand name here unless the brand
  *is* the spec (e.g. an inverter model).
- **`<Spec>`** — the one or two numbers that distinguish this from a sibling item: size,
  rating, length, diameter. Omit if the item has no meaningful variants (a mop doesn't need one).
- **`<Variant>`** — colour, or another either/or property (e.g. "Left" / "Right"). Omit
  entirely if not applicable — don't write `- None`.

Join with `" - "` (space, hyphen, space) — the same separator already used for
`Insulation Tape - Black`. Never a bare `-` with no spaces, never a comma, never parentheses
for these three parts (parentheses are fine *inside* a spec, e.g. `M6 x 28mm`).

**Worked examples — before (real, live) → after:**

| Before | After |
|---|---|
| `hex bolt(24*4mm)` | `Hex Bolt - 24x4mm` |
| `M6 alen bolt (28mm)` | `Allen Bolt - M6 x 28mm` |
| `cu ring lug(10-8sqmm)` | `Copper Ring Lug - 10-8 sqmm` |
| `SS flat washer(20mm,6mm)` | `Stainless Steel Flat Washer - 20mm OD / 6mm ID` |
| `flexible pie ,white` | `Flexible Pipe - 20mm - White` |
| `AC cable,black,4core x 4sqmm,` | `AC Cable - 4 Core x 4 sqmm - Black` |
| `Ring Type Lug 10sqmm  (ed:10mm , id:6mm)` | `Ring Lug - 10 sqmm, 10mm OD / 6mm ID` |

Notice the pattern each fixes: a spec crammed into parentheses with no space before them, `*`
used instead of `x`, a colour buried mid-string, cryptic abbreviations (`ed`/`id`) spelled out.

### Colour vocabulary — pick one term, always

Cable/tape colours already drift across the catalogue: `white` sometimes means opaque white,
sometimes clear packing tape. Fixed list going forward:

`Red · Yellow · Blue · Black · Green · Brown · White · Transparent`

Use **Transparent** for clear tape (not "White" — that's now reserved for actual white
material). This is the distinction already applied to `Transparent Tape` vs `Brown Tape`.

---

## 2. SKU: short, uppercase, hyphen-joined abbreviation tokens

```
TOKEN-TOKEN-SPEC
```

Most-general concept first, most-specific last — same order as the name, just abbreviated.
Rules:

- **Uppercase only.** No lowercase, no mixed case.
- **Hyphen only.** No apostrophes (`'`), no `#`, no `.` except inside a decimal spec
  (`1.5` is fine — that's a number, not punctuation).
- **`X` for dimension products**, never `*`. `24X4`, not `24*4`.
- **No trailing punctuation.** (`SCRW-GI-1.5'` and `BOX-MTR-#3` are both live SKUs today and
  both violate this — the trailing `'` and the `#` are exactly what to avoid.)
- Keep it short enough to type from memory for a common item, but never so compressed it
  collides with something else. If in doubt, one token longer is cheaper than a collision.

**Worked examples:**

| Item | SKU |
|---|---|
| Hex Bolt - 24x4mm | `BLT-HEX-24X4` |
| Allen Bolt - M6 x 28mm | `BLT-ALN-M6-28` |
| Copper Ring Lug - 10-8 sqmm | `LUG-RNG-CU-10-08` |
| Flexible Pipe - 20mm - White | `PIP-FLX-20-WHT` |
| AC Cable - 4 Core x 4 sqmm - Black | `CBL-AC-4C-04-BLK` |

### Abbreviation glossary (extend as needed, don't reinvent)

| Token | Means | Token | Means |
|---|---|---|---|
| `BLT` | Bolt | `NUT` | Nut |
| `WSH` | Washer | `SCR` | Screw |
| `LUG` | Lug | `CBL` | Cable |
| `TAP` | Tape | `CLM` | Clamp |
| `PIP` | Pipe | `CND` | Conduit |
| `PLG` | Plug | `ISO` | Isolator |
| `GLD` | Gland | `KIT` | Kit |
| `INV` | Inverter | `SLR` | Solar |
| `EARTH` | Earthing | `TIE` | Tie |
| `ROD` | Rod | `THR` | Threaded |
| `FLG` | Flange | `HEX` | Hex(agonal) |
| `ALN` | Allen | `SD` | Self-drilling |
| `FLT` | Flat | `SPR` | Spring |
| `MTR` | Meter (measuring device) | `PNL` | Panel |
| `FER` | Ferrule | `MKR` | Marker |
| `DRN` | Drain | `SDL` | Saddle |
| `TR` | Tray | `END` / `MID` | End / Mid (clamp position) |
| `GI` | Galvanised Iron | `RAW` | Rawl(plug) |
| `ANR` | Anchor | `WKWY` | Walkway |

When you need a token that isn't here, add it to this table in the same commit — that's what
keeps the glossary trustworthy instead of aspirational.

---

## 3. Category: one of exactly three, chosen by function

The database only has `Fixing`, `Material`, and `Equipment` — the earlier 7-category proposal
(Fasteners/Cable/Electrical/Consumables/Mounting/Conduit/Equipment) was never adopted, so don't
reintroduce it. Pick by what the item *is for*, not what it's made of:

- **Fixing** — anything whose job is to mechanically join or mount something else: bolts,
  nuts, washers, screws, clamps, lugs, cable ties, plugs, glands.
- **Material** — stock that gets consumed, run out, or installed as the actual
  installation: cable, pipe, tape, panels, walkway, kits.
- **Equipment** — a discrete, often serialized unit with its own function: inverters,
  ACDB/DCDB boxes, isolators, meters, SPDs.

If an item plausibly fits two, ask "does this get *used up*, or does it *stay installed and
functioning on its own*?" — the former is Material or Fixing, the latter is Equipment.

---

## 4. Units: `measure`, `baseUnit`, `packUnit`

Get these three right and the Pack Structure model (sealed packs vs. loose/cut pieces) works
correctly from day one — the "Pack Structure v3" audit of the physical stock sheet is full of
items where these were missing and had to be reconstructed after the fact.

| Field | Rule |
|---|---|
| `measure` | `CONTINUOUS` only if a single piece can be cut shorter (cable, pipe, tape-off-a-roll where you'd cut it — **not** insulation tape, see below). Otherwise `DISCRETE`. |
| `baseUnit` | `pcs` for anything discrete. `m` for cable/large conduit runs. `cm` **only** when offcuts are routinely sub-metre (small-bore flexible pipe already does this — `black flexible pipe(10mm)` uses `cm` precisely because its offcuts are 13cm, 26cm, etc.). `box` only for an Equipment item counted by sealed unit. |
| `packUnit` | What a sealed pack is called: `packet`, `roll`, `box`. Leave `null` if the item is never sold/stored pre-packaged. |

**Tape is DISCRETE, not CONTINUOUS** — you can't unroll it and re-measure what's left without
spoiling the roll, so it's counted by whole roll (sealed = unopened rolls, open = rolls already
in use), never by remaining length. This was a real ambiguity resolved during the Pack
Structure work; it's now a rule, not a one-off judgment call.

---

## 5. Before you save a new item — checklist

1. Name follows `Item - Spec - Variant`, joined by `" - "`, Title Case, spec uses `x` not `*`.
2. Colour (if any) is from the fixed vocabulary in §1, placed last.
3. SKU is uppercase, hyphen-only, no apostrophes/`#`, dimensions use `X`.
4. Every SKU token is in the glossary (§2) — or you just added it there.
5. Category is Fixing / Material / Equipment, chosen by function (§3).
6. `measure` + `baseUnit` + `packUnit` are set correctly (§4) — get this wrong and the item's
   stock math breaks silently later, it won't error at entry time.
7. No typos — "Photovoltic", "drillin", "inventors" (for inverters) are all live in the
   catalogue today. Read the name back once before saving.
