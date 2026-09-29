import Link from "next/link";
import { Plus, Sparkles, Trash2 } from "lucide-react";
import { KoraChat } from "@/components/ai/chat";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { SessionUser } from "@/lib/auth/session";
import { asUser } from "@/lib/db";
import { features } from "@/lib/env";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/cn";
import { setConsentAction } from "@/app/settings/actions";
import { deleteAiConversationAction } from "./actions";

const SAFETY = ["emergency", "crisis_self_harm", "harm_to_others", "abuse_or_unsafe"];

export async function AiWorkspace({ user, conversationId }: { user: SessionUser; conversationId: string | null }) {
  const data = await asUser(user, async (q) => {
    const [{ consent }] = await q<{ consent: boolean }>(`select public.has_consent(auth.uid(), 'ai_assistant') as consent`);
    const conversations = await q<{ id: string; title: string; updated_at: string }>(
      `select id, title, updated_at from public.ai_conversations order by updated_at desc limit 50`,
    );
    const specialties = await q<{ slug: string; name: string }>(`select slug, name from public.specialties`);
    const messages = conversationId
      ? await q<{ id: string; role: "user" | "assistant"; content: string; safety_flags: string[] }>(
          `select m.id, m.role, m.content, m.safety_flags from public.ai_messages m
             join public.ai_conversations c on c.id = m.conversation_id
            where c.id = $1 order by m.created_at asc`,
          [conversationId],
        )
      : [];
    const exists = conversationId ? conversations.some((c) => c.id === conversationId) : true;
    return { consent, conversations, specialties, messages, exists };
  });

  if (!data.consent) {
    return (
      <Card className="mx-auto max-w-2xl p-6 sm:p-8">
        <Sparkles aria-hidden className="size-8 text-clay-600" />
        <h1 className="mt-3 text-2xl font-bold text-ink">Before you use Kora AI</h1>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-ink/85">
          <li>Kora AI is a navigation assistant. It provides general information and doesn&apos;t diagnose, prescribe or replace a healthcare professional.</li>
          <li>Messages you send are processed by our AI service provider to generate responses, and stored so you can revisit them. You can delete conversations any time.</li>
          <li>Only share what you&apos;re comfortable with. You don&apos;t need to include names or identifying details.</li>
          <li><strong>It isn&apos;t for emergencies.</strong> If you may be having an emergency, call 911 or your local emergency number.</li>
        </ul>
        <form action={setConsentAction} className="mt-6 flex flex-wrap gap-3">
          <input type="hidden" name="type" value="ai_assistant" />
          <input type="hidden" name="granted" value="1" />
          <input type="hidden" name="back" value="/patient/ai" />
          <Button type="submit">I understand — turn on Kora AI</Button>
          <ButtonLink href="/patient/find" variant="secondary">Use Find care instead</ButtonLink>
        </form>
      </Card>
    );
  }
  if (!data.exists) {
    return <Alert tone="warning">That conversation wasn&apos;t found. <Link href="/patient/ai" className="underline">Start a new one</Link>.</Alert>;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
      <aside aria-label="Conversations" className="order-2 lg:order-1">
        <ButtonLink href="/patient/ai" variant="secondary" size="sm" className="w-full"><Plus aria-hidden className="size-4" /> New conversation</ButtonLink>
        <ul className="mt-3 space-y-1">
          {data.conversations.map((c) => (
            <li key={c.id}>
              <Link href={`/patient/ai/${c.id}`} aria-current={c.id === conversationId ? "page" : undefined}
                className={cn("block rounded-xl px-3 py-2 text-sm", c.id === conversationId ? "bg-brand-50 font-semibold text-brand-900" : "text-ink/80 hover:bg-brand-50/60")}>
                <span className="line-clamp-1">{c.title}</span>
                <span className="text-xs text-muted">{formatRelative(c.updated_at)}</span>
              </Link>
            </li>
          ))}
        </ul>
        {conversationId ? (
          <form action={deleteAiConversationAction} className="mt-4">
            <input type="hidden" name="id" value={conversationId} />
            <Button type="submit" variant="ghost" size="sm"><Trash2 aria-hidden className="size-4" /> Delete this conversation</Button>
          </form>
        ) : null}
      </aside>
      <div className="order-1 space-y-4 lg:order-2">
        <h1 className="sr-only">Kora AI</h1>
        {!features.ai ? (
          <Alert tone="warning" title="Conversational AI isn't enabled in this environment">
            Emergency guidance still works, and you can use <Link href="/patient/find" className="underline">Find care</Link> for rule-based provider matching.
          </Alert>
        ) : null}
        <KoraChat
          key={conversationId ?? "new"}
          conversationId={conversationId}
          specialties={Object.fromEntries(data.specialties.map((s) => [s.slug, s.name]))}
          initialMessages={data.messages.map((m) => ({ id: m.id, role: m.role, content: m.content, safety: m.role === "assistant" && m.safety_flags.some((f) => SAFETY.includes(f)) }))}
        />
      </div>
    </div>
  );
}
