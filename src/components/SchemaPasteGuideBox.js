'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  SCHEMA_INSTALL_METHODS,
  SCHEMA_PASTE_BLOG_HREF,
  getSchemaPasteGuide,
  getStoredSchemaInstallMethod,
  setStoredSchemaInstallMethod,
  getMethodLabel,
  isLikelyCategoryUrl,
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

/**
 * Cajita reutilizable: pestañas de editor + pasos para pegar Schema.
 * Usada en Mapa de comprensión y en Espía de la Competencia.
 */
export default function SchemaPasteGuideBox({
  playClick,
  /** Si se pasa, el componente es controlado (p. ej. Mapa de comprensión). */
  method,
  suggestedEditor = null,
  editorConflictMsg = null,
  onConflictClear,
  onMethodChange,
  heading = '¿Con qué editor modificás esta página?',
  showBlogLink = true,
  /** URL de la página propia (para sugerir pestaña Categoría Woo). */
  pageUrl = '',
}) {
  const isControlled = typeof method === 'string';
  const [internalMethod, setInternalMethod] = useState('');
  const categoryPage = isLikelyCategoryUrl(pageUrl);

  useEffect(() => {
    if (!isControlled) {
      const stored = getStoredSchemaInstallMethod();
      // En categorías, priorizamos la guía correcta (Wordfence) sobre un stored viejo.
      if (categoryPage && (!stored || stored.startsWith('wp_'))) {
        setInternalMethod(stored === 'wp_category' ? stored : 'wp_category');
      } else {
        setInternalMethod(stored);
      }
    }
  }, [isControlled, categoryPage]);

  const installMethod = isControlled ? method : internalMethod;
  const effectiveSuggested = suggestedEditor || (categoryPage ? 'wp_category' : null);

  const selectInstallMethod = (methodId) => {
    if (!methodId) return;
    // Modo controlado: el padre maneja estado, storage y sonido.
    if (isControlled) {
      if (onMethodChange) onMethodChange(methodId);
      return;
    }
    setInternalMethod(methodId);
    setStoredSchemaInstallMethod(methodId);
    if (onConflictClear) onConflictClear();
    if (onMethodChange) onMethodChange(methodId);
    if (playClick) playClick();
  };

  const pasteGuide = getSchemaPasteGuide(installMethod);
  const wpMethods = SCHEMA_INSTALL_METHODS.filter((m) => m.group === 'wp');
  const otherMethods = SCHEMA_INSTALL_METHODS.filter((m) => m.group === 'other');

  return (
    <div className="rounded-xl border-2 border-cyan-500/30 bg-slate-950/50 p-4 space-y-4">
      <div>
        <p className="text-sm font-black text-white block mb-1">{heading}</p>
        <p className="text-xs font-bold text-slate-400 leading-relaxed mb-3">
          Tocá la pestaña correcta. La home suele usar bloques o un maquetador; un producto a veces
          usa el editor clásico; una <strong className="text-slate-300">categoría</strong> no se
          edita igual que un producto.
        </p>

        {categoryPage && (
          <div className="rounded-lg border border-amber-500/50 bg-amber-950/40 p-3 mb-3">
            <p className="text-xs font-bold text-amber-100 leading-relaxed">
              ⚠️ Detectamos que es una <strong>categoría</strong>. No pegues el código en
              Productos → Categorías → Descripción: Wordfence u otros firewalls suelen
              bloquearlo (error 403). Usá la pestaña <strong>Categoría</strong> abajo.
            </p>
          </div>
        )}

        <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">
          WordPress
        </p>
        <div className="flex flex-wrap gap-2 mb-3" role="tablist" aria-label="Editor WordPress">
          {wpMethods.map((method) => {
            const active = installMethod === method.id;
            const isSuggested = effectiveSuggested === method.id;
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
            const isSuggested = effectiveSuggested === method.id;
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
          <p className="text-xs font-bold text-amber-200 leading-relaxed">⚠️ {editorConflictMsg}</p>
          {effectiveSuggested && (
            <button
              type="button"
              onClick={() => selectInstallMethod(effectiveSuggested)}
              className="text-xs font-black text-cyan-300 underline underline-offset-2 hover:text-cyan-200"
            >
              Usar {getMethodLabel(effectiveSuggested)}
            </button>
          )}
        </div>
      )}

      {!pasteGuide && !editorConflictMsg && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-950/30 p-3">
          <p className="text-xs font-bold text-amber-200">
            Elegí una pestaña arriba. SEO Jump te va a indicar exactamente dónde entrar, qué botón
            tocar y dónde pegar el código.
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

      {showBlogLink && (
        <Link
          href={SCHEMA_PASTE_BLOG_HREF}
          onClick={() => {
            if (playClick) playClick();
          }}
          className="inline-block text-xs font-black text-cyan-400 hover:text-cyan-300 underline underline-offset-2"
        >
          ¿No encontrás las pestañas Visual/Código? Guía completa →
        </Link>
      )}
    </div>
  );
}
