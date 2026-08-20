import { prisma } from "@/lib/prisma";
import { updateSite } from "@/lib/actions/sites";
import { materialsAtSite } from "@/lib/stock";
import { notFound } from "next/navigation";
import Link from "next/link";

export default async function SiteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const site = await prisma.site.findUnique({
    where: { id },
    include: {
      transactions: {
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { item: true, user: true },
      },
    },
  });

  if (!site) notFound();

  const materials = await materialsAtSite(id);
  const updateWithId = updateSite.bind(null, site.id);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
        {site.name}
      </h1>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4 rounded border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="font-medium text-zinc-900 dark:text-zinc-50">
            Edit Site
          </h2>
          <form action={updateWithId} className="space-y-3">
            <Field label="Name" name="name" defaultValue={site.name} required />
            <Field
              label="Location"
              name="location"
              defaultValue={site.location ?? ""}
            />
            <Field label="Notes" name="notes" defaultValue={site.notes ?? ""} />
            <button
              type="submit"
              className="rounded bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900"
            >
              Save
            </button>
          </form>
        </div>

        <div className="space-y-2 rounded border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="font-medium text-zinc-900 dark:text-zinc-50">
            Materials Currently at This Site
          </h2>
          <ul className="divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
            {materials.map(({ item, quantity }) => (
              <li key={item.id} className="flex justify-between py-1.5">
                <Link href={`/items/${item.id}`} className="hover:underline">
                  {item.name}
                </Link>
                <span>
                  {quantity} {item.baseUnit}
                </span>
              </li>
            ))}
            {materials.length === 0 && (
              <li className="py-4 text-center text-zinc-500 dark:text-zinc-500">
                Nothing currently issued here.
              </li>
            )}
          </ul>
        </div>
      </div>

      <div className="space-y-2 rounded border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="font-medium text-zinc-900 dark:text-zinc-50">
          Recent Activity
        </h2>
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-zinc-500 dark:text-zinc-500">
            <tr>
              <th className="py-1">Date</th>
              <th className="py-1">Type</th>
              <th className="py-1">Item</th>
              <th className="py-1">Qty</th>
              <th className="py-1">By</th>
            </tr>
          </thead>
          <tbody>
            {site.transactions.map((t) => (
              <tr
                key={t.id}
                className="border-t border-zinc-200 dark:border-zinc-800"
              >
                <td className="py-1">{t.createdAt.toLocaleDateString()}</td>
                <td className="py-1">{t.type}</td>
                <td className="py-1">{t.item.name}</td>
                <td className="py-1">{t.quantity}</td>
                <td className="py-1">{t.user.name}</td>
              </tr>
            ))}
            {site.transactions.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="py-4 text-center text-zinc-500 dark:text-zinc-500"
                >
                  No activity yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  required,
  defaultValue,
}: {
  label: string;
  name: string;
  required?: boolean;
  defaultValue?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="text-sm text-zinc-600 dark:text-zinc-400">{label}</label>
      <input
        name={name}
        required={required}
        defaultValue={defaultValue}
        className="w-full rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      />
    </div>
  );
}
