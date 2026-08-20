import { prisma } from "@/lib/prisma";
import { describeMovement, formatQuantity } from "@/lib/units";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function DeliveryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const delivery = await prisma.delivery.findUnique({
    where: { id },
    include: {
      site: true,
      user: true,
      transactions: { orderBy: { createdAt: "asc" }, include: { item: true } },
      defectiveItems: { include: { item: true } },
      replaces: { include: { item: true } },
    },
  });

  if (!delivery) notFound();

  // A direct-to-site delivery writes a STOCK_IN and an ISSUE per line. They
  // are one event, not two, so only the STOCK_IN rows are listed and the
  // destination line above explains where the material went.
  const lines = delivery.transactions.filter((t) => t.type === "STOCK_IN");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          Delivery {delivery.reference || `#${delivery.id.slice(0, 8)}`}
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {delivery.supplier ? `From ${delivery.supplier} · ` : ""}
          received {delivery.receivedAt.toLocaleDateString()} by {delivery.user.name}
          {delivery.note && ` — ${delivery.note}`}
        </p>
        {delivery.site ? (
          <p className="mt-2 rounded border border-sky-300 bg-sky-50 px-3 py-2 text-sm text-sky-900 dark:border-sky-700 dark:bg-sky-950 dark:text-sky-200">
            Delivered direct to{" "}
            <Link href={`/sites/${delivery.site.id}`} className="font-medium hover:underline">
              {delivery.site.name}
            </Link>{" "}
            — this material never entered the store, so store stock is
            unchanged. It is recorded as held at the site.
          </p>
        ) : (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Received into the store.</p>
        )}
      </div>

      <div className="overflow-x-auto rounded border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-100 text-left dark:bg-zinc-900">
            <tr>
              <th className="px-3 py-2">Item</th>
              <th className="px-3 py-2">Received</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((t) => (
              <tr key={t.id} className="border-t border-zinc-200 dark:border-zinc-800">
                <td className="px-3 py-2">
                  <Link href={`/items/${t.item.id}`} className="hover:underline">
                    {t.item.name}
                  </Link>
                </td>
                <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">
                  {describeMovement(t.item, t)}
                </td>
              </tr>
            ))}
            {lines.length === 0 && (
              <tr>
                <td colSpan={2} className="px-3 py-6 text-center text-zinc-500 dark:text-zinc-500">
                  Nothing entered stock on this delivery.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {delivery.defectiveItems.length > 0 && (
        <div className="space-y-2 rounded border border-amber-300 p-3 dark:border-amber-700">
          <h2 className="font-medium text-zinc-900 dark:text-zinc-50">
            Arrived damaged — quarantined, never counted as stock
          </h2>
          <ul className="divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
            {delivery.defectiveItems.map((d) => (
              <li key={d.id} className="flex justify-between py-1.5">
                <Link href={`/items/${d.item.id}`} className="hover:underline">
                  {d.item.name}
                </Link>
                <span className="text-zinc-600 dark:text-zinc-400">
                  {formatQuantity(d.item, d.quantity)} · {d.status}
                </span>
              </li>
            ))}
          </ul>
          <Link href="/defective" className="text-sm underline">
            Chase these on the defective register →
          </Link>
        </div>
      )}

      {delivery.replaces.length > 0 && (
        <div className="space-y-2 rounded border border-emerald-300 p-3 dark:border-emerald-700">
          <h2 className="font-medium text-zinc-900 dark:text-zinc-50">
            Replaced earlier defective goods
          </h2>
          <ul className="divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
            {delivery.replaces.map((d) => (
              <li key={d.id} className="flex justify-between py-1.5">
                <span>{d.item.name}</span>
                <span className="text-zinc-600 dark:text-zinc-400">
                  {formatQuantity(d.item, d.quantity)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
