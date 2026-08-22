"use client";

import { useState } from "react";
import PillToggle from "@/components/ui/PillToggle";
import Badge from "@/components/ui/Badge";
import { Select } from "@/components/ui/Field";
import Button from "@/components/ui/Button";
import { BOX_TYPE_TONE } from "@/components/ui/tones";

type BoxType = "FRESH" | "OPENED" | "RECYCLABLE";

const BOX_TYPE_LABEL: Record<BoxType, string> = {
  FRESH: "Fresh",
  OPENED: "Opened",
  RECYCLABLE: "Recyclable",
};

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
  isAdmin,
}: {
  rows: number;
  columns: number;
  slots: SlotData[];
  items: { id: string; name: string; sku: string }[];
  isAdmin: boolean;
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
                    onClick={() => isAdmin && setOpenSlotId(isOpen ? null : slot.id)}
                    className={`flex h-24 w-full flex-col items-center justify-center gap-0.5 rounded-control border p-1 text-center text-xs ${
                      slot.isFrontRow
                        ? "border-ok-line bg-ok-soft"
                        : "border-line-strong bg-surface"
                    }`}
                  >
                    <span className="font-mono text-[10px] text-ink-subtle">{slot.tagCode}</span>
                    <Badge tone={BOX_TYPE_TONE[slot.boxType]} className="px-1.5 py-0 text-[9px]">
                      {BOX_TYPE_LABEL[slot.boxType]}
                    </Badge>
                    <span className="line-clamp-2 font-semibold text-ink">
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
