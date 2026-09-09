import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireCapability } from "@/lib/permissions";
import { describeMovement } from "@/lib/units";
import { formatChallanNo, formatSiteChallanNo, formatTransferChallanNo } from "@/lib/challan";
import { parsePage, pageArgs, clampPage } from "@/lib/pagination";
import { parseDateFilter } from "@/lib/dateFilter";
import PageHeader from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { TableWrap, Table, THead, Th, Tr, Td } from "@/components/ui/Table";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import FilterPills from "@/components/ui/FilterPills";
import SearchBar from "@/components/ui/SearchBar";
import { Field, Input } from "@/components/ui/Field";
import Button from "@/components/ui/Button";
import Pager from "@/components/ui/Pager";
import { TRANSACTION_TYPE_TONE } from "@/components/ui/tones";
import type { Prisma } from "@/generated/prisma/client";

/** Groups of TransactionType the pills filter by. PACK_OPS folds OPEN_PACK and
 * SCRAP into one pill — neither moves stock in a way worth its own button.
 * A const map + type guard, exactly like SORT_FIELDS / isSortKey on the items
 * page: an unvalidated `?type=` reaching Prisma's enum filter throws a 500. */
const TYPE_FILTERS = {
  ADJUSTMENT: ["ADJUSTMENT"],
  STOCK_IN: ["STOCK_IN"],
  ISSUE: ["ISSUE"],
  RETURN: ["RETURN"],
  CONSUME: ["CONSUME"],
  TRANSFER: ["TRANSFER"],
  REVERSAL: ["REVERSAL"],
  PACK_OPS: ["OPEN_PACK", "SCRAP"],
} as const;
type TypeFilterKey = keyof typeof TYPE_FILTERS;

function isTypeFilterKey(v: string | undefined): v is TypeFilterKey {
  return !!v && v in TYPE_FILTERS;
}

export default async function LedgerPage({
  searchParams,
}: {
  searchParams: Promise<{
    type?: string;
    q?: string;
    item?: string;
    site?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
}) {
  // Checked here, not left to proxy.ts — that file documents itself as
  // convenience only, and the two challan pages already set this precedent as
  // the app's only other direct ledger:view checks.
  await requireCapability("ledger:view");

  const { type, q, item, site, from, to, page: rawPage } = await searchParams;
  const requestedPage = parsePage(rawPage);
  const typeFilter = isTypeFilterKey(type) ? type : undefined;

  // A malformed, truncated or hand-edited ?from=/?to= must not reach Prisma
  // as an Invalid Date — that throws a 500 rather than matching nothing.
  // parseDateFilter also pushes `to` to end-of-day: without it, `to` means
  // midnight and a same-day filter returns nothing.
  const fromDate = parseDateFilter(from, false);
  const toDate = parseDateFilter(to, true);

  const where: Prisma.TransactionWhereInput = {
    ...(typeFilter ? { type: { in: [...TYPE_FILTERS[typeFilter]] } } : {}),
    ...(item ? { itemId: item } : {}),
    // A transfer's siteId is the destination and fromSiteId the origin — a
    // site filter has to catch both directions, the same OR the site detail
    // page's own activity query uses.
    ...(site ? { OR: [{ siteId: site }, { fromSiteId: site }] } : {}),
    ...(q
      ? { item: { OR: [{ name: { contains: q } }, { sku: { contains: q } }] } }
      : {}),
    ...(fromDate || toDate
      ? {
          createdAt: {
            ...(fromDate ? { gte: fromDate } : {}),
            ...(toDate ? { lte: toDate } : {}),
          },
        }
      : {}),
  };

  // A requested page past the end (?page=99999) must not run a query that
  // comes back empty and then render an empty table — total has to be known
  // before the real page is decided.
  const total = await prisma.transaction.count({ where });
  const page = clampPage(requestedPage, total);
  const transactions = await prisma.transaction.findMany({
    where,
    orderBy: { createdAt: "desc" },
    ...pageArgs(page),
    include: {
      item: true,
      user: true,
      site: true,
      fromSite: true,
      dispatch: true,
      delivery: true,
      transfer: true,
    },
  });

  const otherParams = { type, q, item, site, from, to };

  function hrefFor(overrides: Record<string, string | undefined>): string {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...otherParams, ...overrides })) {
      if (v) params.set(k, v);
    }
    const qs = params.toString();
    return qs ? `/ledger?${qs}` : "/ledger";
  }

  const activePill = typeFilter ?? "ALL";
  const pillOptions = [
    { value: "ALL", label: "All", href: hrefFor({ type: undefined }) },
    { value: "ADJUSTMENT", label: "Adjustments", href: hrefFor({ type: "ADJUSTMENT" }) },
    { value: "STOCK_IN", label: "Stock In", href: hrefFor({ type: "STOCK_IN" }) },
    { value: "ISSUE", label: "Issues", href: hrefFor({ type: "ISSUE" }) },
    { value: "RETURN", label: "Returns", href: hrefFor({ type: "RETURN" }) },
    { value: "CONSUME", label: "Consume", href: hrefFor({ type: "CONSUME" }) },
    { value: "TRANSFER", label: "Transfers", href: hrefFor({ type: "TRANSFER" }) },
    { value: "REVERSAL", label: "Reversals", href: hrefFor({ type: "REVERSAL" }) },
    { value: "PACK_OPS", label: "Pack ops", href: hrefFor({ type: "PACK_OPS" }) },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Ledger"
        subtitle="Every movement ever recorded — adjustments and reversals included, with the reason and note behind each one."
      />

      <FilterPills active={activePill} options={pillOptions} />

      <div className="flex flex-wrap items-start gap-3">
        <SearchBar name="q" defaultValue={q ?? ""} placeholder="Search by item name or SKU">
          {type && <input type="hidden" name="type" value={type} />}
          {item && <input type="hidden" name="item" value={item} />}
          {site && <input type="hidden" name="site" value={site} />}
          {from && <input type="hidden" name="from" value={from} />}
          {to && <input type="hidden" name="to" value={to} />}
        </SearchBar>

        <form className="flex flex-wrap items-end gap-2" action="/ledger">
          {type && <input type="hidden" name="type" value={type} />}
          {q && <input type="hidden" name="q" value={q} />}
          {item && <input type="hidden" name="item" value={item} />}
          {site && <input type="hidden" name="site" value={site} />}
          <Field label="From" className="w-auto">
            <Input type="date" name="from" defaultValue={from ?? ""} className="w-auto" />
          </Field>
          <Field label="To" className="w-auto">
            <Input type="date" name="to" defaultValue={to ?? ""} className="w-auto" />
          </Field>
          <Button type="submit" variant="secondary" size="md">
            Apply
          </Button>
        </form>
      </div>

      <Card>
        <TableWrap>
          <Table>
            <THead>
              <tr>
                <Th>Date</Th>
                <Th>Type</Th>
                <Th>Item</Th>
                <Th>Quantity</Th>
                <Th>Site</Th>
                <Th>By</Th>
                <Th>Reason</Th>
                <Th>Note</Th>
              </tr>
            </THead>
            <tbody>
              {transactions.map((t) => (
                <Tr key={t.id}>
                  <Td className="text-ink-subtle">{t.createdAt.toLocaleString()}</Td>
                  <Td>
                    <Badge tone={TRANSACTION_TYPE_TONE[t.type] ?? "neutral"}>{t.type}</Badge>
                  </Td>
                  <Td>
                    <Link href={`/items/${t.item.id}`} className="font-semibold text-ink hover:text-accent">
                      {t.item.name}
                    </Link>
                    {t.dispatch && (
                      <Link
                        href={`/dispatches/${t.dispatch.id}`}
                        className="ml-1.5 text-xs font-semibold text-ink-subtle hover:text-accent"
                      >
                        · {formatChallanNo(t.dispatch.challanNo)}
                      </Link>
                    )}
                    {t.delivery && (
                      <Link
                        href={`/deliveries/${t.delivery.id}`}
                        className="ml-1.5 text-xs font-semibold text-ink-subtle hover:text-accent"
                      >
                        · {t.delivery.challanNo != null
                          ? formatSiteChallanNo(t.delivery.challanNo)
                          : "delivery"}
                      </Link>
                    )}
                    {t.transfer && (
                      <Link
                        href={`/transfers/${t.transfer.id}`}
                        className="ml-1.5 text-xs font-semibold text-ink-subtle hover:text-accent"
                      >
                        · {formatTransferChallanNo(t.transfer.challanNo)}
                      </Link>
                    )}
                  </Td>
                  <Td className="font-mono">
                    {describeMovement(t.item, t)}
                    {t.defectiveQty ? (
                      <span className="ml-1 font-semibold text-warn-ink">
                        ({t.defectiveQty} defective)
                      </span>
                    ) : null}
                  </Td>
                  <Td className="text-ink-subtle">
                    {t.type === "TRANSFER"
                      ? `${t.fromSite?.name ?? "?"} → ${t.site?.name ?? "?"}`
                      : t.site?.name ?? "—"}
                  </Td>
                  <Td className="text-ink-subtle">{t.user.name}</Td>
                  <Td className="text-ink-subtle">{t.reason ?? "—"}</Td>
                  <Td className="text-ink-subtle">{t.note ?? "—"}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
        {transactions.length === 0 && (
          <EmptyState>
            {total === 0 && !q && !typeFilter && !item && !site && !from && !to
              ? "No activity recorded yet."
              : "No movements match these filters."}
          </EmptyState>
        )}
        <Pager total={total} page={page} basePath="/ledger" searchParams={otherParams} />
      </Card>
    </div>
  );
}
