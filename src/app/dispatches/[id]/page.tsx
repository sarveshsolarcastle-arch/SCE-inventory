import { Printer, Undo2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { capabilityMode, currentUser } from "@/lib/permissions";
import { reverseDispatch } from "@/lib/actions/corrections";
import { ReverseButton } from "@/components/CorrectionPanel";
import { describeMovement } from "@/lib/units";
import Link from "next/link";
import { notFound } from "next/navigation";
import PageHeader from "@/components/ui/PageHeader";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import { TableWrap, Table, THead, Th, Tr, Td } from "@/components/ui/Table";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import { buttonClasses } from "@/components/ui/Button";
import { formatChallanNo } from "@/lib/challan";

export default async function DispatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const dispatch = await prisma.dispatch.findUnique({
    where: { id },
    include: {
      site: true,
      user: true,
      transactions: {
        orderBy: { createdAt: "asc" },
        include: { item: true },
      },
    },
  });

  if (!dispatch) notFound();

  const user = await currentUser();
  const reverseMode = capabilityMode(user?.role, "stock:reverse");

  const issueLines = dispatch.transactions.filter((t) => t.type === "ISSUE");
  const reversalLines = dispatch.transactions.filter((t) => t.type === "REVERSAL");
  const activeLines = issueLines.filter((t) => !t.reversedAt);
  const fullyReversed = issueLines.length > 0 && activeLines.length === 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Dispatch ${formatChallanNo(dispatch.challanNo)}`}
        subtitle={
          <>
            To{" "}
            <Link href={`/sites/${dispatch.site.id}`} className="font-bold text-accent hover:text-accent-hover">
              {dispatch.site.name}
            </Link>{" "}
            on {dispatch.dispatchedAt.toLocaleDateString()} by {dispatch.user.name}
            {dispatch.reference && ` · their ref. ${dispatch.reference}`}
            {dispatch.note && ` — ${dispatch.note}`}
          </>
        }
        actions={
          <div className="flex items-center gap-2">
            {/* Only offered when there is something to deliver — the challan
                page refuses a fully reversed dispatch anyway, and a Print
                button that leads to a refusal is a worse answer than no
                button. */}
            {activeLines.length > 0 && (
              <Link href={`/dispatches/${dispatch.id}/challan`} className={buttonClasses("secondary")}>
                <Printer size={14} aria-hidden />
                Print challan
              </Link>
            )}
            {fullyReversed ? (
              <Badge tone="neutral">Reversed</Badge>
            ) : (
              reverseMode !== "none" &&
              activeLines.length > 0 && (
                <ReverseButton
                  action={reverseDispatch.bind(null, dispatch.id)}
                  label="this whole dispatch"
                  mode={reverseMode}
                />
              )
            )}
          </div>
        }
      />

      <Card>
        <TableWrap>
          <Table>
            <THead>
              <tr>
                <Th>Item</Th>
                <Th>Quantity</Th>
                <Th>Remarks</Th>
                <Th>Status</Th>
              </tr>
            </THead>
            <tbody>
              {issueLines.map((t) => (
                <Tr key={t.id}>
                  <Td>
                    <Link href={`/items/${t.item.id}`} className="font-bold text-ink hover:text-accent">
                      {t.item.name}
                    </Link>
                  </Td>
                  <Td className="text-ink-subtle">{describeMovement(t.item, t)}</Td>
                  <Td className="text-ink-subtle">{t.note || "—"}</Td>
                  <Td>
                    {t.reversedAt ? (
                      <Badge tone="neutral">Reversed</Badge>
                    ) : (
                      <Badge tone="ok">Active</Badge>
                    )}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
        {issueLines.length === 0 && <EmptyState>No lines on this dispatch.</EmptyState>}
      </Card>

      {reversalLines.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle tone="danger" icon={<Undo2 size={13} />}>
              Reversal
            </CardTitle>
          </CardHeader>
          <CardBody>
            <p className="text-sm font-semibold text-ink-subtle">
              {reversalLines.length} line{reversalLines.length === 1 ? "" : "s"} of this dispatch
              {fullyReversed ? "" : " have been"} reversed
              {reversalLines[0]?.reason && `, reason: "${reversalLines[0].reason}"`}.
            </p>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
