import Link from "next/link";
import { materialAcrossSites } from "@/lib/stock";

/** "What is still out there, and where" — answering it used to mean opening
 * every site page in turn. Age is what turns this from a list into a pickup
 * plan: it says whether a detour is worth making. */
export default async function AtSitesPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; sort?: string }>;
}) {
  const { filter, sort } = await searchParams;
  const flaggedOnly = filter === "flagged";
  const sortByAge = sort === "age";

  const sites = await materialAcrossSites();

  const visible = sites
    .map((s) => ({
      ...s,
      items: flaggedOnly ? s.items.filter((i) => i.flagged > 0) : s.items,
    }))
    .filter((s) => s.items.length > 0);

  if (sortByAge) {
    // Oldest material first — the sites most worth a trip float up.
    visible.sort((a, b) => {
      const oldest = (s: typeof a) =>
        Math.min(...s.items.map((i) => (i.oldest ? +i.oldest : Infinity)));
      return oldest(a) - oldest(b);
    });
  }

  const totalFlagged = sites.reduce(
    (n, s) => n + s.items.filter((i) => i.flagged > 0).length,
    0
  );

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
        Material at Sites
      </h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Everything issued or delivered to a site and not yet returned, consumed
        or transferred on. This material is <strong>not</strong> counted in
        store stock — it cannot be handed out today — so reorder levels ignore
        it.
      </p>

      <div className="flex flex-wrap gap-2 text-sm">
        <Filter href="/at-sites" label="All material" active={!flaggedOnly && !sortByAge} />
        <Filter
          href="/at-sites?filter=flagged"
          label={`Awaiting collection${totalFlagged ? ` (${totalFlagged})` : ""}`}
          active={flaggedOnly}
        />
        <Filter href="/at-sites?sort=age" label="Oldest first" active={sortByAge} />
      </div>

      {visible.length === 0 && (
        <p className="rounded border border-zinc-200 py-8 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-500">
          {flaggedOnly
            ? "Nothing is flagged for collection."
            : "No site is currently holding material."}
        </p>
      )}

      <div className="space-y-4">
        {visible.map(({ site, items }) => (
          <div
            key={site.id}
            className="space-y-2 rounded border border-zinc-200 p-4 dark:border-zinc-800"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <Link
                href={`/sites/${site.id}`}
                className="font-medium text-zinc-900 hover:underline dark:text-zinc-50"
              >
                {site.name}
              </Link>
              <span className="text-sm text-zinc-500 dark:text-zinc-500">
                {site.location ?? "no location set"} · {items.length} item
                {items.length === 1 ? "" : "s"}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-zinc-500 dark:text-zinc-500">
                  <tr>
                    <th className="py-1">Item</th>
                    <th className="py-1">At site</th>
                    <th className="py-1">Awaiting collection</th>
                    <th className="py-1">Oldest here</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((entry) => (
                    <tr
                      key={entry.item.id}
                      className="border-t border-zinc-200 dark:border-zinc-800"
                    >
                      <td className="py-1">
                        <Link href={`/items/${entry.item.id}`} className="hover:underline">
                          {entry.item.name}
                        </Link>
                      </td>
                      <td className="py-1">
                        {entry.quantity} {entry.item.baseUnit}
                      </td>
                      <td className="py-1">
                        {entry.flagged > 0 ? (
                          <span className="rounded bg-sky-100 px-2 py-0.5 text-xs text-sky-800 dark:bg-sky-950 dark:text-sky-300">
                            {entry.flagged} {entry.item.baseUnit}
                          </span>
                        ) : (
                          <span className="text-zinc-500">—</span>
                        )}
                      </td>
                      <td className="py-1 text-zinc-600 dark:text-zinc-400">
                        {entry.oldest ? describeAge(entry.oldest) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Filter({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`rounded px-3 py-1.5 ${
        active
          ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
          : "border border-zinc-300 dark:border-zinc-700"
      }`}
    >
      {label}
    </Link>
  );
}

function describeAge(from: Date): string {
  const days = Math.floor((Date.now() - from.getTime()) / 86_400_000);
  if (days < 1) return "today";
  if (days === 1) return "1 day";
  if (days < 60) return `${days} days`;
  return `${Math.floor(days / 30)} months`;
}
