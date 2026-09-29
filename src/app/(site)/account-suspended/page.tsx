import type { Metadata } from "next";
import { signOutAction } from "../(auth)/actions";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Account suspended" };

export default function SuspendedPage() {
  return (
    <div className="container-page max-w-xl py-20 text-center">
      <h1 className="text-3xl font-bold text-ink">Your account is suspended</h1>
      <p className="mt-3 text-muted">
        Access to your account has been paused by Kora&apos;s trust and safety team. Contact support to learn more or
        to appeal this decision.
      </p>
      <form action={signOutAction} className="mt-8">
        <Button type="submit" variant="secondary">
          Sign out
        </Button>
      </form>
    </div>
  );
}
