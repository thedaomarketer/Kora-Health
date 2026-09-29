"use client";

import { useId } from "react";

export function MessageComposer({ attachmentsEnabled }: { attachmentsEnabled: boolean }) {
  const id = useId();
  return (
    <div className="space-y-3">
      <label htmlFor={`${id}-body`} className="sr-only">Message</label>
      <textarea
        id={`${id}-body`}
        name="body"
        required
        maxLength={4000}
        rows={3}
        placeholder="Write a message…"
        className="block w-full resize-y rounded-xl border-0 px-3.5 py-2.5 ring-1 ring-inset ring-line placeholder:text-stone-500 focus:ring-2 focus:ring-brand-500 focus:outline-none"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) e.currentTarget.form?.requestSubmit();
        }}
      />
      {attachmentsEnabled ? (
        <div>
          <label htmlFor={`${id}-file`} className="text-sm font-medium text-ink">Attachment (optional)</label>
          <input id={`${id}-file`} type="file" name="attachment" accept="application/pdf,image/png,image/jpeg" className="mt-1 block text-sm file:mr-3 file:rounded-full file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:font-semibold file:text-brand-800" />
          <p className="mt-1 text-xs text-muted">PDF, PNG or JPEG, up to 10 MB.</p>
        </div>
      ) : (
        <p className="text-xs text-muted">File attachments aren&apos;t enabled in this environment.</p>
      )}
    </div>
  );
}
