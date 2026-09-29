import type { Metadata } from "next";
import { ProsePage } from "@/components/marketing/prose";
import { CONSENT_VERSIONS, EMERGENCY_NOTE } from "@/lib/constants";

export const metadata: Metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <ProsePage title="Terms of Service" intro={`Version ${CONSENT_VERSIONS.terms_of_service}.`} draft>
      <section>
        <h2>Kora is not a healthcare provider</h2>
        <p>
          Kora Health is a technology platform that helps you find and communicate with healthcare professionals. Kora
          does not provide medical advice, diagnosis or treatment. Professionals listed on Kora are independent and
          responsible for the care they provide.
        </p>
        <p><strong>{EMERGENCY_NOTE}</strong></p>
      </section>
      <section>
        <h2>Kora AI</h2>
        <p>
          Kora AI provides general health information and navigation support. It may be incomplete or wrong. It does not
          diagnose, prescribe, or replace a qualified healthcare professional. Always seek the advice of a qualified
          professional about your health.
        </p>
      </section>
      <section>
        <h2>Provider profiles and verification</h2>
        <p>
          Providers are responsible for the accuracy of their profiles. A &ldquo;License verified&rdquo; badge means Kora
          confirmed the listed license with the regulator&apos;s public register on the stated date. It is not an
          endorsement or a guarantee of quality.
        </p>
      </section>
      <section>
        <h2>Appointments</h2>
        <p>
          Appointment requests are not confirmed until the provider confirms them. Kora availability is entered by
          providers and is not synchronized with external scheduling systems unless stated.
        </p>
      </section>
      <section>
        <h2>Acceptable use</h2>
        <ul>
          <li>Provide accurate information and don&apos;t impersonate others.</li>
          <li>Don&apos;t harass, spam or share harmful content.</li>
          <li>Don&apos;t attempt to access data that isn&apos;t yours or interfere with the platform.</li>
        </ul>
        <p>We may suspend accounts that violate these terms.</p>
      </section>
    </ProsePage>
  );
}
