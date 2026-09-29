import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { AiWorkspace } from "./shared";

export const metadata: Metadata = { title: "Kora AI" };

export default async function KoraAiPage() {
  const user = await requireUser({ role: "patient" });
  return <AiWorkspace user={user} conversationId={null} />;
}
