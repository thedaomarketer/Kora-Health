import type { MetadataRoute } from "next";
import { asAnon } from "@/lib/db";
import { features } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const pages = ["", "/providers", "/ai", "/for-providers", "/pricing", "/about", "/privacy", "/terms", "/security"].map((p) => ({
    url: `${site}${p}`,
    changeFrequency: "weekly" as const,
  }));
  if (!features.database) return pages;
  try {
    // RLS (anon) returns only public profiles; sample data is never listed.
    const providers = await asAnon((q) =>
      q<{ slug: string; updated_at: string }>(`select slug, updated_at from public.provider_profiles where not is_demo order by updated_at desc limit 5000`),
    );
    return [...pages, ...providers.map((p) => ({ url: `${site}/providers/${p.slug}`, lastModified: p.updated_at }))];
  } catch {
    return pages;
  }
}
