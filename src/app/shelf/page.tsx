import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function ShelfListPage() {
  const shelves = await prisma.shelf.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { slots: true } } },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          Shelves
        </h1>
        <Link
          href="/shelf/new"
          className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900"
        >
          + New Shelf
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {shelves.map((shelf) => (
          <Link
            key={shelf.id}
            href={`/shelf/${shelf.id}`}
            className="rounded border border-zinc-200 p-4 hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
          >
            <p className="font-medium text-zinc-900 dark:text-zinc-50">
              {shelf.name}
            </p>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {shelf.rows} rows × {shelf.columns} cols, 2 sides ({shelf._count.slots}{" "}
              slots)
            </p>
          </Link>
        ))}
        {shelves.length === 0 && (
          <p className="text-sm text-zinc-500 dark:text-zinc-500">
            No shelves yet.
          </p>
        )}
      </div>
    </div>
  );
}
