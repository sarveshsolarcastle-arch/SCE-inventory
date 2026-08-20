import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { materialAcrossSites } from "@/lib/stock";

export default async function SitesPage() {
  const [sites, atSites] = await Promise.all([
    prisma.site.findMany({ orderBy: { name: "asc" } }),
    materialAcrossSites(),
  ]);

  // The cards used to show name and location only, which said nothing about
  // whether a site actually has anything on it.
  const summaryBySite = new Map(
    atSites.map(({ site, items }) => [
      site.id,
      {
        itemCount: items.length,
        flagged: items.filter((i) => i.flagged > 0).length,
        headline: items
          .slice(0, 2)
          .map((i) => `${i.quantity} ${i.item.baseUnit} ${i.item.name}`)
          .join(", "),
        more: Math.max(0, items.length - 2),
      },
    ])
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          Sites
        </h1>
        <Link
          href="/sites/new"
          className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900"
        >
          + New Site
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sites.map((site) => {
          const summary = summaryBySite.get(site.id);
          return (
            <Link
              key={site.id}
              href={`/sites/${site.id}`}
              className="rounded border border-zinc-200 p-4 hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
            >
              <p className="font-medium text-zinc-900 dark:text-zinc-50">
                {site.name}
              </p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {site.location ?? "No location set"}
              </p>
              {summary ? (
                <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-500">
                  {summary.headline}
                  {summary.more > 0 && ` +${summary.more} more`}
                  {summary.flagged > 0 && (
                    <span className="ml-1 text-sky-700 dark:text-sky-400">
                      · {summary.flagged} awaiting collection
                    </span>
                  )}
                </p>
              ) : (
                <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-500">
                  Nothing on site
                </p>
              )}
            </Link>
          );
        })}
        {sites.length === 0 && (
          <p className="text-sm text-zinc-500 dark:text-zinc-500">
            No sites yet.
          </p>
        )}
      </div>
    </div>
  );
}
