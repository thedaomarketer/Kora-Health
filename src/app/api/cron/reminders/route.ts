import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { asService } from "@/lib/db";
import { env } from "@/lib/env";
import { sanitizeForLog } from "@/lib/errors";

export const runtime = "nodejs";

function authorized(req: NextRequest) {
  const header = req.headers.get("authorization") ?? "";
  if (!env.CRON_SECRET) return false;
  const expected = Buffer.from(`Bearer ${env.CRON_SECRET}`);
  const given = Buffer.from(header);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Hourly (vercel.json): creates in-app reminders and expires stale requests. */
export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const [row] = await asService((q) => q<{ n: number }>(`select public.generate_appointment_reminders() as n`));
    return NextResponse.json({ reminders: row.n });
  } catch (err) {
    console.error("[kora] reminder job failed", sanitizeForLog(err));
    return NextResponse.json({ error: "Job failed" }, { status: 500 });
  }
}
