'use client';

import { useState, useEffect, useRef } from 'react';
import { getComprehensionMap, verifyComprehensionFaqStructure } from '../lib/actions';
import { getStoredPlatform } from '../lib/cmsGuide';
import { PH_EVENTS, trackEvent } from '../lib/posthog';
import Link from 'next/link';
import {
  SCHEMA_INSTALL_METHODS,
  SCHEMA_PASTE_BLOG_HREF,
  getSchemaPasteGuide,
  getStoredSchemaInstallMethod,
  setStoredSchemaInstallMethod,
  resolveSchemaInstallMethod,
  getMethodLabel,
} from '../lib/schemaPasteGuide';

/** Renderiza **negrita** de markdown como <strong> (evita mostrar asteriscos literales). */
function renderWithBold(text) {
  if (!text) return null;
  const parts = String(text).split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="text-slate-200">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}

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
 * Tras el análisis: volver a comprobar cambios, o salir y analizar otra URL.
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
  const [recheckNote, setRecheckNote] = useState(null);
  const [installMethod, setInstallMethod] = useState('');
  const [editorConflictMsg, setEditorConflictMsg] = useState(null);
  const [suggestedEditor, setSuggestedEditor] = useState(null);
  const urlInputRef = useRef(null);

  useEffect(() => {
    if (defaultUrl && !payload) setUrl(defaultUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultUrl]);

  const applyEditorResolution = (editorHint) => {
    const platformId = getStoredPlatform();
    const stored = getStoredSchemaInstallMethod(platformId);
    const resolved = resolveSchemaInstallMethod({
      platformId,
      storedMethod: stored,
      editorHint: editorHint || null,
    });
    setInstallMethod(resolved.method);
    setEditorConflictMsg(resolved.conflictMessage);
    setSuggestedEditor(resolved.suggestedMethod);
  };

  const selectInstallMethod = (methodId) => {
    if (!methodId) return;
    setInstallMethod(methodId);
    setStoredSchemaInstallMethod(methodId);
    setEditorConflictMsg(null);
    setVerifyMsg(null);
    if (playClick) playClick();
  };

  const runAnalysis = async (targetUrl, { isRecheck = false } = {}) => {
    const clean = (targetUrl || '').trim();
    if (!clean) return;

    setLoading(true);
    setError('');
    setVerifyMsg(null);
    setRecheckNote(null);
    if (!isRecheck) {
      setPayload(null);
      setCopied(false);
    }

    try {
      const platformId = getStoredPlatform();
      const res = await getComprehensionMap(clean, platformId);
      if (res.success) {
        const prevScore = payload?.map?.confidenceScore;
        setPayload(res);
        applyEditorResolution(res.editorHint);
        trackEvent(PH_EVENTS.COMPREHENSION_ANALYZED, {
          page: clean,
          confidence: res.map?.confidence,
          canOfferFaq: !!res.map?.canOfferFaqStructure,
          recheck: isRecheck,
          editorHint: res.editorHint?.suggestedMethod || null,
        });
        if (isRecheck && typeof prevScore === 'number' && res.map) {
          const delta = res.map.confidenceScore - prevScore;
          if (delta > 0) {
            setRecheckNote({
              ok: true,
              text: `Mejoró la claridad: ${prevScore} → ${res.map.confidenceScore}. Buen trabajo.`,
            });
            if (playSuccess) playSuccess();
          } else if (delta < 0) {
            setRecheckNote({
              ok: false,
              text: `La claridad bajó un poco (${prevScore} → ${res.map.confidenceScore}). Revisá lo que cambiaste.`,
            });
          } else {
            setRecheckNote({
              ok: false,
              text: 'Misma claridad que antes. Si ya publicaste cambios, borrá la caché del sitio y volvé a comprobar.',
            });
          }
        }
      } else {
        setError(res.error || 'No pudimos analizar la página.');
      }
    } catch (err) {
      setError('Error al conectar: ' + (err?.message || err));
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = async (e) => {
    if (e) e.preventDefault();
    if (playClick) playClick();
    await runAnalysis(url, { isRecheck: false });
  };

  const handleRecheck = async () => {
    const target = payload?.map?.pageUrl || url;
    if (!target?.trim()) return;
    if (playClick) playClick();
    setUrl(target);
    await runAnalysis(target, { isRecheck: true });
  };

  const handleNewUrl = () => {
    if (playClick) playClick();
    setPayload(null);
    setError('');
    setVerifyMsg(null);
    setRecheckNote(null);
    setCopied(false);
    setEditorConflictMsg(null);
    setSuggestedEditor(null);
    setInstallMethod('');
    setUrl('');
    setTimeout(() => urlInputRef.current?.focus(), 50);
  };

  const offerCode = payload?.offerCode || payload?.offer?.code || null;

  const handleCopy = async () => {
    if (!offerCode) return;
    if (playClick) playClick();
    try {
      await navigator.clipboard.writeText(offerCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setVerifyMsg({ ok: false, text: 'No se pudo copiar. Seleccioná el código manualmente.' });
    }
  };

  const handleVerifyFaq = async () => {
    if (!payload?.map?.pageUrl) return;
    const offerType = payload?.offer?.type || 'faq';
    if (playClick) playClick();
    setVerifying(true);
    setVerifyMsg(null);
    try {
      const res = await verifyComprehensionFaqStructure(payload.map.pageUrl, offerType);
      setVerifyMsg({ ok: !!res.success, text: res.message });
      if (res.success) {
        if (playSuccess) playSuccess();
        trackEvent(PH_EVENTS.COMPREHENSION_FAQ_APPLIED, {
          page: payload.map.pageUrl,
          offerType,
        });
        if (onMissionComplete) {
          const mid = `comprehension-${offerType}-${(payload.map.pageUrl || '').replace(/\/+$/, '').toLowerCase()}`;
          onMissionComplete(mid, res.xp || 40);
        }
        const platformId = getStoredPlatform();
        const refreshed = await getComprehensionMap(payload.map.pageUrl, platformId);
        if (refreshed.success) {
          setPayload(refreshed);
          applyEditorResolution(refreshed.editorHint);
        }
      }
    } catch (err) {
      setVerifyMsg({ ok: false, text: 'Error al verificar: ' + (err?.message || err) });
    } finally {
      setVerifying(false);
    }
  };

  const map = payload?.map;
  const conf = map ? CONF_STYLES[map.confidence] || CONF_STYLES.bajo : null;
  const hasGaps = map?.checks?.some((c) => c.applicable && !c.present);
  const offer = payload?.offer || null;
  const pasteGuide = getSchemaPasteGuide(installMethod);
  const wpMethods = SCHEMA_INSTALL_METHODS.filter((m) => m.group === 'wp');
  const otherMethods = SCHEMA_INSTALL_METHODS.filter((m) => m.group === 'other');
  // Todo cubierto: no hay estructura nueva para ofrecer.
  const allCovered = map && !offer;

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="text-xs font-black text-cyan-400 uppercase tracking-wider">Mapa de comprensión</p>
        <h3 className="text-xl md:text-2xl font-black text-white">
          ¿Qué entienden Google y las IA de esta página?
        </h3>
        <p className="text-sm font-bold text-slate-400 leading-relaxed">
          No es magia ni promesas de citas. Es reducir ambigüedad: tipo de página, temas, preguntas,
          autor y empresa. Después podés completar lo que falta y volver a comprobar.
        </p>
      </div>

      {/* Formulario: solo cuando no hay resultado, o al elegir "otra URL" */}
      {!map && (
        <form onSubmit={handleAnalyze} className="space-y-3">
          <label className="text-xs font-black text-slate-400 uppercase tracking-wider block">
            URL a analizar
          </label>
          <input
            ref={urlInputRef}
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
      )}

      {error && (
        <div className="p-4 rounded-xl border border-red-500/40 bg-red-950/40 text-red-300 text-sm font-bold">
          {error}
        </div>
      )}

      {map && conf && (
        <div className={`rounded-2xl border-2 p-5 md:p-6 space-y-5 ${conf.ring}`}>
          {/* Acciones principales: salir / re-comprobar */}
          <div className="flex flex-col sm:flex-row flex-wrap gap-2">
            <button
              type="button"
              onClick={handleRecheck}
              disabled={loading || verifying}
              className="btn-3d bg-cyan-600 border-cyan-800 border-b-4 hover:bg-cyan-500 text-white text-sm font-black px-4 py-2.5 disabled:opacity-50"
            >
              {loading ? 'Comprobando…' : '🔄 Volver a comprobar esta página'}
            </button>
            <button
              type="button"
              onClick={handleNewUrl}
              disabled={loading}
              className="btn-3d bg-slate-700 border-slate-800 border-b-4 hover:bg-slate-600 text-white text-sm font-black px-4 py-2.5 disabled:opacity-50"
            >
              ← Analizar otra URL
            </button>
          </div>

          <p className="text-xs font-bold text-slate-500 break-all">
            Página: <span className="text-slate-300">{map.pageUrl}</span>
          </p>

          {(recheckNote || verifyMsg) && (
            <div
              className={`p-4 rounded-xl border text-sm font-bold ${
                (recheckNote || verifyMsg).ok
                  ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300'
                  : 'bg-amber-950/40 border-amber-500/50 text-amber-200'
              }`}
            >
              {(recheckNote || verifyMsg).ok ? '✅' : 'ℹ️'} {(recheckNote || verifyMsg).text}
            </div>
          )}

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

          {hasGaps && (
            <div className="rounded-xl border border-slate-600/60 bg-slate-900/40 p-4 space-y-2">
              <p className="text-sm font-black text-white">Qué hacer ahora</p>
              <p className="text-xs font-bold text-slate-400 leading-relaxed">
                Corregí en tu web lo marcado con ✘ (publicá y borrá la caché). Después tocá{' '}
                <span className="text-cyan-300">Volver a comprobar esta página</span> para ver si
                mejoró el mapa.
              </p>
              {map.checks.some((c) => c.id === 'questions' && !c.present) && (
                <p className="text-xs font-bold text-amber-200/90 leading-relaxed">
                  Tip: para que detectemos tus FAQs, poné cada pregunta como{' '}
                  <span className="text-amber-100">H2/H3 o en negrita</span> con signos de
                  interrogación (¿…?), y la respuesta en el párrafo de abajo.
                </p>
              )}
            </div>
          )}

          {allCovered && (
            <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/30 p-4">
              <p className="text-sm font-black text-emerald-300">
                Google y las IA ya tienen los datos estructurados clave de esta página. No hace
                falta generar ni duplicar nada.
              </p>
            </div>
          )}

          {offer && offerCode && (
            <div className="rounded-xl border border-cyan-500/40 bg-cyan-950/20 p-4 md:p-5 space-y-4">
              <div>
                <p className="text-xs font-black text-cyan-400 uppercase tracking-wider mb-1">
                  Misión: {offer.missionTitle}
                </p>
                <p className="text-sm font-bold text-slate-300">{offer.description}</p>
                {offer.note && (
                  <p className="text-xs font-bold text-amber-200/80 mt-2 leading-relaxed">
                    {offer.note}
                  </p>
                )}
              </div>

              <div className="rounded-lg bg-slate-900/60 border border-slate-700/60 p-3 space-y-1">
                <p className="text-xs font-black text-slate-300">¿Qué es este código?</p>
                <p className="text-xs font-bold text-slate-400 leading-relaxed">
                  Es un pequeño bloque técnico (lo que Google llama «datos estructurados»).
                  <span className="text-slate-200"> No cambia cómo se ve tu página: es invisible para quien la visita.</span> Solo
                  le explica a Google y a las IA, en su idioma, de qué trata esta página.
                </p>
              </div>

              <div className="rounded-xl border-2 border-cyan-500/30 bg-slate-950/50 p-4 space-y-4">
                <div>
                  <p className="text-sm font-black text-white block mb-1">
                    1. ¿Con qué editor modificás esta página?
                  </p>
                  <p className="text-xs font-bold text-slate-400 leading-relaxed mb-3">
                    Tocá la pestaña correcta. La home suele usar bloques o un maquetador; un producto
                    a veces usa el editor clásico. No son lo mismo.
                  </p>

                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">
                    WordPress
                  </p>
                  <div className="flex flex-wrap gap-2 mb-3" role="tablist" aria-label="Editor WordPress">
                    {wpMethods.map((method) => {
                      const active = installMethod === method.id;
                      const isSuggested = suggestedEditor === method.id;
                      return (
                        <button
                          key={method.id}
                          type="button"
                          role="tab"
                          aria-selected={active}
                          onClick={() => selectInstallMethod(method.id)}
                          className={`text-left px-3 py-2 rounded-xl border-2 text-xs font-black transition-all ${
                            active
                              ? 'border-cyan-400 bg-cyan-500/20 text-cyan-100'
                              : 'border-slate-600 bg-slate-900/80 text-slate-300 hover:border-cyan-500/50 hover:text-white'
                          }`}
                        >
                          <span className="block">
                            {method.icon} {method.shortLabel}
                          </span>
                          {isSuggested && (
                            <span className="block mt-0.5 text-[10px] font-bold text-cyan-300/90 normal-case tracking-normal">
                              Sugerido para esta página
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">
                    Otras plataformas
                  </p>
                  <div className="flex flex-wrap gap-2" role="tablist" aria-label="Otras plataformas">
                    {otherMethods.map((method) => {
                      const active = installMethod === method.id;
                      const isSuggested = suggestedEditor === method.id;
                      return (
                        <button
                          key={method.id}
                          type="button"
                          role="tab"
                          aria-selected={active}
                          onClick={() => selectInstallMethod(method.id)}
                          className={`text-left px-3 py-2 rounded-xl border-2 text-xs font-black transition-all ${
                            active
                              ? 'border-cyan-400 bg-cyan-500/20 text-cyan-100'
                              : 'border-slate-600 bg-slate-900/80 text-slate-300 hover:border-cyan-500/50 hover:text-white'
                          }`}
                        >
                          <span className="block">
                            {method.icon} {method.shortLabel}
                          </span>
                          {isSuggested && (
                            <span className="block mt-0.5 text-[10px] font-bold text-cyan-300/90 normal-case tracking-normal">
                              Sugerido para esta página
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {editorConflictMsg && (
                  <div className="rounded-lg border border-amber-500/40 bg-amber-950/30 p-3 space-y-2">
                    <p className="text-xs font-bold text-amber-200 leading-relaxed">
                      ⚠️ {editorConflictMsg}
                    </p>
                    {suggestedEditor && (
                      <button
                        type="button"
                        onClick={() => selectInstallMethod(suggestedEditor)}
                        className="text-xs font-black text-cyan-300 underline underline-offset-2 hover:text-cyan-200"
                      >
                        Usar {getMethodLabel(suggestedEditor)}
                      </button>
                    )}
                  </div>
                )}

                {!pasteGuide && !editorConflictMsg && (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-950/30 p-3">
                    <p className="text-xs font-bold text-amber-200">
                      Elegí una pestaña arriba. SEO Jump te va a indicar exactamente dónde entrar,
                      qué botón tocar y dónde pegar el código.
                    </p>
                  </div>
                )}

                {pasteGuide && (
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-black text-cyan-300">{pasteGuide.title}</p>
                      <p className="text-xs font-bold text-slate-400 mt-1 leading-relaxed">
                        {pasteGuide.recognition}
                      </p>
                    </div>
                    <ol className="space-y-2 text-xs font-bold text-slate-300">
                      {pasteGuide.steps.map((step, i) => (
                        <li key={i} className="flex gap-2.5 items-start">
                          <span className="flex-none w-5 h-5 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-[10px] font-black flex items-center justify-center">
                            {i + 1}
                          </span>
                          <span className="leading-relaxed pt-0.5">{renderWithBold(step)}</span>
                        </li>
                      ))}
                    </ol>
                    {pasteGuide.note && (
                      <p className="text-xs font-bold text-slate-400 leading-relaxed">
                        {renderWithBold(pasteGuide.note)}
                      </p>
                    )}
                    {pasteGuide.warning && (
                      <div className="rounded-lg border border-amber-500/40 bg-amber-950/30 p-3">
                        <p className="text-xs font-bold text-amber-200 leading-relaxed">
                          ⚠️ {pasteGuide.warning}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <Link
                  href={SCHEMA_PASTE_BLOG_HREF}
                  onClick={() => {
                    if (playClick) playClick();
                  }}
                  className="inline-block text-xs font-black text-cyan-400 hover:text-cyan-300 underline underline-offset-2"
                >
                  ¿No encontrás las pestañas Visual/Código? Guía completa →
                </Link>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-black text-white">
                  2. Copiá, pegá siguiendo la guía y comprobalo
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleCopy}
                    disabled={!pasteGuide}
                    className="btn-3d bg-cyan-600 border-cyan-800 border-b-4 hover:bg-cyan-500 text-white text-sm font-black px-4 py-2.5 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {copied
                      ? '✓ Copiado'
                      : pasteGuide
                        ? `📋 ${offer.copyLabel || payload.guide?.copyLabel || 'Copiar código'}`
                        : 'Primero elegí tu editor'}
                  </button>
                  <button
                    type="button"
                    onClick={handleVerifyFaq}
                    disabled={verifying || loading || !pasteGuide}
                    className="btn-3d bg-emerald-600 border-emerald-800 border-b-4 hover:bg-emerald-500 text-white text-sm font-black px-4 py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {verifying ? 'Verificando…' : 'Ya lo pegué (+40 XP)'}
                  </button>
                </div>
              </div>

              <details className="text-xs text-slate-500">
                <summary className="cursor-pointer font-black text-slate-400 hover:text-slate-300">
                  Ver código (solo si tu plataforma lo pide)
                </summary>
                <pre className="mt-2 p-3 rounded-lg bg-black/40 overflow-x-auto text-[10px] text-slate-400 max-h-40">
                  {offerCode}
                </pre>
              </details>
            </div>
          )}

          {/* Acciones al pie: siempre visibles */}
          <div className="flex flex-col sm:flex-row flex-wrap gap-2 pt-2 border-t border-slate-700/60">
            <button
              type="button"
              onClick={handleRecheck}
              disabled={loading || verifying}
              className="btn-3d bg-cyan-600 border-cyan-800 border-b-4 hover:bg-cyan-500 text-white text-sm font-black px-4 py-2.5 disabled:opacity-50"
            >
              {loading ? 'Comprobando…' : '🔄 Volver a comprobar'}
            </button>
            <button
              type="button"
              onClick={handleNewUrl}
              disabled={loading}
              className="btn-3d bg-slate-700 border-slate-800 border-b-4 hover:bg-slate-600 text-white text-sm font-black px-4 py-2.5 disabled:opacity-50"
            >
              ← Analizar otra URL
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
