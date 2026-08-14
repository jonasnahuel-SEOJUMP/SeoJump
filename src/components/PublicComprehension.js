"use client";

import { useState, useRef } from "react";

/**
 * PublicComprehension — Gancho público de la landing.
 * Muestra GRATIS el diagnóstico completo (qué entiende / qué NO entiende una IA
 * sobre la página) y deja el arreglo (código + misiones) detrás del registro.
 *
 * Props:
 *  - onRegister(): dispara el registro/login (ej. signIn de la landing).
 *  - playClick?, playSuccess?: sonidos opcionales.
 */
export default function PublicComprehension({ onRegister, playClick, playSuccess }) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null); // { map, offerTeaser }
  const resultRef = useRef(null);

  const analyze = async (e) => {
    e?.preventDefault?.();
    if (loading) return;
    const clean = url.trim();
    if (!clean) {
      setError("Pegá la URL de tu página. Ej: https://tusitio.com");
      return;
    }
    if (playClick) playClick();
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch("/api/public/comprehension", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: clean }),
      });
      const data = await res.json().catch(() => ({}));
      if (!data?.ok) {
        setError(data?.error || "No pudimos analizar esa página. Probá con otra URL.");
        setLoading(false);
        return;
      }
      setResult(data);
      if (playSuccess) playSuccess();
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    } catch {
      setError("Hubo un problema de conexión. Probá de nuevo en un momento.");
    } finally {
      setLoading(false);
    }
  };

  const map = result?.map;
  const understood = map?.checks?.filter((c) => c.applicable && c.present) || [];
  const missing = map?.checks?.filter((c) => c.applicable && !c.present) || [];

  const confidenceColor =
    map?.confidence === "alto"
      ? "text-duo-green"
      : map?.confidence === "medio"
      ? "text-yellow-400"
      : "text-red-400";

  return (
    <div className="w-full max-w-3xl mx-auto">
      {/* Buscador */}
      <form onSubmit={analyze} className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          inputMode="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://tusitio.com/pagina"
          className="flex-1 rounded-2xl bg-slate-950 border-2 border-cyan-500/30 focus:border-cyan-400 text-white placeholder-slate-500 font-bold px-5 py-4 text-base md:text-lg outline-none transition-colors"
          aria-label="URL a analizar"
        />
        <button
          type="submit"
          disabled={loading}
          className="btn-3d btn-green text-lg md:text-xl px-8 py-4 whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? "Analizando…" : "Analizar gratis"}
        </button>
      </form>

      <p className="text-slate-500 text-sm font-semibold mt-3 text-center sm:text-left">
        En menos de 10 segundos vas a ver qué entiende una IA sobre tu negocio. Sin registro.
      </p>

      {error && (
        <div className="mt-4 rounded-xl bg-red-500/10 border border-red-500/40 text-red-300 font-bold px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Resultado */}
      {map && (
        <div ref={resultRef} className="mt-8 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
          {/* Encabezado del diagnóstico */}
          <div className="rounded-2xl bg-slate-950 border border-cyan-500/20 p-5 md:p-6">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-2">
              <span className="text-xs font-black uppercase tracking-widest text-cyan-400">
                🧠 Mapa de comprensión
              </span>
              <span className="text-xs font-bold text-slate-500">·</span>
              <span className="text-xs font-bold text-slate-400">{map.pageTypeLabel}</span>
            </div>
            <p className="text-white font-black text-lg md:text-xl leading-snug">{map.headline}</p>
            <p className="mt-2 text-sm font-bold text-slate-400">
              Confianza de la IA para entender esta página:{" "}
              <span className={`font-black uppercase ${confidenceColor}`}>{map.confidence}</span>{" "}
              <span className="text-slate-500">({map.confidenceScore}/100)</span>
            </p>
          </div>

          {/* Qué entiende / Qué NO entiende */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl bg-green-500/5 border border-duo-green/30 p-5">
              <h3 className="text-duo-green font-black text-base mb-3">✅ Esto SÍ entiende una IA</h3>
              {understood.length > 0 ? (
                <ul className="space-y-2.5">
                  {understood.map((c) => (
                    <li key={c.id} className="text-sm">
                      <span className="font-black text-slate-200">{c.label}</span>
                      <span className="block text-slate-400 font-semibold">{c.detail}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-slate-400 text-sm font-semibold">
                  Todavía no hay señales claras. Con unos ajustes lo cambiamos rápido.
                </p>
              )}
            </div>

            <div className="rounded-2xl bg-red-500/5 border border-red-500/30 p-5">
              <h3 className="text-red-400 font-black text-base mb-3">❌ Esto NO entiende (todavía)</h3>
              {missing.length > 0 ? (
                <ul className="space-y-2.5">
                  {missing.map((c) => (
                    <li key={c.id} className="text-sm">
                      <span className="font-black text-slate-200">{c.label}</span>
                      <span className="block text-slate-400 font-semibold">{c.detail}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-slate-400 text-sm font-semibold">
                  ¡Muy bien! Una IA entiende lo esencial de esta página.
                </p>
              )}
            </div>
          </div>

          {/* Entidades detectadas */}
          {map.entities?.length > 0 && (
            <div className="rounded-2xl bg-slate-950 border border-slate-800 p-5">
              <h3 className="text-slate-300 font-black text-sm mb-3">🔎 Temas que una IA asocia a esta página</h3>
              <div className="flex flex-wrap gap-2">
                {map.entities.map((ent, i) => (
                  <span
                    key={i}
                    className="px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-200 text-xs font-bold"
                  >
                    {ent}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Bloque gateado: el arreglo */}
          <div className="relative rounded-2xl border-2 border-cyan-500/40 bg-gradient-to-b from-slate-900 to-slate-950 p-6 md:p-8 overflow-hidden">
            <div className="absolute -top-16 -right-16 w-48 h-48 bg-cyan-500/10 blur-3xl rounded-full pointer-events-none" />
            <div className="relative text-center">
              <span className="inline-block px-3 py-1 rounded-full bg-cyan-500/20 border border-cyan-400/40 text-cyan-200 text-xs font-black uppercase tracking-widest mb-4">
                🔒 El arreglo, listo para pegar
              </span>
              <h3 className="text-white font-black text-xl md:text-2xl leading-tight mb-2">
                {result.offerTeaser
                  ? result.offerTeaser.missionTitle
                  : "Tu misión: que Google y las IA entiendan tu página"}
              </h3>
              <p className="text-slate-300 font-semibold max-w-xl mx-auto mb-6">
                {result.offerTeaser
                  ? result.offerTeaser.description
                  : "Registrate gratis y SEO Jump te arma el código exacto y te guía paso a paso para pegarlo. Sin ver JSON, sin tecnicismos."}
              </p>

              {/* Preview borroso del código (señuelo visual; tipo según oferta real) */}
              <div className="relative mb-6">
                <pre className="text-left text-[11px] leading-relaxed text-cyan-300/80 bg-slate-950 border border-slate-800 rounded-xl p-4 blur-[5px] select-none overflow-hidden max-h-32">
{result.offerTeaser?.type === "product"
  ? `{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "...",
  "offers": { "@type": "Offer", ... }
}`
  : result.offerTeaser?.type === "article"
    ? `{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "...",
  "author": { ... }
}`
    : result.offerTeaser?.type === "organization"
      ? `{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "...",
  "url": "..."
}`
      : `{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [{ "@type": "Question", ... }]
}`}
                </pre>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-3xl">🔒</span>
                </div>
              </div>

              <button
                onClick={() => {
                  if (playClick) playClick();
                  onRegister?.();
                }}
                className="btn-3d btn-green text-lg md:text-xl px-8 py-4 w-full sm:w-auto transform hover:scale-105 transition-all"
              >
                Quiero corregirlo → Registrarme gratis
              </button>
              <p className="text-slate-500 text-xs font-bold mt-4">
                Gratis. Sin tarjeta. Empezás a mejorar tu web en minutos.
              </p>
            </div>
          </div>

          {/* Analizar otra */}
          <div className="text-center">
            <button
              onClick={() => {
                setResult(null);
                setUrl("");
                setError("");
                if (playClick) playClick();
              }}
              className="text-slate-400 hover:text-white font-bold underline underline-offset-4 decoration-slate-600 text-sm transition-colors"
            >
              ↻ Analizar otra página
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
