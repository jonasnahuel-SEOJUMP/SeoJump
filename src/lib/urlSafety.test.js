import { describe, it, expect } from "vitest";
import { isPublicUrlSafe } from "./urlSafety";

describe("isPublicUrlSafe", () => {
  it("acepta URLs públicas http/https", () => {
    expect(isPublicUrlSafe("https://tusitio.com/pagina").safe).toBe(true);
    expect(isPublicUrlSafe("http://ejemplo.com.ar").safe).toBe(true);
  });

  it("agrega https:// si falta el esquema", () => {
    const r = isPublicUrlSafe("tusitio.com/x");
    expect(r.safe).toBe(true);
    expect(r.url).toMatch(/^https:\/\/tusitio\.com/);
  });

  it("rechaza vacío", () => {
    expect(isPublicUrlSafe("").safe).toBe(false);
    expect(isPublicUrlSafe("   ").safe).toBe(false);
  });

  it("rechaza esquemas no http/https", () => {
    expect(isPublicUrlSafe("ftp://ejemplo.com").safe).toBe(false);
    expect(isPublicUrlSafe("file:///etc/passwd").safe).toBe(false);
    expect(isPublicUrlSafe("javascript:alert(1)").safe).toBe(false);
  });

  it("bloquea localhost y hosts internos", () => {
    expect(isPublicUrlSafe("http://localhost:3000").safe).toBe(false);
    expect(isPublicUrlSafe("http://api.local").safe).toBe(false);
    expect(isPublicUrlSafe("http://svc.internal/x").safe).toBe(false);
  });

  it("bloquea IPs privadas y reservadas (SSRF)", () => {
    expect(isPublicUrlSafe("http://127.0.0.1").safe).toBe(false);
    expect(isPublicUrlSafe("http://10.0.0.5").safe).toBe(false);
    expect(isPublicUrlSafe("http://192.168.1.1").safe).toBe(false);
    expect(isPublicUrlSafe("http://172.16.0.1").safe).toBe(false);
    expect(isPublicUrlSafe("http://169.254.169.254/latest/meta-data").safe).toBe(false);
    expect(isPublicUrlSafe("http://0.0.0.0").safe).toBe(false);
    expect(isPublicUrlSafe("http://100.64.0.1").safe).toBe(false);
  });

  it("bloquea loopback IPv6 y link-local", () => {
    expect(isPublicUrlSafe("http://[::1]").safe).toBe(false);
    expect(isPublicUrlSafe("http://[fe80::1]").safe).toBe(false);
    expect(isPublicUrlSafe("http://[fc00::1]").safe).toBe(false);
  });

  it("permite IP pública", () => {
    expect(isPublicUrlSafe("http://8.8.8.8").safe).toBe(true);
  });

  it("exige dominio con punto", () => {
    expect(isPublicUrlSafe("http://router").safe).toBe(false);
  });
});
