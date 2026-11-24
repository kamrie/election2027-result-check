import type { Metadata } from "next";
import "./globals.css";
import "@fontsource-variable/montserrat";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "Result Check",
  description: "Compare polling unit results with the IReV portal.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <div className="min-h-screen bg-[var(--color-page)] text-ink">
          <SiteHeader />

          <div className="mx-auto max-w-6xl bg-white shadow-[0_8px_12px_-8px_rgba(0,0,0,0.3)] md:border-x md:border-line">
            {children}
          </div>

          <SiteFooter />
        </div>
      </body>
    </html>
  );
}