/* -------------------------------------------------------------------------
 * What an admin is told will happen if they approve, re-computed live at the
 * moment they look.
 *
 * The frozen `summary` says what was ASKED. This says what would happen NOW,
 * and the gap between the two is the whole point: a site that was empty when
 * finance asked to delete it may have had a dispatch sent to it since, and an
 * admin should read "this will now fail: 1 dispatch attached" before clicking,
 * not afterwards.
 *
 * Pure — the caller does the queries and passes findings in. The tone matters
 * as much as the text, because these three cases mean genuinely different
 * things and must not look alike:
 *
 *   ok       nothing stands in the way
 *   warn     it will succeed, and destroy something worth naming first
 *   danger   it will fail if approved
 *   neutral  the target has gone; there is nothing left to act on
 * ---------------------------------------------------------------------- */

export type PrecheckTone = "ok" | "warn" | "danger" | "neutral";

export type PrecheckFinding =
  /** Nothing blocks it. */
  | { kind: "clear" }
  /** It would fail — `reason` is the operation's own refusal sentence, so the
   * admin reads exactly what the operation would have said. */
  | { kind: "blocked"; reason: string }
  /** It will work, and take something with it. */
  | { kind: "destructive"; consequence: string }
  /** The row is gone since the request was raised. */
  | { kind: "missing"; what: string };

export type Precheck = { tone: PrecheckTone; message: string };

export function formatPrecheck(finding: PrecheckFinding): Precheck {
  switch (finding.kind) {
    case "clear":
      return { tone: "ok", message: "Ready — nothing blocks this." };
    case "blocked":
      // Deliberately "will now fail", not "cannot be approved": approving is
      // still allowed, it just produces a FAILED row. Pretending otherwise
      // would hide that the request was answered.
      return { tone: "danger", message: `This will now fail: ${finding.reason}` };
    case "destructive":
      return { tone: "warn", message: finding.consequence };
    case "missing":
      return {
        tone: "neutral",
        message: `${finding.what} no longer exists — there is nothing left to act on.`,
      };
  }
}
