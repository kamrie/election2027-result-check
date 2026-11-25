import type { Metadata } from "next";
import { Suspense } from "react";
import { getAuthenticatedUser } from "@/lib/auth";
import { brandName, brandTagline } from "@/lib/brand";
import "./globals.css";
import "@fontsource-variable/montserrat";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

const description = `${brandTagline} Compare polling unit results with the IReV portal.`;

export const metadata: Metadata = {
  title: brandName,
  applicationName: brandName,
  description,
  openGraph: { type: "website", siteName: brandName, title: brandName, description },
  twitter: { card: "summary", title: brandName, description },
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
          <Suspense fallback={<SiteHeader />}>
            <SessionHeader />
          </Suspense>

          <div className="mx-auto max-w-6xl bg-white shadow-[0_8px_12px_-8px_rgba(0,0,0,0.3)] md:border-x md:border-line">
            {children}
          </div>

          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
async function SessionHeader() {
  const user = await getAuthenticatedUser().catch(() => null);
  return <SiteHeader authenticated={Boolean(user)} />;
}
