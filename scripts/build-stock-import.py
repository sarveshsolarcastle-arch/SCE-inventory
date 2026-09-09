"""Builds scripts/stock-import.json from the client's pack-structure sheet.

    python scripts/build-stock-import.py "<path to the .xlsx>"

Separate from import-stock.ts on purpose: Node cannot read .xlsx without a new
dependency, and a reviewable JSON intermediate means the resolved catalogue can
be diffed and checked before anything touches a database.

The decisions encoded below were taken with the client on 2026-09-09:
  * duplicate SKUs resolved case by case (see SPLIT, and the merge fallthrough)
  * the seven tape rows given generated SKUs (TAPE_SKU)
  * the three flexible-pipe items moved to cm, because their sub-metre offcuts
    cannot live in an integer number of metres (TO_CM)
  * shelf placement skipped -- the sheet gives a row but no column
Every built total is cross-checked against the sheet's own COMPUTED TOTAL.
"""
import sys as _sys
import openpyxl, json, sys, io, re, math
from collections import OrderedDict
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

SRC = _sys.argv[1] if len(_sys.argv) > 1 else r'C:\Users\Kavita\Downloads\Current Stock 1 - Pack Structure v3.xlsx'
wb = openpyxl.load_workbook(SRC, data_only=True)
ws = wb['Pack Structure']
rows = list(ws.iter_rows(values_only=True))
hdr = [str(c).strip() if c else '' for c in rows[0]]

def cell(r, name):
    i = hdr.index(name)
    v = r[i]
    return '' if v is None else str(v).strip()

recs = []
for i, r in enumerate(rows[1:], start=2):
    if not cell(r, 'ITEM'):
        continue
    recs.append({
        'row': i,
        'shelf': cell(r, 'SHELF LOCATION'),
        'name': re.sub(r'\s*#SI\b', '', cell(r, 'ITEM')).strip(),
        'sku': cell(r, 'SKU'),
        'category': cell(r, 'CATEGORY'),
        'measure': cell(r, 'MEASURE'),
        'baseUnit': cell(r, 'BASE UNIT'),
        'packUnit': cell(r, 'PACK UNIT'),
        'packSize': cell(r, 'PACK SIZE'),
        'sealed': cell(r, 'SEALED PACKS'),
        'open': cell(r, 'OPEN / LOOSE PIECES'),
        'total': cell(r, 'COMPUTED TOTAL'),
    })

# --- decisions -----------------------------------------------------------
TAPE_SKU = {
    'Insulation Tape - Red': 'TAP-INS-RED', 'Insulation Tape - Yellow': 'TAP-INS-YEL',
    'Insulation Tape - Blue': 'TAP-INS-BLU', 'Insulation Tape - Black': 'TAP-INS-BLK',
    'Insulation Tape - Green': 'TAP-INS-GRN', 'Brown Tape': 'TAP-BRN',
    'Transparent Tape': 'TAP-TRP',
}
# Different products that were sharing one code -> split by row.
SPLIT = {30: 'BOX-ACDB-1IN1', 36: 'BOX-ACDB-2IN2', 31: 'BOX-DCDB-1IN1', 35: 'BOX-DCDB-2IN2'}
# Sub-metre offcuts cannot live in an integer metre, so these three go to cm.
TO_CM = {'FLP-10MM', 'FLP-20MM', 'FLP-WHT'}
BASE_UNIT_FIX = {'pcs/packet': 'pcs', 'pcs / packet': 'pcs', 'pcs/packets': 'pcs', 'packet': 'pcs'}

def numbers(text):
    return [float(x) for x in re.findall(r'\d+(?:\.\d+)?', text)] if text else []

items = OrderedDict()
for d in recs:
    sku = SPLIT.get(d['row']) or d['sku'] or TAPE_SKU.get(d['name'])
    if not sku:
        raise SystemExit('no SKU for row %s %s' % (d['row'], d['name']))

    base = BASE_UNIT_FIX.get(d['baseUnit'], d['baseUnit']) or 'pcs'
    scale = 1
    if sku in TO_CM:
        base, scale = 'cm', 100

    sealed = []
    if d['packUnit'] and d['packSize'] and d['sealed']:
        ps, sc = int(float(d['packSize'])), int(float(d['sealed']))
        if sc > 0:
            sealed.append({'packSize': ps * scale, 'count': sc})

    # One OpenPack per number: offcuts are individual objects, not a total.
    # floor(x+0.5), not round(): Python's round() is half-to-even, so 58.5 cm
    # would silently become 58. Half-up is what a person expects here.
    loose = [int(math.floor(n * scale + 0.5)) for n in numbers(d['open']) if n > 0]

    if sku in items:
        it = items[sku]
        it['sealed'] += sealed
        it['loose'] += loose
        it['mergedFrom'].append(d['row'])
    else:
        items[sku] = {
            'sku': sku, 'name': d['name'], 'category': d['category'],
            'measure': d['measure'] or 'DISCRETE', 'baseUnit': base,
            'packUnit': d['packUnit'] or None,
            'sealed': sealed, 'loose': loose,
            'shelfHint': d['shelf'] if d['shelf'] not in ('', 'NULL') else None,
            'mergedFrom': [d['row']],
        }

out = list(items.values())
for it in out:
    it['expectedTotal'] = sum(g['packSize'] * g['count'] for g in it['sealed']) + sum(it['loose'])

with open(r'scripts\stock-import.json', 'w', encoding='utf-8') as f:
    json.dump(out, f, indent=2, ensure_ascii=False)

sheet_total = {}
for d in recs:
    sku2 = SPLIT.get(d['row']) or d['sku'] or TAPE_SKU.get(d['name'])
    sc2 = 100 if sku2 in TO_CM else 1
    t = numbers(d['total'])
    sheet_total[sku2] = sheet_total.get(sku2, 0.0) + (t[0] * sc2 if t else 0.0)

print("*** CROSS-CHECK vs the sheet's own COMPUTED TOTAL ***")
bad = 0
for it in out:
    want, got = sheet_total[it['sku']], it['expectedTotal']
    if abs(want - got) > 0.5001:
        bad += 1
        print('  MISMATCH %-18s sheet=%-10s built=%s' % (it['sku'], want, got))
print('  mismatches beyond rounding:', bad)
print()
print('source rows      :', len(recs))
print('items after rules:', len(out))
print('merged           :', sum(1 for i in out if len(i['mergedFrom']) > 1))
print('zero-stock items :', sum(1 for i in out if i['expectedTotal'] == 0))
print('\nMERGES:')
for i in out:
    if len(i['mergedFrom']) > 1:
        print('  %-16s %-42s rows %s -> %s %s' % (i['sku'], i['name'][:42], i['mergedFrom'], i['expectedTotal'], i['baseUnit']))
print('\nSPLITS:')
for i in out:
    if i['sku'] in SPLIT.values():
        print('  %-16s %-42s %s %s' % (i['sku'], i['name'][:42], i['expectedTotal'], i['baseUnit']))
print('\nCM CONVERSIONS:')
for i in out:
    if i['baseUnit'] == 'cm':
        print('  %-12s loose=%s total=%s cm' % (i['sku'], i['loose'], i['expectedTotal']))
print('\nZERO STOCK:')
for i in out:
    if i['expectedTotal'] == 0:
        print('  %-20s %s' % (i['sku'], i['name']))
