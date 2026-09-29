"use client";

import { useRef } from "react";
import { Flag } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { SelectField, TextAreaField } from "@/components/ui/form";
import type { ActionResult } from "@/lib/errors";

const REASONS: [string, string][] = [
  ["inaccurate_information", "Inaccurate information"],
  ["impersonation", "Impersonation or fake profile"],
  ["harassment", "Harassment or abuse"],
  ["spam", "Spam"],
  ["inappropriate_content", "Inappropriate content"],
  ["safety_concern", "Safety concern"],
  ["privacy_concern", "Privacy concern"],
  ["other", "Something else"],
];

export function ReportDialog({
  action,
  targetType,
  targetId,
  label = "Report",
}: {
  action: (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>;
  targetType: "provider_profile" | "message" | "conversation";
  targetId: string;
  label?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => ref.current?.showModal()}>
        <Flag aria-hidden className="size-4" /> {label}
      </Button>
      <dialog
        ref={ref}
        aria-labelledby={`report-${targetId}`}
        className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-3xl p-0 shadow-[var(--shadow-lift)] backdrop:bg-ink/50"
      >
        <div className="p-6">
          <h2 id={`report-${targetId}`} className="text-lg font-semibold text-ink">
            Report a concern
          </h2>
          <p className="mt-1 text-sm text-muted">Reports are confidential and reviewed by Kora&apos;s trust and safety team.</p>
          <ActionForm action={action} className="mt-5 space-y-4">
            <input type="hidden" name="targetType" value={targetType} />
            <input type="hidden" name="targetId" value={targetId} />
            <SelectField label="Reason" name="reason" required defaultValue="">
              <option value="" disabled>
                Choose a reason
              </option>
              {REASONS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </SelectField>
            <TextAreaField label="Details (optional)" name="details" maxLength={2000} rows={4} />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => ref.current?.close()}>
                Close
              </Button>
              <SubmitButton pendingLabel="Sending…">Send report</SubmitButton>
            </div>
          </ActionForm>
        </div>
      </dialog>
    </>
  );
}
