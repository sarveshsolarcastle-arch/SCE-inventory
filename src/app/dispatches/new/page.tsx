import { prisma } from "@/lib/prisma";
import DispatchBatchForm, { type FormItem } from "@/components/DispatchBatchForm";

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
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
        Dispatch to Site
      </h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Paste an item list from Excel, or add rows by hand. Nothing is
        recorded until every row is matched, priced against stock, and any
        pack that needs opening is approved.
      </p>
      <DispatchBatchForm items={itemsForForm} sites={sites} />
    </div>
  );
}
