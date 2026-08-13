import { afterEach, describe, expect, it } from "vitest";
import { CANONICAL_SITE_URL, getSiteUrl, toSitemapUrl } from "./siteUrl";

const ORIGINAL_ENV = {
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  VERCEL_ENV: process.env.VERCEL_ENV,
  VERCEL_URL: process.env.VERCEL_URL,
};

afterEach(() => {
  process.env.NEXT_PUBLIC_APP_URL = ORIGINAL_ENV.NEXT_PUBLIC_APP_URL;
  process.env.VERCEL_ENV = ORIGINAL_ENV.VERCEL_ENV;
  process.env.VERCEL_URL = ORIGINAL_ENV.VERCEL_URL;
});

describe("getSiteUrl", () => {
  it("usa NEXT_PUBLIC_APP_URL cuando es una URL http(s) válida", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://example.com/";
    expect(getSiteUrl()).toBe("https://example.com");
  });

  it("ignora valores inválidos y cae al dominio canónico", () => {
    process.env.NEXT_PUBLIC_APP_URL = "[SENSITIVE]";
    process.env.VERCEL_ENV = "development";
    process.env.VERCEL_URL = "";
    expect(getSiteUrl()).toBe(CANONICAL_SITE_URL);
    expect(() => new URL(getSiteUrl())).not.toThrow();
  });

  it("en producción Vercel usa el dominio canónico si el env es inválido", () => {
    process.env.NEXT_PUBLIC_APP_URL = "not-a-url";
    process.env.VERCEL_ENV = "production";
    expect(getSiteUrl()).toBe(CANONICAL_SITE_URL);
  });

  it("arma https:// a partir de VERCEL_URL", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    process.env.VERCEL_ENV = "preview";
    process.env.VERCEL_URL = "seo-jump.vercel.app";
    expect(getSiteUrl()).toBe("https://seo-jump.vercel.app");
  });
});

describe("toSitemapUrl", () => {
  it("devuelve el canónico para la raíz", () => {
    expect(toSitemapUrl("/")).toBe(CANONICAL_SITE_URL);
  });
});
