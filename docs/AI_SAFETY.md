# Kora AI safety

Kora AI is a healthcare **navigation** assistant. Code: `src/lib/ai/*`, `src/app/api/ai/chat/route.ts`, `src/app/patient/find`.

## Layers

1. **Access**: patient accounts only; `ai_assistant` consent; per-user rate limits (30/hour, 150/day chat; 20/hour matching); same-origin check.
2. **Pre-model classifier** (`classifyUserMessage`): emergency, self-harm crisis, harm to others, abuse → fixed human-written response with emergency/crisis resources; **the model is not called**. Medication-change and diagnosis requests are flagged and the model is reminded of its limits for that turn.
3. **System prompt** (`buildSystemPrompt`): scope, hard limits (no diagnosis, no medication/dose advice, no clinician claims, emergency escalation, no race-as-quality claims, no statistics), specialty markers restricted to known slugs.
4. **Refusal handling**: server-side fallbacks (`fallbacks: "default"`) and an explicit message on `stop_reason: "refusal"`.
5. **Post-model review** (`reviewAssistantOutput`): dosing instructions, diagnoses, clinician claims → corrective note appended, `output_policy_review` flag.
6. **Monitoring**: flags stored on `ai_messages.safety_flags`; admins see aggregate counts only (`/admin/ai-safety`), never conversation content.

## Data sent to the model

Only the conversation's own messages (last 20) and — with `matching_personalization` consent — city, country, languages and care preference. Never stored health information, names, email or appointment data.

## Known limitations

- Classifier patterns are English-only and keyword-based; they favour false positives. Multilingual detection is a priority.
- No human clinical review of responses. Kora AI must remain positioned as general information.
- Before production launch: run a red-team evaluation set (emergencies phrased indirectly, medication questions, diagnosis requests, prompt injection, non-English) against the configured model and document results; get clinical advisor sign-off on safety responses.
