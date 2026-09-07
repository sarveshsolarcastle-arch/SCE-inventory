/* -------------------------------------------------------------------------
 * Telling a caller "not done — sent for approval", in the shape the existing
 * components already handle.
 *
 * `ok: false` is the honest answer and the safe default. The delete did not
 * happen; the count was not applied. Every component that already does
 * `if (!result.ok) setError(result.message)` — DeleteSiteButton,
 * DeleteShelfButton, CorrectionPanel — therefore behaves CORRECTLY without
 * being touched: it shows the sentence and does not navigate away as though
 * the row were gone. Dressing a request up as `ok: true` would have sent
 * DeleteSiteButton to /sites announcing a deletion that had not occurred.
 *
 * The `requested` discriminant is what a later stage branches on to soften the
 * tone from danger to info. Until then the message carries the whole meaning,
 * which is why it has to read as a complete sentence on its own.
 *
 * Pure — no database, no framework — so the wording is under test.
 * ---------------------------------------------------------------------- */

/** The third arm of every action result that can be requested rather than
 * done. `requestId` is the row to point at; a duplicate points at the request
 * that was already waiting, not at a new one. */
export type RequestedResult = {
  ok: false;
  requested: true;
  requestId: string;
  message: string;
};

/** The two non-executed arms of runOrRequest's Outcome, narrowed to what this
 * needs — kept structural so it cannot drag the DB layer into a pure module. */
export type RequestOutcome = {
  kind: "requested" | "duplicate";
  requestId: string;
  summary: string;
};

export function describeRequested(outcome: RequestOutcome): RequestedResult {
  return {
    ok: false,
    requested: true,
    requestId: outcome.requestId,
    message:
      outcome.kind === "duplicate"
        ? // Named, because "already requested" without saying WHAT reads as a
          // bug when the user has several requests in flight.
          `Someone has already asked for this — "${outcome.summary}" is still waiting for an admin.`
        : `Sent to the admins for approval: "${outcome.summary}".`,
  };
}
