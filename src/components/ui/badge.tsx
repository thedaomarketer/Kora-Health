import { BadgeCheck, Clock, FlaskConical, ShieldAlert, ShieldX } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "neutral" | "brand" | "success" | "warning" | "danger" | "info" | "clay";

const tones: Record<Tone, string> = {
  neutral: "bg-stone-100 text-stone-700 ring-stone-200",
  brand: "bg-brand-50 text-brand-800 ring-brand-200",
  success: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  warning: "bg-amber-50 text-amber-900 ring-amber-200",
  danger: "bg-red-50 text-red-800 ring-red-200",
  info: "bg-sky-50 text-sky-900 ring-sky-200",
  clay: "bg-clay-50 text-clay-700 ring-clay-200",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset whitespace-nowrap",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export type VerificationStatus = "unverified" | "pending" | "verified" | "rejected" | "suspended";

/**
 * The only component allowed to render a provider's verification state.
 * "License verified" appears solely for status === 'verified', which the
 * database only sets after a Kora verifier completes the checklist.
 */
export function VerificationBadge({ status, verifiedAt }: { status: VerificationStatus; verifiedAt?: string | Date | null }) {
  if (status === "verified") {
    const date = verifiedAt ? new Date(verifiedAt).toLocaleDateString("en-CA", { year: "numeric", month: "short" }) : null;
    return (
      <Badge tone="success">
        <BadgeCheck aria-hidden className="size-3.5" />
        License verified
        {date ? <span className="sr-only"> by Kora on {date}</span> : null}
      </Badge>
    );
  }
  if (status === "pending") {
    return (
      <Badge tone="warning">
        <Clock aria-hidden className="size-3.5" />
        Verification pending
      </Badge>
    );
  }
  if (status === "rejected") {
    return (
      <Badge tone="danger">
        <ShieldX aria-hidden className="size-3.5" />
        Not verified
      </Badge>
    );
  }
  if (status === "suspended") {
    return (
      <Badge tone="danger">
        <ShieldAlert aria-hidden className="size-3.5" />
        Suspended
      </Badge>
    );
  }
  return <Badge tone="neutral">Not yet verified</Badge>;
}

export function DemoBadge() {
  return (
    <Badge tone="info">
      <FlaskConical aria-hidden className="size-3.5" />
      Sample profile
    </Badge>
  );
}
