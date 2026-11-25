"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { maxPhotos, maxVoteCount } from "@/lib/submission-validation";
import type { SubmissionUnit } from "@/lib/submissions.server";
import { compressPhoto, sendSubmission } from "./photo-client";
import type { Party } from "@/lib/parties";

function CameraIcon() {
	return (
		<svg
			aria-hidden="true"
			viewBox="0 0 24 24"
			className="h-7 w-7"
			fill="none"
		>
			<path
				d="M4 7.5H7L8.5 5H15.5L17 7.5H20V19H4V7.5Z"
				stroke="currentColor"
				strokeWidth="1.8"
				strokeLinejoin="round"
			/>
			<circle cx="12" cy="13" r="3.25" stroke="currentColor" strokeWidth="1.8" />
		</svg>
	);
}

function CheckIcon() {
	return (
		<svg
			aria-hidden="true"
			viewBox="0 0 24 24"
			className="h-5 w-5 shrink-0"
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

function WarningIcon() {
	return (
		<svg
			aria-hidden="true"
			viewBox="0 0 24 24"
			className="h-5 w-5 shrink-0"
			fill="none"
		>
			<path
				d="M12 3.5L21 20H3L12 3.5Z"
				stroke="currentColor"
				strokeWidth="1.8"
				strokeLinejoin="round"
			/>
			<path
				d="M12 9V13M12 16.5V16.75"
				stroke="currentColor"
				strokeWidth="1.8"
				strokeLinecap="square"
			/>
		</svg>
	);
}

export default function SubmitResultContent({ parties, selectedUnit, unitRequested, alreadySubmitted, storageReady }: {
	parties: Party[];
	selectedUnit: SubmissionUnit | null;
	unitRequested: boolean;
	alreadySubmitted: boolean;
	storageReady: boolean;
}) {
	const router = useRouter();
	const previewUrls = useRef(new Set<string>());
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [photos, setPhotos] = useState<{ file: File; url: string }[]>([]);
	const [preparing, setPreparing] = useState(false);
	const [progress, setProgress] = useState<number | null>(null);
	const [photoError, setPhotoError] = useState("");
	const [submitError, setSubmitError] = useState("");
	const [submitted, setSubmitted] = useState<{ message: string; unitCode: string } | null>(null);

	useEffect(() => {
		const urls = previewUrls.current;
		return () => {
			for (const url of urls) URL.revokeObjectURL(url);
			urls.clear();
		};
	}, []);

	useEffect(() => {
		if (!submitted) return;
		const timer = window.setTimeout(() => router.replace("/unit/" + encodeURIComponent(submitted.unitCode)), 1800);
		return () => window.clearTimeout(timer);
	}, [router, submitted]);
	const [scores, setScores] = useState<Record<number, string>>({});
	const [accredited, setAccredited] = useState("");
	const [valid, setValid] = useState("");
	const [rejected, setRejected] = useState("");
	const [confirmed, setConfirmed] = useState(false);
	const [exactAsWritten, setExactAsWritten] = useState(false);
	const wholeNumberPattern = /^\d+$/;
	const isVoteCount = (value: string) => wholeNumberPattern.test(value) && Number(value) <= maxVoteCount;
	const valuesAreWholeNumbers = parties.every((party) => isVoteCount(scores[party.id] ?? ""))
		&& isVoteCount(accredited) && isVoteCount(valid) && isVoteCount(rejected);

	const partyTotal = parties.reduce(
		(total, party) => {
			const score = scores[party.id] ?? "";
			return total + (wholeNumberPattern.test(score) ? Number(score) : 0);
		},
		0
	);
	const accreditedNumber = Number(accredited);
	const validNumber = Number(valid);
	const rejectedNumber = Number(rejected);
	const validPlusRejected = validNumber + rejectedNumber;

	const liveCheckVisible = valuesAreWholeNumbers;
	const scoresMatch = liveCheckVisible && partyTotal === validNumber;
	const accreditationPasses = liveCheckVisible && validPlusRejected <= accreditedNumber;
	const rulesPass = scoresMatch && accreditationPasses;
	const canSubmit = storageReady && !preparing && progress === null && photos.length > 0
		&& valuesAreWholeNumbers && confirmed && (rulesPass || exactAsWritten);

	async function addPhotos(files: File[]) {
		if (!files.length || preparing) return;
		setPhotoError(files.length + photos.length > maxPhotos ? "You can add up to six photos." : "");
		setPreparing(true);
		for (const file of files.slice(0, maxPhotos - photos.length)) {
			try {
				const compressed = await compressPhoto(file);
				if (!fileInputRef.current) return;
				const url = URL.createObjectURL(compressed);
				previewUrls.current.add(url);
				setPhotos((current) => [...current, { file: compressed, url }]);
			} catch {
				setPhotoError("A photo could not be prepared. Choose a readable JPEG or PNG.");
			}
		}
		setPreparing(false);
	}

	function removePhoto(url: string) {
		URL.revokeObjectURL(url);
		previewUrls.current.delete(url);
		setPhotos((current) => current.filter((photo) => photo.url !== url));
	}

	async function submit() {
		if (!canSubmit || !selectedUnit) return;
		const form = new FormData();
		form.set("result", JSON.stringify({
			unitCode: selectedUnit.code, accredited: accreditedNumber, valid: validNumber, rejected: rejectedNumber,
			confirmed, sheetDoesNotAddUp: !rulesPass && exactAsWritten,
			scores: parties.map((party) => ({ partyId: party.id, score: Number(scores[party.id]) })),
		}));
		for (const photo of photos) form.append("photos", photo.file);
		setSubmitError("");
		setProgress(0);
		try {
			setSubmitted(await sendSubmission(form, setProgress));
		} catch (error) {
			setSubmitError(error instanceof Error ? error.message : "Could not submit the result. Try again.");
			setProgress(null);
		}
	}

	if (submitted) {
		return (
			<main className="mx-auto min-h-[620px] px-4 pb-12 pt-10 md:px-8 lg:flex lg:max-w-[760px] lg:flex-col lg:justify-center lg:px-10">
				<section className="text-center">
					<div className="mx-auto flex h-16 w-16 items-center justify-center bg-brand text-white">
						<svg
							aria-hidden="true"
							viewBox="0 0 24 24"
							className="h-9 w-9"
							fill="none"
						>
							<circle
								cx="12"
								cy="12"
								r="9.5"
								stroke="currentColor"
								strokeWidth="1.8"
							/>
							<path
								d="M7.5 12.25L10.5 15.25L16.75 8.75"
								stroke="currentColor"
								strokeWidth="1.8"
								strokeLinecap="square"
								strokeLinejoin="round"
							/>
						</svg>
					</div>
					<h1 className="mt-5 text-[2.1rem] font-bold leading-tight text-brand md:text-[2.6rem]">
						Result submitted
					</h1>
					<p className="mx-auto mt-3 max-w-[580px] text-base leading-7 text-muted">
						{submitted.message} Opening the polling-unit page...
					</p>
					<div className="mx-auto mt-7 grid max-w-[520px] gap-3 md:grid-cols-2">
						<Link
							href={"/unit/" + encodeURIComponent(submitted.unitCode)}
							className="flex h-[52px] items-center justify-center bg-brand px-5 text-base font-bold text-white shadow-[0_5px_0_0_#005C37]"
						>
							View unit page
						</Link>
						<Link
							href="/"
							className="flex h-[52px] items-center justify-center border border-brand bg-white px-5 text-base font-bold text-brand shadow-[0_5px_0_0_#005C37]"
						>
							Back to home
						</Link>
					</div>
				</section>
			</main>
		);
	}

	if (!selectedUnit || alreadySubmitted) {
		return (
			<main className="mx-auto min-h-[620px] px-4 pb-12 pt-10 md:px-8 lg:flex lg:max-w-[760px] lg:flex-col lg:justify-center lg:px-10">
				<section className="text-center">
					<h1 className="text-[2.2rem] font-bold leading-[1.1] text-brand md:text-[2.8rem]">
						{alreadySubmitted ? "You already submitted a result for this polling unit" : unitRequested ? "Polling unit not found" : "Select your polling unit"}
					</h1>
					<Link
						href="/find-unit"
						className="mt-6 flex h-[52px] w-full items-center justify-center bg-brand px-5 text-base font-bold text-white shadow-[0_5px_0_0_#005C37] md:mx-auto md:w-[260px]"
					>
						{alreadySubmitted ? "Choose another polling unit" : "Find your polling unit"}
					</Link>
				</section>
			</main>
		);
	}

	return (
		<main className="px-4 pb-10 pt-8 md:px-8 lg:px-10">
			<div className="mx-auto max-w-[760px]">
				<h1 className="text-[2.2rem] font-bold leading-[1.1] text-brand md:text-[2.8rem]">
					Submit a result
				</h1>
				<p className="mt-3 max-w-[650px] text-base leading-7 text-muted">
					Photograph the result sheet posted at your polling unit and enter the
					scores exactly as written.
				</p>

				<section className="mt-6 border border-line bg-white p-4 shadow-[0_8px_12px_-8px_rgba(0,0,0,0.3)] md:p-5">
					<h2 className="text-lg font-bold text-ink">Polling unit</h2>
					<div className="mt-3 grid gap-x-6 gap-y-2 text-sm md:grid-cols-2">
						<div>
							<span className="text-muted">Unit name</span>
							<p className="mt-0.5 font-bold text-ink">
								{selectedUnit.name}
							</p>
						</div>
						<div>
							<span className="text-muted">Code</span>
							<p className="mt-0.5 font-bold text-ink">{selectedUnit.code}</p>
						</div>
						<div>
							<span className="text-muted">Ward</span>
							<p className="mt-0.5 font-bold text-ink">
								{selectedUnit.ward}
							</p>
						</div>
						<div>
							<span className="text-muted">LGA</span>
							<p className="mt-0.5 font-bold text-ink">
								{selectedUnit.lga}
							</p>
						</div>
						<div>
							<span className="text-muted">State</span>
							<p className="mt-0.5 font-bold text-ink">
								{selectedUnit.state}
							</p>
						</div>
					</div>
					<Link
						href="/find-unit"
						className="mt-4 inline-block text-sm font-bold text-brand underline decoration-1 underline-offset-4"
					>
						Change polling unit
					</Link>
				</section>

				<section className="mt-7">
					<h2 className="text-xl font-bold text-brand">
						Step 1{" "}
						<span className="text-ink">Photograph the sheet</span>
					</h2>
					<input
						ref={fileInputRef}
						type="file"
						accept="image/jpeg,image/png"
						multiple
						className="hidden"
						onChange={(event) => {
						const files = Array.from(event.target.files ?? []);
						event.target.value = "";
						void addPhotos(files);
					}}
					/>
					<button
						type="button"
						onClick={() => fileInputRef.current?.click()}
						disabled={preparing || progress !== null || photos.length >= maxPhotos}
						className="mt-3 flex h-[132px] w-full flex-col items-center justify-center border-2 border-dashed border-brand bg-[#F7FAF8] px-4 text-brand"
					>
						<CameraIcon />
						<span className="mt-2 text-sm font-bold md:text-base">
							Tap to take a photo or choose a file
						</span>
						<span className="mt-1 text-xs text-muted">
							Form EC8A. Up to six JPEG or PNG photos. Make sure scores and signatures are readable.
						</span>
					</button>

					{preparing && <p role="status" className="mt-2 text-sm text-muted">Preparing photos...</p>}
					{photoError && <p role="alert" className="mt-2 text-sm text-[#B42318]">{photoError}</p>}
					{photos.length > 0 && (
						<div className="mt-3">
							<div className="grid grid-cols-2 gap-3 md:max-w-[420px]">
								{photos.map((photo, index) => (
									<div
										key={photo.url}
										className="relative h-[104px] overflow-hidden border border-line bg-[#EEF1EF]"
									>
										{/* eslint-disable-next-line @next/next/no-img-element */}
										<img
											src={photo.url}
											alt={`Result sheet preview ${index + 1}`}
											className="h-full w-full object-cover"
										/>
										<button
											type="button"
											aria-label={`Remove photo ${index + 1}`}
											onClick={() => removePhoto(photo.url)}
										disabled={preparing || progress !== null}
											className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center bg-white text-ink shadow-[0_3px_8px_rgba(0,0,0,0.18)]"
										>
											<svg
												aria-hidden="true"
												viewBox="0 0 24 24"
												className="h-4 w-4"
												fill="none"
											>
												<path
													d="M6 6L18 18M18 6L6 18"
													stroke="currentColor"
													strokeWidth="2"
												/>
											</svg>
										</button>
									</div>
								))}
							</div>
							<p className="mt-2 text-sm font-bold text-brand">
								{photos.length}{" "}
								{photos.length === 1 ? "photo" : "photos"} added
							</p>
						</div>
					)}
				</section>

				<section className="mt-7">
					<h2 className="text-xl font-bold text-brand">
						Step 2 <span className="text-ink">Enter the scores</span>
					</h2>
					<div className="mt-3 border-t border-line">
						{parties.map((party) => {
							const score = scores[party.id] ?? "";
							return (
								<div
									key={party.id}
									className="grid h-[68px] grid-cols-[1fr_112px] items-center border-b border-line md:grid-cols-[1fr_140px]"
								>
									<label
										htmlFor={`score-${party.id}`}
										className="pr-3 text-sm font-bold text-ink md:text-base"
									>
										{party.name}{" "}
										<span className="ml-1 font-medium text-muted">
											({party.abbreviation})
										</span>
									</label>
									<input
										id={`score-${party.id}`}
										type="number"
										inputMode="numeric"
										min="0"
										max={maxVoteCount}
										disabled={progress !== null}
										value={score}
										onChange={(event) => {
											const next = event.target.value;
											if (next === "" || /^\d+$/.test(next)) {
												setScores((current) => ({ ...current, [party.id]: next }));
												setExactAsWritten(false);
											}
										}}
										className={`h-[52px] w-full border bg-white px-3 text-right text-base font-bold text-ink outline-none ${
											liveCheckVisible && !scoresMatch
												? "border-[#B42318]"
												: "border-line focus:border-brand"
										}`}
									/>
								</div>
							);
						})}
					</div>

					<p className="mt-5 text-sm font-bold text-muted">
						Party scores total so far: {partyTotal}
					</p>

					<div className="mt-3 grid gap-4 md:grid-cols-3">
						{[
							{
								label: "Total accredited voters",
								value: accredited,
								setter: setAccredited,
							},
							{ label: "Total valid votes", value: valid, setter: setValid },
							{
								label: "Total rejected votes",
								value: rejected,
								setter: setRejected,
							},
						].map((field) => (
							<div key={field.label}>
								<label
									className="mb-2 block text-sm font-bold leading-5 text-ink"
									htmlFor={field.label}
								>
									{field.label}
								</label>
								<input
									id={field.label}
									type="number"
									inputMode="numeric"
									min="0"
										max={maxVoteCount}
										disabled={progress !== null}
									value={field.value}
									onChange={(event) => {
										const next = event.target.value;
										if (next === "" || /^\d+$/.test(next)) {
											field.setter(next);
											setExactAsWritten(false);
										}
									}}
									className={`h-[52px] w-full border bg-white px-3 text-base font-bold text-ink outline-none ${
										liveCheckVisible &&
										(field.label === "Total valid votes" && !scoresMatch
											? true
											: field.label === "Total accredited voters" && !accreditationPasses)
											? "border-[#B42318]"
											: "border-line focus:border-brand"
									}`}
								/>
							</div>
						))}
					</div>

					{liveCheckVisible && (scoresMatch ? (
							<div className="mt-4 flex items-start gap-2 text-sm font-bold text-brand md:text-base">
								<CheckIcon />
								<span>Party scores add up to {partyTotal}. Valid votes entered: {validNumber}.</span>
							</div>
						) : (
							<div className="mt-4 flex items-start gap-2 text-sm font-bold text-[#B42318] md:text-base">
								<WarningIcon />
								<span>Party scores add up to {partyTotal} but valid votes is {validNumber}. Please check the numbers.</span>
							</div>
						))}

					{liveCheckVisible && !accreditationPasses && (
						<div className="mt-3 flex items-start gap-2 text-sm font-bold text-[#B42318] md:text-base">
							<WarningIcon />
							<span>Valid plus rejected votes ({validPlusRejected}) is more than accredited voters ({accreditedNumber}). Please check the numbers.</span>
						</div>
					)}

					{liveCheckVisible && !rulesPass && (
						<label className="mt-5 flex cursor-pointer items-start gap-3">
							<input
								type="checkbox"
								disabled={progress !== null}
								checked={exactAsWritten}
								onChange={(event) => setExactAsWritten(event.target.checked)}
								className="mt-0.5 h-5 w-5 shrink-0 accent-[#008751]"
							/>
							<span className="text-sm font-medium leading-6 text-ink md:text-base">
								Sheet does not add up. I confirm these numbers are exactly as written.
							</span>
						</label>
					)}

					<label className="mt-5 flex cursor-pointer items-start gap-3">
						<input
							type="checkbox"
							disabled={progress !== null}
							checked={confirmed}
							onChange={(event) => setConfirmed(event.target.checked)}
							className="mt-0.5 h-5 w-5 shrink-0 accent-[#008751]"
						/>
						<span className="text-sm font-medium leading-6 text-ink md:text-base">
							I confirm these numbers match the signed result sheet at my polling unit.
						</span>
					</label>

					{!storageReady && <p role="alert" className="mt-4 text-sm text-[#B42318]">Photo storage is not configured. Please contact the site administrator.</p>}
					{submitError && <p role="alert" className="mt-4 text-sm text-[#B42318]">{submitError}</p>}
					{progress !== null && (
						<div role="status" className="mt-4 text-sm text-muted">
							{progress < 100 ? "Uploading photos... " + progress + "%" : "Upload received. Saving your result..."}
							<progress aria-label="Photo upload progress" value={progress} max={100} className="mt-2 block w-full accent-[#008751]" />
						</div>
					)}
					<button
						type="button"
						disabled={!canSubmit}
						onClick={() => void submit()}
						className="mt-5 h-[52px] w-full bg-brand text-base font-bold text-white shadow-[0_5px_0_0_#005C37] disabled:bg-[#A7AFAB] disabled:shadow-[0_5px_0_0_#7E8782] disabled:cursor-not-allowed"
					>
						Submit result
					</button>
					<p className="mt-3 text-center text-xs font-medium text-muted md:text-sm">
						You cannot edit a submission after sending it.
					</p>
				</section>

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
