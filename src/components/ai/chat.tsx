"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, Send, Sparkles } from "lucide-react";
import { SafeMarkdown } from "./safe-markdown";
import { cn } from "@/lib/cn";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  safety?: boolean;
}

const STARTERS = [
  "I'm not sure what kind of provider I need for recurring headaches.",
  "Help me prepare questions for my first appointment with a new family doctor.",
  "What's the difference between a psychologist and a psychotherapist?",
  "I'd like a provider who speaks French and offers virtual visits.",
];

export function KoraChat({
  conversationId: initialId,
  initialMessages,
  specialties,
}: {
  conversationId: string | null;
  initialMessages: Message[];
  specialties: Record<string, string>;
}) {
  const router = useRouter();
  const [conversationId, setConversationId] = useState(initialId);
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    setBusy(true);
    setError(null);
    setInput("");
    const userMsg: Message = { id: `u-${Date.now()}`, role: "user", content: message };
    const assistantId = `a-${Date.now()}`;
    setMessages((m) => [...m, userMsg, { id: assistantId, role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, message }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Kora AI couldn't respond. Please try again.");
      }
      const newId = res.headers.get("X-Kora-Conversation");
      const safety = (res.headers.get("X-Kora-Safety") ?? "").split(",").some((f) => ["emergency", "crisis_self_harm", "harm_to_others", "abuse_or_unsafe"].includes(f));
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((m) => m.map((x) => (x.id === assistantId ? { ...x, content: acc, safety } : x)));
      }
      if (newId && newId !== conversationId) {
        setConversationId(newId);
        router.replace(`/patient/ai/${newId}`, { scroll: false });
      }
    } catch (err) {
      setError((err as Error).message);
      setMessages((m) => m.filter((x) => x.id !== assistantId));
      setInput(message);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void send(input);
  }

  return (
    <div className="flex min-h-[60dvh] flex-col rounded-3xl bg-white ring-1 ring-line/80">
      <div className="flex items-start gap-3 border-b border-line/70 px-5 py-4">
        <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-brand-800 text-clay-200"><Sparkles aria-hidden className="size-5" /></div>
        <div className="text-sm">
          <p className="font-semibold text-ink">Kora AI · healthcare navigation assistant</p>
          <p className="text-muted">
            General information only — not a doctor, not a diagnosis. In an emergency call 911 or your local emergency number.
          </p>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-6" aria-live="polite" aria-busy={busy}>
        {messages.length === 0 ? (
          <div className="mx-auto max-w-xl py-6 text-center">
            <p className="font-display text-2xl font-semibold text-ink">How can I help you navigate your care?</p>
            <p className="mt-2 text-sm text-muted">Describe what&apos;s going on in your own words. You don&apos;t need to share identifying details.</p>
            <ul className="mt-6 grid gap-2 text-left sm:grid-cols-2">
              {STARTERS.map((s) => (
                <li key={s}>
                  <button type="button" onClick={() => void send(s)} className="h-full w-full rounded-2xl bg-canvas p-3 text-left text-sm text-ink ring-1 ring-line hover:ring-brand-300">
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {messages.map((m) => (
          <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[90%] rounded-2xl px-4 py-3 text-[0.95rem] leading-relaxed sm:max-w-[80%]",
                m.role === "user" && "rounded-br-md bg-brand-700 text-white",
                m.role === "assistant" && !m.safety && "rounded-bl-md bg-canvas text-ink ring-1 ring-line/70",
                m.role === "assistant" && m.safety && "rounded-bl-md bg-red-50 text-red-950 ring-2 ring-red-300",
              )}
            >
              <span className="sr-only">{m.role === "user" ? "You said:" : "Kora AI said:"}</span>
              {m.role === "assistant" && m.safety ? (
                <p className="mb-2 flex items-center gap-2 font-semibold"><AlertTriangle aria-hidden className="size-4" /> Safety information</p>
              ) : null}
              {m.content ? (
                m.role === "assistant" ? <SafeMarkdown text={m.content} specialties={specialties} /> : <p className="whitespace-pre-wrap">{m.content}</p>
              ) : (
                <span className="inline-flex items-center gap-2 text-muted"><Loader2 aria-hidden className="size-4 animate-spin" /> Thinking…</span>
              )}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <form onSubmit={onSubmit} className="border-t border-line/70 p-4">
        {error ? <p role="alert" className="mb-2 text-sm font-medium text-red-700">{error}</p> : null}
        <div className="flex items-end gap-2">
          <label htmlFor="kora-ai-input" className="sr-only">Message Kora AI</label>
          <textarea
            id="kora-ai-input"
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(input);
              }
            }}
            rows={2}
            maxLength={4000}
            placeholder="Type your message…"
            className="block min-h-12 w-full resize-none rounded-2xl border-0 px-4 py-3 ring-1 ring-inset ring-line placeholder:text-stone-500 focus:ring-2 focus:ring-brand-500 focus:outline-none"
          />
          <button type="submit" disabled={busy || !input.trim()} className="grid size-12 shrink-0 place-items-center rounded-full bg-brand-700 text-white hover:bg-brand-800 disabled:opacity-50">
            {busy ? <Loader2 aria-hidden className="size-5 animate-spin" /> : <Send aria-hidden className="size-5" />}
            <span className="sr-only">Send</span>
          </button>
        </div>
        <p className="mt-2 text-xs text-muted">Enter to send · Shift+Enter for a new line. Conversations are private to you and can be deleted.</p>
      </form>
    </div>
  );
}
