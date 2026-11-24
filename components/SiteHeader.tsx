"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/Logo";
import { Stripe } from "@/components/Stripe";

const navItems = [
	{ label: "Home", href: "\/" },
	{ label: "Find your polling unit", href: "\/find-unit" },
	{ label: "Dashboard", href: "\/dashboard" },
	{ label: "Log in", href: "\/login" },
];

export function SiteHeader() {
	const [isMenuOpen, setIsMenuOpen] = useState(false);
	const pathname = usePathname();

	useEffect(() => {
		const handleEscape = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				setIsMenuOpen(false);
			}
		};

		window.addEventListener("keydown", handleEscape);
		return () => window.removeEventListener("keydown", handleEscape);
	}, []);

	return (
		<>
			<Stripe />

			<header className="mx-auto max-w-6xl border-b border-line bg-white px-4 shadow-[0_8px_12px_-8px_rgba(0,0,0,0.3)] md:border-x md:border-line md:px-8 lg:px-10">
				<div className="mx-auto flex max-w-6xl items-center justify-between py-4">
					<Logo />

					<nav className="hidden items-center gap-8 text-sm text-ink lg:flex">
						{navItems.map((item) => (
							<Link
								key={item.label}
								href={item.href}
								className={`transition-opacity hover:opacity-75 ${
									pathname === item.href
										? "border-b-2 border-brand pb-1 font-bold text-brand"
										: "text-ink"
								}`}
							>
								{item.label}
							</Link>
						))}
					</nav>

					<button
						type="button"
						aria-label={isMenuOpen ? "Close menu" : "Open menu"}
						aria-expanded={isMenuOpen}
						onClick={() => setIsMenuOpen((current) => !current)}
						className="flex h-10 w-10 items-center justify-center bg-white text-ink lg:hidden"
					>
						{isMenuOpen ? (
							<svg
								aria-hidden="true"
								viewBox="0 0 24 24"
								className="h-5 w-5"
								fill="none"
								xmlns="http://www.w3.org/2000/svg"
							>
								<path
									d="M5 5L19 19M19 5L5 19"
									stroke="currentColor"
									strokeWidth="1.8"
									strokeLinecap="square"
								/>
							</svg>
						) : (
							<svg
								aria-hidden="true"
								viewBox="0 0 24 24"
								className="h-5 w-5"
								fill="none"
								xmlns="http://www.w3.org/2000/svg"
							>
								<path
									d="M4 7H20M4 12H20M4 17H20"
									stroke="currentColor"
									strokeWidth="1.8"
									strokeLinecap="square"
								/>
							</svg>
						)}
					</button>
				</div>
			</header>

			{isMenuOpen && (
				<nav
					aria-label="Mobile navigation"
					className="mx-auto w-full border-b border-line bg-white shadow-[0_8px_12px_-8px_rgba(0,0,0,0.3)] lg:hidden"
				>
					{navItems.map((item) => (
						<Link
							key={item.label}
							href={item.href}
							onClick={() => setIsMenuOpen(false)}
							className="flex h-[52px] items-center border-b border-line px-4 text-base font-medium text-ink last:border-b-0 hover:font-bold hover:text-brand md:px-8"
						>
							{item.label}
						</Link>
					))}
				</nav>
			)}
		</>
	);
}
