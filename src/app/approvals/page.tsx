import { redirect } from "next/navigation";
import { ClipboardCheck, Inbox } from "lucide-react";
import { can, currentUser } from "@/lib/permissions";
import { pendingForDecision, requestsRaisedBy, type QueueRequest } from "@/lib/approvals/queue";
import { erasedOperationFor } from "@/lib/approvals/registry";
import { isOperationKind } from "@/lib/approvals/kinds";
import { formatPrecheck, type Precheck } from "@/lib/approvals/precheck";
import {
  APPROVAL_STATUS_LABEL,
  APPROVAL_STATUS_TONE,
  isPending,
  type ApprovalStatusValue,
} from "@/lib/approvals/status";
import { approveRequest, rejectRequest, cancelRequest } from "@/lib/actions/approvals";
import { ApprovalDecision, WithdrawButton } from "@/components/ApprovalDecision";
import PageHeader from "@/components/ui/PageHeader";
import Badge from "@/components/ui/Badge";
import Alert from "@/components/ui/Alert";
import EmptyState from "@/components/ui/EmptyState";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { TableWrap, Table, THead, Th, Tr, Td } from "@/components/ui/Table";

/** The frozen summary says what was ASKED. This says what would happen NOW, and
 * the gap between the two is the whole reason the page re-computes anything: a
 * site that was empty when finance asked may have had a dispatch sent to it
 * since, and the admin should read "this will now fail" BEFORE clicking, not
 * after.
 *
 * Never throws. A pre-check that blew up would take the entire queue down with
 * it, which is a far worse failure than one row being unable to say what it
 * would do — so a broken row degrades to a neutral sentence and stays
 * answerable. */
async function livePrecheck(row: QueueRequest): Promise<Precheck> {
  try {
    if (!isOperationKind(row.kind)) {
      return formatPrecheck({
        kind: "missing",
        what: `The operation "${row.kind}"`,
      });
    }
    const op = erasedOperationFor(row.kind);
    return await op.precheck(op.parse(JSON.parse(row.args)));
  } catch (error) {
    return {
      tone: "neutral",
      message: `This request cannot be checked: ${
        error instanceof Error ? error.message : "its stored details are not readable"
      }`,
    };
  }
}

function when(date: Date): string {
  return `${date.toLocaleDateString()} at ${date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; withdrawn?: string }>;
}) {
  const user = await currentUser();
  // Page-level gating is convenience; every action re-checks for itself.
  if (!can(user?.role, "approval:view")) redirect("/dashboard");

  const { sent } = await searchParams;
  const canDecide = can(user!.role, "approval:decide");

  const pending = canDecide ? await pendingForDecision() : [];
  const prechecks = await Promise.all(pending.map(livePrecheck));
  const mine = await requestsRaisedBy(user!.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Approvals"
        subtitle={
          canDecide
            ? `${pending.length} waiting for an answer`
            : "Requests you have raised, and what became of them"
        }
      />

      {sent && (
        <Alert tone="info">
          Sent to the admins for approval. Nothing has happened yet — it will be carried
          out, attributed to you, when one of them approves it.
        </Alert>
      )}

      {canDecide && (
        <Card>
          <CardHeader>
            <CardTitle icon={<ClipboardCheck className="h-3.5 w-3.5" />} tone="warn">
              Waiting for you
            </CardTitle>
            <span className="text-xs font-semibold text-ink-subtle">
              answering one takes it out of everyone&rsquo;s queue
            </span>
          </CardHeader>
          {pending.length === 0 ? (
            <EmptyState>Nothing is waiting. </EmptyState>
          ) : (
            <div className="divide-y divide-line">
              {pending.map((row, i) => (
                <div key={row.id} className="space-y-2.5 p-4">
                  <p className="text-sm font-extrabold text-ink">{row.summary}</p>
                  <p className="text-sm font-semibold text-ink-subtle">
                    Asked by {row.requestedBy.name ?? "someone"} on {when(row.createdAt)}
                    {row.reason ? (
                      <>
                        {" "}
                        &mdash; &ldquo;<span className="text-ink-muted">{row.reason}</span>
                        &rdquo;
                      </>
                    ) : (
                      // toggleFrontRow carries no form, so there is nowhere to
                      // type one. Say so rather than leaving a blank.
                      <> &mdash; no reason given</>
                    )}
                  </p>

                  <Alert tone={prechecks[i].tone}>{prechecks[i].message}</Alert>

                  <ApprovalDecision
                    approve={approveRequest.bind(null, row.id)}
                    reject={rejectRequest.bind(null, row.id)}
                  />
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle icon={<Inbox className="h-3.5 w-3.5" />} tone="info">
            Your requests
          </CardTitle>
        </CardHeader>
        {mine.length === 0 ? (
          <EmptyState>You have not asked for anything.</EmptyState>
        ) : (
          <TableWrap>
            <Table>
              <THead>
                <tr>
                  <Th>When</Th>
                  <Th>What</Th>
                  <Th>Reason</Th>
                  <Th>Status</Th>
                  <Th>Answered by</Th>
                  <Th>Note</Th>
                  <Th />
                </tr>
              </THead>
              <tbody>
                {mine.map((row) => {
                  const status = row.status as ApprovalStatusValue;
                  return (
                    <Tr key={row.id}>
                      <Td className="whitespace-nowrap">{when(row.createdAt)}</Td>
                      <Td className="font-semibold text-ink">{row.summary}</Td>
                      <Td className="text-ink-subtle">{row.reason ?? "—"}</Td>
                      <Td>
                        <Badge tone={APPROVAL_STATUS_TONE[status] ?? "neutral"}>
                          {APPROVAL_STATUS_LABEL[status] ?? status}
                        </Badge>
                      </Td>
                      <Td>{row.decidedBy?.name ?? "—"}</Td>
                      {/* Carries a rejection's note, or a FAILED row's refusal —
                          which is the only place the reason it could not be
                          carried out is ever recorded. */}
                      <Td className="text-ink-subtle">{row.decisionNote ?? "—"}</Td>
                      <Td>
                        {isPending(row.status) && (
                          <WithdrawButton cancel={cancelRequest.bind(null, row.id)} />
                        )}
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>

      <p className="text-sm font-medium text-ink-subtle">
        Approving does not unlock a button — it <em>runs</em> the operation, recorded against
        whoever asked for it. Accounts and backups are deliberately not requestable by anyone:
        an approval flow that can mint an admin is not an approval flow, and restoring a backup
        would erase the record of who authorised it.
      </p>
    </div>
  );
}
