import { createItem } from "@/lib/actions/items";
import PageHeader from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Field";
import Button from "@/components/ui/Button";

export default function NewItemPage() {
  return (
    <div className="max-w-lg space-y-4">
      <PageHeader title="New Item" />
      <Card>
        <CardBody>
          <form action={createItem} className="space-y-4">
            <Field label="Name">
              <Input name="name" required />
            </Field>
            <Field label="SKU">
              <Input name="sku" required />
            </Field>
            <Field label="Category">
              <Input name="category" />
            </Field>
            <Field label="Base unit (what stock is counted in — m, pcs)">
              <Input name="baseUnit" defaultValue="pcs" />
            </Field>
            <Field label="Pack unit (roll, packet — blank if not packaged)">
              <Input name="packUnit" />
            </Field>
            <Field label="Measure">
              <Select name="measure" defaultValue="DISCRETE">
                <option value="DISCRETE">
                  Discrete — countable units that pool freely (screws)
                </option>
                <option value="CONTINUOUS">
                  Continuous — a length must come from one pack (wire)
                </option>
              </Select>
            </Field>
            <Field label="Scrap threshold (continuous only — offcuts at or below this stop being stock)">
              <Input name="scrapThreshold" type="number" />
            </Field>
            <Field label="Minimum stock">
              <Input name="minStock" type="number" defaultValue="0" />
            </Field>
            <p className="text-sm font-semibold text-ink-subtle">
              New items start at zero. Stock arrives by recording a movement, so every unit has an
              audit trail behind it.
            </p>
            <Button type="submit">Create Item</Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
