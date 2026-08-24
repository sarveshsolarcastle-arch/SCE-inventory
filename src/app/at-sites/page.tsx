import Link from "next/link";
import { materialAcrossSites } from "@/lib/stock";
import PageHeader from "@/components/ui/PageHeader";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { TableWrap, Table, THead, Th, Tr, Td } from "@/components/ui/Table";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import FilterPills from "@/components/ui/FilterPills";
import type { BadgeTone } from "@/components/ui/tones";
import { MapPin } from "lucide-react";

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
  const active = flaggedOnly ? "flagged" : sortByAge ? "age" : "all";

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
      <PageHeader
        title="Material at Sites"
        subtitle="Everything issued or delivered to a site and not yet returned, consumed or transferred on. Not counted in store stock — it cannot be handed out today — so reorder levels ignore it."
      />

      <FilterPills
        active={active}
        options={[
          { value: "all", label: "All material", href: "/at-sites" },
          {
            value: "flagged",
            label: `Awaiting collection${totalFlagged ? ` (${totalFlagged})` : ""}`,
            href: "/at-sites?filter=flagged",
          },
          { value: "age", label: "Oldest first", href: "/at-sites?sort=age" },
        ]}
      />

      {visible.length === 0 && (
        <Card>
          <EmptyState>
            {flaggedOnly
              ? "Nothing is flagged for collection."
              : "No site is currently holding material."}
          </EmptyState>
        </Card>
      )}

      <div className="space-y-4">
        {visible.map(({ site, items }) => {
          const flaggedHere = items.filter((i) => i.flagged > 0).length;
          // The oldest thing on a site decides how loudly that site asks for a
          // visit, so the card header carries it rather than burying it in a row.
          const oldestHere = Math.min(
            ...items.map((i) => (i.oldest ? +i.oldest : Infinity))
          );
          const siteTone = ageTone(oldestHere);

          return (
            <Card key={site.id}>
              <CardHeader>
                <CardTitle icon={<MapPin className="h-3.5 w-3.5" />} tone={siteTone}>
                  <Link href={`/sites/${site.id}`} className="hover:text-accent">
                    {site.name}
                  </Link>
                </CardTitle>
                <span className="flex flex-wrap items-center gap-2">
                  {flaggedHere > 0 && (
                    <Badge tone="info">
                      {flaggedHere} awaiting collection
                    </Badge>
                  )}
                  <span className="text-sm font-semibold text-ink-subtle">
                    {site.location ?? "no location set"} · {items.length} item
                    {items.length === 1 ? "" : "s"}
                  </span>
                </span>
              </CardHeader>

            <TableWrap>
              <Table>
                <THead>
                  <tr>
                    <Th>Item</Th>
                    <Th>At site</Th>
                    <Th>Awaiting collection</Th>
                    <Th>Oldest here</Th>
                  </tr>
                </THead>
                <tbody>
                  {items.map((entry) => (
                    <Tr key={entry.item.id}>
                      <Td>
                        <Link href={`/items/${entry.item.id}`} className="font-semibold text-ink hover:text-accent">
                          {entry.item.name}
                        </Link>
                      </Td>
                      <Td className="font-mono">
                        {entry.quantity} {entry.item.baseUnit}
                      </Td>
                      <Td>
                        {entry.flagged > 0 ? (
                          <Badge tone="info">
                            {entry.flagged} {entry.item.baseUnit}
                          </Badge>
                        ) : (
                          <span className="text-ink-subtle">—</span>
                        )}
                      </Td>
                      <Td>
                        {entry.oldest ? (
                          <Badge tone={ageTone(+entry.oldest)} variant="outline">
                            {describeAge(entry.oldest)}
                          </Badge>
                        ) : (
                          <span className="text-ink-subtle">—</span>
                        )}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          </Card>
          );
        })}
      </div>
    </div>
  );
}

function describeAge(from: Date): string {
  const days = Math.floor((Date.now() - from.getTime()) / 86_400_000);
  if (days < 1) return "today";
  if (days === 1) return "1 day";
  if (days < 60) return `${days} days`;
  return `${Math.floor(days / 30)} months`;
}

/** Age is the whole point of this page — it is what says whether a detour is
 * worth making — so it is shown as a colour, not just a number. The thresholds
 * are deliberately coarse: this is a nudge toward a trip, not an SLA. */
function ageTone(from: number): BadgeTone {
  if (!Number.isFinite(from)) return "neutral";
  const days = Math.floor((Date.now() - from) / 86_400_000);
  if (days >= 30) return "danger";
  if (days >= 7) return "warn";
  return "ok";
}
