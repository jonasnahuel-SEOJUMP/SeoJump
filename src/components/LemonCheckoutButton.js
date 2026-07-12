"use client";

import { useState } from "react";
import { useSession, signIn } from "next-auth/react";
import { PH_EVENTS, trackEvent } from "../lib/posthog";

/**
 * Botón PRO → Lemon Squeezy Checkout (USD, internacional).
 */
export default function LemonCheckoutButton({
  className = "",
  children,
  disabled = false,
}) {
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const label = children || "Get PRO — USD 27/mo";

  async function handleClick() {
    setError("");

    if (status !== "authenticated" || !session?.user) {
      await signIn("google", { callbackUrl: "/precios" });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/lemon-squeezy/subscribe", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "No se pudo iniciar el pago.");
        setLoading(false);
        return;
      }

      if (data.url) {
        trackEvent(PH_EVENTS.CHECKOUT_STARTED, { provider: "lemon_squeezy" });
        window.location.href = data.url;
        return;
      }

      setError("Lemon Squeezy no devolvió el link de pago.");
    } catch {
      setError("Error de conexión. Intentá de nuevo.");
    }
    setLoading(false);
  }

  return (
    <div className="w-full space-y-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || loading}
        className={className}
      >
        {loading ? "Redirecting to checkout…" : label}
      </button>
      {error && (
        <p className="text-xs font-bold text-red-400 text-center">{error}</p>
      )}
    </div>
  );
}
