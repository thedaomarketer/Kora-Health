import { describe, expect, it } from "vitest";
import { safeNextPath } from "./constants";
import { formToObject, password, slugify } from "./validation";
import { pgTimestamptzToIso } from "./db/parse";

describe("safeNextPath", () => {
  it("allows same-origin relative paths only", () => {
    expect(safeNextPath("/patient")).toBe("/patient");
    expect(safeNextPath("//evil.com")).toBe("/");
    expect(safeNextPath("https://evil.com")).toBe("/");
    expect(safeNextPath("/\\evil.com")).toBe("/");
    expect(safeNextPath("/ok\r\nSet-Cookie: x")).toBe("/");
    expect(safeNextPath(undefined, "/x")).toBe("/x");
  });
});

describe("password policy", () => {
  it("requires length and a number or symbol", () => {
    expect(password.safeParse("short1!").success).toBe(false);
    expect(password.safeParse("longpasswordonly").success).toBe(false);
    expect(password.safeParse("Correct-Horse-9").success).toBe(true);
  });
});

describe("helpers", () => {
  it("slugifies names", () => {
    expect(slugify("Dr. Amélie N'Diaye")).toBe("dr-amelie-n-diaye");
  });
  it("reads form data with array keys", () => {
    const fd = new FormData();
    fd.append("a", "1");
    fd.append("langs", "en");
    fd.append("langs", "fr");
    expect(formToObject(fd, ["langs", "empty"])).toEqual({ a: "1", langs: ["en", "fr"], empty: [] });
  });
  it("converts postgres timestamps to ISO", () => {
    expect(pgTimestamptzToIso("2026-09-30 13:00:00+00")).toBe("2026-09-30T13:00:00.000Z");
    expect(pgTimestamptzToIso("2026-09-30 13:00:00.5+05:30")).toBe("2026-09-30T07:30:00.500Z");
  });
});
