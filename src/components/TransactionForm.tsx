"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recordMovement, type MovementInput } from "@/lib/actions/transactions";
import {
  planAllocation,
  type AllocationPlan,
  type PackSnapshot,
} from "@/lib/allocation";
import { formatQuantity, piecesTotal, type Piece } from "@/lib/units";
import type { MeasureType } from "@/generated/prisma/enums";
import { Field, Input, Select } from "@/components/ui/Field";
import Button from "@/components/ui/Button";
import Alert from "@/components/ui/Alert";

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
type TxType = "STOCK_IN" | "ISSUE" | "RETURN";

export default function TransactionForm({
  items,
  sites,
}: {
  items: FormItem[];
  sites: Site[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [type, setType] = useState<TxType>("ISSUE");
  const [itemId, setItemId] = useState("");
  const [itemQuery, setItemQuery] = useState("");
  const [siteId, setSiteId] = useState("");
  const [note, setNote] = useState("");

  const [sealedSize, setSealedSize] = useState("");
  const [sealedCount, setSealedCount] = useState("");
  const [loose, setLoose] = useState("");
  const [pieces, setPieces] = useState<Piece[]>([{ length: 0, count: 1 }]);
  const [defectiveQty, setDefectiveQty] = useState("");

  const [confirming, setConfirming] = useState<AllocationPlan | null>(null);
  const [error, setError] = useState<string | null>(null);

  const item = items.find((i) => i.id === itemId) ?? null;
  const isContinuous = item?.measure === "CONTINUOUS";
  const isIssue = type === "ISSUE";
  const isStockIn = type === "STOCK_IN";

  const request = useMemo(() => {
    const sealedPacks =
      sealedSize && Number(sealedCount) > 0
        ? [{ packSize: Number(sealedSize), count: Number(sealedCount) }]
        : [];
    return {
      sealedPacks,
      // Incoming stock arrives as sealed packs or as a loose amount — cut
      // lengths only make sense when material is leaving.
      pieces: isContinuous && !isStockIn ? pieces.filter((p) => p.length > 0 && p.count > 0) : [],
      loose: isContinuous && !isStockIn ? 0 : Number(loose) || 0,
    };
  }, [sealedSize, sealedCount, pieces, loose, isContinuous, isStockIn]);

  const total =
    request.sealedPacks.reduce((s, p) => s + p.packSize * p.count, 0) +
    piecesTotal(request.pieces) +
    request.loose;

  /** The same pure planner the server runs, so this preview cannot disagree
   * with what commit actually does. */
  const plan = useMemo(() => {
    if (!item || !isIssue || total <= 0) return null;
    return planAllocation(
      { measure: item.measure, scrapThreshold: item.scrapThreshold },
      { open: item.packs.open.map((p) => ({ ...p })), sealed: item.packs.sealed.map((g) => ({ ...g })) },
      request
    );
  }, [item, isIssue, request, total]);

  function submit(approved: AllocationPlan | null) {
    if (!item) return;
    setError(null);

    const input: MovementInput = {
      itemId: item.id,
      type,
      siteId,
      note,
      sealedPacks: request.sealedPacks,
      pieces: request.pieces,
      loose: request.loose,
      defectiveQty: type === "RETURN" ? Number(defectiveQty) || 0 : undefined,
      approvedOpens: approved
        ? Object.entries(
            approved.opens.reduce<Record<number, number>>((acc, o) => {
              acc[o.packSize] = (acc[o.packSize] ?? 0) + 1;
              return acc;
            }, {})
          ).map(([packSize, count]) => ({ packSize: Number(packSize), count }))
        : [],
    };

    startTransition(async () => {
      const result = await recordMovement(input);
      if (result.ok) {
        setConfirming(null);
        router.push(`/items/${item.id}`);
        router.refresh();
      } else {
        setConfirming(null);
        setError(result.message);
      }
    });
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!item) return;
    // Anything that would open a sealed pack stops here for an explicit
    // decision. This friction is the point: it is where someone realises they
    // asked for 150 m when two 75 m runs would come off the offcuts.
    if (plan && plan.opens.length > 0 && plan.errors.length === 0) {
      setConfirming(plan);
      return;
    }
    submit(null);
  }

  if (confirming && item) {
    const openSummary = confirming.opens
      .map((o) => `${o.packSize} ${item.baseUnit}`)
      .join(", ");
    return (
      <div className="max-w-lg space-y-4 rounded-card border border-warn-line bg-warn-soft p-4">
        <h2 className="font-extrabold text-ink">
          This needs a sealed {item.packUnit ?? "pack"} opened
        </h2>
        <p className="text-sm font-semibold text-ink">
          No open {item.packUnit ?? "pack"} can cover this. It will open {confirming.opens.length}{" "}
          sealed {openSummary}.
        </p>
        <p className="text-sm font-semibold text-ink">
          Currently open:{" "}
          {item.packs.open.length
            ? item.packs.open.map((p) => `${p.remaining} ${item.baseUnit}`).join(", ")
            : "nothing"}
          .
        </p>
        {confirming.scrap.length > 0 && (
          <p className="text-sm font-semibold text-warn-ink">
            This will also write off {confirming.scrap.map((s) => `${s.length} ${item.baseUnit}`).join(", ")}{" "}
            as offcut below the scrap threshold.
          </p>
        )}
        <p className="text-sm font-semibold text-ink">
          If these lengths do not have to be continuous, going back and entering them as separate
          pieces may avoid opening anything.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setConfirming(null)} variant="secondary">
            Go back and revise
          </Button>
          <Button onClick={() => submit(confirming)} disabled={pending}>
            {pending ? "Recording…" : `Open and ${isIssue ? "issue" : "record"}`}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="max-w-lg space-y-4">
      {error && <Alert tone="danger">{error}</Alert>}

      <Field label="Transaction type">
        {/* STOCK_IN is deliberately absent now that deliveries have their own
            grid: incoming stock belongs to a Delivery record with a supplier
            and challan reference. recordTransaction keeps its STOCK_IN branch
            — still correct, still capability-gated — only the UI option goes. */}
        <Select value={type} onChange={(e) => setType(e.target.value as TxType)}>
          <option value="ISSUE">Issue to Site</option>
          <option value="RETURN">Return from Site</option>
        </Select>
      </Field>

      <Field label="Item">
        <Input
          list="tx-items"
          value={itemQuery}
          onChange={(e) => {
            setItemQuery(e.target.value);
            const match = items.find((i) => `${i.name} (${i.sku})` === e.target.value);
            setItemId(match?.id ?? "");
            setSealedSize("");
            setSealedCount("");
          }}
          placeholder="Type to search…"
        />
        <datalist id="tx-items">
          {items.map((i) => (
            <option key={i.id} value={`${i.name} (${i.sku})`} />
          ))}
        </datalist>
      </Field>

      {!isStockIn && (
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
      )}

      {item && (
        <>
          {item.packUnit && isStockIn && (
            <fieldset className="space-y-2 rounded-card border border-line p-3.5">
              <legend className="px-1 text-sm font-semibold text-ink-muted">
                Sealed {item.packUnit}s received
              </legend>
              <p className="text-xs font-semibold text-ink-subtle">
                A pack size that is new to this item is fine — just type it. A 400 {item.baseUnit}{" "}
                and a 600 {item.baseUnit} {item.packUnit} of the same material are two sizes of
                one item, not two items.
              </p>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min={1}
                  inputMode="numeric"
                  list="pack-sizes"
                  value={sealedSize}
                  onChange={(e) => setSealedSize(e.target.value)}
                  placeholder={`size in ${item.baseUnit}`}
                />
                <datalist id="pack-sizes">
                  {item.packs.sealed.map((g) => (
                    <option key={g.packSize} value={g.packSize} />
                  ))}
                </datalist>
                <Input
                  type="number"
                  min={1}
                  inputMode="numeric"
                  value={sealedCount}
                  onChange={(e) => setSealedCount(e.target.value)}
                  placeholder="how many"
                />
              </div>
            </fieldset>
          )}

          {item.packUnit && !isStockIn && item.packs.sealed.some((g) => g.sealedCount > 0) && (
            <fieldset className="space-y-2 rounded-card border border-line p-3.5">
              <legend className="px-1 text-sm font-semibold text-ink-muted">
                Whole sealed {item.packUnit}s — handed over uncut
              </legend>
              <div className="flex gap-2">
                <Select value={sealedSize} onChange={(e) => setSealedSize(e.target.value)}>
                  <option value="">— none —</option>
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
                  value={sealedCount}
                  onChange={(e) => setSealedCount(e.target.value)}
                  placeholder="how many"
                />
              </div>
            </fieldset>
          )}

          {isContinuous && !isStockIn ? (
            <fieldset className="space-y-2 rounded-card border border-line p-3.5">
              <legend className="px-1 text-sm font-semibold text-ink-muted">Cut lengths</legend>
              <p className="text-xs font-semibold text-ink-subtle">
                Each piece must come from a single {item.packUnit ?? "pack"} —{" "}
                {item.baseUnit === "m" ? "wire is not joined" : "material is not joined"} to make
                up a length. Two 75 {item.baseUnit} runs often fit offcuts that one 150{" "}
                {item.baseUnit} run cannot.
              </p>
              {pieces.map((piece, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    inputMode="numeric"
                    value={piece.length || ""}
                    onChange={(e) => updatePiece(setPieces, i, { length: Number(e.target.value) })}
                    placeholder={`length in ${item.baseUnit}`}
                  />
                  <span className="text-sm text-ink-subtle">×</span>
                  <Input
                    type="number"
                    min={1}
                    inputMode="numeric"
                    value={piece.count || ""}
                    onChange={(e) => updatePiece(setPieces, i, { count: Number(e.target.value) })}
                    placeholder="pieces"
                  />
                  {pieces.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setPieces((p) => p.filter((_, j) => j !== i))}
                      className="px-2 text-sm text-ink-subtle hover:text-danger-ink"
                      aria-label="Remove piece"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              <Button
                type="button"
                onClick={() => setPieces((p) => [...p, { length: 0, count: 1 }])}
                variant="secondary"
              >
                Add another length
              </Button>
            </fieldset>
          ) : (
            <Field
              label={
                isStockIn && item.packUnit
                  ? `Loose ${item.baseUnit} received (outside any ${item.packUnit})`
                  : `Quantity (${item.baseUnit})`
              }
            >
              <Input
                type="number"
                min={isStockIn ? 0 : 1}
                inputMode="numeric"
                value={loose}
                onChange={(e) => setLoose(e.target.value)}
              />
            </Field>
          )}

          {type === "RETURN" && (
            <Field label={`Of that, defective (${item.baseUnit}) — quarantined, not restocked`}>
              <Input
                type="number"
                min={0}
                inputMode="numeric"
                value={defectiveQty}
                onChange={(e) => setDefectiveQty(e.target.value)}
              />
            </Field>
          )}

          {total > 0 && (
            <p className="text-sm font-semibold text-ink-subtle">
              Total: {formatQuantity(item, total)}
              {plan?.errors.length ? (
                <span className="ml-2 text-danger-ink">· cannot be filled from stock</span>
              ) : plan?.opens.length ? (
                <span className="ml-2 text-warn-ink">
                  · needs a sealed {item.packUnit ?? "pack"} opened
                </span>
              ) : null}
            </p>
          )}
        </>
      )}

      <Field label="Note (optional)">
        <Input value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>

      <Button type="submit" disabled={pending || !item || total <= 0}>
        {pending ? "Recording…" : "Record transaction"}
      </Button>
    </form>
  );
}

function updatePiece(
  setPieces: React.Dispatch<React.SetStateAction<Piece[]>>,
  index: number,
  patch: Partial<Piece>
) {
  setPieces((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
}
