import { prisma } from "@/lib/prisma";

const WINDOW_DAYS = 30;
const MAX_SUGGESTIONS = 10;

export type Suggestion = {
  item: { id: string; name: string; unit: string };
  frequency: number;
  currentSlot: { id: string; shelfName: string; tagCode: string } | null;
  targetSlot: {
    id: string;
    shelfName: string;
    tagCode: string;
    occupant: { id: string; name: string; frequency: number } | null;
  };
};

/** Items ranked by how often they were issued in the last WINDOW_DAYS, with a
 * suggested move into a more accessible (front-row) shelf slot when a
 * lower-frequency item currently occupies one. */
export async function getPlacementSuggestions(): Promise<Suggestion[]> {
  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const [issues, items, frontSlots] = await Promise.all([
    prisma.transaction.groupBy({
      by: ["itemId"],
      where: { type: "ISSUE", createdAt: { gte: since }, reversedAt: null },
      _sum: { quantity: true },
      _count: { _all: true },
    }),
    prisma.item.findMany({
      include: { shelfSlots: { include: { shelf: true } } },
    }),
    prisma.shelfSlot.findMany({
      where: { isFrontRow: true },
      include: { shelf: true, item: true },
    }),
  ]);

  const frequency = new Map(issues.map((i) => [i.itemId, i._count._all]));
  const itemsById = new Map(items.map((i) => [i.id, i]));

  const ranked = items
    .map((item) => ({ item, frequency: frequency.get(item.id) ?? 0 }))
    .filter((e) => e.frequency > 0)
    .sort((a, b) => b.frequency - a.frequency);

  const usedTargetSlots = new Set<string>();
  const suggestions: Suggestion[] = [];

  for (const { item, frequency: freq } of ranked) {
    if (suggestions.length >= MAX_SUGGESTIONS) break;
    if (item.shelfSlots.some((s) => s.isFrontRow)) continue; // already in a front slot

    // Prefer showing the "Opened/in-use" slot as the item's current
    // location, since that's the one staff actually reach into day to day.
    const currentSlot =
      item.shelfSlots.find((s) => s.boxType === "OPENED") ??
      item.shelfSlots[0] ??
      null;

    // Find the lowest-frequency front-row slot this item could take over.
    const candidates = frontSlots
      .filter((s) => !usedTargetSlots.has(s.id) && s.itemId !== item.id)
      .map((s) => ({
        slot: s,
        occupantFreq: s.itemId ? frequency.get(s.itemId) ?? 0 : 0,
      }))
      .filter((c) => !c.slot.itemId || c.occupantFreq < freq)
      .sort((a, b) => a.occupantFreq - b.occupantFreq);

    const best = candidates[0];
    if (!best) continue;

    usedTargetSlots.add(best.slot.id);
    const occupant = best.slot.itemId ? itemsById.get(best.slot.itemId) : null;

    suggestions.push({
      item: { id: item.id, name: item.name, unit: item.baseUnit },
      frequency: freq,
      currentSlot: currentSlot
        ? {
            id: currentSlot.id,
            shelfName: currentSlot.shelf.name,
            tagCode: currentSlot.tagCode,
          }
        : null,
      targetSlot: {
        id: best.slot.id,
        shelfName: best.slot.shelf.name,
        tagCode: best.slot.tagCode,
        occupant: occupant
          ? {
              id: occupant.id,
              name: occupant.name,
              frequency: best.occupantFreq,
            }
          : null,
      },
    });
  }

  return suggestions;
}
