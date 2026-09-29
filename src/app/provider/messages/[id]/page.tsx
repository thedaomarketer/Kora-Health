import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ConversationThread } from "@/components/care/conversation";
import { requireUser } from "@/lib/auth/session";
import { getConversation } from "@/lib/care";

export const metadata: Metadata = { title: "Conversation" };

export default async function ProviderConversation({ params }: PageProps<"/provider/messages/[id]">) {
  const user = await requireUser({ role: "provider" });
  const { id } = await params;
  const data = await getConversation(user, id);
  if (!data) notFound();
  return <ConversationThread user={user} conversation={data.conversation} messages={data.messages} backHref="/provider/messages" />;
}
