import Link from "next/link";
import { MapPin } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { materialAcrossSites } from "@/lib/stock";
import PageHeader from "@/components/ui/PageHeader";
import { buttonClasses } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";

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
      <PageHeader
        title="Sites"
        subtitle={`${sites.length} site${sites.length === 1 ? "" : "s"}`}
        actions={
          <Link href="/sites/new" className={buttonClasses("primary", "md")}>
            <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d="M10 4v12M4 10h12" /></svg>
            New Site
          </Link>
        }
      />

      {sites.length === 0 ? (
        <Card>
          <EmptyState>No sites yet.</EmptyState>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sites.map((site) => {
            const summary = summaryBySite.get(site.id);
            return (
              <Link
                key={site.id}
                href={`/sites/${site.id}`}
                className="rounded-card border border-line bg-surface p-4 shadow-card transition-shadow hover:shadow-raised"
              >
                <div className="flex items-start gap-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-special-soft text-special-ink">
                    <MapPin size={17} />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-bold text-ink">{site.name}</p>
                    <p className="truncate text-sm font-semibold text-ink-subtle">
                      {site.location ?? "No location set"}
                    </p>
                  </div>
                </div>
                {summary ? (
                  <p className="mt-2 text-xs font-semibold text-ink-subtle">
                    {summary.headline}
                    {summary.more > 0 && ` +${summary.more} more`}
                    {summary.flagged > 0 && (
                      <Badge tone="info" className="ml-1.5 align-middle">
                        {summary.flagged} awaiting collection
                      </Badge>
                    )}
                  </p>
                ) : (
                  <p className="mt-2 text-xs font-semibold text-ink-subtle">Nothing on site</p>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
