"use server";

/* The auth boundary and the transport shape, and nothing else. The operations
 * themselves live in @/lib/approvals/ops/sites, as plain functions over a
 * transaction — see the header there for why they cannot live in this file.
 *
 * Every async export here is a network-reachable RPC endpoint, because of the
 * `"use server"` above. That is why each one goes through runOrRequest, which
 * holds the gate: hiding a button proves nothing. `requireCapability` no longer
 * appears here and its absence is not a relaxation — runOrRequest checks
 * `can()` exactly as before and throws the same NotPermittedError. What changed
 * is only what happens to a role that may ASK: instead of the refusal, it gets
 * an ApprovalRequest row and a sentence saying so.
 *
 * Nothing here revalidates, either: the operation's own path list runs inside
 * runOrRequest, so the direct and approved paths cannot invalidate different
 * things. Redirects stay here, because where to go afterwards is a fact about
 * the screen the user was on.
 */

import { NotPermittedError } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { parseSiteCreateArgs, parseSiteUpdateArgs } from "@/lib/approvals/args";
import { runOrRequest } from "@/lib/approvals/runOrRequest";
import { describeRequested, type RequestedResult } from "@/lib/approvals/outcome";

export async function createSite(formData: FormData) {
  "use server";

  const args = parseSiteCreateArgs({
    name: formData.get("name"),
    location: formData.get("location"),
    notes: formData.get("notes"),
  });

  const outcome = await runOrRequest("site.create", args);

  // Outside the transaction, and after runOrRequest has returned: redirect()
  // throws NEXT_REDIRECT, which inside would roll the write back.
  redirect(
    outcome.kind === "executed"
      ? `/sites/${outcome.value.id}`
      : // The site does not exist yet, so there is nowhere else to send them.
        `/approvals?sent=${outcome.requestId}`
  );
}

export async function updateSite(siteId: string, formData: FormData) {
  "use server";

  const args = parseSiteUpdateArgs({
    siteId,
    name: formData.get("name"),
    location: formData.get("location"),
    notes: formData.get("notes"),
  });

  const outcome = await runOrRequest("site.update", args);

  // Back to the site either way. On the request path the page shows an
  // acknowledgement from `?requested`, rather than bouncing someone out of the
  // site they were editing to read a queue.
  redirect(
    outcome.kind === "executed"
      ? `/sites/${siteId}`
      : `/sites/${siteId}?requested=${outcome.requestId}`
  );
}

export type DeleteSiteResult =
  | { ok: true }
  | { ok: false; message: string }
  | RequestedResult;

/** `reason` is optional because this is called from an onClick rather than a
 * form; it becomes the approval's reason when the caller can only request. */
export async function deleteSite(
  siteId: string,
  reason?: string
): Promise<DeleteSiteResult> {
  try {
    const outcome = await runOrRequest("site.delete", { siteId }, reason?.trim() || null);
    return outcome.kind === "executed" ? { ok: true } : describeRequested(outcome);
  } catch (error) {
    if (error instanceof NotPermittedError) {
      return { ok: false, message: "Your account cannot delete sites" };
    }
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not delete the site",
    };
  }
}
