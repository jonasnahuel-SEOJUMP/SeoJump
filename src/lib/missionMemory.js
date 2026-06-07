/**
 * Memoria de misiones completadas — una sola fuente de verdad para local + Supabase.
 * Evita que reaparezcan misiones ya hechas y limita a 1 misión por página.
 */

export function normalizePagePath(urlOrPath) {
  if (!urlOrPath) return "/";
  let path = String(urlOrPath).trim();
  try {
    if (path.startsWith("http://") || path.startsWith("https://")) {
      path = new URL(path).pathname;
    }
  } catch (_) {}
  return path.replace(/\/+$/, "") || "/";
}

export function buildMissionId(type, pagePathOrUrl) {
  return `${String(type || "").toLowerCase()}-${normalizePagePath(pagePathOrUrl)}`;
}

export function loadLocalCompletedIds() {
  try {
    const parsed = JSON.parse(localStorage.getItem("seojump_completed_missions") || "[]");
    return Array.isArray(parsed) ? new Set(parsed) : new Set();
  } catch {
    return new Set();
  }
}

export function idsFromSupabaseMissions(missions) {
  const completedIds = new Set();
  const completedQuickWins = new Set();
  const completedAeo = new Set();
  let totalXp = 0;

  (missions || []).forEach((m) => {
    totalXp += m.xp_awarded || 0;
    if (m.mission_type === "QUICK_WIN") {
      completedQuickWins.add(m.target_url);
    } else if (m.mission_type === "AEO_OPP") {
      completedAeo.add(buildAeoKey(m.target_url, m.suggested_value || ""));
    } else {
      completedIds.add(buildMissionId(m.mission_type, m.target_url));
    }
  });

  return { completedIds, completedQuickWins, completedAeo, totalXp };
}

export function isMissionCompleted(completedSet, mission) {
  if (!completedSet || !mission) return false;
  if (mission.id && completedSet.has(mission.id)) return true;

  const type = (mission.type || "").toLowerCase();
  const pagePath = normalizePagePath(mission.pagePath || mission.page);
  if (!type || !pagePath) return false;

  const prefix = `${type}-${pagePath}`;
  for (const completedId of completedSet) {
    const dashIdx = completedId.indexOf("-");
    if (dashIdx === -1) continue;
    const completedType = completedId.substring(0, dashIdx);
    if (completedType !== type) continue;
    const completedRest = completedId.substring(dashIdx + 1);
    if (
      completedRest === pagePath ||
      completedRest.startsWith(`${pagePath}-`) ||
      completedId === prefix ||
      completedId.startsWith(`${prefix}-`)
    ) {
      return true;
    }
  }
  return false;
}

/** Si ya completaste cualquier misión en esta página, no mostrar más tareas ahí. */
export function isPageAlreadyWorked(completedSet, pagePathOrUrl) {
  const pagePath = normalizePagePath(pagePathOrUrl);
  for (const completedId of completedSet) {
    const dashIdx = completedId.indexOf("-");
    if (dashIdx === -1) continue;
    const completedRest = completedId.substring(dashIdx + 1);
    if (
      completedRest === pagePath ||
      completedRest.startsWith(`${pagePath}-`) ||
      normalizePagePath(completedRest) === pagePath
    ) {
      return true;
    }
  }
  return false;
}

/** Filtra misiones pendientes: sin repetir tipo, sin páginas ya trabajadas, 1 por página. */
export function filterPendingMissions(missions, completedSet) {
  const seenPages = new Set();
  const pending = [];

  for (const mission of missions || []) {
    if (isMissionCompleted(completedSet, mission)) continue;
    const pagePath = normalizePagePath(mission.pagePath || mission.page);
    if (isPageAlreadyWorked(completedSet, pagePath)) continue;
    if (seenPages.has(pagePath)) continue;
    seenPages.add(pagePath);
    pending.push(mission);
  }

  return pending;
}

/** Clave estable para oportunidades AEO: URL normalizada + heading exacto. */
export function buildAeoKey(pageUrl, heading) {
  const url = normalizePagePath(pageUrl).toLowerCase();
  const h = String(heading || "").trim();
  return `${url}::${h}`;
}

export function isAeoCompleted(completedSet, pageUrl, heading) {
  if (!completedSet) return false;
  const key = buildAeoKey(pageUrl, heading);
  if (completedSet.has(key)) return true;
  // Compatibilidad con claves viejas (URL completa sin normalizar)
  const legacy = `${String(pageUrl || "").replace(/\/$/, "")}::${String(heading || "").trim()}`;
  return completedSet.has(legacy);
}

export function completedPagePathsFromSet(completedSet) {
  const paths = new Set();
  for (const completedId of completedSet || []) {
    const dashIdx = completedId.indexOf("-");
    if (dashIdx === -1) continue;
    paths.add(normalizePagePath(completedId.substring(dashIdx + 1)));
  }
  return paths;
}
