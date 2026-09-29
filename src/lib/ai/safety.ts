/**
 * Kora AI safety layer (deterministic, runs before and after the model).
 *
 * - Pre-check: messages suggesting a possible emergency or crisis receive a
 *   fixed, human-reviewed response directing the person to emergency or
 *   crisis services. The language model is NOT called for these.
 * - Other flags (medication changes, diagnosis requests) are passed to the
 *   model as context and recorded for aggregate safety monitoring.
 * - Post-check: responses that look like dosing instructions, diagnoses or
 *   claims to be a clinician get a corrective note appended and are flagged.
 *
 * Pattern matching is conservative by design (false positives are
 * acceptable; false negatives are not) and currently English-only — see
 * docs/AI_SAFETY.md for known limitations.
 */

export type SafetyFlag =
  | "emergency"
  | "crisis_self_harm"
  | "harm_to_others"
  | "abuse_or_unsafe"
  | "medication_change"
  | "diagnosis_request"
  | "output_policy_review";

const PATTERNS: Record<Exclude<SafetyFlag, "output_policy_review">, RegExp[]> = {
  crisis_self_harm: [
    /\b(kill|hurt|harm|cut)(ing)?\s+my\s?self\b/i,
    /\bsuicid(e|al)\b/i,
    /\bend(ing)?\s+(my|it all|my own)\s*(life)?\b.*\b(life|all)\b/i,
    /\bend my life\b/i,
    /\b(don'?t|do not)\s+want\s+to\s+(live|be alive|wake up)\b/i,
    /\bwant(ed)?\s+to\s+die\b/i,
    /\bself[-\s]?harm/i,
    /\bno reason to live\b/i,
    /\boverdos(e|ed|ing)\s+on\s+purpose\b/i,
  ],
  emergency: [
    /\bchest\s+(pain|pressure|tightness|hurts?)\b/i,
    /\b(can'?t|cannot|unable to|struggling to|hard to|trouble)\s+breath(e|ing)?\b/i,
    /\b(difficulty|trouble)\s+breathing\b/i,
    /\bshort(ness)?\s+of\s+breath\b/i,
    /\b(face|mouth)\s+(is\s+)?droop/i,
    /\bslurr?(ed|ing)\s+(speech|words)\b/i,
    /\b(sudden|suddenly)\b.*\b(numb|weak|paraly[sz]|vision loss|can'?t see|confus|severe headache|worst headache)/i,
    /\bstroke\b/i,
    /\bheart attack\b/i,
    /\b(severe|heavy|uncontrollable|won'?t stop)\s+bleeding\b/i,
    /\bbleeding\s+(heavily|a lot|won'?t stop)\b/i,
    /\b(unconscious|unresponsive|passed out|not breathing|stopped breathing|no pulse)\b/i,
    /\bseizure|convuls/i,
    /\boverdos(e|ed|ing)\b/i,
    /\b(poison(ed|ing)?|swallowed\s+(bleach|chemicals|pills|battery))\b/i,
    /\banaphyla/i,
    /\b(throat|tongue|lips?)\s+(is\s+|are\s+)?(closing|swelling|swollen)\b/i,
    /\b(coughing|vomiting|throwing)\s+(up\s+)?blood\b/i,
    /\bsevere\s+(allergic reaction|burn|head injury|abdominal pain|stomach pain)\b/i,
    /\b(pregnan\w*)\b.*\b(bleeding|severe pain|no movement)\b/i,
    /\bmedical emergency\b/i,
  ],
  harm_to_others: [/\b(kill|hurt|harm|shoot|stab)\s+(someone|somebody|him|her|them|people)\b/i],
  abuse_or_unsafe: [
    /\b(being|been|getting)\s+(abused|hit|beaten|assaulted)\b/i,
    /\b(he|she|they|partner|husband|wife|boyfriend|girlfriend)\s+(hits|beats|hurts|chokes|threatens)\s+me\b/i,
    /\b(not|don'?t feel)\s+safe\s+(at home|with)\b/i,
  ],
  medication_change: [
    /\b(stop|quit|skip)(ping)?\s+(taking\s+)?(my\s+)?([\w-]+\s+){0,3}(med(ication)?s?|pills?|insulin|prescription|tablets?)\b/i,
    /\b(change|increase|decrease|double|halve|lower|raise|adjust)\s+(my\s+)?([\w-]+\s+){0,3}(dose|dosage|medication|meds)\b/i,
    /\bhow\s+(much|many)\b.*\b(mg|milligrams?|pills?|tablets?|units?)\b.*\b(take|should)\b/i,
    /\bhow\s+(much|many)\s+.*\bshould\s+I\s+take\b/i,
  ],
  diagnosis_request: [
    /\b(do|could|might)\s+I\s+have\b/i,
    /\bwhat('?s| is)\s+wrong\s+with\s+me\b/i,
    /\bdiagnos(e|is)\s+(me|my)\b/i,
    /\bis\s+(it|this)\s+(cancer|serious|diabetes|an? \w+ infection)\b/i,
  ],
};

const PRIORITY: SafetyFlag[] = ["crisis_self_harm", "emergency", "harm_to_others", "abuse_or_unsafe", "medication_change", "diagnosis_request"];

export function classifyUserMessage(text: string): SafetyFlag[] {
  const normalized = text.normalize("NFKC").replace(/\s+/g, " ");
  return PRIORITY.filter((flag) => PATTERNS[flag as keyof typeof PATTERNS].some((re) => re.test(normalized)));
}

/** Flags that stop the model call and return a fixed safety response. */
export function requiresSafetyResponse(flags: SafetyFlag[]) {
  return flags.some((f) => f === "emergency" || f === "crisis_self_harm" || f === "harm_to_others" || f === "abuse_or_unsafe");
}

export function safetyResponse(flags: SafetyFlag[]): string {
  if (flags.includes("crisis_self_harm")) {
    return [
      "I'm really glad you reached out. What you're feeling matters, and you deserve support right now from a person who can help.",
      "",
      "**If you might act on thoughts of harming yourself, or you're in immediate danger, call 911 (or your local emergency number) now, or go to the nearest emergency department.**",
      "",
      "You can also reach a crisis line any time, free and confidential:",
      "- **Canada:** call or text **9-8-8** (Suicide Crisis Helpline)",
      "- **United States:** call or text **988** (Suicide & Crisis Lifeline)",
      "- **United Kingdom & Ireland:** call **116 123** (Samaritans)",
      "- Elsewhere: contact your local emergency number",
      "",
      "If you can, let someone you trust know how you're feeling and stay with them. When you're ready, Kora can help you find a mental health professional — but please reach out to one of the services above first.",
    ].join("\n");
  }
  if (flags.includes("emergency")) {
    return [
      "**What you've described could be a medical emergency.**",
      "",
      "**Call 911 (or your local emergency number) now, or go to the nearest emergency department.** Don't wait, and don't drive yourself if you're feeling unwell — ask someone to take you or call for an ambulance.",
      "",
      "Kora AI can't assess emergencies. If you're unsure whether it's urgent, it's safest to treat it as one. In Canada you can also call 811 for health advice, and in the UK you can call 111 when it isn't life-threatening.",
    ].join("\n");
  }
  if (flags.includes("harm_to_others")) {
    return [
      "It sounds like someone may be at risk of harm. **If anyone is in immediate danger, call 911 (or your local emergency number) now.**",
      "",
      "If you're having thoughts of hurting someone, you can talk to someone right away: in Canada or the United States call or text **988**; in the UK call **116 123**. A mental health professional can help — Kora can help you find one when you're ready.",
    ].join("\n");
  }
  return [
    "Your safety matters. **If you're in immediate danger, call 911 (or your local emergency number) now.**",
    "",
    "If you're experiencing abuse or don't feel safe at home, confidential support is available: in Canada, contact a local shelter or call **211** to be connected with services; in the United States call the **National Domestic Violence Hotline at 1-800-799-7233**; in the UK call the **National Domestic Abuse Helpline at 0808 2000 247**.",
    "",
    "If it's safe to do so, you can continue here and Kora can help you find a healthcare professional or counsellor.",
  ].join("\n");
}

const OUTPUT_PATTERNS: RegExp[] = [
  /\b(take|increase|decrease|double|reduce|raise|lower|start|stop)\b[^.\n]{0,50}\b\d+(\.\d+)?\s?(mg|mcg|µg|g|ml|mL|units?|IU|tablets?|pills?)\b/i,
  /\byou\s+(definitely|probably|likely|most likely)?\s*(have|are suffering from|are experiencing)\s+(an?\s+)?(diagnos|cancer|diabetes|infection|disorder|disease|syndrome)/i,
  /\bmy diagnosis is\b/i,
  /\bI\s+am\s+(a|your)\s+(doctor|physician|nurse|clinician|pharmacist|therapist)\b/i,
  /\bI\s+(prescribe|am prescribing)\b/i,
];

export function reviewAssistantOutput(text: string): { flags: SafetyFlag[]; note: string | null } {
  if (OUTPUT_PATTERNS.some((re) => re.test(text))) {
    return {
      flags: ["output_policy_review"],
      note:
        "\n\n---\n*Reminder: Kora AI isn't a clinician. It can't diagnose conditions or tell you how to take or change medication. Please confirm anything above with a healthcare professional or pharmacist before acting on it.*",
    };
  }
  return { flags: [], note: null };
}
