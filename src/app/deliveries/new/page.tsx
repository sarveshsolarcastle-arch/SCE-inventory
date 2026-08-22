import { prisma } from "@/lib/prisma";
import DeliveryForm, { type FormItem } from "@/components/DeliveryForm";
import PageHeader from "@/components/ui/PageHeader";

export default async function NewDeliveryPage() {
  const [items, sites] = await Promise.all([
    prisma.item.findMany({
      orderBy: { name: "asc" },
      include: { packStock: { orderBy: { packSize: "asc" } } },
    }),
    prisma.site.findMany({ orderBy: { name: "asc" } }),
  ]);

  const itemsForForm: FormItem[] = items.map((item) => ({
    id: item.id,
    name: item.name,
    sku: item.sku,
    baseUnit: item.baseUnit,
    packUnit: item.packUnit,
    measure: item.measure,
    scrapThreshold: item.scrapThreshold,
    knownPackSizes: item.packStock.map((g) => g.packSize),
  }));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Record a Delivery"
        subtitle="Goods received from a supplier. Deliveries only ever add material, so nothing here cuts or opens a pack. A pack size new to an item is fine — just type it."
      />
      <DeliveryForm items={itemsForForm} sites={sites} />
    </div>
  );
}
