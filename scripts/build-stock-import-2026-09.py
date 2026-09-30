"""Builds scripts/stock-import-2026-09.json from the client's new stock sheet
("newly updated (1).xlsx", supplied 2026-09-19) to REPLACE the current
production catalogue and stock (both loaded from the earlier "Pack Structure
v3" sheet via build-stock-import.py / import-stock.ts).

Run:
    python scripts/build-stock-import-2026-09.py "<path to the .xlsx>"

The new sheet has a different, sparser layout than the old one: columns are
Nomenclature, SI ITEM, CATEGORY, MEASURE, BASEUNIT, PACKSIZE, PACKUNIT,
OPEN PIECES (m), and two unheaded note columns (I, J). There is no SKU column
and no per-row "sealed packs" count or self-check total, unlike the old sheet.

Decisions encoded below (all inferred from the sheet's own notation, since
there was no client walkthrough for this file the way there was for the
first one on 2026-09-09 -- see build-stock-import.py):

  * SKUs are generated from the item name (same slug style as the existing
    catalogue, e.g. "AC Cable - 1 Core x 4 sqmm - Black" -> AC-CBL-1-C-X-4-BLK
    was hand-picked before; here we derive mechanically -- see skuify()).
  * OPEN PIECES (col H) is read as: for CONTINUOUS items, a comma-separated
    list where EACH number is one physical offcut (an individual OpenPack,
    same rule as the original sheet); for DISCRETE items, the numbers are
    summed into a single loose quantity (order/grouping doesn't matter --
    discrete stock pools freely).
  * A note in column I/J of the form "<N>pkt(s)[, <size> each]" means N
    additional SEALED packs exist on top of the OPEN PIECES loose count.
    Size comes from the note itself when given ("50 each"), else from the
    PACKSIZE column. Seen on: Cable Tie Metal/Nylon (8pkts, size from
    PACKSIZE=100), Metal Flat Screw (1 pkt each 100), Rawal Plug Large
    (3pkt, 50 each -- overriding PACKSIZE=100, since the note is more
    specific about this actual batch).
  * A PACKSIZE value with NO matching column I/J note (Double Nail Clamp,
    Rawal Plug Small, Spring Washer) is read as purely descriptive -- how the
    item is normally packaged -- with ZERO currently-sealed packs; the OPEN
    PIECES number is the entire current stock, loose.
  * "(new)" appearing inline in a number or item name is a recency label the
    client added for their own tracking and carries no numeric meaning here;
    it is stripped and the number/row is treated normally.
  * The three Flexible Pipe items keep the 2026-09-09 precedent of moving to
    cm (scale x100, round half-up) because their offcuts are sub-metre
    (e.g. 0.13 m) and CONTINUOUS stock cannot live in a fractional base unit.
  * The one duplicate name (Self-tapping Screw - 40x5mm, rows 81 & 82) is
    merged, matching how the first sheet's duplicates were merged.
  * U Bolt has a blank BASEUNIT cell -> defaults to 'pcs' (matches the
    schema's own Item.baseUnit default).
  * Rows with OPEN PIECES literally "0" and no sealed-pack note (Deye String
    Inverter 10 KW) import as zero-stock items, same as the first sheet's
    zero-stock rows.

This is a REPLACE, not an additive import: every item from the previous load
is being retired and re-created from this sheet, so there is no cross-check
against a prior "expected total" column (this sheet has none) -- the per-item
totals below ARE the new source of truth pending the user's review.
"""
import sys as _sys
import openpyxl, json, re, math
from collections import OrderedDict

SRC = _sys.argv[1] if len(_sys.argv) > 1 else r'C:\Users\Kavita\Downloads\newly updated (1).xlsx'
wb = openpyxl.load_workbook(SRC, data_only=True)
ws = wb['Sheet1']
rows = list(ws.iter_rows(values_only=True))
hdr = [str(c).strip() if c else '' for c in rows[0]]

def idx(name):
    return hdr.index(name)

I_NAME, I_SI, I_CAT, I_MEAS, I_BASE, I_PACKSIZE, I_PACKUNIT, I_OPEN = (
    idx('Nomenclature'), idx('SI ITEM'), idx('CATEGORY'), idx('MEASURE'),
    idx('BASEUNIT'), idx('PACKSIZE'), idx('PACKUNIT'), idx('OPEN PIECES (m)'),
)
I_NOTE1, I_NOTE2 = 8, 9  # columns I, J -- unheaded

recs = []
for i, r in enumerate(rows[1:], start=2):
    name = r[I_NAME]
    if not name or not str(name).strip():
        continue
    note = ' '.join(str(r[c]).strip() for c in (I_NOTE1, I_NOTE2) if r[c] not in (None, ''))
    recs.append({
        'row': i,
        'name': str(name).strip(),
        'si': str(r[I_SI] or '').strip().upper() == 'YES',
        'category': str(r[I_CAT] or '').strip() or None,
        'measure': str(r[I_MEAS] or 'DISCRETE').strip().upper().replace('CONTINIOUS', 'CONTINUOUS'),
        'baseUnit': str(r[I_BASE] or 'pcs').strip() or 'pcs',
        'packSize': r[I_PACKSIZE],
        'packUnit': (str(r[I_PACKUNIT]).strip() if r[I_PACKUNIT] not in (None, '', 'NA') else None),
        'open': '' if r[I_OPEN] is None else str(r[I_OPEN]).strip(),
        'note': note,
    })

# Matched against skuify() output, not guessed -- see the loud check right
# after the parse loop, which fails the build if these ever drift.
TO_CM = {'FLEXI-PIPE-10MM-BLACK', 'FLEXI-PIPE-20MM-BLACK', 'FLEXI-PIPE-WHITE'}

def numbers(text):
    """All numeric tokens in text, ignoring parenthetical/word annotations."""
    text = re.sub(r'\([^)]*\)', ' ', text or '')  # drop "(new)" etc.
    return [float(x) for x in re.findall(r'\d+(?:\.\d+)?', text)]

def skuify(name):
    base = re.sub(r'\s*\((?:new|old)\)\s*$', '', name, flags=re.I)  # trailing (new)/(old)
    base = re.sub(r'[^A-Za-z0-9]+', '-', base).strip('-').upper()
    parts = [p for p in base.split('-') if p]
    # Trim overly long tokens the same rough way the first sheet's hand-picked
    # SKUs did, so results stay in the same style/length ballpark.
    out = []
    for p in parts:
        out.append(p[:5] if p.isalpha() and len(p) > 5 else p)
    sku = '-'.join(out)[:40]
    return sku

NOTE_RE = re.compile(
    # "<N>pkt(s)" then optionally the pack size, which appears on either side
    # of "each": "3pkt, 50 each" (row 72) vs "1 pkt each 100" (row 62).
    r'(\d+)\s*pkts?\.?\s*(?:,?\s*(?:(\d+(?:\.\d+)?)\s*each|each\s*(\d+(?:\.\d+)?)))?', re.I
)

def parse_note(note, packsize_col):
    """Returns (sealedCount, sealedSize) or None if the note has no pack info."""
    if not note:
        return None
    m = NOTE_RE.search(note.replace(' ', ' '))
    if not m:
        return None
    count = int(m.group(1))
    size_str = m.group(2) or m.group(3)
    size = float(size_str) if size_str else (float(packsize_col) if packsize_col else None)
    if not size:
        return None
    return count, int(size)

items = OrderedDict()
judgment_calls = []

for d in recs:
    sku = skuify(d['name'])
    base = d['baseUnit']
    scale = 1
    if sku in TO_CM:
        base, scale = 'cm', 100

    raw_open_nums = numbers(d['open'])
    measure = 'CONTINUOUS' if d['measure'].startswith('CONTIN') else 'DISCRETE'

    loose = []
    if measure == 'CONTINUOUS':
        loose = [int(math.floor(n * scale + 0.5)) for n in raw_open_nums if n > 0]
    else:
        total_open = sum(raw_open_nums)
        if total_open > 0:
            loose = [int(math.floor(total_open * scale + 0.5))]

    sealed = []
    parsed_note = parse_note(d['note'], d['packSize'])
    if parsed_note:
        count, size = parsed_note
        sealed.append({'packSize': size * scale, 'count': count})
        judgment_calls.append(
            f"row {d['row']:>3} {d['name']:<40} note={d['note']!r:<28} -> "
            f"{count} sealed pack(s) of {size*scale} {base}"
        )
    elif d['packSize']:
        judgment_calls.append(
            f"row {d['row']:>3} {d['name']:<40} PACKSIZE={d['packSize']} but no pack-count "
            f"note -> read as 0 sealed packs (informational packsize only)"
        )

    if '(new)' in (d['open'] or '').lower() or '(new)' in d['name'].lower():
        judgment_calls.append(
            f"row {d['row']:>3} {d['name']:<40} has a '(new)' label -> treated as a plain "
            f"recency note, no numeric effect"
        )

    if sku in items:
        it = items[sku]
        it['sealed'] += sealed
        it['loose'] += loose
        it['mergedFrom'].append(d['row'])
    else:
        items[sku] = {
            'sku': sku, 'name': d['name'], 'category': d['category'],
            'measure': measure, 'baseUnit': base,
            'packUnit': d['packUnit'], 'si': d['si'],
            'sealed': sealed, 'loose': loose,
            'mergedFrom': [d['row']],
        }

out = list(items.values())
for it in out:
    it['expectedTotal'] = sum(g['packSize'] * g['count'] for g in it['sealed']) + sum(it['loose'])

# Loud check: every SKU named in TO_CM must actually exist and be in cm, or
# the conversion silently didn't apply (this is exactly how the first attempt
# at this script rounded 0.13 m offcuts to 0 without any error).
seen_skus = {it['sku'] for it in out}
missing = TO_CM - seen_skus
if missing:
    raise SystemExit(f'TO_CM names {missing} do not match any generated SKU -- fix TO_CM')
for it in out:
    if it['sku'] in TO_CM and it['baseUnit'] != 'cm':
        raise SystemExit(f"{it['sku']} is in TO_CM but baseUnit is {it['baseUnit']!r}, not cm")
# Any other CONTINUOUS item with a sub-1 raw offcut would silently vanish on
# rounding the same way -- fail loudly instead of guessing it doesn't matter.
for d in recs:
    if d['measure'].startswith('CONTIN'):
        sku = skuify(d['name'])
        if sku in TO_CM:
            continue
        if any(0 < n < 1 for n in numbers(d['open'])):
            raise SystemExit(
                f"row {d['row']} {d['name']} has a sub-1 offcut in a non-cm CONTINUOUS "
                f"item ({d['open']!r}) -- add it to TO_CM or it will round to 0"
            )

with open(r'scripts\stock-import-2026-09.json', 'w', encoding='utf-8') as f:
    json.dump(out, f, indent=2, ensure_ascii=False)

# Duplicate-SKU sanity check (would indicate skuify() collided two different names)
by_sku = {}
for d in recs:
    by_sku.setdefault(skuify(d['name']), []).append(d['name'])
collisions = {k: v for k, v in by_sku.items() if len(set(v)) > 1}

print('source rows      :', len(recs))
print('items after rules:', len(out))
print('merged rows       :', sum(1 for i in out if len(i['mergedFrom']) > 1))
print('zero-stock items  :', sum(1 for i in out if i['expectedTotal'] == 0))
print('SKU collisions across different names:', collisions or 'none')
print()
print('=== JUDGMENT CALLS (review before import) ===')
for j in judgment_calls:
    print(' ', j)
print()
print('=== MERGED ROWS ===')
for i in out:
    if len(i['mergedFrom']) > 1:
        print('  %-16s %-42s rows %s -> %s %s' % (i['sku'], i['name'][:42], i['mergedFrom'], i['expectedTotal'], i['baseUnit']))
print()
print('=== ZERO STOCK ITEMS ===')
for i in out:
    if i['expectedTotal'] == 0:
        print('  %-20s %s' % (i['sku'], i['name']))
print()
print('=== CM CONVERSIONS ===')
for i in out:
    if i['baseUnit'] == 'cm':
        print('  %-16s loose=%s total=%s cm' % (i['sku'], i['loose'], i['expectedTotal']))
