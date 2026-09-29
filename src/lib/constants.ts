/** Versions of the legal documents / consent texts users agree to. */
export const CONSENT_VERSIONS = {
  terms_of_service: "2026-09",
  privacy_policy: "2026-09",
  ai_assistant: "2026-09",
  health_data_storage: "2026-09",
  matching_personalization: "2026-09",
  product_updates: "2026-09",
} as const;

export type ConsentType = keyof typeof CONSENT_VERSIONS;

export const LANGUAGES: Record<string, string> = {
  en: "English",
  fr: "French",
  es: "Spanish",
  pt: "Portuguese",
  ht: "Haitian Creole",
  sw: "Swahili",
  am: "Amharic",
  ti: "Tigrinya",
  so: "Somali",
  yo: "Yoruba",
  ig: "Igbo",
  ha: "Hausa",
  tw: "Twi",
  wo: "Wolof",
  zu: "Zulu",
  ar: "Arabic",
  lin: "Lingala",
  jam: "Jamaican Patois",
};

export const PAYMENT_OPTIONS: Record<string, string> = {
  public_insurance: "Public health insurance",
  private_insurance: "Private insurance",
  employer_benefits: "Employer benefits",
  self_pay: "Self-pay",
  sliding_scale: "Sliding scale fees",
};

export const COUNTRIES: Record<string, string> = {
  CA: "Canada",
  US: "United States",
  GB: "United Kingdom",
  FR: "France",
  NG: "Nigeria",
  GH: "Ghana",
  KE: "Kenya",
  ZA: "South Africa",
  JM: "Jamaica",
  TT: "Trinidad and Tobago",
  BB: "Barbados",
  HT: "Haiti",
};

export const EMERGENCY_NOTE =
  "Kora does not provide emergency or medical care. If you think you may be having a medical emergency, call 911 (or your local emergency number) or go to the nearest emergency department.";

/** Validates a post-auth redirect target: same-origin relative paths only. */
export function safeNextPath(next: unknown, fallback = "/"): string {
  if (typeof next !== "string") return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  if (/[\r\n]/.test(next)) return fallback;
  return next;
}
