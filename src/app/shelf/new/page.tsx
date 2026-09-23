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
        subtitle="Every shelf has two sides, front and back, sharing the same row and column layout. Slots are labelled to match your physical stickers, such as F1-1 or B2-3. Size the grid first, then choose which box type — Fresh, Opened or Recyclable — sits in each spot."
      />
      <NewShelfForm mode={mode} />
    </div>
  );
}
