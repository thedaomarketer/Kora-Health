import { describe, expect, it } from "vitest";
import { classifyUserMessage, requiresSafetyResponse, reviewAssistantOutput, safetyResponse } from "./safety";

describe("classifyUserMessage", () => {
  const emergencies = [
    "I have crushing chest pain and my left arm hurts",
    "my dad suddenly can't lift his arm and his face is drooping",
    "I can't breathe properly",
    "she had a seizure and is not waking up",
    "my son swallowed pills from the cabinet, I think it's an overdose",
    "my throat is closing after eating peanuts",
    "I'm pregnant and there's heavy bleeding",
    "bleeding won't stop after a cut",
  ];
  it.each(emergencies)("flags emergency: %s", (text) => {
    const flags = classifyUserMessage(text);
    expect(requiresSafetyResponse(flags)).toBe(true);
  });

  const crisis = ["I want to kill myself", "I don't want to live anymore", "been thinking about suicide", "I keep wanting to self-harm"];
  it.each(crisis)("flags crisis: %s", (text) => {
    expect(classifyUserMessage(text)).toContain("crisis_self_harm");
  });

  it("prioritizes crisis resources over generic emergency text", () => {
    const flags = classifyUserMessage("I want to end my life, I took an overdose");
    expect(safetyResponse(flags)).toContain("9-8-8");
    expect(safetyResponse(flags)).toContain("911");
  });

  it("flags medication and diagnosis questions without blocking", () => {
    const med = classifyUserMessage("Should I stop taking my blood pressure medication?");
    expect(med).toContain("medication_change");
    expect(requiresSafetyResponse(med)).toBe(false);
    expect(classifyUserMessage("Do I have diabetes?")).toContain("diagnosis_request");
  });

  it("does not flag ordinary navigation questions", () => {
    for (const text of [
      "I'm looking for a Black woman therapist who speaks French",
      "How do I prepare for my first dermatology appointment?",
      "What is a nurse practitioner?",
      "I need help finding a dentist in Toronto",
    ]) {
      expect(requiresSafetyResponse(classifyUserMessage(text))).toBe(false);
    }
  });

  it("abuse disclosures receive safety resources", () => {
    const flags = classifyUserMessage("my partner hits me and I'm not safe at home");
    expect(requiresSafetyResponse(flags)).toBe(true);
    expect(safetyResponse(flags)).toMatch(/Domestic/);
  });
});

describe("reviewAssistantOutput", () => {
  it("flags dosing instructions", () => {
    expect(reviewAssistantOutput("You should increase your metformin to 1000 mg twice daily.").flags).toContain("output_policy_review");
  });
  it("flags diagnoses and clinician impersonation", () => {
    expect(reviewAssistantOutput("You most likely have an infection in your ear.").flags).toHaveLength(1);
    expect(reviewAssistantOutput("As I am a doctor, trust me.").flags).toHaveLength(1);
    expect(reviewAssistantOutput("I am your doctor and I recommend rest.").flags).toHaveLength(1);
  });
  it("passes general education", () => {
    const r = reviewAssistantOutput("A dermatologist specializes in skin, hair and nails. You could ask them about treatment options.");
    expect(r.flags).toHaveLength(0);
    expect(r.note).toBeNull();
  });
});
