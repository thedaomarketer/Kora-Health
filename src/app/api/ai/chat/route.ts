import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { streamReply, buildSystemPrompt, type ChatTurn } from "@/lib/ai/assistant";
import { classifyUserMessage, requiresSafetyResponse, reviewAssistantOutput, safetyResponse, type SafetyFlag } from "@/lib/ai/safety";
import { getSessionUser } from "@/lib/auth/session";
import { COUNTRIES, LANGUAGES } from "@/lib/constants";
import { asService, asUser } from "@/lib/db";
import { features } from "@/lib/env";
import { isSameOrigin } from "@/lib/http";
import { sanitizeForLog } from "@/lib/errors";

export const runtime = "nodejs";
export const maxDuration = 120;

const bodySchema = z.object({
  conversationId: z.uuid().nullish(),
  message: z.string().trim().min(1).max(4000),
});

function json(status: number, error: string) {
  return NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return json(403, "Forbidden");
  const user = await getSessionUser();
  if (!user || user.status !== "active") return json(401, "Please sign in to use Kora AI.");
  if (user.role !== "patient") return json(403, "Kora AI is available on patient accounts.");

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json(400, "Messages must be between 1 and 4,000 characters.");
  const { message } = parsed.data;

  // Consent, rate limits and conversation ownership — all checked as the user (RLS).
  const pre = await asUser(user, async (q) => {
    const [{ consent }] = await q<{ consent: boolean }>(`select public.has_consent(auth.uid(), 'ai_assistant') as consent`);
    if (!consent) return { error: "consent" as const };
    const [{ hour }] = await q<{ hour: boolean }>(`select public.check_rate_limit('ai_chat_hour', 30, 3600) as hour`);
    const [{ day }] = await q<{ day: boolean }>(`select public.check_rate_limit('ai_chat_day', 150, 86400) as day`);
    if (!hour || !day) return { error: "rate" as const };

    let conversationId = parsed.data.conversationId ?? null;
    if (conversationId) {
      const owned = await q(`select 1 from public.ai_conversations where id = $1`, [conversationId]);
      if (!owned.length) return { error: "notfound" as const };
    } else {
      const title = message.replace(/\s+/g, " ").slice(0, 80);
      [{ id: conversationId }] = await q<{ id: string }>(`insert into public.ai_conversations (title) values ($1) returning id`, [title]);
    }
    const history = await q<ChatTurn>(
      `select role, content from (select role, content, created_at from public.ai_messages where conversation_id = $1
         order by created_at desc limit 20) m order by created_at asc`,
      [conversationId],
    );
    const specialties = await q<{ slug: string; name: string }>(`select slug, name from public.specialties order by sort_order`);
    const [consentMatch] = await q<{ ok: boolean }>(`select public.has_consent(auth.uid(), 'matching_personalization') as ok`);
    const prefs = consentMatch.ok
      ? (await q<{ city: string | null; country: string | null; preferred_languages: string[]; care_modality_preference: string }>(
          `select city, country, preferred_languages, care_modality_preference from public.patient_profiles where user_id = auth.uid()`,
        ))[0]
      : null;
    return { conversationId: conversationId as string, history, specialties, prefs };
  });

  if ("error" in pre) {
    if (pre.error === "consent") return json(403, "Turn on Kora AI in Settings → Privacy & consent to continue.");
    if (pre.error === "rate") return json(429, "You've reached the Kora AI message limit for now. Please try again later.");
    return json(404, "Conversation not found.");
  }

  const flags = classifyUserMessage(message);
  const headers = {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Kora-Conversation": pre.conversationId,
    "X-Kora-Safety": flags.join(","),
    "X-Content-Type-Options": "nosniff",
  };

  async function persist(userFlags: SafetyFlag[], assistantText: string, assistantFlags: SafetyFlag[], model: string | null) {
    // Ownership was verified above as the user; writes are server-only.
    await asService(async (q) => {
      await q(
        `insert into public.ai_messages (conversation_id, role, content, safety_flags, model, created_at) values
           ($1, 'user', $2, $3, null, now()), ($1, 'assistant', $4, $5, $6, now() + interval '1 millisecond')`,
        [pre.conversationId, message, userFlags, assistantText, assistantFlags, model],
      );
      await q(`update public.ai_conversations set updated_at = now() where id = $1 and user_id = $2`, [pre.conversationId, user!.id]);
    });
  }

  // Emergencies and crises: fixed safety response, no model call.
  if (requiresSafetyResponse(flags)) {
    const text = safetyResponse(flags);
    await persist(flags, text, flags, "kora-safety-v1");
    return new Response(text, { headers });
  }

  if (!features.ai) {
    const text =
      "Kora AI's conversational assistant isn't enabled in this environment yet. You can still search the provider directory or use **Find care** to get matched with relevant providers.";
    await persist(flags, text, [], "unavailable");
    return new Response(text, { headers });
  }

  const context = pre.prefs
    ? `Context the person has chosen to share for personalization: ${[
        pre.prefs.city && `city: ${pre.prefs.city}`,
        pre.prefs.country && `country: ${COUNTRIES[pre.prefs.country] ?? pre.prefs.country}`,
        pre.prefs.preferred_languages.length && `preferred languages: ${pre.prefs.preferred_languages.map((l) => LANGUAGES[l] ?? l).join(", ")}`,
        `care preference: ${pre.prefs.care_modality_preference.replace("_", " ")}`,
      ]
        .filter(Boolean)
        .join("; ")}.`
    : null;
  const flagNote =
    flags.includes("medication_change") || flags.includes("diagnosis_request")
      ? "\n\nNote for this turn: the latest message asks about a diagnosis or a medication change. Stay within your limits: explain generally, and direct them to a clinician or pharmacist."
      : "";

  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      let result;
      try {
        result = await streamReply({
          system: buildSystemPrompt(pre.specialties),
          context: context || flagNote ? `${context ?? ""}${flagNote}`.trim() : null,
          history: [...pre.history, { role: "user", content: message }],
          onText: (delta) => controller.enqueue(encoder.encode(delta)),
        });
      } catch (err) {
        console.error("[kora] ai stream failed", sanitizeForLog(err));
        const text = "\n\nSorry — Kora AI couldn't respond just now. Please try again in a moment.";
        controller.enqueue(encoder.encode(text));
        controller.close();
        return;
      }
      let finalText = result.text;
      const outFlags: SafetyFlag[] = [...flags];
      if (result.refused) {
        const note = (finalText ? "\n\n" : "") + "I can't help with that request. If you have a health concern, a healthcare professional is the best person to talk to — I can help you find one.";
        finalText += note;
        controller.enqueue(encoder.encode(note));
      }
      const review = reviewAssistantOutput(finalText);
      if (review.note) {
        finalText += review.note;
        outFlags.push(...review.flags);
        controller.enqueue(encoder.encode(review.note));
      }
      try {
        await persist(flags, finalText || "(no response)", outFlags, result.model);
      } catch (err) {
        console.error("[kora] ai persist failed", sanitizeForLog(err));
      }
      controller.close();
    },
  });
  return new Response(body, { headers });
}
