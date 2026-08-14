"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useAudio } from "../../hooks/useAudio";
import { useTheme } from "../../hooks/useTheme";
import { verifyContentMission, checkIsAdmin } from "../../lib/actions";
import { getPhaseProgress, syncStateWithServer, pullStateFromServer } from "../../lib/progression";
import { cleanStoredKeyword, isUrlLikeKeyword } from "../../lib/keywordUtils";
import Link from "next/link";
import Header from "../../components/Header";
import HumanScorePanel from "../../components/HumanScorePanel";
import ComprehensionPanel from "../../components/ComprehensionPanel";

function Phase2NextSteps({ playClick }) {
  return (
    <div className="p-6 rounded-2xl border-2 border-blue-500/40 bg-gradient-to-br from-blue-950/40 to-slate-900 space-y-4 animate-in fade-in duration-300">
      <div>
        <p className="text-xs font-black text-blue-300 uppercase tracking-wider mb-1">Fase 2 completada</p>
        <h4 className="text-xl font-black text-white">¿Y ahora qué?</h4>
        <p className="text-sm font-bold text-slate-300 leading-relaxed mt-2">
          El siguiente paso es <strong className="text-white">optimizar tu página</strong> (título, meta, H1) y ver cómo te comparás con la competencia en Google.
        </p>
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          href="/optimizacion"
          onClick={playClick}
          className="flex-1 btn-3d btn-green text-center py-3.5 px-5 text-sm md:text-base font-black"
        >
          🛠️ Ir a Fase 3 — Optimización
        </Link>
        <Link
          href="/espia-competencia"
          onClick={playClick}
          className="flex-1 btn-3d btn-blue text-center py-3.5 px-5 text-sm md:text-base font-black"
        >
          🕵️ Comparar con competencia
        </Link>
      </div>
      <p className="text-xs font-bold text-slate-500 text-center">
        También podés volver al <Link href="/" onClick={playClick} className="text-duo-green hover:underline">tablero principal</Link> — la Fase 3 ya está desbloqueada.
      </p>
    </div>
  );
}

// Helper to sanitize/purify text
const purifyText = (text) => {
  if (!text) return "";
  let clean = text;
  clean = clean
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
  clean = clean
    .replace(/Ã±/g, "ñ")
    .replace(/Ã‘/g, "Ñ")
    .replace(/Ã¡/g, "á")
    .replace(/Ã©/g, "é")
    .replace(/Ã­/g, "í")
    .replace(/Ã³/g, "ó")
    .replace(/Ãº/g, "ú")
    .replace(/\uFFFD/g, "ñ");
  return clean.trim().replace(/\s+/g, " ");
};

export default function ContenidoFase2() {
  const { data: session, status } = useSession();
  const { isMuted, toggleMute, playClick, playThemeToggle, playSuccess, playLevelUp } = useAudio();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();

  const [xp, setXp] = useState(0);
  const [siteUrl, setSiteUrl] = useState("");
  const [activeKeyword, setActiveKeyword] = useState("");
  const [editingKeyword, setEditingKeyword] = useState(false);
  const [keywordDraft, setKeywordDraft] = useState("");
  const [completedMissions, setCompletedMissions] = useState(new Set());
  const [hasMissions, setHasMissions] = useState(false);
  const [prog, setProg] = useState(null);
  const [prestigeCycles, setPrestigeCycles] = useState(0);
  const [serverLoading, setServerLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAdminResolved, setIsAdminResolved] = useState(false);

  // Track Level Up sound
  const prevXpRef = useRef(0);
  useEffect(() => {
    if (prevXpRef.current > 0 && Math.floor(xp / 100) > Math.floor(prevXpRef.current / 100)) {
      playLevelUp();
    }
    prevXpRef.current = xp;
  }, [xp, playLevelUp]);
  
  // Layout states
  const [selectedPath, setSelectedPath] = useState(null); // 'A' or 'B'
  const [targetUrl, setTargetUrl] = useState("");
  const [auditing, setAuditing] = useState(false);
  const [auditResult, setAuditResult] = useState(null);
  const [createMarked, setCreateMarked] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  // Load state from server/localStorage on mount
  useEffect(() => {
    const init = async () => {
      try {
        setServerLoading(true);
        if (session) {
          const serverState = await pullStateFromServer();
          if (serverState) {
            setXp(serverState.xp || 0);
            setSiteUrl(serverState.site_url || '');
            setTargetUrl(serverState.site_url || '');
            setActiveKeyword(cleanStoredKeyword(purifyText(serverState.gold_query || '')));
            setCompletedMissions(new Set(serverState.completed_missions || []));
            setPrestigeCycles(serverState.ciclos_prestigio || 0);
            setHasMissions((serverState.missions || []).length > 0);

            const completedSet = new Set(serverState.completed_missions || []);
            const p = getPhaseProgress(
              completedSet,
              serverState.gold_suggestions,
              serverState.missions,
              serverState.gold_query,
              serverState.site_url,
              isAdmin
            );
            setProg(p);
            return;
          }
        }

        const savedXp = localStorage.getItem('seojump_xp');
        const currentXp = savedXp ? parseInt(savedXp, 10) : 0;
        setXp(currentXp);

        const savedUrl = localStorage.getItem('seojump_site_url');
        if (savedUrl) {
          setSiteUrl(savedUrl);
          setTargetUrl(savedUrl);
        }

        const savedKeyword = cleanStoredKeyword(localStorage.getItem('gold-tu-busqueda'));
        if (savedKeyword) {
          setActiveKeyword(purifyText(savedKeyword));
        } else if (localStorage.getItem('gold-tu-busqueda')) {
          // La keyword guardada era una URL u otro valor inválido: la limpiamos
          localStorage.removeItem('gold-tu-busqueda');
        }

        const prestige = parseInt(localStorage.getItem('seojump_prestigio_cycles') || '0', 10);
        setPrestigeCycles(prestige);

        const savedCompleted = localStorage.getItem('seojump_completed_missions');
        let completedList = [];
        if (savedCompleted) {
          try {
            const parsed = JSON.parse(savedCompleted);
            if (Array.isArray(parsed)) { completedList = parsed; setCompletedMissions(new Set(parsed)); }
          } catch (e) {}
        }
        const completedSet = new Set(completedList);

        const savedMissions = localStorage.getItem('seojump_missions');
        let missionsList = [];
        if (savedMissions) {
          try {
            const parsed = JSON.parse(savedMissions);
            if (Array.isArray(parsed) && parsed.length > 0) { missionsList = parsed; setHasMissions(true); }
          } catch (e) {}
        }

        let suggestions = [];
        const savedSuggestions = localStorage.getItem('gold-suggestions');
        if (savedSuggestions) { try { suggestions = JSON.parse(savedSuggestions); } catch (e) {} }

        const p = getPhaseProgress(completedSet, suggestions, missionsList, savedKeyword, savedUrl, isAdmin);
        setProg(p);
      } catch (err) {
        console.error('[contenido] init error:', err);
      } finally {
        setServerLoading(false); // SIEMPRE liberamos el spinner
      }
    };
    init();
  }, [session]);

  // ── Resolver admin status de forma independiente y TEMPRANA ──────────────
  // Corre en cuanto status deja de ser 'loading'. No espera al init() completo.
  // isAdminResolved=false bloquea los guards de redirección hasta que esto resuelva.
  useEffect(() => {
    if (status === 'loading') return;
    checkIsAdmin()
      .then(result => { setIsAdmin(result); setIsAdminResolved(true); })
      .catch(() => { setIsAdmin(false); setIsAdminResolved(true); });
  }, [status]);

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
    const p = getPhaseProgress(completedMissions, suggestions, missions, activeKeyword, siteUrl, isAdmin);
    setProg(p);
  }, [completedMissions, activeKeyword, siteUrl, isAdmin]);

  // Lock protection: redirect if Phase 2 is locked
  // FRENO TRIPLE: esperar (1) sesión, (2) admin resuelto, (3) que no sea admin
  useEffect(() => {
    if (status === 'loading') return;       // sesión todavía cargando
    if (!isAdminResolved) return;           // esperar que checkIsAdmin() termine
    if (isAdmin) return;                    // admins siempre tienen acceso
    if (prog && !prog.p2.unlocked) {
      router.push('/buscador-de-oro');
    }
  }, [prog, router, status, isAdmin, isAdminResolved]);

  // Auth Protection
  useEffect(() => {
    if (!session && status !== "loading") {
      router.push("/");
    }
  }, [session, status, router]);

  const startEditKeyword = () => {
    playClick();
    setKeywordDraft(activeKeyword);
    setEditingKeyword(true);
  };

  const saveEditedKeyword = () => {
    const val = (keywordDraft || "").trim();
    if (!val) return;
    if (isUrlLikeKeyword(val)) {
      alert('Eso parece una URL, no una palabra clave 😉. Escribí lo que buscaría tu cliente en Google, ej: "shampoo para autos".');
      return;
    }
    if (playClick) playClick();
    localStorage.setItem('gold-tu-busqueda', val);
    setActiveKeyword(val);
    setEditingKeyword(false);
    setAuditResult(null);
    setTimeout(() => { syncStateWithServer(); }, 100);
  };

  const handleCreateComplete = () => {
    playClick();
    const missionId = `fase2-create-${activeKeyword}`;
    if (completedMissions.has(missionId)) {
      alert("Ya completaste esta acción para esta palabra clave.");
      return;
    }

    const newXp = xp + 30;
    setXp(newXp);
    localStorage.setItem("seojump_xp", newXp);

    setCompletedMissions(prev => {
      const updated = new Set([...prev, missionId]);
      localStorage.setItem("seojump_completed_missions", JSON.stringify(Array.from(updated)));
      setTimeout(() => {
        syncStateWithServer();
      }, 100);
      return updated;
    });

    setShowConfetti(true);
    playSuccess();
    setTimeout(() => setShowConfetti(false), 3000);
    setCreateMarked(true);
  };

  // Completado de una Misión Human (valor humano): suma XP y persiste igual que
  // el resto de misiones de la fase (localStorage + sync con servidor).
  const handleHumanMissionComplete = (missionId, xpGain) => {
    if (completedMissions.has(missionId)) return;
    const newXp = xp + (xpGain || 0);
    setXp(newXp);
    localStorage.setItem("seojump_xp", newXp);
    setCompletedMissions((prev) => {
      const updated = new Set([...prev, missionId]);
      localStorage.setItem("seojump_completed_missions", JSON.stringify(Array.from(updated)));
      setTimeout(() => { syncStateWithServer(); }, 100);
      return updated;
    });
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 3000);
  };

  const handleAudit = async (e) => {
    e.preventDefault();
    if (!targetUrl.trim()) return;

    playClick();
    setAuditing(true);
    setAuditResult(null);

    try {
      // Reuse verifyContentMission to check if the keyword is on the live page
      const result = await verifyContentMission(targetUrl, activeKeyword);
      
      if (result.success) {
        setAuditResult({ success: true, message: "¡Espectacular! Encontramos la palabra clave en el contenido de tu URL en vivo." });
        const missionId = `fase2-improve-${activeKeyword}`;
        
        if (!completedMissions.has(missionId)) {
          const newXp = xp + 50;
          setXp(newXp);
          localStorage.setItem("seojump_xp", newXp);

          setCompletedMissions(prev => {
            const updated = new Set([...prev, missionId]);
            localStorage.setItem("seojump_completed_missions", JSON.stringify(Array.from(updated)));
            setTimeout(() => {
              syncStateWithServer();
            }, 100);
            return updated;
          });
          
          setShowConfetti(true);
          playSuccess();
          setTimeout(() => setShowConfetti(false), 3000);
        }
      } else {
        setAuditResult({ 
          success: false, 
          message: "No logramos detectar la palabra clave en tu contenido. Asegúrate de incluirla en tu artículo y vaciar la caché de WordPress." 
        });
      }
    } catch (err) {
      setAuditResult({ success: false, message: "Error al intentar conectar con la URL: " + err.message });
    } finally {
      setAuditing(false);
    }
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
    <div className="flex-1 flex flex-col items-center p-4 md:p-8 overflow-y-auto animate-in slide-in-from-bottom duration-500 w-full max-w-7xl mx-auto space-y-8 bg-transparent transition-colors duration-300 text-slate-100 min-h-screen relative font-fredoka">
      <div className="fixed inset-0 pointer-events-none bg-glow-sapphire opacity-60 z-[-1]"></div>
      
      {/* Confetti Effect */}
      {showConfetti && (
        <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden">
          {[...Array(20)].map((_, i) => (
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
              {['✨', '🎉', '🏆', '⭐', '🪙'][Math.floor(Math.random() * 5)]}
            </div>
          ))}
        </div>
      )}

      {/* Navigation Header */}
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
        activePhase={2}
        isAdmin={isAdmin}
      />

      {/* Main Content */}
      <div className="w-full text-center space-y-4 max-w-3xl mx-auto mt-4 relative">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-blue-500/20 blur-3xl rounded-full pointer-events-none"></div>
        <h1 className="text-4xl lg:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-b from-blue-300 to-blue-600 drop-shadow-md">
          Fase 2: Estrategia de Contenido ✍️
        </h1>
        <p className="text-xl lg:text-2xl font-bold text-blue-100 drop-shadow-sm">
          Decidí el mejor camino para conquistar Google utilizando tu palabra clave de oro.
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

      {activeKeyword ? (
        <div className="w-full max-w-4xl mx-auto space-y-8">
          {/* Active Keyword Card */}
          <div className="relative overflow-hidden card-3d p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 border-2 border-blue-500/40 bg-slate-900 shadow-[0_0_30px_rgba(59,130,246,0.15)] group">
            {/* Glow effects */}
            <div className="absolute top-0 left-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-blue-500/20 transition-all duration-500" />
            <div className="absolute bottom-0 right-0 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-indigo-500/20 transition-all duration-500" />
            
            <div className="relative z-10 w-full md:w-auto">
              <p className="text-xs md:text-sm font-black text-blue-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                <span>🎯</span> Palabra clave de esta página
              </p>
              {editingKeyword ? (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mt-1">
                  <input
                    type="text"
                    autoFocus
                    value={keywordDraft}
                    onChange={(e) => setKeywordDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') saveEditedKeyword(); if (e.key === 'Escape') setEditingKeyword(false); }}
                    placeholder="Ej: shampoo para autos"
                    className="w-full sm:w-96 p-3 md:p-4 text-lg md:text-2xl font-black rounded-xl bg-slate-800 text-white border-2 border-blue-500/60 focus:border-blue-400 outline-none"
                  />
                  <div className="flex gap-2">
                    <button onClick={saveEditedKeyword} className="btn-3d btn-green text-sm md:text-base font-black py-3 px-5">Guardar</button>
                    <button onClick={() => { playClick(); setEditingKeyword(false); }} className="btn-3d btn-white text-sm md:text-base font-black py-3 px-5 border-slate-700 text-slate-300 hover:text-white">Cancelar</button>
                  </div>
                </div>
              ) : (
                <>
                  <h2 className="text-3xl md:text-4xl lg:text-5xl font-black text-white drop-shadow-md">"{activeKeyword}"</h2>
                  <p className="text-xs md:text-sm font-bold text-slate-400 mt-2">
                    No tiene que ser la misma de Fase 1: usá la que mejor describe <span className="text-slate-200">esta</span> página.
                  </p>
                </>
              )}
            </div>
            
            {!editingKeyword && (
              <div className="relative z-10 w-full md:w-auto mt-4 md:mt-0 flex flex-col gap-2">
                <button onClick={startEditKeyword} className="btn-3d btn-blue w-full md:w-auto text-sm md:text-base font-black py-3 px-6 flex items-center justify-center gap-2">
                  <span>✏️</span> Cambiar palabra acá
                </button>
                <Link href="/buscador-de-oro" onClick={playClick} className="text-xs md:text-sm font-bold text-slate-400 hover:text-white text-center underline">
                  🔍 Buscar ideas en Fase 1
                </Link>
              </div>
            )}
          </div>

          {/* Owl Introduction */}
          <div className="relative flex flex-col md:flex-row items-center md:items-start gap-4 md:gap-6 bg-gradient-to-r from-amber-500/10 to-transparent dark:from-amber-500/5 dark:to-transparent p-6 md:p-8 rounded-3xl border-2 border-amber-200 dark:border-amber-800/40 shadow-sm animate-in fade-in duration-500">
            <div className="bg-amber-100 dark:bg-amber-900/30 w-20 h-20 md:w-24 md:h-24 rounded-2xl flex items-center justify-center flex-shrink-0 border-2 border-amber-300 dark:border-amber-700/50 shadow-inner">
               <img src="/images/logo-owl.png" alt="SEO Jump" className="w-14 h-14 md:w-16 md:h-16 object-contain animate-bounce" />
            </div>
            <div className="flex-1 text-center md:text-left space-y-2 md:space-y-3 mt-2 md:mt-0">
              <p className="font-black text-amber-600 dark:text-amber-400 text-xl lg:text-2xl leading-tight">
                ¡Tenemos la palabra clave de oro!
              </p>
              <p className="text-base lg:text-lg text-slate-600 dark:text-slate-300 font-bold leading-relaxed">
                Ahora necesitamos una página web dedicada en tu sitio. ¿Esta página ya existe o necesitas crearla desde cero? Elige un camino para continuar.
              </p>
            </div>
          </div>

          {/* Logic Fork Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Camino A (Crear) */}
            <div 
              onClick={() => { playClick(); setSelectedPath('A'); }}
              className={`group card-3d cursor-pointer flex flex-col justify-between p-6 md:p-8 transition-all duration-300 relative overflow-hidden ${
                selectedPath === 'A' 
                  ? 'border-emerald-400 bg-slate-900 shadow-[0_0_30px_rgba(16,185,129,0.2)]' 
                  : 'bg-white dark:bg-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700/50'
              }`}
            >
              {selectedPath === 'A' && (
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/40 to-transparent pointer-events-none" />
              )}
              <div className="space-y-4 relative z-10 text-center md:text-left">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-4xl mb-4 md:mb-6 shadow-sm mx-auto md:mx-0 ${selectedPath === 'A' ? 'bg-emerald-500/20 border-2 border-emerald-500/50' : 'bg-slate-100 dark:bg-slate-700'}`}>
                  📝
                </div>
                <h3 className={`text-2xl lg:text-3xl font-black ${selectedPath === 'A' ? 'text-white' : 'text-slate-800 dark:text-slate-100'}`}>
                  Camino A: No tengo esta página
                </h3>
                <p className={`text-base lg:text-lg font-bold leading-relaxed ${selectedPath === 'A' ? 'text-emerald-100/80' : 'text-slate-500 dark:text-slate-400'}`}>
                  Quiero crear un nuevo artículo de blog, una página estática o un producto optimizado desde cero en mi WordPress.
                </p>
              </div>
              <div className="mt-8 relative z-10">
                <button className={`w-full py-3.5 md:py-4 text-base md:text-lg lg:text-xl font-black transition-all duration-300 ${
                  selectedPath === 'A' 
                    ? 'btn-3d btn-green shadow-[0_0_20px_rgba(16,185,129,0.4)]' 
                    : 'btn-3d btn-white w-full group-hover:bg-slate-50 dark:group-hover:bg-slate-700 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                }`}>
                  {selectedPath === 'A' ? '✓ Camino Elegido' : 'Elegir Crear'}
                </button>
              </div>
            </div>

            {/* Camino B (Mejorar) */}
            <div 
              onClick={() => { playClick(); setSelectedPath('B'); }}
              className={`group card-3d cursor-pointer flex flex-col justify-between p-6 md:p-8 transition-all duration-300 relative overflow-hidden ${
                selectedPath === 'B' 
                  ? 'border-blue-400 bg-slate-900 shadow-[0_0_30px_rgba(59,130,246,0.2)]' 
                  : 'bg-white dark:bg-slate-800 hover:border-blue-300 dark:hover:border-blue-700/50'
              }`}
            >
              {selectedPath === 'B' && (
                <div className="absolute inset-0 bg-gradient-to-br from-blue-900/40 to-transparent pointer-events-none" />
              )}
              <div className="space-y-4 relative z-10 text-center md:text-left">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-4xl mb-4 md:mb-6 shadow-sm mx-auto md:mx-0 ${selectedPath === 'B' ? 'bg-blue-500/20 border-2 border-blue-500/50' : 'bg-slate-100 dark:bg-slate-700'}`}>
                  🔧
                </div>
                <h3 className={`text-2xl lg:text-3xl font-black ${selectedPath === 'B' ? 'text-white' : 'text-slate-800 dark:text-slate-100'}`}>
                  Camino B: Ya tengo esta página
                </h3>
                <p className={`text-base lg:text-lg font-bold leading-relaxed ${selectedPath === 'B' ? 'text-blue-100/80' : 'text-slate-500 dark:text-slate-400'}`}>
                  Ya tengo una URL publicada con contenido similar y quiero auditarla para verificar si tiene la palabra clave.
                </p>
              </div>
              <div className="mt-8 relative z-10">
                <button className={`w-full py-3.5 md:py-4 text-base md:text-lg lg:text-xl font-black transition-all duration-300 ${
                  selectedPath === 'B' 
                    ? 'btn-3d btn-blue shadow-[0_0_20px_rgba(59,130,246,0.4)]' 
                    : 'btn-3d btn-white w-full group-hover:bg-slate-50 dark:group-hover:bg-slate-700 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                }`}>
                  {selectedPath === 'B' ? '✓ Camino Elegido' : 'Elegir Auditar'}
                </button>
              </div>
            </div>

          </div>

          {/* Dynamic Content based on selected path */}
          {selectedPath === 'A' && (
            <div className="card-3d bg-white dark:bg-slate-800 p-10 space-y-6 text-left animate-in slide-in-from-top duration-300">
              <h3 className="text-3xl lg:text-4xl font-black text-slate-800 dark:text-slate-150">📝 Instrucciones para crear tu contenido</h3>
              
              <div className="space-y-4 text-slate-650 dark:text-slate-300 font-bold text-base lg:text-lg leading-relaxed">
                <p>Google ama el contenido fresco y súper enfocado. Para capturar la palabra clave <strong className="text-blue-600 font-black">"{activeKeyword}"</strong>, seguí esta receta en tu WordPress:</p>
                
                <ul className="space-y-4 pl-6 list-decimal">
                  <li>
                    <strong className="text-slate-800 dark:text-white font-black">Creá la entrada/producto:</strong> Andá a tu WordPress y hacé clic en <span className="underline">Añadir Nueva Entrada/Página</span>.
                  </li>
                  <li>
                    <strong className="text-slate-800 dark:text-white font-black">Título de impacto (H1):</strong> Colocá la frase exacta <span className="bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded text-blue-500 font-black">"{activeKeyword}"</span> en el título. Ej: <em>"Los mejores paños de microfibra por mayor en Buenos Aires"</em>.
                  </li>
                  <li>
                    <strong className="text-slate-800 dark:text-white font-black">Escribí al menos 300 palabras:</strong> Explicá las ventajas, precios y envíos de tu servicio usando la palabra clave de forma natural.
                  </li>
                  <li>
                    <strong className="text-slate-800 dark:text-white font-black">Publicá y Copiá la URL:</strong> Guardá los cambios y hacé pública la página.
                  </li>
                </ul>
              </div>

              <div className="border-t-2 border-slate-100 dark:border-slate-700 pt-6 flex flex-col sm:flex-row gap-4 items-center justify-between">
                <p className="text-sm lg:text-base text-slate-500 font-black">Al marcar como creado acumularás puntos de entrenamiento.</p>
                <button 
                  onClick={handleCreateComplete}
                  className="btn-3d btn-green py-4 px-8 text-base md:text-lg lg:text-xl font-black w-full sm:w-auto rounded-xl"
                >
                  ¡MARCAR COMO CREADO! (+30 XP)
                </button>
              </div>

              {createMarked && (
                <Phase2NextSteps playClick={playClick} />
              )}
            </div>
          )}

          {selectedPath === 'B' && (
            <div className="card-3d bg-white dark:bg-slate-800 p-10 space-y-6 text-left animate-in slide-in-from-top duration-300">
              <h3 className="text-3xl lg:text-4xl font-black text-slate-800 dark:text-slate-150">🔧 Auditar página existente</h3>
              <p className="text-base lg:text-lg font-bold text-slate-600 dark:text-slate-400">
                Pega la URL específica de tu artículo o producto para que el Búho escanee si ya incluiste tu palabra de oro.
              </p>

              <form onSubmit={handleAudit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm lg:text-base font-black text-slate-550 uppercase">URL de tu artículo a auditar:</label>
                  <input 
                    type="text"
                    value={targetUrl}
                    onChange={(e) => setTargetUrl(e.target.value)}
                    placeholder="Ej: https://tusitio.com/productos/microfibra"
                    className="w-full p-5 text-base md:text-lg lg:text-xl border-2 border-slate-200 dark:border-slate-700 rounded-xl focus:border-blue-500 outline-none font-bold text-slate-700 bg-gray-50 dark:bg-slate-900 dark:text-slate-200 transition-colors"
                  />
                </div>
                <button 
                  type="submit" 
                  disabled={auditing || !targetUrl.trim()}
                  className={`w-full py-5 text-base md:text-lg lg:text-xl flex items-center justify-center gap-2 rounded-xl border font-black transition-all duration-200 shadow-sm ${
                    auditing
                      ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed dark:bg-slate-800 dark:border-slate-700'
                      : 'bg-slate-700 border-slate-800 text-white hover:bg-slate-600 hover:ring-2 hover:ring-slate-300 dark:bg-indigo-950/50 dark:border-indigo-850/80 dark:text-indigo-200 dark:hover:bg-indigo-900/60 dark:hover:text-white dark:hover:ring-2 dark:hover:ring-indigo-950'
                  }`}
                >
                  <span>{auditing ? '⏳ Auditando sitio...' : '🔍 Auditar mi Página'}</span>
                </button>
              </form>

              {auditResult && (
                <div className="space-y-4">
                  <div className={`p-4 rounded-xl border-2 font-bold text-base lg:text-lg ${
                    auditResult.success
                      ? 'bg-green-50 dark:bg-green-900/30 border-duo-green text-duo-green'
                      : 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800 text-red-500'
                  }`}>
                    <p>{auditResult.success ? '✅' : '⚠️'} {auditResult.message}</p>
                  </div>

                  {/* Human Score + Mapa de comprensión: disponibles siempre que
                       hayas auditado una URL, den verde o rojo. Son análisis
                       independientes de si la palabra clave está en la página. */}
                  <div className="border-t-2 border-slate-100 dark:border-slate-700 pt-6">
                    <div className="mb-4">
                      <p className="text-xs font-black text-fuchsia-500 uppercase tracking-wider mb-1">Nivel siguiente</p>
                      <h4 className="text-2xl font-black text-slate-800 dark:text-white">
                        {auditResult.success
                          ? 'Ya tenés la palabra clave. Ahora, ¿tu contenido destaca?'
                          : 'Igual podés analizar la calidad de esta página'}
                      </h4>
                      <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mt-1">
                        {auditResult.success
                          ? 'Primero el Human Score (valor humano). Después el Mapa de comprensión (claridad para IA + Schema solo si el tipo de página lo justifica). Misma URL, dos capas.'
                          : 'Aunque la palabra clave todavía no aparezca, Human Score y Mapa de comprensión funcionan igual: valor humano primero, estructura para IA después.'}
                      </p>
                    </div>
                    <HumanScorePanel
                      defaultUrl={targetUrl}
                      keyword={activeKeyword}
                      completedMissions={completedMissions}
                      onMissionComplete={handleHumanMissionComplete}
                      playClick={playClick}
                      playSuccess={playSuccess}
                    />
                  </div>
                  <div className="border-t-2 border-slate-100 dark:border-slate-700 pt-6">
                    <div className="rounded-2xl bg-slate-950 border border-cyan-500/20 p-4 md:p-6">
                      <ComprehensionPanel
                        defaultUrl={targetUrl}
                        playClick={playClick}
                        playSuccess={playSuccess}
                        onMissionComplete={handleHumanMissionComplete}
                      />
                    </div>
                  </div>
                  {auditResult.success && <Phase2NextSteps playClick={playClick} />}
                </div>
              )}
            </div>
          )}

        </div>
      ) : (
        /* Empty state replaced by manual keyword input */
        <div className="w-full max-w-xl mx-auto text-center py-12 px-6 card-3d bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 space-y-6">
          <div className="flex justify-center"><img src="/images/logo-owl.png" alt="SEO Jump" className="w-20 h-20 object-contain" /></div>
          <h2 className="text-2xl lg:text-3xl font-black text-slate-800 dark:text-slate-100">Estrategia de Contenidos</h2>
          <p className="text-slate-600 dark:text-slate-350 text-base lg:text-lg font-bold leading-relaxed">
            Ingresá la palabra clave que querés conquistar en Google para armar tu estrategia. Podés usar el Buscador de Oro (Fase 1) para obtener ideas, o escribirla directamente aquí.
          </p>
          <div className="space-y-4 pt-2">
            <input 
              type="text" 
              placeholder="Ej: limpieza de tapizados..."
              id="manual-keyword-input"
              className="w-full p-4 text-lg border-2 border-slate-200 dark:border-slate-700 rounded-xl focus:border-blue-500 outline-none font-black text-slate-800 dark:text-slate-100 dark:bg-slate-900/50"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const val = e.currentTarget.value.trim();
                  if (val) {
                    if (isUrlLikeKeyword(val)) {
                      alert('Eso parece una URL, no una palabra clave 😉. Escribí lo que buscaría tu cliente en Google, ej: "shampoo para autos".');
                      return;
                    }
                    if (playClick) playClick();
                    localStorage.setItem('gold-tu-busqueda', val);
                    setActiveKeyword(val);
                  }
                }
              }}
            />
            <button 
              onClick={() => {
                const input = document.getElementById('manual-keyword-input');
                const val = input ? input.value.trim() : '';
                if (val) {
                  if (isUrlLikeKeyword(val)) {
                    alert('Eso parece una URL, no una palabra clave 😉. Escribí lo que buscaría tu cliente en Google, ej: "shampoo para autos".');
                    return;
                  }
                  if (playClick) playClick();
                  localStorage.setItem('gold-tu-busqueda', val);
                  setActiveKeyword(val);
                }
              }}
              className="btn-3d btn-blue w-full py-4 text-lg lg:text-xl font-black block rounded-xl"
            >
              Comenzar Estrategia 🚀
            </button>
          </div>
          <div className="pt-4 border-t-2 border-slate-100 dark:border-slate-700">
             <Link href="/buscador-de-oro" onClick={playClick} className="text-blue-500 hover:text-blue-600 font-bold underline">
               🔍 Ir a Fase 1 para buscar ideas de palabras clave
             </Link>
          </div>
        </div>
      )}

    </div>
  );
}
