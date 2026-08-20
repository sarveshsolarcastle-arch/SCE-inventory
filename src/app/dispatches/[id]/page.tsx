import { prisma } from "@/lib/prisma";
import { can, currentUser } from "@/lib/permissions";
import { reverseDispatch } from "@/lib/actions/corrections";
import { ReverseButton } from "@/components/CorrectionPanel";
import { describeMovement } from "@/lib/units";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function DispatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const dispatch = await prisma.dispatch.findUnique({
    where: { id },
    include: {
      site: true,
      user: true,
      transactions: {
        orderBy: { createdAt: "asc" },
        include: { item: true },
      },
    },
  });

  if (!dispatch) notFound();

  const user = await currentUser();
  const canReverse = can(user?.role, "stock:reverse");

  const issueLines = dispatch.transactions.filter((t) => t.type === "ISSUE");
  const reversalLines = dispatch.transactions.filter((t) => t.type === "REVERSAL");
  const activeLines = issueLines.filter((t) => !t.reversedAt);
  const fullyReversed = issueLines.length > 0 && activeLines.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            Dispatch {dispatch.reference || `#${dispatch.id.slice(0, 8)}`}
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            To{" "}
            <Link href={`/sites/${dispatch.site.id}`} className="hover:underline">
              {dispatch.site.name}
            </Link>{" "}
            on {dispatch.dispatchedAt.toLocaleDateString()} by {dispatch.user.name}
            {dispatch.note && ` — ${dispatch.note}`}
          </p>
        </div>
        {fullyReversed ? (
          <span className="rounded bg-zinc-200 px-2 py-1 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
            Reversed
          </span>
        ) : (
          canReverse &&
          activeLines.length > 0 && (
            <ReverseButton action={reverseDispatch.bind(null, dispatch.id)} label="this whole dispatch" />
          )
        )}
      </div>

      <div className="overflow-x-auto rounded border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-100 text-left dark:bg-zinc-900">
            <tr>
              <th className="px-3 py-2">Item</th>
              <th className="px-3 py-2">Quantity</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {issueLines.map((t) => (
              <tr key={t.id} className="border-t border-zinc-200 dark:border-zinc-800">
                <td className="px-3 py-2">
                  <Link href={`/items/${t.item.id}`} className="hover:underline">
                    {t.item.name}
                  </Link>
                </td>
                <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">
                  {describeMovement(t.item, t)}
                </td>
                <td className="px-3 py-2">
                  {t.reversedAt ? (
                    <span className="text-xs text-zinc-500">Reversed</span>
                  ) : (
                    <span className="text-xs text-emerald-700 dark:text-emerald-400">Active</span>
                  )}
                </td>
              </tr>
            ))}
            {issueLines.length === 0 && (
              <tr>
                <td colSpan={3} className="px-3 py-6 text-center text-zinc-500 dark:text-zinc-500">
                  No lines on this dispatch.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {reversalLines.length > 0 && (
        <div className="space-y-2 rounded border border-zinc-200 p-3 dark:border-zinc-800">
          <h2 className="font-medium text-zinc-900 dark:text-zinc-50">Reversal</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {reversalLines.length} line{reversalLines.length === 1 ? "" : "s"} of this dispatch
            {fullyReversed ? "" : " have been"} reversed
            {reversalLines[0]?.reason && `, reason: "${reversalLines[0].reason}"`}.
          </p>
        </div>
      )}
    </div>
  );
}
