import type { Item, Transaction } from "@/generated/prisma/client";
import { describeMovement } from "@/lib/units";
import { COMPANY, companyContactLines } from "@/lib/company";

/* -------------------------------------------------------------------------
 * The printable Material Delivery Challan sheet itself — same layout, same
 * boxes, whether the movement behind it is a Dispatch or a direct-to-site
 * Delivery. Extracted so the two routes render one document rather than
 * hand-maintaining two copies of a legal record that would drift apart.
 *
 * Pure presentation: it reads nothing and writes nothing. Each route does its
 * own guard, its own data fetch, and its own "Nothing to print" refusal, then
 * hands this component a plain props object.
 * ---------------------------------------------------------------------- */

/** A ruled line to write on, for a name nobody recorded before printing. */
function Blank({ label }: { label: string }) {
  return (
    <div className="flex items-baseline gap-2 leading-tight">
      <span className="shrink-0 text-xs font-semibold text-ink-muted">{label}</span>
      <span className="min-w-24 flex-1 border-b border-dotted border-ink-subtle" />
    </div>
  );
}

/** A recorded value, or a ruled line when there is none. Every field on this
 * sheet goes through here so an unset value can never print as "null" — and so
 * a blank is always writable rather than silently absent. */
function FilledOrBlank({ label, value }: { label: string; value: string | null | undefined }) {
  const text = value?.trim();
  if (!text) return <Blank label={label} />;
  return (
    <div className="flex items-baseline gap-2 leading-tight">
      <span className="shrink-0 text-xs font-semibold text-ink-muted">{label}</span>
      <span className="text-xs font-semibold whitespace-pre-line text-ink">{text}</span>
    </div>
  );
}

/** Only what this sheet actually reads. Narrowed from `Transaction` because
 * the site material statement's lines are aggregates, not real Transaction
 * rows — structurally satisfied by the real ones the dispatch and delivery
 * challan routes already pass, so neither of them changes. */
export type ChallanLine = Pick<
  Transaction,
  "id" | "quantity" | "packSize" | "packCount" | "pieces" | "note"
> & { item: Item };

export type ChallanSheetProps = {
  /** Printed in the navy header bar. Defaults to "Delivery Challan"; the site
   * material statement overrides it — that document is a dated snapshot, not
   * a record of a delivery, and titling it as one would misrepresent it. */
  title?: string;
  /** Heading over the party block. Defaults to "Delivery Challan For" — the
   * material statement overrides this too, for the same reason as `title`:
   * changing the banner alone still left this section calling itself a
   * delivery challan. The transfer challan overrides it to "Transfer From",
   * because there `party` is not a customer at all — see `shipToHeading`. */
  partyHeading?: string;
  /** Heading over the shipTo block. Defaults to "Shipping To" — the transfer
   * challan overrides it to "Transfer To". A Dispatch/Delivery/Statement
   * always names the SAME site's customer as `party` and that site itself as
   * `shipTo`, so the two can never disagree. A Transfer has no single
   * customer: material moves site → site, each of which may belong to a
   * different customer entirely, so `party`/`shipTo` here are the origin and
   * destination sites themselves, never a customer name. */
  shipToHeading?: string;
  /** Whether to print the Received By / Delivered By signature blocks.
   * Defaults to true. The material statement sets it false: a live snapshot
   * has no delivery to sign for, and printing ruled Date/Signature lines next
   * to those headings on a document titled anything else invites exactly the
   * confusion the title/partyHeading overrides exist to avoid — a customer
   * signing it as though it were a delivery record. */
  showSignatures?: boolean;
  /** Label over `challanNo`. Defaults to "Challan No." — the material
   * statement overrides it to "Reference No.", since its own header comment
   * says outright that it "is not one": `challanNo` there carries a
   * deterministic date-based reference, not an allocated challan number, and
   * labelling it "Challan No." would misstate that on the printed page
   * itself, the same misstatement the title/partyHeading overrides exist to
   * avoid elsewhere on this sheet. */
  documentNoLabel?: string;
  /** Whether to print "Delivery time" and "Their ref." in the details strip.
   * Defaults to true. The material statement sets it false: it is a snapshot
   * of a balance, not a record of a delivery, so there is no delivery time to
   * write down and no other party's document to reference. */
  showDeliveryDetails?: boolean;
  challanNo: string;
  date: Date;
  party: { name: string; address: string | null; projectCode: string | null };
  shipTo: { name: string; address: string | null };
  lines: ChallanLine[];
  issuedBy: string;
  /** The OTHER party's document number, if their paperwork has one. */
  reference: string | null;
  deliveredBy: string | null;
  receivedBy: string | null;
  note: string | null;
  /** Direct-to-site deliveries only — printed as an extra details-strip line
   * so the two document kinds still read as "everything else identical". */
  supplier?: string | null;
};

export default function ChallanSheet({
  title = "Delivery Challan",
  partyHeading = "Delivery Challan For",
  shipToHeading = "Shipping To",
  showSignatures = true,
  documentNoLabel = "Challan No.",
  showDeliveryDetails = true,
  challanNo,
  date,
  party,
  shipTo,
  lines,
  issuedBy,
  reference,
  deliveredBy,
  receivedBy,
  note,
  supplier,
}: ChallanSheetProps) {
  // A total across mixed units would be a nonsense number — 3 rolls of wire in
  // metres plus 12 screws in pieces is not 15 of anything. Sum only when every
  // line is counted in the same unit, and say nothing otherwise.
  const units = new Set(lines.map((t) => t.item.baseUnit));
  const total = units.size === 1 ? lines.reduce((sum, t) => sum + t.quantity, 0) : null;

  const contact = companyContactLines();

  return (
    <article className="challan-sheet mx-auto w-full max-w-3xl overflow-hidden border border-ink-subtle bg-surface text-ink">
      <h1 className="challan-navy-bar py-3 text-center text-xl font-bold tracking-wide">
        {title}
      </h1>

      <div className="grid gap-4 border-b border-ink-subtle p-4 pb-2 sm:grid-cols-[1fr_auto]">
        <header>
          <p className="text-base font-bold">{COMPANY.name}</p>
          {COMPANY.addressLines.map((line) => (
            <p key={line} className="text-xs leading-snug font-semibold text-ink-muted">
              {line}
            </p>
          ))}
          {contact.map((line) => (
            <p key={line.label} className="text-xs leading-snug text-ink-muted">
              <span className="font-medium">{line.label}:</span> {line.value}
            </p>
          ))}
        </header>

        {/* eslint-disable-next-line @next/next/no-img-element -- a plain
            <img> prints exactly as served; next/image's optimization pass
            buys nothing for a fixed local file and only adds risk to the
            one path that has to work on paper. */}
        <img
          src="/logo.png"
          alt={COMPANY.name}
          className="h-16 w-28 shrink-0 rounded border border-ink-subtle object-contain p-1"
        />
      </div>

      <div className="mb-2 grid gap-4 px-4 pt-2 sm:grid-cols-2">
        <section className="space-y-0.5">
          <h2 className="text-xs font-bold tracking-wide uppercase">{partyHeading}</h2>
          <FilledOrBlank label="Party Name" value={party.name} />
          <FilledOrBlank label="Address" value={party.address} />
          <FilledOrBlank label="Project ID" value={party.projectCode} />
          {/* Phone / Email / GSTIN are not yet fields on Site — printed as
              ruled blanks, same as Received By's Date/Signature, so the
              sheet still carries a line for whoever fills them in by hand. */}
          <Blank label="Phone No." />
          <Blank label="Email" />
          <Blank label="GSTIN" />
        </section>

        <section className="space-y-0.5">
          <h2 className="text-xs font-bold tracking-wide uppercase">{shipToHeading}</h2>
          <FilledOrBlank label="Shipping Name" value={shipTo.name} />
          <FilledOrBlank label="Address" value={shipTo.address} />
          <Blank label="Phone No." />
          <Blank label="Email" />
          <Blank label="GSTIN" />
        </section>
      </div>

      <div className="mb-2 grid gap-4 border-y border-ink-subtle px-4 py-1.5 sm:grid-cols-2">
        <div className="space-y-0.5">
          <FilledOrBlank label={documentNoLabel} value={challanNo} />
          <FilledOrBlank label="Date" value={date.toLocaleDateString("en-GB")} />
          {supplier !== undefined && <FilledOrBlank label="Supplier" value={supplier} />}
        </div>
        <div className="space-y-0.5">
          {showDeliveryDetails && <Blank label="Delivery time" />}
          {showDeliveryDetails && <FilledOrBlank label="Their ref." value={reference} />}
          <FilledOrBlank label="Issued by" value={issuedBy} />
        </div>
      </div>

      <div className="overflow-x-auto px-4">
        <table className="challan-table w-full border-collapse text-xs">
          <thead>
            <tr className="challan-navy-bar">
              <th className="border border-ink-subtle px-1.5 py-0.5 text-left font-bold">Sr No.</th>
              <th className="border border-ink-subtle px-1.5 py-0.5 text-left font-bold">Item Name</th>
              <th className="border border-ink-subtle px-1.5 py-0.5 text-left font-bold">Description</th>
              <th className="border border-ink-subtle px-1.5 py-0.5 text-left font-bold">Specification</th>
              <th className="border border-ink-subtle px-1.5 py-0.5 text-right font-bold">Qty</th>
              <th className="border border-ink-subtle px-1.5 py-0.5 text-left font-bold">Unit</th>
              <th className="border border-ink-subtle px-1.5 py-0.5 text-left font-bold">Remarks</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((t, i) => (
              <tr key={t.id}>
                <td className="border border-ink-subtle px-1.5 py-0.5 text-center">{i + 1}</td>
                <td className="border border-ink-subtle px-1.5 py-0.5 font-semibold">
                  {t.item.name}
                </td>
                {/* describeMovement is how every quantity in this app is
                    rendered — it spells out "2 × 400 m rolls + 30 m" rather
                    than a bare base-unit total, which is what someone
                    checking the load against the paper actually counts. Its
                    own column, rather than stacked under the item name, is
                    what keeps each row to one line so ~30 lines fit a page. */}
                <td className="border border-ink-subtle px-1.5 py-0.5">
                  {describeMovement(t.item, t)}
                </td>
                <td className="border border-ink-subtle px-1.5 py-0.5 text-ink-muted">
                  {[t.item.sku, t.item.category].filter(Boolean).join(" · ")}
                </td>
                <td className="border border-ink-subtle px-1.5 py-0.5 text-right font-mono">
                  {t.quantity}
                </td>
                <td className="border border-ink-subtle px-1.5 py-0.5">{t.item.baseUnit}</td>
                <td className="border border-ink-subtle px-1.5 py-0.5">{t.note ?? ""}</td>
              </tr>
            ))}
            {total !== null && (
              <tr className="challan-total-row">
                <td className="border border-ink-subtle px-1.5 py-0.5 text-right font-bold" colSpan={4}>
                  Total
                </td>
                <td className="border border-ink-subtle px-1.5 py-0.5 text-right font-mono font-bold">
                  {total}
                </td>
                <td className="border border-ink-subtle px-1.5 py-0.5">{[...units][0]}</td>
                <td className="border border-ink-subtle px-1.5 py-0.5" />
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="px-4 pb-3">
        {total === null && (
          <p className="mt-1 text-xs font-semibold text-ink-muted">
            No total: these lines are counted in different units ({[...units].join(", ")}).
          </p>
        )}

        {note && <p className="mt-1 text-xs font-semibold text-ink-muted">Note: {note}</p>}
      </div>

      {showSignatures && (
        <>
          {/* The navy dividers below have no content of their own — they
              exist only to bracket the signature blocks on paper, matching
              the ruled bars on the source template. */}
          <div className="challan-navy-bar h-2" />
          <div className="challan-signatures grid gap-8 px-4 py-2 sm:grid-cols-2">
            <section className="space-y-1">
              <h2 className="text-xs font-bold tracking-wide uppercase">Received By</h2>
              <FilledOrBlank label="Name" value={receivedBy} />
              <Blank label="Comment" />
              {/* Date and Signature are ALWAYS blank: they are the acts of
                  receiving, which happen after this sheet is printed. */}
              <Blank label="Date" />
              <Blank label="Signature" />
            </section>

            <section className="space-y-1">
              <h2 className="text-xs font-bold tracking-wide uppercase">Delivered By</h2>
              <FilledOrBlank label="Name" value={deliveredBy} />
              <Blank label="Comment" />
              <Blank label="Date" />
              <Blank label="Signature" />
            </section>
          </div>
          <div className="challan-navy-bar h-2" />
        </>
      )}
    </article>
  );
}
