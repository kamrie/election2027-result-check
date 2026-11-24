"use client";

import Link from "next/link";
import { useState } from "react";
import { fakeLocations } from "@/lib/fake-locations";
import { StatusTag } from "@/components/StatusTag";

type Tab = "location" | "code";
type LocationValues = {
	state: string;
	lga: string;
	ward: string;
	unit: string;
};

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
	const [code, setCode] = useState("");
	const [codeSearched, setCodeSearched] = useState(false);

	const selectedState = fakeLocations.find((state) => state.name === values.state);
	const selectedLGA = selectedState?.lgas.find((lga) => lga.name === values.lga);
	const selectedWard = selectedLGA?.wards.find((ward) => ward.name === values.ward);
	const selectedUnit = selectedWard?.units.find((unit) => unit.name === values.unit);
	const allLocationsChosen = Boolean(values.state && values.lga && values.ward && values.unit);
	const codeFound = fakeLocations.some((state) =>
		state.lgas.some((lga) =>
			lga.wards.some((ward) =>
				ward.units.some((unit) => unit.code === code.trim())
			)
		)
	);

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
					Choose your state, LGA and ward, or search with your polling unit code.
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
							Search by code
						</button>
					</div>

					{activeTab === "location" ? (
						<div className="p-4 md:p-6">
							<div className="grid gap-4 md:grid-cols-2">
								<div>
									<label
										htmlFor="state"
										className="mb-2 block text-sm font-bold text-ink"
									>
										State
									</label>
									<div className="relative">
										<select
											id="state"
											value={values.state}
											onChange={(event) =>
												handleLocationChange("state", event.target.value)
											}
											className="h-[52px] w-full appearance-none border border-line bg-white px-3 pr-10 text-base text-ink outline-none focus:border-brand"
										>
											<option value="">Select a state</option>
											{fakeLocations.map((state) => (
												<option key={state.name} value={state.name}>
													{state.name}
												</option>
											))}
										</select>
										<svg
											aria-hidden="true"
											viewBox="0 0 24 24"
											className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-brand"
											fill="none"
										>
											<path
												d="M6 9L12 15L18 9"
												stroke="currentColor"
												strokeWidth="2"
												strokeLinecap="square"
												strokeLinejoin="round"
											/>
										</svg>
									</div>
								</div>

								<div>
									<label
										htmlFor="lga"
										className="mb-2 block text-sm font-bold text-ink"
									>
										LGA
									</label>
									<div className="relative">
										<select
											id="lga"
											value={values.lga}
											disabled={!values.state}
											onChange={(event) =>
												handleLocationChange("lga", event.target.value)
											}
											className="h-[52px] w-full appearance-none border border-line bg-white px-3 pr-10 text-base text-ink outline-none disabled:bg-[#F2F4F3] disabled:text-[#9BA39F] focus:border-brand"
										>
											<option value="">Select an LGA</option>
											{selectedState?.lgas.map((lga) => (
												<option key={lga.name} value={lga.name}>
													{lga.name}
												</option>
											))}
										</select>
										<svg
											aria-hidden="true"
											viewBox="0 0 24 24"
											className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-brand"
											fill="none"
										>
											<path
												d="M6 9L12 15L18 9"
												stroke="currentColor"
												strokeWidth="2"
												strokeLinecap="square"
												strokeLinejoin="round"
											/>
										</svg>
									</div>
								</div>

								<div>
									<label
										htmlFor="ward"
										className="mb-2 block text-sm font-bold text-ink"
									>
										Ward
									</label>
									<div className="relative">
										<select
											id="ward"
											value={values.ward}
											disabled={!values.lga}
											onChange={(event) =>
												handleLocationChange("ward", event.target.value)
											}
											className="h-[52px] w-full appearance-none border border-line bg-white px-3 pr-10 text-base text-ink outline-none disabled:bg-[#F2F4F3] disabled:text-[#9BA39F] focus:border-brand"
										>
											<option value="">Select a ward</option>
											{selectedLGA?.wards.map((ward) => (
												<option key={ward.name} value={ward.name}>
													{ward.name}
												</option>
											))}
										</select>
										<svg
											aria-hidden="true"
											viewBox="0 0 24 24"
											className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-brand"
											fill="none"
										>
											<path
												d="M6 9L12 15L18 9"
												stroke="currentColor"
												strokeWidth="2"
												strokeLinecap="square"
												strokeLinejoin="round"
											/>
										</svg>
									</div>
								</div>

								<div>
									<label
										htmlFor="unit"
										className="mb-2 block text-sm font-bold text-ink"
									>
										Polling unit
									</label>
									<div className="relative">
										<select
											id="unit"
											value={values.unit}
											disabled={!values.ward}
											onChange={(event) =>
												handleLocationChange("unit", event.target.value)
											}
											className="h-[52px] w-full appearance-none border border-line bg-white px-3 pr-10 text-base text-ink outline-none disabled:bg-[#F2F4F3] disabled:text-[#9BA39F] focus:border-brand"
										>
											<option value="">Select a polling unit</option>
											{selectedWard?.units.map((unit) => (
												<option key={unit.code} value={unit.name}>
													{unit.name}
												</option>
											))}
										</select>
										<svg
											aria-hidden="true"
											viewBox="0 0 24 24"
											className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-brand"
											fill="none"
										>
											<path
												d="M6 9L12 15L18 9"
												stroke="currentColor"
												strokeWidth="2"
												strokeLinecap="square"
												strokeLinejoin="round"
											/>
										</svg>
									</div>
								</div>
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
							<form
								onSubmit={(event) => {
									event.preventDefault();
									setCodeSearched(true);
								}}
							>
								<label
									htmlFor="polling-code"
									className="mb-2 block text-sm font-bold text-ink"
								>
									Polling unit code
								</label>
								<input
									id="polling-code"
									type="text"
									value={code}
									onChange={(event) => {
										setCode(event.target.value);
										setCodeSearched(false);
									}}
									placeholder="For example 24-01-03-007"
									className="h-[52px] w-full border border-line bg-white px-3 text-base text-ink outline-none focus:border-brand"
								/>
								<p className="mt-2 text-xs font-medium text-muted">
									You can find this code on the result sheet.
								</p>

								{codeSearched && !codeFound && (
									<p
										role="status"
										className="mt-4 border border-line bg-[#F7F8F7] p-4 text-sm font-medium text-[#B42318]"
									>
										No polling unit found. Check the code and try again.
									</p>
								)}

								<button
									type="submit"
									className="mt-5 flex h-[52px] w-full items-center justify-center bg-brand px-6 text-base font-bold text-white shadow-[0_5px_0_0_#005C37] md:w-[220px]"
								>
									Search
								</button>
							</form>
						</div>
					)}
				</div>

				{showResult && selectedUnit && activeTab === "location" && (
					<section className="mt-6 border border-line bg-white p-4 shadow-[0_8px_12px_-8px_rgba(0,0,0,0.3)] md:p-6">
						<p className="text-sm font-bold text-brand-dark">Selected polling unit</p>
						<h2 className="mt-2 text-xl font-bold text-ink">{selectedUnit.name}</h2>

						<dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
							<div>
								<dt className="font-medium text-muted">Unit code</dt>
								<dd className="mt-1 font-bold text-ink">{selectedUnit.code}</dd>
							</div>
							<div>
								<dt className="font-medium text-muted">Ward</dt>
								<dd className="mt-1 font-bold text-ink">{values.ward}</dd>
							</div>
							<div>
								<dt className="font-medium text-muted">LGA</dt>
								<dd className="mt-1 font-bold text-ink">{values.lga}</dd>
							</div>
							<div>
								<dt className="font-medium text-muted">State</dt>
								<dd className="mt-1 font-bold text-ink">{values.state}</dd>
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
