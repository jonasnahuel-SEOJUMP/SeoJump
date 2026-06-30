"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { signIn } from "next-auth/react";
import { PLANS, formatArs } from "../lib/planLimits";

/**
 * Botón "Quiero PRO" → pide email de Mercado Pago → checkout MP.
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
  const [showEmailStep, setShowEmailStep] = useState(false);
  const [paymentEmail, setPaymentEmail] = useState("");

  const label =
    children ||
    `Suscribirme a PRO — ${formatArs(PLANS.pro.priceArs)}/mes`;

  async function startCheckout(mpEmail) {
    const trimmed = mpEmail.trim().toLowerCase();
    if (!trimmed || !trimmed.includes("@")) {
      setError("Ingresá un email válido de Mercado Pago.");
      return;
    }

    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/mercadopago/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentEmail: trimmed }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "No se pudo iniciar el pago.");
        setLoading(false);
        return;
      }

      if (data.initPoint) {
        if (onBeforeRedirect) onBeforeRedirect();
        window.location.href = data.initPoint;
        return;
      }

      setError("Mercado Pago no devolvió el link de pago.");
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

    const defaultEmail = session.user.email || "";
    setPaymentEmail(defaultEmail);
    setShowEmailStep(true);
  }

  if (showEmailStep) {
    return (
      <div className="w-full space-y-3 text-left">
        <p className="text-xs font-bold text-slate-400 leading-relaxed">
          ¿Con qué email tenés Mercado Pago? Puede ser distinto al de Google.
          En MP tenés que pagar con esa misma cuenta.
        </p>
        <input
          type="email"
          value={paymentEmail}
          onChange={(e) => setPaymentEmail(e.target.value)}
          placeholder="tu@email.com"
          className="w-full rounded-xl border-2 border-slate-600 bg-slate-800 px-4 py-3 text-sm font-bold text-white placeholder:text-slate-500 focus:border-duo-green focus:outline-none"
          disabled={loading}
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setShowEmailStep(false);
              setError("");
            }}
            disabled={loading}
            className="flex-1 py-3 rounded-xl bg-slate-800 text-slate-300 font-black text-sm"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => startCheckout(paymentEmail)}
            disabled={loading}
            className="flex-1 py-3 rounded-xl font-black text-sm bg-duo-green text-white hover:brightness-110 disabled:opacity-60"
          >
            {loading ? "Redirigiendo…" : "Ir a Mercado Pago"}
          </button>
        </div>
        {error && (
          <p className="text-xs font-bold text-red-400 text-center">{error}</p>
        )}
      </div>
    );
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
