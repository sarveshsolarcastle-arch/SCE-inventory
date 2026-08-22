import { createSite } from "@/lib/actions/sites";
import PageHeader from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import Button from "@/components/ui/Button";

export default function NewSitePage() {
  return (
    <div className="max-w-lg space-y-4">
      <PageHeader title="New Site" />
      <Card>
        <CardBody>
          <form action={createSite} className="space-y-4">
            <Field label="Name">
              <Input name="name" required />
            </Field>
            <Field label="Location">
              <Input name="location" />
            </Field>
            <Field label="Notes">
              <Input name="notes" />
            </Field>
            <Button type="submit">Create Site</Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
