import { describe, it, expect } from "vitest";
import { spyDestFromParams } from "./spyEntry";

describe("spyDestFromParams", () => {
  it("sin url → solo view=spy", () => {
    expect(spyDestFromParams(new URLSearchParams())).toBe("/detective-de-enlaces?view=spy");
  });

  it("con url → prefill encoded", () => {
    const p = new URLSearchParams({ url: "https://rival.com/producto" });
    expect(spyDestFromParams(p)).toBe(
      "/detective-de-enlaces?view=spy&url=" + encodeURIComponent("https://rival.com/producto")
    );
  });

  it("rechaza urls demasiado largas", () => {
    const p = new URLSearchParams({ url: "https://x.com/" + "a".repeat(500) });
    expect(spyDestFromParams(p)).toBe("/detective-de-enlaces?view=spy");
  });

  it("no trata la url como redirect externo", () => {
    const p = new URLSearchParams({ url: "https://evil.com" });
    const dest = spyDestFromParams(p);
    expect(dest.startsWith("/detective-de-enlaces?")).toBe(true);
    expect(dest).not.toMatch(/^https?:\/\//);
  });
});
