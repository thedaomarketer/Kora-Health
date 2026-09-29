import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser, homePathFor } from "@/lib/auth/session";
import { safeNextPath } from "@/lib/constants";
import { SignInForm } from "../forms";
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
      <SignInForm next={next} />
    </AuthShell>
  );
}
