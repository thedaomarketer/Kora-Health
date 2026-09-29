import type { Metadata } from "next";
import { ProsePage } from "@/components/marketing/prose";
import { CONSENT_VERSIONS } from "@/lib/constants";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <ProsePage title="Privacy Policy" intro={`Version ${CONSENT_VERSIONS.privacy_policy}. How Kora Health collects, uses and protects your information.`} draft>
      <section>
        <h2>Information we collect</h2>
        <ul>
          <li><strong>Account information:</strong> name, email address, and whether you joined as a patient or provider.</li>
          <li><strong>Patient preferences:</strong> location (city/region), languages, care preferences, specialty interests and payment preferences you choose to provide.</li>
          <li><strong>Health information you enter:</strong> only if you opt in to health information storage (e.g., allergies, medications, notes).</li>
          <li><strong>Appointment requests and messages</strong> between you and providers.</li>
          <li><strong>Kora AI conversations</strong>, if you consent to use Kora AI.</li>
          <li><strong>Provider information:</strong> public profile details and private credential information used for verification.</li>
          <li><strong>Security logs:</strong> records of significant account events (for example sign-up, consent changes, connections).</li>
        </ul>
      </section>
      <section>
        <h2>How we use it</h2>
        <ul>
          <li>To operate the directory, appointment requests, messaging and your dashboard.</li>
          <li>To show relevant providers based on filters and preferences you choose.</li>
          <li>To verify provider credentials.</li>
          <li>To keep the platform safe, investigate reports and prevent abuse.</li>
        </ul>
        <p>We do not sell your personal information. We do not use race or ethnicity to rank providers or infer sensitive attributes about you.</p>
      </section>
      <section>
        <h2>Kora AI</h2>
        <p>
          When you use Kora AI, the messages you send are processed by our AI service provider to generate responses.
          Kora AI requires your separate consent, which you can withdraw at any time. You can delete your AI
          conversations from your dashboard.
        </p>
      </section>
      <section>
        <h2>Who can see your information</h2>
        <ul>
          <li>Providers you request appointments with see your name, the appointment details and the note you include.</li>
          <li>Messages are visible only to you and the provider in the conversation.</li>
          <li>Kora staff access is limited by role and logged. Staff cannot browse your health information or AI conversations.</li>
          <li>Service providers who host and operate Kora (for example database, hosting, AI and payment providers) process data on our behalf.</li>
        </ul>
      </section>
      <section>
        <h2>Your choices and rights</h2>
        <ul>
          <li>Update your profile and preferences at any time.</li>
          <li>Grant or withdraw consents from Settings → Privacy &amp; consent.</li>
          <li>View your account access history.</li>
          <li>Delete your account and associated information from Settings.</li>
        </ul>
      </section>
      <section>
        <h2>Retention</h2>
        <p>
          We keep your information while your account is active. When you delete your account, your profile, health
          information, AI conversations, messages and appointment records associated with your account are deleted.
          Security audit records are kept in pseudonymous form for security purposes.
        </p>
      </section>
    </ProsePage>
  );
}
