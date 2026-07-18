import { describe, it, expect, beforeEach } from "vitest";
import { checkRateLimit, __resetRateLimit } from "./rateLimit";

describe("checkRateLimit", () => {
  beforeEach(() => __resetRateLimit());

  it("permite hasta el máximo y luego bloquea", () => {
    const key = "ip:1.2.3.4";
    for (let i = 0; i < 3; i++) {
      expect(checkRateLimit(key, 3, 60000).allowed).toBe(true);
    }
    const blocked = checkRateLimit(key, 3, 60000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it("cuenta claves de forma independiente", () => {
    expect(checkRateLimit("a", 1, 60000).allowed).toBe(true);
    expect(checkRateLimit("a", 1, 60000).allowed).toBe(false);
    expect(checkRateLimit("b", 1, 60000).allowed).toBe(true);
  });

  it("reinicia después de la ventana", () => {
    const key = "ip:9.9.9.9";
    expect(checkRateLimit(key, 1, 1).allowed).toBe(true);
    // ventana de 1ms: la próxima llamada (tras microtareas) debería resetear
    return new Promise((resolve) => {
      setTimeout(() => {
        expect(checkRateLimit(key, 1, 1).allowed).toBe(true);
        resolve();
      }, 5);
    });
  });

  it("devuelve remaining decreciente", () => {
    const key = "ip:5.5.5.5";
    expect(checkRateLimit(key, 5, 60000).remaining).toBe(4);
    expect(checkRateLimit(key, 5, 60000).remaining).toBe(3);
  });
});
