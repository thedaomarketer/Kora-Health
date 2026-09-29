import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser, homePathFor } from "@/lib/auth/session";
import { SignUpForm } from "../forms";
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
      <SignUpForm defaultRole={defaultRole} />
    </AuthShell>
  );
}
