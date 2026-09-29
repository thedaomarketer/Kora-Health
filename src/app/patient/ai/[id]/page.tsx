import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { AiWorkspace } from "../shared";

export const metadata: Metadata = { title: "Kora AI" };

export default async function KoraAiConversation({ params }: PageProps<"/patient/ai/[id]">) {
  const user = await requireUser({ role: "patient" });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  return <AiWorkspace user={user} conversationId={id} />;
}
