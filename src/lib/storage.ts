import "server-only";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { SessionUser } from "@/lib/auth/session";
import { asUser } from "@/lib/db";
import { env, features } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Private file storage (Supabase Storage). Uploads use the signed-in user's
 * session so Storage RLS policies apply; downloads are short-lived signed
 * URLs issued only after a database authorization check.
 */

/** Storage requires the Supabase Storage API and the buckets from migration 0007. */
export function storageConfigured() {
  return features.storage;
}

const EXT: Record<string, string> = { "application/pdf": "pdf", "image/png": "png", "image/jpeg": "jpg" };

function cleanFileName(name: string) {
  return name.replace(/[^\w.\- ]+/g, "_").slice(0, 120) || "attachment";
}

export async function uploadAttachment(user: SessionUser, conversationId: string, fileName: string, mime: string, bytes: Uint8Array) {
  if (!storageConfigured()) {
    throw Object.assign(new Error("attachments are not available in this environment"), { code: "22023" });
  }
  const path = `${conversationId}/${randomUUID()}.${EXT[mime]}`;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.storage.from("message-attachments").upload(path, bytes, { contentType: mime, upsert: false });
  if (error) throw Object.assign(new Error("we couldn't upload that file"), { code: "22023" });
  const [row] = await asUser(user, (q) =>
    q<{ id: string }>(
      `insert into public.message_attachments (conversation_id, storage_path, file_name, mime_type, size_bytes)
       values ($1, $2, $3, $4, $5) returning id`,
      [conversationId, path, cleanFileName(fileName), mime, bytes.byteLength],
    ),
  );
  return row.id;
}

/** Returns a 60-second signed URL if the user may read the attachment. */
export async function signedAttachmentUrl(user: SessionUser, attachmentId: string) {
  const [row] = await asUser(user, (q) =>
    q<{ storage_path: string; file_name: string }>(`select storage_path, file_name from public.message_attachments where id = $1`, [attachmentId]),
  );
  if (!row || !env.SUPABASE_SERVICE_ROLE_KEY || !env.NEXT_PUBLIC_SUPABASE_URL) return null;
  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { data } = await admin.storage.from("message-attachments").createSignedUrl(row.storage_path, 60, { download: row.file_name });
  return data?.signedUrl ?? null;
}
