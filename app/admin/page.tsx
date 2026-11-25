import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/auth";
import { loginDestination, type DestinationParams } from "@/lib/auth-destination";
import { getActiveParties, isPartyFallback, partiesLoadError } from "@/lib/parties.server";
import AdminContent from "./AdminContent";

export default function AdminPage({ searchParams }: { searchParams: Promise<DestinationParams> }) {
  return (
    <Suspense fallback={<p className="px-4 py-10 text-muted">Checking access?</p>}>
      <PageContent searchParams={searchParams} />
    </Suspense>
  );
}

async function PageContent({ searchParams }: { searchParams: Promise<DestinationParams> }) {
  const user = await getAuthenticatedUser().catch(() => undefined);
  if (user === undefined) {
    return <p role="alert" className="px-4 py-10 text-muted">Could not verify your access. Try again.</p>;
  }
  if (!user) redirect(loginDestination("/admin", await searchParams));

  if (user.role !== "ADMIN") {
    return (
      <main className="px-4 pb-10 pt-8 md:px-8 lg:px-10">
        <h1 className="text-2xl font-bold text-brand">Access denied</h1>
        <p className="mt-3 text-muted">You need an administrator account to access this page.</p>
      </main>
    );
  }

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
