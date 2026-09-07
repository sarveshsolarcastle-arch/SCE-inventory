import NewShelfForm from "@/components/NewShelfForm";
import PageHeader from "@/components/ui/PageHeader";
import { capabilityMode, currentUser } from "@/lib/permissions";

export default async function NewShelfPage() {
  // proxy.ts admits a requester here as well as a holder, so the page cannot
  // assume the form will create anything.
  const user = await currentUser();
  const mode = capabilityMode(user?.role, "shelf:manage");
  return (
    <div className="max-w-2xl space-y-4">
      <PageHeader
        title="New Shelf"
        subtitle="Every shelf has two sides (front and back) with the same row/column layout. Slots are labeled to match your physical stickers (e.g. F1-1, B2-3). After sizing the grid, choose which box type — Fresh, Opened, or Recyclable — sits in each spot."
      />
      <NewShelfForm mode={mode} />
    </div>
  );
}
