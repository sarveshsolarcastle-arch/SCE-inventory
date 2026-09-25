"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markDefective } from "@/lib/actions/defects";
import type { ApprovedOpens } from "@/lib/packs";
import { formatQuantity, piecesTotal, type Piece } from "@/lib/units";
import type { MeasureType } from "@/generated/prisma/enums";
import { Field, Input, Select } from "@/components/ui/Field";
import Button from "@/components/ui/Button";
import Alert from "@/components/ui/Alert";

/* -------------------------------------------------------------------------
 * Marking stock defective at any time — not only while issuing or returning.
 *
 * Three ways to say WHAT is defective, because an item's stock is held in three
 * shapes and each needs its own handle:
 *
 *   whole sealed packs   picked by size and count
 *   whole open packs     ticked individually. For wire, "the roll with 47 m
 *                        left" is a particular roll, so it is chosen, not planned
 *   a quantity           cut lengths (continuous) or a plain number (discrete),
 *                        drawn from stock by the same planner an issue uses
 *
 * All three may be combined in one submit. If a cut length can only be found by
 * opening a sealed pack, the server refuses first and says how many — the same
 * "yes, break open N packs" handshake dispatch uses — and nothing is written
 * until it is confirmed.
 * ---------------------------------------------------------------------- */

export type DefectFormItem = {
  id: string;
  name: string;
  sku: string;
  baseUnit: string;
  packUnit: string | null;
  measure: MeasureType;
  sealed: { packSize: number; sealedCount: number }[];
  open: { id: string; remaining: number }[];
};

type SealedRow = { key: number; size: string; count: string };

export default function MarkDefectiveForm({
  items,
  initialItemId,
}: {
  items: DefectFormItem[];
  initialItemId?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const initial = items.find((i) => i.id === initialItemId) ?? null;
  const [itemId, setItemId] = useState(initial?.id ?? "");
  const [itemQuery, setItemQuery] = useState(initial ? `${initial.name} (${initial.sku})` : "");
  const [sealedRows, setSealedRows] = useState<SealedRow[]>([{ key: 0, size: "", count: "" }]);
  const [openIds, setOpenIds] = useState<string[]>([]);
  const [pieces, setPieces] = useState<Piece[]>([{ length: 0, count: 1 }]);
  const [loose, setLoose] = useState("");
  const [note, setNote] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [opensNeeded, setOpensNeeded] = useState<ApprovedOpens | null>(null);

  const item = items.find((i) => i.id === itemId) ?? null;
  const isContinuous = item?.measure === "CONTINUOUS";
  const heldSizes = item?.sealed.filter((g) => g.sealedCount > 0) ?? [];

  const sealedPacks = sealedRows
    .filter((r) => Number(r.size) > 0 && Number(r.count) > 0)
    .map((r) => ({ packSize: Number(r.size), count: Number(r.count) }));
  const cleanPieces = isContinuous ? pieces.filter((p) => p.length > 0 && p.count > 0) : [];
  const looseQty = isContinuous ? 0 : Number(loose) || 0;
  const openTotal = (item?.open ?? [])
    .filter((p) => openIds.includes(p.id))
    .reduce((s, p) => s + p.remaining, 0);
  const total =
    sealedPacks.reduce((s, p) => s + p.packSize * p.count, 0) +
    piecesTotal(cleanPieces) +
    looseQty +
    openTotal;

  function resetSelection() {
    setSealedRows([{ key: 0, size: "", count: "" }]);
    setOpenIds([]);
    setPieces([{ length: 0, count: 1 }]);
    setLoose("");
    setOpensNeeded(null);
    setError(null);
  }

  function submit(approvedOpens: ApprovedOpens) {
    if (!item) return;
    setError(null);
    startTransition(async () => {
      const result = await markDefective({
        itemId: item.id,
        sealedPacks,
        pieces: cleanPieces,
        loose: looseQty,
        openPackIds: openIds,
        note,
        approvedOpens,
      });
      if (result.ok) {
        router.push("/defective");
        router.refresh();
      } else if (result.needsApproval) {
        setOpensNeeded(result.needsApproval);
      } else {
        setOpensNeeded(null);
        setError(result.message);
      }
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit([]);
      }}
      className="max-w-lg space-y-4"
    >
      {error && <Alert tone="danger">{error}</Alert>}

      <Field label="Item">
        <Input
          list="defect-items"
          value={itemQuery}
          onChange={(e) => {
            setItemQuery(e.target.value);
            const match = items.find((i) => `${i.name} (${i.sku})` === e.target.value);
            setItemId(match?.id ?? "");
            resetSelection();
          }}
          placeholder="Type to search…"
        />
        <datalist id="defect-items">
          {items.map((i) => (
            <option key={i.id} value={`${i.name} (${i.sku})`} />
          ))}
        </datalist>
      </Field>

      {item && (
        <>
          <p className="text-sm font-semibold text-ink-subtle">
            In stock: {formatQuantity(item, item.sealed.reduce((s, g) => s + g.packSize * g.sealedCount, 0) + item.open.reduce((s, p) => s + p.remaining, 0))}
          </p>

          {item.packUnit && heldSizes.length > 0 && (
            <fieldset className="space-y-2 rounded-card border border-line p-3.5">
              <legend className="px-1 text-sm font-semibold text-ink-muted">
                Whole sealed {item.packUnit}s that are defective
              </legend>
              {sealedRows.map((row) => (
                <div key={row.key} className="flex items-center gap-2">
                  <Select
                    value={row.size}
                    onChange={(e) =>
                      setSealedRows((rows) =>
                        rows.map((r) => (r.key === row.key ? { ...r, size: e.target.value } : r))
                      )
                    }
                  >
                    <option value="">Size…</option>
                    {heldSizes.map((g) => (
                      <option key={g.packSize} value={g.packSize}>
                        {g.packSize} {item.baseUnit} ({g.sealedCount} on the shelf)
                      </option>
                    ))}
                  </Select>
                  <span className="text-sm text-ink-subtle">×</span>
                  <Input
                    type="number"
                    min={1}
                    inputMode="numeric"
                    value={row.count}
                    onChange={(e) =>
                      setSealedRows((rows) =>
                        rows.map((r) => (r.key === row.key ? { ...r, count: e.target.value } : r))
                      )
                    }
                    placeholder={`how many ${item.packUnit}s`}
                  />
                  {sealedRows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setSealedRows((rows) => rows.filter((r) => r.key !== row.key))}
                      className="px-2 text-sm text-ink-subtle hover:text-danger-ink"
                      aria-label="Remove this size"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() =>
                  setSealedRows((rows) => [
                    ...rows,
                    { key: Math.max(...rows.map((r) => r.key)) + 1, size: "", count: "" },
                  ])
                }
              >
                Add another size
              </Button>
            </fieldset>
          )}

          {item.open.length > 0 && (
            <fieldset className="space-y-1.5 rounded-card border border-line p-3.5">
              <legend className="px-1 text-sm font-semibold text-ink-muted">
                Open packs that are defective all the way through
              </legend>
              {item.open.map((p) => (
                <label key={p.id} className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <input
                    type="checkbox"
                    checked={openIds.includes(p.id)}
                    onChange={(e) =>
                      setOpenIds((ids) =>
                        e.target.checked ? [...ids, p.id] : ids.filter((id) => id !== p.id)
                      )
                    }
                  />
                  {p.remaining} {item.baseUnit} left
                </label>
              ))}
            </fieldset>
          )}

          {isContinuous ? (
            <fieldset className="space-y-2 rounded-card border border-line p-3.5">
              <legend className="px-1 text-sm font-semibold text-ink-muted">
                Cut lengths that are defective
              </legend>
              <p className="text-xs font-semibold text-ink-subtle">
                Taken from stock the same way an issue is — from one pack each. Leave blank if it is
                whole packs above.
              </p>
              {pieces.map((piece, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    inputMode="numeric"
                    value={piece.length || ""}
                    onChange={(e) =>
                      setPieces((ps) => ps.map((p, j) => (j === i ? { ...p, length: Number(e.target.value) } : p)))
                    }
                    placeholder={`length in ${item.baseUnit}`}
                  />
                  <span className="text-sm text-ink-subtle">×</span>
                  <Input
                    type="number"
                    min={1}
                    inputMode="numeric"
                    value={piece.count || ""}
                    onChange={(e) =>
                      setPieces((ps) => ps.map((p, j) => (j === i ? { ...p, count: Number(e.target.value) } : p)))
                    }
                    placeholder="pieces"
                  />
                  {pieces.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setPieces((ps) => ps.filter((_, j) => j !== i))}
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
                variant="secondary"
                size="sm"
                onClick={() => setPieces((ps) => [...ps, { length: 0, count: 1 }])}
              >
                Add another length
              </Button>
            </fieldset>
          ) : (
            <Field label={`Loose quantity (${item.baseUnit}) that is defective`}>
              <Input
                type="number"
                min={0}
                inputMode="numeric"
                value={loose}
                onChange={(e) => setLoose(e.target.value)}
              />
            </Field>
          )}

          {total > 0 && (
            <p className="text-sm font-semibold text-ink-subtle">
              Marking {formatQuantity(item, total)} defective — it leaves stock now.
            </p>
          )}
        </>
      )}

      <Field label="What is wrong with it (optional)">
        <Input value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>

      {opensNeeded && (
        <Alert tone="warn">
          <p>
            To get that quantity, {opensNeeded.map((o) => `${o.count} sealed ${o.packSize} ${item?.baseUnit ?? ""} pack${o.count === 1 ? "" : "s"}`).join(" and ")}{" "}
            must be opened. The rest of each stays on the shelf as an open pack.
          </p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="mt-2"
            disabled={pending}
            onClick={() => submit(opensNeeded)}
          >
            {pending ? "Recording…" : "Open and mark defective"}
          </Button>
        </Alert>
      )}

      <Button type="submit" disabled={pending || !item || total <= 0 || !!opensNeeded}>
        {pending ? "Recording…" : "Mark defective"}
      </Button>
    </form>
  );
}
