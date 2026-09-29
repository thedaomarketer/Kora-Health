"use client";

import { createContext, startTransition, useActionState, useContext, useRef, type FormEvent, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import type { ActionResult } from "@/lib/errors";
import { Alert } from "./alert";
import { buttonClasses } from "./button";

const PendingContext = createContext(false);

export function SubmitButton({
  children,
  pendingLabel = "Saving…",
  variant = "primary",
  size = "md",
  className,
  name,
  value,
  disabled,
}: {
  children: ReactNode;
  pendingLabel?: string;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "accent";
  size?: "sm" | "md" | "lg";
  className?: string;
  name?: string;
  value?: string;
  disabled?: boolean;
}) {
  const status = useFormStatus();
  const ctxPending = useContext(PendingContext);
  const pending = status.pending || ctxPending;
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending || disabled}
      aria-disabled={pending || disabled}
      className={buttonClasses(variant, size, className)}
    >
      {pending ? (
        <>
          <Loader2 aria-hidden className="size-4 animate-spin" />
          <span>{pendingLabel}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}

type Action = (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>;

/**
 * Form bound to a server action returning ActionResult.
 * - Keeps user input on errors (React would otherwise reset the form).
 * - Announces errors/success to assistive technology.
 * - Works without JavaScript via the native `action` fallback.
 */
export function ActionForm({
  action,
  children,
  className,
  successMessage,
  resetOnSuccess = false,
  id,
}: {
  action: Action;
  children: ReactNode | ((state: ActionResult | null) => ReactNode);
  className?: string;
  successMessage?: string;
  resetOnSuccess?: boolean;
  id?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, isPending] = useActionState(async (prev: ActionResult | null, fd: FormData) => {
    const result = await action(prev, fd);
    if (result.ok && resetOnSuccess) formRef.current?.reset();
    return result;
  }, null);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const fd = new FormData(e.currentTarget, submitter ?? undefined);
    startTransition(() => formAction(fd));
  }

  return (
    <PendingContext.Provider value={isPending}>
      <form ref={formRef} id={id} action={formAction} onSubmit={onSubmit} className={className} aria-busy={isPending}>
        {typeof children === "function" ? children(state) : children}
        <div aria-live="polite" className="empty:hidden mt-4">
          {state && !state.ok ? (
            <Alert tone="danger" role="alert">
              {state.error}
            </Alert>
          ) : null}
          {state?.ok && (state.message || successMessage) ? (
            <Alert tone="success" role="status">
              {state.message ?? successMessage}
            </Alert>
          ) : null}
        </div>
      </form>
    </PendingContext.Provider>
  );
}
