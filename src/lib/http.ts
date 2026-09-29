import "server-only";
import type { NextRequest } from "next/server";
import { env } from "@/lib/env";

/**
 * CSRF defence for JSON route handlers (Server Actions have this built in).
 * Requires an Origin header matching the site origin or the request host.
 */
export function isSameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  try {
    const o = new URL(origin);
    const site = new URL(env.NEXT_PUBLIC_SITE_URL);
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    return o.host === site.host || o.host === host;
  } catch {
    return false;
  }
}
