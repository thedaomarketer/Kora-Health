import type { Metadata } from "next";
import { ConversationList } from "@/components/care/conversation";
import { PageHeader } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { listConversations } from "@/lib/care";

export const metadata: Metadata = { title: "Messages" };

export default async function ProviderMessages() {
  const user = await requireUser({ role: "provider" });
  const conversations = await listConversations(user);
  return (
    <>
      <PageHeader title="Messages" description="Secure conversations with patients who have requested care with you." />
      <ConversationList conversations={conversations} base="/provider/messages" viewer="provider" />
    </>
  );
}
