import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "Access denied" };

export default function ForbiddenPage() {
  return (
    <div className="container-page py-20 text-center">
      <p className="text-sm font-semibold text-brand-700">403</p>
      <h1 className="mt-2 text-3xl font-bold text-ink">You don&apos;t have access to this page</h1>
      <p className="mt-3 text-muted">If you think this is a mistake, contact Kora support.</p>
      <ButtonLink href="/" className="mt-8">
        Go home
      </ButtonLink>
    </div>
  );
}
