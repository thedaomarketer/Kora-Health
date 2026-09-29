"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Fades and lifts content into view once as it scrolls on screen.
 *
 * Rule: an element is revealed as soon as its top edge is above the bottom of
 * the viewport — so sections skipped by a jump link (#faq) or a fast scroll
 * still appear. Content is fully visible without JavaScript and for
 * reduced-motion users (the hidden state is only applied after mount).
 */
export function Reveal({ children, className, delay = 0, as: Tag = "div" }: { children: ReactNode; className?: string; delay?: number; as?: "div" | "section" | "li" }) {
  const ref = useRef<HTMLElement>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const threshold = () => window.innerHeight * 0.92;
    if (el.getBoundingClientRect().top < threshold()) return; // already in view: no animation

    setHidden(true); // arm after mount so server-rendered content stays visible
    let frame = 0;
    const check = () => {
      frame = 0;
      if (el.getBoundingClientRect().top < threshold()) {
        setHidden(false);
        cleanup();
      }
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(check);
    };
    function cleanup() {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(frame);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return cleanup;
  }, []);

  return (
    <Tag
      ref={ref as never}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
      className={cn("transition-[opacity,translate] duration-700 ease-out", hidden && "translate-y-6 opacity-0", className)}
    >
      {children}
    </Tag>
  );
}
