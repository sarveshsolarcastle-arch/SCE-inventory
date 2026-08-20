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

const INPUT =
  "w-full rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900";
const PRIMARY =
  "rounded bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900";
const SECONDARY =
  "rounded border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900";

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
      <div className="max-w-lg space-y-4 rounded border border-amber-400 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950">
        <h2 className="font-medium text-zinc-900 dark:text-zinc-50">
          This needs a sealed {item.packUnit ?? "pack"} opened
        </h2>
        <p className="text-sm text-zinc-700 dark:text-zinc-300">
          No open {item.packUnit ?? "pack"} can cover this. It will open{" "}
          {confirming.opens.length} sealed {openSummary}.
        </p>
        <p className="text-sm text-zinc-700 dark:text-zinc-300">
          Currently open:{" "}
          {item.packs.open.length
            ? item.packs.open.map((p) => `${p.remaining} ${item.baseUnit}`).join(", ")
            : "nothing"}
          .
        </p>
        {confirming.scrap.length > 0 && (
          <p className="text-sm text-amber-800 dark:text-amber-300">
            This will also write off{" "}
            {confirming.scrap.map((s) => `${s.length} ${item.baseUnit}`).join(", ")} as
            offcut below the scrap threshold.
          </p>
        )}
        <p className="text-sm text-zinc-700 dark:text-zinc-300">
          If these lengths do not have to be continuous, going back and entering
          them as separate pieces may avoid opening anything.
        </p>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setConfirming(null)} className={SECONDARY}>
            Go back and revise
          </button>
          <button onClick={() => submit(confirming)} disabled={pending} className={PRIMARY}>
            {pending ? "Recording…" : `Open and ${isIssue ? "issue" : "record"}`}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="max-w-lg space-y-4">
      {error && (
        <p
          role="alert"
          className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
        >
          {error}
        </p>
      )}

      <Labelled label="Transaction type">
        <select
          value={type}
          onChange={(e) => setType(e.target.value as TxType)}
          className={INPUT}
        >
          <option value="STOCK_IN">Stock In (received)</option>
          <option value="ISSUE">Issue to Site</option>
          <option value="RETURN">Return from Site</option>
        </select>
      </Labelled>

      <Labelled label="Item">
        <input
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
          className={INPUT}
        />
        <datalist id="tx-items">
          {items.map((i) => (
            <option key={i.id} value={`${i.name} (${i.sku})`} />
          ))}
        </datalist>
      </Labelled>

      {!isStockIn && (
        <Labelled label="Site">
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
        </Labelled>
      )}

      {item && (
        <>
          {item.packUnit && isStockIn && (
            <fieldset className="space-y-2 rounded border border-zinc-200 p-3 dark:border-zinc-800">
              <legend className="px-1 text-sm text-zinc-600 dark:text-zinc-400">
                Sealed {item.packUnit}s received
              </legend>
              <p className="text-xs text-zinc-500 dark:text-zinc-500">
                A pack size that is new to this item is fine — just type it. A
                400 {item.baseUnit} and a 600 {item.baseUnit} {item.packUnit} of
                the same material are two sizes of one item, not two items.
              </p>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={1}
                  list="pack-sizes"
                  value={sealedSize}
                  onChange={(e) => setSealedSize(e.target.value)}
                  placeholder={`size in ${item.baseUnit}`}
                  className={INPUT}
                />
                <datalist id="pack-sizes">
                  {item.packs.sealed.map((g) => (
                    <option key={g.packSize} value={g.packSize} />
                  ))}
                </datalist>
                <input
                  type="number"
                  min={1}
                  value={sealedCount}
                  onChange={(e) => setSealedCount(e.target.value)}
                  placeholder="how many"
                  className={INPUT}
                />
              </div>
            </fieldset>
          )}

          {item.packUnit && !isStockIn && item.packs.sealed.some((g) => g.sealedCount > 0) && (
            <fieldset className="space-y-2 rounded border border-zinc-200 p-3 dark:border-zinc-800">
              <legend className="px-1 text-sm text-zinc-600 dark:text-zinc-400">
                Whole sealed {item.packUnit}s — handed over uncut
              </legend>
              <div className="flex gap-2">
                <select
                  value={sealedSize}
                  onChange={(e) => setSealedSize(e.target.value)}
                  className={INPUT}
                >
                  <option value="">— none —</option>
                  {item.packs.sealed
                    .filter((g) => g.sealedCount > 0)
                    .map((g) => (
                      <option key={g.packSize} value={g.packSize}>
                        {g.packSize} {item.baseUnit} ({g.sealedCount} available)
                      </option>
                    ))}
                </select>
                <input
                  type="number"
                  min={1}
                  value={sealedCount}
                  onChange={(e) => setSealedCount(e.target.value)}
                  placeholder="how many"
                  className={INPUT}
                />
              </div>
            </fieldset>
          )}

          {isContinuous && !isStockIn ? (
            <fieldset className="space-y-2 rounded border border-zinc-200 p-3 dark:border-zinc-800">
              <legend className="px-1 text-sm text-zinc-600 dark:text-zinc-400">
                Cut lengths
              </legend>
              <p className="text-xs text-zinc-500 dark:text-zinc-500">
                Each piece must come from a single {item.packUnit ?? "pack"} —{" "}
                {item.baseUnit === "m" ? "wire is not joined" : "material is not joined"} to
                make up a length. Two 75 {item.baseUnit} runs often fit offcuts that one
                150 {item.baseUnit} run cannot.
              </p>
              {pieces.map((piece, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    value={piece.length || ""}
                    onChange={(e) => updatePiece(setPieces, i, { length: Number(e.target.value) })}
                    placeholder={`length in ${item.baseUnit}`}
                    className={INPUT}
                  />
                  <span className="text-sm text-zinc-500">×</span>
                  <input
                    type="number"
                    min={1}
                    value={piece.count || ""}
                    onChange={(e) => updatePiece(setPieces, i, { count: Number(e.target.value) })}
                    placeholder="pieces"
                    className={INPUT}
                  />
                  {pieces.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setPieces((p) => p.filter((_, j) => j !== i))}
                      className="px-2 text-sm text-zinc-500 hover:text-red-600"
                      aria-label="Remove piece"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => setPieces((p) => [...p, { length: 0, count: 1 }])}
                className={SECONDARY}
              >
                Add another length
              </button>
            </fieldset>
          ) : (
            <Labelled
              label={
                isStockIn && item.packUnit
                  ? `Loose ${item.baseUnit} received (outside any ${item.packUnit})`
                  : `Quantity (${item.baseUnit})`
              }
            >
              <input
                type="number"
                min={isStockIn ? 0 : 1}
                value={loose}
                onChange={(e) => setLoose(e.target.value)}
                className={INPUT}
              />
            </Labelled>
          )}

          {type === "RETURN" && (
            <Labelled
              label={`Of that, defective (${item.baseUnit}) — quarantined, not restocked`}
            >
              <input
                type="number"
                min={0}
                value={defectiveQty}
                onChange={(e) => setDefectiveQty(e.target.value)}
                className={INPUT}
              />
            </Labelled>
          )}

          {total > 0 && (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Total: {formatQuantity(item, total)}
              {plan?.errors.length ? (
                <span className="ml-2 text-red-700 dark:text-red-300">
                  · cannot be filled from stock
                </span>
              ) : plan?.opens.length ? (
                <span className="ml-2 text-amber-700 dark:text-amber-400">
                  · needs a sealed {item.packUnit ?? "pack"} opened
                </span>
              ) : null}
            </p>
          )}
        </>
      )}

      <Labelled label="Note (optional)">
        <input value={note} onChange={(e) => setNote(e.target.value)} className={INPUT} />
      </Labelled>

      <button type="submit" disabled={pending || !item || total <= 0} className={PRIMARY}>
        {pending ? "Recording…" : "Record transaction"}
      </button>
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

function Labelled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-sm text-zinc-600 dark:text-zinc-400">{label}</label>
      {children}
    </div>
  );
}
