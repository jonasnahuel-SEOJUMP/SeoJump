import { describe, it, expect, vi } from "vitest";
import {
  isPublicUrlSafe,
  isBlockedIp,
  assertSafePublicUrl,
  resolveHostAddresses,
} from "./urlSafety";

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

describe("isBlockedIp", () => {
  it("bloquea metadata y loopback", () => {
    expect(isBlockedIp("169.254.169.254")).toBe(true);
    expect(isBlockedIp("127.0.0.1")).toBe(true);
    expect(isBlockedIp("::1")).toBe(true);
    expect(isBlockedIp("::ffff:127.0.0.1")).toBe(true);
  });

  it("permite IPs públicas", () => {
    expect(isBlockedIp("8.8.8.8")).toBe(false);
    expect(isBlockedIp("1.1.1.1")).toBe(false);
  });
});

function mockDns({ v4 = [], v6 = [], lookup = null } = {}) {
  return {
    resolve4: vi.fn(async () => {
      if (!v4.length) {
        const err = new Error("ENODATA");
        err.code = "ENODATA";
        throw err;
      }
      return v4;
    }),
    resolve6: vi.fn(async () => {
      if (!v6.length) {
        const err = new Error("ENODATA");
        err.code = "ENODATA";
        throw err;
      }
      return v6;
    }),
    lookup: vi.fn(async () => {
      if (lookup) return lookup;
      const err = new Error("ENOTFOUND");
      err.code = "ENOTFOUND";
      throw err;
    }),
  };
}

describe("assertSafePublicUrl (DNS)", () => {
  it("bloquea hostname que resuelve a IP privada", async () => {
    const dnsApi = mockDns({ v4: ["127.0.0.1"] });
    const r = await assertSafePublicUrl("https://evil.example/x", dnsApi);
    expect(r.safe).toBe(false);
    expect(r.reason).toMatch(/internas|privadas/i);
  });

  it("bloquea hostname que resuelve a metadata cloud", async () => {
    const dnsApi = mockDns({ v4: ["169.254.169.254"] });
    const r = await assertSafePublicUrl("http://metadata.fake/latest", dnsApi);
    expect(r.safe).toBe(false);
  });

  it("bloquea si alguna de varias IPs es privada", async () => {
    const dnsApi = mockDns({ v4: ["1.2.3.4", "10.0.0.1"] });
    const r = await assertSafePublicUrl("https://mixed.example", dnsApi);
    expect(r.safe).toBe(false);
  });

  it("acepta hostname que solo resuelve a IP pública", async () => {
    const dnsApi = mockDns({ v4: ["93.184.216.34"] });
    const r = await assertSafePublicUrl("https://example.com/page", dnsApi);
    expect(r.safe).toBe(true);
    expect(r.addresses).toContain("93.184.216.34");
  });

  it("rechaza si no hay resolución DNS", async () => {
    const dnsApi = mockDns({ v4: [], v6: [], lookup: null });
    const r = await assertSafePublicUrl("https://does-not-resolve.invalid", dnsApi);
    expect(r.safe).toBe(false);
    expect(r.reason).toMatch(/resolver/i);
  });
});

describe("resolveHostAddresses", () => {
  it("devuelve literales IP sin consultar DNS", async () => {
    const dnsApi = mockDns({ v4: ["9.9.9.9"] });
    const addrs = await resolveHostAddresses("8.8.8.8", dnsApi);
    expect(addrs).toEqual(["8.8.8.8"]);
    expect(dnsApi.resolve4).not.toHaveBeenCalled();
  });
});
