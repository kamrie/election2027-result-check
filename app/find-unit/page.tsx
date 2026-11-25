"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Tab = "location" | "code";
type LocationValues = {
	state: string;
	lga: string;
	ward: string;
	unit: string;
};

type LocationOption = { id: number; name: string };
type PollingUnit = LocationOption & { code: string };

type LookupResult<T> =
	| { status: "idle" | "loading" | "error" }
	| { status: "ready"; items: T[] };

function useLookup<T>(url: string | null, delay = 0) {
	const [attempt, setAttempt] = useState(0);
	const [response, setResponse] = useState<{
		url: string;
		attempt: number;
		result: LookupResult<T>;
	}>();
	const result: LookupResult<T> = !url
		? { status: "idle" }
		: response?.url === url && response.attempt === attempt
			? response.result
			: { status: "loading" };

	useEffect(() => {
		if (!url) return;
		const controller = new AbortController();

		async function load(endpoint: string) {
			try {
				const response = await fetch(endpoint, { signal: controller.signal });
				if (!response.ok) throw new Error("Lookup failed");
				const items: T[] = await response.json();
				if (!controller.signal.aborted) {
					setResponse({ url: endpoint, attempt, result: { status: "ready", items } });
				}
			} catch {
				if (!controller.signal.aborted) {
					setResponse({ url: endpoint, attempt, result: { status: "error" } });
				}
			}
		}

		const timer = window.setTimeout(() => void load(url), delay);
		return () => {
			window.clearTimeout(timer);
			controller.abort();
		};
	}, [url, delay, attempt]);

	return { result, retry: () => setAttempt((current) => current + 1) };
}

function LocationSelect<T extends LocationOption>({ id, label, placeholder, lookup, value, onChange, formatName }: {
	id: string;
	label: string;
	placeholder: string;
	lookup: ReturnType<typeof useLookup<T>>;
	value: string;
	onChange: (value: string) => void;
	formatName?: (item: T) => string;
}) {
	const { result, retry } = lookup;
	const items = result.status === "ready" ? result.items : [];
	const loading = result.status === "loading";
	const empty = result.status === "ready" && items.length === 0;

	return (
		<div>
			<label htmlFor={id} className="mb-2 block text-sm font-bold text-ink">{label}</label>
			<div className="relative">
				<select
					id={id}
					value={value}
					disabled={items.length === 0}
					aria-busy={loading}
					onChange={(event) => onChange(event.target.value)}
					className="h-[52px] w-full appearance-none border border-line bg-white px-3 pr-10 text-base text-ink outline-none disabled:bg-[#F2F4F3] disabled:text-[#9BA39F] focus:border-brand"
				>
					<option value="">{placeholder}</option>
					{items.map((item) => (
						<option key={item.id} value={item.id}>{formatName ? formatName(item) : item.name}</option>
					))}
				</select>
				<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-brand">
					<path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="round" />
				</svg>
			</div>
			{loading && <p role="status" className="mt-2 text-sm text-muted">Loading {label.toLowerCase()} options?</p>}
			{empty && <p role="status" className="mt-2 text-sm text-muted">No options available.</p>}
			{result.status === "error" && (
				<div className="mt-2 flex flex-wrap gap-x-2 text-sm">
					<p role="alert" className="text-[#B42318]">Could not load {label.toLowerCase()} options.</p>
					<button type="button" onClick={retry} className="font-bold text-brand underline">Try again</button>
				</div>
			)}
		</div>
	);
}

function selectedOption<T extends LocationOption>(result: LookupResult<T>, id: string) {
	return result.status === "ready" ? result.items.find((item) => String(item.id) === id) : undefined;
}

function ShieldIcon() {
	return (
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
	);
}

export default function FindUnitPage() {
	const [activeTab, setActiveTab] = useState<Tab>("location");
	const [values, setValues] = useState<LocationValues>({
		state: "",
		lga: "",
		ward: "",
		unit: "",
	});
	const [showResult, setShowResult] = useState(false);
	const [searchText, setSearchText] = useState("");
	const term = searchText.trim();

	const states = useLookup<LocationOption>("/api/locations");
	const lgas = useLookup<LocationOption>(values.state ? "/api/locations?stateId=" + values.state : null);
	const wards = useLookup<LocationOption>(values.lga ? "/api/locations?lgaId=" + values.lga : null);
	const units = useLookup<PollingUnit>(values.ward ? "/api/locations?wardId=" + values.ward : null);
	const search = useLookup<PollingUnit>(
		activeTab === "code" && term.length >= 2
			? "/api/polling-units?" + new URLSearchParams({ q: term })
			: null,
		300,
	);

	const selectedState = selectedOption(states.result, values.state);
	const selectedLGA = selectedOption(lgas.result, values.lga);
	const selectedWard = selectedOption(wards.result, values.ward);
	const selectedUnit = selectedOption(units.result, values.unit);
	const allLocationsChosen = Boolean(selectedState && selectedLGA && selectedWard && selectedUnit);

	const handleLocationChange = (key: keyof LocationValues, value: string) => {
		setShowResult(false);
		setValues((current) => {
			if (key === "state") return { state: value, lga: "", ward: "", unit: "" };
			if (key === "lga") return { ...current, lga: value, ward: "", unit: "" };
			if (key === "ward") return { ...current, ward: value, unit: "" };
			return { ...current, unit: value };
		});
	};

	return (
		<main className="px-4 pb-10 pt-8 md:px-8 lg:px-10">
			<div className="max-w-5xl">
				<h1 className="text-[2.2rem] font-bold leading-[1.1] text-brand md:text-[2.8rem]">
					Find your polling unit
				</h1>
				<p className="mt-3 max-w-[38rem] text-base leading-7 text-muted">
					Choose your state, LGA and ward, or search by polling unit code or name.
				</p>

				<div className="mt-6 border border-line bg-white shadow-[0_8px_12px_-8px_rgba(0,0,0,0.3)]">
					<div className="grid grid-cols-2">
						<button
							type="button"
							onClick={() => setActiveTab("location")}
							className={`flex h-[52px] items-center justify-center px-2 text-sm font-bold md:text-base ${
								activeTab === "location"
									? "bg-brand text-white"
									: "border border-brand bg-white text-brand"
							}`}
						>
							Browse by location
						</button>
						<button
							type="button"
							onClick={() => setActiveTab("code")}
							className={`flex h-[52px] items-center justify-center px-2 text-sm font-bold md:text-base ${
								activeTab === "code"
									? "bg-brand text-white"
									: "border border-brand bg-white text-brand"
							}`}
						>
							Search by code or name
						</button>
					</div>

					{activeTab === "location" ? (
						<div className="p-4 md:p-6">
							<div className="grid gap-4 md:grid-cols-2">
								<LocationSelect id="state" label="State" placeholder="Select a state" lookup={states} value={values.state} onChange={(value) => handleLocationChange("state", value)} />
								<LocationSelect id="lga" label="LGA" placeholder="Select an LGA" lookup={lgas} value={values.lga} onChange={(value) => handleLocationChange("lga", value)} />
								<LocationSelect id="ward" label="Ward" placeholder="Select a ward" lookup={wards} value={values.ward} onChange={(value) => handleLocationChange("ward", value)} />
								<LocationSelect id="unit" label="Polling unit" placeholder="Select a polling unit" lookup={units} value={values.unit} onChange={(value) => handleLocationChange("unit", value)} formatName={(unit) => unit.name + " (" + unit.code + ")"} />
							</div>

							<button
								type="button"
								disabled={!allLocationsChosen}
								onClick={() => setShowResult(true)}
								className="mt-5 flex h-[52px] w-full items-center justify-center bg-brand px-6 text-base font-bold text-white shadow-[0_5px_0_0_#005C37] disabled:cursor-not-allowed disabled:bg-[#D6DAD7] disabled:text-[#8B948F] disabled:shadow-none"
							>
								Find polling unit
							</button>
						</div>
					) : (
						<div className="p-4 md:p-6">
							<form onSubmit={(event) => {
								event.preventDefault();
								if (term.length >= 2 && search.result.status !== "loading") search.retry();
							}}>
								<label htmlFor="polling-search" className="mb-2 block text-sm font-bold text-ink">
									Polling unit code or name
								</label>
								<input
									id="polling-search"
									type="search"
									value={searchText}
									onChange={(event) => setSearchText(event.target.value)}
									maxLength={100}
									placeholder="For example 01-01-01-001 or Railway Quarters"
									className="h-[52px] w-full border border-line bg-white px-3 text-base text-ink outline-none focus:border-brand"
								/>
								<p className="mt-2 text-xs font-medium text-muted">Enter at least two characters to search.</p>
								<button
									type="submit"
									disabled={term.length < 2 || search.result.status === "loading"}
									className="mt-5 flex h-[52px] w-full items-center justify-center bg-brand px-6 text-base font-bold text-white shadow-[0_5px_0_0_#005C37] disabled:cursor-not-allowed disabled:bg-[#D6DAD7] disabled:text-[#8B948F] disabled:shadow-none md:w-[220px]"
								>
									{search.result.status === "error" ? "Try again" : "Search"}
								</button>
							</form>
							{search.result.status === "loading" && <p role="status" className="mt-4 text-sm text-muted">Searching polling units?</p>}
							{search.result.status === "error" && <p role="alert" className="mt-4 text-sm text-[#B42318]">Could not search polling units. Try again.</p>}
							{search.result.status === "ready" && (
								search.result.items.length === 0 ? (
									<p role="status" className="mt-4 border border-line bg-[#F7F8F7] p-4 text-sm text-muted">No polling units found.</p>
								) : (
									<ul aria-label="Polling unit search results" className="mt-5 divide-y divide-line border border-line">
										{search.result.items.map((unit) => (
											<li key={unit.id}>
												<Link href={"/unit/" + encodeURIComponent(unit.code)} className="block px-4 py-3 text-sm font-bold text-brand hover:underline">
													{unit.name} ({unit.code})
												</Link>
											</li>
										))}
									</ul>
								)
							)}
						</div>
					)}
				</div>

				{showResult && selectedUnit && activeTab === "location" && (
					<section className="mt-6 border border-line bg-white p-4 shadow-[0_8px_12px_-8px_rgba(0,0,0,0.3)] md:p-6">
						<p className="text-sm font-bold text-brand-dark">Selected polling unit</p>
						<h2 className="mt-2 text-xl font-bold text-ink">{selectedUnit.name} ({selectedUnit.code})</h2>

						<dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
							<div>
								<dt className="font-medium text-muted">Unit code</dt>
								<dd className="mt-1 font-bold text-ink">{selectedUnit.code}</dd>
							</div>
							<div>
								<dt className="font-medium text-muted">Ward</dt>
								<dd className="mt-1 font-bold text-ink">{selectedWard?.name}</dd>
							</div>
							<div>
								<dt className="font-medium text-muted">LGA</dt>
								<dd className="mt-1 font-bold text-ink">{selectedLGA?.name}</dd>
							</div>
							<div>
								<dt className="font-medium text-muted">State</dt>
								<dd className="mt-1 font-bold text-ink">{selectedState?.name}</dd>
							</div>
						</dl>

						<div className="mt-5 border-t border-line pt-4">
							<div className="mt-4 flex flex-wrap gap-3 text-xs text-muted">
								<span>
									<span className="mr-1 inline-block h-2 w-2 bg-[#A8AEAA]" />
									Unverified
								</span>
								<span>
									<span className="mr-1 inline-block h-2 w-2 bg-brand" />
									Confirmed
								</span>
								<span>
									<span className="mr-1 inline-block h-2 w-2 bg-[#C96A52]" />
									Mismatch
								</span>
							</div>

							<div className="mt-5 flex flex-col gap-3 sm:flex-row">
								<Link
									href={`/submit?unit=${encodeURIComponent(selectedUnit.code)}`}
									className="flex h-[52px] items-center justify-center bg-brand px-6 text-base font-bold text-white shadow-[0_5px_0_0_#005C37] sm:min-w-[220px]"
								>
									Submit a result
								</Link>
								<Link
									href={`/unit/${encodeURIComponent(selectedUnit.code)}`}
									className="flex h-[52px] items-center justify-center border border-brand bg-white px-6 text-base font-bold text-brand shadow-[0_5px_0_0_#005C37] sm:min-w-[220px]"
								>
									View unit page
								</Link>
							</div>
						</div>
					</section>
				)}

				<div className="mt-8 border border-line bg-[#eef8f1] p-4 shadow-[0_8px_12px_-8px_rgba(0,0,0,0.3)]">
					<div className="flex items-center gap-3">
						<div className="flex h-9 w-9 shrink-0 items-center justify-center bg-brand text-white">
							<ShieldIcon />
						</div>
						<p className="text-sm leading-6 text-ink md:text-base">
							<span className="font-bold">We record results for every party.</span>{" "}
							We never ask who you voted for.
						</p>
					</div>
				</div>
			</div>
		</main>
	);
}
