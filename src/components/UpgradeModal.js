"use client";

import Link from "next/link";
import { PLANS, formatArs } from "../lib/planLimits";
import SubscribeProButton from "./SubscribeProButton";

export default function UpgradeModal({ open, onClose, playClick, message }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-white dark:bg-slate-800 rounded-3xl border-2 border-slate-200 dark:border-slate-700 shadow-2xl p-6 md:p-8 max-w-md w-full relative space-y-6 text-center animate-in zoom-in-95 duration-300">
        <button
          onClick={() => {
            if (playClick) playClick();
            onClose();
          }}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-650 dark:hover:text-white text-xl font-bold transition-colors"
          type="button"
        >
          ✕
        </button>
        <div className="text-6xl">🚀</div>
        <div className="space-y-3">
          <h2 className="text-2xl md:text-3xl font-black text-slate-800 dark:text-slate-100 leading-tight">
            Límite de consultas IA
          </h2>
          <p className="text-base font-bold text-slate-600 dark:text-slate-300 leading-relaxed">
            {message ||
              "Usaste tus consultas IA de hoy. Pasate a PRO para más análisis y seguir optimizando tu web."}
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <SubscribeProButton
            onBeforeRedirect={() => playClick && playClick()}
            className="w-full btn-3d bg-duo-green border-duo-green-shadow border-b-4 hover:brightness-110 active:border-b-0 active:translate-y-1 text-white text-lg font-black py-4 flex items-center justify-center gap-2 shadow-lg disabled:opacity-60"
          >
            Pasar a PRO — {formatArs(PLANS.pro.priceArs)}/mes
          </SubscribeProButton>
          <button
            onClick={() => {
              if (playClick) playClick();
              onClose();
            }}
            type="button"
            className="text-slate-550 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-bold transition-colors py-2 text-sm uppercase tracking-wider"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
