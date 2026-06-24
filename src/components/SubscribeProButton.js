"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { signIn } from "next-auth/react";
import { PLANS, formatArs } from "../lib/planLimits";

/**
 * Botón "Quiero PRO" → checkout Mobbex (suscripción mensual ARS).
 */
export default function SubscribeProButton({
  className = "",
  children,
  disabled = false,
  onBeforeRedirect,
}) {
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const label =
    children ||
    `Suscribirme a PRO — ${formatArs(PLANS.pro.priceArs)}/mes`;

  async function startCheckout() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/mobbex/subscribe", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "No se pudo iniciar el pago.");
        setLoading(false);
        return;
      }

      const url = data.checkoutUrl || data.initPoint;
      if (url) {
        if (onBeforeRedirect) onBeforeRedirect();
        window.location.href = url;
        return;
      }

      setError(data.stub ? "No se pudo activar el plan de prueba." : "Mobbex no devolvió el link de pago.");
    } catch {
      setError("Error de conexión. Intentá de nuevo.");
    }
    setLoading(false);
  }

  async function handleClick() {
    setError("");

    if (status !== "authenticated" || !session?.user) {
      await signIn("google", { callbackUrl: "/precios" });
      return;
    }

    await startCheckout();
  }

  return (
    <div className="w-full space-y-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || loading}
        className={className}
      >
        {loading ? "Procesando suscripción…" : label}
      </button>
      {error && (
        <p className="text-xs font-bold text-red-400 text-center">{error}</p>
      )}
    </div>
  );
}
