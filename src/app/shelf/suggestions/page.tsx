import Link from "next/link";
import { getPlacementSuggestions } from "@/lib/suggestions";
import PageHeader from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Badge from "@/components/ui/Badge";

export default async function SuggestionsPage() {
  const suggestions = await getPlacementSuggestions();

  return (
    <div className="space-y-4">
      <PageHeader
        title="Placement Suggestions"
        subtitle="Based on how often each item was issued in the last 30 days. Items used frequently but sitting outside a front-row (easily accessible) slot are suggested for a swap with a less-used item currently in front."
      />

      <Card>
        {suggestions.map((s, i) => (
          <div
            key={s.item.id}
            className={`flex flex-wrap items-center justify-between gap-3 p-4 ${
              i > 0 ? "border-t border-line" : ""
            }`}
          >
            <div>
              <Link href={`/items/${s.item.id}`} className="font-bold text-ink hover:text-accent">
                {s.item.name}
              </Link>
              <p className="text-sm font-semibold text-ink-subtle">
                {s.currentSlot
                  ? `currently at ${s.currentSlot.shelfName} ${s.currentSlot.tagCode}`
                  : "not currently on any shelf"}
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Badge tone="info">{s.frequency}× / 30d</Badge>
              <span className="text-ink">
                Move to <span className="font-bold">{s.targetSlot.shelfName} {s.targetSlot.tagCode}</span>
                {s.targetSlot.occupant && (
                  <span className="text-ink-subtle">
                    {" "}
                    (swap with {s.targetSlot.occupant.name}, {s.targetSlot.occupant.frequency}×/30d)
                  </span>
                )}
              </span>
            </div>
          </div>
        ))}
        {suggestions.length === 0 && (
          <EmptyState>
            No relocation suggestions right now — record some issue transactions and assign items
            to shelf slots first.
          </EmptyState>
        )}
      </Card>
    </div>
  );
}
