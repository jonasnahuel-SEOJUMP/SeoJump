"use client";

import { useEffect, useState } from "react";

export default function AiCreditToast() {
  const [toast, setToast] = useState(null);

  useEffect(() => {
    let timer;

    const onUsed = (e) => {
      const { used, limit } = e.detail || {};
      if (typeof used !== "number" || typeof limit !== "number") return;

      setToast({ used, limit });
      clearTimeout(timer);
      timer = setTimeout(() => setToast(null), 3000);
    };

    window.addEventListener("seojump:ai-credit-used", onUsed);
    return () => {
      window.removeEventListener("seojump:ai-credit-used", onUsed);
      clearTimeout(timer);
    };
  }, []);

  if (!toast) return null;

  return (
    <div
      role="status"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] px-5 py-3 rounded-2xl border-2 border-slate-600 bg-slate-900/95 text-white shadow-2xl backdrop-blur-sm animate-in slide-in-from-bottom-4 fade-in duration-300 max-w-sm w-[calc(100%-2rem)]"
    >
      <p className="text-sm font-black text-center">
        🤖 Usaste {toast.used} de {toast.limit} consultas IA hoy
      </p>
      <p className="text-xs font-bold text-slate-400 text-center mt-1">
        Verificar misiones en tu web no gasta consultas
      </p>
    </div>
  );
}
