import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/card";
import { EMERGENCY_NOTE } from "@/lib/constants";

export const metadata: Metadata = { title: "Health resources" };

// Links to public, government or long-established health information services.
const RESOURCES = [
  { group: "Urgent help", items: [
    { name: "9-8-8 Suicide Crisis Helpline (Canada)", url: "https://988.ca", note: "Call or text 988, 24/7." },
    { name: "988 Suicide & Crisis Lifeline (United States)", url: "https://988lifeline.org", note: "Call or text 988, 24/7." },
    { name: "NHS 111 (England)", url: "https://111.nhs.uk", note: "Urgent medical help when it's not an emergency." },
  ] },
  { group: "Trusted health information", items: [
    { name: "MedlinePlus", url: "https://medlineplus.gov", note: "Plain-language health information from the U.S. National Library of Medicine." },
    { name: "Health Canada — Health topics", url: "https://www.canada.ca/en/services/health.html", note: "Government of Canada health information." },
    { name: "NHS — Health A to Z", url: "https://www.nhs.uk/conditions/", note: "Condition information from the UK National Health Service." },
  ] },
  { group: "Preparing for appointments", items: [
    { name: "AHRQ — Questions to ask your doctor", url: "https://www.ahrq.gov/questions/index.html", note: "Tips and question builders from the U.S. Agency for Healthcare Research and Quality." },
  ] },
];

export default function ResourcesPage() {
  return (
    <>
      <PageHeader title="Health resources" description="Links to public health information services. Kora doesn't operate these services." />
      <Alert tone="warning" className="mb-6">{EMERGENCY_NOTE}</Alert>
      <div className="space-y-8">
        {RESOURCES.map((g) => (
          <section key={g.group} aria-labelledby={g.group}>
            <h2 id={g.group} className="mb-3 text-lg font-semibold text-ink">{g.group}</h2>
            <ul className="grid gap-4 md:grid-cols-2">
              {g.items.map((r) => (
                <li key={r.url}>
                  <Card className="h-full p-5">
                    <a href={r.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-semibold text-brand-700 hover:underline">
                      {r.name} <ExternalLink aria-hidden className="size-4" /><span className="sr-only">(opens in a new tab)</span>
                    </a>
                    <p className="mt-1 text-sm text-muted">{r.note}</p>
                  </Card>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
