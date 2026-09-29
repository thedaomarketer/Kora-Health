"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Only the digest is logged client-side; details stay in server logs.
    console.error("Kora error", error.digest);
  }, [error]);
  return (
    <main id="main" className="container-page flex min-h-[60dvh] flex-col items-center justify-center py-20 text-center">
      <h1 className="text-3xl font-bold text-ink">Something went wrong</h1>
      <p className="mt-3 max-w-md text-muted">Please try again. If the problem continues, contact Kora support{error.digest ? ` and mention reference ${error.digest}` : ""}.</p>
      <button type="button" onClick={reset} className="mt-8 rounded-full bg-brand-700 px-5 py-2.5 font-semibold text-white hover:bg-brand-800">
        Try again
      </button>
    </main>
  );
}
