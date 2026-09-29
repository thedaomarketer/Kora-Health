import Link from "next/link";
import { ArrowLeft, Lock, Paperclip } from "lucide-react";
import { ReportDialog } from "@/components/report-dialog";
import { Alert, EmptyState } from "@/components/ui/alert";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { SessionUser } from "@/lib/auth/session";
import type { ConversationRow, MessageRow } from "@/lib/care";
import { features } from "@/lib/env";
import { formatDateTime, formatRelative } from "@/lib/format";
import { cn } from "@/lib/cn";
import { closeConversationAction, sendMessageAction } from "@/app/patient/actions";
import { reportAction } from "@/app/(site)/providers/actions";
import { MessageComposer } from "./message-composer";

export function ConversationList({ conversations, base, viewer }: { conversations: ConversationRow[]; base: string; viewer: "patient" | "provider" }) {
  if (!conversations.length) {
    return (
      <EmptyState
        title="No conversations yet"
        description={
          viewer === "patient"
            ? "Messaging opens once you've requested an appointment with a provider."
            : "Conversations appear when patients who have requested care message you."
        }
      />
    );
  }
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-white ring-1 ring-line/80">
      {conversations.map((c) => (
        <li key={c.id}>
          <Link href={`${base}/${c.id}`} className="flex items-start gap-4 p-4 hover:bg-brand-50/50">
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <p className={cn("truncate text-ink", c.unread ? "font-bold" : "font-semibold")}>
                  {viewer === "patient" ? c.provider_name : c.patient_display_name}
                </p>
                {c.last_message_at ? <span className="shrink-0 text-xs text-muted">{formatRelative(c.last_message_at)}</span> : null}
              </div>
              <p className="mt-0.5 truncate text-sm text-muted">{c.last_message ?? "No messages yet"}</p>
            </div>
            {c.unread ? <Badge tone="clay">{c.unread} new</Badge> : null}
            {c.status !== "open" ? <Badge>Closed</Badge> : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function ConversationThread({
  user,
  conversation,
  messages,
  backHref,
}: {
  user: SessionUser;
  conversation: ConversationRow;
  messages: MessageRow[];
  backHref: string;
}) {
  const title = user.role === "patient" ? conversation.provider_name : conversation.patient_display_name;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href={backHref} className="grid size-10 place-items-center rounded-full hover:bg-brand-50" aria-label="Back to messages">
            <ArrowLeft aria-hidden className="size-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-ink">{title}</h1>
            <p className="flex items-center gap-1 text-xs text-muted">
              <Lock aria-hidden className="size-3" /> Visible only to you and {user.role === "patient" ? "this provider" : "this patient"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <ReportDialog action={reportAction} targetType="conversation" targetId={conversation.id} label="Report" />
          {conversation.status === "open" ? (
            <form action={closeConversationAction}>
              <input type="hidden" name="conversationId" value={conversation.id} />
              <Button type="submit" variant="ghost" size="sm">Close conversation</Button>
            </form>
          ) : null}
        </div>
      </div>

      {user.role === "patient" ? (
        <Alert tone="warning">
          Messages aren&apos;t monitored in real time and aren&apos;t for emergencies. If you need urgent help, call 911 or your local emergency number.
        </Alert>
      ) : null}

      <ol aria-label="Messages" className="flex flex-col gap-3 rounded-3xl bg-white p-4 ring-1 ring-line/80 sm:p-6">
        {messages.length === 0 ? <li className="py-8 text-center text-sm text-muted">No messages yet. Say hello.</li> : null}
        {messages.map((m) => {
          const mine = m.sender_id === user.id;
          return (
            <li key={m.id} className={cn("flex max-w-[85%] flex-col", mine ? "self-end items-end" : "self-start items-start")}>
              <span className="sr-only">{mine ? "You" : title} wrote:</span>
              <div className={cn("whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-[0.95rem] leading-relaxed", mine ? "rounded-br-md bg-brand-700 text-white" : "rounded-bl-md bg-canvas text-ink ring-1 ring-line/70")}>
                {m.body}
                {m.attachment_id ? (
                  <a href={`/api/attachments/${m.attachment_id}`} className={cn("mt-2 flex items-center gap-1.5 text-sm underline", mine ? "text-white" : "text-brand-700")}>
                    <Paperclip aria-hidden className="size-4" /> {m.attachment_name}
                  </a>
                ) : null}
              </div>
              <span className="mt-1 flex items-center gap-2 text-xs text-muted">
                {formatDateTime(m.created_at)}
                {mine ? <span>· {m.read_at ? "Read" : "Sent"}</span> : null}
                {!mine ? <ReportDialog action={reportAction} targetType="message" targetId={m.id} label="Report" /> : null}
              </span>
            </li>
          );
        })}
      </ol>

      {conversation.status === "open" ? (
        <ActionForm action={sendMessageAction} resetOnSuccess className="rounded-3xl bg-white p-4 ring-1 ring-line/80">
          <input type="hidden" name="conversationId" value={conversation.id} />
          <MessageComposer attachmentsEnabled={features.storage} />
          <div className="mt-3 flex justify-end">
            <SubmitButton pendingLabel="Sending…">Send</SubmitButton>
          </div>
        </ActionForm>
      ) : (
        <p className="rounded-2xl bg-canvas p-4 text-center text-sm text-muted">This conversation is closed.</p>
      )}
    </div>
  );
}
