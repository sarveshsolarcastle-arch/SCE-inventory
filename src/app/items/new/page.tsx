import { createItem } from "@/lib/actions/items";

export default function NewItemPage() {
  return (
    <div className="max-w-lg space-y-4">
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
        New Item
      </h1>
      <form action={createItem} className="space-y-4">
        <Field label="Name" name="name" required />
        <Field label="SKU" name="sku" required />
        <Field label="Category" name="category" />
        <Field
          label="Base unit (what stock is counted in — m, pcs)"
          name="baseUnit"
          defaultValue="pcs"
        />
        <Field
          label="Pack unit (roll, packet — blank if not packaged)"
          name="packUnit"
        />
        <div className="space-y-1">
          <label className="text-sm text-zinc-600 dark:text-zinc-400">Measure</label>
          <select
            name="measure"
            defaultValue="DISCRETE"
            className="w-full rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="DISCRETE">
              Discrete — countable units that pool freely (screws)
            </option>
            <option value="CONTINUOUS">
              Continuous — a length must come from one pack (wire)
            </option>
          </select>
        </div>
        <Field
          label="Scrap threshold (continuous only — offcuts at or below this stop being stock)"
          name="scrapThreshold"
          type="number"
        />
        <Field label="Minimum stock" name="minStock" type="number" defaultValue="0" />
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          New items start at zero. Stock arrives by recording a movement, so
          every unit has an audit trail behind it.
        </p>
        <button
          type="submit"
          className="rounded bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900"
        >
          Create Item
        </button>
      </form>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="text-sm text-zinc-600 dark:text-zinc-400">{label}</label>
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        className="w-full rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      />
    </div>
  );
}
