"use client";

import { useState } from "react";
import { createShelf } from "@/lib/actions/shelf";

type BoxType = "FRESH" | "OPENED" | "RECYCLABLE";

const BOX_TYPE_CYCLE: BoxType[] = ["FRESH", "OPENED", "RECYCLABLE"];

const BOX_TYPE_BADGE: Record<BoxType, string> = {
  FRESH:
    "border-sky-400 bg-sky-50 text-sky-700 dark:border-sky-700 dark:bg-sky-950 dark:text-sky-300",
  OPENED:
    "border-amber-400 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-300",
  RECYCLABLE:
    "border-violet-400 bg-violet-50 text-violet-700 dark:border-violet-700 dark:bg-violet-950 dark:text-violet-300",
};

export default function NewShelfForm() {
  const [step, setStep] = useState<"size" | "layout">("size");
  const [name, setName] = useState("");
  const [rows, setRows] = useState(4);
  const [columns, setColumns] = useState(5);
  const [side, setSide] = useState<"FRONT" | "BACK">("FRONT");
  const [boxTypes, setBoxTypes] = useState<Record<string, BoxType>>({});

  function cycleCell(key: string) {
    setBoxTypes((prev) => {
      const current = prev[key] ?? "FRESH";
      const next = BOX_TYPE_CYCLE[(BOX_TYPE_CYCLE.indexOf(current) + 1) % BOX_TYPE_CYCLE.length];
      return { ...prev, [key]: next };
    });
  }

  if (step === "size") {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setStep("layout");
        }}
        className="space-y-4"
      >
        <div className="space-y-1">
          <label className="text-sm text-zinc-600 dark:text-zinc-400">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm text-zinc-600 dark:text-zinc-400">Rows</label>
            <input
              type="number"
              min={1}
              max={20}
              value={rows}
              onChange={(e) => setRows(Number(e.target.value))}
              required
              className="w-full rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-zinc-600 dark:text-zinc-400">Columns</label>
            <input
              type="number"
              min={1}
              max={20}
              value={columns}
              onChange={(e) => setColumns(Number(e.target.value))}
              required
              className="w-full rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>
        </div>
        <button
          type="submit"
          className="rounded bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900"
        >
          Next: set box types
        </button>
      </form>
    );
  }

  return (
    <form action={createShelf} className="space-y-4">
      <input type="hidden" name="name" value={name} />
      <input type="hidden" name="rows" value={rows} />
      <input type="hidden" name="columns" value={columns} />
      <input type="hidden" name="boxTypes" value={JSON.stringify(boxTypes)} />

      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Click each box to set its type: Fresh → Opened → Recyclable. Defaults to
        Fresh. Set both sides before creating — switch with the buttons below.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {(["FRONT", "BACK"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSide(s)}
            className={`rounded px-3 py-1.5 text-sm ${
              side === s
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "border border-zinc-300 dark:border-zinc-700"
            }`}
          >
            {s === "FRONT" ? "Front side" : "Back side"}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto pb-2">
        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(90px, 1fr))` }}
        >
          {Array.from({ length: rows }).flatMap((_, rowIdx) =>
            Array.from({ length: columns }).map((_, colIdx) => {
              const row = rowIdx + 1;
              const column = colIdx + 1;
              const key = `${side}-${row}-${column}`;
              const boxType = boxTypes[key] ?? "FRESH";
              return (
                <button
                  type="button"
                  key={key}
                  onClick={() => cycleCell(key)}
                  className={`flex h-16 w-full flex-col items-center justify-center gap-1 rounded border p-1 text-center text-[10px] ${BOX_TYPE_BADGE[boxType]}`}
                >
                  <span className="font-mono text-zinc-500 dark:text-zinc-400">
                    {side === "FRONT" ? "F" : "B"}
                    {row}-{column}
                  </span>
                  <span className="font-medium">{boxType}</span>
                </button>
              );
            })
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setStep("size")}
          className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700"
        >
          Back
        </button>
        <button
          type="submit"
          className="rounded bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900"
        >
          Create Shelf
        </button>
      </div>
    </form>
  );
}
