import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireCapability } from "@/lib/permissions";
import DispatchBatchForm, { type FormItem } from "@/components/DispatchBatchForm";
import PageHeader from "@/components/ui/PageHeader";
import { buttonClasses } from "@/components/ui/Button";

/* -------------------------------------------------------------------------
 * Stock_In and Stock_Out in one window, for one site: the ordinary Stock_Out
 * form, which records an ordinary Stock_In for exactly what is entered and
 * then the ordinary dispatch. See recordStockInThenDispatch. Reached from a
 * button on the site's own page and deliberately not in the sidebar.
 * ---------------------------------------------------------------------- */

export default async function QuickStockInOutPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Both are needed by the action; checking here just keeps a role that
  // cannot submit from being shown a form that would refuse it.
  await requireCapability("delivery:record");
  await requireCapability("stock:issue");

  const site = await prisma.site.findUnique({ where: { id } });
  if (!site) notFound();

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

  const itemsForForm: FormItem[] = items.map((item) => ({
    id: item.id,
    name: item.name,
    sku: item.sku,
    baseUnit: item.baseUnit,
    packUnit: item.packUnit,
    measure: item.measure,
    scrapThreshold: item.scrapThreshold,
    packs: {
      sealed: item.packStock.map((g) => ({ packSize: g.packSize, sealedCount: g.sealedCount })),
      open: item.openPacks.map((p) => ({ id: p.id, remaining: p.remaining })),
    },
  }));

  return (
    <div className="space-y-4">
      <PageHeader
        title={`Stock_In and Stock_Out to ${site.name}`}
        subtitle="Enter the material as for a Stock_Out. Exactly that quantity is first booked into the store with a Stock_In, then dispatched to the site with a challan, so store stock ends up unchanged."
        actions={
          <>
            <Link href="/items/new" target="_blank" className={buttonClasses("secondary")}>
              Register a new item
            </Link>
            <Link href={`/sites/${site.id}`} className={buttonClasses("secondary")}>
              Back to site
            </Link>
          </>
        }
      />
      <DispatchBatchForm items={itemsForForm} sites={sites} stockInFirst defaultSiteId={site.id} />
    </div>
  );
}
