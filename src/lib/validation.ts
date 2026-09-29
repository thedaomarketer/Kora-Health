import { z } from "zod";
import { COUNTRIES, LANGUAGES, PAYMENT_OPTIONS } from "./constants";

/** Shared input validation (used by server actions; mirrored by DB constraints). */

export const trimmed = (max: number) => z.string().trim().max(max);
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : null));

export const email = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address.")).pipe(z.string().max(254));

export const password = z
  .string()
  .min(12, "Use at least 12 characters.")
  .max(128, "Use at most 128 characters.")
  .refine((v) => /[a-z]/i.test(v) && /[0-9\W_]/.test(v), "Include letters and at least one number or symbol.");

export const uuid = z.uuid("Invalid identifier.");

export const languageCode = z.enum(Object.keys(LANGUAGES) as [string, ...string[]]);
export const paymentOption = z.enum(Object.keys(PAYMENT_OPTIONS) as [string, ...string[]]);
export const countryCode = z.enum(Object.keys(COUNTRIES) as [string, ...string[]]);
export const careModality = z.enum(["virtual", "in_person", "both"]);
export const visitModality = z.enum(["virtual", "in_person"]);

export const httpsUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === "" || /^https:\/\/[^\s]+$/.test(v), "Use a secure link starting with https://");

export const slug = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9-]{3,80}$/, "Use 3–80 lowercase letters, numbers or hyphens.");

export function slugify(input: string) {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Read a FormData into a plain object; repeated keys become arrays. */
export function formToObject(fd: FormData, arrayKeys: string[] = []) {
  const out: Record<string, unknown> = {};
  for (const key of new Set(fd.keys())) {
    if (key.startsWith("$ACTION")) continue;
    const values = fd.getAll(key).filter((v): v is string => typeof v === "string");
    out[key] = arrayKeys.includes(key) ? values : values[0];
  }
  for (const key of arrayKeys) if (!(key in out)) out[key] = [];
  return out;
}

export function fieldErrors(error: z.ZodError) {
  return z.flattenError(error).fieldErrors as Record<string, string[]>;
}
