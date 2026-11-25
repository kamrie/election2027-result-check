import Link from "next/link";
import { Suspense } from "react";
import { getPublicResults } from "@/lib/public-results.server";
import { StatCard } from "@/components/StatCard";
import { brandTagline } from "@/lib/brand";

const steps = [
  {
    number: 1,
    title: "Photograph the sheet",
    description: "Use the result posted at your unit.",
  },
  {
    number: 2,
    title: "Enter the scores",
    description: "Type in the votes for every party.",
  },
  {
    number: 3,
    title: "See if it matches",
    description: "We compare it with the IReV portal.",
  },
];

export default function Home() {
  return (
    <main className="px-4 pb-10 pt-8 md:px-8 lg:px-10">
      <div className="lg:grid lg:grid-cols-[1.2fr_0.8fr] lg:items-center lg:gap-10">
        <section className="lg:pt-8">
          <div className="flex items-center gap-3 text-sm font-medium text-brand-dark">
            <span className="block h-[3px] w-[28px] bg-brand" />
            <span>Nigeria 2027 general election</span>
          </div>

          <h1 className="mt-4 max-w-[12ch] text-[2.8rem] font-bold leading-[1.1] text-brand md:text-[3.4rem] lg:text-[4.4rem]">
            {brandTagline}
          </h1>

          <p className="mt-4 max-w-[28rem] text-base font-normal leading-7 text-muted md:text-lg">
            Photograph the result sheet at your polling unit and compare it with what INEC publishes.
          </p>

          <div className="mt-6 flex flex-col gap-3 md:flex-row md:flex-wrap">
            <Link
              href="/submit"
              className="flex h-[52px] items-center justify-center bg-brand px-6 text-base font-bold text-white shadow-[0_5px_0_0_#005C37] md:min-w-[220px]"
            >
              Submit a result
            </Link>

            <Link
              href="/find-unit"
              className="flex h-[52px] items-center justify-center border border-brand bg-white px-6 text-base font-bold text-brand shadow-[0_5px_0_0_#005C37] md:min-w-[260px]"
            >
              Find your polling unit
            </Link>
          </div>
        </section>

        <aside className="mt-8 grid grid-cols-2 gap-3 lg:mt-0 lg:grid-cols-1 lg:items-center lg:gap-4">
          <Suspense fallback={<p role="status" className="col-span-full text-muted">Loading statistics...</p>}>
            <HomeStats />
          </Suspense>
        </aside>
      </div>

      <section className="mt-10 md:mt-12">
        <h2 className="text-[2.1rem] font-bold leading-none text-brand md:text-[2.5rem]">
          How it works
        </h2>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {steps.map((step) => (
            <div key={step.number} className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center border border-brand bg-white text-lg font-bold text-brand">
                {step.number}
              </div>

              <div>
                <p className="text-lg font-bold text-ink">{step.title}</p>
                <p className="mt-1 text-sm font-normal leading-5 text-muted">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-10 border border-line bg-[#eef8f1] p-4 shadow-[0_8px_12px_-8px_rgba(0,0,0,0.3)] md:mt-12 lg:w-full">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center bg-brand text-white">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M12 3.75L18.5 6V11.15C18.5 15.3 15.88 18.96 12 20.5C8.12 18.96 5.5 15.3 5.5 11.15V6L12 3.75Z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
              <path
                d="M9.5 12.25L11.25 14L14.75 10.5"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <p className="text-base leading-6 text-ink md:text-lg">
            <span className="font-bold">We record results for every party.</span> We never ask who you voted for.
          </p>
        </div>
      </div>
    </main>
  );
}

async function HomeStats() {
  const report = await getPublicResults().catch(() => null);
  if (!report) return <p role="alert" className="col-span-full text-muted">Statistics are temporarily unavailable.</p>;
  return <>
    <StatCard label="Units covered" value={report.stats.covered.toLocaleString("en-NG")} />
    <StatCard label="Mismatches found" value={report.stats.mismatches.toLocaleString("en-NG")} />
  </>;
}
