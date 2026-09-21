"use client";

import { useId, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  recordDelivery,
  type DeliveryLineInput,
  type DeliveryResult,
} from "@/lib/actions/deliveries";
import { parseDeliveryPaste, orientPack } from "@/lib/deliveryPaste";
import { matchItem, type MatchCandidate } from "@/lib/matching";
import { formatQuantity } from "@/lib/units";
import type { MeasureType } from "@/generated/prisma/enums";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import Button from "@/components/ui/Button";
import Alert from "@/components/ui/Alert";
import Badge from "@/components/ui/Badge";
import PillToggle from "@/components/ui/PillToggle";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import { MATCH_STATUS_TONE } from "@/components/ui/tones";
import { ClipboardPaste, FileText, MapPin, PackagePlus, Plus } from "lucide-react";

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
  /** The pasted line this row came from, echoed on the row so a bad match is
   * checkable against what the sheet actually said. Empty when typed by hand. */
  sourceText: string;
  itemQuery: string;
  /** Set only once the user has confirmed an item — by picking it from the
   * list, or accepting a suggestion. A fuzzy guess never ships on its own. */
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
    sourceText: "",
    itemQuery: "",
    itemId: "",
    packSize: "",
    packCount: "",
    loose: "",
    defectiveQty: "",
  };
}

function toLine(row: RowState, itemId: string): DeliveryLineInput {
  return {
    itemId,
    packSize: row.packSize ? Number(row.packSize) : null,
    packCount: Number(row.packCount) || 0,
    loose: Number(row.loose) || 0,
    defectiveQty: Number(row.defectiveQty) || 0,
  };
}

function rowTotal(row: RowState): number {
  const line = toLine(row, "");
  return (line.packSize ?? 0) * line.packCount + line.loose;
}

function isBlank(row: RowState): boolean {
  return !row.itemId && !row.itemQuery.trim() && rowTotal(row) === 0;
}

type Resolution =
  | { status: "exact"; itemId: string; candidates: [] }
  | { status: "suggested"; itemId: string; candidates: [] }
  | { status: "ambiguous"; itemId: ""; candidates: MatchCandidate[] }
  | { status: "unmatched"; itemId: ""; candidates: [] };

function resolveRow(row: RowState, items: FormItem[]): Resolution {
  if (row.itemId) return { status: "exact", itemId: row.itemId, candidates: [] };
  const m = matchItem(row.itemQuery, items);
  if (m.status === "exact") return { status: "exact", itemId: m.itemId, candidates: [] };
  if (m.status === "suggested") return { status: "suggested", itemId: m.itemId, candidates: [] };
  if (m.status === "ambiguous") return { status: "ambiguous", itemId: "", candidates: m.candidates };
  return { status: "unmatched", itemId: "", candidates: [] };
}

/** An item with no pack unit has no pack fields to fill — its inputs are
 * disabled, so anything sitting in them would be invisible on screen and
 * still reach the server. Folded into loose instead, where it can be seen. */
function fitPackToItem(row: RowState, item: FormItem): Partial<RowState> {
  if (item.packUnit) return {};
  const packed = (Number(row.packSize) || 0) * (Number(row.packCount) || 0);
  if (packed <= 0) return { packSize: "", packCount: "" };
  return { packSize: "", packCount: "", loose: String((Number(row.loose) || 0) + packed) };
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
  const [deliveredBy, setDeliveredBy] = useState("");
  const [receivedBy, setReceivedBy] = useState("");
  const [pasteText, setPasteText] = useState("");
  // Opens with 3 rows, not 15: deliveries trickle, and a one-line challan is
  // the common case. A paste grows the grid to fit whatever was pasted.
  const [rows, setRows] = useState<RowState[]>(() => [blankRow(), blankRow(), blankRow()]);
  const [error, setError] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Map<number, string[]>>(new Map());

  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const resolutions = useMemo(
    () => new Map(rows.map((r) => [r.key, resolveRow(r, items)])),
    [rows, items]
  );
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

  /** Accepting a suggestion or an ambiguous candidate. Unlike picking a new
   * item from the list, the quantities already typed were meant for THIS
   * item, so they stay — only a pack on an unpackaged item is folded away. */
  function confirmItem(key: string, itemId: string) {
    const item = itemById.get(itemId);
    setRows((prev) =>
      prev.map((r) => {
        if (r.key !== key) return r;
        const patched: RowState = {
          ...r,
          itemId,
          itemQuery: item ? `${item.name} (${item.sku})` : r.itemQuery,
        };
        return item ? { ...patched, ...fitPackToItem(patched, item) } : patched;
      })
    );
  }

  function handleParse() {
    const parsed = parseDeliveryPaste(pasteText);
    if (!parsed.length) return;

    const newRows = parsed.map((p) => {
      const row = blankRow();
      row.sourceText = p.sourceText;
      row.itemQuery = p.name;
      const resolution = resolveRow(row, items);
      if (resolution.status === "exact") row.itemId = resolution.itemId;
      const item = row.itemId ? itemById.get(row.itemId) : undefined;

      if (p.packCount != null && p.packSize != null) {
        const pack = orientPack(
          { packCount: p.packCount, packSize: p.packSize },
          item?.knownPackSizes ?? []
        );
        row.packCount = String(pack.packCount);
        row.packSize = String(pack.packSize);
      } else if (p.loose != null) {
        row.loose = String(p.loose);
      }
      return item ? { ...row, ...fitPackToItem(row, item) } : row;
    });

    // Grows to fit: the still-blank starting rows drop out, and the grid
    // extends past three if the sheet is longer.
    setRows((prev) => [...prev.filter((r) => !isBlank(r)), ...newRows]);
    setPasteText("");
  }

  const summary = activeRows.reduce(
    (acc, r) => {
      const res = resolutions.get(r.key)!;
      if (res.status === "unmatched") acc.unmatched++;
      else if (res.status === "ambiguous") acc.ambiguous++;
      else if (res.status === "suggested") acc.unconfirmed++;
      else if (rowTotal(r) <= 0) acc.incomplete++;
      return acc;
    },
    { unmatched: 0, ambiguous: 0, unconfirmed: 0, incomplete: 0 }
  );

  const blocked =
    activeRows.length === 0 ||
    (destination === "SITE" && !siteId) ||
    pending ||
    summary.unmatched + summary.ambiguous + summary.unconfirmed + summary.incomplete > 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (blocked) return;
    setError(null);
    setRowErrors(new Map());

    startTransition(async () => {
      const result: DeliveryResult = await recordDelivery({
        reference,
        supplier,
        note,
        siteId: destination === "SITE" ? siteId : null,
        deliveredBy: destination === "SITE" ? deliveredBy : null,
        receivedBy: destination === "SITE" ? receivedBy : null,
        lines: activeRows.map((r) => toLine(r, resolutions.get(r.key)!.itemId)),
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

      <Card>
        <CardHeader>
          <CardTitle icon={<FileText className="h-3.5 w-3.5" />} tone="info">
            Challan details
          </CardTitle>
          <span className="text-xs font-semibold text-ink-subtle">All optional</span>
        </CardHeader>
        <CardBody>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Supplier">
              <Input
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                placeholder="Who sent it"
              />
            </Field>
            <Field label="Challan / invoice no.">
              <Input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="e.g. CH-1042"
              />
            </Field>
            <Field label="Note">
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Anything worth recording"
              />
            </Field>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle
            icon={<MapPin className="h-3.5 w-3.5" />}
            tone={destination === "SITE" ? "warn" : "ok"}
          >
            Destination
          </CardTitle>
          <span className="text-xs font-semibold text-ink-subtle">
            {destination === "SITE" ? "Bypasses the store" : "Normal path"}
          </span>
        </CardHeader>
        <CardBody className="space-y-3">
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
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Delivered by (optional)">
                  <Input
                    value={deliveredBy}
                    onChange={(e) => setDeliveredBy(e.target.value)}
                    placeholder="Driver or person carrying it"
                  />
                </Field>
                <Field label="Received by (optional)">
                  <Input
                    value={receivedBy}
                    onChange={(e) => setReceivedBy(e.target.value)}
                    placeholder="Person at site who signs"
                  />
                </Field>
              </div>
              <Alert tone="warn" className="text-xs">
                The material never touches the store, so store stock is unchanged. It is
                recorded against the site straight away, and the opened leftovers come back
                later as an ordinary return.
              </Alert>
            </>
          )}
          <p className="text-xs font-semibold text-ink-subtle">
            One destination per challan. A supplier splitting a shipment is two deliveries.
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle icon={<ClipboardPaste className="h-3.5 w-3.5" />} tone="special">
            Paste from Excel
          </CardTitle>
          <span className="text-xs font-semibold text-ink-subtle">Optional shortcut</span>
        </CardHeader>
        <CardBody className="space-y-2">
          <Textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            rows={4}
            placeholder={"Wire 2.5mm\t2 x 400\nScrews M4\t60"}
            className="font-mono"
          />
          <p className="text-xs font-semibold text-ink-subtle">
            One item per line, name first — extra columns are fine. A plain number goes in
            as loose stock; write <span className="font-mono">2 x 400</span> for two sealed
            packs of 400. Every row is yours to check before it is recorded.
          </p>
          <Button
            type="button"
            onClick={handleParse}
            disabled={!pasteText.trim()}
            variant="secondary"
          >
            Parse into rows
          </Button>
        </CardBody>
      </Card>

      <datalist id="delivery-items">
        {items.map((i) => (
          <option key={i.id} value={`${i.name} (${i.sku})`} />
        ))}
      </datalist>

      <Card>
        <CardHeader>
          <CardTitle icon={<PackagePlus className="h-3.5 w-3.5" />} tone="ok">
            What arrived
          </CardTitle>
          <span className="text-xs font-semibold text-ink-subtle">
            {activeRows.length} of {rows.length} filled
          </span>
        </CardHeader>
        <CardBody className="space-y-3">
          {rows.map((row, index) => (
            <DeliveryRowCard
              key={row.key}
              index={index}
              row={row}
              resolution={resolutions.get(row.key)!}
              item={itemById.get(resolutions.get(row.key)!.itemId)}
              errors={rowErrors.get(activeRows.indexOf(row)) ?? []}
              onChoose={(v) => chooseItem(row.key, v)}
              onConfirm={(id) => confirmItem(row.key, id)}
              onUpdate={(patch) => updateRow(row.key, patch)}
              onRemove={() => setRows((prev) => prev.filter((r) => r.key !== row.key))}
            />
          ))}
          <Button
            type="button"
            onClick={() => setRows((p) => [...p, blankRow()])}
            variant="secondary"
            size="sm"
          >
            <Plus className="h-4 w-4" />
            Add another line
          </Button>
        </CardBody>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-accent-soft bg-accent-soft px-4 py-3.5">
        <div className="text-sm">
          <p className="font-extrabold text-ink">
            {activeRows.length} line{activeRows.length === 1 ? "" : "s"} ready
            {summary.unmatched > 0 && ` · ${summary.unmatched} unmatched`}
            {summary.ambiguous > 0 && ` · ${summary.ambiguous} ambiguous`}
            {summary.unconfirmed > 0 && ` · ${summary.unconfirmed} need item confirmed`}
            {summary.incomplete > 0 && ` · ${summary.incomplete} missing a quantity`}
          </p>
          <p className="font-semibold text-ink-muted">
            {destination === "SITE"
              ? "Direct to site — store stock unchanged"
              : "Into the store"}
          </p>
        </div>
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
  resolution,
  item,
  errors,
  onChoose,
  onConfirm,
  onUpdate,
  onRemove,
}: {
  index: number;
  row: RowState;
  resolution: Resolution;
  item: FormItem | undefined;
  errors: string[];
  onChoose: (value: string) => void;
  onConfirm: (itemId: string) => void;
  onUpdate: (patch: Partial<RowState>) => void;
  onRemove: () => void;
}) {
  // useId, not row.key: the module-level counter behind row.key advances
  // independently on the server and in the browser, so using it in a DOM
  // attribute produced a hydration mismatch. useId is stable across both.
  const sizesId = useId();
  const confirmed = resolution.status === "exact";
  const packaged = !!item?.packUnit;
  const total = rowTotal(row);
  const defective = Number(row.defectiveQty) || 0;
  const good = Math.max(0, total - defective);

  // A filled row is worth seeing at a glance when the form is 6 lines long, so
  // the number chip carries the state rather than adding another badge.
  const filled = confirmed && total > 0;

  return (
    <div
      className={`space-y-3 rounded-card border p-3.5 ${
        errors.length
          ? "border-danger-line bg-danger-soft"
          : filled
            ? "border-line-strong bg-surface"
            : "border-line bg-surface-sunken"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="flex items-center gap-2">
          <span
            className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-extrabold ${
              errors.length
                ? "bg-danger-line text-danger-ink"
                : filled
                  ? "bg-accent text-accent-ink"
                  : "bg-surface text-ink-subtle"
            }`}
          >
            {index + 1}
          </span>
          <span className="text-xs font-bold text-ink-muted">
            {confirmed && item ? item.name : "Empty line"}
          </span>
        </span>
        <button
          type="button"
          onClick={onRemove}
          className="text-xs font-semibold text-ink-subtle hover:text-danger-ink"
          aria-label="Remove line"
        >
          Remove
        </button>
      </div>

      {row.sourceText && (
        <p className="font-mono text-[11px] text-ink-subtle">
          pasted &ldquo;{row.sourceText}&rdquo;
        </p>
      )}

      <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
        <Input
          list="delivery-items"
          value={row.itemQuery}
          onChange={(e) => onChoose(e.target.value)}
          placeholder="Item name…"
        />
        {resolution.status === "suggested" && item && (
          <Badge tone={MATCH_STATUS_TONE.suggested}>suggested: {item.name}</Badge>
        )}
        {resolution.status === "unmatched" && row.itemQuery.trim() !== "" && (
          <Badge tone={MATCH_STATUS_TONE.unmatched}>no match — pick manually</Badge>
        )}
        {resolution.status === "ambiguous" && (
          <Badge tone={MATCH_STATUS_TONE.ambiguous}>ambiguous — pick one</Badge>
        )}
      </div>

      {resolution.status === "suggested" && item && (
        <Button type="button" onClick={() => onConfirm(item.id)} variant="secondary" size="sm">
          ✓ Use {item.name} ({item.sku})
        </Button>
      )}

      {resolution.status === "ambiguous" && (
        <div className="flex flex-wrap gap-2">
          {resolution.candidates.map((c) => (
            <Button
              key={c.itemId}
              type="button"
              onClick={() => onConfirm(c.itemId)}
              variant="secondary"
              size="sm"
            >
              {c.name} ({c.sku})
            </Button>
          ))}
        </div>
      )}

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
