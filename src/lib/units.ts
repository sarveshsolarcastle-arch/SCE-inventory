import type { MeasureType } from "@/generated/prisma/enums";

/** The subset of an Item this module needs — keeps these helpers usable from
 * client components, which never see a full Prisma model. */
export type UnitInfo = {
  baseUnit: string;
  packUnit: string | null;
  measure: MeasureType;
};

export type Piece = { length: number; count: number };
export type SealedGroup = { packSize: number; sealedCount: number };

/** A quantity with its unit, e.g. "2740 m". */
export function formatQuantity(item: UnitInfo, base: number): string {
  return `${base} ${item.baseUnit}`;
}

export function totalBase(
  sealed: readonly SealedGroup[],
  openRemaining: readonly number[]
): number {
  const sealedTotal = sealed.reduce((s, g) => s + g.packSize * g.sealedCount, 0);
  return sealedTotal + openRemaining.reduce((s, r) => s + r, 0);
}

/** Full breakdown, e.g. "3×400 m + 2×600 m sealed · 50/30/20 m open".
 * Unpackaged items collapse to just "12 pcs", since there are no packs to show. */
export function formatStock(
  item: UnitInfo,
  sealed: readonly SealedGroup[],
  openRemaining: readonly number[]
): string {
  const total = totalBase(sealed, openRemaining);
  if (!item.packUnit) return formatQuantity(item, total);

  const parts: string[] = [];

  const sealedParts = sealed
    .filter((g) => g.sealedCount > 0)
    .sort((a, b) => a.packSize - b.packSize)
    .map((g) => `${g.sealedCount}×${g.packSize} ${item.baseUnit}`);
  if (sealedParts.length) parts.push(`${sealedParts.join(" + ")} sealed`);

  const open = [...openRemaining].sort((a, b) => b - a);
  if (open.length) parts.push(`${open.join("/")} ${item.baseUnit} open`);

  return parts.length ? parts.join(" · ") : formatQuantity(item, 0);
}

/** What a physical box holds. A slot stores WHICH item is in it, never how
 * much — the quantity is derived from that item's packs, so the shelf map is
 * correct by construction instead of correct-if-everyone-picked-the-right-slot.
 *
 * Sealed packs are fungible, so a FRESH box shows the item's whole sealed
 * holding; if the item occupies two FRESH boxes both show it, flagged split.
 * Open packs are individual objects, so an OPENED box shows only its own. */
export function describeSlotContents(
  item: UnitInfo,
  boxType: "FRESH" | "OPENED" | "RECYCLABLE",
  packs: {
    sealed: readonly SealedGroup[];
    openInThisSlot: readonly number[];
    scrap: readonly number[];
    freshSlotCount: number;
  }
): { total: number; text: string; splitAcrossBoxes: boolean } {
  if (boxType === "FRESH") {
    const total = totalBase(packs.sealed, []);
    const split = packs.freshSlotCount > 1;
    return {
      total,
      // "empty" would be misleading: the item may well have stock, just not
      // sealed. Say which kind is missing.
      text: total === 0 ? "no sealed packs" : formatStock(item, packs.sealed, []),
      splitAcrossBoxes: split,
    };
  }

  const remaining = boxType === "OPENED" ? packs.openInThisSlot : packs.scrap;
  const total = remaining.reduce((s, r) => s + r, 0);
  if (total === 0) {
    return {
      total: 0,
      text: boxType === "OPENED" ? "nothing open here" : "no offcuts",
      splitAcrossBoxes: false,
    };
  }

  return {
    total,
    text: `${[...remaining].sort((a, b) => b - a).join("/")} ${item.baseUnit}`,
    splitAcrossBoxes: false,
  };
}

/** "4 × 50 m", or "4 × 50 m + 1 × 20 m" for a mixed cut. */
export function describePieces(item: UnitInfo, pieces: readonly Piece[]): string {
  return pieces
    .filter((p) => p.count > 0)
    .map((p) => `${p.count} × ${p.length} ${item.baseUnit}`)
    .join(" + ");
}

export function piecesTotal(pieces: readonly Piece[]): number {
  return pieces.reduce((s, p) => s + p.length * p.count, 0);
}

/** Parses the JSON in Transaction.pieces, tolerating null and malformed data —
 * it is display metadata, so a bad value must never break a history page. */
export function parsePieces(raw: string | null | undefined): Piece[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((p) => {
      const length = Number((p as Piece)?.length);
      const count = Number((p as Piece)?.count);
      return Number.isInteger(length) && Number.isInteger(count) && length > 0 && count > 0
        ? [{ length, count }]
        : [];
    });
  } catch {
    return [];
  }
}

/** How a movement was entered: "2 × 400 m rolls + 30 m" or just "45 pcs". */
export function describeMovement(
  item: UnitInfo,
  tx: { quantity: number; packSize: number | null; packCount: number | null; pieces: string | null }
): string {
  const parts: string[] = [];

  if (tx.packCount && tx.packSize) {
    const unit = item.packUnit ? `${item.packUnit}${tx.packCount === 1 ? "" : "s"}` : "";
    parts.push(`${tx.packCount} × ${tx.packSize} ${item.baseUnit}${unit ? ` ${unit}` : ""}`);
  }

  const pieces = parsePieces(tx.pieces);
  if (pieces.length) parts.push(describePieces(item, pieces));

  if (!parts.length) return formatQuantity(item, tx.quantity);

  const accounted =
    (tx.packCount ?? 0) * (tx.packSize ?? 0) + piecesTotal(pieces);
  const loose = tx.quantity - accounted;
  if (loose > 0) parts.push(formatQuantity(item, loose));

  return parts.join(" + ");
}
