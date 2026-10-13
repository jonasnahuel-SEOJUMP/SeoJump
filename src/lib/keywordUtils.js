/**
 * keywordUtils.js — Helpers para validar la "palabra clave de oro"
 * y detectar misiones de título ya cumplidas (keyword ya en title/H1/slug).
 *
 * Evita que una URL termine guardada como palabra clave activa
 * (ej: el usuario pega el link de su producto en el campo de keyword),
 * lo que rompe la auditoría de Fase 2 y ensucia los prompts de IA.
 */

import { decodeHtmlEntities } from './textUtils';

export function isUrlLikeKeyword(text) {
  if (!text) return false;
  const t = String(text).trim().toLowerCase();
  if (!t) return false;
  // Esquema explícito o www.
  if (/^https?:\/\//.test(t) || t.startsWith('www.')) return true;
  // Dominio pelado sin espacios: "miweb.com.ar/producto/algo" o "miweb.com"
  if (!t.includes(' ') && /^[a-z0-9-]+(\.[a-z0-9-]+)+(\/|$)/.test(t)) return true;
  return false;
}

/**
 * Devuelve la keyword si es válida, o "" si parece una URL.
 * Usar al leer la keyword guardada (localStorage / servidor).
 */
export function cleanStoredKeyword(text) {
  const t = (text || '').trim();
  if (!t || isUrlLikeKeyword(t)) return '';
  return t;
}

const COMPARE_STOPWORDS = new Set([
  'de', 'la', 'el', 'los', 'las', 'y', 'o', 'u', 'para', 'con', 'en', 'a',
  'del', 'un', 'una', 'unos', 'unas', 'por', 'su', 'sus', 'al', 'que', 'tu',
]);

/** Minúsculas, sin tildes, sin signos. */
export function normalizeKeywordText(text) {
  return decodeHtmlEntities(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Plural→singular aproximado (es), suficiente para deduplicar misiones. */
export function singularizeKeywordToken(word) {
  const w = String(word || '');
  if (w.length > 4 && w.endsWith('es') && !w.endsWith('les')) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('s')) return w.slice(0, -1);
  return w;
}

/** Tokens significativos de una keyword o título. */
export function significantKeywordTokens(text) {
  return normalizeKeywordText(text)
    .split(' ')
    .filter((w) => w.length >= 3 && !COMPARE_STOPWORDS.has(w))
    .map(singularizeKeywordToken)
    .filter(Boolean);
}

/** Texto legible del último segmento de la URL (slug). */
export function slugTextFromUrl(pageUrl) {
  if (!pageUrl) return '';
  try {
    const path = new URL(
      pageUrl.startsWith('http') ? pageUrl : `https://${pageUrl}`
    ).pathname;
    const last = path.replace(/\/+$/, '').split('/').filter(Boolean).pop() || '';
    return decodeURIComponent(last).replace(/[-_]+/g, ' ').trim();
  } catch {
    return String(pageUrl)
      .split('/')
      .filter(Boolean)
      .pop()
      ?.replace(/[-_]+/g, ' ')
      .trim() || '';
  }
}

/**
 * ¿La keyword X ya está cubierta en title, H1 o slug?
 * Normaliza tildes/mayúsculas y compara por tokens en singular.
 * Umbral: ≥60% de tokens de la keyword presentes (mín. 1 si hay 1 token).
 *
 * Usar ANTES de generar una misión «incluí X en el título».
 */
export function keywordAlreadyPresent(
  keyword,
  { title, h1, description, slugOrUrl } = {}
) {
  const kwTokens = significantKeywordTokens(keyword);
  if (kwTokens.length === 0) return false;

  const slugText =
    typeof slugOrUrl === 'string' && (slugOrUrl.includes('/') || slugOrUrl.includes('.'))
      ? slugTextFromUrl(slugOrUrl)
      : String(slugOrUrl || '');

  const haystackTokens = new Set([
    ...significantKeywordTokens(title || ''),
    ...significantKeywordTokens(h1 || ''),
    ...significantKeywordTokens(description || ''),
    ...significantKeywordTokens(slugText),
  ]);

  if (haystackTokens.size === 0) return false;

  const present = kwTokens.filter((t) => haystackTokens.has(t)).length;
  const ratio = present / kwTokens.length;
  return ratio >= 0.6;
}
