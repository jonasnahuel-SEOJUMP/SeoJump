"use client";

/**
 * Advertencia reutilizable antes de confirmar cambios sensibles en una misión.
 * type="h1-change" — riesgo de ranking al tocar título/H1 ya indexados.
 */

const WARNINGS = {
  "h1-change": {
    icon: "⚠️",
    title: "Cuidado al cambiar título o H1",
    body: "Cambiar el título/H1 de una página que ya está indexada puede afectar temporalmente su posición en Google mientras se reprocesa. Si esta página ya te trae tráfico, considerá monitorear el cambio en Search Console hasta confirmar que no cae.",
  },
};

export default function MissionWarning({ type = "h1-change", className = "" }) {
  const cfg = WARNINGS[type] || WARNINGS["h1-change"];

  return (
    <div
      role="status"
      className={`rounded-xl border border-amber-500/40 bg-amber-950/30 px-4 py-3 flex gap-3 items-start ${className}`}
    >
      <span className="text-xl flex-shrink-0" aria-hidden>
        {cfg.icon}
      </span>
      <div className="min-w-0 space-y-1">
        <p className="text-xs font-black text-amber-300 uppercase tracking-wide">{cfg.title}</p>
        <p className="text-sm font-bold text-amber-100/90 leading-snug">{cfg.body}</p>
      </div>
    </div>
  );
}

/** True si el área/tipo de misión implica cambio de H1 o título SEO. */
export function isH1OrTitleChange(areaOrType) {
  const t = String(areaOrType || "").toLowerCase();
  return (
    t === "h1" ||
    /t[ií]tulo/.test(t) ||
    /\bh1\b/.test(t) ||
    /encabezado/.test(t) ||
    /title/.test(t)
  );
}
