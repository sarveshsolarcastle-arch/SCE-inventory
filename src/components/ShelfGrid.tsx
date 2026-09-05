"use client";

import { useState } from "react";
import PillToggle from "@/components/ui/PillToggle";
import Badge from "@/components/ui/Badge";
import { Select } from "@/components/ui/Field";
import Button from "@/components/ui/Button";
import { BOX_TYPE_TONE } from "@/components/ui/tones";
import { Star } from "lucide-react";

type BoxType = "FRESH" | "OPENED" | "RECYCLABLE";

const BOX_TYPE_LABEL: Record<BoxType, string> = {
  FRESH: "Fresh",
  OPENED: "Opened",
  RECYCLABLE: "Recyclable",
};

/* The cell background carries BOX TYPE, and front-row is a ring plus a star.
 * They used to share one channel — background meant front-row while the badge
 * meant box type — so an amber "Opened" badge sat on a green background and
 * neither signal could be read at a glance. Written out in full because
 * Tailwind cannot see a class name built by string interpolation. */
const CELL_OCCUPIED: Record<BoxType, string> = {
  FRESH: "border-ok-line bg-ok-soft",
  OPENED: "border-warn-line bg-warn-soft",
  RECYCLABLE: "border-special-line bg-special-soft",
};

/** An empty box still has a condition, but it should recede so the boxes
 * holding something are what the eye lands on. */
const CELL_EMPTY = "border-line bg-surface-sunken";

type SlotData = {
  id: string;
  side: "FRONT" | "BACK";
  row: number;
  column: number;
  tagCode: string;
  isFrontRow: boolean;
  boxType: BoxType;
  /** Derived from the item's packs — a slot stores no quantity of its own. */
  contents: { total: number; text: string; splitAcrossBoxes: boolean } | null;
  item: { id: string; name: string } | null;
  updateBoxTypeAction: (formData: FormData) => Promise<void>;
  assignItemAction: (formData: FormData) => Promise<void>;
  toggleAction: () => Promise<void>;
};

export default function ShelfGrid({
  rows,
  columns,
  slots,
  items,
  canManage,
}: {
  rows: number;
  columns: number;
  slots: SlotData[];
  items: { id: string; name: string; sku: string }[];
  /** Whether the viewer holds `shelf:manage`, which is what the three actions in
   * the popover actually require. This was `isAdmin` — a role test rather than a
   * capability test — which happened to give the right answer only because ADMIN
   * was the sole holder. Granting `shelf:manage` to anyone else would have left
   * the controls hidden with nothing to explain why. Cosmetic either way: each
   * action re-checks server-side. */
  canManage: boolean;
}) {
  const [side, setSide] = useState<"FRONT" | "BACK">("FRONT");
  const [openSlotId, setOpenSlotId] = useState<string | null>(null);

  const grid = new Map<string, SlotData>();
  for (const s of slots) {
    if (s.side === side) grid.set(`${s.row}-${s.column}`, s);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <PillToggle
          value={side}
          onChange={(v) => {
            setSide(v);
            setOpenSlotId(null);
          }}
          options={[
            { value: "FRONT", label: "Front side" },
            { value: "BACK", label: "Back side" },
          ]}
        />
        <div className="ml-auto flex flex-wrap gap-1.5">
          {(Object.keys(BOX_TYPE_LABEL) as BoxType[]).map((bt) => (
            <Badge key={bt} tone={BOX_TYPE_TONE[bt]}>
              {BOX_TYPE_LABEL[bt]}
            </Badge>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto pb-2">
        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(96px, 1fr))` }}
        >
          {Array.from({ length: rows }).flatMap((_, rowIdx) =>
            Array.from({ length: columns }).map((_, colIdx) => {
              const row = rowIdx + 1;
              const column = colIdx + 1;
              const slot = grid.get(`${row}-${column}`);
              if (!slot) return <div key={`${row}-${column}`} />;

              const isOpen = openSlotId === slot.id;

              return (
                <div key={slot.id} className="relative">
                  <button
                    onClick={() => canManage && setOpenSlotId(isOpen ? null : slot.id)}
                    className={`relative flex h-24 w-full flex-col items-center justify-center gap-0.5 rounded-control border p-1 text-center text-xs transition-shadow hover:shadow-card ${
                      slot.item ? CELL_OCCUPIED[slot.boxType] : CELL_EMPTY
                    } ${slot.isFrontRow ? "ring-2 ring-accent" : ""}`}
                  >
                    <span className="absolute top-1 left-1.5 font-mono text-[10px] text-ink-subtle">
                      {slot.tagCode}
                    </span>
                    {slot.isFrontRow && (
                      <Star
                        className="absolute top-1 right-1.5 h-3 w-3 fill-accent text-accent"
                        aria-label="Front-row position"
                      />
                    )}
                    <Badge
                      tone={BOX_TYPE_TONE[slot.boxType]}
                      variant={slot.item ? "outline" : "soft"}
                      className="mt-2 px-1.5 py-0 text-[9px]"
                    >
                      {BOX_TYPE_LABEL[slot.boxType]}
                    </Badge>
                    <span
                      className={`line-clamp-2 font-semibold ${
                        slot.item ? "text-ink" : "text-ink-subtle"
                      }`}
                    >
                      {slot.item?.name ?? "Empty"}
                    </span>
                    {slot.contents && (
                      <span className="text-[10px] text-ink-subtle">
                        {slot.contents.text}
                        {slot.contents.splitAcrossBoxes && (
                          <span title="This item occupies more than one Fresh box; the sealed total is shown on each">
                            {" "}
                            · split
                          </span>
                        )}
                      </span>
                    )}
                  </button>

                  {isOpen && (
                    <div className="absolute z-10 mt-1 w-56 space-y-2 rounded-card border border-line bg-surface p-3 shadow-raised">
                      <p className="text-[10px] font-semibold text-ink-subtle">
                        Set which item lives in this box. How much is in it is not stored — it
                        comes from that item&apos;s packs.
                      </p>
                      <form
                        action={async (formData) => {
                          await slot.assignItemAction(formData);
                          setOpenSlotId(null);
                        }}
                        className="space-y-2"
                      >
                        <label className="block text-[10px] font-semibold text-ink-subtle">
                          Item in this box
                        </label>
                        <Select name="itemId" defaultValue={slot.item?.id ?? ""} className="text-xs">
                          <option value="">— Empty —</option>
                          {items.map((i) => (
                            <option key={i.id} value={i.id}>
                              {i.name} ({i.sku})
                            </option>
                          ))}
                        </Select>
                        <Button type="submit" variant="secondary" size="sm" className="w-full">
                          Save item
                        </Button>
                      </form>
                      <form
                        action={async (formData) => {
                          await slot.updateBoxTypeAction(formData);
                          setOpenSlotId(null);
                        }}
                        className="space-y-2"
                      >
                        <label className="block text-[10px] font-semibold text-ink-subtle">
                          Box type
                        </label>
                        <Select name="boxType" defaultValue={slot.boxType} className="text-xs">
                          {(Object.keys(BOX_TYPE_LABEL) as BoxType[]).map((bt) => (
                            <option key={bt} value={bt}>
                              {BOX_TYPE_LABEL[bt]}
                            </option>
                          ))}
                        </Select>
                        <Button type="submit" size="sm" className="w-full">
                          Save
                        </Button>
                      </form>
                      <Button
                        onClick={async () => {
                          await slot.toggleAction();
                        }}
                        variant="secondary"
                        size="sm"
                        className="w-full"
                      >
                        {slot.isFrontRow ? "Unmark front-row" : "Mark as front-row (accessible)"}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
