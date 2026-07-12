"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { signIn } from "next-auth/react";
import { PH_EVENTS, trackEvent } from "../lib/posthog";

/**
 * Botón "Quiero PRO" → Stripe Checkout (USD, tarjeta internacional).
 */
export default function StripeCheckoutButton({
  className = "",
  children,
  disabled = false,
}) {
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const label = children || "Quiero PRO — USD 27/mes";

  async function handleClick() {
    setError("");

    if (status !== "authenticated" || !session?.user) {
      await signIn("google", { callbackUrl: "/precios" });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/stripe/subscribe", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "No se pudo iniciar el pago.");
        setLoading(false);
        return;
      }

      if (data.url) {
        trackEvent(PH_EVENTS.CHECKOUT_STARTED, { provider: "stripe" });
        window.location.href = data.url;
        return;
      }

      setError("Stripe no devolvió el link de pago.");
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
        {loading ? "Redirigiendo a Stripe…" : label}
      </button>
      {error && (
        <p className="text-xs font-bold text-red-400 text-center">{error}</p>
      )}
    </div>
  );
}
