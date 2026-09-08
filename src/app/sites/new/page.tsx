import { createSite } from "@/lib/actions/sites";
import PageHeader from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Field, Input, Textarea } from "@/components/ui/Field";
import Button from "@/components/ui/Button";
import { capabilityMode, currentUser } from "@/lib/permissions";
import { controlLabel, requestHint } from "@/lib/approvals/labels";

/** proxy.ts admits a role that may only REQUEST `site:manage` here — that
 * bypass is the point of the approvals work — and `createSite` decides which of
 * the two it gets. The button has to say which, or it promises a site that will
 * not exist when the page redirects. */
export default async function NewSitePage() {
  const user = await currentUser();
  const mode = capabilityMode(user?.role, "site:manage");
  return (
    <div className="max-w-lg space-y-4">
      <PageHeader title="New Site" />
      <Card>
        <CardBody>
          <form action={createSite} className="space-y-4">
            <Field label="Name">
              <Input name="name" required />
            </Field>
            <Field label="Location (short label)">
              <Input name="location" />
            </Field>
            {/* The delivery challan prints these three. All optional — a site
                can be created now and given its paperwork details later. */}
            <Field label="Customer / party name">
              <Input name="customerName" />
            </Field>
            <Field label="Delivery address">
              <Textarea name="address" rows={3} />
            </Field>
            <Field label="Project ID / reference">
              <Input name="projectCode" />
            </Field>
            <Field label="Notes">
              <Input name="notes" />
            </Field>
            <Button type="submit">
              {controlLabel(mode, "Create Site", "create this site")}
            </Button>
            {requestHint(mode) && (
              <p className="text-xs font-semibold text-ink-subtle">{requestHint(mode)}</p>
            )}
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
