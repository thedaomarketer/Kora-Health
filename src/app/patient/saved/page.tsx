import type { Metadata } from "next";
import { Bookmark } from "lucide-react";
import { ProviderCard } from "@/components/directory/provider-card";
import { EmptyState } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { asUser } from "@/lib/db";
import { loadProviderDetail, type ProviderDetail } from "@/lib/directory";

export const metadata: Metadata = { title: "Saved providers" };

export default async function SavedProviders() {
  const user = await requireUser({ role: "patient" });
  const providers = await asUser(user, async (q) => {
    const ids = await q<{ provider_id: string }>(`select provider_id from public.saved_providers where patient_id = auth.uid() order by created_at desc`);
    const out: ProviderDetail[] = [];
    for (const { provider_id } of ids) {
      const p = await loadProviderDetail(q, "p.id = $1", provider_id);
      if (p) out.push(p);
    }
    return out;
  });
  return (
    <>
      <PageHeader title="Saved providers" description="Providers you've bookmarked. Only you can see this list." />
      {providers.length ? (
        <ul className="grid gap-5 md:grid-cols-2">
          {providers.map((p) => <li key={p.id}><ProviderCard provider={p} /></li>)}
        </ul>
      ) : (
        <EmptyState icon={<Bookmark aria-hidden className="size-6" />} title="No saved providers yet" description="Use “Save provider” on any profile to keep it here." action={<ButtonLink href="/providers" size="sm">Browse providers</ButtonLink>} />
      )}
    </>
  );
}
