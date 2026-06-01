"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession, signIn, signOut } from "next-auth/react";
import Link from "next/link";
import { useAudio } from "../../hooks/useAudio";
import { useTheme } from "../../hooks/useTheme";
import { getRealMissions, verifyMission, getQuickWins, verifyQuickWin, markMissionComplete, fetchCompletedMissions } from "../../lib/actions";
import { getPhaseProgress, syncStateWithServer, pullStateFromServer } from "../../lib/progression";
import Header from "../../components/Header";
import PaywallModal from "../../components/PaywallModal";

// Mapa de tipos de página para badges
const getBadgeInfo = (url) => {
  const staticResponse  = { text: "Página Estática",     color: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",        wpPath: "🗺️ Ruta en WP: Páginas" };
  const homeResponse    = { text: "Página de Inicio",    color: "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300",       wpPath: "🗺️ Ruta en WP: Páginas" };
  const categoryResponse= { text: "Categoría de Tienda",color: "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300",   wpPath: "🗺️ Ruta en WP: Productos > Categorías" };
  const productResponse = { text: "Producto",            color: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",           wpPath: "🗺️ Ruta en WP: Productos > Todos los productos" };
  if (!url) return staticResponse;
  const lowerUrl = url.toLowerCase();
  const categoryKeywords = ['/categoria-producto/', '/categoria/', 'maquinas', 'insumos', 'combos', 'limpieza', 'estetica-vehicular'];
  if (categoryKeywords.some(k => lowerUrl.includes(k))) return categoryResponse;
  const productKeywords = ['/producto/', '/shop/', 'shampoo-', 'microfibra-', 'pulimento-', 'kit-'];
  if (productKeywords.some(k => lowerUrl.includes(k))) return productResponse;
  try {
    const parsed = new URL(lowerUrl);
    if (parsed.pathname === '/' || parsed.pathname === '') return homeResponse;
  } catch(e) {
    if (lowerUrl.endsWith('.com/') || lowerUrl.endsWith('.com') || lowerUrl.endsWith('.ar/') || lowerUrl.endsWith('.ar')) return homeResponse;
  }
  return staticResponse;
};

/**
 * Genera título, descripción y objetivo específico de la misión
 * en tiempo de render usando la keyword activa de Fase 1.
 * Nunca depende del texto guardado en localStorage.
 */
const getMissionDisplay = (mission, goldKeyword) => {
  const kw = goldKeyword?.trim();

  if (mission.type === 'H1') {
    return {
      title: 'El Guardián del Título (H1)',
      description: kw
        ? `Modificá la etiqueta H1 de esta página para incluir la frase exacta: "${kw}". Google la lee primero para entender de qué trata tu contenido.`
        : `Esta página tiene pocas visitas. Revisá y mejorá su etiqueta H1 para que Google la entienda mejor.`,
      objective: kw
        ? `🎯 Tu H1 debe contener: "${kw}"`
        : null,
    };
  }

  if (mission.type === 'META') {
    return {
      title: 'Gancho de Clics (META)',
      description: kw
        ? `Escribí una Meta Descripción que incluya "${kw}". Ese texto aparece debajo de tu título en Google y decide si el usuario entra a tu web o sigue de largo.`
        : `Esta página aparece en Google pero nadie hace clic. Mejorá su Meta Descripción para ser más atractivo.`,
      objective: kw
        ? `🎯 Tu META debe contener: "${kw}"`
        : null,
    };
  }

  if (mission.type === 'ALT') {
    return {
      title: 'Ojos de Google (ALT)',
      description: kw
        ? `Agregá texto ALT que incluya "${kw}" a las imágenes de esta página. Google no puede ver imágenes, pero sí leer su descripción para indexarlas.`
        : `Revisá el texto ALT de las imágenes en esta página para que Google las indexe correctamente.`,
      objective: kw
        ? `🎯 Tu ALT debe contener: "${kw}"`
        : null,
    };
  }

  return {
    title: mission.title,
    description: mission.description,
    objective: null,
  };
};

// ─── PistaDeBoxes ─────────────────────────────────────────────────────────────
// Bifurcated step-by-step component. Prepared for future video/GIF injection.
function PistaDeBoxes({ pistas, playClick }) {
  const [activeTab, setActiveTab] = useState('classic'); // 'classic' | 'visual'
  const [open, setOpen] = useState(false);

  if (!pistas) return null;

  const tabs = [
    { key: 'classic', label: '🖥️ Editor Clásico', steps: pistas.classic },
    { key: 'visual',  label: '🎨 Constructor Visual', steps: pistas.visual },
  ];

  return (
    <div className="w-full">
      {/* Toggle button */}
      <button
        onClick={() => { if (playClick) playClick(); setOpen(!open); }}
        className="text-base lg:text-lg text-slate-500 font-black hover:text-duo-blue transition-colors inline-flex items-center gap-1.5 w-full text-right justify-end"
      >
        💡 ¿Cómo lo soluciono?
        <span className="text-sm">{open ? '▲' : '▼'}</span>
      </button>

      {/* Panel */}
      <div className={`overflow-hidden transition-all duration-300 ease-in-out text-left mt-2 ${open ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="bg-slate-800 rounded-2xl border-2 border-slate-700 shadow-inner overflow-hidden">

          {/* Future video/GIF slot — uncomment when ready */}
          {/* pistas.videoUrl && (
            <div className="border-b border-slate-700 p-4">
              <a href={pistas.videoUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-cyan-400 font-black hover:underline">
                ▶️ Ver demo en video (2 min)
              </a>
            </div>
          ) */}

          {/* Tab Selector */}
          <div className="flex border-b border-slate-700">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => { if (playClick) playClick(); setActiveTab(tab.key); }}
                className={`flex-1 py-3 px-4 text-sm font-black transition-colors ${
                  activeTab === tab.key
                    ? 'bg-slate-700 text-white border-b-2 border-duo-blue'
                    : 'text-slate-400 hover:text-white hover:bg-slate-750'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Steps */}
          <div className="p-5 space-y-3">
            <h4 className="text-duo-yellow font-black text-sm uppercase tracking-wider mb-3">
              Paso a paso:
            </h4>
            <ol className="space-y-3">
              {(tabs.find(t => t.key === activeTab)?.steps || []).map((step, idx) => (
                <li key={idx} className="flex gap-3 items-start">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-duo-blue text-white text-xs font-black flex items-center justify-center mt-0.5">
                    {idx + 1}
                  </span>
                  <span className="text-slate-200 text-sm lg:text-base font-bold leading-snug">{step}</span>
                </li>
              ))}
            </ol>

            {/* Cache Warning */}
            {pistas.cacheWarning && (
              <div className="mt-4 p-4 bg-amber-900/30 border border-amber-600/50 rounded-xl flex gap-3 items-start">
                <span className="text-xl flex-shrink-0">⚠️</span>
                <p className="text-amber-300 text-sm font-bold leading-snug">
                  <strong className="font-black">Paso Final Obligatorio:</strong>{' '}
                  Si usás un plugin de caché (WP Rocket, LiteSpeed, SG Optimizer), hacé clic en{' '}
                  <strong>"Borrar Caché"</strong> en la barra superior antes de validar la misión acá.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Optimizacion() {
  const { data: session, status } = useSession();
  const { isMuted, toggleMute, playClick, playThemeToggle, playSuccess, playLevelUp } = useAudio();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();

  const [xp, setXp]                   = useState(0);
  const [siteUrl, setSiteUrl]          = useState("");
  const [missions, setMissions]        = useState([]);
  const [missionError, setMissionError]= useState(null);
  const [completedIds, setCompletedIds]= useState(new Set());
  const [hasGoldKeyword, setHasGoldKeyword] = useState(false);
  const [goldKeyword, setGoldKeyword]   = useState("");
  const [hasMissions, setHasMissions]   = useState(false);
  const [prog, setProg]                = useState(null);
  const [prestigeCycles, setPrestigeCycles] = useState(0);
  const [serverLoading, setServerLoading] = useState(true);

  // Mission detail states
  const [selectedMission, setSelectedMission] = useState(null);
  const [h1Value, setH1Value]          = useState("");
  const [missionStatus, setMissionStatus] = useState("idle");
  const [verifyResult, setVerifyResult]= useState(null);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [showOwl, setShowOwl]          = useState(false);
  const [showHelp, setShowHelp]        = useState(false);
  const [showConfetti, setShowConfetti]= useState(false);

  // Quick Wins State
  const [quickWins, setQuickWins] = useState([]);
  const [quickWinsLoading, setQuickWinsLoading] = useState(false);
  const [quickWinsError, setQuickWinsError] = useState(null);
  const [verifyingQuickWinIndex, setVerifyingQuickWinIndex] = useState(null);
  const [verifyQuickWinResult, setVerifyQuickWinResult] = useState({});
  const [completedQuickWins, setCompletedQuickWins] = useState(new Set());
  const [isQuickWinsMock, setIsQuickWinsMock] = useState(false);
  const [xpPopup, setXpPopup] = useState(null);
  const [activeTab, setActiveTab] = useState("quickwins");
  const [isPremium, setIsPremium] = useState(false);
  const [showPaywallModal, setShowPaywallModal] = useState(false);

  useEffect(() => {
    const premiumStatus = localStorage.getItem("isPremium") === "true";
    setIsPremium(premiumStatus);
  }, []);

  // Level-up sound tracking
  const prevXpRef = useRef(0);
  useEffect(() => {
    if (prevXpRef.current > 0 && Math.floor(xp / 100) > Math.floor(prevXpRef.current / 100)) {
      playLevelUp();
    }
    prevXpRef.current = xp;
  }, [xp, playLevelUp]);

  // Pull state from server on mount if logged in, otherwise load from local storage
  useEffect(() => {
    const init = async () => {
      setServerLoading(true);
      if (session) {
        const serverState = await pullStateFromServer();
        if (serverState) {
          setXp(serverState.xp || 0);
          setSiteUrl(serverState.site_url || "");
          setGoldKeyword(serverState.gold_query || "");
          setHasGoldKeyword(!!serverState.gold_query);
          setCompletedIds(new Set(serverState.completed_missions || []));
          setMissions(serverState.missions || []);
          setHasMissions((serverState.missions || []).length > 0);
          setPrestigeCycles(serverState.ciclos_prestigio || 0);
          
          const completedSet = new Set(serverState.completed_missions || []);
          const p = getPhaseProgress(completedSet, serverState.gold_suggestions, serverState.missions, serverState.gold_query, serverState.site_url);
          setProg(p);

          // Fetch completed missions from Supabase
          fetchCompletedMissions().then(cwResult => {
            if (cwResult.success && cwResult.missions.length > 0) {
              const qwUrls = new Set(
                cwResult.missions
                  .filter(m => m.mission_type === 'QUICK_WIN')
                  .map(m => m.target_url)
              );
              if (qwUrls.size > 0) {
                setCompletedQuickWins(qwUrls);
                localStorage.setItem("seojump_completed_quick_wins", JSON.stringify(Array.from(qwUrls)));
              }
            }
          }).catch(() => {});

          // Load Quick Wins from local storage
          const savedQuickWins = localStorage.getItem("seojump_quick_wins");
          if (savedQuickWins) {
            try { setQuickWins(JSON.parse(savedQuickWins)); } catch(e) {}
          }
          const savedCompletedQuickWins = localStorage.getItem("seojump_completed_quick_wins");
          if (savedCompletedQuickWins) {
            try { setCompletedQuickWins(new Set(JSON.parse(savedCompletedQuickWins))); } catch(e) {}
          }

          setServerLoading(false);
          return;
        }
      }
      
      const savedXp = localStorage.getItem("seojump_xp");
      if (savedXp) setXp(parseInt(savedXp, 10));

      const savedUrl = localStorage.getItem("seojump_site_url");
      if (savedUrl) setSiteUrl(savedUrl);

      const keyword = localStorage.getItem("gold-tu-busqueda") || "";
      setHasGoldKeyword(!!keyword);
      setGoldKeyword(keyword);

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
            setMissions(parsed);
            setHasMissions(true);
          }
        } catch (e) {}
      }

      let suggestions = [];
      const savedSuggestions = localStorage.getItem("gold-suggestions");
      if (savedSuggestions) {
        try { suggestions = JSON.parse(savedSuggestions); } catch (e) {}
      }

      // Load Quick Wins from local storage
      const savedQuickWins = localStorage.getItem("seojump_quick_wins");
      if (savedQuickWins) {
        try { setQuickWins(JSON.parse(savedQuickWins)); } catch(e) {}
      }
      const savedCompletedQuickWins = localStorage.getItem("seojump_completed_quick_wins");
      if (savedCompletedQuickWins) {
        try { setCompletedQuickWins(new Set(JSON.parse(savedCompletedQuickWins))); } catch(e) {}
      }

      const p = getPhaseProgress(completedSet, suggestions, missionsList, keyword, savedUrl);
      setProg(p);
      setServerLoading(false);
    };
    init();
  }, [session]);

  // Re-calculate progression whenever state changes
  useEffect(() => {
    let suggestions = [];
    try {
      suggestions = JSON.parse(localStorage.getItem("gold-suggestions") || "[]");
    } catch (e) {}
    const p = getPhaseProgress(completedIds, suggestions, missions, goldKeyword, siteUrl);
    setProg(p);
  }, [completedIds, missions, goldKeyword, siteUrl]);

  // Persist XP
  useEffect(() => {
    if (xp > 0) localStorage.setItem("seojump_xp", xp.toString());
  }, [xp]);

  // Persist completed missions
  useEffect(() => {
    localStorage.setItem("seojump_completed_missions", JSON.stringify(Array.from(completedIds)));
  }, [completedIds]);

  // Auth protection
  useEffect(() => {
    if (!session && status !== "loading") {
      router.push("/");
    }
  }, [session, status, router]);

  // Eliminamos la protección global para permitir el acceso a Quick Wins (Gancho inicial)
  // Las misiones de Fase 3 seguirán bloqueadas visualmente en la pestaña correspondiente.

  // Load Quick Wins when siteUrl is available
  useEffect(() => {
    if (siteUrl && quickWins.length === 0 && !quickWinsLoading) {
      const saved = localStorage.getItem("seojump_quick_wins");
      if (saved) {
        try {
          setQuickWins(JSON.parse(saved));
          return;
        } catch(e) {}
      }
      setQuickWinsLoading(true);
      getQuickWins(siteUrl, goldKeyword || undefined)
        .then(res => {
          if (res.success && res.quickWins) {
            setQuickWins(res.quickWins);
            setIsQuickWinsMock(!!res.isMockData);
            localStorage.setItem("seojump_quick_wins", JSON.stringify(res.quickWins));
          } else {
            setQuickWinsError(res.error || "No se pudieron obtener oportunidades rápidas.");
          }
        })
        .catch(err => {
          setQuickWinsError("Error de conexión al cargar oportunidades rápidas.");
        })
        .finally(() => {
          setQuickWinsLoading(false);
        });
    }
  }, [siteUrl, quickWins.length, quickWinsLoading]);

  // Persist completed Quick Wins
  useEffect(() => {
    localStorage.setItem("seojump_completed_quick_wins", JSON.stringify(Array.from(completedQuickWins)));
  }, [completedQuickWins]);

  const openMission = (mission) => {
    setSelectedMission(mission);
    setH1Value("");
    setMissionStatus("idle");
    setVerifyResult(null);
    setShowHelp(false);
    setShowOwl(false);
    setFailedAttempts(0);
  };

  const closeMission = () => setSelectedMission(null);

  const checkMission = async () => {
    if (!selectedMission || !h1Value.trim()) return;
    setVerifyLoading(true);
    setVerifyResult(null);
    setMissionStatus("checking");
    try {
      const result = await verifyMission(selectedMission.page, selectedMission.type, h1Value, selectedMission.keyword || goldKeyword || undefined);
      setVerifyResult(result);
      if (result.success) {
        setMissionStatus("success");
        setFailedAttempts(0);
        if (!completedIds.has(selectedMission.id)) {
          const newXp = xp + (selectedMission.xp || 50);
          setXp(newXp);
          localStorage.setItem("seojump_xp", newXp.toString());
          setXpPopup({ amount: selectedMission.xp || 50, message: "¡Crecimiento detectado!" });
          setTimeout(() => setXpPopup(null), 4000);
          setCompletedIds(prev => {
            const updated = new Set([...prev, selectedMission.id]);
            localStorage.setItem("seojump_completed_missions", JSON.stringify(Array.from(updated)));
            setTimeout(() => {
              syncStateWithServer();
            }, 100);
            return updated;
          });
        }
        setShowConfetti(true);
        playSuccess();
        setTimeout(() => setShowConfetti(false), 3000);
      } else {
        setMissionStatus("error");
        setFailedAttempts(prev => prev + 1);
      }
    } catch (err) {
      setVerifyResult({ success: false, message: "Error inesperado al verificar." });
      setMissionStatus("error");
      setFailedAttempts(prev => prev + 1);
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleVerifyQuickWin = async (index, pageUrl, suggestedTitle) => {
    setVerifyingQuickWinIndex(index);
    setVerifyQuickWinResult(prev => ({
      ...prev,
      [index]: { success: false, message: "", loading: true }
    }));
    try {
      const res = await verifyQuickWin(pageUrl, suggestedTitle);
      setVerifyQuickWinResult(prev => ({
        ...prev,
        [index]: { success: res.success, message: res.message, loading: false }
      }));
      if (res.success) {
        playSuccess();
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 3000);

        if (!completedQuickWins.has(pageUrl)) {
          setXp(prev => {
            const newXp = prev + 100;
            localStorage.setItem("seojump_xp", newXp.toString());
            return newXp;
          });
          setCompletedQuickWins(prev => {
            const next = new Set(prev);
            next.add(pageUrl);
            return next;
          });
          setXpPopup({ amount: 100, message: "¡Crecimiento detectado!" });
          setTimeout(() => setXpPopup(null), 4000);
          setTimeout(() => {
            syncStateWithServer();
          }, 100);
          // Guardar en Supabase para memoria cross-device
          markMissionComplete('QUICK_WIN', pageUrl, 100, suggestedTitle).catch(() => {});
        }
      }
    } catch (e) {
      setVerifyQuickWinResult(prev => ({ 
        ...prev, 
        [index]: { success: false, message: "Error al conectar y verificar en vivo.", loading: false } 
      }));
    } finally {
      setVerifyingQuickWinIndex(null);
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

  const pendingMissions = missions.filter(m => !completedIds.has(m.id)).slice(0, 10);

  return (
    <div className="flex-1 flex flex-col items-center p-4 md:p-8 w-full max-w-screen-lg mx-auto space-y-8 bg-transparent transition-colors duration-300 text-slate-100 min-h-screen relative font-fredoka px-4">

      {/* Confetti Effect */}
      {showConfetti && (
        <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden">
          {[...Array(20)].map((_, i) => (
            <div key={i} className="absolute animate-bounce text-2xl"
              style={{ left: `${Math.random()*100}%`, top: `${Math.random()*100}%`,
                animationDelay: `${Math.random()*2}s`, animationDuration: `${1+Math.random()}s` }}>
              {['✨','🎉','💎','⭐','🎈'][Math.floor(Math.random()*5)]}
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
        activePhase={prog?.p3?.unlocked ? 3 : null}
      />

      {/* Main Layout: 3 columns on desktop */}
      <div className="w-full flex flex-wrap lg:flex-nowrap gap-8 items-start mt-4">

        {/* ─── LEFT SIDEBAR ─── */}
        <div className="w-full lg:w-[300px] flex-shrink-0 flex flex-col gap-6 lg:sticky lg:top-44">
          {/* Site & Level */}
          <div className="card-3d bg-white dark:bg-slate-800 p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-duo-blue rounded-lg flex items-center justify-center text-white text-xl flex-shrink-0">🌐</div>
              <span className="text-base lg:text-lg font-black text-slate-800 dark:text-slate-100 truncate">{siteUrl || "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xl font-black text-duo-yellow">NIVEL {Math.floor(xp / 100) + 1}</span>
              <span className="text-sm font-bold text-slate-555">{xp % 100} / 100 XP</span>
            </div>
            <div className="w-full h-6 bg-gray-100 dark:bg-slate-700 rounded-full border-2 border-slate-200 dark:border-slate-600 overflow-hidden">
              <div className="h-full bg-duo-yellow transition-all duration-1000" style={{ width: `${xp % 100}%` }} />
            </div>
          </div>

          {/* Stats Panel */}
          <div className="card-3d bg-slate-800 text-white border-slate-700 shadow-xl relative overflow-hidden p-6">
            <div className="text-5xl mb-2 text-center animate-bounce">🦉</div>
            <h3 className="text-xl font-black text-yellow-400 text-center mb-4">Panel de Boxes</h3>
            <div className="space-y-3">
              <div className="bg-slate-900 rounded-xl p-3 border-2 border-slate-700">
                <p className="text-xs text-slate-400 uppercase font-black tracking-wider mb-1">Oportunidades de Venta</p>
                <p className="text-2xl font-black text-duo-blue">{missions.reduce((a,m) => a+(m.clicks||0), 0).toLocaleString()}+</p>
              </div>
              <div className="bg-slate-900 rounded-xl p-3 border-2 border-slate-700">
                <p className="text-xs text-slate-400 uppercase font-black tracking-wider mb-1">Dinero sobre la mesa</p>
                <p className="text-2xl font-black text-duo-yellow">{missions.reduce((a,m) => a+(m.impressions||0), 0).toLocaleString()}</p>
              </div>
              <div className="bg-slate-900 rounded-xl p-3 border-2 border-slate-700">
                <p className="text-xs text-slate-400 uppercase font-black tracking-wider mb-1">Keywords Ganadoras</p>
                <p className="text-2xl font-black text-orange-500">{xp} XP</p>
              </div>
            </div>
          </div>

          <button onClick={() => { playClick(); signOut(); }}
            className="btn-3d btn-white w-full text-slate-550 font-black hover:text-red-500 transition-colors text-base py-4">
            CERRAR SESIÓN
          </button>
        </div>

        {/* ─── CENTER PANEL ─── */}
        <div className="w-full lg:flex-1 min-w-0 flex flex-col gap-6">

          {/* Mission List */}
          {!selectedMission && (
            <div className="w-full space-y-6 animate-in fade-in duration-300">
              
              {/* Header y Tipografía Centrados Arriba */}
              <div className="text-center space-y-3 py-4 w-full max-w-xl mx-auto mt-4">
                <div className="text-4xl md:text-5xl">🦉</div>
                <h1 className="text-2xl md:text-3xl font-black text-slate-800 dark:text-slate-100">
                  {activeTab === "quickwins" ? "Tu Plan de Acción 🚀" : "Fase 3: Optimización On-Page 🛠️"}
                </h1>
                <div className="pt-1">
                  <button
                    onClick={() => { if (playClick) playClick(); router.push('/'); }}
                    className="inline-flex items-center gap-1.5 btn-3d btn-white !py-2 !px-4 text-xs font-black text-slate-500 hover:text-red-500 transition-colors uppercase tracking-wider"
                  >
                    ✖ Cancelar y Volver al Dashboard
                  </button>
                </div>
                {prestigeCycles > 0 && (
                  <div className="flex justify-center">
                    <span className="px-3 py-1 bg-gradient-to-r from-yellow-500 to-amber-600 text-slate-900 font-black text-xs rounded-full shadow-md animate-pulse">
                      🪙 Prestigio x{prestigeCycles}
                    </span>
                  </div>
                )}
                
                {/* Tab Selector */}
                <div className="flex flex-wrap justify-center gap-3 mt-4">
                  <button
                    onClick={() => { playClick(); setActiveTab("quickwins"); }}
                    className={`px-5 py-2.5 rounded-full font-black text-xs md:text-sm border-2 transition-all duration-300 flex items-center gap-2 ${
                      activeTab === "quickwins"
                        ? "bg-gradient-to-r from-amber-500 to-yellow-500 border-amber-400 text-slate-950 shadow-[0_0_15px_rgba(245,158,11,0.3)] scale-105"
                        : "bg-slate-800/40 border-slate-700 text-slate-300 hover:border-slate-600 hover:text-white"
                    }`}
                  >
                    🚀 Oportunidades de Venta (Quick Wins)
                  </button>
                  {prog?.p3?.unlocked ? (
                    <button
                      onClick={() => { playClick(); setActiveTab("missions"); }}
                      className={`px-5 py-2.5 rounded-full font-black text-xs md:text-sm border-2 transition-all duration-300 flex items-center gap-2 ${
                        activeTab === "missions"
                          ? "bg-gradient-to-r from-emerald-500 to-teal-500 border-emerald-400 text-slate-950 shadow-[0_0_15px_rgba(16,185,129,0.3)] scale-105"
                          : "bg-slate-800/40 border-slate-700 text-slate-300 hover:border-slate-600 hover:text-white"
                      }`}
                    >
                      🛠️ Misiones de Optimización
                    </button>
                  ) : (
                    <button
                      disabled
                      className="px-5 py-2.5 rounded-full font-black text-xs md:text-sm border-2 bg-slate-800/40 border-slate-700 text-slate-500 cursor-not-allowed flex items-center gap-2"
                      title="Completá las fases anteriores para desbloquear las misiones"
                    >
                      🔒 Misiones (Bloqueado)
                    </button>
                  )}
                </div>
              </div>

              {/* QUICK WINS TAB VIEW */}
              {activeTab === "quickwins" ? (
                <div className="space-y-6">
                  {quickWinsLoading ? (
                    <div className="text-center py-12 card-3d">
                      <div className="relative w-16 h-16 mx-auto mb-4">
                        <div className="absolute inset-0 rounded-full border-4 border-amber-500/20 animate-pulse"></div>
                        <div className="absolute inset-0 rounded-full border-4 border-t-amber-500 border-r-amber-500/50 animate-spin"></div>
                      </div>
                      <p className="text-slate-400 font-bold uppercase tracking-wider animate-pulse">Buscando oportunidades de venta...</p>
                    </div>
                  ) : quickWinsError ? (
                    <div className="text-center py-12 card-3d space-y-4">
                      <div className="text-6xl">⚠️</div>
                      <p className="text-red-400 font-bold text-lg">{quickWinsError}</p>
                      <button 
                        onClick={() => { setQuickWinsError(null); setQuickWins([]); }} 
                        className="btn-3d btn-green inline-block py-3 px-8 text-lg font-black mt-4"
                      >
                        REINTENTAR
                      </button>
                    </div>
                  ) : quickWins.length > 0 ? (
                    <div className="space-y-6">
                      {isQuickWinsMock && (
                        <div className="card-3d bg-amber-950/40 border-2 border-amber-500/50 p-6 flex flex-col md:flex-row items-center justify-between gap-6">
                          <div className="text-left flex-1 space-y-2">
                            <h3 className="text-xl font-black text-amber-400">¡Modo Simulación! ⚠️</h3>
                            <p className="text-slate-300 font-bold text-sm">Estas oportunidades son de prueba. Para ver tus datos reales de posiciones, clics e impresiones, conectá tu cuenta de Search Console.</p>
                          </div>
                          <button
                            onClick={() => {
                              playClick();
                              signIn("google", {
                                callbackUrl: "/optimizacion",
                                authorizationParams: {
                                  scope: "openid email profile https://www.googleapis.com/auth/webmasters"
                                }
                              });
                            }}
                            className="btn-3d btn-green whitespace-nowrap !py-3 font-black text-sm md:text-base flex-shrink-0"
                          >
                            CONECTAR SEARCH CONSOLE
                          </button>
                        </div>
                      )}
                      
                      {quickWins.map((qw, index) => {
                        const isUnlocked = isPremium || index < 2;
                        
                        if (!isUnlocked) {
                          return (
                            <div 
                              key={index} 
                              onClick={() => { playClick(); setShowPaywallModal(true); }}
                              className="card-3d relative overflow-hidden p-6 md:p-8 flex flex-col gap-4 transition-all duration-300 border-dashed border-2 border-slate-300 dark:border-slate-700 bg-slate-800/40 dark:bg-slate-900/60 hover:border-amber-500/50 cursor-pointer group"
                            >
                              <div className="absolute inset-0 backdrop-blur-[2px] bg-white/5 dark:bg-slate-950/10 pointer-events-none rounded-3xl"></div>
                              <div className="relative z-10 flex flex-col md:flex-row items-center gap-4 opacity-70 group-hover:opacity-100 transition-opacity">
                                <div className="w-16 h-16 rounded-2xl flex-shrink-0 flex items-center justify-center bg-slate-200 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 text-3xl font-black text-slate-400 group-hover:text-amber-500 group-hover:bg-amber-500/10 transition-colors shadow-inner">
                                  🔒
                                </div>
                                <div className="flex-1 text-center md:text-left">
                                  <h3 className="text-xl md:text-2xl font-black text-slate-500 dark:text-slate-400 mb-2 blur-[1px] group-hover:blur-none transition-all">🚀 Subir posición para: «Oportunidad Oculta»</h3>
                                  <p className="text-sm md:text-base font-bold text-slate-400 dark:text-slate-500 mb-4">[Desbloquear con SEO Jump Pro]</p>
                                  <button className="btn-3d !text-sm sm:!text-base !py-2 !px-4 btn-yellow font-black">
                                    DESBLOQUEAR {quickWins.length - 2} OPORTUNIDADES AEO
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        }

                        const isCompleted = completedQuickWins.has(qw.page);
                        const verifyResult = verifyQuickWinResult[index] || {};
                        
                        return (
                          <div 
                            key={index} 
                            className={`card-3d relative overflow-hidden p-6 md:p-8 flex flex-col gap-4 transition-all duration-300 ${
                              isCompleted ? 'border-green-500/50 opacity-85' : 'border-amber-500/30'
                            }`}
                          >
                            {isCompleted && (
                              <div className="absolute top-0 right-0 bg-green-500 text-slate-955 font-black text-xs px-4 py-1.5 rounded-bl-xl uppercase tracking-wider">
                                ¡Completado! 🎉
                              </div>
                            )}
                            
                            <div className="space-y-4 text-left w-full">
                              <h3 className="text-xl md:text-2xl font-black text-white flex items-center gap-2">
                                🚀 Subir posición para: <span className="text-amber-400 font-black">«{qw.keyword}»</span>
                              </h3>
                              
                              <div className="bg-slate-900/60 rounded-2xl p-5 border border-slate-700/50 space-y-3">
                                <p className="text-slate-200 text-base md:text-lg leading-relaxed">
                                  <span className="text-yellow-400 font-black">El Insight:</span> Estás en posición <strong className="text-white font-bold">{qw.position?.toFixed(0)}</strong>. {qw.explanation} Cambiá el título a <strong className="text-amber-300 font-black">«{qw.suggestedTitle}»</strong> y captarás el clic.
                                </p>
                                <p className="text-xs text-slate-300 bg-slate-950/40 p-3 rounded-xl border border-slate-800 leading-normal">
                                  🔒 <strong className="text-purple-300">Aclaración técnica:</strong> Cambiar el título o H1 no modifica la dirección del enlace (URL). **No perderás la antigüedad ni la autoridad de tu página**. Solo optimiza el texto para hacerlo más atractivo en las búsquedas.
                                </p>
                                <div className="text-xs md:text-sm text-slate-400 font-bold italic flex items-center gap-2 pt-1">
                                  <span>🔗 URL:</span>
                                  <code className="text-slate-300 font-mono truncate max-w-xs md:max-w-md block">{qw.page}</code>
                                </div>
                              </div>

                              {verifyResult.message && (
                                <div className={`p-4 rounded-xl border text-sm font-bold ${verifyResult.success ? 'bg-green-950/40 border-green-500/50 text-green-300' : 'bg-red-950/40 border-red-500/50 text-red-400'}`}>
                                  {verifyResult.success ? '✅' : '⚠️'} {verifyResult.message}
                                </div>
                              )}
                              
                              {!isCompleted && (
                                <div className="pt-2">
                                  <button
                                    onClick={() => handleVerifyQuickWin(index, qw.page, qw.suggestedTitle)}
                                    disabled={verifyResult.loading}
                                    className="btn-3d btn-yellow text-sm md:text-base font-black px-6 py-3"
                                  >
                                    {verifyResult.loading ? '⏳ VERIFICANDO...' : 'YA LO CAMBIÉ'}
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-12 card-3d">
                      <div className="text-6xl mb-4">🏆</div>
                      <p className="text-slate-400 font-bold text-xl">No detectamos oportunidades en el rango de posiciones 8 a 15 para tu sitio aún. ¡Seguí optimizando!</p>
                    </div>
                  )}
                </div>
              ) : (
                // OPTIMIZATION MISSIONS TAB VIEW
                <div className="space-y-6">
                  {/* Keyword activa — banner contextual */}
                  {goldKeyword ? (
                    <div className="flex items-center gap-3 bg-amber-950/40 border border-amber-700/40 rounded-2xl px-5 py-3">
                      <span className="text-xl flex-shrink-0">🎯</span>
                      <p className="text-sm font-black text-amber-300/90 leading-snug">
                        Objetivo activo: <span className="text-amber-200">«{goldKeyword}»</span> — Cada H1, META y ALT debe incluir esta frase para rankear.
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 bg-slate-800/60 border border-slate-600/40 rounded-2xl px-5 py-3">
                      <span className="text-xl flex-shrink-0">💡</span>
                      <p className="text-sm font-bold text-slate-400 leading-snug">
                        Aún no elegiste una palabra clave. <Link href="/buscador-de-oro" onClick={playClick} className="text-duo-yellow underline">Ir al Buscador de Oro</Link> para activarla y potenciar estas misiones.
                      </p>
                    </div>
                  )}

                  {prog?.p3 && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-555 dark:text-slate-400">
                        <span>Progreso de Fase 3: {prog.p3.percent}%</span>
                        <span>{prog.p3.completed} / {prog.p3.total} Misiones</span>
                      </div>
                      <div className="w-full h-3 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden border">
                        <div 
                          className={`h-full transition-all duration-500 ${prog.p4.unlocked ? 'bg-green-500' : 'bg-duo-green'}`} 
                          style={{ width: `${prog.p3.percent}%` }}
                        />
                      </div>
                      {prog.p4.unlocked ? (
                        <p className="text-xs text-green-600 dark:text-green-400 font-bold">🎉 ¡Fase 4 habilitada! Podés avanzar a la siguiente fase.</p>
                      ) : (
                        <p className="text-xs text-slate-400 font-bold">Completá el 70% de misiones para habilitar la Fase 4.</p>
                      )}
                    </div>
                  )}

                  {missions.length > 0 ? (
                    <>
                      {pendingMissions.length > 0 ? (
                        pendingMissions.map((mission) => {
                          const originalIndex = missions.findIndex(m => m.id === mission.id);
                          const isUnlocked = isPremium || originalIndex < 2;

                          if (!isUnlocked) {
                             return (
                               <div 
                                  key={mission.id}
                                  onClick={() => { playClick(); setShowPaywallModal(true); }}
                                  className="card-3d relative flex flex-col md:flex-row items-center md:items-start gap-4 md:gap-6 p-4 md:p-8 transition-all group cursor-pointer mb-4 w-full overflow-hidden bg-slate-800/40 dark:bg-slate-900/60 border-dashed border-2 border-slate-300 dark:border-slate-700 hover:border-duo-green/50 dark:hover:border-duo-green/50"
                               >
                                 <div className="absolute inset-0 backdrop-blur-[2px] bg-white/5 dark:bg-slate-950/10 pointer-events-none rounded-3xl"></div>
                                 <div className="relative z-10 w-16 h-16 md:w-20 md:h-20 rounded-2xl flex-shrink-0 flex items-center justify-center bg-slate-200 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 text-3xl font-black text-slate-400 group-hover:text-duo-green group-hover:bg-green-500/10 transition-colors shadow-inner">
                                   🔒
                                 </div>
                                 <div className="relative z-10 flex-1 min-w-0 w-full text-center md:text-left opacity-70 group-hover:opacity-100 transition-opacity">
                                   <h3 className="text-lg md:text-xl lg:text-2xl font-black text-slate-500 dark:text-slate-400 mb-2 blur-[1px] group-hover:blur-none transition-all">Misión Oculta: Optimización de página clave con alto tráfico potencial.</h3>
                                   <p className="text-sm md:text-base font-bold text-slate-400 dark:text-slate-500 mb-4">[Desbloquear con SEO Jump Pro]</p>
                                   <button className="btn-3d !text-sm sm:!text-base !py-2 !px-4 btn-green font-black">
                                     DESBLOQUEAR {missions.length > 2 ? missions.length - 2 : 0} MISIONES OCULTAS
                                   </button>
                                 </div>
                               </div>
                             );
                          }

                          const badge = getBadgeInfo(mission.page);
                          const display = getMissionDisplay(mission, goldKeyword);
                          return (
                            <div key={mission.id}
                              onClick={() => { playClick(); openMission(mission); }}
                              className="card-3d flex flex-col md:flex-row items-start gap-4 md:gap-6 p-4 md:p-8 transition-colors group hover:bg-gray-50 dark:hover:bg-slate-750 cursor-pointer w-full overflow-hidden mb-4">
                              <div className={`w-20 h-20 rounded-2xl flex-shrink-0 flex items-center justify-center border-b-4 text-3xl font-black ${
                                mission.type === 'H1'  ? 'bg-duo-green border-duo-green-shadow text-white' :
                                mission.type === 'ALT' ? 'bg-duo-blue border-duo-blue-shadow text-white' :
                                                         'bg-duo-yellow border-duo-yellow-shadow text-white'
                              }`}>{mission.icon}</div>
                              <div className="flex-1 min-w-0 w-full">
                                <div className="flex items-center gap-3 flex-wrap mb-1.5">
                                  <h3 className="text-xl md:text-2xl lg:text-3xl font-black text-slate-800 dark:text-slate-100 group-hover:text-duo-green transition-colors">{display.title}</h3>
                                  <span className={`text-sm font-black px-3 py-1 rounded-md ${badge.color}`}>{badge.text}</span>
                                </div>
                                <div className="flex items-center gap-2 mb-1.5 w-full min-w-0">
                                  <code className="text-xs md:text-sm font-mono text-slate-500 dark:text-slate-400 truncate block w-full max-w-[200px] min-[400px]:max-w-[260px] sm:max-w-[380px] md:max-w-[450px]">{mission.page}</code>
                                  <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(mission.page); playClick(); }}
                                    className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors text-slate-400 hover:text-slate-655 text-lg flex-shrink-0" title="Copiar URL">📋</button>
                                </div>
                                <p className="text-sm text-slate-400 font-bold italic mb-2">{badge.wpPath}</p>
                                <p className="font-bold text-slate-655 dark:text-slate-350 text-base md:text-lg lg:text-xl leading-relaxed mb-2">{display.description}</p>
                                {display.objective && (
                                   <div className="inline-flex items-center gap-2 bg-amber-955/50 border border-amber-700/40 rounded-xl px-3 py-1.5 mt-1 mb-2">
                                     <p className="text-xs font-black text-amber-300">{display.objective}</p>
                                   </div>
                                )}
                                <div className="flex flex-wrap gap-4 mt-3 text-sm font-bold text-slate-550 dark:text-slate-400">
                                  <span>👆 {mission.clicks} oportunidades de venta</span>
                                  <span>👁️ {mission.impressions} dinero sobre la mesa</span>
                                  <span>📊 Pos. {mission.position?.toFixed(1)}</span>
                                </div>
                                <div className="mt-4 w-full">
                                  <button className="btn-3d !text-sm sm:!text-base md:!text-lg lg:!text-xl !py-2.5 !px-4 sm:!py-3 sm:!px-6 btn-green w-full md:w-auto font-black">
                                    EMPEZAR (+{mission.xp} XP)
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-200 dark:border-slate-700">
                          <div className="text-7xl mb-4">🏆</div>
                          <p className="text-slate-500 font-bold text-xl">¡Todas las misiones completadas! 🎉</p>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-12 space-y-4 card-3d">
                      {missionError ? (
                        missionError === "MISSING_SEARCH_CONSOLE_SCOPE" ? (
                          <div className="max-w-md mx-auto p-6 md:p-8 bg-white dark:bg-slate-800 rounded-3xl border-2 border-slate-200 dark:border-slate-700 shadow-xl text-center space-y-6 animate-in zoom-in-95 duration-300">
                            <div className="text-6xl animate-bounce">🔑</div>
                            <div className="space-y-3">
                              <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 leading-tight">
                                Vinculá tu Search Console 🏁
                              </h3>
                              <p className="text-sm font-bold text-slate-555 dark:text-slate-400 leading-relaxed">
                                Para cargar las misiones SEO reales de tu sitio y permitir la indexación automática, necesitamos permiso de conexión de tus propiedades de Google Search Console. Es 100% seguro.
                              </p>
                            </div>
                            <button
                              onClick={() => {
                                playClick();
                                signIn("google", {
                                  callbackUrl: "/optimizacion",
                                  authorizationParams: {
                                    scope: "openid email profile https://www.googleapis.com/auth/webmasters"
                                  }
                                });
                              }}
                              className="w-full btn-3d bg-green-500 border-green-600 border-b-4 hover:bg-green-450 active:border-b-0 active:translate-y-1 text-white text-base font-black py-3.5 flex items-center justify-center gap-2 shadow-lg hover:shadow-green-500/20"
                            >
                              Conectar Google Search Console
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="text-6xl">⚠️</div>
                            <p className="text-red-400 font-bold text-lg">{missionError}</p>
                            <Link href="/" className="btn-3d btn-green inline-block py-3 px-8 text-lg font-black mt-4">
                              VOLVER AL INICIO
                            </Link>
                          </>
                        )
                      ) : (
                        <p className="text-slate-500 font-bold">Cargando misiones...</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Mission Detail */}
          {selectedMission && (
            <div className="w-full space-y-8 animate-in zoom-in duration-300">
              <div className="flex items-start md:items-center flex-col md:flex-row gap-4 mb-4">
                <button onClick={() => { playClick(); closeMission(); }} className="text-5xl text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 hidden md:block">✕</button>
                <div>
                  <h2 className="text-3xl lg:text-4xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-3">
                    <button onClick={() => { playClick(); closeMission(); }} className="text-2xl text-slate-500 md:hidden">←</button>
                    Misión: {selectedMission.type}
                  </h2>
                  <p className="text-base lg:text-lg font-bold text-slate-550 dark:text-slate-400 truncate max-w-full md:max-w-md">{selectedMission.pagePath}</p>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: "Oportunidades de Venta", value: selectedMission.clicks,              color: "text-duo-blue" },
                  { label: "Dinero sobre la mesa",   value: selectedMission.impressions,          color: "text-duo-yellow" },
                  { label: "Posición",               value: `#${selectedMission.position?.toFixed(0)}`, color: "text-duo-green" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-white dark:bg-slate-800 rounded-2xl p-4 text-center border-2 border-gray-100 dark:border-slate-700 shadow-sm">
                    <div className={`text-2xl md:text-3xl lg:text-4xl font-black ${color}`}>{value}</div>
                    <div className="text-xs md:text-sm font-bold text-slate-550 dark:text-slate-400">{label}</div>
                  </div>
                ))}
              </div>

              {/* Owl Guide */}
              <div className="w-full">
                <button onClick={() => { playClick(); setShowOwl(!showOwl); }}
                  className={`w-full flex items-center justify-between p-5 rounded-2xl border-2 font-black transition-all text-xl md:text-2xl ${showOwl ? 'bg-slate-800 border-slate-600 text-white' : 'bg-white dark:bg-slate-800 border-gray-100 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300'}`}>
                  <span className="flex items-center gap-4"><span className="text-4xl">🦉</span> Explicación del Búho</span>
                  <span className="text-3xl">{showOwl ? '−' : '+'}</span>
                </button>
                <div className={`overflow-hidden transition-all duration-300 ease-in-out mt-2 ${showOwl ? 'max-h-80 opacity-100' : 'max-h-0 opacity-0'}`}>
                  <div className="bg-slate-900 p-6 rounded-2xl border-2 border-slate-700 shadow-xl flex gap-4 items-start">
                    <div className="text-6xl md:text-7xl animate-bounce flex-shrink-0">🦉</div>
                    <div className="flex-1">
                      <div className="bg-slate-800 text-slate-200 p-6 rounded-2xl rounded-tl-none font-bold text-base md:text-lg lg:text-xl leading-relaxed shadow-lg border border-slate-600 relative">
                        {selectedMission.type === 'H1'  && <p>El <strong className="text-duo-green">H1</strong> es el título principal de tu local. Google lo lee primero para saber EXACTAMENTE de qué se trata tu página. Tiene que ser claro, contener tu palabra clave y convencer al usuario.</p>}
                        {selectedMission.type === 'META' && <p>La <strong className="text-duo-yellow">Meta Descripción</strong> es el cartel que ve la gente en la vereda de Google antes de entrar. No te hace subir puestos directamente, pero un buen gancho comercial define si te dan el clic a vos o siguen de largo.</p>}
                        {selectedMission.type === 'ALT'  && <p>Google es ciego para los ojos pero lee como los dioses. Si subís la foto de un producto sin <strong className="text-duo-blue">ALT</strong>, el robot no sabe qué es. Al ponerle una descripción con tu palabra clave, empezás a indexar en Google Imágenes.</p>}
                        <div className="absolute top-0 -left-2 w-0 h-0 border-t-[10px] border-t-slate-800 border-l-[10px] border-l-transparent" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Help Hints — Pista de Boxes Bifurcada */}
              {selectedMission?.pistas && typeof selectedMission.pistas === 'object' && !Array.isArray(selectedMission.pistas) && (
                <PistaDeBoxes pistas={selectedMission.pistas} playClick={playClick} />
              )}

              {/* Mission Input */}
              <div className="card-3d bg-white dark:bg-slate-800 space-y-6 p-6 md:p-8">
                <p className="font-bold text-slate-655 dark:text-slate-300 text-base md:text-lg lg:text-xl">
                  {selectedMission.type === 'H1'  && <>
                    Hacé el cambio en tu web, después escribí acá el nuevo <span className="text-duo-green">H1</span> que pusiste
                    {goldKeyword && <> (que debe incluir <span className="text-amber-400 font-black">«{goldKeyword}»</span>)</>}:
                  </>}
                  {selectedMission.type === 'META' && <>
                    Actualizá la <span className="text-duo-yellow">Meta Descripción</span> de tu sitio
                    {goldKeyword && <>, incluyendo <span className="text-amber-400 font-black">«{goldKeyword}»</span>,</>} después pegala acá:
                  </>}
                  {selectedMission.type === 'ALT'  && <>
                    Agregá el texto <span className="text-duo-blue">ALT</span> a una imagen
                    {goldKeyword && <> con la frase <span className="text-amber-400 font-black">«{goldKeyword}»</span></>}, después escribí acá el ALT que usaste:
                  </>}
                </p>
                <input
                  type="text"
                  placeholder={
                    selectedMission.type === 'H1'
                      ? goldKeyword
                        ? `ej: ${goldKeyword.charAt(0).toUpperCase() + goldKeyword.slice(1)} profesional en Buenos Aires`
                        : 'ej: Detailing Profesional en Buenos Aires'
                      : selectedMission.type === 'META'
                      ? goldKeyword
                        ? `ej: Los mejores servicios de ${goldKeyword}. Envío gratis.`
                        : 'ej: Los mejores productos de detailing. Envío gratis.'
                      : goldKeyword
                        ? `ej: ${goldKeyword} siendo aplicado en auto rojo`
                        : 'ej: Auto rojo siendo encerado con cera carnauba'
                  }
                  value={h1Value}
                  onChange={(e) => setH1Value(e.target.value)}
                  className="w-full p-5 text-xl md:text-2xl border-2 border-slate-200 dark:border-slate-600 rounded-xl focus:border-duo-green outline-none font-black text-slate-800 dark:text-slate-100 dark:bg-slate-700"
                />
                <p className="text-sm text-slate-555 font-bold">{h1Value.length} / {selectedMission.type === 'META' ? '160' : '70'} caracteres</p>

                {verifyResult && missionStatus !== 'idle' && (
                  <div className={`p-5 rounded-2xl border-2 font-bold text-base lg:text-lg ${verifyResult.success ? 'bg-green-50 dark:bg-green-900/30 border-duo-green text-duo-green' : 'bg-red-50 dark:bg-red-900/30 border-red-200 text-red-500'}`}>
                    <p className="mb-1">{verifyResult.success ? '✅' : '⚠️'} {verifyResult.message}</p>
                    {verifyResult.liveValue && !verifyResult.success && (
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 font-bold">💡 Valor actual en tu web: <span className="italic">"{verifyResult.liveValue}"</span></p>
                    )}
                    {!verifyResult.success && failedAttempts >= 2 && (
                      <p className="text-sm text-slate-555 mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl border border-yellow-200 dark:border-yellow-700/50">
                        💡 ¿Tu web no se actualiza? Si usás plugins de velocidad (WP Rocket, LiteSpeed, SG Optimizer), recordá borrar la caché para que el Búho pueda leer tu cambio fresco.
                      </p>
                    )}
                  </div>
                )}

                {missionStatus === 'error' && selectedMission?.page && (
                  <div className="bg-slate-800 border-2 border-slate-600 rounded-2xl p-5 text-base font-bold text-slate-355 flex items-start gap-4">
                    <span className="text-2xl flex-shrink-0">🏎️</span>
                    <div>
                      <p className="font-black text-slate-100 mb-1.5">¿Dónde lo edito en mi WordPress?</p>
                      {selectedMission.page.includes('/producto/') || selectedMission.page.includes('/product/')
                        ? <p>Este contenido está en un <span className="text-duo-yellow font-black">PRODUCTO de WooCommerce</span>. Andá a <strong>Productos → Todos los productos</strong> y hacé clic en Editar.</p>
                        : selectedMission.page.includes('/blog/') || selectedMission.page.includes('/entrada/')
                        ? <p>Este contenido es una <span className="text-duo-blue font-black">ENTRADA de Blog</span>. Andá a <strong>Entradas → Todas las entradas</strong> y hacé clic en Editar.</p>
                        : selectedMission.page.includes('/categoria-producto/') || selectedMission.page.includes('/categoria/')
                        ? <p>Este contenido es una <span className="text-purple-400 font-black">CATEGORÍA de Tienda</span>. Andá a <strong>Productos → Categorías</strong> y editá la categoría correspondiente.</p>
                        : <p>Este contenido es una <span className="text-green-400 font-black">PÁGINA Estática</span>. Andá a <strong>Páginas → Todas las páginas</strong> y hacé clic en Editar.</p>
                      }
                    </div>
                  </div>
                )}


                <button
                  onClick={() => { playClick(); checkMission(); }}
                  disabled={verifyLoading || missionStatus === "success" || !h1Value.trim()}
                  className={`btn-3d w-full text-xl md:text-2xl py-5 ${
                    missionStatus === "success"  ? "btn-green" :
                    verifyLoading                ? "btn-white text-slate-500" :
                    "bg-slate-800 border-slate-900 border-b-4 text-white hover:bg-slate-750 active:border-b-0 active:translate-y-1 font-black"
                  }`}
                >
                  {verifyLoading                               && "⏳ VERIFICANDO EN VIVO..."}
                  {!verifyLoading && missionStatus === "idle"  && "🔍 VERIFICAR EN VIVO"}
                  {!verifyLoading && missionStatus === "error" && "🔄 REINTENTAR"}
                  {!verifyLoading && missionStatus === "success" && `🎉 ¡+${selectedMission.xp} XP GANADOS!`}
                </button>

                <div className="p-4 bg-amber-55 dark:bg-amber-955/20 border border-amber-200 dark:border-amber-900/30 rounded-2xl text-sm font-bold text-amber-800 dark:text-amber-300 flex gap-3 items-start shadow-sm leading-relaxed text-left animate-in fade-in slide-in-from-bottom duration-300">
                  <span className="text-2xl flex-shrink-0 select-none">🦉</span>
                  <p>
                    <strong className="font-black text-amber-955 dark:text-amber-200">¡Tip de experto!</strong> Para que el sistema detecte tus cambios, asegurate de cerrar el panel de administrador y abrir tu web como un visitor común. Google lee tu sitio tal como lo ven tus clientes, no desde el editor.
                  </p>
                </div>
              </div>

              {missionStatus === "success" && (
                <button onClick={() => { playClick(); closeMission(); }} className="btn-3d btn-green w-full text-2xl md:text-3xl py-5 font-black">
                  VOLVER A LAS MISIONES
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Visual XP Popup Feedback */}
      {xpPopup && (
        <div className="fixed top-12 left-1/2 transform -translate-x-1/2 z-50 animate-bounce flex items-center gap-3 bg-gradient-to-r from-yellow-500 via-amber-500 to-yellow-600 border-2 border-white text-slate-950 font-black rounded-full px-8 py-4 shadow-[0_0_40px_rgba(245,158,11,0.6)]">
          <span className="text-3xl">✨</span>
          <span className="text-xl md:text-2xl uppercase tracking-wider text-slate-950 font-black">
            +{xpPopup.amount} XP - {xpPopup.message}
          </span>
          <span className="text-3xl">✨</span>
        </div>
      )}

      {showPaywallModal && (
        <PaywallModal 
          onClose={() => setShowPaywallModal(false)} 
          totalHiddenMissions={missions.length > 2 ? missions.length - 2 : 0} 
          playClick={playClick}
        />
      )}

    </div>
  );
}
