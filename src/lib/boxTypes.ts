export const BOX_TYPES = ["FRESH", "OPENED", "RECYCLABLE"] as const;
export type BoxType = (typeof BOX_TYPES)[number];
