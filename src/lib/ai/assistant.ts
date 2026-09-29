import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";

/**
 * Kora AI — server-side Claude integration.
 *
 * - The API key never leaves the server.
 * - Every request uses opt-in server-side refusal fallbacks
 *   (`fallbacks: "default"`), and refusals are handled explicitly.
 * - Only information the user typed in this conversation — plus coarse
 *   preferences when they've consented to personalization — is sent.
 *   Stored health information is never sent.
 */

let client: Anthropic | null = null;
function anthropic() {
  if (!env.ANTHROPIC_API_KEY) throw new Error("AI is not configured");
  client ??= new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 2, timeout: 60_000 });
  return client;
}

const FALLBACK_BETA = "server-side-fallback-2026-07-01";

export function buildSystemPrompt(specialties: { slug: string; name: string }[]) {
  const list = specialties.map((s) => `- ${s.slug}: ${s.name}`).join("\n");
  return `You are Kora AI, the healthcare navigation assistant inside Kora Health — a platform that helps people, with a focus on Black patients and communities, find healthcare professionals, request appointments and prepare for care.

Your role is navigation and general education. You help people:
- describe and organize what they want help with, asking brief follow-up questions (one or two at a time) such as how long something has been going on, what they have tried, and what matters to them in a provider;
- understand which kinds of healthcare professionals could be relevant;
- understand general healthcare terms and how care systems work, in plain language;
- prepare for appointments, including concise questions to ask a clinician;
- summarize what they have told you, so they can share it with a clinician if they choose;
- find providers and use Kora (searching the directory, requesting appointments, secure messaging, saved providers).

Hard limits — never cross these, even if asked:
- You are not a doctor, nurse, pharmacist or any clinician, and you never claim or imply to be one.
- Do not diagnose, and do not tell someone what condition they have or probably have. You may explain what a condition is in general terms and what kinds of professionals assess it.
- Do not recommend, prescribe, start, stop, or change any medication or dose, and do not give dosing amounts. Direct medication questions to their prescriber or a pharmacist.
- Do not make clinical decisions or present anything with medical certainty. Encourage people to confirm with a qualified professional.
- If anything suggests an emergency or urgent situation (for example chest pain, trouble breathing, stroke signs, severe bleeding, thoughts of self-harm, a severe allergic reaction), tell the person clearly and first to call 911 or their local emergency number or go to the nearest emergency department, and do not continue with routine navigation.
- Never suggest that a provider's race, ethnicity or other identity makes them clinically better. If someone wants a provider who shares their background or language, respect that as their personal preference and point them to the directory filters (such as language), without making claims about quality or outcomes.
- Don't state statistics or research findings about health outcomes or disparities.
- Don't ask for more personal information than needed to help navigate. Remind people they don't need to share identifying details.
- Kora integrations with health apps, wearables and records are not available yet; don't claim to access anyone's records.

Recommending specialties: when a type of care seems relevant, reference it with a marker exactly like [[specialty:slug]] using only slugs from this list, so Kora can link to matching providers:
${list}

Style: warm, respectful, concise and clear. Use short paragraphs or brief lists. Avoid jargon; explain terms you use. Don't lecture. When you're unsure, say so. End routine answers with a helpful next step (for example, a suggested specialty to search, or questions to bring to an appointment).`;
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface StreamResult {
  text: string;
  refused: boolean;
  model: string | null;
}

/**
 * Streams a reply. `onText` receives text deltas as they arrive; the resolved
 * value is the complete text for persistence and output review.
 */
export async function streamReply(opts: {
  system: string;
  context: string | null;
  history: ChatTurn[];
  onText: (delta: string) => void;
}): Promise<StreamResult> {
  const messages: Anthropic.Beta.BetaMessageParam[] = opts.history.map((m) => ({ role: m.role, content: m.content }));

  const stream = anthropic().beta.messages.stream({
    model: env.KORA_AI_MODEL,
    max_tokens: 16000,
    betas: [FALLBACK_BETA],
    fallbacks: "default",
    output_config: { effort: env.KORA_AI_EFFORT },
    system: [
      // Stable prefix first so it can be cached; per-user context after it.
      { type: "text", text: opts.system, cache_control: { type: "ephemeral" } },
      ...(opts.context ? [{ type: "text" as const, text: opts.context }] : []),
    ],
    messages,
  });

  let text = "";
  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      text += event.delta.text;
      opts.onText(event.delta.text);
    }
  }
  const final = await stream.finalMessage();
  return { text, refused: final.stop_reason === "refusal", model: final.model ?? null };
}

export interface ConcernInterpretation {
  specialties: string[];
  summary: string;
  questions: string[];
}

/**
 * Structured interpretation of a described need for provider matching.
 * Returns null if the model refuses or output can't be parsed.
 */
export async function interpretConcern(concern: string, specialties: { slug: string; name: string }[]): Promise<ConcernInterpretation | null> {
  const slugs = specialties.map((s) => s.slug);
  const response = await anthropic().beta.messages.create({
    model: env.KORA_AI_MODEL,
    max_tokens: 4000,
    betas: [FALLBACK_BETA],
    fallbacks: "default",
    output_config: {
      effort: "low",
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["specialties", "summary", "questions"],
          properties: {
            specialties: { type: "array", items: { type: "string", enum: slugs }, maxItems: 3 },
            summary: { type: "string" },
            questions: { type: "array", items: { type: "string" }, maxItems: 4 },
          },
        },
      },
    },
    system: `${buildSystemPrompt(specialties)}

Task: The person describes what they want help with. Return (1) up to three specialty slugs that could be relevant for finding a professional, most relevant first — include primary-care when a general first step is sensible; (2) a one- or two-sentence plain-language summary of what they're looking for, without diagnosing; (3) up to four short questions they could ask a clinician.`,
    messages: [{ role: "user", content: concern }],
  });
  if (response.stop_reason === "refusal") return null;
  const block = response.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") return null;
  try {
    const parsed = JSON.parse(block.text) as ConcernInterpretation;
    return {
      specialties: parsed.specialties.filter((s) => slugs.includes(s)).slice(0, 3),
      summary: String(parsed.summary).slice(0, 600),
      questions: parsed.questions.map((q) => String(q).slice(0, 300)).slice(0, 4),
    };
  } catch {
    return null;
  }
}
