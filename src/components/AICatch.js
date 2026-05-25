"use client";

import React from "react";

export default function AICatch({ error, onRetry, onClear }) {
  if (!error) return null;

  // Detect custom API/Google-specific errors for user-friendly translations
  let displayTitle = "¡Oops! Algo no salió como esperábamos";
  let displayMsg = error;
  let isLeaked = error.includes("leak") || error.includes("leaked") || error.includes("API key") || error.includes("403") || error.includes("PERMISSION_DENIED");
  let isRateLimit = error.includes("503") || error.includes("demand") || error.includes("saturada") || error.includes("demandas") || error.includes("demanda");

  if (isLeaked) {
    displayTitle = "🦉 Credenciales de IA Revocadas";
    displayMsg = "La clave de acceso de la IA ha sido desactivada por seguridad tras haber sido expuesta públicamente en GitHub. Por favor, crea una nueva API Key en Google AI Studio y actualizala en el panel de configuración de la plataforma.";
  } else if (isRateLimit) {
    displayTitle = "🦉 Búho Congestionado (Demanda Alta)";
    displayMsg = "El servidor de inteligencia artificial de Google está experimentando una demanda extremadamente alta en este momento (Error 503). ¡Hagamos un intento de reintento en unos segundos!";
  } else if (error.includes("vacía") || error.includes("cortas") || error.includes("inválida") || error.includes("caracteres")) {
    displayTitle = "⚠️ Entrada de Búsqueda Inválida";
    displayMsg = error;
  }

  return (
    <div className="card-3d w-full max-w-md mx-auto p-6 md:p-7 border border-red-500/20 bg-slate-950/80 rounded-3xl shadow-2xl relative text-center space-y-5 animate-in zoom-in-95 duration-300 my-6">
      {/* Icon with backlight pulse */}
      <div className="relative w-16 h-16 mx-auto flex items-center justify-center text-4xl bg-red-500/10 rounded-full border border-red-500/30">
        <div className="absolute inset-0 rounded-full bg-red-500/5 animate-pulse blur-sm"></div>
        {isLeaked ? "🔑" : "🦉"}
      </div>

      <div className="space-y-2">
        <h3 className="text-xl font-black text-red-400 tracking-tight drop-shadow-md">
          {displayTitle}
        </h3>
        <p className="text-sm font-bold text-slate-300 leading-relaxed">
          {displayMsg}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        {onRetry && !isLeaked && (
          <button
            onClick={onRetry}
            className="flex-1 btn-3d btn-green text-sm py-3 px-6 font-black tracking-wide"
          >
            🔄 REINTENTAR CONSULTA
          </button>
        )}
        {onClear && (
          <button
            onClick={onClear}
            className="flex-1 btn-3d btn-white text-sm py-3 px-6 font-black text-slate-400 hover:text-slate-100"
          >
            ✕ CERRAR AVISO
          </button>
        )}
      </div>
    </div>
  );
}
