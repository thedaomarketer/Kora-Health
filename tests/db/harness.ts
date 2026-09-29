/**
 * Database test harness.
 *
 * Creates an isolated database per test file, applies the Supabase auth shim,
 * every migration, and the development seed, then lets tests run SQL as the
 * `anon` or `authenticated` role with JWT claims — the same way PostgREST
 * executes requests on Supabase. This lets us test RLS policies and
 * SECURITY DEFINER functions against real Postgres.
 *
 * Requires TEST_DATABASE_URL pointing at a Postgres superuser connection
 * (e.g. postgres://postgres:postgres@localhost:5432/postgres).
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import pg from "pg";

const ROOT = join(__dirname, "..", "..");
export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

export class DbHarness {
  private admin!: pg.Client;
  private dbName = `kora_test_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async setup() {
    const root = new pg.Client({ connectionString: this.baseUrl });
    await root.connect();
    await root.query(`create database ${this.dbName}`);
    await root.end();

    const url = new URL(this.baseUrl);
    url.pathname = `/${this.dbName}`;
    this.admin = new pg.Client({ connectionString: url.toString() });
    await this.admin.connect();

    const files = [
      join(ROOT, "supabase", "tests", "auth_shim.sql"),
      ...readdirSync(join(ROOT, "supabase", "migrations"))
        .filter((f) => f.endsWith(".sql"))
        .sort()
        .map((f) => join(ROOT, "supabase", "migrations", f)),
      join(ROOT, "supabase", "seed.sql"),
    ];
    for (const file of files) {
      await this.admin.query(readFileSync(file, "utf8"));
    }
  }

  async teardown() {
    await this.admin?.end();
    const root = new pg.Client({ connectionString: this.baseUrl });
    await root.connect();
    await root.query(`drop database if exists ${this.dbName} with (force)`);
    await root.end();
  }

  /** Run SQL as the database owner (bypasses RLS). */
  async sql<T extends pg.QueryResultRow = pg.QueryResultRow>(text: string, params: unknown[] = []) {
    return (await this.admin.query<T>(text, params)).rows;
  }

  /** Create an auth user (fires the same triggers as Supabase sign-up). */
  async createUser(role: "patient" | "provider", displayName = "Test User") {
    const id = randomUUID();
    await this.sql(
      `insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)`,
      [id, `${id}@example.test`, JSON.stringify({ role, display_name: displayName })],
    );
    return id;
  }

  async makeAdmin(userId: string, role: "moderator" | "verifier" | "superadmin") {
    await this.sql(`insert into public.administrators (user_id, admin_role) values ($1, $2)`, [userId, role]);
  }

  /**
   * Run a function inside a transaction as the given user (or anon when
   * userId is null). The transaction is rolled back unless commit = true.
   */
  async as<T>(
    userId: string | null,
    fn: (q: <R extends pg.QueryResultRow = pg.QueryResultRow>(text: string, params?: unknown[]) => Promise<R[]>) => Promise<T>,
    commit = true,
  ): Promise<T> {
    await this.admin.query("begin");
    try {
      if (userId) {
        await this.admin.query(`select set_config('request.jwt.claims', $1, true)`, [
          JSON.stringify({ sub: userId, role: "authenticated" }),
        ]);
        await this.admin.query("set local role authenticated");
      } else {
        await this.admin.query(`select set_config('request.jwt.claims', '', true)`);
        await this.admin.query("set local role anon");
      }
      const q = async <R extends pg.QueryResultRow = pg.QueryResultRow>(text: string, params: unknown[] = []) =>
        (await this.admin.query<R>(text, params)).rows;
      const result = await fn(q);
      await this.admin.query(commit ? "commit" : "rollback");
      return result;
    } catch (err) {
      await this.admin.query("rollback");
      throw err;
    }
  }
}

/** Next weekday (Mon–Fri) at the given local hour in a time zone, as ISO. */
export async function nextWeekdaySlot(db: DbHarness, tz: string, hour: number, daysAhead = 2) {
  const rows = await db.sql<{ slot: string }>(
    `select ((d::date + make_time($2, 0, 0)) at time zone $1)::text as slot
       from generate_series(current_date + $3::int, current_date + $3::int + 7, interval '1 day') d
      where extract(isodow from d) between 1 and 5
      order by d limit 1`,
    [tz, hour, daysAhead],
  );
  return rows[0].slot;
}
