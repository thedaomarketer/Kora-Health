"use client";

import { useState } from "react";
import { LocateFixed, Loader2 } from "lucide-react";

/**
 * Uses the browser's geolocation (only after the user clicks) to search by
 * distance. Coordinates are rounded to ~1 km and only placed in the search
 * URL — they are never stored.
 */
export function UseLocationButton({ formId }: { formId: string }) {
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  function locate() {
    if (!("geolocation" in navigator)) {
      setState("error");
      return;
    }
    setState("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const form = document.getElementById(formId) as HTMLFormElement | null;
        if (!form) return;
        const set = (name: string, value: string) => {
          let input = form.querySelector<HTMLInputElement>(`input[name="${name}"]`);
          if (!input) {
            input = document.createElement("input");
            input.type = "hidden";
            input.name = name;
            form.appendChild(input);
          }
          input.value = value;
        };
        set("lat", pos.coords.latitude.toFixed(2));
        set("lng", pos.coords.longitude.toFixed(2));
        const radius = form.querySelector<HTMLSelectElement>('select[name="radius"]');
        if (radius && !radius.value) radius.value = "50";
        form.requestSubmit();
      },
      () => setState("error"),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 600_000 },
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={locate}
        className="inline-flex min-h-10 items-center gap-2 rounded-full px-3 text-sm font-semibold text-brand-700 ring-1 ring-brand-200 hover:bg-brand-50"
      >
        {state === "loading" ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <LocateFixed aria-hidden className="size-4" />}
        Use my location
      </button>
      <p aria-live="polite" className="mt-1 text-xs text-red-700">
        {state === "error" ? "We couldn't get your location. You can search by city instead." : ""}
      </p>
    </div>
  );
}
