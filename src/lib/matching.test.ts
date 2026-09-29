import { describe, expect, it } from "vitest";
import { rankProviders, scoreProvider, type MatchableProvider } from "./matching";

const labels = { language: (c: string) => ({ en: "English", fr: "French" })[c] ?? c, payment: (c: string) => c.replace("_", " ") };

function provider(overrides: Partial<MatchableProvider> & { id: string }): MatchableProvider {
  return {
    specialties: [{ slug: "primary-care", name: "Primary care" }],
    offers_virtual: false,
    offers_in_person: true,
    languages: ["en"],
    payment_options: ["public_insurance"],
    accepting_new_patients: true,
    has_availability: true,
    locations: [{ city: "Toronto", region: "ON", country: "CA" }],
    ...overrides,
  };
}

describe("scoreProvider", () => {
  it("explains every criterion that matched", () => {
    const r = scoreProvider(
      provider({ id: "a", offers_virtual: true, languages: ["en", "fr"] }),
      { specialties: ["primary-care"], care: "virtual", city: "Toronto", country: "CA", languages: ["fr"], payment: ["public_insurance"] },
      labels,
    );
    expect(r.reasons.join(" ")).toMatch(/primary care/);
    expect(r.reasons.join(" ")).toMatch(/virtual appointments/);
    expect(r.reasons.join(" ")).toMatch(/French/);
    expect(r.gaps).toHaveLength(0);
    expect(r.score).toBe(100);
  });

  it("reports gaps honestly", () => {
    const r = scoreProvider(provider({ id: "b" }), { specialties: [], care: "virtual", languages: ["fr"], payment: [] }, labels);
    expect(r.gaps).toContain("Doesn't offer virtual appointments.");
    expect(r.gaps).toContain("Doesn't list a language you selected.");
  });
});

describe("rankProviders", () => {
  it("filters out providers without the requested specialty and ranks by fit", () => {
    const list = [
      provider({ id: "derm", specialties: [{ slug: "dermatology", name: "Skin" }] }),
      provider({ id: "far", locations: [{ city: "Vancouver", region: "BC", country: "CA" }] }),
      provider({ id: "near" }),
    ];
    const ranked = rankProviders(list, { specialties: ["primary-care"], care: "in_person", city: "Toronto", country: "CA", languages: [], payment: [] }, labels);
    expect(ranked.map((r) => r.provider.id)).toEqual(["near", "far"]);
  });

  it("can restrict to providers accepting new patients", () => {
    const ranked = rankProviders([provider({ id: "x", accepting_new_patients: false })], { specialties: [], languages: [], payment: [], acceptingOnly: true }, labels);
    expect(ranked).toHaveLength(0);
  });
});
