/* -------------------------------------------------------------------------
 * What a control SAYS when the person looking at it can only ask for it.
 *
 * Stage 8's problem is not permission — `runOrRequest` has held that gate
 * since stage 5 — it is that twelve call sites hid their control behind a bare
 * `can()`, so a finance user saw no button at all for the five things they are
 * allowed to request. Un-hiding them means each of those twelve places has to
 * word a button, a pending state and a result notice for two different
 * audiences. Left to the call sites that is twelve chances to invent twelve
 * ways of saying "an admin has to agree first", and — worse — twelve chances
 * to show a successfully raised request in the red used for failures.
 *
 * So the wording lives here, pure and tested, and the pages pass a mode.
 *
 * THE ONE THAT MATTERS IS `noticeFor`. Every action that can be requested
 * returns `ok: false` on the request path, deliberately — see outcome.ts, and
 * the note there about why dressing a request up as success would have sent
 * DeleteSiteButton to /sites announcing a deletion that never happened. But
 * the components that consume it all do `if (!result.ok) setError(…)`, and
 * `setError` renders danger red. Correct behaviour, wrong colour: the user
 * asks for something, it works, and the screen tells them in red that it did
 * not. `ok` answers "did the thing happen"; it does not answer "did anything
 * go wrong", and those two questions have different answers on exactly this
 * path. This function is where they stop being conflated.
 * ---------------------------------------------------------------------- */

/** Re-declared here rather than imported from capabilities.ts so this module
 * stays import-free and therefore testable under `--experimental-strip-types`
 * (the `@/` alias does not resolve there — the reason capabilities.ts exists at
 * all). The test at the bottom of labels.test.ts asserts the two definitions
 * are assignable to each other, so the copy cannot drift. */
export type ControlMode = "do" | "request" | "none";

/** One spelling of the phrase, so a reader who learns it on one page
 * recognises it on the next. Sentence-cased at the call site if it starts a
 * label. */
export const ASK = "Ask an admin to";

/** The text on a control.
 *
 * `doing` is the imperative as it reads when the user carries it out
 * themselves — "Delete site". `asking` is the same action as the object of a
 * request — "delete this site" — so it composes into "Ask an admin to delete
 * this site". Two arguments rather than one because English will not let you
 * derive the second from the first: "Save" does not become "Ask an admin to
 * save", it becomes "Ask an admin to save these changes".
 */
export function controlLabel(mode: ControlMode, doing: string, asking: string): string {
  return mode === "request" ? `${ASK} ${asking}` : doing;
}

/** What the control says with the click in flight. A request is always a send,
 * whatever the operation behind it is — nothing is being deleted or reversed
 * yet, and saying so would be a lie for the second or two it is on screen. */
export function pendingLabel(mode: ControlMode, doing: string): string {
  return mode === "request" ? "Sending…" : doing;
}

/** The line under a control in request mode, saying what pressing it does.
 * Returns null in `do` mode so a call site can render it unconditionally. */
export function requestHint(mode: ControlMode): string | null {
  return mode === "request"
    ? "This will be sent to the admins. Nothing changes until one of them approves it."
    : null;
}

export type Notice = { tone: "danger" | "info"; message: string };

/** How to present a result that did not execute.
 *
 * The `requested` discriminant is the whole reason it exists on the result
 * type — outcome.ts put it there for "a later stage to branch on to soften the
 * tone from danger to info", and this is that stage. A request that was raised
 * successfully is `info`; everything else is `danger`, which is the safe
 * default for anything this function does not recognise.
 */
export function noticeFor(result: { ok: false; requested?: true; message: string }): Notice {
  return { tone: result.requested ? "info" : "danger", message: result.message };
}
