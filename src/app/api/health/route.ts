import { NextResponse } from "next/server";
import { asAnon } from "@/lib/db";
import { features } from "@/lib/env";

export const runtime = "nodejs";

/** Liveness/readiness for uptime monitoring. Exposes no configuration details. */
export async function GET() {
  let database = false;
  if (features.database) {
    try {
      await asAnon((q) => q(`select 1`));
      database = true;
    } catch {
      database = false;
    }
  }
  return NextResponse.json({ status: database ? "ok" : "degraded", database }, { status: database ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
