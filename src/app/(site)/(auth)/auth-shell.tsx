import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";

export function AuthShell({ title, description, children, footer }: { title: string; description?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="container-page flex justify-center py-12 sm:py-16">
      <div className="w-full max-w-md">
        <h1 className="text-center font-display text-3xl font-semibold tracking-tight text-ink">{title}</h1>
        {description ? <p className="mt-2 text-center text-muted">{description}</p> : null}
        <Card className="mt-8 p-6 sm:p-8">{children}</Card>
        {footer ? <div className="mt-6 text-center text-sm text-muted">{footer}</div> : null}
      </div>
    </div>
  );
}
