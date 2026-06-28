/** Agrega notificaciones SEO a la campana (localStorage). */

export function pushSeoWinNotifications(wins) {
  if (typeof window === 'undefined' || !wins?.length) return 0;

  let existing = [];
  try {
    existing = JSON.parse(localStorage.getItem('seojump_notifications') || '[]');
    if (!Array.isArray(existing)) existing = [];
  } catch {
    existing = [];
  }

  const knownIds = new Set(existing.map((n) => n.id));
  let added = 0;
  const now = new Date().toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  for (const win of wins) {
    const id = `seo-win-${win.missionId}`;
    if (knownIds.has(id)) continue;
    existing.unshift({
      id,
      type: 'seo_win',
      text: win.message,
      date: now,
      read: false,
    });
    knownIds.add(id);
    added++;
  }

  if (added > 0) {
    localStorage.setItem('seojump_notifications', JSON.stringify(existing.slice(0, 30)));
    window.dispatchEvent(new Event('seojump_notifications_updated'));
  }

  return added;
}

/** Evita llamar al servidor más de una vez cada 24 h. */
export function shouldCheckSeoWins() {
  if (typeof window === 'undefined') return false;
  try {
    const last = localStorage.getItem('seojump_seo_wins_last_check');
    if (!last) return true;
    const elapsed = Date.now() - parseInt(last, 10);
    return elapsed > 24 * 60 * 60 * 1000;
  } catch {
    return true;
  }
}

export function markSeoWinsChecked() {
  try {
    localStorage.setItem('seojump_seo_wins_last_check', String(Date.now()));
  } catch {
    /* ignore */
  }
}
