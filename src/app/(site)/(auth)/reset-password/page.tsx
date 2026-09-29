import type { Metadata } from "next";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { TextField } from "@/components/ui/form";
import { updatePasswordAction } from "../actions";
import { AuthShell } from "../auth-shell";

export const metadata: Metadata = { title: "Choose a new password" };

export default function ResetPasswordPage() {
  return (
    <AuthShell title="Choose a new password">
      <ActionForm action={updatePasswordAction} className="space-y-5">
        {(state) => (
          <>
            <TextField
              label="New password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={12}
              hint="At least 12 characters, with a number or symbol."
              error={state && !state.ok ? state.fieldErrors?.password : undefined}
            />
            <TextField
              label="Confirm new password"
              name="confirm"
              type="password"
              autoComplete="new-password"
              required
              error={state && !state.ok ? state.fieldErrors?.confirm : undefined}
            />
            <SubmitButton className="w-full">Update password</SubmitButton>
          </>
        )}
      </ActionForm>
    </AuthShell>
  );
}
