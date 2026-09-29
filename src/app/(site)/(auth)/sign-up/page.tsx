import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { HeartPulse, Stethoscope } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { Checkbox, TextField } from "@/components/ui/form";
import { getSessionUser, homePathFor } from "@/lib/auth/session";
import { signUpAction } from "../actions";
import { AuthShell } from "../auth-shell";

export const metadata: Metadata = { title: "Create your account" };

export default async function SignUpPage({ searchParams }: PageProps<"/sign-up">) {
  const params = await searchParams;
  const user = await getSessionUser();
  if (user) redirect(homePathFor(user));
  const defaultRole = params.role === "provider" ? "provider" : "patient";

  return (
    <AuthShell
      title="Join Kora Health"
      description="Create a free account to find care or to list your practice."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/sign-in" className="font-semibold text-brand-700 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <ActionForm action={signUpAction} className="space-y-5">
        {(state) => {
          const errors = state && !state.ok ? state.fieldErrors : undefined;
          return (
            <>
              <fieldset>
                <legend className="text-sm font-semibold text-ink">I&apos;m joining as</legend>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  {[
                    { value: "patient", label: "Patient", hint: "Find and connect with care", Icon: HeartPulse },
                    { value: "provider", label: "Provider", hint: "Healthcare professional", Icon: Stethoscope },
                  ].map(({ value, label, hint, Icon }) => (
                    <label
                      key={value}
                      className="relative flex cursor-pointer flex-col gap-1 rounded-2xl p-4 ring-1 ring-line hover:bg-brand-50/50 has-[:checked]:bg-brand-50 has-[:checked]:ring-2 has-[:checked]:ring-brand-600 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-brand-500"
                    >
                      <input type="radio" name="role" value={value} defaultChecked={value === defaultRole} className="sr-only" />
                      <Icon aria-hidden className="size-5 text-brand-700" />
                      <span className="font-semibold text-ink">{label}</span>
                      <span className="text-xs text-muted">{hint}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <TextField label="Your name" name="displayName" autoComplete="name" required error={errors?.displayName} />
              <TextField label="Email" name="email" type="email" autoComplete="email" required error={errors?.email} />
              <TextField
                label="Password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={12}
                hint="At least 12 characters, with a number or symbol."
                error={errors?.password}
              />
              <div className="space-y-3 rounded-2xl bg-canvas p-4">
                <Checkbox
                  name="acceptTerms"
                  required
                  label={
                    <>
                      I agree to the{" "}
                      <Link href="/terms" className="text-brand-700 underline" target="_blank">
                        Terms of Service
                      </Link>{" "}
                      and{" "}
                      <Link href="/privacy" className="text-brand-700 underline" target="_blank">
                        Privacy Policy
                      </Link>
                      .
                    </>
                  }
                />
                {errors?.acceptTerms ? <p className="text-sm font-medium text-red-700">{errors.acceptTerms[0]}</p> : null}
                <Checkbox name="productUpdates" label="Send me occasional product updates (optional)." />
              </div>
              <SubmitButton className="w-full" pendingLabel="Creating account…">
                Create account
              </SubmitButton>
            </>
          );
        }}
      </ActionForm>
    </AuthShell>
  );
}
