import type { Metadata, Viewport } from "next";
import { Fraunces, Plus_Jakarta_Sans } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", display: "swap" });
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: "swap", axes: ["opsz"] });

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Kora Health — Find care. Connect with professionals. Navigate your health.",
    template: "%s · Kora Health",
  },
  description:
    "Kora Health helps Black patients and communities discover healthcare professionals, request appointments, communicate securely and navigate their healthcare journey.",
  applicationName: "Kora Health",
  openGraph: {
    type: "website",
    siteName: "Kora Health",
    title: "Kora Health",
    description: "Find care. Connect with professionals. Navigate your health.",
  },
  robots: process.env.NEXT_PUBLIC_KORA_ENV === "production" ? undefined : { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0f524c",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Reading request headers opts every route into dynamic rendering, which the
  // per-request CSP nonce (set in src/proxy.ts) requires.
  await headers();
  return (
    <html lang="en" className={`${jakarta.variable} ${fraunces.variable}`}>
      <body className="min-h-dvh">
        <a href="#main" className="skip-link">
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
