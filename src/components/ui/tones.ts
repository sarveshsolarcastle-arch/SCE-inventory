import type { BoxType } from "@/lib/boxTypes";

/** The single set of semantic tones every badge/alert/tint in the app draws from. */
export type BadgeTone = "ok" | "warn" | "danger" | "info" | "special" | "neutral";

export const BOX_TYPE_TONE: Record<BoxType, BadgeTone> = {
  FRESH: "ok",
  OPENED: "warn",
  RECYCLABLE: "special",
};

export const DEFECT_STATUS_TONE: Record<"QUARANTINED" | "CLAIMED" | "REPLACED", BadgeTone> = {
  QUARANTINED: "warn",
  CLAIMED: "info",
  REPLACED: "ok",
};

export const MATCH_STATUS_TONE: Record<
  "exact" | "suggested" | "ambiguous" | "unmatched",
  BadgeTone
> = {
  exact: "ok",
  suggested: "warn",
  ambiguous: "special",
  unmatched: "danger",
};

/** Covers every TransactionType — see prisma/schema.prisma. */
export const TRANSACTION_TYPE_TONE: Record<string, BadgeTone> = {
  STOCK_IN: "ok",
  ISSUE: "info",
  RETURN: "warn",
  OPEN_PACK: "info",
  SCRAP: "neutral",
  ADJUSTMENT: "danger",
  REVERSAL: "danger",
  CONSUME: "neutral",
  TRANSFER: "special",
};
