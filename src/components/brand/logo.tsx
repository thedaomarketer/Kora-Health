import { cn } from "@/lib/cn";

/**
 * Kora mark: three connected nodes forming a "K" — people, professionals and
 * services linked together — inside a soft rounded tile.
 */
export function KoraMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" aria-hidden className={cn("size-9", className)}>
      <rect width="40" height="40" rx="12" fill="#0f524c" />
      <path d="M14 10v20" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M15 20.5 26.5 11" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M17.5 18.5 27 29" stroke="#eba57f" strokeWidth="3.2" strokeLinecap="round" />
      <circle cx="27.5" cy="11" r="3" fill="#fff" />
      <circle cx="27.5" cy="29" r="3" fill="#eba57f" />
    </svg>
  );
}

export function KoraLogo({ className, inverse = false }: { className?: string; inverse?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <KoraMark />
      <span className={cn("text-lg font-bold tracking-tight", inverse ? "text-white" : "text-ink")}>
        Kora <span className={inverse ? "text-brand-200" : "text-brand-700"}>Health</span>
      </span>
    </span>
  );
}
