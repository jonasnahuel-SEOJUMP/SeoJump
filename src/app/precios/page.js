"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { PLANS, formatArs, formatUsd } from "../../lib/planLimits";
import SubscribeProButton from "../../components/SubscribeProButton";
import StripeCheckoutButton from "../../components/StripeCheckoutButton";

const FEATURES = [
  "Quick Wins con IA",
  "Oportunidades AEO",
  "Espía de la Competencia",
  "Buscador de Oro",
  "Detective de Enlaces",
  "Misiones y verificación",
  "Conexión Search Console",
];

/**
 * Detecta si el usuario está en Argentina via /api/geo (header de Vercel).
 * En desarrollo local devuelve true por defecto.
 */
function useIsArgentina() {
  const [isAR, setIsAR] = useState(null); // null = cargando

  useEffect(() => {
    fetch("/api/geo")
      .then((r) => r.json())
      .then(({ country }) => setIsAR(country === "AR"))
      .catch(() => setIsAR(true)); // ante error, muestra Mercado Pago
  }, []);

  return isAR;
}

export default function PreciosPage() {
  const { data: session } = useSession();
  const isAR = useIsArgentina();

  // Leer parámetros de retorno de Stripe
  const [stripeMsg, setStripeMsg] = useState(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("stripe") === "success")
      setStripeMsg({ ok: true, text: "¡Pago exitoso! Tu plan PRO ya está activo. Actualizá la página si no lo ves." });
    if (params.get("stripe") === "cancel")
      setStripeMsg({ ok: false, text: "Cancelaste el pago. Podés intentarlo de nuevo cuando quieras." });
  }, []);

  const cards = [
    {
      plan: PLANS.free,
      highlight: false,
      cta: session ? "Plan actual" : "Empezar gratis",
      ctaHref: "/",
      ctaDisabled: !!session,
      isPro: false,
    },
    {
      plan: PLANS.pro,
      highlight: true,
      cta: null,
      ctaDisabled: false,
      isPro: true,
    },
    {
      plan: PLANS.agency,
      highlight: false,
      cta: "Contactar agencia",
      ctaHref: "mailto:nahuel@seo-jump.ai?subject=SEO%20Jump%20Agencia",
      ctaDisabled: false,
      isPro: false,
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-fredoka px-4 py-10">
      <div className="max-w-5xl mx-auto space-y-10">
        <div className="text-center space-y-4">
          <Link href="/" className="text-sm font-bold text-slate-400 hover:text-white">
            ← Volver al inicio
          </Link>
          <h1 className="text-4xl md:text-5xl font-black">
            Planes <span className="text-duo-green">SEO Jump</span>
          </h1>
          <p className="text-slate-400 font-semibold text-lg max-w-2xl mx-auto">
            2 consultas IA gratis por día. Cuando veas resultados, pasate a PRO y seguí creciendo.
          </p>
        </div>

        {/* Mensaje de retorno Stripe */}
        {stripeMsg && (
          <div
            className={`rounded-2xl px-5 py-4 text-sm font-bold text-center border-2 ${
              stripeMsg.ok
                ? "bg-duo-green/10 border-duo-green/30 text-duo-green"
                : "bg-red-500/10 border-red-500/30 text-red-400"
            }`}
          >
            {stripeMsg.text}
          </div>
        )}

        {/* Selector de moneda (solo cuando se cargó el país) */}
        {isAR !== null && (
          <div className="flex items-center justify-center gap-3 text-sm font-bold text-slate-400">
            <span>Mostrando precios en:</span>
            <span
              className={`cursor-pointer px-3 py-1 rounded-full border-2 transition-colors ${
                isAR
                  ? "border-duo-green text-duo-green"
                  : "border-slate-700 hover:border-slate-500"
              }`}
              onClick={() => setIsAR(true)}
            >
              🇦🇷 ARS — Mercado Pago
            </span>
            <span
              className={`cursor-pointer px-3 py-1 rounded-full border-2 transition-colors ${
                !isAR
                  ? "border-duo-green text-duo-green"
                  : "border-slate-700 hover:border-slate-500"
              }`}
              onClick={() => setIsAR(false)}
            >
              🌍 USD — Stripe
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {cards.map(({ plan, highlight, cta, ctaHref, ctaDisabled, isPro }) => (
            <div
              key={plan.id}
              className={`rounded-2xl border-2 p-6 flex flex-col gap-4 ${
                highlight
                  ? "border-duo-green bg-slate-900 shadow-lg shadow-duo-green/10 scale-[1.02]"
                  : "border-slate-700 bg-slate-900/80"
              }`}
            >
              <div>
                <h2 className="text-xl font-black text-white">{plan.label}</h2>

                {/* Precio según país */}
                {isAR === null ? (
                  <div className="h-9 mt-2 rounded-lg bg-slate-800 animate-pulse w-32" />
                ) : isAR ? (
                  <>
                    <p className="text-3xl font-black text-duo-green mt-2">
                      {plan.priceArs === 0 ? "Gratis" : formatArs(plan.priceArs)}
                    </p>
                    {plan.priceUsdNote && (
                      <p className="text-xs text-slate-500 font-bold mt-1">{plan.priceUsdNote}</p>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-3xl font-black text-duo-green mt-2">
                      {plan.priceUsd === 0 ? "Free" : formatUsd(plan.priceUsd) + "/mo"}
                    </p>
                    {plan.id === "pro" && (
                      <p className="text-xs text-slate-500 font-bold mt-1">USD · monthly subscription</p>
                    )}
                  </>
                )}

                {plan.id === "pro" && isAR !== null && (
                  <p className="text-xs text-slate-500 font-bold mt-1">
                    {isAR ? "Precio final · suscripción mensual" : "Final price · monthly billing"}
                  </p>
                )}
              </div>

              <ul className="space-y-2 text-sm font-bold text-slate-300 flex-1">
                <li>🤖 {plan.aiPerDay} consultas IA / día</li>
                <li>📅 {plan.aiPerMonth} consultas IA / mes</li>
                <li>🌐 {plan.maxSites} sitio{plan.maxSites > 1 ? "s" : ""}</li>
                <li>✅ Misiones ilimitadas (sin IA)</li>
              </ul>

              {isPro ? (
                isAR === null ? (
                  <div className="h-12 rounded-xl bg-slate-800 animate-pulse" />
                ) : isAR ? (
                  <SubscribeProButton
                    className="w-full text-center py-3 rounded-xl font-black text-sm transition-all bg-duo-green text-white hover:brightness-110 disabled:opacity-60"
                  >
                    Quiero PRO — Mercado Pago
                  </SubscribeProButton>
                ) : (
                  <StripeCheckoutButton
                    className="w-full text-center py-3 rounded-xl font-black text-sm transition-all bg-duo-green text-white hover:brightness-110 disabled:opacity-60"
                  >
                    Get PRO — Stripe
                  </StripeCheckoutButton>
                )
              ) : ctaDisabled ? (
                <span className="w-full text-center py-3 rounded-xl bg-slate-800 text-slate-500 font-black text-sm">
                  {cta}
                </span>
              ) : (
                <Link
                  href={ctaHref}
                  className={`w-full text-center py-3 rounded-xl font-black text-sm transition-all ${
                    highlight
                      ? "bg-duo-green text-white hover:brightness-110"
                      : "bg-slate-800 text-white hover:bg-slate-700"
                  }`}
                >
                  {cta}
                </Link>
              )}
            </div>
          ))}
        </div>

        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-4">
          <h3 className="text-lg font-black text-white">¿Qué es una consulta IA?</h3>
          <p className="text-slate-400 font-semibold text-sm leading-relaxed">
            Cada vez que la app analiza con Gemini (Quick Wins, AEO, Espía, Buscador de Oro o Detective de Enlaces)
            cuenta como <strong className="text-slate-200">1 consulta</strong>.
            Completar misiones y <strong className="text-slate-200">verificar cambios en tu web no gasta</strong> consultas.
          </p>
          <p className="text-slate-500 font-bold text-xs leading-relaxed">
            Plan gratis: ves 2 oportunidades a la vez en misiones, Quick Wins y AEO. PRO desbloquea todas.
          </p>
          <div className="flex flex-wrap gap-2">
            {FEATURES.map((f) => (
              <span
                key={f}
                className="px-3 py-1 rounded-full bg-slate-800 text-xs font-bold text-slate-300"
              >
                {f}
              </span>
            ))}
          </div>
        </div>

        {isAR !== null && (
          <p className="text-center text-xs text-slate-500 font-bold max-w-xl mx-auto">
            {isAR
              ? "Al pagar con Mercado Pago, el plan PRO se activa en tu cuenta de SEO Jump (mismo email de Google)."
              : "Payment processed by Stripe. Your PRO plan activates on your SEO Jump account automatically after checkout."}
          </p>
        )}

        <p className="text-center text-xs text-slate-500 font-bold">
          {isAR
            ? `Cobro mensual con Mercado Pago · ${formatArs(PLANS.pro.priceArs)} IVA incluido · Plan Agencia: `
            : `Monthly billing via Stripe · ${formatUsd(PLANS.pro.priceUsd)}/mo · Agency plan: `}
          <a href="mailto:nahuel@seo-jump.ai" className="text-duo-green hover:underline">
            nahuel@seo-jump.ai
          </a>
        </p>
      </div>
    </div>
  );
}
