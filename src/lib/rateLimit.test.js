import { describe, it, expect, beforeEach } from "vitest";
import { checkRateLimit, __resetRateLimit } from "./rateLimit";

describe("checkRateLimit (store en memoria / tests)", () => {
  /** @type {Map<string, { count: number, reset: number }>} */
  let store;

  beforeEach(() => {
    __resetRateLimit();
    store = new Map();
  });

  it("permite hasta el máximo y luego bloquea", async () => {
    const key = "ip:1.2.3.4";
    for (let i = 0; i < 3; i++) {
      const r = await checkRateLimit(key, 3, 60000, { store });
      expect(r.allowed).toBe(true);
    }
    const blocked = await checkRateLimit(key, 3, 60000, { store });
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it("cuenta claves de forma independiente", async () => {
    expect((await checkRateLimit("a", 1, 60000, { store })).allowed).toBe(true);
    expect((await checkRateLimit("a", 1, 60000, { store })).allowed).toBe(false);
    expect((await checkRateLimit("b", 1, 60000, { store })).allowed).toBe(true);
  });

  it("reinicia después de la ventana", async () => {
    const key = "ip:9.9.9.9";
    expect((await checkRateLimit(key, 1, 1, { store })).allowed).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect((await checkRateLimit(key, 1, 1, { store })).allowed).toBe(true);
  });

  it("devuelve remaining decreciente", async () => {
    const key = "ip:5.5.5.5";
    expect((await checkRateLimit(key, 5, 60000, { store })).remaining).toBe(4);
    expect((await checkRateLimit(key, 5, 60000, { store })).remaining).toBe(3);
  });
});

describe("checkRateLimit (RPC Supabase mock)", () => {
  it("usa el resultado del RPC", async () => {
    const rpc = async () => ({
      data: { allowed: true, remaining: 7, retryAfterSec: null },
      error: null,
    });
    const r = await checkRateLimit("action:x:user@test.com", 8, 60000, { rpc });
    expect(r).toEqual({ allowed: true, remaining: 7 });
  });

  it("bloquea si el RPC deniega", async () => {
    const rpc = async () => ({
      data: { allowed: false, remaining: 0, retryAfterSec: 42 },
      error: null,
    });
    const r = await checkRateLimit("pubcomp:1.1.1.1", 8, 60000, { rpc });
    expect(r).toEqual({ allowed: false, retryAfterSec: 42 });
  });

  it("fail-closed si el RPC falla", async () => {
    const rpc = async () => ({ data: null, error: { message: "boom" } });
    const r = await checkRateLimit("k", 8, 60000, { rpc });
    expect(r.allowed).toBe(false);
    expect(r.retryAfterSec).toBe(60);
  });

  it("fail-closed sin rpc ni store", async () => {
    const r = await checkRateLimit("k", 8, 60000, { rpc: null });
    // rpc: null y sin store → sin supabase en opts → bloquea
    expect(r.allowed).toBe(false);
  });
});
