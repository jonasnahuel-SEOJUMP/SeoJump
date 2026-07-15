'use client';

import { useState, useEffect } from 'react';
import { getComprehensionMap, verifyComprehensionFaqStructure } from '../lib/actions';
import { getStoredPlatform } from '../lib/cmsGuide';
import { PH_EVENTS, trackEvent } from '../lib/posthog';

const CONF_STYLES = {
  alto: {
    ring: 'border-emerald-500/50 bg-emerald-950/30',
    chip: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
    label: 'Alta',
  },
  medio: {
    ring: 'border-amber-500/50 bg-amber-950/30',
    chip: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
    label: 'Media',
  },
  bajo: {
    ring: 'border-red-500/50 bg-red-950/30',
    chip: 'bg-red-500/15 text-red-300 border-red-500/40',
    label: 'Baja',
  },
};

/**
 * Mapa de comprensión: qué entiende Google/IA de una página.
 * El código FAQ se muestra como "código listo para pegar" (sin jerga Schema).
 */
export default function ComprehensionPanel({
  defaultUrl = '',
  playClick,
  playSuccess,
  onMissionComplete,
}) {
  const [url, setUrl] = useState(defaultUrl);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [payload, setPayload] = useState(null);
  const [copied, setCopied] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyMsg, setVerifyMsg] = useState(null);

  useEffect(() => {
    if (defaultUrl && defaultUrl !== url) setUrl(defaultUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultUrl]);

  const handleAnalyze = async (e) => {
    if (e) e.preventDefault();
    if (!url.trim()) return;
    if (playClick) playClick();
    setLoading(true);
    setError('');
    setPayload(null);
    setVerifyMsg(null);
    setCopied(false);

    try {
      const platformId = getStoredPlatform();
      const res = await getComprehensionMap(url.trim(), platformId);
      if (res.success) {
        setPayload(res);
        trackEvent(PH_EVENTS.COMPREHENSION_ANALYZED, {
          page: url.trim(),
          confidence: res.map?.confidence,
          canOfferFaq: !!res.map?.canOfferFaqStructure,
        });
      } else {
        setError(res.error || 'No pudimos analizar la página.');
      }
    } catch (err) {
      setError('Error al conectar: ' + (err?.message || err));
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!payload?.faqCode) return;
    if (playClick) playClick();
    try {
      await navigator.clipboard.writeText(payload.faqCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setVerifyMsg({ ok: false, text: 'No se pudo copiar. Seleccioná el código manualmente.' });
    }
  };

  const handleVerify = async () => {
    if (!payload?.map?.pageUrl) return;
    if (playClick) playClick();
    setVerifying(true);
    setVerifyMsg(null);
    try {
      const res = await verifyComprehensionFaqStructure(payload.map.pageUrl);
      setVerifyMsg({ ok: !!res.success, text: res.message });
      if (res.success) {
        if (playSuccess) playSuccess();
        trackEvent(PH_EVENTS.COMPREHENSION_FAQ_APPLIED, {
          page: payload.map.pageUrl,
        });
        if (onMissionComplete) {
          const mid = `comprehension-faq-${(payload.map.pageUrl || '').replace(/\/+$/, '').toLowerCase()}`;
          onMissionComplete(mid, res.xp || 40);
        }
        // Refrescar mapa
        const platformId = getStoredPlatform();
        const refreshed = await getComprehensionMap(payload.map.pageUrl, platformId);
        if (refreshed.success) setPayload(refreshed);
      }
    } catch (err) {
      setVerifyMsg({ ok: false, text: 'Error al verificar: ' + (err?.message || err) });
    } finally {
      setVerifying(false);
    }
  };

  const map = payload?.map;
  const conf = map ? CONF_STYLES[map.confidence] || CONF_STYLES.bajo : null;

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="text-xs font-black text-cyan-400 uppercase tracking-wider">Mapa de comprensión</p>
        <h3 className="text-xl md:text-2xl font-black text-white">
          ¿Qué entienden Google y las IA de esta página?
        </h3>
        <p className="text-sm font-bold text-slate-400 leading-relaxed">
          No es magia ni promesas de citas. Es reducir ambigüedad: tipo de página, temas, preguntas,
          autor y empresa. Después podés completar lo que falta con una misión clara.
        </p>
      </div>

      <form onSubmit={handleAnalyze} className="space-y-3">
        <label className="text-xs font-black text-slate-400 uppercase tracking-wider block">
          URL a analizar
        </label>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://tusitio.com/producto-o-articulo"
          className="w-full px-4 py-3 rounded-xl bg-slate-900 border-2 border-slate-700 text-white font-bold text-sm focus:border-cyan-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading || !url.trim()}
          className="btn-3d bg-cyan-600 border-cyan-700 border-b-4 hover:bg-cyan-500 text-white text-sm md:text-base font-black px-6 py-3 disabled:opacity-50"
        >
          {loading ? 'Analizando…' : 'Ver mapa de comprensión'}
        </button>
      </form>

      {error && (
        <div className="p-4 rounded-xl border border-red-500/40 bg-red-950/40 text-red-300 text-sm font-bold">
          {error}
        </div>
      )}

      {map && conf && (
        <div className={`rounded-2xl border-2 p-5 md:p-6 space-y-5 ${conf.ring}`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-1">
                Tipo detectado: {map.pageTypeLabel}
              </p>
              <p className="text-base md:text-lg font-black text-white leading-snug">{map.headline}</p>
            </div>
            <span className={`px-3 py-1.5 rounded-full border text-xs font-black ${conf.chip}`}>
              Claridad {conf.label} · {map.confidenceScore}/100
            </span>
          </div>

          {map.entities?.length > 0 && (
            <div>
              <p className="text-xs font-black text-slate-500 uppercase tracking-wider mb-2">
                Esta página habla de
              </p>
              <div className="flex flex-wrap gap-2">
                {map.entities.map((e) => (
                  <span
                    key={e}
                    className="px-3 py-1 rounded-lg bg-slate-800/80 border border-slate-600 text-slate-200 text-xs font-bold"
                  >
                    {e} ✓
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-xs font-black text-slate-500 uppercase tracking-wider">
              Qué entiende (y qué no)
            </p>
            <ul className="space-y-2">
              {map.checks
                .filter((c) => c.applicable)
                .map((c) => (
                  <li
                    key={c.id}
                    className="flex gap-3 items-start rounded-xl bg-slate-900/50 border border-slate-700/60 p-3"
                  >
                    <span className="text-lg leading-none mt-0.5" aria-hidden>
                      {c.present ? '✔' : '✘'}
                    </span>
                    <div>
                      <p
                        className={`text-sm font-black ${
                          c.present ? 'text-emerald-300' : 'text-red-300'
                        }`}
                      >
                        {c.label}
                      </p>
                      <p className="text-xs font-bold text-slate-400 mt-0.5">{c.detail}</p>
                    </div>
                  </li>
                ))}
            </ul>
          </div>

          {/* Misión FAQ structure */}
          {map.faqStructureAlreadyPresent && (
            <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/30 p-4">
              <p className="text-sm font-black text-emerald-300">
                Tus preguntas frecuentes ya están en un formato que Google y las IA pueden leer.
                No hace falta duplicar nada.
              </p>
            </div>
          )}

          {payload.faqCode && map.canOfferFaqStructure && (
            <div className="rounded-xl border border-cyan-500/40 bg-cyan-950/20 p-4 md:p-5 space-y-4">
              <div>
                <p className="text-xs font-black text-cyan-400 uppercase tracking-wider mb-1">
                  Misión: hacer que las IA lean tus preguntas
                </p>
                <p className="text-sm font-bold text-slate-300">
                  Esta página responde {map.questions.length} preguntas. Generamos automáticamente
                  la estructura que Google y las IA entienden — sin que tengas que pelearte con
                  código técnico.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="btn-3d bg-cyan-600 border-cyan-800 border-b-4 hover:bg-cyan-500 text-white text-sm font-black px-4 py-2.5"
                >
                  {copied ? '✓ Copiado' : `📋 ${payload.guide?.copyLabel || 'Copiar código'}`}
                </button>
                <button
                  type="button"
                  onClick={handleVerify}
                  disabled={verifying}
                  className="btn-3d bg-slate-700 border-slate-800 border-b-4 hover:bg-slate-600 text-white text-sm font-black px-4 py-2.5 disabled:opacity-50"
                >
                  {verifying ? 'Verificando…' : 'Ya lo pegué (+40 XP)'}
                </button>
              </div>

              {payload.guide?.steps?.length > 0 && (
                <ol className="list-decimal list-inside space-y-1.5 text-xs font-bold text-slate-400">
                  {payload.guide.steps.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>
              )}

              {/* Código colapsado / técnico: disponible pero no es el foco */}
              <details className="text-xs text-slate-500">
                <summary className="cursor-pointer font-black text-slate-400 hover:text-slate-300">
                  Ver código (solo si tu plataforma lo pide)
                </summary>
                <pre className="mt-2 p-3 rounded-lg bg-black/40 overflow-x-auto text-[10px] text-slate-400 max-h-40">
                  {payload.faqCode}
                </pre>
              </details>
            </div>
          )}

          {verifyMsg && (
            <div
              className={`p-4 rounded-xl border text-sm font-bold ${
                verifyMsg.ok
                  ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300'
                  : 'bg-red-950/40 border-red-500/50 text-red-300'
              }`}
            >
              {verifyMsg.ok ? '✅' : '⚠️'} {verifyMsg.text}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
