/* -------------------------------------------------------------------------
 * The one-line description of what a request would do.
 *
 * Pure: it takes names that have ALREADY been looked up, rather than doing the
 * lookup itself, so it can be tested and so the caller controls the queries.
 *
 * Built SERVER-side at request time and then FROZEN into
 * ApprovalRequest.summary. Both halves of that matter:
 *
 *   server-side — never from a label the requester supplied, or finance could
 *     label a delete of site A as "delete site B" and phish an approval out of
 *     an admin who read only the summary;
 *
 *   frozen — the site may be renamed, or gone, by the time an admin looks, and
 *     a summary that silently re-rendered would misdescribe what was asked. The
 *     LIVE truth comes from re-running the operation's precheck at render time,
 *     so the admin sees both: what was requested, and what would happen now.
 * ---------------------------------------------------------------------- */

import type { OperationKind } from "./kinds.ts";

/** Names resolved by the caller. Anything missing degrades to the id, which is
 * ugly but never wrong — and never throws, because a summary failing to render
 * would take the whole queue page down with it. */
export type SummaryNames = {
  site?: string | null;
  shelf?: string | null;
  item?: string | null;
  slot?: string | null;
  movement?: string | null;
  dispatch?: string | null;
};

function name(value: string | null | undefined, fallback: string): string {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed || fallback;
}

export function describeKind(
  kind: OperationKind | string,
  args: Record<string, unknown>,
  names: SummaryNames = {}
): string {
  const site = () => name(names.site, `site ${String(args.siteId ?? "?")}`);
  const shelf = () => name(names.shelf, `shelf ${String(args.shelfId ?? "?")}`);
  const slot = () => name(names.slot, `a box`);
  const item = () => name(names.item, `item ${String(args.itemId ?? "?")}`);

  switch (kind) {
    case "site.create":
      return `Create the site "${String(args.name ?? "")}"`;
    case "site.update":
      return `Rename ${site()} to "${String(args.name ?? "")}"`;
    case "site.delete":
      return `Delete ${site()}`;
    case "shelf.create":
      return `Create the shelf "${String(args.name ?? "")}" (${String(args.rows ?? "?")} × ${String(args.columns ?? "?")})`;
    case "shelf.delete":
      return `Delete ${shelf()}, and everything recorded about where its boxes sit`;
    case "shelf.slot.boxType":
      return `Relabel ${slot()} on ${shelf()} as ${String(args.boxType ?? "?")}`;
    case "shelf.slot.item":
      return args.itemId
        ? `Put ${item()} in ${slot()} on ${shelf()}`
        : `Empty ${slot()} on ${shelf()}`;
    case "shelf.slot.frontRow":
      return `Toggle the front-row mark on ${slot()} on ${shelf()}`;
    case "stock.reverseTransaction":
      return `Reverse ${name(names.movement, "a stock movement")}`;
    case "stock.reverseDispatch":
      return `Reverse every line of ${name(names.dispatch, "a dispatch")}`;
    case "stock.adjust":
      return `Apply a counted stock correction to ${item()}`;
    default:
      // A row whose kind has since been removed from the registry must still
      // render as history rather than take the page down.
      return `Carry out "${String(kind)}"`;
  }
}
