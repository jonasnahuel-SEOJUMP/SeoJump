/**
 * Lógica pura para detectar y redactar victorias SEO (antes/después GSC).
 */

export const SEO_WIN_MIN_DAYS = 7;
export const SEO_WIN_POSITION_DELTA = 1.5;
export const SEO_WIN_CLICKS_GROWTH = 0.15;
export const SEO_WIN_MIN_CLICKS_DELTA = 2;

export function formatShortPage(url) {
  if (!url) return 'tu página';
  try {
    const path = new URL(url).pathname.replace(/\/$/, '') || '/';
    if (path === '/') return 'Inicio';
    const last = path.split('/').filter(Boolean).pop() || path;
    return last.length > 40 ? `${last.slice(0, 37)}…` : last.replace(/-/g, ' ');
  } catch {
    return String(url).replace(/https?:\/\//, '').slice(0, 40);
  }
}

export function formatMissionDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
  } catch {
    return '';
  }
}

/** ¿Hay mejora clara vs baseline? Devuelve tipo o null. */
export function detectSeoWin(baseline, current) {
  if (!baseline || !current) return null;

  const basePos = baseline.position;
  const curPos = current.position;
  const baseClicks = baseline.clicks ?? 0;
  const curClicks = current.clicks ?? 0;

  if (typeof basePos === 'number' && basePos > 0 && typeof curPos === 'number' && curPos > 0) {
    const delta = basePos - curPos;
    if (delta >= SEO_WIN_POSITION_DELTA) {
      return {
        kind: 'position',
        deltaPositions: Math.round(delta),
        baselinePosition: basePos,
        currentPosition: curPos,
        baselineClicks: baseClicks,
        currentClicks: curClicks,
      };
    }
  }

  if (baseClicks >= 3) {
    const minClicks = Math.ceil(baseClicks * (1 + SEO_WIN_CLICKS_GROWTH));
    if (curClicks >= minClicks && curClicks - baseClicks >= SEO_WIN_MIN_CLICKS_DELTA) {
      return {
        kind: 'clicks',
        deltaPositions: null,
        baselinePosition: basePos ?? null,
        currentPosition: curPos ?? null,
        baselineClicks: baseClicks,
        currentClicks: curClicks,
        clicksPct: Math.round(((curClicks - baseClicks) / baseClicks) * 100),
      };
    }
  }

  return null;
}

export function buildSeoWinMessage(mission, win) {
  const page = formatShortPage(mission.target_url);
  const kw = mission.gold_keyword || 'tu búsqueda';
  const when = formatMissionDate(mission.completed_at);

  if (win.kind === 'position') {
    return `Buenas noticias: «${kw}» en ${page} pasó de posición ${Math.round(win.baselinePosition)} a ${Math.round(win.currentPosition)} en Google. Coincide con la misión que completaste el ${when}.`;
  }

  return `Los clics de «${kw}» en ${page} subieron ~${win.clicksPct}% (de ${win.baselineClicks} a ${win.currentClicks}) desde la misión del ${when}. Google sigue procesando cambios — esto es una señal positiva.`;
}
