import { prisma } from "@/lib/prisma";
import DeliveryForm, { type FormItem } from "@/components/DeliveryForm";
import PageHeader from "@/components/ui/PageHeader";

/* Site-only twin of /deliveries/new — see DeliveryForm's `mode` prop. Same
 * items/sites fetch, same form, same recordDelivery action; the only
 * difference is `mode="site"`, which fixes the destination instead of
 * letting it be toggled. */
export default async function NewSiteDeliveryPage() {
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
        title="Record a Site Stock_In"
        subtitle="Goods received on behalf of a site, delivered straight there and never touching the store. A pack size that is new to an item is fine — just type it."
      />
      <DeliveryForm items={itemsForForm} sites={sites} mode="site" />
    </div>
  );
}
