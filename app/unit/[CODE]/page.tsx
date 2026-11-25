import Link from "next/link";
import { Suspense } from "react";
import { StatusTag } from "@/components/StatusTag";
import { pollingUnitCode } from "@/lib/submission-validation";
import { findSubmissionUnit } from "@/lib/submissions.server";
import { compareTallies } from "@/lib/irev";
import { getIrevResult } from "@/lib/irev.server";
import { getActiveParties } from "@/lib/parties.server";
import { getUnitVerification } from "@/lib/unit-verification.server";

export const instant = false;

const descriptions = {
	"no-results": "No submissions have been made for this polling unit.",
	unverified: "Submissions are awaiting another eligible match or evidence review.",
	confirmed: "At least two accounts submitted matching scores and totals with no unresolved evidence flags.",
	conflicting: "Eligible submissions disagree on scores or vote totals.",
	matches: "The confirmed scores and vote totals match the entered IReV result.",
	mismatch: "The confirmed tally differs from the entered IReV result. Differences are highlighted below.",
};

function ShieldIcon() {
	return (
		<svg
			aria-hidden="true"
			viewBox="0 0 24 24"
			className="h-5 w-5"
			fill="none"
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
	);
}

export default function UnitPage({ params }: { params: Promise<{ CODE: string }> }) {
	return (
		<Suspense fallback={<p className="px-4 py-10 text-muted">Loading polling unit...</p>}>
			<UnitPageContent params={params} />
		</Suspense>
	);
}

async function UnitPageContent({ params }: { params: Promise<{ CODE: string }> }) {
	const { CODE } = await params;
	const code = pollingUnitCode.safeParse(CODE);
	const selectedUnit = code.success ? await findSubmissionUnit(code.data).catch(() => undefined) : null;
	if (selectedUnit === undefined) {
		return <p role="alert" className="px-4 py-10 text-muted">Could not load this polling unit. Try again.</p>;
	}
	if (!selectedUnit) {
		return (
			<main className="px-4 py-10">
				<h1 className="text-2xl font-bold text-brand">Polling unit not found</h1>
				<Link href="/find-unit" className="mt-4 inline-block font-bold text-brand underline">Find another unit</Link>
			</main>
		);
	}

	const verification = await getUnitVerification(selectedUnit.id).catch(() => null);
	if (!verification) {
		return <p role="alert" className="px-4 py-10 text-muted">Could not load the submitted results. Try again.</p>;
	}
	const { result } = verification;
	const comparison = result && verification.status === "confirmed"
		? await (async () => {
			const irev = await getIrevResult(selectedUnit.id);
			if (!irev) return null;
			const parties = await getActiveParties(false);
			return compareTallies(result, irev, parties);
		})().catch(() => undefined)
		: null;
	const status = comparison?.status ?? verification.status;

	return (
		<main className="px-4 pb-10 pt-6 md:px-8 lg:px-10">
			<div className="mx-auto max-w-[760px]">
				<nav
					aria-label="Breadcrumb"
					className="flex flex-wrap items-center gap-1 text-sm text-muted"
				>
					<Link
						href="/find-unit"
						className="font-bold text-brand"
					>
						Find your polling unit
					</Link>
					<span aria-hidden="true">›</span>
					<span className="text-ink">Unit {selectedUnit.code}</span>
				</nav>

				<div className="mt-5">
					<h1 className="text-[2.1rem] font-bold leading-[1.1] text-brand md:text-[2.8rem]">
						{selectedUnit.name}
					</h1>
					<p className="mt-2 text-sm font-medium text-muted md:text-base">
						{selectedUnit.code} · {selectedUnit.ward} · {selectedUnit.lga} ·{" "}
						{selectedUnit.state}
					</p>
					<div className="mt-4">
						<StatusTag status={status} />
					</div>
					<p className="mt-3 max-w-[650px] text-sm leading-6 text-muted md:text-base">
						{descriptions[status]}
					</p>
				</div>

				{comparison === undefined && (
					<p role="alert" className="mt-5 text-sm text-muted">Could not load the IReV comparison. Try again.</p>
				)}
				{comparison && (
					<section className="mt-7">
						<h2 className="text-xl font-bold text-brand">IReV comparison</h2>
						<div className="mt-3 overflow-x-auto border border-line">
							<table className="w-full min-w-[440px] border-collapse text-sm">
								<thead className="bg-[#EEF0EF]">
									<tr>
										<th scope="col" className="px-3 py-3 text-left">Field</th>
										<th scope="col" className="px-3 py-3 text-right">Ours</th>
										<th scope="col" className="px-3 py-3 text-right">IReV</th>
										<th scope="col" className="px-3 py-3 text-right" title="Our confirmed value minus IReV">Diff</th>
									</tr>
								</thead>
								<tbody>
									{comparison.rows.map(({ key, label, ours, irev, differs, difference }) => (
										<tr key={key} className={"border-t border-line " + (differs ? "bg-[#FEE4E2]" : "bg-white")}>
											<th scope="row" className="px-3 py-3 text-left font-bold text-ink">{label}</th>
											<td className="px-3 py-3 text-right">{ours ?? "Missing"}</td>
											<td className="px-3 py-3 text-right">{irev ?? "Missing"}</td>
											<td className={"px-3 py-3 text-right font-bold " + (differs ? "text-[#B42318]" : "text-muted")}>{difference ?? "Missing"}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
						<p className="mt-2 text-xs font-medium text-muted">Diff is our confirmed value minus IReV.</p>
					</section>
				)}

				{result && !comparison && (
					<section className="mt-7">
						<h2 className="text-xl font-bold text-brand">
							Submitted scores
						</h2>
						<div className="mt-3 overflow-hidden border border-line">
							<table className="w-full border-collapse text-sm">
								<tbody>
									{result.scores.map((party) => (
										<tr
											key={party.partyId}
											className="border-b border-line last:border-b-0"
										>
											<th
												scope="row"
												className="px-3 py-3 text-left font-bold text-ink md:px-4"
											>
												{party.name}{" "}
												<span className="ml-1 font-medium text-muted">
													({party.abbreviation})
												</span>
											</th>
											<td className="px-3 py-3 text-right font-bold text-ink md:px-4">
												{party.score}
											</td>
										</tr>
									))}
									{[
										["Total accredited voters", result.accredited],
										["Total valid votes", result.valid],
										["Total rejected votes", result.rejected],
									].map(([label, score]) => (
										<tr key={label} className="border-t border-line bg-[#F7FAF8]">
											<th
												scope="row"
												className="px-3 py-3 text-left font-bold text-ink md:px-4"
											>
												{label}
											</th>
											<td className="px-3 py-3 text-right font-bold text-ink md:px-4">
												{score}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
						<p className="mt-2 text-xs font-medium text-muted">
							Based on {result.count} eligible {result.count === 1 ? "submission" : "submissions"}.
						</p>
					</section>
				)}

				{!result && status !== "no-results" && (
					<div className="mt-7 border border-line bg-[#F7FAF8] p-5 text-sm leading-6 text-muted">
						There is no publishable tally for this unit yet.
					</div>
				)}

				<div className="mt-7 grid gap-3 md:grid-cols-2">
					<Link
						href={`/submit?unit=${encodeURIComponent(selectedUnit.code)}`}
						className="flex h-[52px] items-center justify-center bg-brand px-5 text-base font-bold text-white shadow-[0_5px_0_0_#005C37]"
					>
						Submit a result
					</Link>
					<Link
						href="/find-unit"
						className="flex h-[52px] items-center justify-center border border-brand bg-white px-5 text-base font-bold text-brand shadow-[0_5px_0_0_#005C37]"
					>
						Find another unit
					</Link>
				</div>

				<aside className="mt-7 flex items-start gap-3 border border-[#D1E7D8] bg-[#EEF8F1] p-4">
					<div className="mt-0.5 text-brand">
						<ShieldIcon />
					</div>
					<p className="text-sm leading-6 text-ink md:text-base">
						<span className="font-bold">We record results for every party.</span>{" "}
						We never ask who you voted for.
					</p>
				</aside>

				<Link href="/ive-voted" className="mt-6 inline-block text-sm font-bold text-brand underline underline-offset-4">
					Make an I&apos;ve voted card
				</Link>
			</div>
		</main>
	);
}
