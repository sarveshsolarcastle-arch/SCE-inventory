import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function DispatchesPage() {
  const dispatches = await prisma.dispatch.findMany({
    orderBy: { dispatchedAt: "desc" },
    include: {
      site: true,
      user: true,
      transactions: { where: { type: "ISSUE" } },
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          Dispatches
        </h1>
        <Link
          href="/dispatches/new"
          className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900"
        >
          + New Dispatch
        </Link>
      </div>

      <div className="overflow-x-auto rounded border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-100 text-left dark:bg-zinc-900">
            <tr>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Reference</th>
              <th className="px-3 py-2">Site</th>
              <th className="px-3 py-2">Lines</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">By</th>
            </tr>
          </thead>
          <tbody>
            {dispatches.map((d) => {
              const active = d.transactions.filter((t) => !t.reversedAt);
              const reversed = active.length === 0 && d.transactions.length > 0;
              return (
                <tr key={d.id} className="border-t border-zinc-200 dark:border-zinc-800">
                  <td className="px-3 py-2">{d.dispatchedAt.toLocaleDateString()}</td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/dispatches/${d.id}`}
                      className="font-medium text-zinc-900 hover:underline dark:text-zinc-50"
                    >
                      {d.reference || "(no reference)"}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">{d.site.name}</td>
                  <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">
                    {d.transactions.length}
                  </td>
                  <td className="px-3 py-2">
                    {reversed ? (
                      <span className="rounded bg-zinc-200 px-2 py-0.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                        Reversed
                      </span>
                    ) : (
                      <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        Active
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">{d.user.name}</td>
                </tr>
              );
            })}
            {dispatches.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-zinc-500 dark:text-zinc-500">
                  No dispatches recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
