import type { Metadata } from "next";
import { ConversationList } from "@/components/care/conversation";
import { Alert } from "@/components/ui/alert";
import { PageHeader } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { listConversations } from "@/lib/care";

export const metadata: Metadata = { title: "Messages" };

export default async function PatientMessages({ searchParams }: PageProps<"/patient/messages">) {
  const user = await requireUser({ role: "patient" });
  const sp = await searchParams;
  const conversations = await listConversations(user);
  return (
    <>
      <PageHeader title="Messages" description="Secure conversations with providers you've requested care from." />
      {sp.error ? <Alert tone="warning" className="mb-4">Messaging opens after you&apos;ve requested an appointment with the provider.</Alert> : null}
      <ConversationList conversations={conversations} base="/patient/messages" viewer="patient" />
    </>
  );
}
