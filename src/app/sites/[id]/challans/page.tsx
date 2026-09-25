import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { can, currentUser, requireCapability } from "@/lib/permissions";
import { formatChallanNo, formatSiteChallanNo, formatTransferChallanNo } from "@/lib/challan";
import { parseDateFilter } from "@/lib/dateFilter";
import PageHeader from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { TableWrap, Table, THead, Th, Tr, Td } from "@/components/ui/Table";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import FilterPills from "@/components/ui/FilterPills";
import { Field, Input } from "@/components/ui/Field";
import Button, { buttonClasses } from "@/components/ui/Button";
import type { BadgeTone } from "@/components/ui/tones";

/* -------------------------------------------------------------------------
 * Every printable challan that concerns one site, in one place: dispatches
 * from the store, direct-to-site deliveries, and transfers in and out.
 *
 * Reached only from a button on the site's own page — it is deliberately not
 * in the sidebar, because it means nothing without a site. Read-only: it
 * lists and links to the existing challan routes, which stay the single place
 * each document is actually rendered.
 *
 * The kind filter is a const map + type guard for the same reason the ledger's
 * is: an unvalidated `?kind=` should fall back to "all", not misbehave.
 * ---------------------------------------------------------------------- */

const KINDS = {
  dispatch: "From store",
  direct: "Direct to site",
  in: "Transfers in",
  out: "Transfers out",
} as const;
type Kind = keyof typeof KINDS;

function isKind(v: string | undefined): v is Kind {
  return !!v && v in KINDS;
}

const KIND_TONE: Record<Kind, BadgeTone> = {
  dispatch: "info",
  direct: "ok",
  in: "special",
  out: "warn",
};

type Entry = {
  key: string;
  kind: Kind;
  challanNo: string;
  date: Date;
  detailHref: string;
  printHref: string;
  /** Where it came from / went to, for the two kinds that have another end. */
  other: string | null;
  lines: number;
  /** Every line reversed — nothing left to sign for, so nothing to print. */
  reversed: boolean;
};

export default async function SiteChallansPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ kind?: string; from?: string; to?: string }>;
}) {
  const { id } = await params;
  const { kind: rawKind, from, to } = await searchParams;

  // Checked here, not left to proxy.ts — same as the challan routes this page
  // links to: a list of the client's stock movements needs ledger:view.
  await requireCapability("ledger:view");

  const [site, user] = await Promise.all([
    prisma.site.findUnique({ where: { id } }),
    currentUser(),
  ]);
  if (!site) notFound();

  const kind = isKind(rawKind) ? rawKind : undefined;

  // A malformed ?from=/?to= must not reach Prisma as an Invalid Date.
  const fromDate = parseDateFilter(from, false);
  const toDate = parseDateFilter(to, true);
  const within = (field: string) =>
    fromDate || toDate
      ? { [field]: { ...(fromDate ? { gte: fromDate } : {}), ...(toDate ? { lte: toDate } : {}) } }
      : {};

  const [dispatches, deliveries, transfers] = await Promise.all([
    !kind || kind === "dispatch"
      ? prisma.dispatch.findMany({
          where: { siteId: id, ...within("dispatchedAt") },
          include: { transactions: { where: { type: "ISSUE" }, select: { reversedAt: true } } },
        })
      : [],
    // challanNo is null on a store delivery — those are goods inward, with no
    // challan to print, and siteChallanOf refuses them on the print route.
    !kind || kind === "direct"
      ? prisma.delivery.findMany({
          where: { siteId: id, challanNo: { not: null }, ...within("receivedAt") },
          include: {
            transactions: { where: { type: "ISSUE" }, select: { reversedAt: true } },
            lines: { select: { id: true } },
          },
        })
      : [],
    !kind || kind === "in" || kind === "out"
      ? prisma.transfer.findMany({
          where: {
            OR: [
              ...(!kind || kind === "in" ? [{ toSiteId: id }] : []),
              ...(!kind || kind === "out" ? [{ fromSiteId: id }] : []),
            ],
            ...within("transferredAt"),
          },
          include: {
            fromSite: true,
            toSite: true,
            transactions: { where: { type: "TRANSFER" }, select: { reversedAt: true } },
          },
        })
      : [],
  ]);

  const allReversed = (txs: { reversedAt: Date | null }[]) =>
    txs.length > 0 && txs.every((t) => t.reversedAt);

  const entries: Entry[] = [
    ...dispatches.map((d): Entry => ({
      key: `d-${d.id}`,
      kind: "dispatch",
      challanNo: formatChallanNo(d.challanNo),
      date: d.dispatchedAt,
      detailHref: `/dispatches/${d.id}`,
      printHref: `/dispatches/${d.id}/challan`,
      other: null,
      lines: d.transactions.length,
      reversed: allReversed(d.transactions),
    })),
    ...deliveries.map((d): Entry => ({
      key: `v-${d.id}`,
      kind: "direct",
      challanNo: formatSiteChallanNo(d.challanNo as number),
      date: d.receivedAt,
      detailHref: `/deliveries/${d.id}`,
      printHref: `/deliveries/${d.id}/challan`,
      other: d.supplier ? `Supplier: ${d.supplier}` : null,
      // Typed lines (paper challan) or ledger rows (older) — never both, and
      // a paper challan has nothing to reverse.
      lines: d.lines.length + d.transactions.length,
      reversed: d.lines.length === 0 && allReversed(d.transactions),
    })),
    // A transfer is one document seen from two sides — "in" when this site is
    // the destination, "out" when it is the origin.
    ...transfers.map((t): Entry => {
      const incoming = t.toSiteId === id;
      return {
        key: `t-${t.id}`,
        kind: incoming ? "in" : "out",
        challanNo: formatTransferChallanNo(t.challanNo),
        date: t.transferredAt,
        detailHref: `/transfers/${t.id}`,
        printHref: `/transfers/${t.id}/challan`,
        other: incoming ? `From ${t.fromSite.name}` : `To ${t.toSite.name}`,
        lines: t.transactions.length,
        reversed: allReversed(t.transactions),
      };
    }),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  function hrefFor(overrides: Record<string, string | undefined>): string {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries({ kind, from, to, ...overrides })) {
      if (v) params.set(k, v);
    }
    const qs = params.toString();
    return qs ? `/sites/${id}/challans?${qs}` : `/sites/${id}/challans`;
  }

  const pillOptions = [
    { value: "ALL", label: "All", href: hrefFor({ kind: undefined }) },
    ...(Object.keys(KINDS) as Kind[]).map((k) => ({
      value: k,
      label: KINDS[k],
      href: hrefFor({ kind: k }),
    })),
  ];

  const filtered = !!(kind || from || to);

  return (
    <div className="space-y-4">
      <PageHeader
        title={`${site.name} — challans`}
        subtitle={`${entries.length} challan${entries.length === 1 ? "" : "s"}${filtered ? " match these filters" : ""}`}
        actions={
          <>
            {can(user?.role, "delivery:record") && (
              <Link href={`/site-deliveries/new?site=${id}`} className={buttonClasses("primary")}>
                New site delivery challan
              </Link>
            )}
            <Link href={`/sites/${id}`} className={buttonClasses("secondary")}>
              Back to site
            </Link>
          </>
        }
      />

      <FilterPills active={kind ?? "ALL"} options={pillOptions} />

      <form className="flex flex-wrap items-end gap-2" action={`/sites/${id}/challans`}>
        {kind && <input type="hidden" name="kind" value={kind} />}
        <Field label="From" className="w-auto">
          <Input type="date" name="from" defaultValue={from ?? ""} className="w-auto" />
        </Field>
        <Field label="To" className="w-auto">
          <Input type="date" name="to" defaultValue={to ?? ""} className="w-auto" />
        </Field>
        <Button type="submit" variant="secondary" size="md">
          Apply
        </Button>
        {(from || to) && (
          <Link href={hrefFor({ from: undefined, to: undefined })} className={buttonClasses("secondary")}>
            Clear dates
          </Link>
        )}
      </form>

      <Card>
        <TableWrap>
          <Table>
            <THead>
              <tr>
                <Th>Challan No.</Th>
                <Th>Type</Th>
                <Th>Date</Th>
                <Th>Detail</Th>
                <Th>Lines</Th>
                <Th>Challan</Th>
              </tr>
            </THead>
            <tbody>
              {entries.map((e) => (
                <Tr key={e.key}>
                  <Td>
                    <Link href={e.detailHref} className="font-bold text-ink hover:text-accent">
                      {e.challanNo}
                    </Link>
                  </Td>
                  <Td>
                    <Badge tone={KIND_TONE[e.kind]}>{KINDS[e.kind]}</Badge>
                  </Td>
                  <Td className="text-ink-subtle">{e.date.toLocaleDateString()}</Td>
                  <Td className="text-ink-subtle">{e.other ?? ""}</Td>
                  <Td className="text-ink-subtle">{e.lines}</Td>
                  <Td>
                    {e.reversed ? (
                      <Badge tone="neutral">Reversed</Badge>
                    ) : (
                      <Link
                        href={e.printHref}
                        className="text-xs font-semibold text-accent hover:text-accent-hover"
                      >
                        Print
                      </Link>
                    )}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
        {entries.length === 0 && (
          <EmptyState>
            {filtered ? "No challans match these filters." : "No challans have been issued for this site yet."}
          </EmptyState>
        )}
      </Card>
    </div>
  );
}
