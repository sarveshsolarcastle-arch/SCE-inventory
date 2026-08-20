import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { can, currentUser } from "@/lib/permissions";

export default async function DeliveriesPage() {
  const [deliveries, user] = await Promise.all([
    prisma.delivery.findMany({
      orderBy: { receivedAt: "desc" },
      include: {
        site: true,
        user: true,
        transactions: { where: { type: "STOCK_IN" } },
        defectiveItems: true,
      },
    }),
    currentUser(),
  ]);

  const canRecord = can(user?.role, "delivery:record");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          Deliveries
        </h1>
        {canRecord && (
          <Link
            href="/deliveries/new"
            className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900"
          >
            + Record Delivery
          </Link>
        )}
      </div>

      <div className="overflow-x-auto rounded border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-100 text-left dark:bg-zinc-900">
            <tr>
              <th className="px-3 py-2">Received</th>
              <th className="px-3 py-2">Reference</th>
              <th className="px-3 py-2">Supplier</th>
              <th className="px-3 py-2">Destination</th>
              <th className="px-3 py-2">Lines</th>
              <th className="px-3 py-2">Defects</th>
              <th className="px-3 py-2">By</th>
            </tr>
          </thead>
          <tbody>
            {deliveries.map((d) => (
              <tr key={d.id} className="border-t border-zinc-200 dark:border-zinc-800">
                <td className="px-3 py-2">{d.receivedAt.toLocaleDateString()}</td>
                <td className="px-3 py-2">
                  <Link
                    href={`/deliveries/${d.id}`}
                    className="font-medium text-zinc-900 hover:underline dark:text-zinc-50"
                  >
                    {d.reference || "(no reference)"}
                  </Link>
                </td>
                <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">
                  {d.supplier ?? "—"}
                </td>
                <td className="px-3 py-2">
                  {d.site ? (
                    <span className="rounded bg-sky-100 px-2 py-0.5 text-xs text-sky-800 dark:bg-sky-950 dark:text-sky-300">
                      Direct to {d.site.name}
                    </span>
                  ) : (
                    <span className="text-zinc-600 dark:text-zinc-400">Store</span>
                  )}
                </td>
                <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">
                  {d.transactions.length}
                </td>
                <td className="px-3 py-2">
                  {d.defectiveItems.length > 0 ? (
                    <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                      {d.defectiveItems.length}
                    </span>
                  ) : (
                    <span className="text-zinc-500">—</span>
                  )}
                </td>
                <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">{d.user.name}</td>
              </tr>
            ))}
            {deliveries.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-zinc-500 dark:text-zinc-500">
                  No deliveries recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
