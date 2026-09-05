/**
 * Fuente de verdad única: ¿esta URL es la raíz del dominio (home)?
 *
 * Usada por linkAudit.isHomePage, comprehension.resolvePageType,
 * scrapeMetadata y el Espía. No depende de otros módulos de dominio
 * para evitar ciclos (scraping ↔ comprehension ↔ linkAudit).
 */

/** True si el path es "/" o vacío (sin segmentos). Ej: https://ejemplo.com y https://ejemplo.com/ */
export function isRootHomeUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`);
    return u.pathname.replace(/\/+$/, '') === '';
  } catch {
    return false;
  }
}
