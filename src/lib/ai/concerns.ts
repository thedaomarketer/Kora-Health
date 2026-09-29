/**
 * Rule-based mapping from a described healthcare need to relevant
 * specialties. Used when the AI service is unavailable, and to validate AI
 * suggestions (only known specialty slugs are ever returned).
 *
 * This is navigation guidance ("which kind of professional could help"),
 * not triage or diagnosis.
 */

export const CONCERN_RULES: { slug: string; keywords: RegExp }[] = [
  { slug: "mental-health", keywords: /\b(anxi|depress|stress|panic|mood|mental|burn ?out|trauma|ptsd|adhd|bipolar|grief|lonel)/i },
  { slug: "psychotherapy", keywords: /\b(therap|counsel|talk to someone|relationship|couples?|family conflict|grief)/i },
  { slug: "womens-health", keywords: /\b(period|menstrua|menopaus|pcos|fibroid|endometriosis|pap|gyn|contracepti|birth control)/i },
  { slug: "maternal-health", keywords: /\b(pregnan|prenatal|postpartum|postnatal|birth plan|doula|midwi|breastfeed)/i },
  { slug: "pediatrics", keywords: /\b(my (child|son|daughter|baby|toddler|kid)|infant|newborn|pediatric|paediatric)/i },
  { slug: "cardiology", keywords: /\b(blood pressure|hypertension|heart|palpitation|cholesterol|cardio)/i },
  { slug: "endocrinology", keywords: /\b(diabet|blood sugar|glucose|insulin|thyroid|hormone)/i },
  { slug: "dermatology", keywords: /\b(skin|rash|eczema|acne|psoriasis|hair loss|alopecia|scalp|keloid|hyperpigment|mole)/i },
  { slug: "hematology", keywords: /\b(sickle cell|anemi|anaemi|blood disorder|iron deficien|clotting)/i },
  { slug: "nephrology", keywords: /\b(kidney|renal|dialysis)/i },
  { slug: "oncology", keywords: /\b(cancer|tumou?r|oncolog|chemo|lump)/i },
  { slug: "neurology", keywords: /\b(migraine|headache|seizure history|epilep|numbness|nerve|memory loss|dementia|multiple sclerosis)/i },
  { slug: "gastroenterology", keywords: /\b(stomach|digest|bowel|ibs|crohn|colitis|reflux|heartburn|liver|constipat|diarrh)/i },
  { slug: "respiratory", keywords: /\b(asthma|cough|lung|breathing issues|copd|wheez)/i },
  { slug: "rheumatology", keywords: /\b(arthritis|lupus|autoimmune|joint pain|gout)/i },
  { slug: "orthopedics", keywords: /\b(back pain|knee|shoulder|fracture|bone|sprain|sports injur)/i },
  { slug: "rehabilitation", keywords: /\b(physio|rehab|mobility|recover(y|ing) from (an )?(injury|surgery)|posture)/i },
  { slug: "sexual-health", keywords: /\b(sti|std|hiv|prep\b|sexual health|testing)/i },
  { slug: "urology", keywords: /\b(prostate|urinat|bladder|erectile)/i },
  { slug: "eye-care", keywords: /\b(eye|vision|glasses|contacts|glaucoma)/i },
  { slug: "dental", keywords: /\b(tooth|teeth|dental|dentist|gum|cavity|braces)/i },
  { slug: "nutrition", keywords: /\b(diet|nutrition|weight|eating|meal plan|food)/i },
  { slug: "pharmacy", keywords: /\b(medication review|side effects?|pharmac|prescription question|drug interaction)/i },
  { slug: "sleep", keywords: /\b(sleep|insomnia|snor|apnea|apnoea)/i },
  { slug: "allergy-immunology", keywords: /\b(allerg|hives|immun)/i },
  { slug: "geriatrics", keywords: /\b(elderly|aging|ageing|my (mom|mother|dad|father|grand\w+)'?s? (memory|care))/i },
  { slug: "primary-care", keywords: /\b(check ?up|physical|family doctor|gp\b|general|vaccin|annual|screening|referral)/i },
];

export function suggestSpecialties(concern: string, known?: Set<string>, limit = 3): string[] {
  const hits = CONCERN_RULES.filter((r) => r.keywords.test(concern)).map((r) => r.slug);
  const unique = [...new Set(hits)].filter((s) => !known || known.has(s));
  // Primary care is always a reasonable first step when nothing specific matches.
  if (unique.length === 0 && (!known || known.has("primary-care"))) return ["primary-care"];
  return unique.slice(0, limit);
}
