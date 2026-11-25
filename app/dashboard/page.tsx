import { Suspense } from "react";
import type { DestinationParams } from "@/lib/auth-destination";
import { getDashboardLocations, getPublicResults } from "@/lib/public-results.server";
import DashboardContent from "./DashboardContent";

const pageSize = 10;
function positiveId(value: string | string[] | undefined) {
  if (typeof value !== "string" || !/^[1-9]\d{0,9}$/.test(value)) return null;
  const id = Number(value);
  return id <= 2147483647 ? id : null;
}

export default function DashboardPage({ searchParams }: { searchParams: Promise<DestinationParams> }) {
  return <Suspense fallback={<p className="px-4 py-10 text-muted">Loading dashboard...</p>}>
    <LiveDashboard searchParams={searchParams} />
  </Suspense>;
}

async function LiveDashboard({ searchParams }: { searchParams: Promise<DestinationParams> }) {
  const params = await searchParams;
  const state = positiveId(params.state);
  const lga = positiveId(params.lga);
  const status = typeof params.status === "string" && ["mismatch", "confirmed", "unverified", "conflicting", "matches"].includes(params.status)
    ? params.status : "all";
  const data = await Promise.all([getPublicResults(), getDashboardLocations(state)]).catch(() => null);
  if (!data) return <p role="alert" className="px-4 py-10 text-muted">Could not load the dashboard. Refresh to try again.</p>;

  const [report, locations] = data;
  const selectedState = locations.states.find(({ id }) => id === state)?.id ?? null;
  const selectedLga = locations.lgas.find(({ id }) => id === lga)?.id ?? null;
  const filtered = report.units.filter((unit) =>
    (!selectedState || unit.stateId === selectedState) && (!selectedLga || unit.lgaId === selectedLga)
    && (status === "all" || (status === "confirmed" ? ["confirmed", "matches", "mismatch"].includes(unit.status) : unit.status === status)),
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(positiveId(params.page) ?? 1, pageCount);
  const start = (page - 1) * pageSize;

  return <DashboardContent stats={report.stats} totalUnits={report.total} {...locations}
    visibleUnits={filtered.slice(start, start + pageSize)} pageCount={pageCount} safePage={page}
    filteredCount={filtered.length} startIndex={start} stateFilter={selectedState?.toString() ?? ""}
    lgaFilter={selectedLga?.toString() ?? ""} statusFilter={status} />;
}
