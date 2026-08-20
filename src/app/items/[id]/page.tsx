import { prisma } from "@/lib/prisma";
import { updateItem } from "@/lib/actions/items";
import { openPackAction } from "@/lib/actions/transactions";
import { describeMovement, formatQuantity, formatStock } from "@/lib/units";
import { can, currentUser } from "@/lib/permissions";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function ItemDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const item = await prisma.item.findUnique({
    where: { id },
    include: {
      shelfSlots: { include: { shelf: true }, orderBy: { boxType: "asc" } },
      packStock: { orderBy: { packSize: "asc" } },
      openPacks: { orderBy: { remaining: "desc" } },
      transactions: {
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { site: true, user: true },
      },
    },
  });

  if (!item) notFound();

  const updateWithId = updateItem.bind(null, item.id);
  const openRemaining = item.openPacks
    .filter((p) => p.state === "OPEN")
    .map((p) => p.remaining);
  const sealedSizes = item.packStock.filter((g) => g.sealedCount > 0);
  // Cosmetic only — openPackAction enforces this itself, since a server action
  // can be invoked regardless of what the page chose to render.
  const user = await currentUser();
  const canOpenPacks = can(user?.role, "stock:issue");
  const canEdit = can(user?.role, "item:manage");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          {item.name}
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Current stock: {formatQuantity(item, item.currentStock)}
          {item.currentStock < item.minStock && (
            <span className="ml-2 rounded bg-red-100 px-2 py-0.5 text-red-700 dark:bg-red-950 dark:text-red-300">
              Below minimum ({item.minStock})
            </span>
          )}
        </p>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {formatStock(item, item.packStock, openRemaining)}
        </p>
        {item.scrapStock > 0 && (
          <p className="text-sm text-amber-700 dark:text-amber-400">
            Plus {formatQuantity(item, item.scrapStock)} in{" "}
            <Link href="/recycle" className="underline">
              recycle
            </Link>{" "}
            — below the scrap threshold, not counted as stock.
          </p>
        )}

        {sealedSizes.length > 0 && canOpenPacks && (
          <form action={openPackAction} className="mt-2 flex flex-wrap items-center gap-2">
            <input type="hidden" name="itemId" value={item.id} />
            <label className="text-sm text-zinc-600 dark:text-zinc-400">
              Open a sealed {item.packUnit ?? "pack"}:
            </label>
            <select
              name="packSize"
              className="rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              {sealedSizes.map((g) => (
                <option key={g.packSize} value={g.packSize}>
                  {g.packSize} {item.baseUnit} ({g.sealedCount} left)
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              Open one
            </button>
          </form>
        )}
        <div className="text-sm text-zinc-600 dark:text-zinc-400">
          Shelf locations:{" "}
          {item.shelfSlots.length === 0 ? (
            <>
              Unassigned —{" "}
              <Link href="/shelf" className="underline">
                assign on a shelf map
              </Link>
            </>
          ) : (
            <ul className="mt-1 list-inside list-disc">
              {item.shelfSlots.map((slot) => (
                <li key={slot.id}>
                  <span className="rounded border border-zinc-300 px-1.5 py-0.5 text-xs dark:border-zinc-700">
                    {slot.boxType}
                  </span>{" "}
                  <Link href={`/shelf/${slot.shelfId}`} className="underline">
                    {slot.shelf.name} · {slot.side} · row {slot.row}, col{" "}
                    {slot.column} (tag {slot.tagCode})
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className={`space-y-4 rounded border border-zinc-200 p-4 dark:border-zinc-800 ${canEdit ? "" : "hidden"}`}>
          <h2 className="font-medium text-zinc-900 dark:text-zinc-50">
            Edit Item
          </h2>
          <form action={updateWithId} className="space-y-3">
            <Field label="Name" name="name" defaultValue={item.name} required />
            <Field label="SKU" name="sku" defaultValue={item.sku} required />
            <Field
              label="Category"
              name="category"
              defaultValue={item.category ?? ""}
            />
            <Field
              label="Base unit (what stock is counted in — m, pcs)"
              name="baseUnit"
              defaultValue={item.baseUnit}
            />
            <Field
              label="Pack unit (roll, packet — blank if not packaged)"
              name="packUnit"
              defaultValue={item.packUnit ?? ""}
            />
            <div className="space-y-1">
              <label className="text-sm text-zinc-600 dark:text-zinc-400">
                Measure
              </label>
              <select
                name="measure"
                defaultValue={item.measure}
                className="w-full rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              >
                <option value="DISCRETE">
                  Discrete — countable units that pool freely (screws)
                </option>
                <option value="CONTINUOUS">
                  Continuous — a length must come from one pack (wire)
                </option>
              </select>
            </div>
            <Field
              label="Scrap threshold (continuous only — offcuts at or below this stop being stock)"
              name="scrapThreshold"
              type="number"
              defaultValue={item.scrapThreshold === null ? "" : String(item.scrapThreshold)}
            />
            <Field
              label="Minimum stock"
              name="minStock"
              type="number"
              defaultValue={String(item.minStock)}
            />
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
            Transaction History
          </h2>
          <div className="max-h-96 overflow-x-auto overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-zinc-500 dark:text-zinc-500">
                <tr>
                  <th className="py-1">Date</th>
                  <th className="py-1">Type</th>
                  <th className="py-1">Qty</th>
                  <th className="py-1">Site</th>
                  <th className="py-1">By</th>
                </tr>
              </thead>
              <tbody>
                {item.transactions.map((t) => (
                  <tr
                    key={t.id}
                    className="border-t border-zinc-200 dark:border-zinc-800"
                  >
                    <td className="py-1">
                      {t.createdAt.toLocaleDateString()}
                    </td>
                    <td className="py-1">{t.type}</td>
                    <td className="py-1">
                      {describeMovement(item, t)}
                      {t.defectiveQty ? (
                        <span className="ml-1 text-amber-700 dark:text-amber-400">
                          ({t.defectiveQty} defective)
                        </span>
                      ) : null}
                    </td>
                    <td className="py-1">{t.site?.name ?? "—"}</td>
                    <td className="py-1">{t.user.name}</td>
                  </tr>
                ))}
                {item.transactions.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-4 text-center text-zinc-500 dark:text-zinc-500"
                    >
                      No transactions yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="text-sm text-zinc-600 dark:text-zinc-400">{label}</label>
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        className="w-full rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      />
    </div>
  );
}
