"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  recordDispatch,
  type DispatchLineInput,
  type DispatchResult,
} from "@/lib/actions/dispatches";
import {
  planBatch,
  type AllocationPlan,
  type AllocationRequest,
  type ItemRules,
  type PackSnapshot,
} from "@/lib/allocation";
import { describeAllocationErrors, type ApprovedOpens } from "@/lib/packs";
import { parseDispatchPaste } from "@/lib/dispatchPaste";
import { matchItem, type MatchCandidate } from "@/lib/matching";
import { formatQuantity, piecesTotal, type Piece } from "@/lib/units";
import type { MeasureType } from "@/generated/prisma/enums";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import Button from "@/components/ui/Button";
import Alert from "@/components/ui/Alert";
import Badge from "@/components/ui/Badge";
import { MATCH_STATUS_TONE } from "@/components/ui/tones";

export type FormItem = {
  id: string;
  name: string;
  sku: string;
  baseUnit: string;
  packUnit: string | null;
  measure: MeasureType;
  scrapThreshold: number | null;
  packs: PackSnapshot;
};

type Site = { id: string; name: string };

type DispatchRowState = {
  key: string;
  sourceText: string;
  itemQuery: string;
  /** Set once the user has explicitly confirmed an item — by picking it from
   * the list, or accepting a suggestion/ambiguous candidate. A row never
   * ships against an item that was only auto-suggested. */
  manualItemId: string | null;
  /** The quantity as pasted, before anyone has said whether that means "one
   * 150 m piece" or "150 pcs" — resolved into pieces/loose once the item
   * (and so its measure) is known. */
  parsedQuantity: number | null;
  sealedSize: string;
  sealedCount: string;
  loose: string;
  pieces: Piece[];
  /** Reset to false on every edit — a stale approval must not survive a
   * change to what it was approving. */
  acknowledgedOpen: boolean;
};

let keyCounter = 0;
function makeBlankRow(): DispatchRowState {
  keyCounter += 1;
  return {
    key: `row-${keyCounter}`,
    sourceText: "",
    itemQuery: "",
    manualItemId: null,
    parsedQuantity: null,
    sealedSize: "",
    sealedCount: "",
    loose: "",
    pieces: [],
    acknowledgedOpen: false,
  };
}

function isBlank(row: DispatchRowState): boolean {
  return (
    !row.sourceText &&
    !row.itemQuery.trim() &&
    !row.manualItemId &&
    !row.loose.trim() &&
    !row.sealedCount.trim() &&
    row.pieces.every((p) => !p.length && !p.count)
  );
}

/** Fills the quantity in, as pieces or loose depending on measure, ONLY if
 * nothing has been typed into that field yet — never overwrites an edit. */
function defaultQuantityPatch(
  row: DispatchRowState,
  item: FormItem
): Partial<DispatchRowState> {
  if (row.parsedQuantity == null) return {};
  const hasPieces = row.pieces.some((p) => p.length > 0 && p.count > 0);
  const hasLoose = row.loose.trim() !== "";
  if (item.measure === "CONTINUOUS" && !hasPieces) {
    return { pieces: [{ length: row.parsedQuantity, count: 1 }] };
  }
  if (item.measure !== "CONTINUOUS" && !hasLoose) {
    return { loose: String(row.parsedQuantity) };
  }
  return {};
}

function buildRequest(row: DispatchRowState, item: FormItem | undefined): AllocationRequest {
  const sealedPacks =
    row.sealedSize && Number(row.sealedCount) > 0
      ? [{ packSize: Number(row.sealedSize), count: Number(row.sealedCount) }]
      : [];
  const isContinuous = item?.measure === "CONTINUOUS";
  return {
    sealedPacks,
    pieces: isContinuous ? row.pieces.filter((p) => p.length > 0 && p.count > 0) : [],
    loose: isContinuous ? 0 : Number(row.loose) || 0,
  };
}

function requestTotal(request: AllocationRequest): number {
  return (
    request.sealedPacks.reduce((s, p) => s + p.packSize * p.count, 0) +
    piecesTotal(request.pieces) +
    request.loose
  );
}

function summariseOpens(plan: AllocationPlan): ApprovedOpens {
  const bySize = new Map<number, number>();
  for (const o of plan.opens) bySize.set(o.packSize, (bySize.get(o.packSize) ?? 0) + 1);
  return [...bySize.entries()].map(([packSize, count]) => ({ packSize, count }));
}

type Resolution =
  | { status: "exact"; itemId: string; candidates: [] }
  | { status: "suggested"; itemId: string; candidates: [] }
  | { status: "ambiguous"; itemId: ""; candidates: MatchCandidate[] }
  | { status: "unmatched"; itemId: ""; candidates: [] };

function resolveRow(row: DispatchRowState, items: FormItem[]): Resolution {
  if (row.manualItemId) return { status: "exact", itemId: row.manualItemId, candidates: [] };
  const m = matchItem(row.itemQuery, items);
  if (m.status === "exact") return { status: "exact", itemId: m.itemId, candidates: [] };
  if (m.status === "suggested") return { status: "suggested", itemId: m.itemId, candidates: [] };
  if (m.status === "ambiguous") return { status: "ambiguous", itemId: "", candidates: m.candidates };
  return { status: "unmatched", itemId: "", candidates: [] };
}

export default function DispatchBatchForm({
  items,
  sites,
}: {
  items: FormItem[];
  sites: Site[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [siteId, setSiteId] = useState("");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [rows, setRows] = useState<DispatchRowState[]>(() =>
    Array.from({ length: 15 }, makeBlankRow)
  );
  const [error, setError] = useState<string | null>(null);
  const [errorRowKey, setErrorRowKey] = useState<string | null>(null);

  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const rules = useMemo(
    () =>
      new Map<string, ItemRules>(
        items.map((i) => [i.id, { measure: i.measure, scrapThreshold: i.scrapThreshold }])
      ),
    [items]
  );
  const snapshots = useMemo(
    () =>
      new Map<string, PackSnapshot>(
        items.map((i) => [
          i.id,
          {
            sealed: i.packs.sealed.map((g) => ({ ...g })),
            open: i.packs.open.map((p) => ({ ...p })),
          },
        ])
      ),
    [items]
  );

  const resolutions = useMemo(
    () => new Map(rows.map((r) => [r.key, resolveRow(r, items)])),
    [rows, items]
  );

  /** Every non-blank row with a confirmed item, planned against ONE shared
   * inventory in row order — the same planBatch the server re-runs at
   * commit, so this preview cannot disagree with what actually happens. */
  const plans = useMemo(() => {
    const batchRows = rows
      .filter((r) => !isBlank(r) && resolutions.get(r.key)?.status === "exact")
      .map((r) => ({
        itemId: resolutions.get(r.key)!.itemId,
        request: buildRequest(r, itemById.get(resolutions.get(r.key)!.itemId)),
        meta: r.key,
      }));
    const results = planBatch(rules, snapshots, batchRows);
    return new Map(results.map((r) => [r.row.meta!, r.plan]));
  }, [rows, resolutions, itemById, rules, snapshots]);

  function updateRow(key: string, patch: Partial<DispatchRowState>) {
    setRows((prev) =>
      prev.map((r) =>
        r.key === key ? { ...r, ...patch, acknowledgedOpen: patch.acknowledgedOpen ?? false } : r
      )
    );
  }

  function chooseItem(key: string, itemId: string) {
    const item = itemById.get(itemId);
    setRows((prev) =>
      prev.map((r) => {
        if (r.key !== key) return r;
        const patched: DispatchRowState = {
          ...r,
          manualItemId: itemId,
          itemQuery: item ? `${item.name} (${item.sku})` : r.itemQuery,
          acknowledgedOpen: false,
        };
        return item ? { ...patched, ...defaultQuantityPatch(patched, item) } : patched;
      })
    );
  }

  function handleParse() {
    const parsed = parseDispatchPaste(pasteText);
    if (!parsed.length) return;
    const newRows = parsed.map((p) => {
      const row = makeBlankRow();
      row.sourceText = p.sourceText;
      row.itemQuery = p.name;
      row.parsedQuantity = p.quantity;
      const resolution = resolveRow(row, items);
      if (resolution.status === "exact") {
        row.manualItemId = resolution.itemId;
        const item = itemById.get(resolution.itemId);
        if (item) Object.assign(row, defaultQuantityPatch(row, item));
      }
      return row;
    });
    // Grows to fit: replace the (still blank) starting rows, or extend past
    // them if the sheet is longer than 15 lines.
    setRows((prev) => {
      const kept = prev.filter((r) => !isBlank(r));
      return [...kept, ...newRows];
    });
    setPasteText("");
  }

  function addRow() {
    setRows((prev) => [...prev, makeBlankRow()]);
  }

  function removeRow(key: string) {
    setRows((prev) => prev.filter((r) => r.key !== key));
  }

  const activeRows = rows.filter((r) => !isBlank(r));
  const summary = activeRows.reduce(
    (acc, r) => {
      const res = resolutions.get(r.key)!;
      if (res.status === "unmatched") acc.unmatched++;
      else if (res.status === "ambiguous") acc.ambiguous++;
      else if (res.status === "suggested") acc.unconfirmed++;
      else {
        const item = itemById.get(res.itemId);
        const total = item ? requestTotal(buildRequest(r, item)) : 0;
        const plan = plans.get(r.key);
        if (total <= 0) acc.incomplete++;
        else if (plan?.errors.length) acc.outOfStock++;
        else if (plan?.opens.length && !r.acknowledgedOpen) acc.needsOpen++;
      }
      return acc;
    },
    { unmatched: 0, ambiguous: 0, unconfirmed: 0, incomplete: 0, outOfStock: 0, needsOpen: 0 }
  );

  const blocked =
    activeRows.length === 0 ||
    !siteId ||
    summary.unmatched +
      summary.ambiguous +
      summary.unconfirmed +
      summary.incomplete +
      summary.outOfStock +
      summary.needsOpen >
      0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (blocked) return;
    setError(null);
    setErrorRowKey(null);

    const lines: DispatchLineInput[] = activeRows.map((r) => {
      const res = resolutions.get(r.key)!;
      const item = itemById.get(res.itemId)!;
      const request = buildRequest(r, item);
      const plan = plans.get(r.key);
      return {
        sourceText: r.sourceText,
        itemId: res.itemId,
        sealedPacks: request.sealedPacks,
        pieces: request.pieces,
        loose: request.loose,
        approvedOpens: plan ? summariseOpens(plan) : [],
      };
    });

    startTransition(async () => {
      const result: DispatchResult = await recordDispatch({
        siteId,
        reference,
        note,
        lines,
      });
      if (result.ok) {
        router.push(`/dispatches/${result.dispatchId}`);
        router.refresh();
      } else {
        setError(result.message);
        if (result.rowIndex != null) setErrorRowKey(activeRows[result.rowIndex]?.key ?? null);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && <Alert tone="danger">{error}</Alert>}

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Site">
          <Select value={siteId} onChange={(e) => setSiteId(e.target.value)} required>
            <option value="">Select a site…</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Reference / challan no. (optional)">
          <Input value={reference} onChange={(e) => setReference(e.target.value)} />
        </Field>
        <Field label="Note (optional)">
          <Input value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>

      <div className="space-y-2 rounded-card border border-dashed border-line-strong p-3.5">
        <label className="text-sm font-semibold text-ink-muted">
          Paste from Excel — one item per line, name and quantity (extra columns are fine)
        </label>
        <Textarea
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          rows={4}
          placeholder={"Wire 2.5mm\t150\nScrews M4\t60"}
          className="font-mono"
        />
        <Button type="button" onClick={handleParse} disabled={!pasteText.trim()} variant="secondary">
          Parse into rows
        </Button>
      </div>

      <datalist id="dispatch-items">
        {items.map((i) => (
          <option key={i.id} value={`${i.name} (${i.sku})`} />
        ))}
      </datalist>

      <div className="space-y-3">
        {rows.map((row, index) => (
          <DispatchRowCard
            key={row.key}
            index={index}
            row={row}
            items={items}
            resolution={resolutions.get(row.key)!}
            item={itemById.get(resolutions.get(row.key)!.itemId)}
            plan={plans.get(row.key)}
            highlighted={row.key === errorRowKey}
            onChoose={(id) => chooseItem(row.key, id)}
            onQuery={(q) => updateRow(row.key, { itemQuery: q, manualItemId: null })}
            onUpdate={(patch) => updateRow(row.key, patch)}
            onAcknowledge={() => updateRow(row.key, { acknowledgedOpen: true })}
            onRemove={() => removeRow(row.key)}
          />
        ))}
      </div>

      <Button type="button" onClick={addRow} variant="secondary">
        Add row
      </Button>

      <div className="space-y-2 rounded-card border border-line p-3.5 text-sm">
        <p className="font-semibold text-ink">
          {activeRows.length} row{activeRows.length === 1 ? "" : "s"} entered
          {summary.unmatched > 0 && ` · ${summary.unmatched} unmatched`}
          {summary.ambiguous > 0 && ` · ${summary.ambiguous} ambiguous`}
          {summary.unconfirmed > 0 && ` · ${summary.unconfirmed} need item confirmed`}
          {summary.incomplete > 0 && ` · ${summary.incomplete} missing a quantity`}
          {summary.needsOpen > 0 && ` · ${summary.needsOpen} need a roll opened`}
          {summary.outOfStock > 0 && ` · ${summary.outOfStock} out of stock`}
        </p>
        <Button type="submit" disabled={pending || blocked}>
          {pending ? "Recording…" : "Record dispatch"}
        </Button>
      </div>
    </form>
  );
}

function DispatchRowCard({
  index,
  row,
  items,
  resolution,
  item,
  plan,
  highlighted,
  onChoose,
  onQuery,
  onUpdate,
  onAcknowledge,
  onRemove,
}: {
  index: number;
  row: DispatchRowState;
  items: FormItem[];
  resolution: Resolution;
  item: FormItem | undefined;
  plan: AllocationPlan | undefined;
  highlighted: boolean;
  onChoose: (itemId: string) => void;
  onQuery: (query: string) => void;
  onUpdate: (patch: Partial<DispatchRowState>) => void;
  onAcknowledge: () => void;
  onRemove: () => void;
}) {
  const isContinuous = item?.measure === "CONTINUOUS";
  const request = item ? buildRequest(row, item) : null;
  const total = request ? requestTotal(request) : 0;

  return (
    <div
      className={`space-y-3 rounded-card border p-3.5 ${
        highlighted ? "border-danger-line bg-danger-soft" : "border-line bg-surface"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-semibold text-ink-subtle">
          Row {index + 1}
          {row.sourceText && ` · pasted "${row.sourceText}"`}
        </span>
        <button
          type="button"
          onClick={onRemove}
          className="text-xs font-semibold text-ink-subtle hover:text-danger-ink"
          aria-label="Remove row"
        >
          Remove
        </button>
      </div>

      <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
        <Input
          list="dispatch-items"
          value={row.itemQuery}
          onChange={(e) => {
            const value = e.target.value;
            // Picking a datalist option types the exact "Name (SKU)" string —
            // resolve it straight to that item rather than re-running fuzzy
            // matching on text that already names it precisely.
            const picked = items.find((i) => `${i.name} (${i.sku})` === value);
            if (picked) onChoose(picked.id);
            else onQuery(value);
          }}
          placeholder="Item name…"
        />
        {resolution.status !== "unmatched" && resolution.status !== "ambiguous" && item && (
          <Badge tone={MATCH_STATUS_TONE[resolution.status]}>
            {resolution.status === "exact" ? item.name : `suggested: ${item.name}`}
          </Badge>
        )}
        {resolution.status === "unmatched" && row.itemQuery.trim() !== "" && (
          <Badge tone={MATCH_STATUS_TONE.unmatched}>no match — pick manually</Badge>
        )}
        {resolution.status === "ambiguous" && (
          <Badge tone={MATCH_STATUS_TONE.ambiguous}>ambiguous — pick one</Badge>
        )}
      </div>

      {resolution.status === "suggested" && item && (
        <Button type="button" onClick={() => onChoose(resolution.itemId)} variant="secondary" size="sm">
          ✓ Use {item.name} ({item.sku})
        </Button>
      )}

      {resolution.status === "ambiguous" && (
        <div className="flex flex-wrap gap-2">
          {resolution.candidates.map((c) => (
            <Button key={c.itemId} type="button" onClick={() => onChoose(c.itemId)} variant="secondary" size="sm">
              {c.name} ({c.sku})
            </Button>
          ))}
        </div>
      )}

      {item && (
        <>
          {item.packUnit && item.packs.sealed.some((g) => g.sealedCount > 0) && (
            <div className="grid grid-cols-[1fr_1fr] gap-2">
              <Select value={row.sealedSize} onChange={(e) => onUpdate({ sealedSize: e.target.value })}>
                <option value="">whole sealed {item.packUnit}: none</option>
                {item.packs.sealed
                  .filter((g) => g.sealedCount > 0)
                  .map((g) => (
                    <option key={g.packSize} value={g.packSize}>
                      {g.packSize} {item.baseUnit} ({g.sealedCount} available)
                    </option>
                  ))}
              </Select>
              <Input
                type="number"
                min={1}
                inputMode="numeric"
                value={row.sealedCount}
                onChange={(e) => onUpdate({ sealedCount: e.target.value })}
                placeholder="how many"
              />
            </div>
          )}

          {isContinuous ? (
            <div className="space-y-2">
              {row.pieces.map((piece, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    inputMode="numeric"
                    value={piece.length || ""}
                    onChange={(e) =>
                      onUpdate({
                        pieces: row.pieces.map((p, j) =>
                          j === i ? { ...p, length: Number(e.target.value) } : p
                        ),
                      })
                    }
                    placeholder={`length (${item.baseUnit})`}
                  />
                  <span className="text-sm text-ink-subtle">×</span>
                  <Input
                    type="number"
                    min={1}
                    inputMode="numeric"
                    value={piece.count || ""}
                    onChange={(e) =>
                      onUpdate({
                        pieces: row.pieces.map((p, j) =>
                          j === i ? { ...p, count: Number(e.target.value) } : p
                        ),
                      })
                    }
                    placeholder="pieces"
                  />
                  <button
                    type="button"
                    onClick={() => onUpdate({ pieces: row.pieces.filter((_, j) => j !== i) })}
                    className="px-2 text-sm text-ink-subtle hover:text-danger-ink"
                    aria-label="Remove length"
                  >
                    ×
                  </button>
                </div>
              ))}
              <Button
                type="button"
                onClick={() => onUpdate({ pieces: [...row.pieces, { length: 0, count: 1 }] })}
                variant="secondary"
              >
                Add cut length
              </Button>
            </div>
          ) : (
            <Input
              type="number"
              min={1}
              inputMode="numeric"
              value={row.loose}
              onChange={(e) => onUpdate({ loose: e.target.value })}
              placeholder={`quantity (${item.baseUnit})`}
            />
          )}

          <PlanStatus item={item} plan={plan} total={total} acknowledged={row.acknowledgedOpen} onAcknowledge={onAcknowledge} />
        </>
      )}
    </div>
  );
}

function PlanStatus({
  item,
  plan,
  total,
  acknowledged,
  onAcknowledge,
}: {
  item: FormItem;
  plan: AllocationPlan | undefined;
  total: number;
  acknowledged: boolean;
  onAcknowledge: () => void;
}) {
  if (total <= 0) return null;
  if (!plan) return null;

  if (plan.errors.length) {
    return (
      <p className="text-sm font-semibold text-danger-ink">
        ✗ {describeAllocationErrors(plan, item.baseUnit).join(" ")}
      </p>
    );
  }

  if (plan.opens.length) {
    const sizes = plan.opens.map((o) => `${o.packSize} ${item.baseUnit}`).join(", ");
    return (
      <Alert tone="warn" className="space-y-1.5">
        <p>
          ⚠ No open {item.packUnit ?? "pack"} covers this — will open {plan.opens.length} sealed{" "}
          {sizes}.
          {plan.scrap.length > 0 &&
            ` Also writes off ${plan.scrap.map((s) => `${s.length} ${item.baseUnit}`).join(", ")} as scrap.`}
        </p>
        {acknowledged ? (
          <p className="text-xs font-bold">✓ Approved</p>
        ) : (
          <Button type="button" onClick={onAcknowledge} variant="secondary" size="sm">
            Approve opening this pack
          </Button>
        )}
      </Alert>
    );
  }

  return (
    <p className="text-sm font-semibold text-ok-ink">
      ✓ {formatQuantity(item, total)} ready from stock already open
    </p>
  );
}
