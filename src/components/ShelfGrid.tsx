"use client";

import { useState } from "react";

type BoxType = "FRESH" | "OPENED" | "RECYCLABLE";

const BOX_TYPE_LABEL: Record<BoxType, string> = {
  FRESH: "Fresh",
  OPENED: "Opened",
  RECYCLABLE: "Recyclable",
};

const BOX_TYPE_BADGE: Record<BoxType, string> = {
  FRESH:
    "border-sky-400 bg-sky-50 text-sky-700 dark:border-sky-700 dark:bg-sky-950 dark:text-sky-300",
  OPENED:
    "border-amber-400 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-300",
  RECYCLABLE:
    "border-violet-400 bg-violet-50 text-violet-700 dark:border-violet-700 dark:bg-violet-950 dark:text-violet-300",
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
        {(["FRONT", "BACK"] as const).map((s) => (
          <button
            key={s}
            onClick={() => {
              setSide(s);
              setOpenSlotId(null);
            }}
            className={`rounded px-3 py-1.5 text-sm ${
              side === s
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "border border-zinc-300 dark:border-zinc-700"
            }`}
          >
            {s === "FRONT" ? "Front side" : "Back side"}
          </button>
        ))}
        <div className="ml-auto flex flex-wrap gap-2 text-[10px]">
          {(Object.keys(BOX_TYPE_LABEL) as BoxType[]).map((bt) => (
            <span
              key={bt}
              className={`rounded border px-1.5 py-0.5 ${BOX_TYPE_BADGE[bt]}`}
            >
              {BOX_TYPE_LABEL[bt]}
            </span>
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
                  onClick={() =>
                    isAdmin && setOpenSlotId(isOpen ? null : slot.id)
                  }
                  className={`flex h-24 w-full flex-col items-center justify-center gap-0.5 rounded border p-1 text-center text-xs ${
                    slot.isFrontRow
                      ? "border-emerald-400 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950"
                      : "border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-900"
                  }`}
                >
                  <span className="font-mono text-[10px] text-zinc-500 dark:text-zinc-500">
                    {slot.tagCode}
                  </span>
                  <span
                    className={`rounded border px-1 text-[9px] ${BOX_TYPE_BADGE[slot.boxType]}`}
                  >
                    {BOX_TYPE_LABEL[slot.boxType]}
                  </span>
                  <span className="line-clamp-2 text-zinc-900 dark:text-zinc-50">
                    {slot.item?.name ?? "Empty"}
                  </span>
                  {slot.contents && (
                    <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
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
                  <div className="absolute z-10 mt-1 w-56 space-y-2 rounded border border-zinc-300 bg-white p-3 shadow-lg dark:border-zinc-700 dark:bg-zinc-950">
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                      Set which item lives in this box. How much is in it is not
                      stored — it comes from that item&apos;s packs.
                    </p>
                    <form
                      action={async (formData) => {
                        await slot.assignItemAction(formData);
                        setOpenSlotId(null);
                      }}
                      className="space-y-2"
                    >
                      <label className="block text-[10px] text-zinc-500 dark:text-zinc-400">
                        Item in this box
                      </label>
                      <select
                        name="itemId"
                        defaultValue={slot.item?.id ?? ""}
                        className="w-full rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                      >
                        <option value="">— Empty —</option>
                        {items.map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.name} ({i.sku})
                          </option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        className="w-full rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700"
                      >
                        Save item
                      </button>
                    </form>
                    <form
                      action={async (formData) => {
                        await slot.updateBoxTypeAction(formData);
                        setOpenSlotId(null);
                      }}
                      className="space-y-2"
                    >
                      <label className="block text-[10px] text-zinc-500 dark:text-zinc-400">
                        Box type
                      </label>
                      <select
                        name="boxType"
                        defaultValue={slot.boxType}
                        className="w-full rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                      >
                        {(Object.keys(BOX_TYPE_LABEL) as BoxType[]).map((bt) => (
                          <option key={bt} value={bt}>
                            {BOX_TYPE_LABEL[bt]}
                          </option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        className="w-full rounded bg-zinc-900 px-2 py-1 text-xs font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
                      >
                        Save
                      </button>
                    </form>
                    <button
                      onClick={async () => {
                        await slot.toggleAction();
                      }}
                      className="w-full rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700"
                    >
                      {slot.isFrontRow
                        ? "Unmark front-row"
                        : "Mark as front-row (accessible)"}
                    </button>
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
