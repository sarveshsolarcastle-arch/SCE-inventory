import { prisma } from "@/lib/prisma";
import { requireCapability } from "@/lib/permissions";
import SiteChallanForm from "@/components/SiteChallanForm";
import PageHeader from "@/components/ui/PageHeader";

/* A paper-only challan maker for material that is managed outside the app —
 * see recordSiteChallan. The item list is fetched for one reason: so the form
 * can warn when a typed line looks like a registered item. `?site=` lets a
 * site's own page open this with the site already chosen. */
export default async function NewSiteDeliveryPage({
  searchParams,
}: {
  searchParams: Promise<{ site?: string }>;
}) {
  // Checked here so a role that cannot submit is not shown a form that would
  // refuse it — the action enforces the same capability.
  await requireCapability("delivery:record");

  const { site } = await searchParams;
  const [items, sites] = await Promise.all([
    prisma.item.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, sku: true } }),
    prisma.site.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <div className="max-w-5xl space-y-4">
      <PageHeader
        title="Record a Site Delivery"
        subtitle="Makes a printable delivery challan for material handled outside the app. Type whatever it says — it is not added to the item list, and stock and site materials do not change."
      />
      <SiteChallanForm items={items} sites={sites} defaultSiteId={site} />
    </div>
  );
}
