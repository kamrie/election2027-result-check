import Link from "next/link";
import { Suspense } from "react";
import { fakeLocations } from "@/lib/fake-locations";
import { getActiveParties, isPartyFallback, partiesLoadError } from "@/lib/parties.server";
import { StatusTag, type StatusKey } from "@/components/StatusTag";

export const instant = false;

const statusStyles: Record<
	string,
	{ label: string; className: string; description: string }
> = {
	none: {
		label: "No results yet",
		className: "border border-[#D9DDDA] bg-[#E7EAE8] text-[#5A6560]",
		description: "No submissions have been made for this polling unit.",
	},
	unverified: {
		label: "Unverified",
		className: "border border-[#D8B34A] bg-[#FFF3C7] text-[#6B5310]",
		description:
			"One person has submitted. It becomes Confirmed when a second person submits the same scores.",
	},
	confirmed: {
		label: "Confirmed",
		className: "border border-[#A8D2B8] bg-[#DDF1E4] text-brand-dark",
		description: "Two people submitted the same scores. Waiting for the IReV result.",
	},
	mismatch: {
		label: "Mismatch",
		className: "border border-[#B42318] bg-[#FDE7E5] text-[#B42318]",
		description: "Our submitted scores do not match the IReV result entered for this unit.",
	},
	matches: {
		label: "Matches IReV",
		className: "border border-[#005C37] bg-[#008751] text-white",
		description: "The submitted scores match the IReV result.",
	},
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

function CheckIcon() {
	return (
		<svg
			aria-hidden="true"
			viewBox="0 0 24 24"
			className="h-4 w-4"
			fill="none"
		>
			<circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
			<path
				d="M8 12L10.75 14.75L16 9.5"
				stroke="currentColor"
				strokeWidth="1.8"
				strokeLinecap="square"
				strokeLinejoin="round"
			/>
		</svg>
	);
}

export default async function UnitPage({
	params,
	searchParams,
}: {
	params: Promise<{ CODE: string }>;
	searchParams: Promise<{ state?: string }>;
}) {
	return (
		<Suspense fallback={<p className="px-4 py-10 text-muted">Loading parties?</p>}>
			<UnitPageContent params={params} searchParams={searchParams} />
		</Suspense>
	);
}

async function UnitPageContent({
	params,
	searchParams,
}: {
	params: Promise<{ CODE: string }>;
	searchParams: Promise<{ state?: string }>;
}) {
	const { CODE } = await params;
	const { state = "none" } = await searchParams;
	const code = decodeURIComponent(CODE);
	let activeParties;
	try {
		activeParties = await getActiveParties();
	} catch {
		return <p role="alert" className="px-4 py-10 text-muted">{partiesLoadError}</p>;
	}

	const parties = activeParties.map((party, index) => {
		const our = Math.max(0, 82 - index * 3);
		return { ...party, our, ireV: index === 1 ? 62 : our };
	});
	const valid = parties.reduce((total, party) => total + party.our, 0);
	const rejected = 8;

	let unit = null as null | {
		name: string;
		code: string;
		ward: string;
		lga: string;
		state: string;
	};
	for (const locationState of fakeLocations) {
		for (const lga of locationState.lgas) {
			for (const ward of lga.wards) {
				const found = ward.units.find((item) => item.code === code);
				if (found) {
					unit = {
						name: found.name,
						code: found.code,
						ward: ward.name,
						lga: lga.name,
						state: locationState.name,
					};
					break;
				}
			}
			if (unit) break;
		}
		if (unit) break;
	}

	const selectedUnit =
		unit ?? {
			name: "Polling unit",
			code,
			ward: "Ward",
			lga: "LGA",
			state: "State",
		};
	const status = statusStyles[state] ?? statusStyles.none;
	const noResults = state === "none";
	const unverified = state === "unverified";
	const showIReV = state === "mismatch" || state === "matches";

	return (
		<main className="px-4 pb-10 pt-6 md:px-8 lg:px-10">
			{isPartyFallback(activeParties) && <p role="alert" className="mb-4 text-muted">{partiesLoadError}</p>}
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
						<StatusTag
							status={(state === "none" ? "no-results" : state) as StatusKey}
						/>
					</div>
					<p className="mt-3 max-w-[650px] text-sm leading-6 text-muted md:text-base">
						{status.description}
					</p>
					<p className="mt-1 text-xs font-medium text-muted">
						Sample data — for demonstration only.
					</p>
				</div>

				{!noResults && (
					<>
						<section className="mt-7">
							<h2 className="text-xl font-bold text-brand">
								Submitted scores
							</h2>
							<div className="mt-3 overflow-hidden border border-line">
								<table className="w-full border-collapse text-sm">
									<tbody>
										{parties.map((party) => (
											<tr
												key={party.id}
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
													{party.our}
												</td>
											</tr>
										))}
										{[
											["Total accredited voters", String(valid + rejected)],
											["Total valid votes", String(valid)],
											["Total rejected votes", String(rejected)],
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
								Based on {unverified ? "1 submission" : "2 submissions"}.
							</p>
						</section>

						<section className="mt-7">
							<h2 className="text-xl font-bold text-brand">
								Comparison with IReV
							</h2>
							{showIReV ? (
								<div className="mt-3 overflow-x-auto border border-line">
									<table className="w-full min-w-[560px] border-collapse text-sm">
										<thead className="bg-[#F7FAF8]">
											<tr className="border-b border-line">
												<th className="px-3 py-3 text-left font-bold text-ink">
													Party
												</th>
												<th className="px-3 py-3 text-right font-bold text-ink">
													Our scores
												</th>
												<th className="px-3 py-3 text-right font-bold text-ink">
													IReV scores
												</th>
												<th className="px-3 py-3 text-right font-bold text-ink">
													Difference
												</th>
											</tr>
										</thead>
										<tbody>
											{parties.map((party) => {
												const differs = party.our !== party.ireV;
												const difference = party.our - party.ireV;
												return (
													<tr
														key={party.id}
														className={`border-b border-line last:border-b-0 ${
															differs ? "bg-[#FDE7E5]" : "bg-white"
														}`}
													>
														<th
															scope="row"
															className="px-3 py-3 text-left font-bold text-ink"
														>
															{party.name}{" "}
															<span className="font-medium text-muted">
																({party.abbreviation})
															</span>
														</th>
														<td className="px-3 py-3 text-right font-bold text-ink">
															{party.our}
														</td>
														<td className="px-3 py-3 text-right font-bold text-ink">
															{party.ireV}
														</td>
														<td
															className={`px-3 py-3 text-right font-bold ${
																differs
																	? "text-[#B42318]"
																	: "text-brand"
															}`}
														>
															{differs ? (
																difference > 0
																	? `+${difference}`
																	: difference
															) : (
																<span className="flex justify-end">
																	<CheckIcon />
																</span>
															)}
														</td>
													</tr>
												);
											})}
										</tbody>
									</table>
								</div>
							) : (
								<div className="mt-3 border border-line bg-[#E7EAE8] px-4 py-4 text-sm font-medium text-muted">
									IReV result not yet entered for this unit.
								</div>
							)}
						</section>

						<section className="mt-7">
							<h2 className="text-xl font-bold text-brand">
								Result sheet photos
							</h2>
							<div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3">
								{[1, 2, 3].map((photo) => (
									<details
										key={photo}
										className="group border border-line bg-white"
									>
										<summary className="cursor-pointer list-none">
											<div className="flex h-[112px] items-center justify-center bg-[#EEF1EF] md:h-[128px]">
												<div className="h-[84px] w-[68px] border border-[#C7CECA] bg-white p-2 shadow-[0_4px_8px_-4px_rgba(0,0,0,0.25)]">
													<div className="h-2 w-full bg-brand" />
													<div className="mt-2 h-1 w-10 bg-[#D9DDDA]" />
													<div className="mt-2 h-1 w-12 bg-[#D9DDDA]" />
													<div className="mt-2 h-1 w-8 bg-[#D9DDDA]" />
												</div>
											</div>
											<p className="px-2 py-2 text-xs leading-5 text-muted">
												Photo {photo}, submitted 25 Jan, 4:
												{photo === 1
													? "12"
													: photo === 2
													? "18"
													: "24"}
												pm
											</p>
										</summary>
										<div className="border-t border-line p-3">
											<div className="flex h-[260px] items-center justify-center bg-[#EEF1EF]">
												<div className="h-[220px] w-[170px] border border-[#C7CECA] bg-white p-4">
													<div className="h-3 w-full bg-brand" />
													<div className="mt-4 h-2 w-full bg-[#D9DDDA]" />
													<div className="mt-3 h-2 w-32 bg-[#D9DDDA]" />
													<div className="mt-3 h-2 w-28 bg-[#D9DDDA]" />
													<div className="mt-3 h-2 w-36 bg-[#D9DDDA]" />
												</div>
											</div>
										</div>
									</details>
								))}
							</div>
						</section>

						<section className="mt-7">
							<h2 className="text-xl font-bold text-brand">Submissions</h2>
							<div className="mt-3 grid gap-3">
								{[1, 2]
									.slice(0, unverified ? 1 : 2)
									.map((submission) => (
										<details
											key={submission}
											className="border border-line bg-white"
										>
											<summary className="flex cursor-pointer list-none items-start justify-between gap-3 px-4 py-4">
												<div>
													<p className="text-sm font-bold text-ink">
														Volunteer {submission}
													</p>
													<p className="mt-1 text-xs text-muted">
														Submitted 25 Jan,{" "}
														{submission === 1
															? "4:12 pm"
															: "5:06 pm"}
													</p>
													<Link
														href="#"
														className="mt-1 inline-block text-xs font-bold text-brand underline underline-offset-4"
													>
														Report a problem
													</Link>
												</div>
												<span className="text-sm font-bold text-brand">
													Scores
												</span>
											</summary>
											<div className="border-t border-line px-4 py-3 text-sm">
												{parties.map((party) => (
													<p
														key={party.id}
														className="flex justify-between border-b border-line py-2 last:border-b-0"
													>
														<span>
															{party.name} ({party.abbreviation})
														</span>
														<strong>{party.our}</strong>
													</p>
												))}
												<p className="mt-2 text-xs text-muted">
													Accredited 420 · Valid 412 · Rejected 8
												</p>
												<Link
													href="/report"
													className="mt-3 inline-block text-sm font-bold text-brand underline underline-offset-4"
												>
													Report a problem
												</Link>
											</div>
										</details>
									))}
							</div>
						</section>
					</>
				)}

				{noResults && (
					<div className="mt-7 border border-line bg-[#F7FAF8] p-5 text-sm leading-6 text-muted">
						No submitted scores or photos are available for this unit yet.
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
			</div>
		</main>
	);
}
