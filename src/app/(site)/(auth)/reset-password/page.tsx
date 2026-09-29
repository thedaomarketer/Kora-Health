import type { Metadata } from "next";
import { ResetPasswordForm } from "../forms";
import { AuthShell } from "../auth-shell";

export const metadata: Metadata = { title: "Choose a new password" };

export default function ResetPasswordPage() {
  return (
    <AuthShell title="Choose a new password">
      <ResetPasswordForm />
    </AuthShell>
  );
}
