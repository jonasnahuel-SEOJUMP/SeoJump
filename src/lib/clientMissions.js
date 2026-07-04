/**
 * Carga y refresco de misiones desde Search Console (cliente).
 * Evita quedarse con listas viejas en localStorage.
 */

import { getRealMissions, fetchCompletedMissions, markMissionComplete } from "./actions";
import {
  loadLocalCompletedIds,
  idsFromSupabaseMissions,
  filterPendingMissions,
  filterHomeMissions,
} from "./missionMemory";

const PENDING_COMPLETIONS_KEY = "seojump_pending_completions";

function loadPendingCompletions() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PENDING_COMPLETIONS_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function savePendingCompletions(list) {
  try {
    // Conservar como máximo las últimas 100 para no crecer sin límite.
    localStorage.setItem(PENDING_COMPLETIONS_KEY, JSON.stringify(list.slice(-100)));
  } catch {
    /* ignore */
  }
}

function enqueuePendingCompletion(entry) {
  const list = loadPendingCompletions();
  const key = `${entry.missionType}|${entry.targetUrl}`;
  if (!list.some((e) => `${e.missionType}|${e.targetUrl}` === key)) {
    list.push(entry);
    savePendingCompletions(list);
  }
}

/**
 * Marca una misión como completada garantizando la persistencia:
 * si Supabase falla (conexión, tipo rechazado, etc.), guarda la completación
 * en una cola local y la reintenta en cada carga hasta lograrlo. Así una misión
 * ya hecha nunca vuelve a aparecer de forma permanente por un fallo transitorio.
 */
export async function markMissionCompleteReliable(missionType, targetUrl, xp = 0, suggestedValue, baseline) {
  const entry = {
    missionType,
    targetUrl,
    xp,
    suggestedValue: suggestedValue ?? null,
    baseline: baseline ?? null,
  };
  try {
    const r = await markMissionComplete(missionType, targetUrl, xp, suggestedValue, baseline);
    if (!r?.success) enqueuePendingCompletion(entry);
    return r;
  } catch {
    enqueuePendingCompletion(entry);
    return { success: false };
  }
}

/** Reintenta guardar en Supabase las completaciones que quedaron pendientes. */
export async function flushPendingCompletions() {
  const list = loadPendingCompletions();
  if (!list.length) return;
  const remaining = [];
  for (const entry of list) {
    try {
      const r = await markMissionComplete(
        entry.missionType,
        entry.targetUrl,
        entry.xp || 0,
        entry.suggestedValue || undefined,
        entry.baseline || undefined
      );
      if (!r?.success) remaining.push(entry);
    } catch {
      remaining.push(entry);
    }
  }
  savePendingCompletions(remaining);
}

export async function refreshMissionsFromGsc(siteUrl, goldKeyword, goal) {
  // Antes de recalcular pendientes, reintentar guardar lo que no se pudo persistir.
  await flushPendingCompletions();

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
