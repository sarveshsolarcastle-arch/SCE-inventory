import Link from "next/link";
import { Package, AlertTriangle, MapPin, Clock, ShieldCheck, TrendingUp } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getPlacementSuggestions } from "@/lib/suggestions";
import { materialAcrossSites } from "@/lib/stock";
import { can, currentUser } from "@/lib/permissions";
import PageHeader from "@/components/ui/PageHeader";
import { buttonClasses } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import { TableWrap, Table, THead, Th, Tr, Td } from "@/components/ui/Table";
import StatCard from "@/components/ui/StatCard";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import { TRANSACTION_TYPE_TONE } from "@/components/ui/tones";

/** The dashboard is one page that reshapes itself: each role gets the actions
 * it can actually perform, so an account is not shown doors it cannot open. */
function actionsFor(role: Parameters<typeof can>[0]) {
  const all = [
    { href: "/transactions/new", label: "Issue / Return", capability: "stock:issue" as const },
    { href: "/items/new", label: "New item", capability: "item:manage" as const },
  ];
  return all.filter((a) => can(role, a.capability));
}

export default async function DashboardPage() {
  const user = await currentUser();
  const actions = actionsFor(user?.role);

  const [itemCount, allItems, recentTx, suggestions, openClaims] = await Promise.all([
    prisma.item.count(),
    prisma.item.findMany({ orderBy: { name: "asc" } }),
    prisma.transaction.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { item: true, site: true, user: true },
    }),
    getPlacementSuggestions(),
    prisma.defectiveItem.count({ where: { status: { not: "REPLACED" } } }),
  ]);

  const lowStock = allItems.filter((item) => item.currentStock < item.minStock);

  // Material at sites is SHOWN beside a low-stock item but never COUNTED
  // toward it: reorder levels stay store-only, so the app never implies
  // material it cannot hand over today is available. Without this line
  // though, an alert can tell you to buy wire while 300 m sits stranded
  // across three sites.
  const atSites = await materialAcrossSites();
  const strandedByItem = new Map<string, { quantity: number; siteCount: number }>();
  let awaitingCollection = 0;
  const sitesHoldingMaterial = atSites.filter((s) => s.items.length > 0).length;
  for (const { items } of atSites) {
    for (const entry of items) {
      const current = strandedByItem.get(entry.item.id) ?? { quantity: 0, siteCount: 0 };
      current.quantity += entry.quantity;
      current.siteCount += 1;
      strandedByItem.set(entry.item.id, current);
      if (entry.flagged > 0) awaitingCollection += 1;
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        subtitle={`Welcome back, ${user?.name ?? "there"}`}
        actions={
          actions.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {actions.map((a) => (
                <Link key={a.href} href={a.href} className={buttonClasses("primary", "md")}>
                  {a.label}
                </Link>
              ))}
            </div>
          ) : undefined
        }
      />

      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Total Items" value={itemCount} tone="info" icon={<Package size={16} />} />
        <StatCard
          label="Low Stock Alerts"
          value={lowStock.length}
          tone="ok"
          alert={lowStock.length > 0}
          icon={<AlertTriangle size={16} />}
        />
        <StatCard
          label="Material at Sites"
          value={sitesHoldingMaterial}
          note={sitesHoldingMaterial === 1 ? "site" : "sites"}
          tone="special"
          icon={<MapPin size={16} />}
          href="/at-sites"
        />
        <StatCard
          label="Awaiting Collection"
          value={awaitingCollection}
          tone="warn"
          icon={<Clock size={16} />}
          href="/at-sites?filter=flagged"
        />
        <StatCard
          label="Open Claims"
          value={openClaims}
          tone={openClaims > 0 ? "danger" : "ok"}
          icon={<ShieldCheck size={16} />}
          href="/defective"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle tone="danger" icon={<AlertTriangle size={13} />}>
              Low Stock Alerts
            </CardTitle>
          </CardHeader>
          <CardBody className="divide-y divide-line p-0">
            {lowStock.map((item) => {
              const stranded = strandedByItem.get(item.id);
              return (
                <div key={item.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-danger-soft text-danger-ink">
                      <Package size={13} />
                    </span>
                    <Link href={`/items/${item.id}`} className="truncate font-semibold text-ink hover:text-accent">
                      {item.name}
                    </Link>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="font-mono font-bold text-danger-ink">
                      {item.currentStock} / min {item.minStock} {item.baseUnit}
                    </span>
                    {stranded && (
                      <Link
                        href="/at-sites"
                        className="block text-xs font-semibold text-ink-subtle hover:text-accent"
                      >
                        + {stranded.quantity} {item.baseUnit} at {stranded.siteCount} site
                        {stranded.siteCount === 1 ? "" : "s"} (not counted)
                      </Link>
                    )}
                  </span>
                </div>
              );
            })}
            {lowStock.length === 0 && <EmptyState>All items are above minimum stock.</EmptyState>}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle tone="special" icon={<TrendingUp size={13} />}>
              Placement Suggestions
            </CardTitle>
            <Link href="/shelf/suggestions" className="text-xs font-bold text-accent hover:text-accent-hover">
              View all
            </Link>
          </CardHeader>
          <CardBody className="divide-y divide-line p-0">
            {suggestions.slice(0, 5).map((s) => (
              <div key={s.item.id} className="flex items-center gap-2.5 px-4 py-2.5 text-sm">
                <Badge tone="info" className="shrink-0">
                  {s.frequency}×/30d
                </Badge>
                <span className="min-w-0">
                  <span className="font-semibold text-ink">{s.item.name}</span>{" "}
                  <span className="text-ink-subtle">
                    → move to {s.targetSlot.shelfName} {s.targetSlot.tagCode}
                    {s.targetSlot.occupant && <> (currently {s.targetSlot.occupant.name})</>}
                  </span>
                </span>
              </div>
            ))}
            {suggestions.length === 0 && (
              <EmptyState>No relocation suggestions right now.</EmptyState>
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle tone="ok" icon={<Clock size={13} />}>
            Recent Activity
          </CardTitle>
        </CardHeader>
        <TableWrap>
          <Table>
            <THead>
              <tr>
                <Th>Date</Th>
                <Th>Type</Th>
                <Th>Item</Th>
                <Th>Qty</Th>
                <Th>Site</Th>
                <Th>By</Th>
              </tr>
            </THead>
            <tbody>
              {recentTx.map((t) => (
                <Tr key={t.id}>
                  <Td className="text-ink-subtle">{t.createdAt.toLocaleString()}</Td>
                  <Td>
                    <Badge tone={TRANSACTION_TYPE_TONE[t.type] ?? "neutral"}>{t.type}</Badge>
                  </Td>
                  <Td className="font-semibold text-ink">{t.item.name}</Td>
                  <Td className="font-mono">{t.quantity}</Td>
                  <Td className="text-ink-subtle">{t.site?.name ?? "—"}</Td>
                  <Td className="text-ink-subtle">{t.user.name}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
        {recentTx.length === 0 && <EmptyState>No activity yet.</EmptyState>}
      </Card>
    </div>
  );
}
