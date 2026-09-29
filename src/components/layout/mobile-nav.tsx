"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";

export function MobileNav({
  items,
  signedInHome,
  extra,
}: {
  items: { href: string; label: string }[];
  signedInHome: string | null;
  extra?: { href: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const pathname = usePathname();
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close on navigation.
  useEffect(() => setOpen(false), [pathname]);

  // Close on Escape and return focus to the toggle.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        className="grid size-11 place-items-center rounded-full text-ink hover:bg-brand-50"
      >
        {open ? <X aria-hidden className="size-6" /> : <Menu aria-hidden className="size-6" />}
        <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
      </button>
      <div
        id={id}
        hidden={!open}
        className="absolute inset-x-0 top-16 border-b border-line bg-canvas px-4 pb-6 pt-2 shadow-[var(--shadow-lift)]"
      >
        <nav aria-label="Mobile">
          <ul className="space-y-1">
            {[...items, ...(extra ?? [])].map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="block rounded-xl px-3 py-3 text-base font-medium text-ink hover:bg-brand-50">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="mt-4 grid gap-2">
          {signedInHome ? (
            <Link href={signedInHome} className={buttonClasses("primary", "md")}>
              My dashboard
            </Link>
          ) : (
            <>
              <Link href="/sign-up" className={buttonClasses("primary", "md")}>
                Join Kora
              </Link>
              <Link href="/sign-in" className={buttonClasses("secondary", "md")}>
                Sign in
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
