"use client";

import { useEffect, useState } from "react";

export default function SeoWinToast() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let timer;

    const onSeoWin = () => {
      setVisible(true);
      clearTimeout(timer);
      timer = setTimeout(() => setVisible(false), 4000);
    };

    window.addEventListener("seojump:seo-win", onSeoWin);
    return () => {
      window.removeEventListener("seojump:seo-win", onSeoWin);
      clearTimeout(timer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      role="status"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] px-5 py-3 rounded-2xl border-2 border-duo-green/60 bg-gradient-to-r from-emerald-950/95 via-green-950/95 to-emerald-950/95 text-white shadow-[0_0_40px_rgba(34,197,94,0.35)] backdrop-blur-sm animate-in slide-in-from-bottom-4 fade-in duration-300 max-w-md w-[calc(100%-2rem)]"
    >
      <p className="text-sm font-black text-center text-duo-green leading-snug">
        📈 ¡Tu SEO se está moviendo! Hay mejoras en Google. Revisá la campana 🔔
      </p>
    </div>
  );
}
