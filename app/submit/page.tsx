import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/auth";
import { loginDestination, type DestinationParams } from "@/lib/auth-destination";
import { getActiveParties, partiesLoadError } from "@/lib/parties.server";
import { hasPhotoStorage } from "@/lib/submission-photos.server";
import { pollingUnitCode } from "@/lib/submission-validation";
import { findSubmissionUnit, hasSubmitted } from "@/lib/submissions.server";
import SubmitResultContent from "./SubmitResultContent";

export default function SubmitResultPage({ searchParams }: { searchParams: Promise<DestinationParams> }) {
  return (
    <Suspense fallback={<p className="px-4 py-10 text-muted">Loading submission...</p>}>
      <PageContent searchParams={searchParams} />
    </Suspense>
  );
}

async function PageContent({ searchParams }: { searchParams: Promise<DestinationParams> }) {
  const user = await getAuthenticatedUser().catch(() => undefined);
  if (user === undefined) {
    return <p role="alert" className="px-4 py-10 text-muted">Could not verify your access. Try again.</p>;
  }
  const params = await searchParams;
  if (!user) redirect(loginDestination("/submit", params));

  const code = pollingUnitCode.safeParse(params.unit);
  const unit = code.success ? await findSubmissionUnit(code.data).catch(() => undefined) : null;
  if (unit === undefined) {
    return <p role="alert" className="px-4 py-10 text-muted">Could not load the polling unit. Try again.</p>;
  }

  const alreadySubmitted = unit ? await hasSubmitted(user.id, unit.id).catch(() => undefined) : false;
  if (alreadySubmitted === undefined) {
    return <p role="alert" className="px-4 py-10 text-muted">Could not check your submission. Try again.</p>;
  }

  const parties = unit && !alreadySubmitted ? await getActiveParties(false).catch(() => []) : [];
  if (unit && !alreadySubmitted && !parties.length) {
    return <p role="alert" className="px-4 py-10 text-muted">{partiesLoadError}</p>;
  }

  return <SubmitResultContent key={unit?.code ?? String(params.unit ?? "")} parties={parties} selectedUnit={unit}
    unitRequested={params.unit !== undefined} alreadySubmitted={alreadySubmitted} storageReady={hasPhotoStorage()} />;
}
