"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recordMovement, type MovementInput } from "@/lib/actions/transactions";
import { type PackSnapshot } from "@/lib/allocation";
import { formatQuantity, piecesTotal, type Piece } from "@/lib/units";
import type { MeasureType } from "@/generated/prisma/enums";
import { Field, Input, Select } from "@/components/ui/Field";
import Button from "@/components/ui/Button";
import Alert from "@/components/ui/Alert";

/* -------------------------------------------------------------------------
 * Recording material coming BACK from a site. One movement, one item.
 *
 * This was the app's general-purpose movement form before dispatches and
 * deliveries existed, and it has been pruned twice as they took its work:
 *
 *   STOCK_IN went when deliveries got their own grid — incoming stock belongs
 *   to a Delivery record with a supplier and a challan reference.
 *
 *   ISSUE went on 2026-09-23, when Stock_Out (the dispatch batch) had clearly
 *   superseded it: that screen issues many lines at once, plans the cutting,
 *   asks before opening a sealed pack, and above all produces a CHALLAN. A
 *   single ISSUE written here carried no `dispatchId`, so it was a stock
 *   movement with no document behind it — the same gap that justified building
 *   the Transfer model. Issuing from here was a way to reintroduce it.
 *
 * `recordMovement` keeps both branches — still correct, still capability-gated,
 * and STOCK_IN/ISSUE rows are still written by deliveries.ts and dispatches.ts.
 * Only the UI options went.
 *
 * What is left is the one thing nothing else in the app does: RETURN is written
 * HERE AND NOWHERE ELSE. The site panel consumes, transfers and flags for
 * collection; none of those bring material home. A pickup flag is cleared by
 * the balance dropping, and a return is what drops it.
 * ---------------------------------------------------------------------- */

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

export default function TransactionForm({
  items,
  sites,
}: {
  items: FormItem[];
  sites: Site[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [itemId, setItemId] = useState("");
  const [itemQuery, setItemQuery] = useState("");
  const [siteId, setSiteId] = useState("");
  const [note, setNote] = useState("");

  const [sealedSize, setSealedSize] = useState("");
  const [sealedCount, setSealedCount] = useState("");
  const [loose, setLoose] = useState("");
  const [pieces, setPieces] = useState<Piece[]>([{ length: 0, count: 1 }]);
  const [defectiveQty, setDefectiveQty] = useState("");

  const [error, setError] = useState<string | null>(null);

  const item = items.find((i) => i.id === itemId) ?? null;
  const isContinuous = item?.measure === "CONTINUOUS";

  const request = useMemo(() => {
    const sealedPacks =
      sealedSize && Number(sealedCount) > 0
        ? [{ packSize: Number(sealedSize), count: Number(sealedCount) }]
        : [];
    return {
      sealedPacks,
      pieces: isContinuous ? pieces.filter((p) => p.length > 0 && p.count > 0) : [],
      loose: isContinuous ? 0 : Number(loose) || 0,
    };
  }, [sealedSize, sealedCount, pieces, loose, isContinuous]);

  const total =
    request.sealedPacks.reduce((s, p) => s + p.packSize * p.count, 0) +
    piecesTotal(request.pieces) +
    request.loose;

  // No allocation planning and no approve-an-open step: a return only ever
  // ADDS material to the store. Nothing is cut and no sealed pack is opened,
  // so there is nothing to plan and nothing to approve. The one thing the
  // server does refuse is a return larger than the site actually holds.
  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!item) return;
    setError(null);

    const input: MovementInput = {
      itemId: item.id,
      type: "RETURN",
      siteId,
      note,
      sealedPacks: request.sealedPacks,
      pieces: request.pieces,
      loose: request.loose,
      defectiveQty: Number(defectiveQty) || 0,
      approvedOpens: [],
    };

    startTransition(async () => {
      const result = await recordMovement(input);
      if (result.ok) {
        router.push(`/items/${item.id}`);
        router.refresh();
      } else {
        setError(result.message);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="max-w-lg space-y-4">
      {error && <Alert tone="danger">{error}</Alert>}

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

      <Field label="Returning from site">
        <Select value={siteId} onChange={(e) => setSiteId(e.target.value)} required>
          <option value="">Select a site…</option>
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </Field>

      {item && (
        <>
          {item.packUnit && item.packs.sealed.some((g) => g.sealedCount > 0) && (
            <fieldset className="space-y-2 rounded-card border border-line p-3.5">
              <legend className="px-1 text-sm font-semibold text-ink-muted">
                Whole sealed {item.packUnit}s — came back unopened
              </legend>
              <div className="flex gap-2">
                <Select value={sealedSize} onChange={(e) => setSealedSize(e.target.value)}>
                  <option value="">— none —</option>
                  {item.packs.sealed
                    .filter((g) => g.sealedCount > 0)
                    .map((g) => (
                      <option key={g.packSize} value={g.packSize}>
                        {g.packSize} {item.baseUnit}
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

          {isContinuous ? (
            <fieldset className="space-y-2 rounded-card border border-line p-3.5">
              <legend className="px-1 text-sm font-semibold text-ink-muted">
                Lengths coming back
              </legend>
              <p className="text-xs font-semibold text-ink-subtle">
                One row per offcut. Each comes back as its own piece rather than being added
                together, so a 40 {item.baseUnit} and a 60 {item.baseUnit} return as two usable
                offcuts, not one 100 {item.baseUnit} run that does not exist.
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
            <Field label={`Quantity (${item.baseUnit})`}>
              <Input
                type="number"
                min={1}
                inputMode="numeric"
                value={loose}
                onChange={(e) => setLoose(e.target.value)}
              />
            </Field>
          )}

          <Field label={`Of that, defective (${item.baseUnit}) — quarantined, not restocked`}>
            <Input
              type="number"
              min={0}
              inputMode="numeric"
              value={defectiveQty}
              onChange={(e) => setDefectiveQty(e.target.value)}
            />
          </Field>

          {total > 0 && (
            <p className="text-sm font-semibold text-ink-subtle">
              Total: {formatQuantity(item, total)}
            </p>
          )}
        </>
      )}

      <Field label="Note (optional)">
        <Input value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>

      <Button type="submit" disabled={pending || !item || total <= 0}>
        {pending ? "Recording…" : "Record return"}
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
