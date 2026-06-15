"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { signIn } from "next-auth/react";
import { PLANS, formatArs } from "../lib/planLimits";

/**
 * Botón "Quiero PRO" → crea suscripción en MP y redirige al checkout.
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

  async function handleClick() {
    if (onBeforeRedirect) onBeforeRedirect();
    setError("");

    if (status !== "authenticated" || !session?.user) {
      await signIn("google", { callbackUrl: "/precios" });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/mercadopago/subscribe", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "No se pudo iniciar el pago.");
        setLoading(false);
        return;
      }

      if (data.initPoint) {
        window.location.href = data.initPoint;
        return;
      }

      setError("Mercado Pago no devolvió el link de pago.");
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
        {loading ? "Redirigiendo a Mercado Pago…" : label}
      </button>
      {error && (
        <p className="text-xs font-bold text-red-400 text-center">{error}</p>
      )}
    </div>
  );
}
