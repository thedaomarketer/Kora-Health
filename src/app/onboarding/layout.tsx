import Link from "next/link";
import { KoraLogo } from "@/components/brand/logo";

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="border-b border-line/70 bg-white">
        <div className="container-page flex h-16 items-center">
          <Link href="/" aria-label="Kora Health home"><KoraLogo /></Link>
        </div>
      </header>
      <main id="main" className="container-page max-w-5xl py-10 sm:py-14">{children}</main>
    </div>
  );
}
