"use client";

import type { ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Party } from "@/lib/parties";
import IrevEntryForm from "./IrevEntryForm";
import SubmissionReview from "./SubmissionReview";

type AdminTab = "irev" | "submissions" | "export";

function ShieldIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none">
      <path d="M12 3.75L18.5 6V11.15C18.5 15.3 15.88 18.96 12 20.5C8.12 18.96 5.5 15.3 5.5 11.15V6L12 3.75Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M9.5 12.25L11.25 14L14.75 10.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function AdminContent({ parties, photoReview }: { parties: Party[]; photoReview: ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryTab = searchParams.get("tab");
  const activeTab: AdminTab = queryTab === "submissions" || queryTab === "export" ? queryTab : "irev";
  function setTab(tab: AdminTab) {
    router.push("/admin?" + new URLSearchParams({ tab }));
  }

  return (
    <main className="px-4 pb-10 pt-8 md:px-8 lg:px-10">
      <div className="mx-auto max-w-[1080px]">
        <h1 className="text-[2.2rem] font-bold leading-tight text-brand md:text-[2.8rem]">Admin</h1>
        <p className="mt-3 max-w-[650px] text-base leading-7 text-muted">Enter IReV results, review submissions and export data.</p>
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
            </button>
          ))}
        </div>

        {activeTab === "irev" && <IrevEntryForm parties={parties} />}
        {activeTab === "submissions" && <SubmissionReview photoReview={photoReview} />}
        {activeTab === "export" && (
          <section className="mt-6 grid gap-4 md:grid-cols-2">
            {([["submissions", "Submissions"], ["irev", "IReV results"]] as const).map(([dataset, label]) => (
              <div key={dataset} className="border border-line bg-white p-5 shadow-[0_8px_12px_-8px_rgba(0,0,0,0.3)]">
                <h2 className="text-lg font-bold text-ink">{label}</h2>
                <a href={"/api/admin/export?dataset=" + dataset} className="mt-5 flex h-[52px] items-center justify-center bg-brand text-sm font-bold text-white">
                  Export {label.toLowerCase()} (CSV)
                </a>
              </div>
            ))}
          </section>
        )}

        <aside className="mt-7 flex items-start gap-3 border border-[#D1E7D8] bg-[#EEF8F1] p-4"><div className="mt-0.5 text-brand"><ShieldIcon /></div><p className="text-sm leading-6 text-ink md:text-base"><span className="font-bold">We record results for every party.</span> We never ask who you voted for.</p></aside>
      </div>
    </main>
  );
}
