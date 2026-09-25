"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { recordSiteChallan } from "@/lib/actions/siteChallans";
import { matchItem, type MatchableItem } from "@/lib/matching";
import { parseDeliveryPaste } from "@/lib/deliveryPaste";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import Button from "@/components/ui/Button";
import Alert from "@/components/ui/Alert";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import { ClipboardPaste, FileText, ListPlus, MapPin } from "lucide-react";

/* -------------------------------------------------------------------------
 * The paper-only site delivery challan form. Nothing typed here is checked
 * against the item list — the item list is consulted for ONE reason only: to
 * warn when a line looks like a registered item, because registered stock
 * should be dispatched through Stock_Out so it stays tracked. The warning
 * interrupts once and never blocks: "Record anyway" always goes through.
 * ---------------------------------------------------------------------- */

type Site = { id: string; name: string };

type Row = {
  key: number;
  name: string;
  description: string;
  quantity: string;
  unit: string;
  remark: string;
};

let keyCounter = 0;
function blankRow(): Row {
  keyCounter += 1;
  return { key: keyCounter, name: "", description: "", quantity: "", unit: "pcs", remark: "" };
}

type Hit = { rowKey: number; typed: string; registered: string; exact: boolean };

function today(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export default function SiteChallanForm({
  items,
  sites,
  defaultSiteId,
}: {
  items: MatchableItem[];
  sites: Site[];
  defaultSiteId?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [siteId, setSiteId] = useState(
    defaultSiteId && sites.some((s) => s.id === defaultSiteId) ? defaultSiteId : ""
  );
  const [date, setDate] = useState(today);
  const [supplier, setSupplier] = useState("");
  const [reference, setReference] = useState("");
  const [deliveredBy, setDeliveredBy] = useState("");
  const [receivedBy, setReceivedBy] = useState("");
  const [note, setNote] = useState("");
  const [rows, setRows] = useState<Row[]>(() => [blankRow(), blankRow(), blankRow()]);
  const [pasteText, setPasteText] = useState("");
  const [error, setError] = useState<string | null>(null);
  // The set of matched names the person has already seen and accepted. If
  // they edit a line so a NEW match appears, the key changes and they are
  // told again — one acknowledgement must not cover a later, different match.
  const [acknowledged, setAcknowledged] = useState<string | null>(null);
  const [prompting, setPrompting] = useState(false);

  function update(key: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  /** One line per row, name first. A plain number is the quantity; "2 x 400"
   * is read the way the store delivery form always read it and becomes a
   * quantity of 800 with the expression kept as the description. */
  function handleParse() {
    const parsed = parseDeliveryPaste(pasteText);
    if (!parsed.length) return;
    const fresh = parsed.map((p): Row => {
      const packed = p.packCount != null && p.packSize != null ? p.packCount * p.packSize : null;
      const quantity = p.loose ?? packed;
      return {
        ...blankRow(),
        name: p.name,
        description: packed != null ? p.quantityText : "",
        quantity: quantity != null ? String(quantity) : "",
      };
    });
    // The still-empty starting rows drop out; the grid grows to fit the paste.
    setRows((prev) => [
      ...prev.filter((r) => r.name.trim() || r.description.trim() || r.quantity.trim()),
      ...fresh,
    ]);
    setPasteText("");
  }

  const active = rows.filter(
    (r) => r.name.trim() || r.description.trim() || r.quantity.trim() || r.remark.trim()
  );

  const hits = useMemo<Hit[]>(() => {
    const out: Hit[] = [];
    for (const r of rows) {
      const typed = r.name.trim();
      if (!typed) continue;
      const m = matchItem(typed, items);
      if (m.status === "unmatched") continue;
      const found =
        m.status === "ambiguous"
          ? items.find((i) => i.id === m.candidates[0].itemId)
          : items.find((i) => i.id === m.itemId);
      if (found) out.push({ rowKey: r.key, typed, registered: found.name, exact: m.status === "exact" });
    }
    return out;
  }, [rows, items]);

  const hitByRow = new Map(hits.map((h) => [h.rowKey, h]));
  const hitKey = hits.map((h) => `${h.typed}→${h.registered}`).join("|");

  function submit() {
    setError(null);
    setPrompting(false);
    startTransition(async () => {
      const result = await recordSiteChallan({
        siteId,
        date,
        supplier,
        reference,
        note,
        deliveredBy,
        receivedBy,
        lines: active.map((r) => ({
          name: r.name,
          description: r.description,
          quantity: Number(r.quantity),
          unit: r.unit,
          remark: r.remark,
        })),
      });
      if (result.ok) {
        router.push(`/deliveries/${result.deliveryId}`);
        router.refresh();
        return;
      }
      setError(result.message);
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending || !siteId || active.length === 0) return;
    // The interruption: registered-looking items and this person has not yet
    // seen (and accepted) exactly this set. Stops here once, then "Record
    // anyway" carries on — it never refuses.
    if (hits.length > 0 && acknowledged !== hitKey) {
      setPrompting(true);
      return;
    }
    submit();
  }

  function recordAnyway() {
    setAcknowledged(hitKey);
    submit();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && <Alert tone="danger">{error}</Alert>}

      <Card>
        <CardHeader>
          <CardTitle icon={<MapPin className="h-3.5 w-3.5" />} tone="info">
            Delivered to
          </CardTitle>
        </CardHeader>
        <CardBody>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Site">
              <Select value={siteId} onChange={(e) => setSiteId(e.target.value)} required>
                <option value="">Choose a site…</option>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Challan date">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
          </div>
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
            placeholder={"Wire 2.5mm\t800\nScrews M4\t60"}
            className="font-mono"
          />
          <p className="text-xs font-semibold text-ink-subtle">
            One item per line, name first; extra columns are ignored. Units are left as pcs — set
            them on each row after pasting.
          </p>
          <Button
            type="button"
            variant="secondary"
            onClick={handleParse}
            disabled={!pasteText.trim()}
          >
            Parse into rows
          </Button>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle icon={<ListPlus className="h-3.5 w-3.5" />} tone="special">
            Lines
          </CardTitle>
          <span className="text-xs font-semibold text-ink-subtle">
            Type anything — nothing here is added to the item list or to stock
          </span>
        </CardHeader>
        <CardBody className="space-y-4">
          {rows.map((r, i) => {
            const hit = hitByRow.get(r.key);
            return (
              <div key={r.key} className="space-y-1.5">
                <div className="grid gap-2 sm:grid-cols-[1.4fr_1.4fr_5rem_5rem_1fr]">
                  <Field label={i === 0 ? "Item name" : ""}>
                    <Input
                      value={r.name}
                      onChange={(e) => update(r.key, { name: e.target.value })}
                    />
                  </Field>
                  <Field label={i === 0 ? "Description" : ""}>
                    <Input
                      value={r.description}
                      onChange={(e) => update(r.key, { description: e.target.value })}
                    />
                  </Field>
                  <Field label={i === 0 ? "Qty" : ""}>
                    <Input
                      type="number"
                      min="0"
                      step="any"
                      value={r.quantity}
                      onChange={(e) => update(r.key, { quantity: e.target.value })}
                    />
                  </Field>
                  <Field label={i === 0 ? "Unit" : ""}>
                    <Input value={r.unit} onChange={(e) => update(r.key, { unit: e.target.value })} />
                  </Field>
                  <Field label={i === 0 ? "Remarks" : ""}>
                    <Input
                      value={r.remark}
                      onChange={(e) => update(r.key, { remark: e.target.value })}
                    />
                  </Field>
                </div>
                {hit && (
                  <p className="text-xs font-semibold text-warn-ink">
                    {hit.exact ? "Matches" : "Looks like"} the registered item “{hit.registered}”.
                    Registered items should go through Stock_Out so they stay tracked.
                  </p>
                )}
              </div>
            );
          })}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setRows((prev) => [...prev, blankRow()])}
          >
            Add another line
          </Button>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle icon={<FileText className="h-3.5 w-3.5" />} tone="info">
            Challan details
          </CardTitle>
          <span className="text-xs font-semibold text-ink-subtle">All optional</span>
        </CardHeader>
        <CardBody>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Supplier">
              <Input value={supplier} onChange={(e) => setSupplier(e.target.value)} />
            </Field>
            <Field label="Their challan / invoice no.">
              <Input value={reference} onChange={(e) => setReference(e.target.value)} />
            </Field>
            <Field label="Delivered by">
              <Input value={deliveredBy} onChange={(e) => setDeliveredBy(e.target.value)} />
            </Field>
            <Field label="Received by">
              <Input value={receivedBy} onChange={(e) => setReceivedBy(e.target.value)} />
            </Field>
          </div>
          <div className="mt-3">
            <Field label="Note">
              <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
          </div>
        </CardBody>
      </Card>

      {prompting && hits.length > 0 && (
        <Alert tone="warn">
          <p className="font-bold">
            {hits.length === 1
              ? "One line matches an item in your item list"
              : `${hits.length} lines match items in your item list`}
          </p>
          <ul className="mt-1 list-disc pl-5">
            {hits.map((h) => (
              <li key={h.rowKey}>
                “{h.typed}” — {h.exact ? "matches" : "looks like"} {h.registered}
              </li>
            ))}
          </ul>
          <p className="mt-2">
            A challan made here is paper only: it does not move or track any stock. If these are
            registered items you hold in the store, dispatch them with{" "}
            <Link href="/dispatches/new" className="font-bold underline">
              Stock_Out
            </Link>{" "}
            instead. If they are not the same thing, record it as it is.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setPrompting(false)}>
              Go back and edit
            </Button>
            <Button type="button" size="sm" onClick={recordAnyway} disabled={pending}>
              Record anyway
            </Button>
          </div>
        </Alert>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending || !siteId || active.length === 0}>
          {pending ? "Recording…" : "Record Site Delivery"}
        </Button>
        <span className="text-xs font-semibold text-ink-subtle">
          Paper challan only — stock and site materials are unchanged
        </span>
      </div>
    </form>
  );
}
