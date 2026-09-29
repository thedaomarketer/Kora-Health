import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { TextField } from "@/components/ui/form";
import { requestPasswordResetAction } from "../actions";
import { AuthShell } from "../auth-shell";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Reset your password"
      description="We'll email you a secure link to choose a new password."
      footer={
        <Link href="/sign-in" className="font-semibold text-brand-700 hover:underline">
          Back to sign in
        </Link>
      }
    >
      <ActionForm action={requestPasswordResetAction} className="space-y-5">
        <TextField label="Email" name="email" type="email" autoComplete="email" required />
        <SubmitButton className="w-full" pendingLabel="Sending…">
          Send reset link
        </SubmitButton>
      </ActionForm>
    </AuthShell>
  );
}
