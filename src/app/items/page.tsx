/* Items list (/items): the catalogue, with search and sorting.
 *
 * Sorting is a whitelist (SORT_FIELDS) so a `?sort=` value can never name an
 * arbitrary column. Searching is "forgiving" (src/lib/itemSearch.ts: plurals,
 * typos, "did you mean"), which cannot be expressed as SQL, so when a search term
 * is present the sorted list is loaded and filtered in memory.
 */
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireCapability } from "@/lib/permissions";
import PageHeader from "@/components/ui/PageHeader";
import SearchBar from "@/components/ui/SearchBar";
import { buttonClasses } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TableWrap, Table, THead, Tr, Td } from "@/components/ui/Table";
import SortableTh from "@/components/ui/SortableTh";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import Alert from "@/components/ui/Alert";
import { searchItems } from "@/lib/itemSearch";

const SORT_FIELDS = { name: "name", sku: "sku", category: "category", stock: "currentStock" } as const;
type SortKey = keyof typeof SORT_FIELDS;

function isSortKey(v: string | undefined): v is SortKey {
  return !!v && v in SORT_FIELDS;
}

export default async function ItemsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string; dir?: string }>;
}) {
  // Checked here, not left to proxy.ts — that file documents itself as
  // convenience only, matching the same direct check on /ledger and /transfers.
  await requireCapability("ledger:view");

  const { q, sort, dir } = await searchParams;
  const sortKey: SortKey = isSortKey(sort) ? sort : "name";
  const sortDir: "asc" | "desc" = dir === "desc" ? "desc" : "asc";

  // With a search term, load the sorted list and filter it in memory: the
  // forgiving match (plurals, typos) can't be expressed as a SQL `contains`,
  // and a store catalogue is small enough that this is cheap.
  const all = await prisma.item.findMany({
    orderBy: { [SORT_FIELDS[sortKey]]: sortDir },
    include: { shelfSlots: { include: { shelf: true } } },
  });

  const term = q?.trim();
  let items = all;
  let didYouMean: string | null = null;
  let closeMatches = false;
  if (term) {
    const outcome = searchItems(all, term);
    // An explicit column sort wins; otherwise the best match comes first.
    // Array.sort is stable, so ties keep the name order from the query above.
    const ranked = sort
      ? outcome.matches
      : outcome.matches.slice().sort((a, b) => b.score - a.score);
    items = ranked.map((m) => m.item);
    didYouMean = outcome.suggestion;
    closeMatches = outcome.fuzzy;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Items"
        subtitle={`${items.length} item${items.length === 1 ? "" : "s"}${q ? ` matching "${q}"` : ""}`}
        actions={
          <Link href="/items/new" className={buttonClasses("primary", "md")}>
            <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d="M10 4v12M4 10h12" /></svg>
            New Item
          </Link>
        }
      />

      <SearchBar name="q" defaultValue={q ?? ""} placeholder="Search by name, SKU, or category" />

      {closeMatches && (
        <Alert tone="info">
          No exact match for <strong>&ldquo;{term}&rdquo;</strong>. Showing close matches
          {didYouMean && (
            <>
              {" "}
              — did you mean{" "}
              <Link
                href={`/items?${new URLSearchParams({ q: didYouMean, ...(sort ? { sort, dir: sortDir } : {}) }).toString()}`}
                className="font-bold underline"
              >
                {didYouMean}
              </Link>
              ?
            </>
          )}
        </Alert>
      )}

      <Card>
        <TableWrap>
          <Table>
            <THead>
              <tr>
                <SortableTh label="Name" sortKey="name" currentSort={sortKey} currentDir={sortDir} basePath="/items" searchParams={{ q }} />
                <SortableTh label="SKU" sortKey="sku" currentSort={sortKey} currentDir={sortDir} basePath="/items" searchParams={{ q }} />
                <SortableTh label="Category" sortKey="category" currentSort={sortKey} currentDir={sortDir} basePath="/items" searchParams={{ q }} />
                <SortableTh label="Stock" sortKey="stock" currentSort={sortKey} currentDir={sortDir} basePath="/items" searchParams={{ q }} />
                <th className="border-b border-line px-4 py-2.5 text-left text-[11px] font-bold tracking-wide text-ink-subtle uppercase">Shelf</th>
              </tr>
            </THead>
            <tbody>
              {items.map((item) => {
                const low = item.currentStock < item.minStock;
                return (
                  <Tr key={item.id}>
                    <Td>
                      <Link href={`/items/${item.id}`} className="font-bold text-ink hover:text-accent">
                        {item.name}
                      </Link>
                    </Td>
                    <Td className="font-mono text-xs text-ink-subtle">{item.sku}</Td>
                    <Td>
                      {item.category ? <Badge tone="neutral">{item.category}</Badge> : <span className="text-ink-subtle">—</span>}
                    </Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-ink">
                          {item.currentStock} {item.baseUnit}
                        </span>
                        {low && <Badge tone="danger">Low stock</Badge>}
                      </div>
                    </Td>
                    <Td className="text-ink-subtle">
                      {item.shelfSlots.length > 0
                        ? item.shelfSlots
                            .map((s) => `${s.shelf.name} · ${s.tagCode} (${s.boxType})`)
                            .join(", ")
                        : "Unassigned"}
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        </TableWrap>
        {items.length === 0 && <EmptyState>No items found.</EmptyState>}
      </Card>
    </div>
  );
}
