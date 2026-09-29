import type { Metadata } from "next";
import { ProsePage } from "@/components/marketing/prose";

export const metadata: Metadata = { title: "About Kora Health" };

export default function AboutPage() {
  return (
    <ProsePage
      title="About Kora Health"
      intro="Kora Health is a digital health community platform designed to help Black patients and communities discover, connect with and communicate with healthcare professionals."
    >
      <section>
        <h2>Our approach</h2>
        <p>
          Our core idea is simple: <strong>Discover → Connect → Understand → Access care.</strong> Kora brings together
          a searchable directory of healthcare professionals, appointment requests, secure messaging and an AI
          navigation assistant — with patients in control of their information.
        </p>
      </section>
      <section>
        <h2>What we are — and aren&apos;t</h2>
        <ul>
          <li>Kora is a technology platform. We don&apos;t provide medical care, and we don&apos;t employ the professionals listed.</li>
          <li>Patients choose providers based on the information that matters to them, such as specialty, language, location and care type.</li>
          <li>Kora never uses race or ethnicity to rank or score providers or patients.</li>
          <li>We make no claims about health outcomes. Our goal is to make finding and accessing care easier and more transparent.</li>
        </ul>
      </section>
      <section>
        <h2>Principles</h2>
        <ul>
          <li><strong>Trust:</strong> verification badges only when credentials are actually checked.</li>
          <li><strong>Privacy:</strong> data minimization, explicit consent and deletion on request.</li>
          <li><strong>Honesty:</strong> features that aren&apos;t ready are labelled &ldquo;Coming soon&rdquo;.</li>
          <li><strong>Accessibility:</strong> designed for keyboards, screen readers and mobile devices.</li>
        </ul>
      </section>
    </ProsePage>
  );
}
