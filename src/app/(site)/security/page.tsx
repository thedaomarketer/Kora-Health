import type { Metadata } from "next";
import { ProsePage } from "@/components/marketing/prose";

export const metadata: Metadata = { title: "Security" };

export default function SecurityPage() {
  return (
    <ProsePage title="How we protect your information" intro="Health-related information is highly sensitive. These are the safeguards built into Kora today.">
      <section>
        <h2>Access control</h2>
        <ul>
          <li>Access rules are enforced by the database itself (row-level security) as well as by the application.</li>
          <li>Your profile, health information and AI conversations are visible only to you.</li>
          <li>Messages are visible only to the patient and provider in the conversation. Kora staff can review a single message only when it has been reported, and that access is logged.</li>
          <li>Administrative actions require specific staff roles and are recorded in an append-only audit log.</li>
        </ul>
      </section>
      <section>
        <h2>Data protection</h2>
        <ul>
          <li>All connections use HTTPS (encryption in transit), with strict security headers and a content security policy.</li>
          <li>Data is stored on managed infrastructure that encrypts data at rest.</li>
          <li>Files such as message attachments are stored privately and served through short-lived, authorized links.</li>
          <li>Secrets and API keys are kept server-side and never sent to your browser.</li>
        </ul>
      </section>
      <section>
        <h2>Your controls</h2>
        <ul>
          <li>Separate, revocable consents for Kora AI, stored health information and personalization.</li>
          <li>An access history showing sign-ups, consent changes, connections and other account events.</li>
          <li>Account deletion from your settings.</li>
        </ul>
      </section>
      <section>
        <h2>Reporting a vulnerability</h2>
        <p>If you believe you&apos;ve found a security issue, please contact the Kora team. Please don&apos;t access data that isn&apos;t yours.</p>
      </section>
      <section>
        <h2>Compliance</h2>
        <p>
          Kora is being designed with Canadian privacy requirements (including PIPEDA and applicable provincial health
          privacy laws) and other jurisdictions in mind. Kora has not yet completed a formal compliance assessment and
          does not claim certification under any regulatory framework.
        </p>
      </section>
    </ProsePage>
  );
}
