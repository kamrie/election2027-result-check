"use client";

import { useState, type FormEvent } from "react";
import { StatusTag, type StatusKey } from "@/components/StatusTag";
import { compareTallies, formatDifference, irevEntry, voteTotals, type IrevResult, type Tally } from "@/lib/irev";
import type { Party } from "@/lib/parties";
import { maxVoteCount } from "@/lib/submission-validation";
import type { SubmissionUnit } from "@/lib/submissions.server";

type Loaded = { unit: SubmissionUnit; status: StatusKey; confirmed: Tally | null; irev: IrevResult | null };

function fieldsFrom(result: IrevResult | null) {
  if (!result) return {};
  return Object.fromEntries([
    ...voteTotals.map(([key]) => [key, String(result[key])]),
    ...result.scores.map(({ partyId, score }) => [partyId, String(score)]),
  ]);
}

export default function IrevEntryForm({ parties }: { parties: Party[] }) {
  const [code, setCode] = useState("");
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [correcting, setCorrecting] = useState(false);
  const [busy, setBusy] = useState<"load" | "save" | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadUnit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy("load");
    setLoaded(null);
    setCorrecting(false);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/irev?" + new URLSearchParams({ unit: code }), { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setLoaded(data as Loaded);
      setFields(fieldsFrom(data.irev));
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not load the polling unit.");
    } finally {
      setBusy(null);
    }
  }

  const numericFields = [...parties.map(({ id }) => id), ...voteTotals.map(([key]) => key)];
  const complete = numericFields.every((key) => /^\d+$/.test(fields[key] ?? ""));
  const readOnly = Boolean(loaded?.irev && !correcting);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!loaded || !complete || readOnly || busy) return;
    setError("");
    setMessage("");
    const parsed = irevEntry.safeParse({
      unitCode: loaded.unit.code, correction: loaded.irev?.revision ?? null,
      accredited: Number(fields.accredited), valid: Number(fields.valid), rejected: Number(fields.rejected),
      scores: parties.map(({ id }) => ({ partyId: id, score: Number(fields[id]) })),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    setBusy("save");
    try {
      const response = await fetch("/api/admin/irev", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setLoaded({ ...loaded, irev: data.irev });
      setFields(fieldsFrom(data.irev));
      setCorrecting(false);
      setMessage(parsed.data.correction ? "IReV correction saved." : "IReV result saved.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not save the IReV result.");
    } finally {
      setBusy(null);
    }
  }

  const comparison = loaded?.confirmed && loaded.irev ? compareTallies(loaded.confirmed, loaded.irev, parties) : null;
  const ourScores = new Map(loaded?.confirmed?.scores.map(({ partyId, score }) => [partyId, score]));
  const rows = [
    ...parties.map(({ id, name, abbreviation }) => ({ key: id, label: name + " (" + abbreviation + ")", ours: ourScores.get(id) ?? null })),
    ...voteTotals.map(([key, label]) => ({ key, label, ours: loaded?.confirmed?.[key] ?? null })),
  ];

  return (
    <section className="mt-6">
      <h2 className="text-xl font-bold text-brand">IReV entry</h2>
      <form onSubmit={loadUnit} className="mt-3 flex gap-2">
        <input type="text" value={code} onChange={(event) => setCode(event.target.value)}
          disabled={Boolean(busy)} placeholder="Polling unit code" aria-label="Polling unit code"
          className="h-[52px] min-w-0 flex-1 border border-line bg-white px-3 text-ink outline-none focus:border-brand" />
        <button disabled={Boolean(busy) || !code.trim()} className="h-[52px] bg-brand px-5 text-sm font-bold text-white disabled:opacity-60">
          {busy === "load" ? "Loading..." : "Load"}
        </button>
      </form>

      {loaded && (
        <form onSubmit={save}>
          <div className="mt-5 border border-line bg-white p-4 shadow-[0_8px_12px_-8px_rgba(0,0,0,0.3)]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-bold text-ink">{loaded.unit.name}</p>
                <p className="mt-1 text-sm text-muted">{loaded.unit.code} / {loaded.unit.ward} / {loaded.unit.lga} / {loaded.unit.state}</p>
              </div>
              <StatusTag status={comparison?.status ?? loaded.status} />
            </div>
            {!loaded.confirmed && <p className="mt-3 text-sm text-muted">This unit has no confirmed result yet. You can still enter the IReV scores.</p>}
          </div>

          <div className="mt-5 overflow-x-auto border border-line">
            <table className="w-full min-w-[560px] border-collapse text-sm">
              <thead className="bg-[#EEF0EF]">
                <tr>{["Field", "Ours", "IReV", "Diff"].map((label, index) => (
                  <th key={label} scope="col" className={"px-3 py-3 " + (index === 0 ? "text-left" : "text-right")}>{label}</th>
                ))}</tr>
              </thead>
              <tbody>
                {rows.map(({ key, label, ours }) => {
                  const value = fields[key] ?? "";
                  const difference = formatDifference(ours, value === "" ? null : Number(value));
                  const differs = value !== "" && Boolean(loaded.confirmed) && difference !== "0";
                  return (
                    <tr key={key} className={"border-t border-line " + (differs ? "bg-[#FEE4E2]" : "bg-white")}>
                      <th scope="row" className="px-3 py-3 text-left font-bold text-ink">{label}</th>
                      <td className="px-3 py-3 text-right">{ours ?? "—"}</td>
                      <td className="px-3 py-3 text-right">
                        <input aria-label={label + " IReV"} type="number" inputMode="numeric" min={0} max={maxVoteCount}
                          value={value} readOnly={readOnly} disabled={Boolean(busy)}
                          onChange={(event) => {
                            const next = event.target.value;
                            if (next !== "" && !/^\d+$/.test(next)) return;
                            setFields((current) => ({ ...current, [key]: next }));
                            setMessage("");
                          }}
                          className="h-9 w-24 border border-line bg-white px-2 text-right outline-none focus:border-brand" />
                      </td>
                      <td className={"px-3 py-3 text-right font-bold " + (differs ? "text-[#B42318]" : "text-muted")}>{difference ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {readOnly ? (
            <button type="button" disabled={Boolean(busy)} onClick={() => { setCorrecting(true); setMessage(""); }}
              className="mt-5 h-[52px] border border-brand bg-white px-5 text-sm font-bold text-brand">Correct saved IReV result</button>
          ) : (
            <div className="mt-5 flex flex-wrap gap-3">
              <button disabled={!complete || Boolean(busy)} className="h-[52px] bg-brand px-5 text-sm font-bold text-white disabled:opacity-60">
                {busy === "save" ? "Saving..." : correcting ? "Save correction" : "Save IReV result"}
              </button>
              {correcting && <button type="button" disabled={Boolean(busy)}
                onClick={() => { setFields(fieldsFrom(loaded.irev)); setCorrecting(false); setError(""); }}
                className="h-[52px] border border-brand px-5 text-sm font-bold text-brand">Cancel correction</button>}
            </div>
          )}
        </form>
      )}
      {error && <p role="alert" className="mt-3 text-sm font-bold text-[#B42318]">{error}</p>}
      {message && <p role="status" className="mt-3 text-sm font-bold text-brand">{message}</p>}
    </section>
  );
}
