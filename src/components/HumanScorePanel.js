"use client";

import { useState } from "react";
import { getHumanScore, verifyHumanMission } from "../lib/actions";

// Colores por banda de puntaje
const BAND_STYLES = {
  alto: {
    ring: "#10b981",
    text: "text-emerald-400",
    chip: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
    label: "Alto",
  },
  medio: {
    ring: "#f59e0b",
    text: "text-amber-400",
    chip: "bg-amber-500/15 text-amber-300 border-amber-500/40",
    label: "Medio",
  },
  bajo: {
    ring: "#ef4444",
    text: "text-red-400",
    chip: "bg-red-500/15 text-red-300 border-red-500/40",
    label: "Bajo",
  },
};

function dimColor(score) {
  if (score >= 50) return "bg-emerald-500";
  if (score >= 25) return "bg-amber-500";
  return "bg-red-500";
}

function normalizeUrl(u) {
  return (u || "").trim().replace(/\/+$/, "").toLowerCase();
}

/**
 * Panel de Human Score: mide el "valor humano" de una página y propone
 * Misiones Human (experiencia, evidencia, casos, opinión, datos) que la IA
 * NO puede completar por el usuario. La IA solo diagnostica y da ejemplos.
 *
 * Props:
 *  - defaultUrl: URL prellenada a analizar
 *  - keyword, businessFocus: contexto para personalizar las misiones
 *  - completedMissions: Set de ids ya completados
 *  - onMissionComplete(missionId, xp): callback para sumar XP y persistir
 *  - playClick, playSuccess: sonidos
 */
export default function HumanScorePanel({
  defaultUrl = "",
  keyword = "",
  businessFocus = "",
  completedMissions,
  onMissionComplete,
  playClick,
  playSuccess,
}) {
  const doneSet = completedMissions instanceof Set ? completedMissions : new Set();

  const [url, setUrl] = useState(defaultUrl);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [verifying, setVerifying] = useState(null); // dimension en verificación
  const [missionMsg, setMissionMsg] = useState({}); // { [dimension]: {ok, text} }

  const analyzedUrl = result ? result._url : "";

  const handleAnalyze = async (e) => {
    if (e) e.preventDefault();
    if (!url.trim()) return;
    if (playClick) playClick();
    setLoading(true);
    setError("");
    setResult(null);
    setMissionMsg({});

    try {
      const res = await getHumanScore(url, keyword, businessFocus);
      if (res.success) {
        setResult({ ...res, _url: url.trim() });
      } else {
        setError(res.error || "No pudimos analizar la página.");
      }
    } catch (err) {
      setError("Error al conectar con la página: " + (err?.message || err));
    } finally {
      setLoading(false);
    }
  };

  const missionId = (dimension) => `human-${dimension}-${normalizeUrl(analyzedUrl)}`;

  const handleVerify = async (dimension) => {
    if (playClick) playClick();
    setVerifying(dimension);
    setMissionMsg((prev) => ({ ...prev, [dimension]: null }));

    try {
      const prevDim = result?.dimensions?.find((d) => d.id === dimension);
      const previousScore = typeof prevDim?.score === "number" ? prevDim.score : null;
      const res = await verifyHumanMission(analyzedUrl, dimension, previousScore);
      if (res.success) {
        const id = missionId(dimension);
        const mission = result.missions.find((m) => m.id === dimension);
        const xp = mission ? mission.xp : 15;
        if (!doneSet.has(id) && onMissionComplete) {
          onMissionComplete(id, xp);
        }
        if (playSuccess) playSuccess();
        setMissionMsg((prev) => ({ ...prev, [dimension]: { ok: true, text: res.message } }));
      } else {
        setMissionMsg((prev) => ({ ...prev, [dimension]: { ok: false, text: res.message } }));
      }
    } catch (err) {
      setMissionMsg((prev) => ({ ...prev, [dimension]: { ok: false, text: "Error al verificar: " + (err?.message || err) } }));
    } finally {
      setVerifying(null);
    }
  };

  const band = result ? BAND_STYLES[result.band] || BAND_STYLES.medio : null;

  return (
    <div className="space-y-6">
      {/* Intro / filosofía */}
      <div className="rounded-2xl border-2 border-fuchsia-500/30 bg-gradient-to-br from-fuchsia-950/30 to-slate-900 p-5 md:p-6">
        <div className="flex items-start gap-3">
          <span className="text-3xl flex-shrink-0">🫀</span>
          <div className="space-y-1.5">
            <h3 className="text-xl md:text-2xl font-black text-white">Human Score</h3>
            <p className="text-sm md:text-base font-bold text-slate-300 leading-relaxed">
              La IA optimiza títulos y metadatos. <strong className="text-fuchsia-300">Vos aportás lo irreemplazable</strong>: experiencia, evidencia y criterio. Este análisis mide cuánto de eso tiene tu página, sin importar si el borrador lo escribió una IA.
            </p>
            <p className="text-xs font-bold text-slate-500">
              No detecta "si es IA". Detecta si tu contenido aporta algo que los otros 100 resultados de Google no tienen.
            </p>
          </div>
        </div>
      </div>

      {/* Input de URL */}
      <form onSubmit={handleAnalyze} className="space-y-3">
        <label className="text-sm font-black text-slate-400 uppercase tracking-wide">
          URL a analizar
        </label>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://tusitio.com/articulo"
            className="flex-1 p-4 text-base md:text-lg border-2 border-slate-700 rounded-xl focus:border-fuchsia-500 outline-none font-bold text-slate-200 bg-slate-900 transition-colors"
          />
          <button
            type="submit"
            disabled={loading || !url.trim()}
            className={`px-6 py-4 rounded-xl font-black text-base whitespace-nowrap transition-all ${
              loading || !url.trim()
                ? "bg-slate-800 text-slate-500 cursor-not-allowed border-2 border-slate-700"
                : "btn-3d bg-fuchsia-600 border-fuchsia-700 border-b-4 hover:bg-fuchsia-500 text-white"
            }`}
          >
            {loading ? "⏳ Analizando..." : "🫀 Medir Human Score"}
          </button>
        </div>
      </form>

      {error && (
        <div className="p-4 bg-red-950/40 border-2 border-red-800 text-red-300 rounded-xl font-bold text-sm">
          ⚠️ {error}
        </div>
      )}

      {loading && (
        <div className="text-center py-12">
          <div className="inline-block w-12 h-12 border-4 border-fuchsia-500/30 border-t-fuchsia-500 rounded-full animate-spin" />
          <p className="mt-4 text-sm font-black text-slate-400">
            Leyendo tu contenido y midiendo su valor humano...
          </p>
        </div>
      )}

      {result && band && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Gauge + headline */}
          <div className="flex flex-col md:flex-row items-center gap-6 rounded-2xl border-2 border-slate-700 bg-slate-900 p-6">
            <div
              className="relative w-32 h-32 rounded-full flex items-center justify-center flex-shrink-0"
              style={{
                background: `conic-gradient(${band.ring} ${result.score * 3.6}deg, #1e293b 0deg)`,
              }}
            >
              <div className="absolute inset-2 rounded-full bg-slate-900 flex flex-col items-center justify-center">
                <span className={`text-4xl font-black ${band.text}`}>{result.score}</span>
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">/ 100</span>
              </div>
            </div>
            <div className="flex-1 text-center md:text-left space-y-2">
              <span className={`inline-block text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full border ${band.chip}`}>
                Human Score {band.label}
              </span>
              <p className="text-lg font-black text-white leading-snug">{result.headline}</p>
              {result.thin && (
                <p className="text-xs font-bold text-amber-400">
                  ⚠️ El contenido es corto ({result.wordCount} palabras). Con más texto real, el puntaje reflejará mejor tu valor.
                </p>
              )}
            </div>
          </div>

          {/* Dimensiones */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {result.dimensions.map((d) => (
              <div key={d.id} className="rounded-xl border-2 border-slate-700 bg-slate-900/60 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-black text-white flex items-center gap-2">
                    <span>{d.emoji}</span> {d.label}
                  </span>
                  <span className={`text-sm font-black ${d.passed ? "text-emerald-400" : "text-slate-400"}`}>
                    {d.score}
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div className={`h-full ${dimColor(d.score)} transition-all duration-700`} style={{ width: `${d.score}%` }} />
                </div>
                <p className="text-xs font-bold text-slate-500 leading-snug">{d.summary}</p>
              </div>
            ))}
          </div>

          {/* Misiones Human */}
          {result.missions.length > 0 ? (
            <div className="space-y-4">
              <div>
                <h4 className="text-lg font-black text-white flex items-center gap-2">
                  👤 Misiones Human
                </h4>
                <p className="text-sm font-bold text-slate-400">
                  Estas las tenés que hacer vos: la IA no puede inventar tu experiencia. Publicá el cambio en la web (no en borrador) y tocá <strong className="text-white">Verificar</strong>.
                </p>
              </div>

              {result.missions.map((m) => {
                const id = missionId(m.id);
                const isDone = doneSet.has(id);
                const msg = missionMsg[m.id];
                return (
                  <div
                    key={m.id}
                    className={`rounded-2xl border-2 p-5 space-y-3 transition-all ${
                      isDone
                        ? "border-emerald-500/50 bg-emerald-950/20"
                        : "border-fuchsia-500/30 bg-slate-900"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <span className="text-2xl flex-shrink-0">{m.emoji}</span>
                        <div>
                          <h5 className="text-base font-black text-white">{m.title}</h5>
                          <p className="text-sm font-bold text-slate-400 leading-snug mt-1">{m.why}</p>
                        </div>
                      </div>
                      <span className="flex-shrink-0 text-xs font-black text-fuchsia-300 bg-fuchsia-500/15 border border-fuchsia-500/40 px-2.5 py-1 rounded-full">
                        +{m.xp} XP
                      </span>
                    </div>

                    {m.examples && m.examples.length > 0 && (
                      <ul className="space-y-1.5 pl-1">
                        {m.examples.map((ex, i) => (
                          <li key={i} className="text-sm font-bold text-slate-300 flex items-start gap-2">
                            <span className="text-fuchsia-400 flex-shrink-0">›</span>
                            <span>{ex}</span>
                          </li>
                        ))}
                      </ul>
                    )}

                    {isDone ? (
                      <div className="flex items-center gap-2 text-sm font-black text-emerald-400">
                        ✅ Completada — sumaste +{m.xp} XP
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <button
                          onClick={() => handleVerify(m.id)}
                          disabled={verifying === m.id}
                          className={`w-full sm:w-auto px-5 py-2.5 rounded-xl font-black text-sm transition-all ${
                            verifying === m.id
                              ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                              : "btn-3d bg-emerald-600 border-emerald-700 border-b-4 hover:bg-emerald-500 text-white"
                          }`}
                        >
                          {verifying === m.id ? "⏳ Verificando..." : "✅ Ya lo agregué — Verificar"}
                        </button>
                        {msg && (
                          <p className={`text-sm font-bold ${msg.ok ? "text-emerald-400" : "text-amber-400"}`}>
                            {msg.ok ? "✅" : "⚠️"} {msg.text}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border-2 border-emerald-500/40 bg-emerald-950/20 p-6 text-center space-y-2">
              <div className="text-4xl">🏆</div>
              <h4 className="text-lg font-black text-emerald-300">¡Contenido con sello humano!</h4>
              <p className="text-sm font-bold text-slate-300">
                Tu página ya demuestra experiencia, evidencia y criterio. Es difícil de copiar y fácil de citar por buscadores e IA.
              </p>
            </div>
          )}

          <div className="text-center">
            <button
              onClick={handleAnalyze}
              className="text-sm font-black text-slate-400 hover:text-white underline transition-colors"
            >
              🔄 Volver a analizar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
