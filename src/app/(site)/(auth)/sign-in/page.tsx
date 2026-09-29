import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { TextField } from "@/components/ui/form";
import { getSessionUser, homePathFor } from "@/lib/auth/session";
import { safeNextPath } from "@/lib/constants";
import { signInAction } from "../actions";
import { AuthShell } from "../auth-shell";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const params = await searchParams;
  const next = safeNextPath(params.next, "");
  const user = await getSessionUser();
  if (user) redirect(next || homePathFor(user));

  return (
    <AuthShell
      title="Welcome back"
      description="Sign in to your Kora account."
      footer={
        <>
          New to Kora?{" "}
          <Link href="/sign-up" className="font-semibold text-brand-700 hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <ActionForm action={signInAction} className="space-y-5">
        {(state) => (
          <>
            <input type="hidden" name="next" value={next} />
            <TextField
              label="Email"
              name="email"
              type="email"
              autoComplete="email"
              required
              error={state && !state.ok ? state.fieldErrors?.email : undefined}
            />
            <TextField
              label="Password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              error={state && !state.ok ? state.fieldErrors?.password : undefined}
            />
            <div className="flex justify-end">
              <Link href="/forgot-password" className="text-sm font-medium text-brand-700 hover:underline">
                Forgot your password?
              </Link>
            </div>
            <SubmitButton className="w-full" pendingLabel="Signing in…">
              Sign in
            </SubmitButton>
          </>
        )}
      </ActionForm>
    </AuthShell>
  );
}
