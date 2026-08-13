/**
 * Destino del Espía desde query params de /comenzar.
 * No usa la URL del rival como redirect (anti open-redirect): solo como query
 * `url` hacia una ruta interna fija.
 */
export function spyDestFromParams(searchParams: { get: (key: string) => string | null }): string {
  const base = "/detective-de-enlaces?view=spy";
  const raw = (searchParams.get("url") || "").trim();
  if (!raw || raw.length > 500) return base;
  return `${base}&url=${encodeURIComponent(raw)}`;
}
