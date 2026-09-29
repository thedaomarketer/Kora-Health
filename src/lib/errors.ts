/**
 * Error mapping. Postgres errors raised by Kora's own functions use
 * dedicated SQLSTATE codes and carry messages written for end users. Any
 * other error is logged server-side and replaced with a generic message so
 * internals never leak to the client.
 */

const USER_FACING_CODES = new Set([
  "22023", // invalid_parameter_value — validation messages from Kora functions
  "P0002", // no_data_found — "not found" messages from Kora functions
]);

const FRIENDLY: Record<string, string> = {
  "23505": "That already exists.",
  "42501": "You don't have permission to do that.",
  "23514": "Some of the information provided isn't valid.",
};

export type ActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

interface PgLikeError {
  code?: string;
  message?: string;
}

export function toUserMessage(err: unknown): string {
  const e = err as PgLikeError;
  if (e?.code && USER_FACING_CODES.has(e.code) && e.message) {
    return capitalize(e.message);
  }
  if (e?.code === "42501" && e.message && /required|not allowed|cannot|only /i.test(e.message) && !/permission denied for/i.test(e.message)) {
    return capitalize(e.message);
  }
  if (e?.code && FRIENDLY[e.code]) return FRIENDLY[e.code];
  if (e?.message === "Database is not configured") {
    return "Kora's database isn't configured in this environment yet.";
  }
  console.error("[kora] unexpected error", sanitizeForLog(err));
  return "Something went wrong. Please try again.";
}

export function failure(err: unknown): ActionResult<never> {
  return { ok: false, error: toUserMessage(err) };
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Strip query parameters/values from pg errors before logging. */
export function sanitizeForLog(err: unknown) {
  if (err && typeof err === "object") {
    const { code, message, name, routine } = err as Record<string, unknown>;
    return { name, code, message, routine };
  }
  return { message: String(err) };
}
