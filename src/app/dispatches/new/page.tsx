import { prisma } from "@/lib/prisma";
import DispatchBatchForm, { type FormItem } from "@/components/DispatchBatchForm";
import PageHeader from "@/components/ui/PageHeader";

export default async function NewDispatchPage() {
  const [items, sites] = await Promise.all([
    prisma.item.findMany({
      orderBy: { name: "asc" },
      include: {
        packStock: { orderBy: { packSize: "asc" } },
        openPacks: { where: { state: "OPEN" }, orderBy: { remaining: "asc" } },
      },
    }),
    prisma.site.findMany({ orderBy: { name: "asc" } }),
  ]);

  // Shipped to the client so the review screen can plan the whole batch
  // itself, with the server re-planning authoritatively at commit.
  const itemsForForm: FormItem[] = items.map((item) => ({
    id: item.id,
    name: item.name,
    sku: item.sku,
    baseUnit: item.baseUnit,
    packUnit: item.packUnit,
    measure: item.measure,
    scrapThreshold: item.scrapThreshold,
    packs: {
      sealed: item.packStock.map((g) => ({
        packSize: g.packSize,
        sealedCount: g.sealedCount,
      })),
      open: item.openPacks.map((p) => ({ id: p.id, remaining: p.remaining })),
    },
  }));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Stock_Out"
        subtitle="Material leaving the store for a site, recorded as one challan. Add rows by hand. Nothing is written until every row is matched to an item, covered by available stock, and any sealed pack that must be opened is approved."
      />
      <DispatchBatchForm items={itemsForForm} sites={sites} />
    </div>
  );
}
