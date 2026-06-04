"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useAudio } from "../../hooks/useAudio";
import { useTheme } from "../../hooks/useTheme";
import { verifyContentMission, checkIsAdmin } from "../../lib/actions";
import { getPhaseProgress, syncStateWithServer, pullStateFromServer } from "../../lib/progression";
import Link from "next/link";
import Header from "../../components/Header";

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
  const [completedMissions, setCompletedMissions] = useState(new Set());
  const [hasMissions, setHasMissions] = useState(false);
  const [prog, setProg] = useState(null);
  const [prestigeCycles, setPrestigeCycles] = useState(0);
  const [serverLoading, setServerLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

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
  const [showConfetti, setShowConfetti] = useState(false);

  // Load state from server/localStorage on mount
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
          setTargetUrl(serverState.site_url || "");
          setActiveKeyword(purifyText(serverState.gold_query || ""));
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
            adminResult
          );
          setProg(p);
          setServerLoading(false);
          return;
        }
      }

      const savedXp = localStorage.getItem("seojump_xp");
      const currentXp = savedXp ? parseInt(savedXp, 10) : 0;
      setXp(currentXp);

      const savedUrl = localStorage.getItem("seojump_site_url");
      if (savedUrl) {
        setSiteUrl(savedUrl);
        setTargetUrl(savedUrl);
      }

      const savedKeyword = localStorage.getItem("gold-tu-busqueda");
      if (savedKeyword) {
        setActiveKeyword(purifyText(savedKeyword));
      }

      const prestige = parseInt(localStorage.getItem("seojump_prestigio_cycles") || "0", 10);
      setPrestigeCycles(prestige);

      const savedCompleted = localStorage.getItem("seojump_completed_missions");
      let completedList = [];
      if (savedCompleted) {
        try {
          const parsed = JSON.parse(savedCompleted);
          if (Array.isArray(parsed)) {
            completedList = parsed;
            setCompletedMissions(new Set(parsed));
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

      const p = getPhaseProgress(completedSet, suggestions, missionsList, savedKeyword, savedUrl, adminResult);
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
    const p = getPhaseProgress(completedMissions, suggestions, missions, activeKeyword, siteUrl, isAdmin);
    setProg(p);
  }, [completedMissions, activeKeyword, siteUrl, isAdmin]);

  // Lock protection: redirect if Phase 2 is locked
  // FRENO: esperar sesión resuelta y que isAdmin esté calculado antes de redirigir
  useEffect(() => {
    if (status === 'loading') return;          // sesión todavía cargando
    if (isAdmin) return;                       // admins siempre tienen acceso
    if (prog && !prog.p2.unlocked) {
      router.push("/buscador-de-oro");
    }
  }, [prog, router, status, isAdmin]);

  // Auth Protection
  useEffect(() => {
    if (!session && status !== "loading") {
      router.push("/");
    }
  }, [session, status, router]);

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
    alert("¡Excelente! Creación agendada. Sumaste +30 XP. Ahora podés verificarla en la Fase 3.");
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
      <div className="w-full text-center space-y-4 max-w-3xl mx-auto mt-4">
        <h1 className="text-4xl lg:text-5xl font-black text-blue-600 dark:text-blue-400">Fase 2: Estrategia de Contenido ✍️</h1>
        <p className="text-xl lg:text-2xl font-bold text-slate-655 dark:text-slate-400">
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
          <div className="card-3d bg-blue-50 dark:bg-blue-950/20 border-2 border-blue-200 dark:border-blue-800/60 p-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <p className="text-sm lg:text-base font-black text-blue-500 uppercase tracking-wider">Palabra clave activa de la Fase 1</p>
              <h2 className="text-3xl lg:text-4xl font-black text-blue-900 dark:text-blue-300">"{activeKeyword}"</h2>
            </div>
            <Link href="/buscador-de-oro" onClick={playClick} className="text-base lg:text-lg font-black text-slate-500 hover:text-blue-600 underline">
              🔄 Cambiar en Fase 1: Búsqueda
            </Link>
          </div>

          {/* Owl Introduction */}
          <div className="flex items-start gap-4 bg-white dark:bg-slate-800 p-8 rounded-2xl border-2 border-gray-155 dark:border-slate-700 shadow-sm">
            <img src="/images/logo-owl.png" alt="SEO Jump" className="w-16 h-16 md:w-20 md:h-20 object-contain animate-bounce flex-shrink-0" />
            <div className="flex-1 text-left space-y-2">
              <p className="font-bold text-slate-700 dark:text-slate-200 text-lg lg:text-xl">
                ¡Tenemos la palabra clave de oro! Ahora necesitamos una página web dedicada en tu sitio.
              </p>
              <p className="text-base lg:text-lg text-slate-500 dark:text-slate-400 font-bold">
                ¿Esta página ya existe en tu sitio web o necesitas crearla desde cero? Elige un camino para continuar.
              </p>
            </div>
          </div>

          {/* Logic Fork Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Camino A (Crear) */}
            <div 
              onClick={() => { playClick(); setSelectedPath('A'); }}
              className={`card-3d cursor-pointer flex flex-col justify-between p-8 transition-all duration-300 ${
                selectedPath === 'A' 
                  ? 'border-blue-500 bg-blue-50/20 dark:bg-slate-800' 
                  : 'bg-white dark:bg-slate-800 hover:border-blue-300'
              }`}
            >
              <div className="space-y-4">
                <div className="text-5xl">📝</div>
                <h3 className="text-2xl lg:text-3xl font-black text-slate-800 dark:text-slate-100">Camino A: No tengo esta página</h3>
                <p className="text-base lg:text-lg text-slate-500 dark:text-slate-400 font-bold leading-relaxed">
                  Quiero crear un nuevo artículo de blog, una página estática o un producto optimizado desde cero en mi WordPress.
                </p>
              </div>
              <button className={`mt-6 py-4 w-full rounded-xl border font-black text-lg lg:text-xl transition-all duration-200 ${
                selectedPath === 'A' ? 'bg-blue-600 border-blue-700 text-white shadow-sm' : 'bg-slate-100 border-slate-200 text-slate-600 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-300'
              }`}>
                Elegir Crear
              </button>
            </div>

            {/* Camino B (Mejorar) */}
            <div 
              onClick={() => { playClick(); setSelectedPath('B'); }}
              className={`card-3d cursor-pointer flex flex-col justify-between p-8 transition-all duration-300 ${
                selectedPath === 'B' 
                  ? 'border-blue-500 bg-blue-50/20 dark:bg-slate-800' 
                  : 'bg-white dark:bg-slate-800 hover:border-blue-300'
              }`}
            >
              <div className="space-y-4">
                <div className="text-5xl">🔧</div>
                <h3 className="text-2xl lg:text-3xl font-black text-slate-800 dark:text-slate-100">Camino B: Ya tengo esta página</h3>
                <p className="text-base lg:text-lg text-slate-500 dark:text-slate-400 font-bold leading-relaxed">
                  Ya tengo una URL publicada con contenido similar y quiero auditarla para verificar si tiene la palabra clave.
                </p>
              </div>
              <button className={`mt-6 py-4 w-full rounded-xl border font-black text-lg lg:text-xl transition-all duration-200 ${
                selectedPath === 'B' ? 'bg-blue-600 border-blue-700 text-white shadow-sm' : 'bg-slate-100 border-slate-200 text-slate-600 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-300'
              }`}>
                Elegir Auditar
              </button>
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
                <div className={`p-4 rounded-xl border-2 font-bold text-base lg:text-lg ${
                  auditResult.success
                    ? 'bg-green-50 dark:bg-green-900/30 border-duo-green text-duo-green'
                    : 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800 text-red-500'
                }`}>
                  <p>{auditResult.success ? '✅' : '⚠️'} {auditResult.message}</p>
                </div>
              )}
            </div>
          )}

        </div>
      ) : (
        /* Empty state: No active keyword */
        <div className="w-full max-w-xl mx-auto text-center py-20 px-8 card-3d bg-white dark:bg-slate-800 border-dashed border-2 border-slate-200 dark:border-slate-700 shadow-none space-y-6">
          <div className="flex justify-center"><img src="/images/logo-owl.png" alt="SEO Jump" className="w-24 h-24 object-contain opacity-50 animate-pulse" /></div>
          <h2 className="text-3xl lg:text-4xl font-black text-slate-750 dark:text-slate-200">No hay palabras clave activas</h2>
          <p className="text-slate-600 dark:text-slate-350 text-base lg:text-lg font-bold leading-relaxed">
            Primero tenés que detectar una oportunidad de búsqueda en la Fase 1. El Búho usará esa palabra clave de oro para guiarte en tu estrategia de contenidos.
          </p>
          <Link href="/buscador-de-oro" onClick={playClick} className="btn-3d btn-green w-full py-5 text-lg lg:text-xl font-black block rounded-xl">
            ¡Ir a Fase 1: Búsqueda de Oro! 👑
          </Link>
        </div>
      )}

    </div>
  );
}
