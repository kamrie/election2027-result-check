"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { StatusTag } from "@/components/StatusTag";
import type { listSubmissions, ReviewStatus } from "@/lib/admin-results.server";

type Page = Awaited<ReturnType<typeof listSubmissions>>;
const filters = [
  ["FLAGGED", "Flagged"], ["ALL", "All"], ["PENDING", "Pending"], ["REMOVED", "Removed"],
] as const;
const action = "border border-brand px-4 py-2 text-sm font-bold text-brand disabled:opacity-60";

export default function SubmissionReview({ photoReview }: { photoReview: ReactNode }) {
  const router = useRouter();
  const [filter, setFilter] = useState<ReviewStatus | "ALL">("FLAGGED");
  const [cursor, setCursor] = useState<number | null>(null);
  const [page, setPage] = useState<Page | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  const [decision, setDecision] = useState<{ id: number; reason: "FAKE" | "DUPLICATE" } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({ status: filter });
    if (cursor !== null) query.set("before", String(cursor));
    async function load() {
      try {
        const response = await fetch("/api/admin/submissions?" + query, { signal: controller.signal, cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        if (!controller.signal.aborted) setPage(data);
      } catch (error) {
        if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Could not load submissions.");
      }
    }
    void load();
    return () => controller.abort();
  }, [filter, cursor, reload]);

  function reset(nextFilter: ReviewStatus | "ALL", nextCursor: number | null) {
    setPage(null);
    setError("");
    setNotice("");
    setDecision(null);
    setFilter(nextFilter);
    setCursor(nextCursor);
    setReload((count) => count + 1);
  }

  async function confirmRemoval() {
    if (!decision || busy) return;
    setError("");
    setBusy(true);
    try {
      const response = await fetch("/api/admin/submissions", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(decision),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setDecision(null);
      setNotice(data.message);
      setPage(null);
      setReload((count) => count + 1);
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not remove submission.");
    } finally {
      setBusy(false);
    }
  }

  return <>
    {photoReview}
    <section className="mt-6">
      <h2 className="text-xl font-bold text-brand">Submissions</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {filters.map(([key, label]) => (
          <button key={key} type="button" aria-pressed={filter === key} disabled={busy} onClick={() => reset(key, null)}
            className={action + (filter === key ? " bg-[#008751] !text-white" : " bg-white")}>{label}</button>
        ))}
      </div>
      {notice && <p className="mt-3 text-sm text-brand font-bold" role="status">{notice}</p>}
      {error && <p className="mt-3 text-sm text-[#B42318] font-bold" role="alert">{error}</p>}
      {!page && !error && <p role="status" className="mt-4 text-muted">Loading submissions...</p>}
      {!page && error && <button className={action + " mt-3"} onClick={() => reset(filter, cursor)}>Try again</button>}
      {page?.items.length === 0 && <p className="mt-4 text-muted">No submissions match this filter.</p>}
      <div className="mt-4 grid gap-3">
        {page?.items.map((item) => (
          <article key={item.id} className="border border-line bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-bold text-ink">Submission {item.id}</p>
                <p className="text-sm text-muted">{item.code} / {item.name} / {item.created}</p>
              </div>
              <StatusTag status={item.status === "FLAGGED" ? "flagged" : item.status === "REMOVED" ? "removed" : "pending"} />
            </div>
            {item.photoFlag && <p className="mt-2 text-sm font-bold text-[#93370D]">Duplicate-photo flag</p>}
            {item.reason && <p className="mt-2 text-sm text-muted">Removed as {item.reason.toLowerCase()}.</p>}
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-bold text-brand">Review scores and photos</summary>
              <p className="mt-2 text-sm">Accredited {item.accredited} / Valid {item.valid} / Rejected {item.rejected}</p>
              <dl className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                {item.scores.map(({ abbreviation, score }) => (
                  <div key={abbreviation} className="border-b border-line"><dt>{abbreviation}</dt><dd className="font-bold">{score}</dd></div>
                ))}
              </dl>
              {item.photos.map((url, index) => <a key={index} href={url} className="mr-4 mt-3 inline-block text-sm font-bold text-brand underline">Photo {index + 1}</a>)}
            </details>
            {item.status !== "REMOVED" && (
              <div className="mt-4 flex flex-wrap gap-2">
                {decision?.id === item.id ? <>
                  <p className="w-full text-sm text-ink">Remove this submission as {decision.reason.toLowerCase()}? Its photos and scores will be retained.</p>
                  <button type="button" disabled={busy} onClick={() => void confirmRemoval()} className={action}>Confirm removal</button>
                  <button type="button" disabled={busy} onClick={() => setDecision(null)} className={action}>Cancel</button>
                </> : <>
                  <button type="button" disabled={busy} onClick={() => setDecision({ id: item.id, reason: "FAKE" })} className={action}>Mark as fake</button>
                  <button type="button" disabled={busy} onClick={() => setDecision({ id: item.id, reason: "DUPLICATE" })} className={action}>Mark as duplicate</button>
                </>}
              </div>
            )}
          </article>
        ))}
      </div>
      <div className="mt-4 flex gap-2">
        {cursor !== null && <button disabled={busy} className={action} onClick={() => reset(filter, null)}>First page</button>}
        {page?.next != null && <button disabled={busy} className={action} onClick={() => reset(filter, page.next)}>Next page</button>}
      </div>
    </section>
  </>;
}
