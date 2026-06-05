"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useAudio } from "../../hooks/useAudio";
import { useTheme } from "../../hooks/useTheme";
import { auditSiteLinks, requestGoogleIndexing, checkIsAdmin } from "../../lib/actions";
import { getPhaseProgress, syncStateWithServer, pullStateFromServer } from "../../lib/progression";
import Header from "../../components/Header";

export default function DetectiveDeEnlaces() {
  const { data: session, status } = useSession();
  const { isMuted, toggleMute, playClick, playThemeToggle, playSuccess } = useAudio();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();

  // ── Core State ──
  const [xp, setXp] = useState(0);
  const [siteUrl, setSiteUrl] = useState("");
  const [goldKeyword, setGoldKeyword] = useState("");
  const [completedIds, setCompletedIds] = useState(new Set());
  const [prog, setProg] = useState(null);
  const [prestigeCycles, setPrestigeCycles] = useState(0);
  const [serverLoading, setServerLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAdminResolved, setIsAdminResolved] = useState(false);

  // ── Detective State ──
  const [scanState, setScanState] = useState("idle"); // idle | scanning | results | complete
  const [auditResults, setAuditResults] = useState(null);
  const [auditError, setAuditError] = useState(null);
  const [activeTab, setActiveTab] = useState("internalLinking");
  const [completedFixes, setCompletedFixes] = useState(new Set());
  const [showConfetti, setShowConfetti] = useState(false);

  // ── Indexation State (kept from original) ──
  const [h1Checked, setH1Checked] = useState(false);
  const [keywordChecked, setKeywordChecked] = useState(false);
  const [savedChecked, setSavedChecked] = useState(false);
  const [indexingStatus, setIndexingStatus] = useState("idle");
  const [indexingError, setIndexingError] = useState(null);

  // ── XP Animation ──
  const [xpPopup, setXpPopup] = useState(null);

  // ── Load State ──
  useEffect(() => {
    const init = async () => {
      setServerLoading(true);
      // Resolver God Mode antes de calcular fases
      const adminResult = await checkIsAdmin().catch(() => false);
      setIsAdmin(adminResult);

      if (session) {
        const serverState = await pullStateFromServer();
        if (serverState) {
          setXp(serverState.xp || 0);
          setSiteUrl(serverState.site_url || "");
          setGoldKeyword(serverState.gold_query || "");
          setCompletedIds(new Set(serverState.completed_missions || []));
          setPrestigeCycles(serverState.ciclos_prestigio || 0);

          const completedSet = new Set(serverState.completed_missions || []);
          const p = getPhaseProgress(
            completedSet,
            serverState.gold_suggestions,
            serverState.missions,
            serverState.gold_query,
            serverState.site_url,
            adminResult
          );
          setProg(p);

          // Load saved fixes
          const savedFixes = localStorage.getItem("seojump_detective_fixes");
          if (savedFixes) {
            try { setCompletedFixes(new Set(JSON.parse(savedFixes))); } catch (e) {}
          }
          // Load saved audit results
          const savedAudit = localStorage.getItem("seojump_detective_audit");
          if (savedAudit) {
            try {
              const parsed = JSON.parse(savedAudit);
              setAuditResults(parsed);
              setScanState("results");
            } catch (e) {}
          }

          setServerLoading(false);
          return;
        }
      }

      const savedXp = localStorage.getItem("seojump_xp");
      if (savedXp) setXp(parseInt(savedXp, 10));
      const savedUrl = localStorage.getItem("seojump_site_url");
      if (savedUrl) setSiteUrl(savedUrl);
      const savedKw = localStorage.getItem("gold-tu-busqueda");
      if (savedKw) setGoldKeyword(savedKw);

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

      const savedFixes = localStorage.getItem("seojump_detective_fixes");
      if (savedFixes) {
        try { setCompletedFixes(new Set(JSON.parse(savedFixes))); } catch (e) {}
      }
      const savedAudit = localStorage.getItem("seojump_detective_audit");
      if (savedAudit) {
        try {
          const parsed = JSON.parse(savedAudit);
          setAuditResults(parsed);
          setScanState("results");
        } catch (e) {}
      }

      const savedMissions = localStorage.getItem("seojump_missions");
      let missionsList = [];
      if (savedMissions) {
        try {
          const parsed = JSON.parse(savedMissions);
          if (Array.isArray(parsed) && parsed.length > 0) missionsList = parsed;
        } catch (e) {}
      }

      let suggestions = [];
      const savedSuggestions = localStorage.getItem("gold-suggestions");
      if (savedSuggestions) {
        try { suggestions = JSON.parse(savedSuggestions); } catch (e) {}
      }

      const p = getPhaseProgress(completedSet, suggestions, missionsList, savedKw, savedUrl, adminResult);
      setProg(p);
      setServerLoading(false);
    };
    init();
  }, [session]);

  // Recalculate progress
  useEffect(() => {
    let suggestions = [];
    try { suggestions = JSON.parse(localStorage.getItem("gold-suggestions") || "[]"); } catch (e) {}
    let missions = [];
    try { missions = JSON.parse(localStorage.getItem("seojump_missions") || "[]"); } catch (e) {}
    const p = getPhaseProgress(completedIds, suggestions, missions, goldKeyword, siteUrl, isAdmin);
    setProg(p);
  }, [completedIds, siteUrl, goldKeyword, isAdmin]);

  // ── Resolver admin status de forma independiente y TEMPRANA ──────────────
  useEffect(() => {
    if (status === 'loading') return;
    checkIsAdmin()
      .then(result => { setIsAdmin(result); setIsAdminResolved(true); })
      .catch(() => { setIsAdmin(false); setIsAdminResolved(true); });
  }, [status]);

  // XP persist
  useEffect(() => {
    if (xp > 0) localStorage.setItem("seojump_xp", xp.toString());
  }, [xp]);

  // Save fixes
  useEffect(() => {
    localStorage.setItem("seojump_detective_fixes", JSON.stringify(Array.from(completedFixes)));
  }, [completedFixes]);

  // Auth protection
  useEffect(() => {
    if (!session && status !== "loading") {
      router.push("/");
    }
  }, [session, status, router]);

  // Lock protection — FRENO TRIPLE: sesión + admin resuelto + no es admin
  useEffect(() => {
    if (status === 'loading') return;
    if (!isAdminResolved) return;           // esperar que checkIsAdmin() termine
    if (isAdmin) return;
    if (prog && !prog.p4.unlocked) {
      router.push('/optimizacion');
    }
  }, [prog, router, status, isAdmin, isAdminResolved]);

  // ── Handlers ──
  const handleScan = async () => {
    if (!siteUrl) {
      setAuditError("No pudimos determinar la URL de tu sitio. Volvé al Dashboard y re-analizá.");
      return;
    }
    playClick();
    setScanState("scanning");
    setAuditError(null);
    setAuditResults(null);

    try {
      const res = await auditSiteLinks(siteUrl, goldKeyword || undefined);
      if (res.success && res.audit) {
        setAuditResults(res);
        setScanState("results");
        localStorage.setItem("seojump_detective_audit", JSON.stringify(res));
      } else {
        setAuditError(res.error || "Error al escanear el sitio. Intentá de nuevo en unos segundos.");
        setScanState("idle");
      }
    } catch (err) {
      setAuditError("Error de conexión. Verificá tu internet e intentá de nuevo.");
      setScanState("idle");
    }
  };

  const handleVerifyFix = (type, identifier) => {
    const fixId = `fase4-${type}-${btoa(identifier).slice(0, 12)}`;
    if (completedFixes.has(fixId)) return;

    playSuccess();
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 3000);

    const newXp = xp + 15;
    setXp(newXp);
    localStorage.setItem("seojump_xp", newXp.toString());

    // XP popup
    setXpPopup({ id: fixId, amount: 15 });
    setTimeout(() => setXpPopup(null), 2000);

    setCompletedFixes(prev => {
      const updated = new Set([...prev, fixId]);
      localStorage.setItem("seojump_detective_fixes", JSON.stringify(Array.from(updated)));
      return updated;
    });

    // Also add to global completed missions
    setCompletedIds(prev => {
      const updated = new Set([...prev, fixId]);
      localStorage.setItem("seojump_completed_missions", JSON.stringify(Array.from(updated)));
      setTimeout(() => { syncStateWithServer(); }, 100);
      return updated;
    });
  };

  const allChecked = h1Checked && keywordChecked && savedChecked;

  const handleRequestIndex = async () => {
    if (!allChecked) return;
    playClick();
    setIndexingStatus("loading");
    setIndexingError(null);

    try {
      if (!siteUrl) throw new Error("No pudimos determinar la URL de tu sitio.");
      const res = await requestGoogleIndexing(siteUrl);
      if (res.success) {
        setIndexingStatus("success");
        if (playSuccess) playSuccess();
        const newXp = xp + 50;
        setXp(newXp);
        localStorage.setItem("seojump_xp", newXp.toString());

        const cleanUrl = siteUrl.replace(/https?:\/\//, '').replace(/\/$/, '');
        const missionId = `fase4-index-${cleanUrl}`;
        setCompletedIds(prev => {
          const updated = new Set([...prev, missionId]);
          localStorage.setItem("seojump_completed_missions", JSON.stringify(Array.from(updated)));
          setTimeout(() => { syncStateWithServer(); }, 100);
          return updated;
        });

        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 3000);

        // Save notification
        const newNotification = {
          id: Date.now().toString(),
          text: "🚀 ¡Lanzamiento exitoso! Google ya recibió la señal para indexar tu web. (+50 XP)",
          read: false,
          date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' - ' + new Date().toLocaleDateString(),
          type: "indexation"
        };
        const rawNotifs = localStorage.getItem("seojump_notifications");
        let notifs = [];
        if (rawNotifs) { try { notifs = JSON.parse(rawNotifs); } catch (e) {} }
        notifs.unshift(newNotification);
        localStorage.setItem("seojump_notifications", JSON.stringify(notifs));
        window.dispatchEvent(new Event("seojump_notifications_updated"));
      } else {
        throw new Error(res.message || "Error al solicitar indexación.");
      }
    } catch (err) {
      setIndexingStatus("idle");
      let errMsg = err.message || "Error de conexión con la API de Google.";
      if (errMsg.includes("insufficient") || errMsg === "MISSING_SEARCH_CONSOLE_SCOPE") {
        errMsg = "Necesitás conectar tu Google Search Console. Volvé a iniciar sesión con permisos completos.";
      }
      setIndexingError(errMsg);
    }
  };

  const handlePrestigeReset = async () => {
    playClick();
    const confirmReset = window.confirm(
      "⚠️ ¿Estás seguro de que deseas iniciar un nuevo ciclo de prestigio?\n\nEsto hará lo siguiente:\n- Incrementará tu Nivel de Prestigio en +1 🪙\n- Conservará toda tu Experiencia (XP) acumulada 🏆\n- Limpiará tu palabra de oro actual y misiones activas para empezar de cero.\n\nEsta acción no se puede deshacer."
    );
    if (!confirmReset) return;

    const nextPrestige = prestigeCycles + 1;
    localStorage.setItem("seojump_completed_missions", "[]");
    localStorage.setItem("seojump_prestigio_cycles", nextPrestige.toString());
    localStorage.setItem("gold-tu-busqueda", "");
    localStorage.setItem("gold-suggestions", "[]");
    localStorage.setItem("seojump_missions", "[]");
    localStorage.removeItem("seojump_detective_audit");
    localStorage.removeItem("seojump_detective_fixes");

    await syncStateWithServer();
    router.push("/buscador-de-oro");
  };

  // ── Helpers ──
  const getTotalIssues = () => {
    if (!auditResults?.audit) return 0;
    const { internalLinking = [], brokenLinks = [], anchorText = [] } = auditResults.audit;
    return internalLinking.length + brokenLinks.length + anchorText.length;
  };

  const getFixedCount = () => completedFixes.size;

  const isFixCompleted = (type, identifier) => {
    const fixId = `fase4-${type}-${btoa(identifier).slice(0, 12)}`;
    return completedFixes.has(fixId);
  };

  // ── Loading ──
  if (status === "loading" || !session || serverLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#07070d]">
        <div className="relative w-20 h-20">
          <div className="absolute inset-0 rounded-full border-4 border-purple-500/20 animate-pulse"></div>
          <div className="absolute inset-0 rounded-full border-4 border-t-purple-500 border-r-purple-500/50 animate-spin"></div>
          <div className="absolute inset-4 rounded-full bg-purple-500/10 blur-sm"></div>
        </div>
        <h3 className="mt-6 text-xl font-black text-white uppercase tracking-wider animate-pulse">Cargando tu progreso...</h3>
        <p className="mt-2 text-sm font-bold text-slate-400">Sincronizando con el Detective</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center p-4 md:p-8 w-full max-w-screen-lg mx-auto space-y-8 bg-transparent transition-colors duration-300 text-slate-100 min-h-screen relative font-fredoka px-4">

      {/* Confetti */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
          {[...Array(25)].map((_, i) => (
            <div
              key={i}
              className="absolute animate-bounce text-2xl"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${1 + Math.random()}s`
              }}
            >
              {['✨', '🎉', '🏆', '⭐', '🕵️'][Math.floor(Math.random() * 5)]}
            </div>
          ))}
        </div>
      )}

      {/* XP Popup */}
      {xpPopup && (
        <div className="fixed top-20 right-8 z-50 bg-amber-500 text-white font-black text-xl px-6 py-3 rounded-2xl shadow-2xl animate-bounce">
          +{xpPopup.amount} XP ⭐
        </div>
      )}

      {/* Header */}
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
        isAdmin={isAdmin}
      />

      {/* Title */}
      <div className="text-center space-y-2 py-4 mt-2">
        <div className="text-4xl md:text-5xl">🕵️‍♂️</div>
        <h1 className="text-2xl md:text-3xl font-black text-slate-800 dark:text-slate-100">
          Detective de Enlaces
        </h1>
        <p className="text-base md:text-lg font-bold text-slate-600 dark:text-slate-400">
          Fase 4: Conectá los puntos de tu sitio
        </p>
        <div className="pt-2">
          <button
            onClick={() => { if (playClick) playClick(); router.push('/'); }}
            className="inline-flex items-center gap-1.5 btn-3d btn-white !py-2 !px-4 text-xs font-black text-slate-500 hover:text-red-500 transition-colors uppercase tracking-wider"
          >
            ✖ Cancelar y Volver al Dashboard
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="w-full flex flex-wrap lg:flex-nowrap gap-8 items-start mt-4">

        {/* Left Sidebar */}
        <div className="w-full lg:w-[320px] flex-shrink-0 flex flex-col gap-6 lg:sticky lg:top-44">

          {/* Level Card */}
          <div className="card-3d bg-white dark:bg-slate-800 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xl font-black text-duo-yellow">NIVEL {Math.floor(xp / 100) + 1}</span>
              <span className="text-sm font-bold text-slate-555">{xp % 100} / 100 XP</span>
            </div>
            <div className="w-full h-6 bg-gray-100 dark:bg-slate-700 rounded-full border-2 border-slate-200 dark:border-slate-600 overflow-hidden">
              <div className="h-full bg-duo-yellow transition-all duration-1000" style={{ width: `${xp % 100}%` }} />
            </div>
          </div>

          {/* Stats Card (visible when results are loaded) */}
          {auditResults?.stats && (
            <div className="card-3d bg-slate-800 text-white border-slate-700 p-6 space-y-4 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-full bg-purple-900/20 pointer-events-none" />
              <div className="flex items-center gap-3 relative z-10">
                <span className="text-3xl">📊</span>
                <h3 className="text-lg font-black text-purple-300">Resumen del Escaneo</h3>
              </div>

              <div className="space-y-3 pt-2 text-left relative z-10 font-bold text-sm">
                <div className="flex justify-between border-b border-slate-700 pb-2">
                  <span className="text-slate-400">Páginas escaneadas</span>
                  <span className="text-white font-black">{auditResults.stats.totalPages}</span>
                </div>
                <div className="flex justify-between border-b border-slate-700 pb-2">
                  <span className="text-slate-400">Enlaces encontrados</span>
                  <span className="text-white font-black">{auditResults.stats.totalLinks}</span>
                </div>
                <div className="flex justify-between border-b border-slate-700 pb-2">
                  <span className="text-slate-400">💀 Enlaces rotos</span>
                  <span className="text-red-400 font-black">{auditResults.stats.brokenCount}</span>
                </div>
                <div className="flex justify-between border-b border-slate-700 pb-2">
                  <span className="text-slate-400">✍️ Textos genéricos</span>
                  <span className="text-amber-400 font-black">{auditResults.stats.genericAnchors}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">🔗 Páginas perdidas</span>
                  <span className="text-purple-400 font-black">{auditResults.stats.orphanPages}</span>
                </div>
              </div>

              {/* Progress */}
              {getTotalIssues() > 0 && (
                <div className="pt-3 border-t border-slate-700 relative z-10">
                  <div className="flex justify-between text-xs font-black mb-2">
                    <span className="text-slate-400">PROGRESO</span>
                    <span className="text-emerald-400">{getFixedCount()}/{getTotalIssues()} resueltos</span>
                  </div>
                  <div className="w-full h-4 bg-slate-200 dark:bg-slate-900 rounded-full overflow-hidden border border-slate-300 dark:border-slate-700">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-700"
                      style={{ width: `${getTotalIssues() > 0 ? (getFixedCount() / getTotalIssues()) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Site Info */}
          <div className="card-3d bg-slate-800 text-white border-slate-700 p-5 space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🌐</span>
              <div>
                <h4 className="text-sm font-black text-slate-300">SITIO WEB</h4>
                <p className="text-xs font-mono text-slate-500 break-all">{siteUrl || "No especificado"}</p>
              </div>
            </div>
            {goldKeyword && (
              <div className="flex items-center gap-3">
                <span className="text-2xl">🪙</span>
                <div>
                  <h4 className="text-sm font-black text-slate-300">PALABRA DE ORO</h4>
                  <p className="text-xs font-black text-duo-yellow">"{goldKeyword}"</p>
                </div>
              </div>
            )}
          </div>

          {/* Back to Phase 3 */}
          <Link href="/optimizacion" onClick={playClick}
            className="btn-3d btn-green w-full text-center text-lg font-black py-4">
            🛠️ SEGUIR EN FASE 3
          </Link>
        </div>

        {/* Center Content */}
        <div className="w-full lg:flex-1 min-w-0 flex flex-col gap-8">

          {/* ═══ STATE: PRESTIGE COMPLETE ═══ */}
          {prog?.cycleCompleted ? (
            <div className="w-full bg-gradient-to-br from-amber-600 to-yellow-500 border-4 border-yellow-400 rounded-3xl p-8 md:p-12 text-center space-y-6 shadow-2xl animate-in zoom-in-95 duration-500 text-slate-900">
              <div className="text-7xl animate-bounce">👑</div>
              <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tight">
                ¡Nivel Experto Alcanzado!
              </h2>
              <p className="text-lg md:text-xl font-bold leading-relaxed max-w-xl mx-auto text-slate-950">
                ¡Felicitaciones! Has completado todas las fases. Tu sitio web ahora tiene la estructura de los profesionales del marketing digital.
              </p>
              <div className="bg-slate-100 dark:bg-slate-900/10 border border-slate-200 dark:border-slate-900/20 rounded-2xl p-4 max-w-md mx-auto">
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

          /* ═══ STATE: IDLE (No scan yet) ═══ */
          ) : scanState === "idle" ? (
            <div className="w-full bg-white dark:bg-slate-900 rounded-3xl border-2 border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden relative p-8 md:p-12 space-y-8">
              {/* Glow */}
              <div className="absolute top-0 right-0 w-96 h-96 bg-purple-700 opacity-10 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-700 opacity-10 rounded-full blur-3xl -ml-20 -mb-20 pointer-events-none" />

              <div className="relative z-10 text-center space-y-6">
                <div className="text-7xl">🕵️‍♂️</div>
                <h2 className="text-2xl md:text-3xl font-black text-white">
                  El Detective va a rastrear tu sitio web
                </h2>
                <p className="text-base font-bold text-slate-400 max-w-lg mx-auto leading-relaxed">
                  Vamos a buscar oportunidades escondidas para que tus productos reciban más visitas y tus clientes no se pierdan por el camino.
                </p>

                <div className="space-y-4 text-left max-w-lg mx-auto">
                  {[
                    { emoji: "🔗", text: "Páginas que pueden empujar a tus productos al Top de Google" },
                    { emoji: "💀", text: "Links rotos que están ahuyentando clientes potenciales" },
                    { emoji: "✍️", text: "Textos de enlace genéricos que no le dicen nada a Google" },
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-3 bg-slate-800/60 border border-slate-700/50 rounded-xl p-4">
                      <span className="text-2xl flex-shrink-0">{item.emoji}</span>
                      <p className="text-sm font-bold text-slate-300 leading-relaxed">{item.text}</p>
                    </div>
                  ))}
                </div>

                {auditError && (
                  <div className="p-4 bg-red-950/30 border-2 border-red-800 text-red-400 rounded-xl font-bold text-sm text-center animate-in fade-in duration-300">
                    ⚠️ {auditError}
                  </div>
                )}

                <div className="pt-4">
                  <button
                    onClick={handleScan}
                    className="w-full btn-3d bg-green-500 border-green-600 border-b-4 hover:bg-green-450 active:border-b-0 active:translate-y-1 text-white font-black py-5 text-xl flex items-center justify-center gap-2.5 shadow-lg shadow-green-500/20 transition-all"
                  >
                    🔍 ESCANEAR MI SITIO
                  </button>
                  <p className="text-xs text-slate-550 font-bold mt-3">
                    El escaneo analiza hasta 10 páginas de tu web y tarda unos segundos.
                  </p>
                </div>
              </div>
            </div>

          /* ═══ STATE: SCANNING ═══ */
          ) : scanState === "scanning" ? (
            <div className="text-center py-20 px-6 card-3d bg-white dark:bg-slate-900 border-2 border-purple-500/30 rounded-3xl shadow-[0_0_40px_rgba(168,85,247,0.15)] relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-purple-500 to-transparent animate-pulse" />
              <div className="flex justify-center mb-6">
                <svg className="animate-spin h-16 w-16 text-purple-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
              <h3 className="text-2xl md:text-3xl font-black text-purple-400 mb-2">El Detective está investigando...</h3>
              <p className="text-base md:text-lg font-bold text-slate-400 max-w-md mx-auto leading-relaxed">
                Rastreando páginas, verificando enlaces y analizando textos. Esto puede tardar unos segundos.
              </p>
            </div>

          /* ═══ STATE: RESULTS ═══ */
          ) : scanState === "results" && auditResults ? (
            <div className="w-full space-y-6">

              {/* Tab Bar */}
              <div className="flex flex-wrap gap-2">
                {[
                  { key: "internalLinking", label: "🔗 Traspaso de Fuerza", count: auditResults.audit?.internalLinking?.length || 0 },
                  { key: "brokenLinks", label: "💀 Enlaces Rotos", count: auditResults.audit?.brokenLinks?.length || 0 },
                  { key: "anchorText", label: "✍️ Texto de Anclaje", count: auditResults.audit?.anchorText?.length || 0 },
                ].map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => { playClick(); setActiveTab(tab.key); }}
                    className={`px-4 py-2.5 rounded-full font-black text-xs md:text-sm border-2 transition-all duration-300 flex items-center gap-2 ${
                      activeTab === tab.key
                        ? "bg-gradient-to-r from-purple-500 to-indigo-500 border-purple-400 text-white shadow-[0_0_15px_rgba(168,85,247,0.3)] scale-105"
                        : "bg-slate-800/40 border-slate-700 text-slate-300 hover:border-slate-600 hover:text-white"
                    }`}
                  >
                    {tab.label}
                    {tab.count > 0 && (
                      <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                        activeTab === tab.key ? "bg-white/20 text-white" : "bg-slate-700 text-slate-400"
                      }`}>
                        {tab.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Tab Content: Internal Linking */}
              {activeTab === "internalLinking" && (
                <div className="space-y-4">
                  {(auditResults.audit?.internalLinking || []).length === 0 ? (
                    <div className="text-center py-12 card-3d bg-slate-800/50 border-slate-700">
                      <div className="text-5xl mb-4">✅</div>
                      <p className="text-lg font-black text-emerald-400">¡Tus páginas están bien conectadas!</p>
                      <p className="text-sm font-bold text-slate-400 mt-2">No detectamos páginas perdidas que necesiten un empujón.</p>
                    </div>
                  ) : (
                    (auditResults.audit?.internalLinking || []).map((item, index) => {
                      const identifier = `${item.fromPage}-${item.toPage}`;
                      const completed = isFixCompleted("link", identifier);
                      return (
                        <div key={index} className={`card-3d p-5 md:p-6 space-y-4 ${completed ? 'bg-emerald-950/30 border-emerald-500/40' : 'bg-slate-800 border-slate-700/50'}`}>
                          <div className="flex items-center gap-3">
                            <span className="text-3xl">{completed ? '✅' : '🔗'}</span>
                            <h3 className="text-lg font-black text-white">Crear puente de tráfico</h3>
                          </div>
                          <div className="bg-slate-100 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-700 rounded-xl p-4">
                            <p className="text-slate-300 font-bold text-sm leading-relaxed">{item.reason}</p>
                          </div>
                          <div className="space-y-2 text-xs font-mono">
                            <div className="flex items-center gap-2 text-slate-500">
                              <span className="text-emerald-400 font-black text-sm">DESDE →</span>
                              <span className="break-all">{item.fromPage}</span>
                            </div>
                            <div className="flex items-center gap-2 text-slate-500">
                              <span className="text-purple-400 font-black text-sm">HACIA →</span>
                              <span className="break-all">{item.toPage}</span>
                            </div>
                          </div>
                          <div className="bg-purple-950/30 border border-purple-800/50 rounded-xl p-3">
                            <p className="text-xs font-black text-purple-300 uppercase mb-1">Texto sugerido para el enlace:</p>
                            <p className="text-base font-black text-white">"{item.suggestedAnchor}"</p>
                          </div>
                          {completed ? (
                            <button disabled className="w-full py-3 rounded-xl border border-green-500/35 bg-green-950/20 text-green-400 font-black cursor-not-allowed text-base">
                              ✅ Puente Creado (+15 XP)
                            </button>
                          ) : (
                            <button
                              onClick={() => handleVerifyFix("link", identifier)}
                              className="w-full btn-3d bg-amber-500 border-amber-600 border-b-4 hover:bg-amber-450 active:border-b-0 active:translate-y-1 text-white font-black py-3 text-base transition-all"
                            >
                              ✅ YA LO ARREGLÉ
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* Tab Content: Broken Links */}
              {activeTab === "brokenLinks" && (
                <div className="space-y-4">
                  {(auditResults.audit?.brokenLinks || []).length === 0 ? (
                    <div className="text-center py-12 card-3d bg-slate-800/50 border-slate-700">
                      <div className="text-5xl mb-4">✅</div>
                      <p className="text-lg font-black text-emerald-400">¡Cero enlaces rotos!</p>
                      <p className="text-sm font-bold text-slate-400 mt-2">Ningún cliente se va a perder por un link que no funciona.</p>
                    </div>
                  ) : (
                    (auditResults.audit?.brokenLinks || []).map((item, index) => {
                      const identifier = `${item.page}-${item.brokenUrl}`;
                      const completed = isFixCompleted("broken", identifier);
                      return (
                        <div key={index} className={`card-3d p-5 md:p-6 space-y-4 ${completed ? 'bg-emerald-950/30 border-emerald-500/40' : 'bg-slate-800 border-slate-700/50'}`}>
                          <div className="flex items-center gap-3">
                            <span className="text-3xl">{completed ? '✅' : '💀'}</span>
                            <h3 className="text-lg font-black text-white">Fuga de clientes detectada</h3>
                          </div>
                          <div className="bg-slate-100 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-700 rounded-xl p-4">
                            <p className="text-slate-300 font-bold text-sm leading-relaxed">{item.suggestion}</p>
                          </div>
                          <div className="space-y-2 text-xs font-mono">
                            <div className="text-slate-500">
                              <span className="text-slate-400 font-black text-sm">📄 Página:</span> <span className="break-all">{item.page}</span>
                            </div>
                            <div className="text-red-400">
                              <span className="font-black text-sm">💀 Link roto:</span> <span className="break-all">{item.brokenUrl}</span>
                              <span className="ml-2 bg-red-500/20 border border-red-500/30 text-red-300 text-[10px] px-2 py-0.5 rounded-full font-black">Error {item.statusCode || "?"}</span>
                            </div>
                            <div className="text-slate-500">
                              <span className="text-slate-400 font-black text-sm">📝 Texto actual:</span> "{item.anchorText}"
                            </div>
                          </div>
                          {completed ? (
                            <button disabled className="w-full py-3 rounded-xl border border-green-500/35 bg-green-950/20 text-green-400 font-black cursor-not-allowed text-base">
                              ✅ Fuga Reparada (+15 XP)
                            </button>
                          ) : (
                            <button
                              onClick={() => handleVerifyFix("broken", identifier)}
                              className="w-full btn-3d bg-amber-500 border-amber-600 border-b-4 hover:bg-amber-450 active:border-b-0 active:translate-y-1 text-white font-black py-3 text-base transition-all"
                            >
                              ✅ YA LO ARREGLÉ
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* Tab Content: Anchor Text */}
              {activeTab === "anchorText" && (
                <div className="space-y-4">
                  {(auditResults.audit?.anchorText || []).length === 0 ? (
                    <div className="text-center py-12 card-3d bg-slate-800/50 border-slate-700">
                      <div className="text-5xl mb-4">✅</div>
                      <p className="text-lg font-black text-emerald-400">¡Todos tus textos de enlace son claros!</p>
                      <p className="text-sm font-bold text-slate-400 mt-2">Google entiende perfectamente a dónde va cada enlace.</p>
                    </div>
                  ) : (
                    (auditResults.audit?.anchorText || []).map((item, index) => {
                      const identifier = `${item.page}-${item.linkTo}`;
                      const completed = isFixCompleted("anchor", identifier);
                      return (
                        <div key={index} className={`card-3d p-5 md:p-6 space-y-4 ${completed ? 'bg-emerald-950/30 border-emerald-500/40' : 'bg-slate-800 border-slate-700/50'}`}>
                          <div className="flex items-center gap-3">
                            <span className="text-3xl">{completed ? '✅' : '✍️'}</span>
                            <h3 className="text-lg font-black text-white">Texto de enlace mejorable</h3>
                          </div>
                          <div className="bg-slate-100 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-700 rounded-xl p-4">
                            <p className="text-slate-300 font-bold text-sm leading-relaxed">{item.reason}</p>
                          </div>
                          <div className="text-xs font-mono text-slate-500">
                            📄 Página: <span className="break-all">{item.page}</span>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="bg-red-950/20 border border-red-800/30 rounded-xl p-3">
                              <p className="text-[10px] font-black text-red-400 uppercase mb-1">Texto Actual ❌</p>
                              <p className="text-sm font-black text-red-300">"{item.currentAnchor}"</p>
                            </div>
                            <div className="bg-emerald-950/20 border border-emerald-800/30 rounded-xl p-3">
                              <p className="text-[10px] font-black text-emerald-400 uppercase mb-1">Texto Sugerido ✅</p>
                              <p className="text-sm font-black text-emerald-300">"{item.suggestedAnchor}"</p>
                            </div>
                          </div>
                          {completed ? (
                            <button disabled className="w-full py-3 rounded-xl border border-green-500/35 bg-green-950/20 text-green-400 font-black cursor-not-allowed text-base">
                              ✅ Texto Mejorado (+15 XP)
                            </button>
                          ) : (
                            <button
                              onClick={() => handleVerifyFix("anchor", identifier)}
                              className="w-full btn-3d bg-amber-500 border-amber-600 border-b-4 hover:bg-amber-450 active:border-b-0 active:translate-y-1 text-white font-black py-3 text-base transition-all"
                            >
                              ✅ YA LO ARREGLÉ
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* ═══ INDEXATION STEP (Final) ═══ */}
              <div className="w-full bg-white dark:bg-slate-900 rounded-3xl border-2 border-slate-200 dark:border-slate-700 p-6 md:p-8 space-y-6 mt-8">
                <div className="flex flex-col md:flex-row items-center gap-4 border-b border-slate-800 pb-6 justify-between">
                  <div>
                    <h2 className="text-xl md:text-2xl font-black text-white flex items-center gap-3">
                      📡 Paso Final: Avisarle a Google
                    </h2>
                    <p className="text-sm font-bold text-slate-400 mt-1">
                      Después de arreglar los problemas, pedile a Google que vuelva a escanear tu sitio.
                    </p>
                  </div>
                  <div className="bg-purple-900/50 border border-purple-600/50 rounded-full px-4 py-1.5 text-xs font-black text-purple-300 uppercase tracking-wider flex-shrink-0">
                    Indexación
                  </div>
                </div>

                {indexingStatus !== "success" ? (
                  <div className="space-y-6">
                    <div className="p-5 bg-purple-950/20 border-2 border-purple-800/60 rounded-2xl space-y-2">
                      <h4 className="font-black text-purple-300 text-base flex items-center gap-2">
                        💡 ¿Qué significa esto?
                      </h4>
                      <p className="text-sm font-bold text-slate-400 leading-relaxed">
                        Normalmente, Google puede tardar semanas en notar tus mejoras. Al usar esta herramienta, le enviamos una alerta directa a sus robots para que escaneen y actualicen tu posición hoy mismo.
                      </p>
                    </div>

                    <div className="bg-slate-800/80 rounded-2xl border border-slate-750 p-6 space-y-4">
                      <h3 className="text-lg font-black text-white flex items-center gap-2">
                        📋 Verificaciones antes de enviar
                      </h3>
                      <div className="space-y-4">
                        <label className="flex items-start gap-4 cursor-pointer select-none group">
                          <input type="checkbox" checked={h1Checked}
                            onChange={(e) => { playClick(); setH1Checked(e.target.checked); }}
                            className="w-6 h-6 rounded-md border-2 border-slate-300 dark:border-slate-650 bg-white dark:bg-slate-900 checked:bg-green-500 checked:border-green-600 accent-green-500 mt-0.5"
                          />
                          <span className="text-base font-bold text-slate-400 group-hover:text-white transition-colors leading-snug">
                            Ya actualicé los títulos y textos de mis páginas.
                          </span>
                        </label>
                        <label className="flex items-start gap-4 cursor-pointer select-none group">
                          <input type="checkbox" checked={keywordChecked}
                            onChange={(e) => { playClick(); setKeywordChecked(e.target.checked); }}
                            className="w-6 h-6 rounded-md border-2 border-slate-300 dark:border-slate-650 bg-white dark:bg-slate-900 checked:bg-green-500 checked:border-green-600 accent-green-500 mt-0.5"
                          />
                          <span className="text-base font-bold text-slate-400 group-hover:text-white transition-colors leading-snug">
                            Ya arreglé los enlaces rotos o genéricos que detectó el Detective.
                          </span>
                        </label>
                        <label className="flex items-start gap-4 cursor-pointer select-none group">
                          <input type="checkbox" checked={savedChecked}
                            onChange={(e) => { playClick(); setSavedChecked(e.target.checked); }}
                            className="w-6 h-6 rounded-md border-2 border-slate-300 dark:border-slate-650 bg-white dark:bg-slate-900 checked:bg-green-500 checked:border-green-600 accent-green-500 mt-0.5"
                          />
                          <span className="text-base font-bold text-slate-400 group-hover:text-white transition-colors leading-snug">
                            Guardé y publiqué todos los cambios en mi plataforma.
                          </span>
                        </label>
                      </div>
                    </div>

                    <button
                      disabled={!allChecked || indexingStatus === "loading"}
                      onClick={handleRequestIndex}
                      className={`w-full btn-3d font-black py-4 text-lg flex items-center justify-center gap-2.5 transition-all ${
                        allChecked
                          ? "bg-green-500 border-green-600 border-b-4 hover:bg-green-450 active:border-b-0 active:translate-y-1 text-white shadow-lg shadow-green-500/20"
                          : "bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed opacity-50"
                      }`}
                    >
                      {indexingStatus === "loading" ? "📡 ENVIANDO ALERTA A GOOGLE..." : "📡 Solicitar Indexación a Google"}
                    </button>

                    {indexingError && (
                      <div className="p-4 bg-red-950/20 border-2 border-red-800 text-red-400 rounded-xl font-bold text-sm text-center">
                        ⚠️ {indexingError}
                      </div>
                    )}

                    {indexingStatus === "idle" && (
                      <p className="text-xs text-slate-550 text-center font-bold">
                        ⚠️ Asegurate de marcar todas las casillas antes de enviar.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="bg-emerald-950/20 border-2 border-emerald-800/60 rounded-2xl p-6 md:p-8 text-center space-y-4 animate-in zoom-in-95 duration-300">
                    <div className="text-6xl animate-bounce">🚀</div>
                    <h3 className="text-2xl font-black text-emerald-400">¡Lanzamiento Autorizado!</h3>
                    <p className="text-base font-bold text-slate-300 leading-relaxed max-w-lg mx-auto">
                      Le enviamos una señal de indexación prioritaria a Google. Sus robots volverán a escanear tu URL en las próximas horas.
                    </p>
                    <div className="text-yellow-400 font-black text-lg">
                      ¡Ganaste +50 XP por completar el Lanzamiento! 🏆
                    </div>
                  </div>
                )}
              </div>

              {/* Re-scan button */}
              <div className="text-center">
                <button
                  onClick={() => { setScanState("idle"); setAuditResults(null); setAuditError(null); localStorage.removeItem("seojump_detective_audit"); playClick(); }}
                  className="btn-3d btn-white !py-2 !px-4 text-xs font-black text-slate-500 hover:text-purple-500 transition-colors uppercase tracking-wider"
                >
                  🔄 Volver a Escanear
                </button>
              </div>
            </div>

          ) : null}

        </div>
      </div>
    </div>
  );
}
