import "server-only";
import type { Query } from "@/lib/db";
import { CONSENT_VERSIONS, type ConsentType } from "@/lib/constants";

/** Append consent rows only where the choice actually changed. */
export async function syncConsents(q: Query, choices: Partial<Record<ConsentType, boolean>>) {
  const current = await q<{ consent_type: string; granted: boolean }>(
    `select consent_type, granted from public.current_consents where user_id = auth.uid()`,
  );
  const map = new Map(current.map((c) => [c.consent_type, c.granted]));
  for (const [type, granted] of Object.entries(choices) as [ConsentType, boolean][]) {
    if ((map.get(type) ?? false) === granted && map.has(type)) continue;
    if (!map.has(type) && !granted) continue;
    await q(`insert into public.consents (user_id, consent_type, version, granted) values (auth.uid(), $1, $2, $3)`, [
      type,
      CONSENT_VERSIONS[type],
      granted,
    ]);
  }
}
