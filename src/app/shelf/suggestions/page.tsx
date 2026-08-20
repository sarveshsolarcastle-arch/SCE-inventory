import Link from "next/link";
import { getPlacementSuggestions } from "@/lib/suggestions";

export default async function SuggestionsPage() {
  const suggestions = await getPlacementSuggestions();

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
        Placement Suggestions
      </h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Based on how often each item was issued in the last 30 days. Items
        used frequently but sitting outside a front-row (easily accessible)
        slot are suggested for a swap with a less-used item currently in
        front.
      </p>

      <div className="divide-y divide-zinc-200 rounded border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        {suggestions.map((s) => (
          <div key={s.item.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <Link href={`/items/${s.item.id}`} className="font-medium hover:underline">
                {s.item.name}
              </Link>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Used {s.frequency}x in the last 30 days ·{" "}
                {s.currentSlot
                  ? `currently at ${s.currentSlot.shelfName} ${s.currentSlot.tagCode}`
                  : "not currently on any shelf"}
              </p>
            </div>
            <div className="text-sm">
              Move to{" "}
              <span className="font-medium">
                {s.targetSlot.shelfName} {s.targetSlot.tagCode}
              </span>
              {s.targetSlot.occupant && (
                <>
                  {" "}
                  (swap with {s.targetSlot.occupant.name}, used{" "}
                  {s.targetSlot.occupant.frequency}x/30d)
                </>
              )}
            </div>
          </div>
        ))}
        {suggestions.length === 0 && (
          <p className="p-6 text-center text-sm text-zinc-500 dark:text-zinc-500">
            No relocation suggestions right now — record some issue
            transactions and assign items to shelf slots first.
          </p>
        )}
      </div>
    </div>
  );
}
