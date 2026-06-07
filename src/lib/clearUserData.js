/** Claves de localStorage con datos de progreso o sitio del usuario. */
const SEOJUMP_USER_DATA_KEYS = [
  "seojump_xp",
  "seojump_site_url",
  "seojump_completed_missions",
  "seojump_completed_quick_wins",
  "seojump_completed_aeo",
  "seojump_missions",
  "seojump_quick_wins",
  "seojump_quick_wins_url",
  "seojump_aeo_opportunities",
  "seojump_aeo_opportunities_url",
  "gold-tu-busqueda",
  "gold-suggestions",
  "seojump_prestigio_cycles",
  "isPremium",
  "seojump_notifications",
];

/** Borra del navegador el progreso y datos de juego del usuario actual. */
export function clearLocalUserData() {
  for (const key of SEOJUMP_USER_DATA_KEYS) {
    try {
      localStorage.removeItem(key);
    } catch (_) {}
  }
}
