/**
 * keywordUtils.js — Helpers para validar la "palabra clave de oro".
 *
 * Evita que una URL termine guardada como palabra clave activa
 * (ej: el usuario pega el link de su producto en el campo de keyword),
 * lo que rompe la auditoría de Fase 2 y ensucia los prompts de IA.
 */

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
