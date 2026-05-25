/**
 * progression.js - Helper to compute SEO game phase progression, prestigie cycles, and sync state.
 */

export function getPhaseProgress(completedMissionsSet, suggestions, rawMissions, activeKeyword, siteUrl) {
  // 1. Phase 1 Progress (Buscador de oro)
  // We have suggestions (up to 10). If none, default total is 10.
  const p1Total = suggestions && suggestions.length > 0 ? suggestions.length : 10;
  let p1Completed = 0;
  if (suggestions && suggestions.length > 0) {
    suggestions.forEach(s => {
      const cleanKeyword = (s.text || "").replace(/\$/g, '').replace(/^[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ]+/g, '').trim();
      if (completedMissionsSet.has(`gold-${cleanKeyword}`)) {
        p1Completed++;
      }
    });
  }
  const p1Percent = p1Total > 0 ? Math.round((p1Completed / p1Total) * 100) : 0;
  const p2Unlocked = p1Percent >= 70;

  // 2. Phase 2 Progress (Estrategia de Contenido)
  // We need to complete either fase2-create-${activeKeyword} or fase2-improve-${activeKeyword}
  const p2Total = 1;
  let p2Completed = 0;
  if (activeKeyword) {
    const cleanKw = activeKeyword.replace(/\$/g, '').replace(/^[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ]+/g, '').trim();
    if (completedMissionsSet.has(`fase2-create-${cleanKw}`) || completedMissionsSet.has(`fase2-improve-${cleanKw}`)) {
      p2Completed = 1;
    }
  }
  const p2Percent = (p2Completed / p2Total) * 100;
  const p3Unlocked = p2Unlocked && p2Percent >= 70;

  // 3. Phase 3 Progress (Optimización)
  // We only show and count the top 10 missions!
  const p3Missions = rawMissions ? rawMissions.slice(0, 10) : [];
  const p3Total = p3Missions.length > 0 ? p3Missions.length : 10;
  let p3Completed = 0;
  p3Missions.forEach(m => {
    if (completedMissionsSet.has(m.id)) {
      p3Completed++;
    }
  });
  const p3Percent = p3Total > 0 ? Math.round((p3Completed / p3Total) * 100) : 0;
  const p4Unlocked = p3Unlocked && p3Percent >= 70;

  // 4. Phase 4 Progress (Indexación)
  const p4Total = 1;
  let p4Completed = 0;
  if (siteUrl) {
    const cleanUrl = siteUrl.replace(/https?:\/\//, '').replace(/\/$/, '');
    if (completedMissionsSet.has(`fase4-index-${cleanUrl}`)) {
      p4Completed = 1;
    }
  }
  const p4Percent = (p4Completed / p4Total) * 100;
  const cycleCompleted = p4Percent >= 70;

  return {
    p1: { total: p1Total, completed: p1Completed, percent: p1Percent, unlocked: true },
    p2: { total: p2Total, completed: p2Completed, percent: p2Percent, unlocked: p2Unlocked },
    p3: { total: p3Total, completed: p3Completed, percent: p3Percent, unlocked: p3Unlocked },
    p4: { total: p4Total, completed: p4Completed, percent: p4Percent, unlocked: p4Unlocked },
    cycleCompleted
  };
}

export async function syncStateWithServer() {
  try {
    const xp = parseInt(localStorage.getItem("seojump_xp") || "0", 10);
    const completedList = JSON.parse(localStorage.getItem("seojump_completed_missions") || "[]");
    const prestige = parseInt(localStorage.getItem("seojump_prestigio_cycles") || "0", 10);
    const siteUrl = localStorage.getItem("seojump_site_url") || "";
    const query = localStorage.getItem("gold-tu-busqueda") || "";
    
    let suggestions = [];
    try {
      suggestions = JSON.parse(localStorage.getItem("gold-suggestions") || "[]");
    } catch (e) {}

    let missions = [];
    try {
      missions = JSON.parse(localStorage.getItem("seojump_missions") || "[]");
    } catch (e) {}

    const completedSet = new Set(completedList);
    const prog = getPhaseProgress(completedSet, suggestions, missions, query, siteUrl);
    
    let fase_actual = 1;
    if (prog.p4.unlocked) fase_actual = 4;
    else if (prog.p3.unlocked) fase_actual = 3;
    else if (prog.p2.unlocked) fase_actual = 2;

    const payload = {
      xp,
      completed_missions: completedList,
      ciclos_prestigio: prestige,
      fase_actual,
      site_url: siteUrl,
      gold_query: query,
      gold_suggestions: suggestions,
      missions_list: missions
    };

    const res = await fetch('/api/user-state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (res.ok) {
      const result = await res.json();
      return result.data;
    }
  } catch (error) {
    console.error("Error syncing state with server:", error);
  }
  return null;
}

export async function pullStateFromServer() {
  try {
    const res = await fetch('/api/user-state');
    if (res.ok) {
      const result = await res.json();
      if (result.success && result.data) {
        const server = result.data;
        
        const localXp = parseInt(localStorage.getItem("seojump_xp") || "0", 10);
        const localPrestige = parseInt(localStorage.getItem("seojump_prestigio_cycles") || "0", 10);
        
        let localCompleted = [];
        try {
          localCompleted = JSON.parse(localStorage.getItem("seojump_completed_missions") || "[]");
        } catch (e) {}
        
        const mergedCompleted = Array.from(new Set([...localCompleted, ...(server.completed_missions || [])]));
        const mergedXp = Math.max(localXp, server.xp || 0);
        const mergedPrestige = Math.max(localPrestige, server.ciclos_prestigio || 0);
        
        localStorage.setItem("seojump_xp", mergedXp.toString());
        localStorage.setItem("seojump_completed_missions", JSON.stringify(mergedCompleted));
        localStorage.setItem("seojump_prestigio_cycles", mergedPrestige.toString());
        
        if (server.site_url) localStorage.setItem("seojump_site_url", server.site_url);
        if (server.gold_query) localStorage.setItem("gold-tu-busqueda", server.gold_query);
        if (server.gold_suggestions) localStorage.setItem("gold-suggestions", JSON.stringify(server.gold_suggestions));
        if (server.missions_list) localStorage.setItem("seojump_missions", JSON.stringify(server.missions_list));
        
        return {
          xp: mergedXp,
          completed_missions: mergedCompleted,
          ciclos_prestigio: mergedPrestige,
          site_url: server.site_url || localStorage.getItem("seojump_site_url"),
          gold_query: server.gold_query || localStorage.getItem("gold-tu-busqueda"),
          gold_suggestions: server.gold_suggestions || [],
          missions: server.missions_list || []
        };
      }
    }
  } catch (error) {
    console.error("Error pulling state from server:", error);
  }
  return null;
}
