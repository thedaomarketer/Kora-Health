import type { Metadata } from "next";
import { ProviderProfileForm } from "@/components/forms/profile-forms";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { getReferenceData } from "@/lib/directory";
import { getOwnProviderProfile } from "@/lib/profiles";
import { setPublishedAction } from "../actions";

export const metadata: Metadata = { title: "Your profile" };

export default async function ProviderProfilePage() {
  const user = await requireUser({ role: "provider" });
  const [profile, reference] = await Promise.all([getOwnProviderProfile(user), getReferenceData()]);
  if (!profile) return null;
  const listed = profile.is_published && ["pending", "verified"].includes(profile.verification_status);
  return (
    <>
      <PageHeader title="Your profile" description="What patients see in the Kora directory." actions={<ButtonLink href={`/providers/${profile.slug}`} variant="secondary">Preview</ButtonLink>} />
      <Card className="mb-8">
        <CardHeader title="Directory visibility" />
        <CardBody className="space-y-3">
          <p className="flex flex-wrap items-center gap-2 text-sm">
            Status: {listed ? <Badge tone="success">Visible in directory</Badge> : <Badge>Not visible</Badge>}
          </p>
          <p className="text-sm text-muted">
            Your profile is listed once it&apos;s published <strong>and</strong> you&apos;ve submitted your license for
            verification. It shows &ldquo;Verification pending&rdquo; until Kora completes the review.
          </p>
          <ActionForm action={setPublishedAction}>
            <input type="hidden" name="publish" value={profile.is_published ? "0" : "1"} />
            <SubmitButton variant={profile.is_published ? "secondary" : "primary"}>{profile.is_published ? "Unpublish profile" : "Publish profile"}</SubmitButton>
          </ActionForm>
        </CardBody>
      </Card>
      <Card className="p-6 sm:p-8">
        <ProviderProfileForm profile={profile} reference={reference} mode="settings" defaultName={user.displayName} />
      </Card>
    </>
  );
}
