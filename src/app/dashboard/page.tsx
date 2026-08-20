import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getPlacementSuggestions } from "@/lib/suggestions";

export default async function DashboardPage() {
  const [itemCount, allItems, recentTx, suggestions] = await Promise.all([
    prisma.item.count(),
    prisma.item.findMany({ orderBy: { name: "asc" } }),
    prisma.transaction.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { item: true, site: true, user: true },
    }),
    getPlacementSuggestions(),
  ]);

  const lowStock = allItems.filter((item) => item.currentStock < item.minStock);

  const siteSummaries = await prisma.site.findMany({
    include: {
      _count: { select: { transactions: true } },
    },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
        Dashboard
      </h1>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total Items" value={itemCount} />
        <StatCard label="Low Stock Items" value={lowStock.length} alert={lowStock.length > 0} />
        <StatCard label="Sites Tracked" value={siteSummaries.length} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-2 rounded border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="font-medium text-zinc-900 dark:text-zinc-50">
            Low Stock Alerts
          </h2>
          <ul className="divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
            {lowStock.map((item) => (
              <li key={item.id} className="flex justify-between py-1.5">
                <Link href={`/items/${item.id}`} className="hover:underline">
                  {item.name}
                </Link>
                <span className="text-red-700 dark:text-red-300">
                  {item.currentStock} / min {item.minStock} {item.baseUnit}
                </span>
              </li>
            ))}
            {lowStock.length === 0 && (
              <li className="py-4 text-center text-zinc-500 dark:text-zinc-500">
                All items are above minimum stock.
              </li>
            )}
          </ul>
        </div>

        <div className="space-y-2 rounded border border-zinc-200 p-4 dark:border-zinc-800">
          <div className="flex items-center justify-between">
            <h2 className="font-medium text-zinc-900 dark:text-zinc-50">
              Placement Suggestions
            </h2>
            <Link href="/shelf/suggestions" className="text-sm underline">
              View all
            </Link>
          </div>
          <ul className="divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
            {suggestions.slice(0, 5).map((s) => (
              <li key={s.item.id} className="py-1.5">
                <span className="font-medium">{s.item.name}</span> ({s.frequency}
                x/30d) → move to {s.targetSlot.shelfName} {s.targetSlot.tagCode}
                {s.targetSlot.occupant && (
                  <> (currently {s.targetSlot.occupant.name})</>
                )}
              </li>
            ))}
            {suggestions.length === 0 && (
              <li className="py-4 text-center text-zinc-500 dark:text-zinc-500">
                No relocation suggestions right now.
              </li>
            )}
          </ul>
        </div>
      </div>

      <div className="space-y-2 rounded border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="font-medium text-zinc-900 dark:text-zinc-50">
          Recent Activity
        </h2>
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-zinc-500 dark:text-zinc-500">
            <tr>
              <th className="py-1">Date</th>
              <th className="py-1">Type</th>
              <th className="py-1">Item</th>
              <th className="py-1">Qty</th>
              <th className="py-1">Site</th>
              <th className="py-1">By</th>
            </tr>
          </thead>
          <tbody>
            {recentTx.map((t) => (
              <tr key={t.id} className="border-t border-zinc-200 dark:border-zinc-800">
                <td className="py-1">{t.createdAt.toLocaleString()}</td>
                <td className="py-1">{t.type}</td>
                <td className="py-1">{t.item.name}</td>
                <td className="py-1">{t.quantity}</td>
                <td className="py-1">{t.site?.name ?? "—"}</td>
                <td className="py-1">{t.user.name}</td>
              </tr>
            ))}
            {recentTx.length === 0 && (
              <tr>
                <td colSpan={6} className="py-4 text-center text-zinc-500 dark:text-zinc-500">
                  No activity yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  alert,
}: {
  label: string;
  value: number;
  alert?: boolean;
}) {
  return (
    <div className="rounded border border-zinc-200 p-4 dark:border-zinc-800">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">{label}</p>
      <p
        className={`text-2xl font-semibold ${
          alert ? "text-red-700 dark:text-red-300" : "text-zinc-900 dark:text-zinc-50"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
