import { prisma } from "@/lib/prisma";

/** Net quantity of each item currently issued to a site (ISSUE - RETURN), positive only. */
export async function materialsAtSite(siteId: string) {
  const transactions = await prisma.transaction.findMany({
    // A reversed movement is excluded rather than cancelled by an opposing row:
    // it never happened, so it should not appear in a balance at all.
    where: { siteId, type: { in: ["ISSUE", "RETURN"] }, reversedAt: null },
    include: { item: true },
  });

  const net = new Map<string, { item: (typeof transactions)[number]["item"]; quantity: number }>();
  for (const t of transactions) {
    const entry = net.get(t.itemId) ?? { item: t.item, quantity: 0 };
    entry.quantity += t.type === "ISSUE" ? t.quantity : -t.quantity;
    net.set(t.itemId, entry);
  }

  return [...net.values()]
    .filter((e) => e.quantity > 0)
    .sort((a, b) => a.item.name.localeCompare(b.item.name));
}
