import "server-only";
import pg from "pg";
import { env } from "@/lib/env";

/**
 * Database access with row-level security.
 *
 * The app connects as `kora_app`, a NOINHERIT role with no privileges of its
 * own (like PostgREST's `authenticator`). Every query runs inside a
 * transaction that switches to `anon`, `authenticated` or `service_role`
 * and sets the verified JWT claims, so Postgres RLS policies apply exactly
 * as they would through the Supabase REST API.
 *
 * Only three entry points exist: asAnon, asUser, asService. Use asService
 * sparingly (webhooks, scheduled jobs, AI message persistence) — it bypasses RLS.
 */

// Return timestamps as ISO-8601 strings and dates as YYYY-MM-DD so values
// serialize predictably from Server Components to Client Components.
const parseTimestamptz = pg.types.getTypeParser(pg.types.builtins.TIMESTAMPTZ);
pg.types.setTypeParser(pg.types.builtins.TIMESTAMPTZ, (v: string) => (parseTimestamptz(v) as Date).toISOString());
pg.types.setTypeParser(pg.types.builtins.DATE, (v: string) => v);

export class DatabaseUnavailableError extends Error {
  constructor() {
    super("Database is not configured");
  }
}

declare global {
  var __koraPool: pg.Pool | undefined;
}

function pool(): pg.Pool {
  if (!env.DATABASE_URL) throw new DatabaseUnavailableError();
  if (!globalThis.__koraPool) {
    globalThis.__koraPool = new pg.Pool({
      connectionString: env.DATABASE_URL,
      max: env.DATABASE_POOL_MAX,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 5_000,
      ssl: env.DATABASE_SSL === "require" ? { rejectUnauthorized: true } : undefined,
      statement_timeout: 10_000,
    });
  }
  return globalThis.__koraPool;
}

export type Query = <R extends pg.QueryResultRow = Record<string, unknown>>(
  text: string,
  params?: unknown[],
) => Promise<R[]>;

type DbRole = "anon" | "authenticated" | "service_role";

async function run<T>(role: DbRole, claims: Record<string, unknown> | null, fn: (q: Query) => Promise<T>): Promise<T> {
  const client = await pool().connect();
  try {
    await client.query("begin");
    await client.query(
      "select set_config('role', $1, true), set_config('request.jwt.claims', $2, true)",
      [role, claims ? JSON.stringify(claims) : ""],
    );
    const q: Query = async (text, params = []) => (await client.query(text, params)).rows;
    const result = await fn(q);
    await client.query("commit");
    return result;
  } catch (err) {
    await client.query("rollback").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export function asAnon<T>(fn: (q: Query) => Promise<T>) {
  return run("anon", null, fn);
}

export function asUser<T>(user: { id: string; email?: string | null }, fn: (q: Query) => Promise<T>) {
  return run("authenticated", { sub: user.id, role: "authenticated", email: user.email ?? undefined }, fn);
}

/** Bypasses RLS. Only for trusted server-side jobs; never with user-controlled SQL. */
export function asService<T>(fn: (q: Query) => Promise<T>) {
  return run("service_role", { role: "service_role" }, fn);
}
