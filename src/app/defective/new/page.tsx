import { prisma } from "@/lib/prisma";
import { requireCapability } from "@/lib/permissions";
import MarkDefectiveForm, { type DefectFormItem } from "@/components/MarkDefectiveForm";
import PageHeader from "@/components/ui/PageHeader";

/** Mark any quantity of any item defective, whenever it is noticed. */
export default async function MarkDefectivePage({
  searchParams,
}: {
  searchParams: Promise<{ item?: string }>;
}) {
  await requireCapability("defect:flag");
  const { item } = await searchParams;

  const items = await prisma.item.findMany({
    orderBy: { name: "asc" },
    include: {
      packStock: { orderBy: { packSize: "asc" } },
      openPacks: { where: { state: "OPEN" }, orderBy: { remaining: "asc" } },
    },
  });

  const forForm: DefectFormItem[] = items.map((i) => ({
    id: i.id,
    name: i.name,
    sku: i.sku,
    baseUnit: i.baseUnit,
    packUnit: i.packUnit,
    measure: i.measure,
    sealed: i.packStock.map((g) => ({ packSize: g.packSize, sealedCount: g.sealedCount })),
    open: i.openPacks.map((p) => ({ id: p.id, remaining: p.remaining })),
  }));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Mark Defective"
        subtitle="Take stock that is already on the shelf out of circulation and hold it for a supplier claim. It stops counting as stock straight away and can never be issued. Undo it from the item's history if it was a mistake."
      />
      <MarkDefectiveForm items={forForm} initialItemId={item} />
    </div>
  );
}
