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
import { Field, Input, Select } from "@/components/ui/Field";
import Button from "@/components/ui/Button";
import Alert from "@/components/ui/Alert";
import PillToggle from "@/components/ui/PillToggle";

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
      {error && <Alert tone="danger">{error}</Alert>}

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Supplier (optional)">
          <Input value={supplier} onChange={(e) => setSupplier(e.target.value)} />
        </Field>
        <Field label="Challan / invoice no. (optional)">
          <Input value={reference} onChange={(e) => setReference(e.target.value)} />
        </Field>
        <Field label="Note (optional)">
          <Input value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>

      <fieldset className="space-y-2 rounded-card border border-line p-3.5">
        <legend className="px-1 text-sm font-semibold text-ink-muted">Destination</legend>
        <PillToggle
          value={destination}
          onChange={(v) => setDestination(v)}
          options={[
            { value: "STORE", label: "Into the store" },
            { value: "SITE", label: "Direct to a site" },
          ]}
        />
        {destination === "SITE" && (
          <>
            <Select value={siteId} onChange={(e) => setSiteId(e.target.value)} required>
              <option value="">Select a site…</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
            <p className="text-xs font-semibold text-ink-subtle">
              The material never touches the store, so store stock is unchanged. It is recorded
              against the site straight away, and the opened leftovers come back later as an
              ordinary return.
            </p>
          </>
        )}
        <p className="text-xs font-semibold text-ink-subtle">
          One destination per challan. A supplier splitting a shipment is two deliveries.
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

      <Button type="button" onClick={() => setRows((p) => [...p, blankRow()])} variant="secondary">
        Add row
      </Button>

      <div className="space-y-2 rounded-card border border-line p-3.5 text-sm">
        <p className="font-semibold text-ink">
          {activeRows.length} line{activeRows.length === 1 ? "" : "s"}
          {destination === "SITE" && " · direct to site (store stock unchanged)"}
        </p>
        <Button type="submit" disabled={blocked}>
          {pending ? "Recording…" : "Record delivery"}
        </Button>
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
      className={`space-y-3 rounded-card border p-3.5 ${
        errors.length ? "border-danger-line bg-danger-soft" : "border-line bg-surface"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-semibold text-ink-subtle">Line {index + 1}</span>
        <button
          type="button"
          onClick={onRemove}
          className="text-xs font-semibold text-ink-subtle hover:text-danger-ink"
          aria-label="Remove line"
        >
          Remove
        </button>
      </div>

      <Input
        list="delivery-items"
        value={row.itemQuery}
        onChange={(e) => onChoose(e.target.value)}
        placeholder="Item name…"
      />

      <div className="grid gap-2 sm:grid-cols-2">
        <Field label={packaged ? `Pack size (${item!.baseUnit})` : "Pack size — not packaged"}>
          <Input
            type="number"
            min={1}
            inputMode="numeric"
            list={sizesId}
            disabled={!packaged}
            value={row.packSize}
            onChange={(e) => onUpdate({ packSize: e.target.value })}
            placeholder={packaged ? `e.g. 400` : "—"}
          />
          {item && (
            <datalist id={sizesId}>
              {item.knownPackSizes.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          )}
        </Field>
        <Field label={packaged ? `${item!.packUnit}s received` : "Packs — n/a"}>
          <Input
            type="number"
            min={1}
            inputMode="numeric"
            disabled={!packaged}
            value={row.packCount}
            onChange={(e) => onUpdate({ packCount: e.target.value })}
            placeholder={packaged ? "how many" : "—"}
          />
        </Field>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Field
          label={
            packaged
              ? `Loose ${item!.baseUnit} (outside any ${item!.packUnit})`
              : `Quantity (${item?.baseUnit ?? "units"})`
          }
        >
          <Input
            type="number"
            min={1}
            inputMode="numeric"
            value={row.loose}
            onChange={(e) => onUpdate({ loose: e.target.value })}
          />
        </Field>
        <Field label="Of that, defective">
          <Input
            type="number"
            min={0}
            inputMode="numeric"
            value={row.defectiveQty}
            onChange={(e) => onUpdate({ defectiveQty: e.target.value })}
            placeholder="usually blank"
          />
        </Field>
      </div>

      {item && total > 0 && (
        <p className="text-sm font-semibold text-ink-subtle">
          {row.packSize && Number(row.packCount) > 0 && (
            <>
              {row.packCount} × {row.packSize} {item.baseUnit}
              {Number(row.loose) > 0 && ` + ${row.loose} ${item.baseUnit} loose`} ={" "}
            </>
          )}
          {defective > 0 ? (
            <>
              <span className="text-ok-ink">{formatQuantity(item, good)} into stock</span>
              {" · "}
              <span className="text-warn-ink">{formatQuantity(item, defective)} quarantined</span>
            </>
          ) : (
            <>{formatQuantity(item, total)} into stock</>
          )}
        </p>
      )}

      {errors.map((e, i) => (
        <Alert key={i} tone="danger" className="text-sm">
          {e}
        </Alert>
      ))}
    </div>
  );
}
