"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { z } from "zod";
import type { Party } from "@/lib/parties";
import { makeFakeConfirmedUnits, makeFakeSubmissions, type ConfirmedUnit, type SubmissionStatus } from "@/lib/fake-admin";
import { fakeLocations } from "@/lib/fake-locations";
import { StatusTag } from "@/components/StatusTag";

const wholeNumber = z.union([z.literal(""), z.string().regex(/^\d+$/, "Whole numbers only")]);

type AdminTab = "irev" | "submissions" | "export";

type IRevFields = Record<string, string>;

function ShieldIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none">
      <path d="M12 3.75L18.5 6V11.15C18.5 15.3 15.88 18.96 12 20.5C8.12 18.96 5.5 15.3 5.5 11.15V6L12 3.75Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M9.5 12.25L11.25 14L14.75 10.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 12L10.75 14.75L16 9.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" strokeLinejoin="round" />
    </svg>
  );
}

function escapeCsv(value: unknown) {
  let text = String(value ?? "");
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadCsv(filename: string, rows: unknown[][]) {
  const csv = rows.map((row) => row.map(escapeCsv).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function AdminContent({ parties }: { parties: Party[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryTab = searchParams.get("tab") as AdminTab | null;
  const activeTab: AdminTab = queryTab === "submissions" || queryTab === "export" ? queryTab : "irev";

  const [unitCode, setUnitCode] = useState("");
  const [unitError, setUnitError] = useState("");
  const [irevSaved, setIrevSaved] = useState(false);
  const [irevFields, setIrevFields] = useState<IRevFields>({});
  const [fakeConfirmedUnits] = useState(() => makeFakeConfirmedUnits(parties));
  const [submissions, setSubmissions] = useState(() => makeFakeSubmissions(parties));
  const [submissionFilter, setSubmissionFilter] = useState<"All" | "Needs attention" | "Flagged" | "Removed">("All");
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [confirmRemove, setConfirmRemove] = useState<number | null>(null);
  const [loadedUnit, setLoadedUnit] = useState<ConfirmedUnit | {
    code: string;
    name: string;
    ward: string;
    lga: string;
    state: string;
    confirmed: false;
  } | null>(null);

  const setTab = (tab: AdminTab) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set("tab", tab);
    router.push(`/admin?${next.toString()}`);
  };

  const loadUnit = () => {
    setIrevSaved(false);
    setUnitError("");
    const code = unitCode.trim().replace(/\//g, "-");
    let locationUnit: { code: string; name: string; ward: string; lga: string; state: string } | null = null;

    for (const state of fakeLocations) {
      for (const lga of state.lgas) {
        for (const ward of lga.wards) {
          const found = ward.units.find((unit) => unit.code === code);
          if (found) {
            locationUnit = { code: found.code, name: found.name, ward: ward.name, lga: lga.name, state: state.name };
            break;
          }
        }
        if (locationUnit) break;
      }
      if (locationUnit) break;
    }

    if (!locationUnit) {
      setUnitError("No polling unit found.");
      setIrevFields({});
      return;
    }

    setUnitError("");
    const confirmedUnit = fakeConfirmedUnits.find((unit) => unit.code === locationUnit.code);
    setLoadedUnit(confirmedUnit ? confirmedUnit : { ...locationUnit, confirmed: false });
    const fields: IRevFields = {};
    parties.forEach((party) => { fields[party.id] = ""; });
    fields.accredited = "";
    fields.valid = "";
    fields.rejected = "";
    setIrevFields(fields);
  };

  const updateIrevField = (key: string | number, value: string) => {
    const result = wholeNumber.safeParse(value);
    if (result.success) {
      setIrevFields((current) => ({ ...current, [key]: value }));
      setIrevSaved(false);
    }
  };

  const allIrevFilled = [
    ...parties.map((party) => irevFields[party.id]),
    irevFields.accredited,
    irevFields.valid,
    irevFields.rejected,
  ].every((value) => value !== "" && wholeNumber.safeParse(value).success);

  let differingParties = 0;
  if (loadedUnit?.confirmed) {
    parties.forEach((party) => {
      const value = irevFields[party.id];
      if (value !== "" && Number(value) !== (loadedUnit.scores[party.id] ?? 0)) differingParties += 1;
    });
  }

  const saveIrev = () => {
    if (!loadedUnit || !allIrevFilled) return;
    const data = { unitCode: loadedUnit.code, fields: irevFields };
    console.log("IReV result (sample):", data);
    // TODO: Send this IReV result to the database through an admin API.
    setIrevSaved(true);
  };

  const attentionCount = submissions.filter((submission) => submission.status !== "REMOVED" && (submission.sheetDoesNotAdd || submission.conflicting || submission.reported)).length;

  const filteredSubmissions = submissions.filter((submission) => {
    if (submissionFilter === "All") return true;
    if (submissionFilter === "Needs attention") return submission.status !== "REMOVED" && (submission.sheetDoesNotAdd || submission.conflicting || submission.reported);
    if (submissionFilter === "Flagged") return submission.status === "FLAGGED";
    return submission.status === "REMOVED";
  });

  const removeSubmission = (id: number) => {
    setSubmissions((current) => current.map((submission) => submission.id === id ? { ...submission, status: "REMOVED" as SubmissionStatus } : submission));
    setConfirmRemove(null);
    // TODO: Call the admin API to remove this submission from counts.
  };

  const restoreSubmission = (id: number) => {
    setSubmissions((current) => current.map((submission) => submission.id === id ? { ...submission, status: "PENDING" as SubmissionStatus } : submission));
    // TODO: Call the admin API to restore this submission.
  };

  const exportSubmissions = () => {
    const header = ["Volunteer", "Unit code", "Unit name", "Submitted time", "Status", ...parties.map((party) => party.abbreviation), "Accredited", "Valid", "Rejected"];
    const rows = submissions.map((submission) => [
      submission.volunteer,
      submission.unitCode,
      submission.unitName,
      submission.submittedTime,
      submission.status,
      ...parties.map((party) => submission.scores[party.id] ?? 0),
      submission.accredited,
      submission.valid,
      submission.rejected,
    ]);
    downloadCsv("submissions.csv", [header, ...rows]);
  };

  const exportIrev = () => {
    const header = ["Unit code", "Unit name", "Party", "Abbreviation", "Ours", "IReV"];
    const rows = fakeConfirmedUnits.flatMap((unit) => parties.map((party) => [
      unit.code,
      unit.name,
      party.name,
      party.abbreviation,
      unit.scores[party.id] ?? 0,
      "",
    ]));
    downloadCsv("irev-results.csv", [header, ...rows]);
  };

  return (
    <main className="px-4 pb-10 pt-8 md:px-8 lg:px-10">
      <div className="mx-auto max-w-[1080px]">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-[2.2rem] font-bold leading-[1.1] text-brand md:text-[2.8rem]">Admin</h1>
          <span className="bg-brand-dark px-2 py-1 text-xs font-bold text-white">Admin</span>
        </div>
        <p className="mt-3 max-w-[650px] text-base leading-7 text-muted">Enter IReV results, review submissions and export data. Only admins can see this page.</p>
        <div className="mt-4 border border-[#E3C868] bg-[#FFF4C9] px-4 py-3 text-sm font-medium text-[#6B5310]">Sample data. Not connected to the database yet.</div>

        <div className="mt-6 grid grid-cols-3 gap-2">
          {([
            ["irev", "IReV entry"],
            ["submissions", "Submissions"],
            ["export", "Export"],
          ] as const).map(([tab, label]) => (
            <button
              key={tab}
              type="button"
              onClick={() => setTab(tab)}
              className={`relative h-[52px] border px-2 text-sm font-bold md:text-base ${activeTab === tab ? "border-brand bg-brand text-white" : "border-brand bg-white text-brand"}`}
            >
              {label}
              {tab === "submissions" && attentionCount > 0 && (
                <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center bg-[#B42318] px-1 text-xs text-white">{attentionCount}</span>
              )}
            </button>
          ))}
        </div>

        {activeTab === "irev" && (
          <section className="mt-6">
            <h2 className="text-xl font-bold text-brand">IReV entry</h2>
            <div className="mt-3 flex gap-2">
              <input
                type="text"
                value={unitCode}
                onChange={(event) => setUnitCode(event.target.value)}
                placeholder="Polling unit code"
                aria-label="Polling unit code"
                className="h-[52px] min-w-0 flex-1 border border-line bg-white px-3 text-base text-ink outline-none focus:border-brand"
              />
              <button type="button" onClick={loadUnit} className="h-[52px] bg-brand px-5 text-sm font-bold text-white">Load</button>
            </div>
            {unitError && <p className="mt-3 text-sm font-bold text-[#B42318]">{unitError}</p>}

            {loadedUnit && (
              <>
                <div className="mt-5 border border-line bg-white p-4 shadow-[0_8px_12px_-8px_rgba(0,0,0,0.3)]">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-bold text-ink">{loadedUnit.name}</p>
                      <p className="mt-1 text-sm text-muted">{loadedUnit.code} · {loadedUnit.ward} · {loadedUnit.lga} · {loadedUnit.state}</p>
                    </div>
                    <StatusTag status={loadedUnit.confirmed ? "confirmed" : "no-results"} />
                  </div>
                  {!loadedUnit.confirmed && <div className="mt-4 border border-line bg-[#EEF0EF] px-3 py-3 text-sm text-muted">This unit has no confirmed result yet. You can still enter the IReV scores.</div>}
                </div>

                <div className="mt-5 overflow-x-auto border border-line">
                  <table className="w-full min-w-[620px] border-collapse text-sm">
                    <thead className="bg-[#EEF0EF]">
                      <tr className="border-b border-line"><th className="px-3 py-3 text-left">Party</th><th className="px-3 py-3 text-right">Ours</th><th className="w-[180px] px-3 py-3 text-right">IReV</th><th className="px-3 py-3 text-right">Diff</th></tr>
                    </thead>
                    <tbody>
                      {parties.map((party) => {
                        const ours = loadedUnit.confirmed ? loadedUnit.scores[party.id] ?? 0 : null;
                        const value = irevFields[party.id] ?? "";
                        const differs = loadedUnit.confirmed && value !== "" && Number(value) !== ours;
                        const difference = loadedUnit.confirmed ? Number(ours) - Number(value) : 0;
                        return (
                          <tr key={party.id} className={`border-b border-line ${differs ? "bg-[#FEE4E2]" : "bg-white"}`}>
                            <th className="px-3 py-3 text-left font-bold text-ink">{party.name} <span className="font-medium text-muted">({party.abbreviation})</span></th>
                            <td className="px-3 py-3 text-right font-bold text-ink">{ours === null ? "—" : ours}</td>
                            <td className="px-3 py-3 text-right"><input type="number" inputMode="numeric" min="0" value={value} onChange={(event) => updateIrevField(party.id, event.target.value)} className={`h-[36px] w-[100px] border bg-white px-2 text-right outline-none ${differs ? "border-[#B42318]" : "border-line focus:border-brand"}`} /></td>
                            <td className={`px-3 py-3 text-right font-bold ${differs ? "text-[#B42318]" : "text-brand"}`}>{!loadedUnit.confirmed || value === "" ? "" : differs ? (difference > 0 ? `+${difference}` : String(difference)) : <span className="flex justify-end"><CheckIcon /></span>}</td>
                          </tr>
                        );
                      })}
                      {(
                        ["accredited", "valid", "rejected"] as const
                      ).map((key) => {
                        const label = key.charAt(0).toUpperCase() + key.slice(1);
                        const ours = loadedUnit.confirmed ? loadedUnit[key] : null;
                        const value = irevFields[String(key)] ?? "";
                        const differs = loadedUnit.confirmed && value !== "" && Number(value) !== Number(ours);
                        const difference = loadedUnit.confirmed ? Number(ours) - Number(value) : 0;
                        return (
                          <tr key={String(key)} className={`border-t border-line ${differs ? "bg-[#FEE4E2]" : "bg-[#F7FAF8]"}`}>
                            <th className="px-3 py-3 text-left font-bold text-ink">{label}</th>
                            <td className="px-3 py-3 text-right font-bold text-ink">{ours === null ? "—" : String(ours)}</td>
                            <td className="px-3 py-3 text-right"><input type="number" inputMode="numeric" min="0" value={value} onChange={(event) => updateIrevField(String(key), event.target.value)} className={`h-[36px] w-[100px] border bg-white px-2 text-right outline-none ${differs ? "border-[#B42318]" : "border-line focus:border-brand"}`} /></td>
                            <td className={`px-3 py-3 text-right font-bold ${differs ? "text-[#B42318]" : "text-brand"}`}>{!loadedUnit.confirmed || value === "" ? "" : differs ? (difference > 0 ? `+${difference}` : String(difference)) : <span className="flex justify-end"><CheckIcon /></span>}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <p className={`mt-4 text-sm font-bold ${differingParties > 0 ? "text-[#B42318]" : "text-brand"}`}>{differingParties === 1 ? "1 party differs from our confirmed scores." : differingParties >= 2 ? `${differingParties} parties differ from our confirmed scores.` : "All scores match."}</p>
                {irevSaved && <p className="mt-3 text-sm font-bold text-brand">IReV result saved (sample)</p>}
                <button type="button" disabled={!allIrevFilled} onClick={saveIrev} className="mt-5 h-[52px] w-full bg-brand text-base font-bold text-white shadow-[0_5px_0_0_#005C37] disabled:bg-[#A7AFAB] disabled:shadow-[0_5px_0_0_#7E8782] disabled:cursor-not-allowed">Save IReV result</button>
              </>
            )}
          </section>
        )}

        {activeTab === "submissions" && (
          <section className="mt-6">
            <h2 className="text-xl font-bold text-brand">Submissions</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {(["All", "Needs attention", "Flagged", "Removed"] as const).map((filter) => (
                <button key={filter} type="button" onClick={() => setSubmissionFilter(filter)} className={`h-[44px] border px-4 text-sm font-bold ${submissionFilter === filter ? "border-brand bg-brand text-white" : "border-brand bg-white text-brand"}`}>{filter}</button>
              ))}
            </div>

            <div className="mt-5 grid gap-3">
              {filteredSubmissions.map((submission) => (
                <article key={submission.id} className="border border-line bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-ink">{submission.volunteer}</p>
                      <p className="mt-1 text-sm text-muted">{submission.unitCode} · {submission.unitName}</p>
                      <p className="mt-1 text-xs text-muted">Submitted {submission.submittedTime}</p>
                    </div>
                    <StatusTag status={submission.status === "REMOVED" ? "removed" : submission.status === "FLAGGED" ? "pending" : "pending"} />
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {submission.sheetDoesNotAdd && <span className="bg-[#FEE4E2] px-2 py-1 text-xs font-bold text-[#B42318]">Sheet does not add up</span>}
                    {submission.conflicting && <span className="bg-[#FEF0C7] px-2 py-1 text-xs font-bold text-[#93370D]">Conflicting</span>}
                    {submission.reported && <span className="bg-[#FEF0C7] px-2 py-1 text-xs font-bold text-[#93370D]">Reported</span>}
                  </div>

                  <button type="button" onClick={() => setExpanded((current) => ({ ...current, [submission.id]: !current[submission.id] }))} className="mt-3 text-sm font-bold text-brand underline underline-offset-4">{expanded[submission.id] ? "Hide scores" : "Show scores"}</button>
                  {expanded[submission.id] && (
                    <div className="mt-3 border-t border-line pt-3">
                      {parties.map((party) => (
                        <div key={party.id} className="flex justify-between border-b border-line py-2 text-sm last:border-b-0"><span>{party.name} ({party.abbreviation})</span><strong>{submission.scores[party.id] ?? 0}</strong></div>
                      ))}
                      <p className="mt-2 text-xs text-muted">Accredited {submission.accredited} · Valid {submission.valid} · Rejected {submission.rejected}</p>
                    </div>
                  )}

                  {confirmRemove === submission.id ? (
                    <div className="mt-4 border border-[#B42318] bg-[#FFF6F5] p-3">
                      <p className="text-sm font-bold text-[#B42318]">Remove this submission from the count?</p>
                      <div className="mt-3 flex gap-2"><button type="button" onClick={() => removeSubmission(submission.id)} className="h-[44px] border border-[#B42318] bg-white px-4 text-sm font-bold text-[#B42318]">Yes, remove</button><button type="button" onClick={() => setConfirmRemove(null)} className="h-[44px] border border-line bg-white px-4 text-sm font-bold text-ink">Cancel</button></div>
                    </div>
                  ) : (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {submission.status !== "REMOVED" && <><button type="button" onClick={() => setConfirmRemove(submission.id)} className="h-[44px] border border-[#B42318] bg-white px-4 text-sm font-bold text-[#B42318]">Mark as fake</button><button type="button" onClick={() => setConfirmRemove(submission.id)} className="h-[44px] border border-brand bg-white px-4 text-sm font-bold text-brand">Mark as duplicate</button></>}
                      {submission.status === "REMOVED" && <button type="button" onClick={() => restoreSubmission(submission.id)} className="h-[44px] border border-brand bg-white px-4 text-sm font-bold text-brand">Restore</button>}
                    </div>
                  )}
                </article>
              ))}
            </div>
          </section>
        )}

        {activeTab === "export" && (
          <section className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="border border-line bg-white p-5 shadow-[0_8px_12px_-8px_rgba(0,0,0,0.3)]"><h2 className="text-lg font-bold text-ink">Submissions</h2><p className="mt-2 text-sm leading-6 text-muted">Export the sample submission records, flags and party scores.</p><button type="button" onClick={exportSubmissions} className="mt-5 h-[52px] w-full bg-brand text-sm font-bold text-white">Export submissions (CSV)</button></div>
            <div className="border border-line bg-white p-5 shadow-[0_8px_12px_-8px_rgba(0,0,0,0.3)]"><h2 className="text-lg font-bold text-ink">IReV results</h2><p className="mt-2 text-sm leading-6 text-muted">Export the sample confirmed scores and IReV comparison fields.</p><button type="button" onClick={exportIrev} className="mt-5 h-[52px] w-full bg-brand text-sm font-bold text-white">Export IReV results (CSV)</button></div>
          </section>
        )}

        <aside className="mt-7 flex items-start gap-3 border border-[#D1E7D8] bg-[#EEF8F1] p-4"><div className="mt-0.5 text-brand"><ShieldIcon /></div><p className="text-sm leading-6 text-ink md:text-base"><span className="font-bold">We record results for every party.</span> We never ask who you voted for.</p></aside>
      </div>
    </main>
  );
}
