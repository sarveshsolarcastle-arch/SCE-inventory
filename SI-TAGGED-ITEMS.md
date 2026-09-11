# #SI-Tagged Items

34 items carry the `#SI` tag — the ones matched against the solar-installation BOM photo,
marked so they're easy to search for. Pulled from `Current Stock 1 - Pack Structure v3.xlsx`.

## Live stock (23)

| Item | SKU | Category | Unit | Total |
|---|---|---|---|---|
| Jointer for walkway | `WKWY-JNT` | Fixing | pcs | 116 |
| TEE- Pipes | `TEE-PIP` | Material | pcs | 216 |
| PG20 Glands | `GLD-PG20` | Fixing | pcs | 40 |
| AC cable,black,4core x 4sqmm, | `CBL-AC-4C-04` | Material | m | 12 |
| ACDB 1IN1 | `BOX-ACDB-1IN1` | Equipment | box | 1 |
| DCDB 1IN1 OUT | `BOX-DCDB-1IN1` | Equipment | box | 1 |
| Inverter | `INV-SOLAR-5KW` | Equipment | box | 2 |
| Inverter (2nd row, same SKU) | `INV-SOLAR-5KW` | Equipment | box | 1 |
| DCDB 2IN2 OUT | `BOX-DCDB-2IN2` | Equipment | box | 2 |
| ACDB 2IN2 | `BOX-ACDB-2IN2` | Equipment | box | 2 |
| Dummy Pieces | `DUM-PCS` | Fixing | pcs | 19 |
| Elbow-pipes | `CND-ELB` | Material | pcs | 28 |
| Bolts for Panel earthing | `BLT-EARTH` | Fixing | pcs | 80 |
| Nut for Panel earthing | `NUT-EARTH` | Fixing | pcs | 40 |
| washers for Panel earthing | `WSH-EARTH` | Fixing | pcs | 60 |
| Self tapping screw | `SCR-ST` | Fixing | pcs | 56 |
| Earthing connector | `EARTH-CONN` | Fixing | pcs | 13 |
| M clamps for Walkway | `CLM-M-WKWY` | Fixing | pcs | 20 |
| Rawal Plug- big | `PLG-RAW-1.5` | Fixing | pcs / packet | 231 |
| MC4 Connectors | `MC4-CON` | Fixing | pcs | 80 |
| Cable ties | `TIE-CBL-NYL` | Fixing | pcs/packets | 800 |
| metal cable tie | `TIE-CBL-SS` | Fixing | pcs/packet | 800 |
| walkway m clamp (2nd row, same SKU as M clamps) | `CLM-M-WKWY` | Fixing | pcs | 8 |

✅ **Corrected — the SKUs above for the ACDB/DCDB rows were wrong.** This doc originally listed
all four as `BOX-ACDB` / `BOX-DCDB`, the pre-import generic SKUs. The import correctly
disambiguated them by size; those two generic SKUs don't exist in the live catalogue at all, so
searching or re-tagging by them found nothing. All four corrected SKUs — `BOX-ACDB-1IN1`,
`BOX-DCDB-1IN1`, `BOX-DCDB-2IN2` and `BOX-ACDB-2IN2` — are confirmed directly against production
(`BOX-ACDB-1IN1`: "ACDB 1IN1", stock 1, exactly as the table above says).

## Reference only — "Don't Refer" section, no live quantity (11)

| Item | SKU | Category | Unit |
|---|---|---|---|
| Pad Lock Rotary Isolator | `ISO-PAD-ROT` | Equipment | pcs |
| PVC Cable Tray | `TRY-PVC` | Material | pcs |
| Ring Type Lugs- 6sqmm | `LUG-RNG-06` | Fixing | pcs |
| Ring Type Lugs- 10sqmm | `LUG-RNG-10` | Fixing | pcs |
| Flexible Pipe- 25mm | `FLP-25MM` | Material | m |
| GI Screw- 1.5' | `SCR-GI-1.5` | Fixing | pcs |
| DC Cables (red) | `CBL-DC-RED` | Material | m |
| DC Cables (black) | `CBL-DC-BLK` | Material | m |
| DC Cables Jumper | `DC-CBL-JUPR` | Material | m |
| Earthing Cable- AC & DC | `CBL-EARTH-ACDC` | Material | m |
| Earthing Cable- L.A. | `CBL-EARTH-LA` | Material | m |

These sit under the source sheet's own "FOR TIME BEING DON'T REFER" heading — no live quantity,
so they weren't in the working Pack Structure sheet either.

## Not carried forward (2)

The original tagging also hit **Insulation tape(opened)** and **Insulation tape(NEW)** —
`R-Y-B-BLK-G` — but those two combined rows no longer exist: they were split into five
per-colour items (`Insulation Tape - Red/Yellow/Blue/Black/Green`) during the Pack Structure
rework, and the `#SI` tag wasn't carried onto the new rows. Worth re-tagging those five if the
colour-split items are still meant to be in this set.
