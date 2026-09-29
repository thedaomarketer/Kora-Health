"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  Bookmark,
  Building2,
  CalendarDays,
  Clock,
  CreditCard,
  Flag,
  HeartPulse,
  Home,
  KeyRound,
  Link2,
  ListChecks,
  MessagesSquare,
  Search,
  ShieldCheck,
  Sparkles,
  UserRound,
  Users,
} from "lucide-react";
import { cn } from "@/lib/cn";

const ICONS = {
  home: Home,
  sparkles: Sparkles,
  search: Search,
  calendar: CalendarDays,
  messages: MessagesSquare,
  bookmark: Bookmark,
  heart: HeartPulse,
  link: Link2,
  book: BookOpen,
  users: Users,
  user: UserRound,
  building: Building2,
  clock: Clock,
  shield: ShieldCheck,
  chart: BarChart3,
  card: CreditCard,
  flag: Flag,
  list: ListChecks,
  key: KeyRound,
};

export interface NavItem {
  href: string;
  label: string;
  icon: keyof typeof ICONS;
}

export function AppNav({ items, userName }: { items: NavItem[]; userName: string }) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || (href.split("/").length > 2 && pathname.startsWith(`${href}/`));
  return (
    <nav aria-label="Account" className="border-b border-line/70 bg-white lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r">
      <p className="hidden truncate px-6 pb-2 pt-6 text-sm text-muted lg:block">
        Signed in as <span className="font-semibold text-ink">{userName}</span>
      </p>
      <ul className="flex gap-1 overflow-x-auto px-3 py-2 [scrollbar-width:none] lg:sticky lg:top-16 lg:flex-col lg:overflow-visible lg:px-3 lg:py-3">
        {items.map((item) => {
          const Icon = ICONS[item.icon];
          const active = isActive(item.href);
          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-10 items-center gap-3 whitespace-nowrap rounded-xl px-3 text-sm font-medium",
                  active ? "bg-brand-700 text-white" : "text-ink/80 hover:bg-brand-50 hover:text-brand-800",
                )}
              >
                <Icon aria-hidden className="size-4.5 shrink-0" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
