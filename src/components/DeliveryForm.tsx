"use client";

import { useId, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  recordDelivery,
  type DeliveryLineInput,
  type DeliveryResult,
} from "@/lib/actions/deliveries";
import { formatQuantity } from "@/lib/units";
import type { MeasureType } from "@/generated/prisma/enums";

export type FormItem = {
  id: string;
  name: string;
  sku: string;
  baseUnit: string;
  packUnit: string | null;
  measure: MeasureType;
  scrapThreshold: number | null;
  /** Pack sizes already on record, offered as suggestions. A size new to the
   * item is entered by typing it — this is where "a 400 m and a 600 m roll of
   * the same wire" gets on record with no setup. */
  knownPackSizes: number[];
};

type Site = { id: string; name: string };

type RowState = {
  key: string;
  itemQuery: string;
  itemId: string;
  packSize: string;
  packCount: string;
  loose: string;
  defectiveQty: string;
};

const INPUT =
  "w-full rounded border border-zinc-300 px-3 py-2 text-sm disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900";
const PRIMARY =
  "rounded bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900";
const SECONDARY =
  "rounded border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900";

let keyCounter = 0;
function blankRow(): RowState {
  keyCounter += 1;
  return {
    key: `d-${keyCounter}`,
    itemQuery: "",
    itemId: "",
    packSize: "",
    packCount: "",
    loose: "",
    defectiveQty: "",
  };
}

function toLine(row: RowState): DeliveryLineInput {
  return {
    itemId: row.itemId,
    packSize: row.packSize ? Number(row.packSize) : null,
    packCount: Number(row.packCount) || 0,
    loose: Number(row.loose) || 0,
    defectiveQty: Number(row.defectiveQty) || 0,
  };
}

function rowTotal(row: RowState): number {
  const line = toLine(row);
  return (line.packSize ?? 0) * line.packCount + line.loose;
}

function isBlank(row: RowState): boolean {
  return !row.itemId && !row.itemQuery.trim() && rowTotal(row) === 0;
}

export default function DeliveryForm({
  items,
  sites,
}: {
  items: FormItem[];
  sites: Site[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [reference, setReference] = useState("");
  const [supplier, setSupplier] = useState("");
  const [note, setNote] = useState("");
  const [destination, setDestination] = useState<"STORE" | "SITE">("STORE");
  const [siteId, setSiteId] = useState("");
  // Opens with 3 rows, not 15: deliveries trickle, and a one-line challan is
  // the common case.
  const [rows, setRows] = useState<RowState[]>(() => [blankRow(), blankRow(), blankRow()]);
  const [error, setError] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Map<number, string[]>>(new Map());

  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const activeRows = rows.filter((r) => !isBlank(r));

  function updateRow(key: string, patch: Partial<RowState>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function chooseItem(key: string, value: string) {
    const picked = items.find((i) => `${i.name} (${i.sku})` === value);
    updateRow(key, {
      itemQuery: value,
      itemId: picked?.id ?? "",
      // A pack size from the previous item makes no sense for a new one.
      ...(picked ? { packSize: "", packCount: "" } : {}),
    });
  }

  const blocked =
    activeRows.length === 0 || (destination === "SITE" && !siteId) || pending;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setRowErrors(new Map());

    startTransition(async () => {
      const result: DeliveryResult = await recordDelivery({
        reference,
        supplier,
        note,
        siteId: destination === "SITE" ? siteId : null,
        lines: activeRows.map(toLine),
      });

      if (result.ok) {
        router.push(`/deliveries/${result.deliveryId}`);
        router.refresh();
        return;
      }
      setError(result.message);
      if (result.errors) {
        const byRow = new Map<number, string[]>();
        for (const e of result.errors) {
          byRow.set(e.rowIndex, [...(byRow.get(e.rowIndex) ?? []), e.message]);
        }
        setRowErrors(byRow);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <p
          role="alert"
          className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
        >
          {error}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <Labelled label="Supplier (optional)">
          <input value={supplier} onChange={(e) => setSupplier(e.target.value)} className={INPUT} />
        </Labelled>
        <Labelled label="Challan / invoice no. (optional)">
          <input value={reference} onChange={(e) => setReference(e.target.value)} className={INPUT} />
        </Labelled>
        <Labelled label="Note (optional)">
          <input value={note} onChange={(e) => setNote(e.target.value)} className={INPUT} />
        </Labelled>
      </div>

      <fieldset className="space-y-2 rounded border border-zinc-200 p-3 dark:border-zinc-800">
        <legend className="px-1 text-sm text-zinc-600 dark:text-zinc-400">Destination</legend>
        <div className="flex flex-wrap gap-2">
          {(["STORE", "SITE"] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDestination(d)}
              className={`rounded px-3 py-1.5 text-sm ${
                destination === d
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "border border-zinc-300 dark:border-zinc-700"
              }`}
            >
              {d === "STORE" ? "Into the store" : "Direct to a site"}
            </button>
          ))}
        </div>
        {destination === "SITE" && (
          <>
            <select
              value={siteId}
              onChange={(e) => setSiteId(e.target.value)}
              required
              className={INPUT}
            >
              <option value="">Select a site…</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-zinc-500 dark:text-zinc-500">
              The material never touches the store, so store stock is
              unchanged. It is recorded against the site straight away, and
              the opened leftovers come back later as an ordinary return.
            </p>
          </>
        )}
        <p className="text-xs text-zinc-500 dark:text-zinc-500">
          One destination per challan. A supplier splitting a shipment is two
          deliveries.
        </p>
      </fieldset>

      <datalist id="delivery-items">
        {items.map((i) => (
          <option key={i.id} value={`${i.name} (${i.sku})`} />
        ))}
      </datalist>

      <div className="space-y-3">
        {rows.map((row, index) => (
          <DeliveryRowCard
            key={row.key}
            index={index}
            row={row}
            item={itemById.get(row.itemId)}
            errors={rowErrors.get(activeRows.indexOf(row)) ?? []}
            onChoose={(v) => chooseItem(row.key, v)}
            onUpdate={(patch) => updateRow(row.key, patch)}
            onRemove={() => setRows((prev) => prev.filter((r) => r.key !== row.key))}
          />
        ))}
      </div>

      <button type="button" onClick={() => setRows((p) => [...p, blankRow()])} className={SECONDARY}>
        Add row
      </button>

      <div className="space-y-2 rounded border border-zinc-200 p-3 text-sm dark:border-zinc-800">
        <p className="text-zinc-700 dark:text-zinc-300">
          {activeRows.length} line{activeRows.length === 1 ? "" : "s"}
          {destination === "SITE" && " · direct to site (store stock unchanged)"}
        </p>
        <button type="submit" disabled={blocked} className={PRIMARY}>
          {pending ? "Recording…" : "Record delivery"}
        </button>
      </div>
    </form>
  );
}

function DeliveryRowCard({
  index,
  row,
  item,
  errors,
  onChoose,
  onUpdate,
  onRemove,
}: {
  index: number;
  row: RowState;
  item: FormItem | undefined;
  errors: string[];
  onChoose: (value: string) => void;
  onUpdate: (patch: Partial<RowState>) => void;
  onRemove: () => void;
}) {
  // useId, not row.key: the module-level counter behind row.key advances
  // independently on the server and in the browser, so using it in a DOM
  // attribute produced a hydration mismatch. useId is stable across both.
  const sizesId = useId();
  const packaged = !!item?.packUnit;
  const total = rowTotal(row);
  const defective = Number(row.defectiveQty) || 0;
  const good = Math.max(0, total - defective);

  return (
    <div
      className={`space-y-3 rounded border p-3 ${
        errors.length
          ? "border-red-400 bg-red-50 dark:border-red-700 dark:bg-red-950"
          : "border-zinc-200 dark:border-zinc-800"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs text-zinc-500 dark:text-zinc-500">Line {index + 1}</span>
        <button
          type="button"
          onClick={onRemove}
          className="text-xs text-zinc-500 hover:text-red-600"
          aria-label="Remove line"
        >
          Remove
        </button>
      </div>

      <input
        list="delivery-items"
        value={row.itemQuery}
        onChange={(e) => onChoose(e.target.value)}
        placeholder="Item name…"
        className={INPUT}
      />

      <div className="grid gap-2 sm:grid-cols-2">
        <Labelled label={packaged ? `Pack size (${item!.baseUnit})` : "Pack size — not packaged"}>
          <input
            type="number"
            min={1}
            inputMode="numeric"
            list={sizesId}
            disabled={!packaged}
            value={row.packSize}
            onChange={(e) => onUpdate({ packSize: e.target.value })}
            placeholder={packaged ? `e.g. 400` : "—"}
            className={INPUT}
          />
          {item && (
            <datalist id={sizesId}>
              {item.knownPackSizes.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          )}
        </Labelled>
        <Labelled label={packaged ? `${item!.packUnit}s received` : "Packs — n/a"}>
          <input
            type="number"
            min={1}
            inputMode="numeric"
            disabled={!packaged}
            value={row.packCount}
            onChange={(e) => onUpdate({ packCount: e.target.value })}
            placeholder={packaged ? "how many" : "—"}
            className={INPUT}
          />
        </Labelled>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Labelled
          label={
            packaged
              ? `Loose ${item!.baseUnit} (outside any ${item!.packUnit})`
              : `Quantity (${item?.baseUnit ?? "units"})`
          }
        >
          <input
            type="number"
            min={1}
            inputMode="numeric"
            value={row.loose}
            onChange={(e) => onUpdate({ loose: e.target.value })}
            className={INPUT}
          />
        </Labelled>
        <Labelled label="Of that, defective">
          <input
            type="number"
            min={0}
            inputMode="numeric"
            value={row.defectiveQty}
            onChange={(e) => onUpdate({ defectiveQty: e.target.value })}
            placeholder="usually blank"
            className={INPUT}
          />
        </Labelled>
      </div>

      {item && total > 0 && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {row.packSize && Number(row.packCount) > 0 && (
            <>
              {row.packCount} × {row.packSize} {item.baseUnit}
              {Number(row.loose) > 0 && ` + ${row.loose} ${item.baseUnit} loose`} ={" "}
            </>
          )}
          {defective > 0 ? (
            <>
              <span className="text-emerald-700 dark:text-emerald-400">
                {formatQuantity(item, good)} into stock
              </span>
              {" · "}
              <span className="text-amber-700 dark:text-amber-400">
                {formatQuantity(item, defective)} quarantined
              </span>
            </>
          ) : (
            <>{formatQuantity(item, total)} into stock</>
          )}
        </p>
      )}

      {errors.map((e, i) => (
        <p key={i} role="alert" className="text-sm text-red-700 dark:text-red-300">
          {e}
        </p>
      ))}
    </div>
  );
}

function Labelled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-sm text-zinc-600 dark:text-zinc-400">{label}</label>
      {children}
    </div>
  );
}
