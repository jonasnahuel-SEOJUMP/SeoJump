import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchWithSsrfGuard } from "./safeHttp";

function mockDnsPublic() {
  return {
    resolve4: vi.fn(async () => ["93.184.216.34"]),
    resolve6: vi.fn(async () => {
      const err = new Error("ENODATA");
      err.code = "ENODATA";
      throw err;
    }),
    lookup: vi.fn(async () => [{ address: "93.184.216.34", family: 4 }]),
  };
}

function mockDnsPrivate() {
  return {
    resolve4: vi.fn(async () => ["169.254.169.254"]),
    resolve6: vi.fn(async () => {
      const err = new Error("ENODATA");
      err.code = "ENODATA";
      throw err;
    }),
    lookup: vi.fn(async () => [{ address: "169.254.169.254", family: 4 }]),
  };
}

describe("fetchWithSsrfGuard redirects", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("bloquea redirect hacia IP/host privado (revalida DNS del Location)", async () => {
    let hop = 0;
    globalThis.fetch = vi.fn(async (url) => {
      hop += 1;
      if (hop === 1) {
        return new Response(null, {
          status: 302,
          headers: { Location: "http://169.254.169.254/latest/meta-data" },
        });
      }
      return new Response("should-not-reach", { status: 200 });
    });

    // Primer hop: DNS público. Segundo hop: URL literal privada (sin DNS).
    const dnsApi = mockDnsPublic();
    const result = await fetchWithSsrfGuard("https://example.com/start", {
      dnsApi,
      cacheBuster: false,
    });

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/internas|privadas/i);
    expect(hop).toBe(1); // no sigue al segundo fetch
  });

  it("bloquea redirect a hostname que resuelve privado", async () => {
    let call = 0;
    globalThis.fetch = vi.fn(async () => {
      call += 1;
      return new Response(null, {
        status: 301,
        headers: { Location: "https://evil-internal.example/secret" },
      });
    });

    const dnsApi = {
      resolve4: vi.fn(async (host) => {
        if (host === "example.com") return ["93.184.216.34"];
        return ["10.0.0.5"];
      }),
      resolve6: vi.fn(async () => {
        const err = new Error("ENODATA");
        err.code = "ENODATA";
        throw err;
      }),
      lookup: vi.fn(async () => {
        const err = new Error("ENOTFOUND");
        err.code = "ENOTFOUND";
        throw err;
      }),
    };

    const result = await fetchWithSsrfGuard("https://example.com/", {
      dnsApi,
      cacheBuster: false,
    });

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/internas|privadas/i);
    expect(call).toBe(1);
  });

  it("permite respuesta 200 tras DNS público", async () => {
    globalThis.fetch = vi.fn(async () => new Response("<html>ok</html>", { status: 200 }));
    const result = await fetchWithSsrfGuard("https://example.com/", {
      dnsApi: mockDnsPublic(),
      cacheBuster: false,
    });
    expect(result.ok).toBe(true);
    expect(await result.response.text()).toContain("ok");
  });

  it("bloquea URL inicial que resuelve a metadata", async () => {
    globalThis.fetch = vi.fn(async () => new Response("nope", { status: 200 }));
    const result = await fetchWithSsrfGuard("https://meta.example/", {
      dnsApi: mockDnsPrivate(),
      cacheBuster: false,
    });
    expect(result.ok).toBe(false);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
