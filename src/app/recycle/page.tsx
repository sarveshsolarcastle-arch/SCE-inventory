import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatQuantity } from "@/lib/units";
import PageHeader from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { TableWrap, Table, THead, Th, Tr, Td } from "@/components/ui/Table";
import EmptyState from "@/components/ui/EmptyState";

/** Offcuts that fell to or below their item's scrap threshold. They still exist
 * physically — nothing is deleted — they just stopped counting as stock. */
export default async function RecyclePage() {
  const scrap = await prisma.openPack.findMany({
    where: { state: "SCRAP" },
    include: { item: true, shelfSlot: { include: { shelf: true } } },
    orderBy: { openedAt: "desc" },
  });

  const byItem = new Map<string, { item: (typeof scrap)[number]["item"]; packs: typeof scrap }>();
  for (const pack of scrap) {
    const entry = byItem.get(pack.itemId) ?? { item: pack.item, packs: [] };
    entry.packs.push(pack);
    byItem.set(pack.itemId, entry);
  }
  const groups = [...byItem.values()].sort((a, b) =>
    a.item.name.localeCompare(b.item.name)
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Recycle"
        subtitle="Offcuts at or below their item's scrap threshold. Not counted in stock and cannot be issued, but nothing has been deleted — move them to a Recyclable box on the shelf when convenient."
      />

      <Card>
        <TableWrap>
          <Table>
            <THead>
              <tr>
                <Th>Item</Th>
                <Th>Offcuts</Th>
                <Th>Total</Th>
                <Th>Threshold</Th>
                <Th>Location</Th>
              </tr>
            </THead>
            <tbody>
              {groups.map(({ item, packs }) => (
                <Tr key={item.id}>
                  <Td>
                    <Link href={`/items/${item.id}`} className="font-bold text-ink hover:text-accent">
                      {item.name}
                    </Link>
                  </Td>
                  <Td className="font-mono text-ink-subtle">
                    {packs.map((p) => `${p.remaining} ${item.baseUnit}`).join(" · ")}
                  </Td>
                  <Td className="font-mono font-bold">
                    {formatQuantity(item, packs.reduce((s, p) => s + p.remaining, 0))}
                  </Td>
                  <Td className="text-ink-subtle">
                    {item.scrapThreshold === null ? "—" : formatQuantity(item, item.scrapThreshold)}
                  </Td>
                  <Td className="text-ink-subtle">
                    {packs
                      .map((p) => (p.shelfSlot ? `${p.shelfSlot.shelf.name} · ${p.shelfSlot.tagCode}` : "unplaced"))
                      .join(", ")}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
        {groups.length === 0 && <EmptyState>No scrap offcuts.</EmptyState>}
      </Card>
    </div>
  );
}
