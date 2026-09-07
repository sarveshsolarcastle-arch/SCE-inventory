import { prisma } from "@/lib/prisma";
import { updateSlotBoxType, toggleFrontRow, assignSlotItem } from "@/lib/actions/shelf";
import DeleteShelfButton from "@/components/DeleteShelfButton";
import { capabilityMode, currentUser } from "@/lib/permissions";
import ShelfGrid from "@/components/ShelfGrid";
import { describeSlotContents } from "@/lib/units";
import { notFound } from "next/navigation";
import PageHeader from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Alert from "@/components/ui/Alert";

export default async function ShelfDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ shelfId: string }>;
  /** `?requested=<id>` — the three slot actions send a requester back to this
   * same shelf rather than to the queue. Bouncing someone out of the shelf they
   * are working on, mid-edit, for a two-second relabel would be disorienting;
   * returning here also closes the popover on remount. */
  searchParams: Promise<{ requested?: string }>;
}) {
  const { shelfId } = await params;
  const { requested } = await searchParams;

  const [shelf, user, items, placedPacks] = await Promise.all([
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
    // currentUser(), not auth(): it re-reads the row rather than trusting the
    // JWT, so a demoted or deactivated account loses these controls on the next
    // request instead of when its token happens to expire.
    currentUser(),
    prisma.item.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, sku: true },
    }),
    // Every pack recorded as sitting on this shelf, in ANY state — the delete
    // warning counts scrap packs in Recyclable boxes too, whereas the grid
    // above only ever renders OPEN ones.
    prisma.openPack.count({ where: { shelfSlot: { shelfId } } }),
  ]);

  if (!shelf) notFound();

  const role = user?.role;
  // The three actions in a slot's popover all require shelf:manage, so that is
  // what gates them. This used to read `role === "ADMIN"`, which gave the right
  // answer only for as long as ADMIN was the sole holder of that capability;
  // then `can()`, which was right about permission and silent about the third
  // case — a role that may only ASK, and so should see the popover with
  // different words on its buttons rather than no popover at all.
  const manageMode = capabilityMode(role, "shelf:manage");
  const deleteMode = capabilityMode(role, "shelf:delete");
  const assignedBoxes = shelf.slots.filter((slot) => slot.itemId).length;

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
            This map matches your physical stickers. A box&apos;s colour is its condition —{" "}
            <Badge tone="ok">Fresh</Badge> holds sealed packs, <Badge tone="warn">Opened</Badge>{" "}
            holds the individual open packs placed in it, and{" "}
            <Badge tone="special">Recyclable</Badge> holds offcuts below the item&apos;s scrap
            threshold. Boxes ringed with a ★ are easily-accessible front-row positions; empty
            boxes are greyed out. Quantities are not stored here — a box shows whatever its
            item&apos;s packs currently hold, so the map cannot drift out of step with stock.
            {manageMode === "do"
              ? " You can relabel a box's condition here as material is opened or used up."
              : manageMode === "request"
                ? " You can ask an admin to relabel a box as material is opened or used up — open one and the buttons will say so."
                : " Relabelling a box is an admin job."}
          </>
        }
      />

      {requested && (
        <Alert tone="info">
          Sent to the admins for approval. Nothing has changed on this shelf yet — it will
          be carried out, recorded against you, once one of them approves it.
        </Alert>
      )}

      <Card>
        <CardBody>
          <ShelfGrid
            rows={shelf.rows}
            columns={shelf.columns}
            slots={slots}
            items={items}
            mode={manageMode}
          />
        </CardBody>
      </Card>

      {deleteMode !== "none" && (
        <Card>
          <CardBody>
            <DeleteShelfButton
              shelfId={shelf.id}
              shelfName={shelf.name}
              assignedBoxes={assignedBoxes}
              placedPacks={placedPacks}
              mode={deleteMode}
            />
          </CardBody>
        </Card>
      )}
    </div>
  );
}
