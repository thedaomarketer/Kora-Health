import "server-only";
import { z } from "zod";

/**
 * Server-side environment. Never import this from client components —
 * `server-only` makes that a build error. Public values that the browser
 * needs are read separately in `public-env.ts`.
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_KORA_ENV: z.enum(["development", "preview", "production"]).default("development"),
  NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),

  NEXT_PUBLIC_SUPABASE_URL: z.url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20).optional(),
  /** Connection string for the `kora_app` role (see docs/DEPLOYMENT.md). */
  DATABASE_URL: z.string().startsWith("postgres").optional(),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(50).default(5),
  DATABASE_SSL: z.enum(["require", "disable"]).default("require"),

  ANTHROPIC_API_KEY: z.string().min(10).optional(),
  KORA_AI_MODEL: z.string().default("claude-sonnet-5-5"),

  STRIPE_SECRET_KEY: z.string().startsWith("sk_").optional(),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_").optional(),

  CRON_SECRET: z.string().min(16).optional(),
});

function load() {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    // Log names only — never values.
    const fields = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Invalid environment configuration: ${fields}`);
  }
  return parsed.data;
}

export const env = load();

export const features = {
  get database() {
    return Boolean(env.DATABASE_URL);
  },
  get auth() {
    return Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  },
  get ai() {
    return Boolean(env.ANTHROPIC_API_KEY);
  },
  get payments() {
    return Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET);
  },
  get accountDeletion() {
    return Boolean(env.SUPABASE_SERVICE_ROLE_KEY && env.NEXT_PUBLIC_SUPABASE_URL);
  },
};

/** Sample (is_demo) profiles are never shown in production. */
export const showDemoData = env.NEXT_PUBLIC_KORA_ENV !== "production";
