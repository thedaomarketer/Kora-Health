"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { currentActiveUser } from "@/lib/auth/session";
import { asUser } from "@/lib/db";
import { uuid } from "@/lib/validation";

export async function deleteAiConversationAction(fd: FormData) {
  const user = await currentActiveUser("patient");
  if (!user) redirect("/sign-in");
  const id = uuid.parse(fd.get("id"));
  await asUser(user, async (q) => {
    await q(`delete from public.ai_conversations where id = $1`, [id]);
    await q(`select public.record_audit_event('ai.conversation_deleted', 'ai_conversation', $1)`, [id]);
  });
  revalidatePath("/patient/ai");
  redirect("/patient/ai");
}
