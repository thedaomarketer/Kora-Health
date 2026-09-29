import Link from "next/link";
import { KoraLogo } from "@/components/brand/logo";

export default function NotFound() {
  return (
    <main id="main" className="container-page flex min-h-dvh flex-col items-center justify-center py-20 text-center">
      <Link href="/" aria-label="Kora Health home"><KoraLogo /></Link>
      <p className="mt-10 text-sm font-semibold text-brand-700">404</p>
      <h1 className="mt-2 text-3xl font-bold text-ink">We couldn&apos;t find that page</h1>
      <p className="mt-3 text-muted">It may have moved, or the link may be incorrect.</p>
      <div className="mt-8 flex gap-3">
        <Link href="/" className="rounded-full bg-brand-700 px-5 py-2.5 font-semibold text-white hover:bg-brand-800">Go home</Link>
        <Link href="/providers" className="rounded-full px-5 py-2.5 font-semibold text-brand-700 ring-1 ring-line hover:bg-brand-50">Find a provider</Link>
      </div>
    </main>
  );
}
