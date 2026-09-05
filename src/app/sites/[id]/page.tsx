import { Pencil, Clock } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { updateSite } from "@/lib/actions/sites";
import { materialsAtSite, oldestContributingDate, effectiveFlagged } from "@/lib/stock";
import { can, currentUser } from "@/lib/permissions";
import SiteMaterialPanel, { type HeldRow } from "@/components/SiteMaterialPanel";
import DeleteSiteButton from "@/components/DeleteSiteButton";
import { notFound } from "next/navigation";
import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import { TableWrap, Table, THead, Th, Tr, Td } from "@/components/ui/Table";
import { Field, Input } from "@/components/ui/Field";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";

export default async function SiteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const site = await prisma.site.findUnique({ where: { id } });
  if (!site) notFound();

  // Queried with an explicit OR rather than through the `transactions`
  // relation: that relation only matches siteId, so a transfer OUT of this
  // site would never appear in its own activity feed.
  const activityRows = await prisma.transaction.findMany({
    where: { OR: [{ siteId: id }, { fromSiteId: id }] },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { item: true, user: true, dispatch: true, site: true, fromSite: true },
  });

  // A batch dispatch writes 15+ rows in one go; grouping them by dispatchId
  // keeps the activity list readable instead of a wall of loose lines. A
  // single-row Issue/Return (dispatchId null) still shows individually.
  type SiteTransaction = (typeof activityRows)[number];
  type ActivityEntry =
    | { kind: "dispatch"; id: string; reference: string | null; lines: SiteTransaction[] }
    | { kind: "single"; tx: SiteTransaction };

  const activity: ActivityEntry[] = [];
  const dispatchIndex = new Map<string, number>();
  for (const t of activityRows) {
    if (t.dispatchId) {
      const existing = dispatchIndex.get(t.dispatchId);
      if (existing != null) {
        (activity[existing] as { kind: "dispatch"; lines: SiteTransaction[] }).lines.push(t);
      } else {
        dispatchIndex.set(t.dispatchId, activity.length);
        activity.push({
          kind: "dispatch",
          id: t.dispatchId,
          reference: t.dispatch?.reference ?? null,
          lines: [t],
        });
      }
    } else {
      activity.push({ kind: "single", tx: t });
    }
  }

  const [materials, pickups, otherSites, user, ageMovements] = await Promise.all([
    materialsAtSite(id),
    prisma.sitePickup.findMany({ where: { siteId: id } }),
    prisma.site.findMany({ where: { NOT: { id } }, orderBy: { name: "asc" } }),
    currentUser(),
    // Age needs the COMPLETE history for this site, from both directions —
    // the activity list above is capped at 50 rows and misses outbound
    // transfers, so it cannot be reused here.
    prisma.transaction.findMany({
      where: {
        type: { in: ["ISSUE", "RETURN", "CONSUME", "TRANSFER"] },
        reversedAt: null,
        OR: [{ siteId: id }, { fromSiteId: id }],
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  const updateWithId = updateSite.bind(null, site.id);

  const flaggedByItem = new Map(pickups.map((p) => [p.itemId, p.quantity]));
  const heldRows: HeldRow[] = materials.map(({ item, quantity }) => ({
    itemId: item.id,
    name: item.name,
    baseUnit: item.baseUnit,
    quantity,
    // Derived from the balance, never the stored flag — see effectiveFlagged.
    flagged: effectiveFlagged(flaggedByItem.get(item.id) ?? 0, quantity),
    oldestISO:
      oldestContributingDate(
        ageMovements.filter((t) => t.itemId === item.id),
        id
      )?.toISOString() ?? null,
  }));

  return (
    <div className="space-y-6">
      <PageHeader title={site.name} />

      <div className="grid gap-4 md:grid-cols-2">
        {/* The whole card is gated, form included. It used to render the edit
            form unconditionally while `updateSite` required site:manage, so a
            non-admin got a form that threw NotPermittedError into the error
            boundary on save. That was survivable while only employees saw it;
            once finance absorbed the employee workspace (2026-09-05) this
            became a page they use daily, for consumption and transfers. */}
        {can(user?.role, "site:manage") ? (
          <Card>
            <CardHeader>
              <CardTitle tone="info" icon={<Pencil size={13} />}>
                Edit Site
              </CardTitle>
            </CardHeader>
            <CardBody>
              <form action={updateWithId} className="space-y-3">
                <Field label="Name">
                  <Input name="name" defaultValue={site.name} required />
                </Field>
                <Field label="Location">
                  <Input name="location" defaultValue={site.location ?? ""} />
                </Field>
                <Field label="Notes">
                  <Input name="notes" defaultValue={site.notes ?? ""} />
                </Field>
                <Button type="submit">Save</Button>
              </form>

              <div className="mt-5 border-t border-line pt-4">
                <DeleteSiteButton siteId={site.id} siteName={site.name} />
              </div>
            </CardBody>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle tone="info" icon={<Pencil size={13} />}>
                Site details
              </CardTitle>
            </CardHeader>
            <CardBody className="space-y-1 text-sm font-semibold text-ink-subtle">
              <p>{site.location || "No location recorded"}</p>
              {site.notes && <p>{site.notes}</p>}
              <p className="pt-2">Only an admin can rename or remove a site.</p>
            </CardBody>
          </Card>
        )}

        <SiteMaterialPanel
          siteId={id}
          rows={heldRows}
          otherSites={otherSites.map((s) => ({ id: s.id, name: s.name }))}
          canConsume={can(user?.role, "stock:consume")}
          canTransfer={can(user?.role, "stock:transfer")}
          canFlag={can(user?.role, "site:pickup")}
        />
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
                <Th>By</Th>
              </tr>
            </THead>
            <tbody>
              {activity.map((entry) => {
                if (entry.kind === "single") {
                  const t = entry.tx;
                  // A transfer is one row seen from two sides, so it has to say
                  // which way it went relative to THIS site.
                  const label =
                    t.type === "TRANSFER"
                      ? t.siteId === id
                        ? `TRANSFER IN${t.fromSite ? ` from ${t.fromSite.name}` : ""}`
                        : `TRANSFER OUT${t.site ? ` to ${t.site.name}` : ""}`
                      : t.type;
                  return (
                    <Tr key={t.id}>
                      <Td className="text-ink-subtle">{t.createdAt.toLocaleDateString()}</Td>
                      <Td>{label}</Td>
                      <Td className="font-semibold text-ink">{t.item.name}</Td>
                      <Td className="font-mono">{t.quantity}</Td>
                      <Td className="text-ink-subtle">{t.user.name}</Td>
                    </Tr>
                  );
                }
                // Only the ISSUE lines describe what was dispatched — a
                // REVERSAL sharing the same dispatchId is the undo of one of
                // them, not a second item, so it must not double the count.
                const issued = entry.lines.filter((t) => t.type === "ISSUE");
                const total = issued.reduce((s, t) => s + t.quantity, 0);
                const allReversed = issued.length > 0 && issued.every((t) => t.reversedAt);
                return (
                  <Tr key={entry.id}>
                    <Td className="text-ink-subtle">{issued[0].createdAt.toLocaleDateString()}</Td>
                    <Td>DISPATCH</Td>
                    <Td>
                      <Link href={`/dispatches/${entry.id}`} className="font-semibold text-ink hover:text-accent">
                        {entry.reference || "Dispatch"} — {issued.length} item
                        {issued.length === 1 ? "" : "s"}
                        {allReversed && " (reversed)"}
                      </Link>
                    </Td>
                    <Td className="font-mono">{total}</Td>
                    <Td className="text-ink-subtle">{issued[0].user.name}</Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        </TableWrap>
        {activityRows.length === 0 && <EmptyState>No activity yet.</EmptyState>}
      </Card>
    </div>
  );
}
