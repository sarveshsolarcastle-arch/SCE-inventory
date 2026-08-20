import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatQuantity } from "@/lib/units";

const STATUS_BADGE: Record<string, string> = {
  QUARANTINED: "border-amber-400 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-300",
  CLAIMED: "border-blue-400 bg-blue-50 text-blue-800 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-300",
  REPLACED: "border-emerald-400 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
};

/** Goods that physically exist but are not stock, held for a supplier claim. */
export default async function DefectivePage() {
  const rows = await prisma.defectiveItem.findMany({
    include: { item: true, site: true, user: true },
    orderBy: [{ status: "asc" }, { reportedAt: "desc" }],
  });

  const outstanding = rows.filter((r) => r.status !== "REPLACED");

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
        Defective Goods
      </h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Damaged on arrival, or returned damaged from a site. Not counted in
        stock and never issued — held so the supplier can be chased.
        {outstanding.length > 0 && (
          <>
            {" "}
            <strong className="text-zinc-900 dark:text-zinc-50">
              {outstanding.length} outstanding.
            </strong>
          </>
        )}
      </p>

      <div className="overflow-x-auto rounded border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-100 text-left dark:bg-zinc-900">
            <tr>
              <th className="px-3 py-2">Item</th>
              <th className="px-3 py-2">Quantity</th>
              <th className="px-3 py-2">Source</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Reported</th>
              <th className="px-3 py-2">By</th>
              <th className="px-3 py-2">Note</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-zinc-200 dark:border-zinc-800">
                <td className="px-3 py-2">
                  <Link
                    href={`/items/${row.item.id}`}
                    className="font-medium text-zinc-900 hover:underline dark:text-zinc-50"
                  >
                    {row.item.name}
                  </Link>
                </td>
                <td className="px-3 py-2">
                  {row.packCount && row.packSize
                    ? `${row.packCount} × ${row.packSize} ${row.item.baseUnit}`
                    : formatQuantity(row.item, row.quantity)}
                </td>
                <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">
                  {row.source === "RETURN"
                    ? `Returned${row.site ? ` from ${row.site.name}` : ""}`
                    : "Damaged on arrival"}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded border px-1.5 py-0.5 text-xs ${STATUS_BADGE[row.status]}`}
                  >
                    {row.status}
                  </span>
                </td>
                <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">
                  {row.reportedAt.toLocaleDateString()}
                </td>
                <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">
                  {row.user.name}
                </td>
                <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">
                  {row.note ?? "—"}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-zinc-500 dark:text-zinc-500">
                  Nothing defective on record.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
