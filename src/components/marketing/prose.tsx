import type { ReactNode } from "react";
import { Alert } from "@/components/ui/alert";

export function ProsePage({ title, intro, children, draft }: { title: string; intro?: ReactNode; children: ReactNode; draft?: boolean }) {
  return (
    <div className="container-page max-w-3xl py-12 sm:py-16">
      <h1 className="font-display text-4xl font-semibold tracking-tight text-ink">{title}</h1>
      {intro ? <p className="mt-4 text-lg leading-relaxed text-muted">{intro}</p> : null}
      {draft ? (
        <Alert tone="warning" title="Draft — pending legal review" className="mt-6">
          This document describes how the Kora platform is built to work. It has not yet been reviewed by legal counsel
          and will be finalized before public launch. It does not claim certification or regulatory compliance.
        </Alert>
      ) : null}
      <div className="mt-10 space-y-8 leading-relaxed text-ink/90 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-ink [&_h2]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_p+p]:mt-3 [&_a]:text-brand-700 [&_a]:underline">
        {children}
      </div>
    </div>
  );
}
