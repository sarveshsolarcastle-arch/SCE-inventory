import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { updateSlotBoxType, toggleFrontRow, assignSlotItem } from "@/lib/actions/shelf";
import ShelfGrid from "@/components/ShelfGrid";
import { describeSlotContents } from "@/lib/units";
import { notFound } from "next/navigation";
import PageHeader from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";

export default async function ShelfDetailPage({
  params,
}: {
  params: Promise<{ shelfId: string }>;
}) {
  const { shelfId } = await params;

  const [shelf, session, items] = await Promise.all([
    prisma.shelf.findUnique({
      where: { id: shelfId },
      include: {
        slots: {
          include: {
            openPacks: { where: { state: "OPEN" } },
            item: { include: { packStock: true, openPacks: true, shelfSlots: true } },
          },
        },
      },
    }),
    auth(),
    prisma.item.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, sku: true },
    }),
  ]);

  if (!shelf) notFound();

  const isAdmin = (session?.user as { role?: string } | undefined)?.role === "ADMIN";

  const slots = shelf.slots.map((slot) => {
    const item = slot.item;
    const contents = item
      ? describeSlotContents(item, slot.boxType, {
          sealed: item.packStock,
          openInThisSlot: slot.openPacks.map((p) => p.remaining),
          scrap: item.openPacks
            .filter((p) => p.state === "SCRAP")
            .map((p) => p.remaining),
          freshSlotCount: item.shelfSlots.filter((s) => s.boxType === "FRESH").length,
        })
      : null;

    return {
      id: slot.id,
      side: slot.side,
      row: slot.row,
      column: slot.column,
      tagCode: slot.tagCode,
      isFrontRow: slot.isFrontRow,
      boxType: slot.boxType,
      contents,
      item: item ? { id: item.id, name: item.name } : null,
      updateBoxTypeAction: updateSlotBoxType.bind(null, shelf.id, slot.id),
      assignItemAction: assignSlotItem.bind(null, shelf.id, slot.id),
      toggleAction: toggleFrontRow.bind(null, shelf.id, slot.id),
    };
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title={shelf.name}
        subtitle={
          <>
            This map matches your physical stickers. <Badge tone="ok">green</Badge> boxes are
            marked as easily-accessible (front-row) positions. Quantities are not stored here — a
            box shows whatever its item&apos;s packs currently hold, so the map cannot drift out
            of step with stock. A Fresh box shows sealed packs, an Opened box shows the individual
            open packs placed in it, and a Recyclable box shows offcuts below the item&apos;s
            scrap threshold. You can relabel a box&apos;s condition here as material is opened or
            used up.
          </>
        }
      />
      <Card>
        <CardBody>
          <ShelfGrid
            rows={shelf.rows}
            columns={shelf.columns}
            slots={slots}
            items={items}
            isAdmin={isAdmin}
          />
        </CardBody>
      </Card>
    </div>
  );
}
