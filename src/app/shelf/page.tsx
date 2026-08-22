import Link from "next/link";
import { LayoutGrid } from "lucide-react";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/ui/PageHeader";
import { buttonClasses } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";

export default async function ShelfListPage() {
  const shelves = await prisma.shelf.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { slots: true } } },
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Shelves"
        subtitle={`${shelves.length} shelf unit${shelves.length === 1 ? "" : "s"}`}
        actions={
          <Link href="/shelf/new" className={buttonClasses("primary", "md")}>
            <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d="M10 4v12M4 10h12" /></svg>
            New Shelf
          </Link>
        }
      />

      {shelves.length === 0 ? (
        <Card>
          <EmptyState>No shelves yet.</EmptyState>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shelves.map((shelf) => (
            <Link
              key={shelf.id}
              href={`/shelf/${shelf.id}`}
              className="rounded-card border border-line bg-surface p-4 shadow-card transition-shadow hover:shadow-raised"
            >
              <div className="flex items-start gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-info-soft text-info-ink">
                  <LayoutGrid size={17} />
                </span>
                <div className="min-w-0">
                  <p className="truncate font-bold text-ink">{shelf.name}</p>
                  <p className="text-sm font-semibold text-ink-subtle">
                    {shelf.rows} rows × {shelf.columns} cols, 2 sides ({shelf._count.slots} slots)
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
