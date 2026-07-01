/**
 * Carga y refresco de misiones desde Search Console (cliente).
 * Evita quedarse con listas viejas en localStorage.
 */

import { getRealMissions, fetchCompletedMissions } from "./actions";
import {
  loadLocalCompletedIds,
  idsFromSupabaseMissions,
  filterPendingMissions,
  filterHomeMissions,
} from "./missionMemory";

export async function refreshMissionsFromGsc(siteUrl, goldKeyword, goal) {
  if (!siteUrl?.trim()) {
    return { pending: [], source: null, completedSet: loadLocalCompletedIds() };
  }

  let completedSet = loadLocalCompletedIds();
  try {
    const cw = await fetchCompletedMissions();
    if (cw.success && cw.missions?.length) {
      const { completedIds: fromDb } = idsFromSupabaseMissions(cw.missions);
      completedSet = new Set([...completedSet, ...fromDb]);
    }
  } catch {
    /* seguir con local */
  }

  const res = await getRealMissions(
    siteUrl.trim(),
    goldKeyword?.trim() || undefined,
    goal || undefined
  );

  if (!res.success) {
    throw new Error(res.error || "Error al cargar misiones");
  }

  const pending = filterPendingMissions(
    filterHomeMissions(res.data || []),
    completedSet
  );

  try {
    localStorage.setItem("seojump_site_url", siteUrl.trim());
    if (pending.length > 0) {
      localStorage.setItem("seojump_missions", JSON.stringify(pending));
    } else {
      localStorage.removeItem("seojump_missions");
    }
    localStorage.setItem("seojump_missions_fetched_at", String(Date.now()));
  } catch {
    /* ignore */
  }

  return { pending, source: res.source, completedSet };
}
