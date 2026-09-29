import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  if (process.env.NEXT_PUBLIC_KORA_ENV !== "production") {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/patient", "/provider", "/admin", "/settings", "/notifications", "/onboarding", "/api", "/auth"] }],
    sitemap: `${site}/sitemap.xml`,
  };
}
