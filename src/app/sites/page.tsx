import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function SitesPage() {
  const sites = await prisma.site.findMany({ orderBy: { name: "asc" } });

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
        {sites.map((site) => (
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
          </Link>
        ))}
        {sites.length === 0 && (
          <p className="text-sm text-zinc-500 dark:text-zinc-500">
            No sites yet.
          </p>
        )}
      </div>
    </div>
  );
}
