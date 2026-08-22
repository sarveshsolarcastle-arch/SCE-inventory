"use client";

import { useState } from "react";
import { createShelf } from "@/lib/actions/shelf";
import { Field, Input } from "@/components/ui/Field";
import Button from "@/components/ui/Button";
import PillToggle from "@/components/ui/PillToggle";
import { BOX_TYPE_TONE } from "@/components/ui/tones";
import Badge from "@/components/ui/Badge";

type BoxType = "FRESH" | "OPENED" | "RECYCLABLE";

const BOX_TYPE_CYCLE: BoxType[] = ["FRESH", "OPENED", "RECYCLABLE"];

const CELL_TONE_CLASSES: Record<BoxType, string> = {
  FRESH: "border-ok-line bg-ok-soft",
  OPENED: "border-warn-line bg-warn-soft",
  RECYCLABLE: "border-special-line bg-special-soft",
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
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Rows">
            <Input
              type="number"
              min={1}
              max={20}
              value={rows}
              onChange={(e) => setRows(Number(e.target.value))}
              required
            />
          </Field>
          <Field label="Columns">
            <Input
              type="number"
              min={1}
              max={20}
              value={columns}
              onChange={(e) => setColumns(Number(e.target.value))}
              required
            />
          </Field>
        </div>
        <Button type="submit">Next: set box types</Button>
      </form>
    );
  }

  return (
    <form action={createShelf} className="space-y-4">
      <input type="hidden" name="name" value={name} />
      <input type="hidden" name="rows" value={rows} />
      <input type="hidden" name="columns" value={columns} />
      <input type="hidden" name="boxTypes" value={JSON.stringify(boxTypes)} />

      <p className="text-sm font-semibold text-ink-subtle">
        Click each box to set its type: Fresh → Opened → Recyclable. Defaults to Fresh. Set both
        sides before creating — switch with the buttons below.
      </p>

      <PillToggle
        value={side}
        onChange={(v) => setSide(v)}
        options={[
          { value: "FRONT", label: "Front side" },
          { value: "BACK", label: "Back side" },
        ]}
      />

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
                  className={`flex h-16 w-full flex-col items-center justify-center gap-1 rounded-control border p-1 text-center text-[10px] ${CELL_TONE_CLASSES[boxType]}`}
                >
                  <span className="font-mono text-ink-subtle">
                    {side === "FRONT" ? "F" : "B"}
                    {row}-{column}
                  </span>
                  <Badge tone={BOX_TYPE_TONE[boxType]} className="px-1.5 py-0">
                    {boxType}
                  </Badge>
                </button>
              );
            })
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <Button type="button" onClick={() => setStep("size")} variant="secondary">
          Back
        </Button>
        <Button type="submit">Create Shelf</Button>
      </div>
    </form>
  );
}
