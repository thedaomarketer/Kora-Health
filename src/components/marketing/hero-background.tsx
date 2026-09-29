"use client";

import dynamic from "next/dynamic";

// Three.js is large and purely decorative: load it after the page is interactive.
const HeroScene = dynamic(() => import("./hero-scene"), { ssr: false });

/** Animated gradient (CSS, always visible) with the WebGL scene layered on top. */
export function HeroBackground() {
  return (
    <div aria-hidden className="absolute inset-0 -z-10 overflow-hidden">
      <div className="hero-aurora absolute inset-0" />
      <div className="hero-grid absolute inset-0" />
      <HeroScene />
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-canvas" />
    </div>
  );
}
