import Link from "next/link";
import { KoraLogo } from "@/components/brand/logo";
import { ButtonLink } from "@/components/ui/button";
import { getSessionUser, homePathFor } from "@/lib/auth/session";
import { MobileNav } from "./mobile-nav";

export const PUBLIC_NAV = [
  { href: "/providers", label: "Find a provider" },
  { href: "/ai", label: "Kora AI" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/for-providers", label: "For providers" },
];

export async function SiteHeader() {
  const user = await getSessionUser();
  const home = user ? homePathFor(user) : null;
  return (
    <header className="sticky top-0 z-40 border-b border-line/60 bg-canvas/85 backdrop-blur-md supports-[backdrop-filter]:bg-canvas/75">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Link href="/" className="rounded-lg" aria-label="Kora Health home">
          <KoraLogo />
        </Link>
        <nav aria-label="Main" className="hidden md:block">
          <ul className="flex items-center gap-1">
            {PUBLIC_NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="rounded-full px-3.5 py-2 text-sm font-medium text-ink/80 hover:bg-brand-50 hover:text-brand-800"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          {user && home ? (
            <ButtonLink href={home} size="sm">
              My dashboard
            </ButtonLink>
          ) : (
            <>
              <ButtonLink href="/sign-in" variant="ghost" size="sm">
                Sign in
              </ButtonLink>
              <ButtonLink href="/sign-up" size="sm">
                Join Kora
              </ButtonLink>
            </>
          )}
        </div>
        <MobileNav items={PUBLIC_NAV} signedInHome={home} />
      </div>
    </header>
  );
}
