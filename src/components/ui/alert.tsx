import { AlertTriangle, CheckCircle2, Info, OctagonAlert } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "info" | "success" | "warning" | "danger";

const styles: Record<Tone, { box: string; Icon: typeof Info }> = {
  info: { box: "bg-sky-50 text-sky-950 ring-sky-200", Icon: Info },
  success: { box: "bg-emerald-50 text-emerald-950 ring-emerald-200", Icon: CheckCircle2 },
  warning: { box: "bg-amber-50 text-amber-950 ring-amber-200", Icon: AlertTriangle },
  danger: { box: "bg-red-50 text-red-950 ring-red-200", Icon: OctagonAlert },
};

export function Alert({
  tone = "info",
  title,
  children,
  className,
  role,
}: {
  tone?: Tone;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
  role?: "alert" | "status";
}) {
  const { box, Icon } = styles[tone];
  return (
    <div role={role} className={cn("flex gap-3 rounded-2xl p-4 text-sm ring-1 ring-inset", box, className)}>
      <Icon aria-hidden className="mt-0.5 size-5 shrink-0" />
      <div className="min-w-0 space-y-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className="leading-relaxed">{children}</div> : null}
      </div>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-line bg-canvas/60 px-6 py-10 text-center">
      {icon ? <div className="mb-3 grid size-12 place-items-center rounded-full bg-brand-50 text-brand-700">{icon}</div> : null}
      <p className="font-semibold text-ink">{title}</p>
      {description ? <p className="mt-1 max-w-md text-sm text-muted">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

/** Honest placeholder for functionality that is architected but not live. */
export function NotConfigured({ feature, children }: { feature: string; children?: ReactNode }) {
  return (
    <Alert tone="warning" title={`${feature} isn't available in this environment`}>
      {children ?? "This feature needs server configuration before it can be used. Nothing has been sent or saved."}
    </Alert>
  );
}
