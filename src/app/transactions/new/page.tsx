import { prisma } from "@/lib/prisma";
import TransactionForm, { type FormItem } from "@/components/TransactionForm";
import PageHeader from "@/components/ui/PageHeader";

export default async function NewTransactionPage() {
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

  // Packs are shipped to the client so the form can run the same pure planner
  // the server runs, and show what a request would cost before anything is
  // written.
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
        title="Issue / Return"
        subtitle="Move material to and from a site. Incoming deliveries are recorded separately."
      />
      <TransactionForm items={itemsForForm} sites={sites} />
    </div>
  );
}
