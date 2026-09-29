import { describe, expect, it } from "vitest";
import { suggestSpecialties } from "./concerns";

describe("suggestSpecialties", () => {
  it("maps common needs to specialties", () => {
    expect(suggestSpecialties("I've been feeling anxious and stressed at work")).toContain("mental-health");
    expect(suggestSpecialties("my blood pressure readings are high")).toContain("cardiology");
    expect(suggestSpecialties("hair loss and scalp irritation")).toContain("dermatology");
    expect(suggestSpecialties("support managing sickle cell")).toContain("hematology");
    expect(suggestSpecialties("I'm pregnant and want prenatal care")).toContain("maternal-health");
  });
  it("defaults to primary care when nothing matches", () => {
    expect(suggestSpecialties("not sure where to start")).toEqual(["primary-care"]);
  });
  it("respects known slugs and the limit", () => {
    const known = new Set(["dermatology"]);
    expect(suggestSpecialties("skin rash and anxiety", known)).toEqual(["dermatology"]);
    expect(suggestSpecialties("anxiety, skin rash, back pain, diabetes").length).toBeLessThanOrEqual(3);
  });
});
