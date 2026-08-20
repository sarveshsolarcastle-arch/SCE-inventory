import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatQuantity } from "@/lib/units";

/** Offcuts that fell to or below their item's scrap threshold. They still exist
 * physically — nothing is deleted — they just stopped counting as stock. */
export default async function RecyclePage() {
  const scrap = await prisma.openPack.findMany({
    where: { state: "SCRAP" },
    include: { item: true, shelfSlot: { include: { shelf: true } } },
    orderBy: { openedAt: "desc" },
  });

  const byItem = new Map<string, { item: (typeof scrap)[number]["item"]; packs: typeof scrap }>();
  for (const pack of scrap) {
    const entry = byItem.get(pack.itemId) ?? { item: pack.item, packs: [] };
    entry.packs.push(pack);
    byItem.set(pack.itemId, entry);
  }
  const groups = [...byItem.values()].sort((a, b) =>
    a.item.name.localeCompare(b.item.name)
  );

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
        Recycle
      </h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Offcuts at or below their item&apos;s scrap threshold. These are not
        counted in stock and cannot be issued, but they have not been deleted —
        move them to a Recyclable box on the shelf when convenient.
      </p>

      <div className="overflow-x-auto rounded border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-100 text-left dark:bg-zinc-900">
            <tr>
              <th className="px-3 py-2">Item</th>
              <th className="px-3 py-2">Offcuts</th>
              <th className="px-3 py-2">Total</th>
              <th className="px-3 py-2">Threshold</th>
              <th className="px-3 py-2">Location</th>
            </tr>
          </thead>
          <tbody>
            {groups.map(({ item, packs }) => (
              <tr key={item.id} className="border-t border-zinc-200 dark:border-zinc-800">
                <td className="px-3 py-2">
                  <Link
                    href={`/items/${item.id}`}
                    className="font-medium text-zinc-900 hover:underline dark:text-zinc-50"
                  >
                    {item.name}
                  </Link>
                </td>
                <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">
                  {packs.map((p) => `${p.remaining} ${item.baseUnit}`).join(" · ")}
                </td>
                <td className="px-3 py-2">
                  {formatQuantity(item, packs.reduce((s, p) => s + p.remaining, 0))}
                </td>
                <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">
                  {item.scrapThreshold === null
                    ? "—"
                    : formatQuantity(item, item.scrapThreshold)}
                </td>
                <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">
                  {packs
                    .map((p) =>
                      p.shelfSlot
                        ? `${p.shelfSlot.shelf.name} · ${p.shelfSlot.tagCode}`
                        : "unplaced"
                    )
                    .join(", ")}
                </td>
              </tr>
            ))}
            {groups.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-zinc-500 dark:text-zinc-500">
                  No scrap offcuts.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
