"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { PLANS, formatArs } from "../../lib/planLimits";
import SubscribeProButton from "../../components/SubscribeProButton";

const FEATURES = [
  "Quick Wins con IA",
  "Oportunidades AEO",
  "Buscador de Oro",
  "Detective de Enlaces",
  "Misiones y verificación",
  "Conexión Search Console",
];

export default function PreciosPage() {
  const { data: session } = useSession();

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
                <p className="text-3xl font-black text-duo-green mt-2">
                  {plan.priceArs === 0 ? "Gratis" : formatArs(plan.priceArs)}
                </p>
                {plan.priceUsdNote && (
                  <p className="text-xs text-slate-500 font-bold mt-1">{plan.priceUsdNote}</p>
                )}
                {plan.id === "pro" && (
                  <p className="text-xs text-slate-500 font-bold mt-1">Precio final · suscripción mensual</p>
                )}
              </div>

              <ul className="space-y-2 text-sm font-bold text-slate-300 flex-1">
                <li>🤖 {plan.aiPerDay} consultas IA / día</li>
                <li>📅 {plan.aiPerMonth} consultas IA / mes</li>
                <li>🌐 {plan.maxSites} sitio{plan.maxSites > 1 ? "s" : ""}</li>
                <li>✅ Misiones ilimitadas (sin IA)</li>
              </ul>

              {isPro ? (
                <SubscribeProButton
                  className={`w-full text-center py-3 rounded-xl font-black text-sm transition-all bg-duo-green text-white hover:brightness-110 disabled:opacity-60`}
                >
                  Quiero PRO — Mercado Pago
                </SubscribeProButton>
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
            Cada vez que la app analiza con Gemini (Quick Wins, AEO, Buscador de Oro o Detective de Enlaces)
            cuenta como 1 consulta. Las misiones de optimización y la verificación de cambios en tu web
            <strong className="text-slate-200"> no consumen</strong> consultas.
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

        <p className="text-center text-xs text-slate-500 font-bold max-w-xl mx-auto">
          Podés pagar con cualquier cuenta de Mercado Pago (no tiene que ser el mismo Gmail con el que entrás a SEO Jump).
        </p>

        <p className="text-center text-xs text-slate-500 font-bold">
          Cobro mensual con Mercado Pago · {formatArs(PLANS.pro.priceArs)} IVA incluido · Plan Agencia:{" "}
          <a href="mailto:nahuel@seo-jump.ai" className="text-duo-green hover:underline">
            nahuel@seo-jump.ai
          </a>
        </p>
      </div>
    </div>
  );
}
