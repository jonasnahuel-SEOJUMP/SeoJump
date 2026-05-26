"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useAudio } from "../../hooks/useAudio";
import { useTheme } from "../../hooks/useTheme";
import { requestGoogleIndexing } from "../../lib/actions";
import { getPhaseProgress, syncStateWithServer, pullStateFromServer } from "../../lib/progression";
import Header from "../../components/Header";

export default function DetectiveDeEnlaces() {
  const { data: session, status } = useSession();
  const { isMuted, toggleMute, playClick, playThemeToggle, playSuccess } = useAudio();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();

  const [xp, setXp] = useState(0);
  const [hasGoldKeyword, setHasGoldKeyword] = useState(false);
  const [hasMissions, setHasMissions] = useState(false);
  const [siteUrl, setSiteUrl] = useState("");
  const [completedIds, setCompletedIds] = useState(new Set());
  const [prog, setProg] = useState(null);
  const [prestigeCycles, setPrestigeCycles] = useState(0);
  const [serverLoading, setServerLoading] = useState(true);

  // Checkbox states for Launch Authorization
  const [h1Checked, setH1Checked] = useState(false);
  const [keywordChecked, setKeywordChecked] = useState(false);
  const [savedChecked, setSavedChecked] = useState(false);
  const [indexingStatus, setIndexingStatus] = useState("idle"); // idle | loading | success
  const [indexingError, setIndexingError] = useState(null);

  // Pull state from server on mount if logged in, otherwise load from local storage
  useEffect(() => {
    const init = async () => {
      setServerLoading(true);
      if (session) {
        const serverState = await pullStateFromServer();
        if (serverState) {
          setXp(serverState.xp || 0);
          setSiteUrl(serverState.site_url || "");
          setHasGoldKeyword(!!serverState.gold_query);
          setCompletedIds(new Set(serverState.completed_missions || []));
          setPrestigeCycles(serverState.ciclos_prestigio || 0);
          setHasMissions((serverState.missions || []).length > 0);

          const completedSet = new Set(serverState.completed_missions || []);
          const p = getPhaseProgress(
            completedSet,
            serverState.gold_suggestions,
            serverState.missions,
            serverState.gold_query,
            serverState.site_url
          );
          setProg(p);
          setServerLoading(false);
          return;
        }
      }

      const savedXp = localStorage.getItem("seojump_xp");
      if (savedXp) setXp(parseInt(savedXp, 10));
      const keyword = localStorage.getItem("gold-tu-busqueda");
      setHasGoldKeyword(!!keyword);

      const savedUrl = localStorage.getItem("seojump_site_url");
      if (savedUrl) setSiteUrl(savedUrl);

      const prestige = parseInt(localStorage.getItem("seojump_prestigio_cycles") || "0", 10);
      setPrestigeCycles(prestige);

      const savedCompleted = localStorage.getItem("seojump_completed_missions");
      let completedList = [];
      if (savedCompleted) {
        try {
          const parsed = JSON.parse(savedCompleted);
          if (Array.isArray(parsed)) {
            completedList = parsed;
            setCompletedIds(new Set(parsed));
          }
        } catch (e) {}
      }
      const completedSet = new Set(completedList);

      const savedMissions = localStorage.getItem("seojump_missions");
      let missionsList = [];
      if (savedMissions) {
        try {
          const parsed = JSON.parse(savedMissions);
          if (Array.isArray(parsed) && parsed.length > 0) {
            missionsList = parsed;
            setHasMissions(true);
          }
        } catch (e) {}
      }

      let suggestions = [];
      const savedSuggestions = localStorage.getItem("gold-suggestions");
      if (savedSuggestions) {
        try { suggestions = JSON.parse(savedSuggestions); } catch (e) {}
      }

      const p = getPhaseProgress(completedSet, suggestions, missionsList, keyword, savedUrl);
      setProg(p);
      setServerLoading(false);
    };
    init();
  }, [session]);

  // Recalculate progress when state updates
  useEffect(() => {
    let suggestions = [];
    try {
      suggestions = JSON.parse(localStorage.getItem("gold-suggestions") || "[]");
    } catch (e) {}
    let missions = [];
    try {
      missions = JSON.parse(localStorage.getItem("seojump_missions") || "[]");
    } catch (e) {}
    const p = getPhaseProgress(completedIds, suggestions, missions, localStorage.getItem("gold-tu-busqueda"), siteUrl);
    setProg(p);
  }, [completedIds, siteUrl]);

  // Auth protection only
  useEffect(() => {
    if (!session && status !== "loading") {
      router.push("/");
    }
  }, [session, status, router]);

  // Lock protection: redirect if Phase 4 is locked
  useEffect(() => {
    if (prog && !prog.p4.unlocked) {
      router.push("/optimizacion");
    }
  }, [prog, router]);

  const allChecked = h1Checked && keywordChecked && savedChecked;

  const handleRequestIndex = async () => {
    if (!allChecked) return;
    playClick();
    setIndexingStatus("loading");
    setIndexingError(null);

    try {
      if (!siteUrl) {
        throw new Error("No pudimos determinar la URL de tu sitio. Volvé al Inicio y re-analizá.");
      }
      const res = await requestGoogleIndexing(siteUrl);
      if (res.success) {
        setIndexingStatus("success");
        if (playSuccess) playSuccess();
        const newXp = xp + 50;
        setXp(newXp);
        localStorage.setItem("seojump_xp", newXp.toString());

        // Mark mission as completed!
        const cleanUrl = siteUrl.replace(/https?:\/\//, '').replace(/\/$/, '');
        const missionId = `fase4-index-${cleanUrl}`;
        setCompletedIds(prev => {
          const updated = new Set([...prev, missionId]);
          localStorage.setItem("seojump_completed_missions", JSON.stringify(Array.from(updated)));
          setTimeout(() => {
            syncStateWithServer();
          }, 100);
          return updated;
        });

        // Create and save new notification
        const newNotification = {
          id: Date.now().toString(),
          text: "🚀 ¡Lanzamiento exitoso! Google ya recibió la señal para indexar tu web. (+50 XP)",
          read: false,
          date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' - ' + new Date().toLocaleDateString(),
          type: "indexation"
        };
        const rawNotifs = localStorage.getItem("seojump_notifications");
        let notifs = [];
        if (rawNotifs) {
          try {
            notifs = JSON.parse(rawNotifs);
          } catch (e) {}
        }
        notifs.unshift(newNotification);
        localStorage.setItem("seojump_notifications", JSON.stringify(notifs));
        window.dispatchEvent(new Event("seojump_notifications_updated"));
      } else {
        throw new Error(res.message || "Error al solicitar indexación.");
      }
    } catch (err) {
      console.error("Indexation failed:", err);
      setIndexingStatus("idle");
      let errMsg = err.message || "Error de conexión con la API de Google.";
      if (errMsg.includes("insufficient") || errMsg === "MISSING_SEARCH_CONSOLE_SCOPE") {
        errMsg = "Permisos insuficientes. Volvé a la Fase 3 y conectá tu Google Search Console con acceso completo.";
      }
      setIndexingError(errMsg);
    }
  };

  const handlePrestigeReset = async () => {
    playClick();
    const confirmReset = window.confirm(
      "⚠️ ¿Estás seguro de que deseas iniciar un nuevo ciclo de prestigio?\n\nEsto hará lo siguiente:\n- Incrementará tu Nivel de Prestigio en +1 🪙\n- Conservará toda tu Experiencia (XP) acumulada 🏆\n- Limpiará tu palabra de oro actual y misiones activas de WordPress para empezar de cero.\n\nEsta acción no se puede deshacer."
    );
    if (!confirmReset) return;

    const nextPrestige = prestigeCycles + 1;

    // Reset all progress states
    localStorage.setItem("seojump_completed_missions", "[]");
    localStorage.setItem("seojump_prestigio_cycles", nextPrestige.toString());
    localStorage.setItem("gold-tu-busqueda", "");
    localStorage.setItem("gold-suggestions", "[]");
    localStorage.setItem("seojump_missions", "[]");

    // Sync state with server
    await syncStateWithServer();

    // Redirect to Fase 1
    router.push("/buscador-de-oro");
  };

  if (status === "loading" || !session || serverLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#07070d]">
        {/* Jewel Loading Spin */}
        <div className="relative w-20 h-20">
          <div className="absolute inset-0 rounded-full border-4 border-emerald-500/20 animate-pulse"></div>
          <div className="absolute inset-0 rounded-full border-4 border-t-emerald-500 border-r-emerald-500/50 animate-spin"></div>
          <div className="absolute inset-4 rounded-full bg-emerald-500/10 blur-sm"></div>
        </div>
        <h3 className="mt-6 text-xl font-black text-white uppercase tracking-wider animate-pulse">Cargando tu progreso...</h3>
        <p className="mt-2 text-sm font-bold text-slate-400">Sincronizando con el cerebro del Búho</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center p-4 md:p-8 w-full max-w-screen-lg mx-auto space-y-8 bg-transparent transition-colors duration-300 text-slate-100 min-h-screen relative font-fredoka px-4">

      {/* ─── HEADER ─── */}
      <Header
        xp={xp}
        prestigeCycles={prestigeCycles}
        isMuted={isMuted}
        toggleMute={toggleMute}
        theme={theme}
        toggleTheme={toggleTheme}
        playThemeToggle={playThemeToggle}
        playClick={playClick}
        prog={prog}
        activePhase={4}
      />

      {/* ─── MAIN CONTENT ─── */}
      <div className="w-full flex flex-wrap lg:flex-nowrap gap-8 items-start">

        {/* LEFT: Owl panel */}
        <div className="w-full lg:w-[320px] flex-shrink-0 flex flex-col gap-6 lg:sticky lg:top-44">

          {/* Level card */}
          <div className="card-3d bg-white dark:bg-slate-800 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xl font-black text-duo-yellow">NIVEL {Math.floor(xp / 100) + 1}</span>
              <span className="text-sm font-bold text-slate-555">{xp % 100} / 100 XP</span>
            </div>
            <div className="w-full h-6 bg-gray-100 dark:bg-slate-700 rounded-full border-2 border-slate-200 dark:border-slate-600 overflow-hidden">
              <div className="h-full bg-duo-yellow transition-all duration-1000" style={{ width: `${xp % 100}%` }} />
            </div>
          </div>

          {/* Status Card */}
          <div className="card-3d bg-slate-800 text-white border-slate-700 p-6 space-y-4 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full bg-purple-900/20 pointer-events-none" />
            <div className="flex items-center gap-3 relative z-10">
              <span className="text-3xl">📡</span>
              <h3 className="text-lg font-black text-purple-300">Radar de Indexación</h3>
            </div>
            
            <div className="space-y-3 pt-2 text-left relative z-10 font-bold text-xs">
              <div className="border-b border-slate-700 pb-2">
                <span className="text-slate-400 block mb-1">SITIO WEB:</span>
                <span className="text-white break-all font-mono">{siteUrl || "No especificado"}</span>
              </div>
              {hasGoldKeyword && (
                <div className="border-b border-slate-700 pb-2">
                  <span className="text-slate-400 block mb-1">PALABRA DE ORO:</span>
                  <span className="text-duo-yellow font-black">"{localStorage.getItem("gold-tu-busqueda")}"</span>
                </div>
              )}
              <div>
                <span className="text-slate-400 block mb-1">ESTADO GOOGLE:</span>
                {prog?.cycleCompleted || indexingStatus === "success" ? (
                  <span className="text-emerald-400 flex items-center gap-1.5 animate-pulse font-black">
                    🟢 Solicitado (Escaneo Prioritario)
                  </span>
                ) : (
                  <span className="text-amber-400 flex items-center gap-1.5 font-black">
                    🟡 Pendiente de Lanzamiento
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Go back CTA */}
          <Link href="/optimizacion" onClick={playClick}
            className="btn-3d btn-green w-full text-center text-lg font-black py-4">
            🛠️ SEGUIR EN FASE 3
          </Link>
        </div>

        {/* CENTER: Guided process */}
        <div className="w-full lg:flex-1 min-w-0 flex flex-col gap-8">

          {prog?.cycleCompleted ? (
            <div className="w-full bg-gradient-to-br from-amber-600 to-yellow-500 border-4 border-yellow-400 rounded-3xl p-8 md:p-12 text-center space-y-6 shadow-2xl animate-in zoom-in-95 duration-500 text-slate-900">
              <div className="text-7xl animate-bounce">👑</div>
              <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tight">
                ¡Nivel Experto Alcanzado!
              </h2>
              <p className="text-lg md:text-xl font-bold leading-relaxed max-w-xl mx-auto text-slate-950">
                ¡Felicitaciones! Has completado todas las fases de optimización y solicitado la indexación. Tu sitio web ahora tiene la estructura de los profesionales del SEO.
              </p>
              <div className="bg-slate-900/10 border border-slate-900/20 rounded-2xl p-4 max-w-md mx-auto">
                <p className="text-sm font-black uppercase tracking-wider mb-1 text-slate-800">
                  Ciclos Completados (Prestigio)
                </p>
                <p className="text-3xl font-black text-slate-950">
                  {prestigeCycles} → {prestigeCycles + 1} 🪙
                </p>
              </div>
              <p className="text-sm font-bold text-slate-800 leading-relaxed max-w-sm mx-auto">
                Al reiniciar el ciclo, tu progreso volverá a la Fase 1 para trabajar con una nueva keyword o nuevas misiones, acumulando una medalla de prestigio adicional.
              </p>
              <div className="pt-4">
                <button
                  onClick={handlePrestigeReset}
                  className="w-full btn-3d btn-red animate-pulse-glow text-white font-black py-5 text-xl flex items-center justify-center gap-2.5 shadow-lg shadow-red-500/20"
                >
                  🔄 Reiniciar Ciclo de Optimización
                </button>
              </div>
            </div>
          ) : (
            /* Hero card */
            <div className="w-full bg-slate-900 rounded-3xl border-2 border-slate-700 shadow-2xl overflow-hidden relative p-8 md:p-12 space-y-8">
              {/* Glow decoration */}
              <div className="absolute top-0 right-0 w-96 h-96 bg-purple-700 opacity-10 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-700 opacity-10 rounded-full blur-3xl -ml-20 -mb-20 pointer-events-none" />

              <div className="relative z-10 flex flex-col gap-6 w-full text-left">
                {/* Header Title */}
                <div className="flex flex-col md:flex-row items-center gap-4 border-b border-slate-800 pb-6 justify-between">
                  <h1 className="text-3xl md:text-4xl font-black text-white flex items-center gap-3">
                    Autorización de Lanzamiento 🚀
                  </h1>
                  <div className="bg-purple-900/50 border border-purple-600/50 rounded-full px-4 py-1.5 text-xs font-black text-purple-300 uppercase tracking-wider">
                    Fase 4: Indexación
                  </div>
                </div>

                {/* Caja informativa / Alert banner */}
                <div className="p-5 bg-purple-950/20 border-2 border-purple-800/60 rounded-2xl space-y-2">
                  <h4 className="font-black text-purple-300 text-base flex items-center gap-2">
                    💡 ¿Qué significa solicitar la indexación?
                  </h4>
                  <p className="text-sm font-bold text-slate-350 leading-relaxed">
                    Normalmente, Google puede tardar semanas en notar tus mejoras. Al usar esta herramienta, le enviamos una alerta directa a sus robots para que escaneen y actualicen tu posición hoy mismo.
                  </p>
                </div>

                {/* Checklist */}
                {indexingStatus !== "success" ? (
                  <div className="bg-slate-800/80 rounded-2xl border border-slate-750 p-6 md:p-8 space-y-6">
                    <h3 className="text-lg font-black text-white flex items-center gap-2 mb-2">
                      📋 Verificaciones antes de despegar
                    </h3>
                    <p className="text-xs text-slate-400 font-bold">
                      Asegurate de haber cumplido todos los pasos para evitar indexar una página sin cambios:
                    </p>
                    
                    <div className="space-y-4">
                      <label className="flex items-start gap-4 cursor-pointer select-none group">
                        <input
                          type="checkbox"
                          checked={h1Checked}
                          onChange={(e) => { playClick(); setH1Checked(e.target.checked); }}
                          className="w-6 h-6 rounded-md border-2 border-slate-650 bg-slate-900 checked:bg-green-500 checked:border-green-600 focus:ring-0 accent-green-500 transition-colors mt-0.5"
                        />
                        <span className="text-base font-bold text-slate-350 group-hover:text-white transition-colors leading-snug">
                          Ya actualicé el Título Principal (H1) en mi página web.
                        </span>
                      </label>

                      <label className="flex items-start gap-4 cursor-pointer select-none group">
                        <input
                          type="checkbox"
                          checked={keywordChecked}
                          onChange={(e) => { playClick(); setKeywordChecked(e.target.checked); }}
                          className="w-6 h-6 rounded-md border-2 border-slate-650 bg-slate-900 checked:bg-green-500 checked:border-green-600 focus:ring-0 accent-green-500 transition-colors mt-0.5"
                        />
                        <span className="text-base font-bold text-slate-355 group-hover:text-white transition-colors leading-snug">
                          Ya incluí la palabra clave dentro del texto de mi página.
                        </span>
                      </label>

                      <label className="flex items-start gap-4 cursor-pointer select-none group">
                        <input
                          type="checkbox"
                          checked={savedChecked}
                          onChange={(e) => { playClick(); setSavedChecked(e.target.checked); }}
                          className="w-6 h-6 rounded-md border-2 border-slate-655 bg-slate-900 checked:bg-green-500 checked:border-green-600 focus:ring-0 accent-green-500 transition-colors mt-0.5"
                        />
                        <span className="text-base font-bold text-slate-355 group-hover:text-white transition-colors leading-snug">
                          Guardé y publiqué los cambios en mi plataforma.
                        </span>
                      </label>
                    </div>
                  </div>
                ) : (
                  <div className="bg-emerald-950/20 border-2 border-emerald-800/60 rounded-2xl p-6 md:p-8 text-center space-y-4 animate-in zoom-in-95 duration-300">
                    <div className="text-6xl animate-bounce">🚀</div>
                    <h3 className="text-2xl font-black text-emerald-400">¡Lanzamiento Autorizado!</h3>
                    <p className="text-base font-bold text-slate-300 leading-relaxed max-w-lg mx-auto">
                      Le enviamos una señal de indexación prioritaria a Google Search Console. Sus robots volverán a escanear tu URL en las próximas horas para registrar tus mejoras.
                    </p>
                    <div className="text-yellow-400 font-black text-lg">
                      ¡Ganaste +50 XP por completar el Lanzamiento! 🏆
                    </div>
                  </div>
                )}

                {/* Action Button */}
                <div className="pt-4">
                  <button
                    disabled={!allChecked || indexingStatus === "loading" || indexingStatus === "success"}
                    onClick={handleRequestIndex}
                    className={`w-full btn-3d font-black py-4 text-lg flex items-center justify-center gap-2.5 transition-all ${
                      allChecked && indexingStatus !== "success"
                        ? "bg-green-500 border-green-600 border-b-4 hover:bg-green-450 active:border-b-0 active:translate-y-1 text-white shadow-lg shadow-green-500/20"
                        : "bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed opacity-50"
                    }`}
                  >
                    {indexingStatus === "loading" ? "📡 ENVIANDO ALERTA A GOOGLE..." : "📡 Solicitar Indexación a Google"}
                  </button>
                </div>

                {indexingError && (
                  <div className="p-4 bg-red-950/20 border-2 border-red-800 text-red-400 rounded-xl font-bold text-sm text-center animate-in fade-in duration-300">
                    ⚠️ {indexingError}
                  </div>
                )}

                {/* Optional footer info */}
                {indexingStatus === "idle" && (
                  <p className="text-xs text-slate-550 text-center font-bold">
                    ⚠️ Asegurate de marcar todas las casillas. Solicitar la indexación sin haber realizado cambios en tu sitio web no surtirá efecto.
                  </p>
                )}

              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
