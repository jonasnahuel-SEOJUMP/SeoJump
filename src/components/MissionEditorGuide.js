"use client";

import { useState } from "react";
import {
  getPlainMissionLabels,
  getEditWhereGuide,
  buildSuggestedText,
  getCurrentValueFromPreview,
  detectPageType,
  buildDesignerInstructions,
} from "../lib/cmsGuide";

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

  if (!mission) return null;

  const labels = getPlainMissionLabels(mission.type);
  const pageType = detectPageType(mission.page);
  const guide = getEditWhereGuide(mission.page, mission.type, platformId);
  const kw = (mission.keyword || goldKeyword || '').trim();
  const suggested = buildSuggestedText(mission.type, kw, mission.page, siteUrl);
  const current = getCurrentValueFromPreview(mission.type, pagePreview);
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
          {kw && (
            <span className="text-xs font-black px-2 py-1 rounded-md bg-amber-900/50 text-amber-200 border border-amber-700/50">
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-red-950/30 border border-red-800/50 space-y-2">
              <p className="text-xs font-black text-red-400 uppercase">{beforeLabel}</p>
              <p className="text-sm font-bold text-slate-200 leading-snug break-words whitespace-pre-wrap">
                {current || beforeEmpty}
              </p>
            </div>
            <div className="p-4 rounded-xl bg-green-950/30 border border-green-700/50 space-y-2">
              <p className="text-xs font-black text-duo-green uppercase">
                {isAeo ? 'Ejemplo para copiar y adaptar' : 'Sugerencia SEO Jump'}
              </p>
              <p className="text-sm font-bold text-white leading-snug break-words whitespace-pre-wrap">{suggested}</p>
              <CopyButton text={suggested} label="📋 Copiar sugerencia" playClick={playClick} variant="green" />
            </div>
          </div>
        )}
      </div>

      {/* ¿Dónde edito? (paquete 2) */}
      <div className="card-3d overflow-hidden border-2 border-amber-500/40">
        <button
          type="button"
          onClick={() => {
            if (playClick) playClick();
            setWhereOpen(!whereOpen);
          }}
          className="w-full flex items-center justify-between p-5 bg-amber-950/40 hover:bg-amber-950/60 transition-colors"
        >
          <span className="text-lg md:text-xl font-black text-amber-200 flex items-center gap-2">
            🗺️ ¿Dónde edito esto en {guide.platformLabel}?
          </span>
          <span className="text-2xl text-amber-400">{whereOpen ? '−' : '+'}</span>
        </button>

        {whereOpen && (
          <div className="p-5 md:p-6 bg-slate-900 space-y-4 border-t border-amber-800/30">
            {guide.adminHint && (
              <p className="text-sm font-bold text-amber-300/90 bg-slate-800 rounded-lg px-3 py-2">
                Panel: {guide.adminHint}
              </p>
            )}
            <p className="text-sm font-bold text-slate-400">
              Campo a tocar: <span className="text-white">{guide.fieldLabel}</span>
            </p>
            <ol className="space-y-3">
              {guide.steps.map((step, idx) => (
                <li key={idx} className="flex gap-3 items-start">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-amber-500 text-slate-900 text-sm font-black flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <span
                    className="text-slate-200 text-sm md:text-base font-bold leading-snug"
                    dangerouslySetInnerHTML={{
                      __html: step.replace(/\*\*(.*?)\*\*/g, '<strong class="text-amber-200">$1</strong>'),
                    }}
                  />
                </li>
              ))}
            </ol>
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
