import { Suspense } from "react";
import { getActiveParties, isPartyFallback, partiesLoadError } from "@/lib/parties.server";
import AdminContent from "./AdminContent";

export default function AdminPage() {
  return (
    <Suspense fallback={<p className="px-4 py-10 text-muted">Loading parties?</p>}>
      <PageContent />
    </Suspense>
  );
}

async function PageContent() {
  const parties = await getActiveParties().catch(() => null);
  if (!parties) {
    return <p role="alert" className="px-4 py-10 text-muted">{partiesLoadError}</p>;
  }

  return (
    <>
      {isPartyFallback(parties) && <p role="alert" className="px-4 py-4 text-muted">{partiesLoadError}</p>}
      <AdminContent parties={parties} />
    </>
  );
}
