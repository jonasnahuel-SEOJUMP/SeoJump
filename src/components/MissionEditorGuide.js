"use client";

import { useState, useEffect } from "react";
import {
  getPlainMissionLabels,
  getEditWhereGuide,
  buildSuggestedText,
  getCurrentValueFromPreview,
  detectPageType,
  buildDesignerInstructions,
} from "../lib/cmsGuide";
import { isMissionChangeFullyApplied, getMissionSuggestionAddon } from "../lib/textUtils";
import { getSmartMissionSuggestion } from "../lib/actions";
import WpApplyButton from "./WpApplyButton";
import MissionWarning from "./MissionWarning";

function CopyButton({ text, label, playClick, variant = "green", className = "" }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e) => {
    e?.stopPropagation?.();
    if (playClick) playClick();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const variantClass =
    copied || variant === "green"
      ? "btn-green"
      : variant === "amber"
        ? "btn-yellow"
        : "btn-blue";

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`btn-3d ${variantClass} !py-2.5 !px-5 !text-sm !normal-case !tracking-normal w-full sm:w-auto ${className}`}
    >
      {copied ? "✓ Copiado" : label}
    </button>
  );
}

export default function MissionEditorGuide({
  mission,
  siteUrl,
  platformId,
  goldKeyword,
  pagePreview,
  previewLoading,
  playClick,
}) {
  const [whereOpen, setWhereOpen] = useState(true);

  // Sugerencia inteligente generada por IA (cerebro principal).
  const [aiSuggestion, setAiSuggestion] = useState(null);
  const [aiReason, setAiReason] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const missionId = mission?.id;
  const missionType = mission?.type;
  const missionPage = mission?.page;
  const kwForAi = (mission?.keyword || goldKeyword || '').trim();
  const currentForAi = mission ? getCurrentValueFromPreview(mission.type, pagePreview) : '';

  useEffect(() => {
    let cancelled = false;
    let loadingTimeoutId = null;

    setAiSuggestion(null);
    setAiReason('');

    if (!missionPage) {
      setAiLoading(false);
      return;
    }
    // La IA solo aplica a título (H1) y meta. Para AEO usamos la plantilla guía.
    if (missionType !== 'H1' && missionType !== 'META') {
      setAiLoading(false);
      return;
    }
    // Esperar a tener el texto en vivo para darle contexto real a la IA.
    if (previewLoading) {
      setAiLoading(false);
      return;
    }

    // Contexto declarado por el dueño (persistido en el navegador).
    let declaredGoal = '';
    let declaredBrands = '';
    try {
      declaredGoal = localStorage.getItem('seojump_goal') || '';
      declaredBrands = localStorage.getItem('seojump_brands') || '';
    } catch (e) { /* sin localStorage: la IA decide con el resto del contexto */ }

    setAiLoading(true);
    // Si la IA tarda demasiado, mostramos la plantilla de respaldo sin quedar colgados.
    loadingTimeoutId = setTimeout(() => {
      setAiLoading(false);
    }, 35000);

    getSmartMissionSuggestion({
      pageUrl: missionPage,
      missionType,
      keyword: kwForAi,
      currentValue: currentForAi || '',
      siteUrl,
      // Contenido real de la página (qué vende) — ya lo tenemos del scraper en vivo.
      pageTitle: pagePreview?.title || '',
      pageH1: pagePreview?.h1 || '',
      pageDescription: pagePreview?.description || '',
      pageType: pagePreview?.pageType || '',
      // Métricas de Search Console — cómo le va hoy a esta página.
      position: mission?.position,
      impressions: mission?.impressions,
      clicks: mission?.clicks,
      ctr: mission?.ctr,
      // Objetivo y marcas declaradas por el dueño.
      goal: declaredGoal,
      brands: declaredBrands,
    })
      .then((res) => {
        if (cancelled) return;
        if (res?.success && res.suggestedTitle && res.fromAi !== false) {
          setAiSuggestion(res.suggestedTitle);
          setAiReason(res.reason || '');
        }
      })
      .catch(() => { /* silencioso: queda la plantilla */ })
      .finally(() => {
        if (loadingTimeoutId) clearTimeout(loadingTimeoutId);
        setAiLoading(false);
      });

    return () => {
      cancelled = true;
      if (loadingTimeoutId) clearTimeout(loadingTimeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missionId, missionType, missionPage, previewLoading]);

  if (!mission) return null;

  const pageType = detectPageType(mission.page, pagePreview?.pageType);
  const labels = getPlainMissionLabels(mission.type, pageType.id);
  const guide = getEditWhereGuide(mission.page, mission.type, platformId, pagePreview?.pageType);
  const kw = (mission.keyword || goldKeyword || '').trim();
  const current = getCurrentValueFromPreview(mission.type, pagePreview);

  // Plantilla determinística — red de seguridad si la IA no responde.
  const templateSuggested = buildSuggestedText(mission.type, kw, mission.page, siteUrl, pagePreview);

  // Lo que se muestra: IA si está disponible, plantilla como respaldo.
  const suggested = aiSuggestion || templateSuggested;
  const alreadyApplied = !previewLoading && current && isMissionChangeFullyApplied(current, suggested);
  const suggestionAddon = !previewLoading && current && !alreadyApplied
    ? getMissionSuggestionAddon(current, suggested)
    : null;
  const isAeo = mission.type === 'AEO';
  const beforeLabel = isAeo ? '¿Tenés preguntas y respuestas?' : 'Ahora Google ve';
  const beforeEmpty = isAeo
    ? '(Todavía no hay un bloque de preguntas y respuestas — hay que agregarlo al final de la página)'
    : '(No detectamos texto — puede que el título esté en el constructor visual)';
  const designerText = buildDesignerInstructions(
    mission,
    platformId,
    siteUrl,
    suggested,
    pagePreview
  );

  return (
    <div className="space-y-4 w-full min-w-0">
      {/* Encabezado claro */}
      <div className="card-3d p-5 md:p-6 bg-gradient-to-br from-duo-green/10 to-slate-900 border-2 border-duo-green/40 space-y-2">
        <p className="text-xs font-black text-duo-green uppercase tracking-wider">Tu tarea</p>
        <h3 className="text-xl md:text-2xl font-black text-white leading-tight">
          {labels.action}
        </h3>
        <div className="flex flex-wrap gap-2 pt-1">
          <span className={`text-xs font-black px-2 py-1 rounded-md ${pageType.badgeColor}`}>
            {pageType.label}
          </span>
          {pageType.id === 'category' && (
            <span className="text-xs font-black px-2 py-1 rounded-md bg-purple-500/20 text-purple-200 border border-purple-400/40">
              No es un producto — es una sección del catálogo
            </span>
          )}
          {pageType.id === 'product' && (
            <span className="text-xs font-black px-2 py-1 rounded-md bg-blue-500/20 text-sky-200 border border-blue-400/40">
              Ficha de un producto puntual
            </span>
          )}
          {kw && (
            <span className="text-xs font-black px-2 py-1 rounded-md bg-duo-blue/20 text-sky-200 border border-duo-blue/40">
              Incluí: «{kw}»
            </span>
          )}
        </div>
      </div>

      {/* Antes → Después (paquete 3) */}
      <div className="card-3d p-5 md:p-6 bg-slate-900 border-2 border-slate-700 space-y-4">
        <p className="text-xs font-black text-slate-400 uppercase tracking-wider">
          📊 Antes y después
        </p>

        {previewLoading ? (
          <p className="text-slate-400 font-bold animate-pulse">Leyendo tu página en vivo...</p>
        ) : (
          <>
          {alreadyApplied && (
            <div className="p-4 rounded-xl bg-duo-green/15 border border-duo-green/40 flex gap-3 items-start">
              <span className="text-xl">✅</span>
              <p className="text-sm font-bold text-duo-green leading-snug">
                Detectamos que tu web ya tiene este cambio aplicado. Pegá el texto en el campo de abajo y tocá <strong>Verificar</strong> para guardar el progreso.
              </p>
            </div>
          )}
          {!alreadyApplied && suggestionAddon && (
            <div className="p-4 rounded-xl bg-sky-500/10 border border-sky-500/40 flex gap-3 items-start">
              <span className="text-xl">💡</span>
              <p className="text-sm font-bold text-sky-200 leading-snug">
                Tu título ya incluye lo principal. SEO Jump sugiere sumar: <strong>«{suggestionAddon}»</strong>. Copiá la sugerencia completa, aplicala y tocá <strong>Verificar</strong>.
              </p>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-red-950/30 border border-red-800/50 space-y-2">
              <p className="text-xs font-black text-red-400 uppercase">{beforeLabel}</p>
              <p className="text-sm font-bold text-slate-200 leading-snug break-words whitespace-pre-wrap">
                {current || beforeEmpty}
              </p>
            </div>
            <div className="p-4 rounded-xl bg-green-950/30 border border-green-700/50 space-y-2">
              <p className="text-xs font-black text-duo-green uppercase flex items-center gap-2 flex-wrap">
                {isAeo ? 'Ejemplo para copiar y adaptar' : 'Sugerencia SEO Jump'}
                {aiSuggestion && (
                  <span className="px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 text-[10px] font-black border border-sky-500/40">
                    ✨ Generada con IA
                  </span>
                )}
              </p>
              {aiLoading && !aiSuggestion ? (
                <p className="text-sm font-bold text-sky-300 leading-snug animate-pulse">
                  ✨ La IA está analizando tu página para darte el mejor título…
                </p>
              ) : (
                <>
                  <p className="text-sm font-bold text-white leading-snug break-words whitespace-pre-wrap">{suggested}</p>
                  {aiReason && (
                    <p className="text-xs text-sky-200/80 leading-snug italic">💡 {aiReason}</p>
                  )}
                  {!aiSuggestion && !aiLoading && (
                    <p className="text-[11px] text-slate-400 leading-snug">
                      Sugerencia automática — si la IA de Google está conectada verás el sello «Generada con IA» arriba.
                    </p>
                  )}
                  {(missionType === "H1" || mission?.type === "H1") && (
                    <MissionWarning type="h1-change" />
                  )}
                  <div className="flex flex-col sm:flex-row flex-wrap gap-2 items-stretch sm:items-start">
                    <CopyButton text={suggested} label="📋 Copiar sugerencia" playClick={playClick} variant="green" />
                    {!isAeo && (
                      <WpApplyButton
                        missionType={missionType}
                        pageUrl={missionPage}
                        value={suggested}
                        playClick={playClick}
                      />
                    )}
                  </div>
                  {pageType.id === 'home' && (
                    <p className="text-[11px] text-emerald-200/80 leading-snug">
                      Esta es la portada: el título debe hablar de todo el negocio, no de un solo producto.
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
          </>
        )}
      </div>

      {/* ¿Dónde edito? (paquete 2) */}
      <div className="card-3d overflow-hidden border-2 border-slate-600/60">
        <button
          type="button"
          onClick={() => {
            if (playClick) playClick();
            setWhereOpen(!whereOpen);
          }}
          className="w-full flex items-center justify-between p-5 bg-slate-800/80 hover:bg-slate-800 transition-colors"
        >
          <span className="text-lg md:text-xl font-black text-slate-200 flex items-center gap-2">
            🗺️ ¿Dónde edito esto en {guide.platformLabel}?
          </span>
          <span className="text-2xl text-duo-blue">{whereOpen ? '−' : '+'}</span>
        </button>

        {whereOpen && (
          <div className="p-5 md:p-6 bg-slate-900 space-y-4 border-t border-slate-700/50">
            {guide.adminHint && (
              <p className="text-sm font-bold text-sky-300/90 bg-slate-800 rounded-lg px-3 py-2">
                Panel: {guide.adminHint}
              </p>
            )}
            {guide.scrollHint && (
              <p className="text-sm font-bold text-amber-200 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
                👇 {guide.scrollHint}
              </p>
            )}
            <p className="text-sm font-bold text-slate-400">
              Campo exacto a tocar: <span className="text-white">{guide.fieldLabel}</span>
            </p>
            <ol className="space-y-3">
              {guide.steps.map((step, idx) => (
                <li key={idx} className="flex gap-3 items-start">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-duo-blue text-white text-sm font-black flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <span
                    className="text-slate-200 text-sm md:text-base font-bold leading-snug"
                    dangerouslySetInnerHTML={{
                      __html: step.replace(/\*\*(.*?)\*\*/g, '<strong class="text-sky-200">$1</strong>'),
                    }}
                  />
                </li>
              ))}
            </ol>
            {guide.commonMistakes?.length > 0 && (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2">
                <p className="text-xs font-black text-amber-300 uppercase">Errores comunes</p>
                <ul className="space-y-1.5">
                  {guide.commonMistakes.map((tip, idx) => (
                    <li key={idx} className="text-sm font-bold text-amber-100/90 leading-snug flex gap-2">
                      <span className="flex-shrink-0">⚠️</span>
                      <span
                        dangerouslySetInnerHTML={{
                          __html: tip.replace(/\*\*(.*?)\*\*/g, '<strong class="text-amber-200">$1</strong>'),
                        }}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex flex-wrap gap-3 pt-2">
              {mission.page && (
                <a
                  href={mission.page}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => playClick && playClick()}
                  className="btn-3d btn-blue !py-2.5 !px-5 !text-sm !normal-case !tracking-normal"
                >
                  👁️ Ver página pública
                </a>
              )}
              <CopyButton
                text={designerText}
                label="📨 Copiar para mi diseñador"
                playClick={playClick}
                variant="amber"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
