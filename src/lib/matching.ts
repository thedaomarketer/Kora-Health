/**
 * Transparent provider matching.
 *
 * Scores providers ONLY on criteria the patient explicitly selected
 * (need/specialty, care type, location, language, payment, availability)
 * and explains every point awarded. It never uses — and has no access to —
 * race, ethnicity, or other sensitive attributes of patients or providers,
 * and verification status is shown but never used to rank.
 */

export interface MatchPreferences {
  specialties: string[];
  care?: "virtual" | "in_person" | "either";
  city?: string | null;
  country?: string | null;
  languages: string[];
  payment: string[];
  acceptingOnly?: boolean;
}

export interface MatchableProvider {
  id: string;
  specialties: { slug: string; name: string }[];
  offers_virtual: boolean;
  offers_in_person: boolean;
  languages: string[];
  payment_options: string[];
  accepting_new_patients: boolean;
  has_availability: boolean;
  locations: { city: string; region: string | null; country: string }[];
}

export interface MatchResult<P> {
  provider: P;
  score: number;
  reasons: string[];
  gaps: string[];
}

const WEIGHTS = { specialty: 40, care: 20, location: 15, language: 15, payment: 5, availability: 5 };

export function scoreProvider<P extends MatchableProvider>(
  p: P,
  prefs: MatchPreferences,
  labels: { language: (c: string) => string; payment: (c: string) => string },
): MatchResult<P> {
  let score = 0;
  const reasons: string[] = [];
  const gaps: string[] = [];

  // Specialty / need
  if (prefs.specialties.length) {
    const matched = p.specialties.filter((s) => prefs.specialties.includes(s.slug));
    if (matched.length) {
      score += WEIGHTS.specialty;
      reasons.push(`Offers ${matched.map((m) => m.name.toLowerCase()).join(" and ")}, which matches the care you're looking for.`);
    } else {
      gaps.push("Doesn't list the specialty you selected.");
    }
  }

  // Care type
  const wantsVirtual = prefs.care === "virtual";
  const wantsInPerson = prefs.care === "in_person";
  if (wantsVirtual) {
    if (p.offers_virtual) {
      score += WEIGHTS.care;
      reasons.push("Offers virtual appointments.");
    } else gaps.push("Doesn't offer virtual appointments.");
  } else if (wantsInPerson) {
    if (p.offers_in_person) {
      score += WEIGHTS.care;
      reasons.push("Sees patients in person.");
    } else gaps.push("Doesn't offer in-person appointments.");
  } else if (p.offers_virtual || p.offers_in_person) {
    score += WEIGHTS.care / 2;
  }

  // Location
  const city = prefs.city?.trim().toLowerCase();
  const inCity = city ? p.locations.some((l) => l.city.toLowerCase() === city) : false;
  const inCountry = prefs.country ? p.locations.some((l) => l.country === prefs.country) : false;
  if (inCity && !wantsVirtual) {
    score += WEIGHTS.location;
    reasons.push(`Has a practice location in ${p.locations.find((l) => l.city.toLowerCase() === city)?.city}.`);
  } else if (p.offers_virtual && (wantsVirtual || prefs.care !== "in_person") && (inCountry || !prefs.country)) {
    score += WEIGHTS.location * (wantsVirtual ? 1 : 0.6);
    if (city && !inCity) reasons.push("Not located in your city, but offers virtual care.");
  } else if (inCountry) {
    score += WEIGHTS.location / 3;
    if (city) gaps.push(`Not located in ${prefs.city}.`);
  } else if (city || prefs.country) {
    gaps.push("Located outside the area you selected.");
  }

  // Language
  if (prefs.languages.length) {
    const shared = p.languages.filter((l) => prefs.languages.includes(l));
    if (shared.length) {
      score += WEIGHTS.language;
      reasons.push(`Provides care in ${shared.map(labels.language).join(", ")}.`);
    } else gaps.push("Doesn't list a language you selected.");
  }

  // Payment
  if (prefs.payment.length) {
    const shared = p.payment_options.filter((o) => prefs.payment.includes(o));
    if (shared.length) {
      score += WEIGHTS.payment;
      reasons.push(`Accepts ${shared.map(labels.payment).join(", ").toLowerCase()}.`);
    } else gaps.push("Payment options may differ from your preferences — check with the provider.");
  }

  // Availability
  if (p.accepting_new_patients && p.has_availability) {
    score += WEIGHTS.availability;
    reasons.push("Accepting new patients and online appointment requests.");
  } else if (!p.accepting_new_patients) {
    gaps.push("Not currently accepting new patients.");
  }

  return { provider: p, score: Math.round(score), reasons, gaps };
}

export function rankProviders<P extends MatchableProvider>(
  providers: P[],
  prefs: MatchPreferences,
  labels: { language: (c: string) => string; payment: (c: string) => string },
  limit = 10,
): MatchResult<P>[] {
  return providers
    .filter((p) => !prefs.acceptingOnly || p.accepting_new_patients)
    .map((p) => scoreProvider(p, prefs, labels))
    .filter((r) => !prefs.specialties.length || r.gaps.every((g) => !g.startsWith("Doesn't list the specialty")))
    .sort((a, b) => b.score - a.score || a.gaps.length - b.gaps.length)
    .slice(0, limit);
}
