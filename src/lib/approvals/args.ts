/* -------------------------------------------------------------------------
 * Parsing an operation's arguments from `unknown`.
 *
 * These run TWICE against different inputs, which is why they take `unknown`
 * rather than a typed payload: once when a request is raised, from a form, and
 * again when an admin approves it hours later, from JSON that has round-tripped
 * through the database. The second pass is the one that matters — the string in
 * ApprovalRequest.args was, ultimately, supplied by the requester, so it is
 * re-validated rather than trusted. Exactly how Transaction.appliedPlan is
 * re-parsed at reversal time rather than believed.
 *
 * Pure, so every branch below is tested. A parser that silently coerced a bad
 * value would put a request into the queue that fails only when an admin
 * approves it, which is the worst possible moment to discover it.
 * ---------------------------------------------------------------------- */

import type {
  BoxType,
  ReverseDispatchArgs,
  ReverseTransactionArgs,
  ShelfCreateArgs,
  ShelfDeleteArgs,
  SiteCreateArgs,
  SiteDeleteArgs,
  SiteUpdateArgs,
  SlotBoxTypeArgs,
  SlotFrontRowArgs,
  SlotItemArgs,
  StockAdjustArgs,
} from "./kinds.ts";

export class InvalidArgsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidArgsError";
  }
}

const BOX_TYPES: readonly BoxType[] = ["FRESH", "OPENED", "RECYCLABLE"];

function obj(raw: unknown): Record<string, unknown> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new InvalidArgsError("Expected an object of arguments");
  }
  return raw as Record<string, unknown>;
}

function str(raw: unknown, field: string): string {
  if (typeof raw !== "string") throw new InvalidArgsError(`${field} must be text`);
  const trimmed = raw.trim();
  if (!trimmed) throw new InvalidArgsError(`${field} is required`);
  return trimmed;
}

/** Empty string and null both mean "not set" — a cleared form field arrives as
 * "" and a round-tripped one as null, and they must not diverge. */
function optionalStr(raw: unknown, field: string): string | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== "string") throw new InvalidArgsError(`${field} must be text`);
  return raw.trim() || null;
}

function int(raw: unknown, field: string, opts: { min?: number; max?: number } = {}): number {
  if (typeof raw !== "number" || !Number.isInteger(raw)) {
    throw new InvalidArgsError(`${field} must be a whole number`);
  }
  if (opts.min !== undefined && raw < opts.min) {
    throw new InvalidArgsError(`${field} must be at least ${opts.min}`);
  }
  if (opts.max !== undefined && raw > opts.max) {
    throw new InvalidArgsError(`${field} must be at most ${opts.max}`);
  }
  return raw;
}

function boxType(raw: unknown, field: string): BoxType {
  if (typeof raw !== "string" || !BOX_TYPES.includes(raw as BoxType)) {
    throw new InvalidArgsError(`${field} must be one of ${BOX_TYPES.join(", ")}`);
  }
  return raw as BoxType;
}

function arr(raw: unknown, field: string): unknown[] {
  if (!Array.isArray(raw)) throw new InvalidArgsError(`${field} must be a list`);
  return raw;
}

export function parseSiteCreateArgs(raw: unknown): SiteCreateArgs {
  const o = obj(raw);
  return {
    name: str(o.name, "Name"),
    location: optionalStr(o.location, "Location"),
    notes: optionalStr(o.notes, "Notes"),
  };
}

export function parseSiteUpdateArgs(raw: unknown): SiteUpdateArgs {
  const o = obj(raw);
  return { ...parseSiteCreateArgs(raw), siteId: str(o.siteId, "Site") };
}

export function parseSiteDeleteArgs(raw: unknown): SiteDeleteArgs {
  return { siteId: str(obj(raw).siteId, "Site") };
}

export function parseShelfCreateArgs(raw: unknown): ShelfCreateArgs {
  const o = obj(raw);
  // Same bounds createShelf already enforces; duplicated here rather than
  // deferred, so a nonsense request is refused at the door instead of sitting
  // in the queue waiting to fail on an admin.
  const rows = int(o.rows, "Rows", { min: 1, max: 20 });
  const columns = int(o.columns, "Columns", { min: 1, max: 20 });

  const boxTypes: Record<string, BoxType> = {};
  if (o.boxTypes !== undefined && o.boxTypes !== null) {
    for (const [key, value] of Object.entries(obj(o.boxTypes))) {
      boxTypes[key] = boxType(value, `Box type for ${key}`);
    }
  }

  return { name: str(o.name, "Name"), rows, columns, boxTypes };
}

export function parseShelfDeleteArgs(raw: unknown): ShelfDeleteArgs {
  return { shelfId: str(obj(raw).shelfId, "Shelf") };
}

export function parseSlotBoxTypeArgs(raw: unknown): SlotBoxTypeArgs {
  const o = obj(raw);
  return {
    shelfId: str(o.shelfId, "Shelf"),
    slotId: str(o.slotId, "Slot"),
    boxType: boxType(o.boxType, "Box type"),
  };
}

export function parseSlotItemArgs(raw: unknown): SlotItemArgs {
  const o = obj(raw);
  return {
    shelfId: str(o.shelfId, "Shelf"),
    slotId: str(o.slotId, "Slot"),
    // Null is meaningful here — it empties the box — so it is not an error.
    itemId: optionalStr(o.itemId, "Item"),
  };
}

export function parseSlotFrontRowArgs(raw: unknown): SlotFrontRowArgs {
  const o = obj(raw);
  return { shelfId: str(o.shelfId, "Shelf"), slotId: str(o.slotId, "Slot") };
}

export function parseReverseTransactionArgs(raw: unknown): ReverseTransactionArgs {
  const o = obj(raw);
  return {
    transactionId: str(o.transactionId, "Movement"),
    reason: str(o.reason, "Reason"),
  };
}

export function parseReverseDispatchArgs(raw: unknown): ReverseDispatchArgs {
  const o = obj(raw);
  return { dispatchId: str(o.dispatchId, "Dispatch"), reason: str(o.reason, "Reason") };
}

/** The one worth the most care. A stock count that loses its ledger figures
 * becomes an absolute write again — the bug fixed in Part 3 — so `ledger` is
 * required on every line and is not allowed to default. */
export function parseStockAdjustArgs(raw: unknown): StockAdjustArgs {
  const o = obj(raw);

  const sealed = arr(o.sealed ?? [], "Sealed counts").map((row, i) => {
    const r = obj(row);
    return {
      packSize: int(r.packSize, `Pack size on sealed line ${i + 1}`, { min: 1 }),
      counted: int(r.counted, `Counted on sealed line ${i + 1}`, { min: 0 }),
      ledger: int(r.ledger, `Ledger figure on sealed line ${i + 1}`, { min: 0 }),
    };
  });

  const open = arr(o.open ?? [], "Open counts").map((row, i) => {
    const r = obj(row);
    return {
      packId: str(r.packId, `Pack on open line ${i + 1}`),
      counted: int(r.counted, `Counted on open line ${i + 1}`, { min: 0 }),
      ledger: int(r.ledger, `Ledger figure on open line ${i + 1}`, { min: 0 }),
    };
  });

  if (!sealed.length && !open.length) {
    throw new InvalidArgsError("A stock count must cover at least one pack");
  }

  // Two lines for the same pack would apply two deltas to it, and which one
  // "wins" would depend on iteration order. Refuse rather than pick.
  const sealedSizes = sealed.map((s) => s.packSize);
  if (new Set(sealedSizes).size !== sealedSizes.length) {
    throw new InvalidArgsError("The same pack size was counted twice");
  }
  const packIds = open.map((p) => p.packId);
  if (new Set(packIds).size !== packIds.length) {
    throw new InvalidArgsError("The same open pack was counted twice");
  }

  return {
    itemId: str(o.itemId, "Item"),
    sealed,
    open,
    reason: str(o.reason, "Reason"),
  };
}
