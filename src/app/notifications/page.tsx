import type { Metadata } from "next";
import Link from "next/link";
import { Bell } from "lucide-react";
import { EmptyState } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { asUser } from "@/lib/db";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/cn";
import { markNotificationsReadAction } from "@/app/settings/actions";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const user = await requireUser({ next: "/notifications" });
  const items = await asUser(user, (q) =>
    q<{ id: string; title: string; body: string | null; link: string | null; read_at: string | null; created_at: string }>(
      `select id, title, body, link, read_at, created_at from public.notifications where user_id = auth.uid() order by created_at desc limit 100`,
    ),
  );
  const unread = items.filter((n) => !n.read_at).length;
  return (
    <>
      <PageHeader
        title="Notifications"
        description="Updates about appointments, messages and your account. Notifications never include message contents."
        actions={unread ? <form action={markNotificationsReadAction}><Button type="submit" variant="secondary" size="sm">Mark all as read</Button></form> : null}
      />
      {items.length ? (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-white ring-1 ring-line/80">
          {items.map((n) => (
            <li key={n.id} className={cn("flex gap-4 p-4", !n.read_at && "bg-clay-50/60")}>
              <Bell aria-hidden className={cn("mt-0.5 size-5 shrink-0", n.read_at ? "text-stone-400" : "text-clay-600")} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ink">
                  {n.link ? <Link href={n.link} className="hover:underline">{n.title}</Link> : n.title}
                  {!n.read_at ? <span className="sr-only"> (unread)</span> : null}
                </p>
                {n.body ? <p className="text-sm text-muted">{n.body}</p> : null}
              </div>
              <span className="shrink-0 text-xs text-muted">{formatRelative(n.created_at)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={<Bell aria-hidden className="size-6" />} title="No notifications" description="You're all caught up." />
      )}
    </>
  );
}
