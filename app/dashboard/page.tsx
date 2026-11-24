"use client";

import Link from "next/link";
import { Suspense, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { fakeLocations } from "@/lib/fake-locations";
import { fakeDashboardUnits, lastUpdated, totalUnits, type DashboardStatus } from "@/lib/fake-dashboard";
import { StatusTag, type StatusKey } from "@/components/StatusTag";

const PAGE_SIZE = 10;

const statusOrder: Record<DashboardStatus, number> = {
  mismatch: 0,
  conflicting: 1,
  unverified: 2,
  confirmed: 3,
  matches: 4,
};

const filterStatuses: Array<"all" | DashboardStatus> = ["all", "mismatch", "confirmed", "unverified"];

function ShieldIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none">
      <path d="M12 3.75L18.5 6V11.15C18.5 15.3 15.88 18.96 12 20.5C8.12 18.96 5.5 15.3 5.5 11.15V6L12 3.75Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M9.5 12.25L11.25 14L14.75 10.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="px-4 py-10 text-muted">Loading dashboard…</div>}>
      <DashboardContent />
    </Suspense>
  );
}

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const stateFilter = searchParams.get("state") ?? "";
  const statusFilter = (searchParams.get("status") ?? "all") as "all" | DashboardStatus;
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);

  const unitsWithResults = fakeDashboardUnits.length;
  const confirmedCount = fakeDashboardUnits.filter((unit) => unit.status === "confirmed" || unit.status === "matches").length;
  const matchesCount = fakeDashboardUnits.filter((unit) => unit.status === "matches").length;
  const mismatchCount = fakeDashboardUnits.filter((unit) => unit.status === "mismatch").length;

  const lgAs = stateFilter
    ? fakeLocations.find((state) => state.name === stateFilter)?.lgas ?? []
    : [];

  const filteredUnits = useMemo(() => {
    return fakeDashboardUnits
      .filter((unit) => !stateFilter || unit.state === stateFilter)
      .filter((unit) => {
        const lgaFilter = searchParams.get("lga") ?? "";
        return !lgaFilter || unit.lga === lgaFilter;
      })
      .filter((unit) => statusFilter === "all" || unit.status === statusFilter)
      .sort((a, b) => {
        const statusDifference = statusOrder[a.status] - statusOrder[b.status];
        return statusDifference || a.name.localeCompare(b.name);
      });
  }, [stateFilter, statusFilter, searchParams]);

  const pageCount = Math.max(1, Math.ceil(filteredUnits.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const startIndex = (safePage - 1) * PAGE_SIZE;
  const visibleUnits = filteredUnits.slice(startIndex, startIndex + PAGE_SIZE);

  const updateQuery = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (!value) next.delete(key);
      else next.set(key, value);
    });
    router.push(`/dashboard${next.toString() ? `?${next.toString()}` : ""}`);
  };

  const clearFilters = () => router.push("/dashboard");

  const coverage = totalUnits > 0 ? (unitsWithResults / totalUnits) * 100 : 0;
  const startNumber = filteredUnits.length === 0 ? 0 : startIndex + 1;
  const endNumber = filteredUnits.length === 0 ? 0 : Math.min(startIndex + PAGE_SIZE, filteredUnits.length);

  return (
    <main className="px-4 pb-10 pt-8 md:px-8 lg:px-10">
      <div className="mx-auto max-w-[1080px]">
        <h1 className="text-[2.2rem] font-bold leading-[1.1] text-brand md:text-[2.8rem]">Dashboard</h1>
        <p className="mt-3 max-w-[650px] text-base leading-7 text-muted">See which polling units have results and where our scores differ from IReV.</p>
        <p className="mt-2 text-xs text-muted">Sample data. Updated {lastUpdated}.</p>

        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: "Units with results", value: unitsWithResults, red: false },
            { label: "Confirmed", value: confirmedCount, red: false },
            { label: "Matches IReV", value: matchesCount, red: false },
            { label: "Mismatches", value: mismatchCount, red: true },
          ].map((card) => (
            <div key={card.label} className="border border-line bg-white p-4 shadow-[0_8px_12px_-8px_rgba(0,0,0,0.3)]">
              <p className="text-xs font-medium text-muted md:text-sm">{card.label}</p>
              <p className={`mt-2 text-[2rem] font-bold leading-none ${card.red ? "text-[#B42318]" : "text-brand"}`}>{card.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-bold text-ink">Coverage</span>
            <span className="font-medium text-muted">{unitsWithResults} of {totalUnits.toLocaleString()} units</span>
          </div>
          <div className="h-[10px] overflow-hidden bg-[#DCE2DE]">
            <div className="h-full bg-brand" style={{ width: `${coverage}%` }} />
          </div>
        </div>

        <section className="mt-7">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label htmlFor="dashboard-state" className="mb-2 block text-sm font-bold text-ink">State</label>
              <select
                id="dashboard-state"
                value={stateFilter}
                onChange={(event) => updateQuery({ state: event.target.value || null, lga: null, page: "1" })}
                className="h-[52px] w-full border border-line bg-white px-3 text-base text-ink outline-none focus:border-brand"
              >
                <option value="">All states</option>
                {fakeLocations.map((state) => <option key={state.name} value={state.name}>{state.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="dashboard-lga" className="mb-2 block text-sm font-bold text-ink">LGA</label>
              <select
                id="dashboard-lga"
                value={searchParams.get("lga") ?? ""}
                disabled={!stateFilter}
                onChange={(event) => updateQuery({ lga: event.target.value || null, page: "1" })}
                className="h-[52px] w-full border border-line bg-white px-3 text-base text-ink outline-none disabled:bg-[#EEF0EF] disabled:text-[#9BA39F] focus:border-brand"
              >
                <option value="">All LGAs</option>
                {lgAs.map((lga) => <option key={lga.name} value={lga.name}>{lga.name}</option>)}
              </select>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {filterStatuses.map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => updateQuery({ status: status === "all" ? null : status, page: "1" })}
                className={`h-[44px] border px-4 text-sm font-bold ${statusFilter === status ? "border-brand bg-brand text-white" : "border-brand bg-white text-brand"}`}
              >
                {status === "all" ? "All" : status === "mismatch" ? "Mismatch" : status === "confirmed" ? "Confirmed" : "Unverified"}
              </button>
            ))}
          </div>
        </section>

        {visibleUnits.length === 0 ? (
          <div className="mt-6 border border-line bg-[#EEF0EF] p-5 text-center">
            <p className="text-sm font-medium text-muted">No polling units match these filters.</p>
            <button type="button" onClick={clearFilters} className="mt-4 h-[44px] border border-brand bg-white px-5 text-sm font-bold text-brand">Clear filters</button>
          </div>
        ) : (
          <>
            <div className="mt-6 grid gap-3 lg:hidden">
              {visibleUnits.map((unit) => (
                <article key={unit.code} className="border border-line bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="text-base font-bold text-ink">{unit.name}</h2>
                      <p className="mt-1 text-xs text-muted">{unit.code} · {unit.lga} · {unit.state}</p>
                    </div>
                    <StatusTag status={unit.status as StatusKey} />
                  </div>
                  <p className="mt-3 text-sm text-muted">{unit.note}</p>
                  <Link href={`/unit/${encodeURIComponent(unit.code)}?state=${unit.status}`} className="mt-3 inline-block text-sm font-bold text-brand underline underline-offset-4">View unit</Link>
                </article>
              ))}
            </div>

            <div className="mt-6 hidden overflow-hidden border border-line lg:block">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-[#EEF0EF]">
                  <tr className="border-b border-line">
                    <th className="px-4 py-3 text-left font-bold text-ink">Unit</th>
                    <th className="px-4 py-3 text-left font-bold text-ink">Code</th>
                    <th className="px-4 py-3 text-left font-bold text-ink">LGA</th>
                    <th className="px-4 py-3 text-left font-bold text-ink">State</th>
                    <th className="px-4 py-3 text-left font-bold text-ink">Status</th>
                    <th className="px-4 py-3 text-left font-bold text-ink">Details</th>
                    <th className="px-4 py-3 text-right font-bold text-ink"></th>
                  </tr>
                </thead>
                <tbody>
                  {visibleUnits.map((unit) => (
                    <tr key={unit.code} className="border-b border-line last:border-b-0">
                      <td className="px-4 py-4 font-bold text-ink">{unit.name}</td>
                      <td className="px-4 py-4 text-muted">{unit.code}</td>
                      <td className="px-4 py-4 text-muted">{unit.lga}</td>
                      <td className="px-4 py-4 text-muted">{unit.state}</td>
                      <td className="px-4 py-4"><StatusTag status={unit.status as StatusKey} /></td>
                      <td className="px-4 py-4 text-muted">{unit.note}</td>
                      <td className="px-4 py-4 text-right"><Link href={`/unit/${encodeURIComponent(unit.code)}?state=${unit.status}`} className="font-bold text-brand underline underline-offset-4">View unit</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-5 flex items-center justify-between gap-3">
              <p className="text-sm text-muted">Showing {startNumber} to {endNumber} of {filteredUnits.length}</p>
              <div className="flex gap-2">
                <button type="button" disabled={safePage === 1} onClick={() => updateQuery({ page: String(safePage - 1) })} className="h-[44px] border border-brand bg-white px-4 text-sm font-bold text-brand disabled:border-line disabled:text-[#9BA39F]">Previous</button>
                <button type="button" disabled={safePage === pageCount} onClick={() => updateQuery({ page: String(safePage + 1) })} className="h-[44px] border border-brand bg-white px-4 text-sm font-bold text-brand disabled:border-line disabled:text-[#9BA39F]">Next</button>
              </div>
            </div>
          </>
        )}

        <aside className="mt-7 flex items-start gap-3 border border-[#D1E7D8] bg-[#EEF8F1] p-4">
          <div className="mt-0.5 text-brand"><ShieldIcon /></div>
          <p className="text-sm leading-6 text-ink md:text-base"><span className="font-bold">We record results for every party.</span> We never ask who you voted for.</p>
        </aside>
      </div>
    </main>
  );
}
