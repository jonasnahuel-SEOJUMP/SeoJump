import React from "react";
import Link from "next/link";
import { PLANS, formatArs } from "../lib/planLimits";

export default function PaywallModal({ onClose, totalHiddenMissions, playClick }) {
  const proPrice = formatArs(PLANS.pro.priceArs);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative w-full max-w-lg bg-slate-900 border-2 border-slate-700 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="absolute top-0 right-0 w-full h-32 bg-gradient-to-br from-duo-green/20 to-teal-500/10 blur-2xl pointer-events-none" />

        <button
          onClick={(e) => { e.stopPropagation(); if (playClick) playClick(); onClose(); }}
          className="absolute top-4 right-4 text-slate-400 hover:text-white text-3xl transition-colors z-50"
        >
          ✕
        </button>

        <div className="p-8 text-center relative z-10">
          <div className="w-16 h-16 mx-auto bg-green-500/20 text-duo-green rounded-2xl flex items-center justify-center text-3xl border border-green-500/40 mb-6 shadow-[0_0_20px_rgba(16,185,129,0.3)]">
            🔓
          </div>

          <h2 className="text-2xl md:text-3xl font-black text-white mb-4 leading-tight">
            Desbloqueá el análisis completo y activá las{" "}
            <span className="text-duo-green">{totalHiddenMissions}</span> oportunidades ocultas de tu web
          </h2>

          <p className="text-slate-400 font-medium text-base mb-6">
            Con el plan PRO tenés todas las misiones, más consultas IA por día y sin candados en Quick Wins y AEO.
          </p>

          <div className="bg-slate-800 border-2 border-slate-700 rounded-2xl p-6 mb-6 relative overflow-hidden text-left space-y-3">
            <div className="absolute top-0 left-0 w-full h-1 bg-duo-green" />
            <p className="text-sm font-black text-white">Plan PRO — {proPrice}/mes</p>
            <ul className="text-sm font-bold text-slate-400 space-y-1">
              <li>✓ {PLANS.pro.aiPerDay} consultas IA por día</li>
              <li>✓ Todas las misiones desbloqueadas</li>
              <li>✓ Quick Wins y AEO sin límite de cantidad</li>
            </ul>
            <p className="text-xs font-bold text-amber-400/90 bg-amber-950/40 border border-amber-800/40 rounded-lg px-3 py-2">
              💳 Mercado Pago se conectará acá. Por ahora activamos planes manualmente para betas.
            </p>
          </div>

          <Link
            href="/precios"
            onClick={() => { if (playClick) playClick(); onClose(); }}
            className="w-full btn-3d btn-green !py-4 text-lg md:text-xl font-black flex justify-center items-center gap-3"
          >
            VER PLANES Y PRECIOS
          </Link>

          <p className="text-slate-500 text-xs font-bold mt-6">
            ¿Querés probar PRO gratis? Escribinos a{" "}
            <a href="mailto:nahuel@seo-jump.ai" className="text-duo-green hover:underline">
              nahuel@seo-jump.ai
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
