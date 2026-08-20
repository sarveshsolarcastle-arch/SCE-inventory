import NewShelfForm from "@/components/NewShelfForm";

export default function NewShelfPage() {
  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
        New Shelf
      </h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Every shelf has two sides (front and back) with the same row/column
        layout. Slots are labeled to match your physical stickers (e.g. F1-1,
        B2-3). After sizing the grid, choose which box type — Fresh, Opened,
        or Recyclable — sits in each spot.
      </p>
      <NewShelfForm />
    </div>
  );
}
