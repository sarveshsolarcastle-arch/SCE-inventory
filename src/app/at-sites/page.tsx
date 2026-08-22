import Link from "next/link";
import { materialAcrossSites } from "@/lib/stock";
import PageHeader from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { TableWrap, Table, THead, Th, Tr, Td } from "@/components/ui/Table";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import FilterPills from "@/components/ui/FilterPills";

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
        {visible.map(({ site, items }) => (
          <Card key={site.id}>
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-4 py-3">
              <Link href={`/sites/${site.id}`} className="font-bold text-ink hover:text-accent">
                {site.name}
              </Link>
              <span className="text-sm font-semibold text-ink-subtle">
                {site.location ?? "no location set"} · {items.length} item
                {items.length === 1 ? "" : "s"}
              </span>
            </div>

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
                      <Td className="text-ink-subtle">
                        {entry.oldest ? describeAge(entry.oldest) : "—"}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          </Card>
        ))}
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
