"use client";

import { useState, useEffect, useRef } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import LoginButton from "../components/LoginButton";
import NotificationBell from "../components/NotificationBell";
import { getRealMissions, verifyMission, getQuickWins, verifyQuickWin } from "../lib/actions";
import { useAudio } from "../hooks/useAudio";
import { useTheme } from "../hooks/useTheme";
import { getPhaseProgress, syncStateWithServer, pullStateFromServer } from "../lib/progression";

const getBadgeInfo = (url) => {
  const staticResponse = { text: "Página Estática", color: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300", wpPath: "🗺️ Ruta en WP: Páginas" };
  const homeResponse = { text: "Página de Inicio", color: "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300", wpPath: "🗺️ Ruta en WP: Páginas" };
  const categoryResponse = { text: "Categoría de Tienda", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300", wpPath: "🗺️ Ruta en WP: Productos > Categorías" };
  const productResponse = { text: "Producto", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300", wpPath: "🗺️ Ruta en WP: Productos > Todos los productos" };

  if (!url) return staticResponse;
  
  const lowerUrl = url.toLowerCase();

  const categoryKeywords = ['/categoria-producto/', '/categoria/', 'maquinas', 'insumos', 'combos', 'limpieza', 'estetica-vehicular'];
  if (categoryKeywords.some(keyword => lowerUrl.includes(keyword))) {
    return categoryResponse;
  }

  const productKeywords = ['/producto/', '/shop/', 'shampoo-', 'microfibra-', 'pulimento-', 'kit-'];
  if (productKeywords.some(keyword => lowerUrl.includes(keyword))) {
    return productResponse;
  }

  try {
    const parsed = new URL(lowerUrl);
    if (parsed.pathname === '/' || parsed.pathname === '') {
      return homeResponse;
    }
  } catch(e) {
    if (lowerUrl.endsWith('.com/') || lowerUrl.endsWith('.com') || lowerUrl.endsWith('.ar/') || lowerUrl.endsWith('.ar')) {
       return homeResponse;
    }
  }
  return staticResponse;
};

// Componente destacado de Quick Wins (El Gancho)
function QuickWinsHighlight({ quickWins, completedQuickWins, playClick, router }) {
  if (!quickWins || quickWins.length === 0) return null;
  const pendingWins = quickWins.filter(qw => !completedQuickWins.has(qw.page));
  if (pendingWins.length === 0) return null;

  return (
    <div className="w-full mb-8 relative rounded-3xl overflow-hidden border-2 border-amber-500/40 bg-gradient-to-r from-violet-950/80 via-purple-900/80 to-slate-900/90 p-6 md:p-8 shadow-[0_0_40px_rgba(139,92,246,0.3)] animate-pulse-glow hover:scale-[1.01] transition-transform duration-300">
      <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 via-transparent to-pink-500/10 opacity-50"></div>
      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="text-left space-y-2">
          <h2 className="text-2xl md:text-3xl font-black text-white flex items-center gap-2">
            🚀 Oportunidades de Crecimiento: {pendingWins.length} detectadas
          </h2>
          <p className="text-slate-200 text-sm md:text-base font-bold">
            Detectamos palabras clave donde podés subir posiciones hoy mismo.
          </p>
        </div>
        
        <button
          onClick={() => {
            playClick();
            router.push("/optimizacion");
          }}
          className="btn-3d btn-yellow !text-sm md:!text-base font-black px-6 py-3.5 whitespace-nowrap animate-bounce flex-shrink-0"
        >
          VER OPORTUNIDADES
        </button>
      </div>
    </div>
  );
}

export default function Home() {
  const { data: session, status } = useSession();
  const { isMuted, toggleMute, playClick, playThemeToggle, playSuccess, playLevelUp } = useAudio();
  const { theme, toggleTheme } = useTheme();
  const [step, setStep] = useState(1);
  const [url, setUrl] = useState("");
  const [goal, setGoal] = useState("");
  const [scanProgress, setScanProgress] = useState(0);
  const [scanMessage, setScanMessage] = useState("Iniciando análisis...");
  const [missions, setMissions] = useState([]);
  const [missionError, setMissionError] = useState(null);
  const [selectedMission, setSelectedMission] = useState(null);
  
  // Mission interaction state
  const [h1Value, setH1Value] = useState("");
  const [missionStatus, setMissionStatus] = useState("idle");
  const [verifyResult, setVerifyResult] = useState(null); // { success, message, liveValue }
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [completedIds, setCompletedIds] = useState(new Set());
  const [xp, setXp] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showOwl, setShowOwl] = useState(false);
  const [showIntroModal, setShowIntroModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);

  // Quick Wins State
  const [quickWins, setQuickWins] = useState([]);
  const [quickWinsLoading, setQuickWinsLoading] = useState(false);
  const [quickWinsError, setQuickWinsError] = useState(null);
  const [verifyingQuickWinIndex, setVerifyingQuickWinIndex] = useState(null);
  const [verifyQuickWinResult, setVerifyQuickWinResult] = useState({});
  const [completedQuickWins, setCompletedQuickWins] = useState(new Set());
  const [xpPopup, setXpPopup] = useState(null);

  const router = useRouter();
  const [hasGoldKeyword, setHasGoldKeyword] = useState(false);
  const [prog, setProg] = useState(null);
  const [prestigeCycles, setPrestigeCycles] = useState(0);
  const [serverLoading, setServerLoading] = useState(true);

  // Pull state from server on mount if logged in, otherwise load from local storage
  useEffect(() => {
    const init = async () => {
      setServerLoading(true);
      if (session) {
        const serverState = await pullStateFromServer();
        if (serverState) {
          setXp(serverState.xp || 0);
          setUrl(serverState.site_url || "");
          setHasGoldKeyword(!!serverState.gold_query);
          setCompletedIds(new Set(serverState.completed_missions || []));
          setPrestigeCycles(serverState.ciclos_prestigio || 0);
          setMissions(serverState.missions_list || []);

          const completedSet = new Set(serverState.completed_missions || []);
          const p = getPhaseProgress(
            completedSet,
            serverState.gold_suggestions,
            serverState.missions_list,
            serverState.gold_query,
            serverState.site_url
          );
          setProg(p);
          if (serverState.site_url && (serverState.missions_list || []).length > 0) {
            setStep(6);
          }
          setServerLoading(false);
          return;
        }
      }

      const savedXp = localStorage.getItem("seojump_xp");
      if (savedXp) setXp(parseInt(savedXp, 10));

      const savedUrl = localStorage.getItem("seojump_site_url");
      if (savedUrl) setUrl(savedUrl);

      const activeKeyword = localStorage.getItem("gold-tu-busqueda");
      setHasGoldKeyword(!!activeKeyword);

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
        } catch (e) {
          console.error("Error parsing completed missions", e);
        }
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
            if (savedUrl) {
              setStep(6);
            }
          }
        } catch (e) {}
      }

      let suggestions = [];
      const savedSuggestions = localStorage.getItem("gold-suggestions");
      if (savedSuggestions) {
        try { suggestions = JSON.parse(savedSuggestions); } catch (e) {}
      }

      const savedQuickWins = localStorage.getItem("seojump_quick_wins");
      if (savedQuickWins) {
        try { setQuickWins(JSON.parse(savedQuickWins)); } catch (e) {}
      }
      const savedCompletedQuickWins = localStorage.getItem("seojump_completed_quick_wins");
      if (savedCompletedQuickWins) {
        try { setCompletedQuickWins(new Set(JSON.parse(savedCompletedQuickWins))); } catch (e) {}
      }

      const p = getPhaseProgress(completedSet, suggestions, missionsList, activeKeyword, savedUrl);
      setProg(p);
      setServerLoading(false);
    };
    init();
  }, [session]);

  // Recalculate progress when state updates
  useEffect(() => {
    let suggestionsList = [];
    try {
      suggestionsList = JSON.parse(localStorage.getItem("gold-suggestions") || "[]");
    } catch (e) {}
    const p = getPhaseProgress(completedIds, suggestionsList, missions, localStorage.getItem("gold-tu-busqueda"), url);
    setProg(p);
  }, [completedIds, missions, url]);

  useEffect(() => {
    if (xp > 0) localStorage.setItem("seojump_xp", xp.toString());
  }, [xp]);

  // Handle Level Up sound logic
  const prevXpRef = useRef(xp);
  useEffect(() => {
    if (prevXpRef.current > 0 && Math.floor(xp / 100) > Math.floor(prevXpRef.current / 100)) {
      playLevelUp();
    }
    prevXpRef.current = xp;
  }, [xp, playLevelUp]);

  useEffect(() => {
    localStorage.setItem("seojump_completed_missions", JSON.stringify(Array.from(completedIds)));
  }, [completedIds]);

  useEffect(() => {
    localStorage.setItem("seojump_completed_quick_wins", JSON.stringify(Array.from(completedQuickWins)));
  }, [completedQuickWins]);

  useEffect(() => {
    if (step >= 6 && url && quickWins.length === 0 && !quickWinsLoading) {
      const saved = localStorage.getItem("seojump_quick_wins");
      if (saved) {
        try {
          setQuickWins(JSON.parse(saved));
          return;
        } catch (e) {}
      }
      setQuickWinsLoading(true);
      getQuickWins(url)
        .then((res) => {
          if (res.success && res.quickWins) {
            setQuickWins(res.quickWins);
            localStorage.setItem("seojump_quick_wins", JSON.stringify(res.quickWins));
          } else {
            setQuickWinsError(res.error || "No se pudieron obtener oportunidades rápidas.");
          }
        })
        .catch((err) => {
          setQuickWinsError("Error de conexión al cargar oportunidades rápidas.");
        })
        .finally(() => {
          setQuickWinsLoading(false);
        });
    }
  }, [step, url, quickWins.length, quickWinsLoading]);

  // Protection: Reset to step 1 if session is lost in protected steps
  useEffect(() => {
    if (step >= 4 && !session && status !== "loading") {
      setStep(1);
    }
  }, [session, step, status]);

  // Handle Scanning Animation
  useEffect(() => {
    if (step === 4) {
      const messages = [
        "🛡️ Verificando disponibilidad del servidor...",
        "🔍 Escaneando estructura HTML...",
        "📐 Analizando etiquetas H1, META y ALT...",
        "📊 Mapeando arquitectura para el juego...",
        "⚙️ Procesando señales técnicas on-page...",
        "🏁 ¡Tablero listo para la carrera!"
      ];
      
      let progress = 0;
      const interval = setInterval(() => {
        progress += 2;
        setScanProgress(progress);
        
        const msgIndex = Math.min(Math.floor((progress / 100) * messages.length), messages.length - 1);
        setScanMessage(messages[msgIndex]);

        if (progress >= 100) {
          clearInterval(interval);
          const goldKeyword = localStorage.getItem("gold-tu-busqueda") || undefined;
          
          getQuickWins(url).then(qwRes => {
            if (qwRes.success && qwRes.quickWins) {
              setQuickWins(qwRes.quickWins);
              localStorage.setItem("seojump_quick_wins", JSON.stringify(qwRes.quickWins));
            }
          }).catch(err => console.error("Fallo al precargar quick wins:", err));

          getRealMissions(url, goldKeyword).then(res => {
            if (!res.success) {
              throw new Error(res.error);
            }
            const realMissions = res.data;
            if (!realMissions || realMissions.length === 0) {
              throw new Error("EMPTY_MISSIONS");
            }
            setMissions(realMissions);
            setMissionError(null);
            try {
              localStorage.setItem("seojump_missions", JSON.stringify(realMissions));
            } catch (e) {}
            setTimeout(() => setStep(5), 1000);
          }).catch(err => {
            console.error("Failed to fetch missions:", err);
            let errMsg = "";
            if (err.message === "EMPTY_MISSIONS") {
              errMsg = "No pudimos generar misiones para tu sitio en esa URL. Probá con otra URL o vinculá tu Search Console.";
            } else if (err.message === "MISSING_SEARCH_CONSOLE_SCOPE") {
              errMsg = "No pudimos generar misiones. Vinculá tu Search Console primero.";
            } else {
              errMsg = err.message || 'Error al obtener datos de Search Console';
            }
            setMissionError(errMsg);
            // Do not advance: return to Step 2 (URL input)
            setStep(2);
            setScanProgress(0);
          });
        }
      }, 50);
      
      return () => clearInterval(interval);
    }
  }, [step]);

  const checkMission = async () => {
    if (!selectedMission || !h1Value.trim()) return;
    setVerifyLoading(true);
    setVerifyResult(null);
    setMissionStatus("checking");

    try {
      const result = await verifyMission(selectedMission.page, selectedMission.type, h1Value, selectedMission.keyword);
      setVerifyResult(result);
      if (result.success) {
        setMissionStatus("success");
        setFailedAttempts(0);
        if (!completedIds.has(selectedMission.id)) {
          setXp(prev => prev + (selectedMission.xp || 50));
          setCompletedIds(prev => new Set([...prev, selectedMission.id]));
        }
        setShowConfetti(true);
        playSuccess();
        setTimeout(() => setShowConfetti(false), 3000);
      } else {
        setMissionStatus("error");
        setFailedAttempts(prev => prev + 1);
      }
    } catch (err) {
      setVerifyResult({ success: false, message: 'Error inesperado al verificar.' });
      setMissionStatus("error");
      setFailedAttempts(prev => prev + 1);
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleVerifyQuickWin = async (index, pageUrl, suggestedTitle) => {
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
          setXp(prev => prev + 100);
          setCompletedQuickWins(prev => {
            const next = new Set(prev);
            next.add(pageUrl);
            return next;
          });
          setXpPopup({ amount: 100, message: "¡Crecimiento detectado!" });
          setTimeout(() => setXpPopup(null), 4000);
        }
      }
    } catch (e) {
      setVerifyQuickWinResult(prev => ({ 
        ...prev, 
        [index]: { success: false, message: "Error al conectar y verificar en vivo.", loading: false } 
      }));
    }
  };

  const openMission = (mission) => {
    setSelectedMission(mission);
    setH1Value("");
    setMissionStatus("idle");
    setVerifyResult(null);
    setShowHelp(false);
    setShowOwl(false);
    setFailedAttempts(0);
    setStep(7);
  };

  const nextStep = () => setStep(step + 1);
  const prevStep = () => setStep(step - 1);

  const handleAnalyze = () => {
    if (!session) {
      signIn("google");
    } else {
      nextStep();
    }
  };

  if (status === "loading" || (session && serverLoading)) {
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
    <div className={`min-h-screen bg-transparent flex flex-col items-center justify-center px-4 py-8 md:p-8 w-full font-fredoka relative overflow-hidden transition-colors duration-300 text-slate-100 ${step < 6 ? 'max-w-lg md:max-w-3xl lg:max-w-4xl mx-auto border-x dark:border-slate-800 shadow-2xl' : ''}`}>
      
      {/* Global Top Navbar for Landing Page */}
      {step === 1 && (
        <div className="w-full flex items-center justify-between pb-6 border-b border-slate-200 dark:border-slate-800 mb-6">
          <span className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2">
            🦉 SEOJUMP
          </span>
          <Link
            href="/blog"
            onClick={playClick}
            className="btn-3d btn-white hover:text-cyan-500 text-xs px-4 py-2 font-black uppercase tracking-wider transition-colors"
          >
            📖 Academia SEO
          </Link>
        </div>
      )}

      {/* Confetti Effect */}
      {showConfetti && (
        <div className="absolute inset-0 pointer-events-none z-50">
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
              {['✨', '🎉', '💎', '⭐', '🎈'][Math.floor(Math.random() * 5)]}
            </div>
          ))}
        </div>
      )}

      <main className={`w-full flex flex-col items-center ${step > 1 && step < 6 ? 'max-w-3xl justify-center py-6 flex-1' : 'max-w-7xl py-12 flex-1'}`}>
        
        {/* Progress Bar (at the top) */}
        {step > 1 && step < 5 && (
          <div className="w-full h-4 bg-gray-200 rounded-full mb-12 border-2 border-slate-200">
            <div 
              className="h-full bg-duo-green rounded-full transition-all duration-300" 
              style={{ width: `${(step / 4) * 100}%` }}
            ></div>
          </div>
        )}

        {step === 1 && !showIntroModal && (
          <div className="w-full max-w-xl md:max-w-3xl mx-auto px-4 py-8 flex flex-col items-center gap-8 animate-in fade-in zoom-in duration-500">
            
            {/* Marketing y Valor (antes COLUMNA IZQUIERDA) */}
            <div className="w-full space-y-10 text-left bg-slate-900 p-8 md:p-12 rounded-3xl border-2 border-slate-700 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-duo-green opacity-10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-yellow-500 opacity-5 rounded-full blur-3xl -ml-16 -mb-16 pointer-events-none"></div>

              {/* Título principal */}
              <div className="space-y-5">
                <div className="text-6xl">🏆</div>
                <h1 className="text-3xl md:text-4xl lg:text-5xl font-black text-white tracking-tight leading-[1.1]">
                  Dejá de tirar plata en agencias.{" "}
                  <span className="text-duo-green">Tomá el control</span> de tu SEO{" "}
                  <span className="text-duo-yellow">jugando.</span>
                </h1>
                <p className="text-slate-300 font-semibold text-lg md:text-xl leading-relaxed">
                  El primer simulador de estrategia SEO que audita tu web en tiempo real, te da misiones diarias y posiciona tu negocio en Google{" "}
                  <span className="text-white font-black">sin tecnicismos aburridos</span> ni pagar fortunas todos los meses.
                </p>
              </div>

              {/* Puntos clave */}
              <div className="space-y-7 pt-2">
                <div className="flex items-start gap-5">
                  <div className="w-14 h-14 bg-orange-500/20 rounded-xl flex items-center justify-center text-3xl flex-shrink-0 border border-orange-500/30">🏎️</div>
                  <div>
                    <h3 className="text-lg md:text-xl font-black text-orange-400">Optimizá tu web en tus ratos libres</h3>
                    <p className="text-slate-300 font-semibold text-base md:text-lg leading-relaxed mt-1.5">Ingresá el enlace de tu página y nuestra Inteligencia Artificial escaneará toda tu estructura al instante para encontrar las palabras exactas que buscan tus clientes.</p>
                  </div>
                </div>
                <div className="flex items-start gap-5">
                  <div className="w-14 h-14 bg-yellow-500/20 rounded-xl flex items-center justify-center text-3xl flex-shrink-0 border border-yellow-500/30">💰</div>
                  <div>
                    <h3 className="text-lg md:text-xl font-black text-yellow-400">Tomá el Control de tu Página Web</h3>
                    <p className="text-slate-300 font-semibold text-base md:text-lg leading-relaxed mt-1.5">Ahorrate cientos de miles de pesos al mes en agencias. Automatizá las mejoras de tu sitio y optimizá tu web paso a paso usando nuestra app un ratito cada día.</p>
                  </div>
                </div>
                <div className="flex items-start gap-5">
                  <div className="w-14 h-14 bg-green-500/20 rounded-xl flex items-center justify-center text-3xl flex-shrink-0 border border-green-500/30">📈</div>
                  <div>
                    <h3 className="text-lg md:text-xl font-black text-green-400">Resultados en Tiempo Real</h3>
                    <p className="text-slate-300 font-semibold text-base md:text-lg leading-relaxed mt-1.5">No esperes semanas a que Google descubra tus mejoras. Usá nuestro botón de indexación directa para avisarle al buscador al instante y superar a tu competencia.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Acción (antes COLUMNA DERECHA) */}
            <div className="w-full flex flex-col items-center justify-center space-y-8 p-4">
              <div className="w-full max-w-sm text-center space-y-6">
                <h2 className="text-3xl font-black text-slate-800 dark:text-slate-100 mb-4">
                  ¿Listo para despegar?
                </h2>
                
                <button 
                  onMouseEnter={() => playClick()} 
                  onClick={() => { playClick(); setShowIntroModal(true); }} 
                  className="btn-3d btn-green text-xl md:text-2xl px-6 py-4 w-full transform hover:scale-105 transition-all focus:ring-4 focus:ring-green-300/50"
                >
                  EMPEZAR A JUGAR
                </button>

                {/* Trust badge */}
                <div className="flex items-start gap-3 bg-green-950/40 border border-green-800/40 rounded-2xl px-4 py-3 text-left">
                  <span className="text-lg flex-shrink-0 mt-0.5">🔒</span>
                  <p className="text-xs font-bold text-green-300/80 leading-relaxed">
                    Registro de partida seguro con Google. No solicitamos accesos privados, contraseñas ni permisos sobre tus sitios web para empezar a jugar.
                  </p>
                </div>

                <div className="pt-6 w-full flex justify-center">
                  {session ? (
                    <div className="flex flex-col items-center gap-4 w-full">
                      <div className="flex items-center justify-center gap-3 bg-white dark:bg-slate-800 px-6 py-3 w-full rounded-2xl border-2 border-slate-200 dark:border-slate-700 shadow-sm">
                        {session.user?.image ? (
                          <img src={session.user.image} alt="User" className="w-8 h-8 rounded-full border border-slate-200" />
                        ) : (
                          <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center text-sm">👤</div>
                        )}
                        <p className="text-sm font-bold text-slate-600 dark:text-slate-300 truncate">Conectado como {session.user?.name}</p>
                      </div>
                      <button
                        onClick={() => { playClick(); signOut(); }}
                        className="text-xs text-slate-400 font-bold hover:text-red-500 transition-colors"
                      >
                        Cerrar sesión / Usar otra cuenta
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { playClick(); signIn('google'); }}
                      className="btn-3d btn-white flex items-center justify-center gap-3 text-lg px-8 py-4 w-full"
                    >
                      <img src="https://www.gstatic.com/images/branding/product/1x/googleg_48dp.png" alt="Google" className="w-6 h-6" />
                      CONECTAR CON GOOGLE
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 1 && showIntroModal && (
          <div className="w-full max-w-xl mx-auto text-center space-y-8 animate-in zoom-in duration-500">
             <div className="text-8xl animate-bounce">🦉</div>
             <h2 className="text-2xl md:text-3xl font-extrabold text-yellow-400 tracking-tight drop-shadow-md">
               ¡Atención, Jugador!
             </h2>
             <div className="bg-slate-900 text-white p-6 md:p-8 rounded-3xl border-2 border-slate-700 shadow-xl relative text-left w-full mx-auto">
               <p className="text-base md:text-lg font-bold leading-relaxed mb-5">
                 Antes de arrancar, tenés que saber una <span className="text-yellow-400 font-black">regla de oro</span>: este juego tiene <span className="text-cyan-400 font-black">consecuencias en tu vida real</span>.
               </p>
               <p className="text-base md:text-lg font-bold leading-relaxed mb-5">
                 Cada H1, Meta o texto ALT que optimices acá viaja directo a <span className="text-green-400 font-black">Google</span>. Sumar XP en SEOJUMP significa que clientes reales van a encontrar tu negocio en su celular.
               </p>
               <p className="text-lg md:text-xl font-bold text-white text-center pt-2">
                 ¿Listo para <span className="text-green-400 font-black">vender más</span>?
               </p>
               <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 w-0 h-0 border-b-[16px] border-b-slate-900 border-x-[12px] border-x-transparent"></div>
             </div>
             <button
               onClick={() => {
                 playClick();
                 setShowIntroModal(false);
                 nextStep();
               }}
               className="btn-3d btn-green text-lg w-full py-3.5 mt-8"
             >
               ¡ENTENDIDO, VAMOS A JUGAR!
             </button>
          </div>
        )}

        {step === 2 && (
          <div className="w-full max-w-md mx-auto px-4 flex flex-col items-center justify-center text-center space-y-6 animate-in slide-in-from-right duration-300">
            {/* Colorful Tabs Preview */}
            <nav className="flex gap-2 w-full opacity-85 pointer-events-none mb-6">
              <div className="flex-1 min-w-[65px] btn-3d bg-yellow-50 text-duo-yellow text-center py-1.5 px-1 text-xs md:text-sm border-b-4 border-duo-yellow font-black">
                🔍 F1
              </div>
              <div className="flex-1 min-w-[65px] btn-3d bg-blue-50 text-blue-600 text-center py-1.5 px-1 text-xs md:text-sm border-b-4 border-blue-500 font-black">
                ✍️ F2
              </div>
              <div className="flex-1 min-w-[65px] btn-3d bg-white text-slate-800 text-center py-1.5 px-1 text-xs md:text-sm border-b-4 border-duo-green font-black">
                🛠️ F3
              </div>
              <div className="flex-1 min-w-[65px] btn-3d bg-purple-50 text-purple-600 text-center py-1.5 px-1 text-xs md:text-sm border-b-4 border-purple-600 font-black">
                🕵️‍♂️ F4
              </div>
            </nav>

            <h2 className="text-xl md:text-2xl font-black text-slate-800 text-center">
              ¿Cuál es tu sitio web?
            </h2>
             <div className="card-3d bg-white w-full max-w-md mx-auto">
               <input 
                 type="text" 
                 placeholder="ej: miweb.com"
                 value={url}
                 onChange={(e) => setUrl(e.target.value)}
                 className="w-full p-3 md:p-4 text-lg md:text-xl border-2 border-slate-200 rounded-xl focus:border-duo-blue outline-none transition-colors font-black text-slate-750 placeholder-slate-400 dark:bg-slate-800 dark:border-slate-700"
               />
             </div>
             <div className="flex flex-col gap-4 w-full max-w-md mx-auto">
                <button 
                  onClick={() => { 
                    playClick(); 
                    localStorage.setItem("seojump_site_url", url);
                    nextStep(); 
                  }} 
                  disabled={!url.trim()}
                  className={`btn-3d btn-blue w-full text-lg md:text-xl py-3.5 md:py-4 font-black tracking-wide ${!url.trim() ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
                >
                  CONTINUAR
                </button>

                {missionError && (
                  <div className="p-4 bg-red-50 dark:bg-red-955/20 border-2 border-red-200 dark:border-red-800 text-red-500 rounded-xl font-bold text-sm text-center space-y-3 animate-in fade-in duration-300 w-full">
                    <p>⚠️ {missionError}</p>
                    {missionError.includes("Search Console") && (
                      <button
                        onClick={() => {
                          playClick();
                          signIn("google", {
                            callbackUrl: "/",
                            authorizationParams: {
                              scope: "openid email profile https://www.googleapis.com/auth/webmasters"
                            }
                          });
                        }}
                        className="w-full btn-3d bg-green-500 border-green-600 border-b-4 hover:bg-green-450 active:border-b-0 active:translate-y-1 text-white text-xs font-black py-2.5 flex items-center justify-center gap-1.5"
                      >
                        Conectar Google Search Console
                      </button>
                    )}
                  </div>
                )}
               
               <div className="relative py-4 w-full">
                 <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-gray-300"></span></div>
                 <div className="relative flex justify-center text-sm uppercase"><span className="bg-[#07070d] px-2 text-slate-500 font-bold">O también</span></div>
               </div>

               <div className="flex justify-center w-full">
                 {session ? (
                   <div className="flex items-center gap-2 text-duo-green font-bold">
                     <span>✅ Sesión iniciada: {session.user?.name}</span>
                   </div>
                 ) : (
                   <LoginButton text="CONECTAR CON GOOGLE" />
                 )}
               </div>

               <button onClick={() => { playClick(); prevStep(); }} className="text-slate-500 font-bold hover:text-slate-700 transition-colors w-full text-center">
                 VOLVER ATRÁS
               </button>
             </div>
          </div>
        )}

        {step === 3 && (
          <div className="w-full max-w-md mx-auto px-4 flex flex-col items-center justify-center text-center space-y-6 animate-in slide-in-from-right duration-300">
            <h2 className="text-xl md:text-2xl font-black text-slate-800 text-center">
              ¿Cuál es tu objetivo?
            </h2>
            <div className="space-y-3 w-full flex flex-col items-center">
              {[
                { id: 'vender', label: '💰 Vender más', color: 'btn-yellow' },
                { id: 'visitas', label: '📈 Conseguir más visitas', color: 'btn-blue' },
                { id: 'local', label: '📍 Ser el #1 en mi ciudad', color: 'btn-green' }
              ].map((option) => (
                <button 
                  key={option.id}
                  onClick={() => { playClick(); setGoal(option.id); }}
                  className={`btn-3d w-full max-w-sm md:max-w-md text-lg md:text-xl py-3 px-6 font-black ${goal === option.id ? `${option.color} text-white` : 'btn-white text-slate-650 dark:text-slate-200 dark:bg-slate-800 dark:border-slate-700'}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-4 w-full max-w-sm md:max-w-md items-center">
              <button 
                onClick={() => { playClick(); handleAnalyze(); }} 
                disabled={!goal}
                className={`btn-3d btn-green w-full text-lg md:text-xl py-3.5 md:py-4 font-black tracking-wide ${!goal ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
              >
                {session ? "ANALIZAR SITIO" : "CONECTAR Y ANALIZAR"}
              </button>
              <button onClick={() => { playClick(); prevStep(); }} className="btn-3d btn-white w-full text-base md:text-lg py-2.5 md:py-3 font-extrabold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100">
                VOLVER
              </button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="w-full text-center space-y-12 py-12 animate-in zoom-in duration-500">
            <div className="relative w-48 h-48 mx-auto">
              <div className="absolute inset-0 rounded-full border-8 border-gray-100"></div>
              <div 
                className="absolute inset-0 rounded-full border-8 border-duo-blue border-t-transparent animate-spin"
                style={{ animationDuration: '1s' }}
              ></div>
              <div className="absolute inset-0 flex items-center justify-center text-4xl">
                🏎️
              </div>
            </div>
            <div className="space-y-4 max-w-md mx-auto w-full">
              <h2 className="text-xl md:text-2xl font-black text-slate-800 dark:text-slate-100">
                🦉 Conectando con los servidores del sitio web...
              </h2>
              <p className="text-lg font-bold text-duo-blue animate-pulse">
                {scanMessage}
              </p>
              <div className="w-full h-6 bg-gray-200 rounded-full border-2 border-slate-200 overflow-hidden">
                <div 
                  className="h-full bg-duo-blue transition-all duration-75"
                  style={{ width: `${scanProgress}%` }}
                ></div>
              </div>
              <p className="text-sm font-bold text-slate-400 dark:text-slate-500">
                Analizando {url} de forma directa y autónoma...
              </p>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="w-full max-w-md mx-auto text-center space-y-8 animate-in fade-in duration-500">
             <div className="text-8xl">✨</div>
             <h2 className="text-2xl md:text-3xl font-black text-duo-green">¡Todo listo!</h2>
             <div className="card-3d text-left">
                <p className="text-lg md:text-xl font-bold text-slate-800 mb-4">
                  Hemos analizado <span className="text-duo-blue">{url}</span>.
                </p>
                <p className="text-slate-600 font-bold italic text-base">
                  "Tu sitio tiene potencial, pero faltan algunos detalles técnicos para llegar a la cima."
                </p>
             </div>
              <button 
                 onClick={() => {
                   playClick();
                   if (!session) {
                     signIn("google");
                   } else {
                     router.push("/buscador-de-oro");
                   }
                 }} 
                 className="btn-3d btn-green text-lg md:text-xl py-3.5 md:py-4 font-black tracking-wide w-full"
               >
                {session ? "VER MI DASHBOARD" : "CONECTAR PARA CONTINUAR"}
             </button>
          </div>
        )}

        {step >= 6 && (
          <div className="w-full max-w-7xl mx-auto flex flex-wrap lg:flex-nowrap gap-8 animate-in slide-in-from-bottom duration-500 items-start px-4">
             {/* PANEL IZQUIERDO (Lateral de Control) */}
             <div className="w-full lg:w-[380px] flex-shrink-0 flex flex-col gap-6 sticky top-4">
               {/* Dashboard Header */}
               <header className="w-full flex flex-col md:flex-row lg:flex-col items-stretch md:items-center lg:items-start justify-between bg-white dark:bg-slate-800 p-4 md:p-5 rounded-2xl border-2 border-duo-white-shadow dark:border-slate-700 transition-colors duration-300 gap-4">
                 <div className="flex items-center gap-4 w-full md:w-auto">
                   <div className="w-12 h-12 bg-duo-blue rounded-lg flex items-center justify-center text-white text-2xl flex-shrink-0">🌐</div>
                   <span className="text-xl lg:text-2xl font-black text-slate-800 dark:text-slate-100 truncate">{url}</span>
                 </div>
                 
                 <div className="flex items-center justify-between md:justify-end lg:justify-between w-full md:w-auto gap-4 lg:w-full border-t md:border-t-0 lg:border-t border-slate-100 dark:border-slate-700/50 pt-3 md:pt-0 lg:pt-3">
                   <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className="text-3xl">🔥</span>
                      <span className="text-2xl lg:text-3xl font-black text-orange-500">{Math.floor(xp / 100) + 1}</span>
                   </div>
                   <div className="flex items-center gap-3">
                     <Link
                       href="/blog"
                       onClick={playClick}
                       className="btn-3d btn-white hover:text-cyan-500 text-xs px-3 py-2 font-black uppercase tracking-wider transition-colors flex-shrink-0"
                     >
                       📖 Academia
                     </Link>
                     <button onClick={toggleMute} className="text-3xl hover:scale-110 transition-transform" title={isMuted ? "Activar sonido" : "Silenciar"}>
                       {isMuted ? '🔇' : '🔊'}
                     </button>
                     <button onClick={() => { toggleTheme(); playThemeToggle(theme === "light"); }} className="text-3xl hover:scale-110 transition-transform" title="Cambiar Tema">
                       {theme === "light" ? '🌙' : '☀️'}
                     </button>
                     <NotificationBell />
                     <Link href="/perfil" onClick={playClick} className="hover:scale-105 transition-transform flex-shrink-0" title="Ver Perfil">
                       {session?.user?.image ? (
                         <img src={session.user.image} alt="Avatar" className="w-12 h-12 rounded-full border-2 border-duo-green-shadow flex-shrink-0" />
                       ) : (
                         <div className="w-12 h-12 bg-duo-green rounded-full flex items-center justify-center border-b-4 border-duo-green-shadow text-white flex-shrink-0 text-xl">👤</div>
                       )}
                     </Link>
                   </div>
                 </div>
               </header>
 
               {/* Level & XP Stats */}
               <div className="card-3d bg-white dark:bg-slate-800 p-5 space-y-3">
                 <div className="flex items-center justify-between">
                   <span className="text-2xl lg:text-3xl font-black text-duo-yellow">NIVEL {Math.floor(xp / 100) + 1}</span>
                   <span className="text-base lg:text-lg font-bold text-slate-500 dark:text-slate-400">{xp % 100} / 100 XP</span>
                 </div>
                 {prestigeCycles > 0 && (
                   <div className="flex justify-start">
                     <span className="px-2.5 py-1 bg-gradient-to-r from-yellow-500 to-amber-600 text-slate-900 font-black text-xs rounded-full shadow-sm animate-pulse">
                       🪙 Prestigio x{prestigeCycles}
                     </span>
                   </div>
                 )}
                 <div className="w-full h-8 bg-gray-100 dark:bg-slate-700 rounded-full border-2 border-slate-200 dark:border-slate-600 overflow-hidden">
                   <div className="h-full bg-duo-yellow transition-all duration-1000" style={{ width: `${xp % 100}%` }}></div>
                 </div>
               </div>
 
               {/* Navigation Menu */}
               <nav className="flex flex-wrap lg:flex-col gap-2 lg:gap-4 w-full">
                 <Link href="/buscador-de-oro" onClick={playClick} className="flex-1 btn-3d btn-white text-slate-655 dark:text-slate-350 hover:text-duo-yellow text-center !py-2.5 !px-2 md:!py-5 md:!px-6 !text-xs md:!text-lg lg:!text-xl font-black transition-colors">
                   <span className="md:hidden">🔍 F1</span><span className="hidden md:inline">🔍 Fase 1: Búsqueda</span>
                 </Link>
                 {prog?.p2?.unlocked ? (
                   <Link href="/contenido" onClick={playClick} className="flex-1 btn-3d btn-white text-slate-655 dark:text-slate-350 hover:text-blue-500 text-center !py-2.5 !px-2 md:!py-5 md:!px-6 !text-xs md:!text-lg lg:!text-xl font-black transition-colors">
                     <span className="md:hidden">✍️ F2</span><span className="hidden md:inline">✍️ Fase 2: Contenido</span>
                   </Link>
                 ) : (
                   <div className="flex-1 btn-3d btn-white text-slate-400 bg-gray-50 dark:bg-slate-800 dark:border-slate-700 opacity-70 cursor-not-allowed text-center !py-2.5 !px-2 md:!py-5 md:!px-6 !text-xs md:!text-lg lg:!text-xl font-black flex items-center justify-center gap-1"
                     title="🔒 Completá el 70% de la Fase 1 para avanzar">
                     <span className="md:hidden">🔒 F2</span><span className="hidden md:inline">🔒 Fase 2: Contenido</span>
                   </div>
                 )}
                 {prog?.p3?.unlocked ? (
                   <Link href="/optimizacion" onClick={playClick}
                     className="flex-1 btn-3d text-center !py-2.5 !px-2 md:!py-5 md:!px-6 !text-xs md:!text-lg lg:!text-xl font-black transition-colors btn-white text-slate-655 dark:text-slate-350 hover:text-duo-green">
                     <span className="md:hidden">🛠️ F3</span><span className="hidden md:inline">🛠️ Fase 3: Optimización</span>
                   </Link>
                 ) : (
                   <div className="flex-1 btn-3d btn-white text-slate-400 bg-gray-50 dark:bg-slate-800 dark:border-slate-700 opacity-70 cursor-not-allowed text-center !py-2.5 !px-2 md:!py-5 md:!px-6 !text-xs md:!text-lg lg:!text-xl font-black flex items-center justify-center gap-1"
                     title="🔒 Completá el 70% de la Fase 2 para avanzar">
                     <span className="md:hidden">🔒 F3</span><span className="hidden md:inline">🔒 Fase 3: Optimización</span>
                   </div>
                 )}
                 {prog?.p4?.unlocked ? (
                   <Link href="/detective-de-enlaces" onClick={playClick} className="flex-1 btn-3d btn-white text-slate-655 dark:text-slate-350 hover:text-purple-650 text-center !py-2.5 !px-2 md:!py-5 md:!px-6 !text-xs md:!text-lg lg:!text-xl font-black transition-colors">
                     <span className="md:hidden">🕵️‍♂️ F4</span><span className="hidden md:inline">🕵️‍♂️ Fase 4: Indexación</span>
                   </Link>
                 ) : (
                   <div className="flex-1 btn-3d btn-white text-slate-400 bg-gray-50 dark:bg-slate-800 dark:border-slate-700 opacity-70 cursor-not-allowed text-center !py-2.5 !px-2 md:!py-5 md:!px-6 !text-xs md:!text-lg lg:!text-xl font-black flex items-center justify-center gap-1"
                     title="🔒 Completá el 70% de la Fase 3 para avanzar">
                     <span className="md:hidden">🔒 F4</span><span className="hidden md:inline">🔒 Fase 4: Indexación</span>
                   </div>
                 )}
                 <Link href="/blog" onClick={playClick} className="flex-1 btn-3d btn-white text-slate-655 dark:text-slate-350 hover:text-cyan-500 text-center !py-2.5 !px-2 md:!py-5 md:!px-6 !text-xs md:!text-lg lg:!text-xl font-black transition-colors">
                   <span className="md:hidden">📖 Academia</span><span className="hidden md:inline">📖 Academia SEO</span>
                 </Link>
               </nav>
              </div>

              {/* PANEL CENTRAL (Misiones o Detalle) */}
              <div className="w-full lg:flex-1 min-w-0 max-w-5xl mx-auto flex flex-col gap-8">
                
                {step === 6 && (
                  <div className="w-full space-y-6 animate-in fade-in duration-300">
                    <h2 className="text-3xl lg:text-4xl font-black text-slate-800 dark:text-slate-100">Fase 3: Optimización On-Page 🛠️</h2>

                    {/* --- QUICK WINS HIGHLIGHT (EL GANCHO) --- */}
                    <QuickWinsHighlight 
                      quickWins={quickWins} 
                      completedQuickWins={completedQuickWins} 
                      playClick={playClick} 
                      router={router} 
                    />

                    <div className="space-y-4">
                    {missions.length > 0 ? (
                       <>
                         {/* Pendientes */}
                         {missions.filter(m => !completedIds.has(m.id)).slice(0, 10).length > 0 ? (
                           missions.filter(m => !completedIds.has(m.id)).slice(0, 10).map((mission) => {
                             return (
                               <div 
                                  key={mission.id}
                                  onClick={() => { playClick(); openMission(mission); }}
                                  className="card-3d flex flex-col md:flex-row items-start gap-4 md:gap-6 p-4 md:p-8 transition-colors group hover:bg-gray-50 dark:hover:bg-slate-750 cursor-pointer mb-4 w-full overflow-hidden"
                               >
                                 <div className={`w-20 h-20 rounded-2xl flex-shrink-0 flex items-center justify-center border-b-4 text-3xl font-black ${
                                   mission.type === 'H1' ? 'bg-duo-green border-duo-green-shadow text-white' : 
                                   mission.type === 'ALT' ? 'bg-duo-blue border-duo-blue-shadow text-white' : 
                                   'bg-duo-yellow border-duo-yellow-shadow text-white'
                                 }`}>
                                   {mission.icon}
                                 </div>
                                 <div className="flex-1 min-w-0 w-full">
                                   {(() => {
                                      const badge = getBadgeInfo(mission.page);
                                      return (
                                        <>
                                          <div className="flex items-center gap-3 flex-wrap mb-1.5">
                                            <h3 className="text-xl md:text-2xl lg:text-3xl font-black transition-colors text-slate-800 dark:text-slate-100 group-hover:text-duo-green">{mission.title}</h3>
                                            <span className={`text-sm lg:text-base font-black px-3 py-1 rounded-md ${badge.color}`}>
                                              {badge.text}
                                            </span>
                                          </div>
                                          <div className="flex items-center gap-2 mb-1.5 w-full min-w-0">
                                            <code className="text-xs md:text-sm font-mono text-slate-500 dark:text-slate-400 truncate block w-full max-w-[200px] min-[400px]:max-w-[260px] sm:max-w-[380px] md:max-w-[450px]">
                                              {mission.page}
                                            </code>
                                            <button 
                                              onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(mission.page); playClick(); }}
                                              className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex-shrink-0 text-lg"
                                              title="Copiar URL"
                                            >
                                              📋
                                            </button>
                                          </div>
                                          <p className="text-sm lg:text-base text-slate-400 dark:text-slate-500 font-bold italic mb-2">
                                            {badge.wpPath}
                                          </p>
                                        </>
                                      );
                                    })()}
                                   <p className="font-bold text-slate-650 dark:text-slate-350 text-base lg:text-lg mb-2">{mission.description}</p>
                                   <div className="flex flex-wrap gap-4 mt-3 text-sm lg:text-base font-bold text-slate-550 dark:text-slate-400">
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
                           <div className="text-center py-4 bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-200 dark:border-slate-700">
                             <p className="text-slate-500 font-bold text-lg">¡Todas las misiones completadas! 🎉</p>
                           </div>
                         )}
                       </>
                    ) : (
                      <div className="text-center py-8 space-y-4">
                        {missionError ? (
                          missionError === "MISSING_SEARCH_CONSOLE_SCOPE" ? (
                            <div className="max-w-md mx-auto p-6 md:p-8 bg-white dark:bg-slate-800 rounded-3xl border-2 border-slate-200 dark:border-slate-700 shadow-xl text-center space-y-6 animate-in zoom-in-95 duration-300">
                              <div className="text-6xl animate-bounce">🔑</div>
                              <div className="space-y-3">
                                <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 leading-tight">
                                  Vinculá tu Search Console 🏁
                                </h3>
                                <p className="text-sm font-bold text-slate-500 dark:text-slate-400 leading-relaxed">
                                  Para cargar las misiones SEO reales de tu sitio y permitir la indexación automática, necesitamos permiso de conexión de tus propiedades de Google Search Console. Es 100% seguro.
                                </p>
                              </div>
                              <button
                                onClick={() => {
                                  playClick();
                                  signIn("google", {
                                    callbackUrl: "/",
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
                              <p className="text-red-400 font-bold">⚠️ Error al conectar con Search Console</p>
                              <p className="text-sm text-slate-500 font-bold">{missionError}</p>
                              <button onClick={() => { playClick(); signOut(); }} className="btn-3d btn-green text-sm py-3 px-6">
                                🔄 RECONECTAR CON GOOGLE
                              </button>
                            </>
                          )
                        ) : (
                          <p className="text-slate-500 font-bold">No encontramos misiones para este sitio.</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* STEP 7: MISSION MODAL - Dynamic based on selectedMission */}
              {step === 7 && selectedMission && (
                <div className="w-full space-y-8 animate-in zoom-in duration-300">
                  {/* Mission Header */}
                  <div className="flex items-start md:items-center flex-col md:flex-row gap-4 mb-4">
                    <button onClick={() => { playClick(); setStep(6); }} className="text-5xl text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 hidden md:block">✕</button>
                    <div>
                      <h2 className="text-3xl lg:text-4xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-3">
                        <button onClick={() => { playClick(); setStep(6); }} className="text-2xl text-slate-500 md:hidden">←</button>
                        Misión: {selectedMission.type}
                      </h2>
                      <p className="text-base lg:text-lg font-bold text-slate-550 dark:text-slate-400 truncate max-w-full md:max-w-md">{selectedMission.pagePath}</p>
                    </div>
                  </div>

                  {/* Search Console Data Card */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 text-center border-2 border-gray-100 dark:border-slate-700 shadow-sm">
                      <div className="text-2xl md:text-3xl lg:text-4xl font-black text-duo-blue">{selectedMission.clicks}</div>
                      <div className="text-xs md:text-sm lg:text-base font-bold text-slate-555 dark:text-slate-400">Oportunidades de Venta</div>
                    </div>
                    <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 text-center border-2 border-gray-100 dark:border-slate-700 shadow-sm">
                      <div className="text-2xl md:text-3xl lg:text-4xl font-black text-duo-yellow">{selectedMission.impressions}</div>
                      <div className="text-xs md:text-sm lg:text-base font-bold text-slate-555 dark:text-slate-400">Dinero sobre la mesa</div>
                    </div>
                    <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 text-center border-2 border-gray-100 dark:border-slate-700 shadow-sm">
                      <div className="text-2xl md:text-3xl lg:text-4xl font-black text-duo-green">#{selectedMission.position?.toFixed(0)}</div>
                      <div className="text-xs md:text-sm lg:text-base font-bold text-slate-500 dark:text-slate-400">Posición</div>
                    </div>
                  </div>

                  {/* Módulo Educativo ("Explicación del Búho") */}
                  <div className="w-full">
                    <button 
                      onClick={() => { playClick(); setShowOwl(!showOwl); }} 
                      className={`w-full flex items-center justify-between p-5 rounded-2xl border-2 font-black transition-all ${showOwl ? 'bg-slate-800 border-slate-600 text-white text-xl md:text-2xl' : 'bg-white dark:bg-slate-800 border-gray-100 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600 text-xl md:text-2xl'}`}
                    >
                      <span className="flex items-center gap-4">
                        <span className="text-4xl">🦉</span> 
                        Explicación del Búho
                      </span>
                      <span className="text-3xl">{showOwl ? '−' : '+'}</span>
                    </button>
                    
                    <div className={`overflow-hidden transition-all duration-300 ease-in-out mt-2 ${showOwl ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
                      <div className="bg-slate-900 p-6 rounded-2xl border-2 border-slate-700 shadow-xl flex gap-4 items-start relative">
                         <div className="text-6xl md:text-7xl animate-bounce flex-shrink-0 drop-shadow-lg z-10">🦉</div>
                         <div className="flex-1">
                            <div className="bg-slate-800 text-slate-200 p-6 rounded-2xl rounded-tl-none font-bold text-base md:text-lg lg:text-xl leading-relaxed shadow-lg border border-slate-600 relative">
                               {selectedMission.type === 'H1' && (
                                 <p>El <strong className="text-duo-green">H1</strong> es el título principal de tu local. Google lo lee primero para saber EXACTAMENTE de qué se trata tu página. Tiene que ser claro, contener tu palabra clave y convencer al usuario.</p>
                               )}
                               {selectedMission.type === 'META' && (
                                 <p>La <strong className="text-duo-yellow">Meta Descripción</strong> es el cartel que ve la gente en la vereda de Google antes de entrar. No te hace subir puestos directamente, pero un buen gancho comercial define si te dan el clic a vos o siguen de largo al taller de al lado.</p>
                               )}
                               {selectedMission.type === 'ALT' && (
                                 <p>Google es ciego para los ojos pero lee como los dioses. Si subís la foto de un producto sin <strong className="text-duo-blue">ALT</strong>, el robot no sabe qué es. Al ponerle una descripción con tu palabra clave, empezás a indexar en Google Imágenes y capturás clientes que buscan para comprar.</p>
                               )}
                               <div className="absolute top-0 -left-2 w-0 h-0 border-t-[10px] border-t-slate-800 border-l-[10px] border-l-transparent"></div>
                            </div>
                         </div>
                      </div>
                    </div>
                  </div>

                  {/* Help Hints Accordion */}
                  <div className="w-full text-right">
                    <button 
                      onClick={() => { playClick(); setShowHelp(!showHelp); }} 
                      className="text-base lg:text-lg text-slate-500 font-black hover:text-duo-blue transition-colors inline-flex items-center gap-1.5"
                    >
                      💡 ¿Cómo lo soluciono?
                    </button>
                    
                    <div className={`overflow-hidden transition-all duration-300 ease-in-out text-left mt-2 ${showHelp ? 'max-h-60 opacity-100' : 'max-h-0 opacity-0'}`}>
                      <div className="bg-slate-800 p-6 rounded-2xl border-2 border-slate-700 shadow-inner">
                        <h4 className="text-duo-yellow font-black mb-3 text-base lg:text-lg tracking-wide uppercase">Pasos sugeridos:</h4>
                        <ul className="space-y-3">
                          {selectedMission.pistas?.map((pista, idx) => (
                            <li key={idx} className="text-slate-300 text-base lg:text-lg font-bold flex gap-2">
                              <span className="text-duo-blue flex-shrink-0">{pista.charAt(0)}</span>
                              <span>{pista.substring(2)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* Mission Input */}
                  <div className="card-3d bg-white dark:bg-slate-800 space-y-6 p-6 md:p-8">
                    <p className="font-bold text-slate-650 dark:text-slate-300 text-base md:text-lg lg:text-xl">
                      {selectedMission.type === 'H1' && <>Primero hace el cambio en tu web, después escribí acá el nuevo <span className="text-duo-green">H1</span> que pusiste en <span className="text-duo-blue break-all">{selectedMission.pagePath === '/' ? 'tu página de inicio' : selectedMission.pagePath}</span>:</>}
                      {selectedMission.type === 'META' && <>Actualizá la <span className="text-duo-yellow">Meta Descripción</span> de tu sitio, después pegala acá para que verifiquemos:</>}
                      {selectedMission.type === 'ALT' && <>Agregá el texto <span className="text-duo-blue">ALT</span> a una imagen en <span className="text-duo-blue break-all">{selectedMission.pagePath === '/' ? 'tu página de inicio' : selectedMission.pagePath}</span>, después escribí acá el ALT que usaste:</>}
                    </p>

                    <input 
                      type="text"
                      placeholder={
                        selectedMission.type === 'H1' ? 'ej: Detailing Profesional en Buenos Aires' :
                        selectedMission.type === 'META' ? 'ej: Los mejores productos de detailing. Envío gratis.' :
                        'ej: Auto rojo siendo encerado con cera carnauba'
                      }
                      value={h1Value}
                      onChange={(e) => setH1Value(e.target.value)}
                      className="w-full p-5 text-xl md:text-2xl border-2 border-slate-200 dark:border-slate-600 rounded-xl focus:border-duo-green outline-none font-black text-slate-800 dark:text-slate-100 dark:bg-slate-700"
                    />
                    <p className="text-sm lg:text-base text-slate-500 dark:text-slate-400 font-bold">
                      {h1Value.length} / {selectedMission.type === 'META' ? '160' : '70'} caracteres
                    </p>
                    
                    {verifyResult && missionStatus !== 'idle' && (
                      <div className={`p-5 rounded-2xl border-2 font-bold text-base lg:text-lg ${
                        verifyResult.success
                          ? 'bg-green-50 dark:bg-green-900/30 border-duo-green text-duo-green'
                          : 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800 text-red-500'
                      }`}>
                        <p className="mb-1">{verifyResult.success ? '✅' : '⚠️'} {verifyResult.message}</p>
                        {verifyResult.liveValue && !verifyResult.success && (
                          <p className="text-sm lg:text-base text-slate-600 dark:text-slate-400 mt-2 font-bold">
                            💡 Valor actual en tu web: <span className="italic">"{verifyResult.liveValue}"</span>
                          </p>
                        )}
                        {!verifyResult.success && failedAttempts >= 2 && (
                          <p className="text-sm lg:text-base text-slate-500 dark:text-slate-400 mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl border border-yellow-200 dark:border-yellow-700/50">
                            💡 ¿Tu web no se actualiza? Si usás plugins de velocidad (WP Rocket, LiteSpeed, SG Optimizer), recordá tocar 'Borrar Caché' en tu barra de WordPress para que el Búho pueda leer tu cambio fresco.
                          </p>
                        )}
                      </div>
                    )}

                    {/* Chivatazo de Boxes: pista de dónde editar en WP */}
                    {missionStatus === 'error' && selectedMission?.page && (
                      <div className="bg-slate-800 border-2 border-slate-600 rounded-2xl p-5 text-base lg:text-lg font-bold text-slate-350 flex items-start gap-4">
                        <span className="text-2xl flex-shrink-0">🏎️</span>
                        <div>
                          <p className="font-black text-slate-100 mb-1.5">Pista de Boxes:</p>
                          {selectedMission.page.includes('/producto/') || selectedMission.page.includes('/product/') ? (
                            <p>Este contenido está dentro de un <span className="text-duo-yellow font-black">PRODUCTO de WooCommerce</span>. Editalo desde <strong>Productos → Todos los productos</strong> en tu panel de WordPress.</p>
                          ) : selectedMission.page.includes('/blog/') || selectedMission.page.includes('/entrada/') || selectedMission.page.includes('/post/') ? (
                            <p>Este contenido es una <span className="text-duo-blue font-black">ENTRADA de Blog</span>. Editala desde <strong>Entradas → Todas las entradas</strong> en tu panel de WordPress.</p>
                          ) : selectedMission.page.includes('/categoria-producto/') || selectedMission.page.includes('/categoria/') || selectedMission.page.includes('/category/') ? (
                            <p>Este contenido es una <span className="text-purple-400 font-black">CATEGORÍA de Tienda</span>. Editala desde <strong>Productos → Categorías</strong> en tu panel de WordPress.</p>
                          ) : (
                            <p>Este contenido es una <span className="text-green-400 font-black">PÁGINA Estática</span>. Editala desde <strong>Páginas → Todas las páginas</strong> en tu panel de WordPress.</p>
                          )}
                        </div>
                      </div>
                    )}

                    <button 
                      onClick={() => { playClick(); checkMission(); }}
                      disabled={verifyLoading || missionStatus === "success" || !h1Value.trim()}
                      className={`btn-3d w-full text-xl md:text-2xl py-5 ${
                        missionStatus === "success" ? "btn-green" :
                        verifyLoading ? "btn-white text-slate-500" :
                        "bg-slate-800 border-slate-900 border-b-4 text-white hover:bg-slate-700 active:border-b-0 active:translate-y-1 font-black"
                      }`}
                    >
                      {verifyLoading && "⏳ VERIFICANDO EN VIVO..."}
                      {!verifyLoading && missionStatus === "idle" && "🔍 VERIFICAR EN VIVO"}
                      {!verifyLoading && missionStatus === "error" && "🔄 REINTENTAR"}
                      {!verifyLoading && missionStatus === "success" && `🎉 ¡+${selectedMission.xp} XP GANADOS!`}
                    </button>
                  </div>

                  {missionStatus === "success" && (
                    <button onClick={() => { playClick(); setStep(6); }} className="btn-3d btn-green w-full text-2xl md:text-3xl py-5 mt-4 font-black">
                      VOLVER AL DASHBOARD
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* PANEL DERECHO (Panel de Boxes / Stats) */}
            <div className="hidden lg:flex w-[340px] flex-shrink-0 flex-col gap-6 sticky top-4">
               <div className="card-3d bg-slate-800 text-white border-slate-700 shadow-xl relative overflow-hidden p-8">
                 <div className="text-7xl mb-3 text-center animate-bounce">🦉</div>
                 <h3 className="text-2xl lg:text-3xl font-black text-yellow-400 text-center mb-4 leading-tight">Panel de<br/>Boxes</h3>
                 <p className="text-sm lg:text-base font-bold text-slate-300 mb-6 text-center leading-relaxed">
                   Monitoreando el tráfico orgánico de<br/><span className="text-green-400 font-bold truncate block mt-1">{url}</span>
                 </p>
                 
                 <div className="space-y-4">
                   <div className="bg-slate-900 rounded-xl p-4 border-2 border-slate-700 shadow-inner">
                     <p className="text-xs md:text-sm text-slate-400 uppercase font-black tracking-wider mb-1">Oportunidades de Venta</p>
                     <p className="text-3xl lg:text-4xl font-black text-duo-blue">{missions.reduce((acc, m) => acc + (m.clicks||0), 0).toLocaleString()}+</p>
                   </div>
                   <div className="bg-slate-900 rounded-xl p-4 border-2 border-slate-700 shadow-inner">
                     <p className="text-xs md:text-sm text-slate-400 uppercase font-black tracking-wider mb-1">Dinero sobre la mesa</p>
                     <p className="text-3xl lg:text-4xl font-black text-duo-yellow">{missions.reduce((acc, m) => acc + (m.impressions||0), 0).toLocaleString()}</p>
                   </div>
                   <div className="bg-slate-900 rounded-xl p-4 border-2 border-slate-700 shadow-inner">
                     <p className="text-xs md:text-sm text-slate-400 uppercase font-black tracking-wider mb-1">Keywords Ganadoras</p>
                     <p className="text-3xl lg:text-4xl font-black text-orange-500">{xp} XP</p>
                   </div>
                 </div>
                 
                 <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-5 rounded-full -mr-16 -mt-16 pointer-events-none"></div>
               </div>

                <button 
                   onClick={() => { playClick(); signOut(); }} 
                   className="btn-3d btn-white w-full text-slate-500 font-black hover:text-red-500 transition-colors text-base md:text-lg py-4"
                >
                   CERRAR SESIÓN (RECONECTAR)
                </button>
             </div>

          </div>
        )}

      </main>

      {/* Footer Legal (Google API Compliance) */}
      {step === 1 && !showIntroModal && (
        <footer className="w-full text-center mt-auto pb-4 space-x-6 text-sm font-semibold text-slate-400 dark:text-slate-500 animate-in fade-in duration-1000">
          <button onClick={() => { playClick(); setShowPrivacyModal(true); }} className="hover:text-slate-600 dark:hover:text-slate-300 transition-colors">Políticas de Privacidad</button>
          <button onClick={() => { playClick(); setShowTermsModal(true); }} className="hover:text-slate-600 dark:hover:text-slate-300 transition-colors">Términos del Servicio</button>
          <p className="mt-2 text-xs opacity-60">© {new Date().getFullYear()} SEOJUMP. Todos los derechos reservados.</p>
        </footer>
      )}

      {/* Privacy Modal */}
      {showPrivacyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-slate-900 border-2 border-slate-700 rounded-3xl p-8 max-w-2xl w-full text-slate-200 shadow-2xl relative">
            <h2 className="text-3xl font-black text-duo-green mb-4">Políticas de Privacidad</h2>
            <div className="space-y-4 text-sm font-semibold leading-relaxed">
              <p>Tu privacidad es nuestra prioridad absoluta en SEOJUMP.</p>
              <p>Esta aplicación utiliza la API de Google Search Console con el único fin de analizar el rendimiento orgánico de tu sitio web y sugerir mejoras. <strong className="text-white">SEOJUMP no almacena, vende ni transfiere a terceros ninguna información de tu Search Console.</strong></p>
              <p>Los datos obtenidos (clics, impresiones, URLs) se procesan en memoria o se almacenan localmente en tu navegador (`localStorage`) para mantener tu progreso en el juego. Nunca se guardan en servidores de terceros sin tu consentimiento explícito.</p>
            </div>
            <button 
              onClick={() => { playClick(); setShowPrivacyModal(false); }} 
              className="mt-8 btn-3d btn-white w-full py-3 text-slate-800"
            >
              CERRAR
            </button>
          </div>
        </div>
      )}

      {/* Terms Modal */}
      {showTermsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-slate-900 border-2 border-slate-700 rounded-3xl p-8 max-w-2xl w-full text-slate-200 shadow-2xl relative">
            <h2 className="text-3xl font-black text-duo-yellow mb-4">Términos del Servicio</h2>
            <div className="space-y-4 text-sm font-semibold leading-relaxed">
              <p>Bienvenido a SEOJUMP, el software de optimización SEO gamificado.</p>
              <p>Al conectar tu cuenta de Google, nos otorgas permiso de solo lectura para acceder a tus datos de Search Console con el fin de generar las misiones del juego.</p>
              <p>Ten en cuenta que las recomendaciones proporcionadas por SEOJUMP son sugerencias basadas en buenas prácticas de la industria. <strong className="text-white">Toda modificación que realices en tu sitio web es bajo tu propia responsabilidad.</strong> No garantizamos posiciones específicas en los resultados de búsqueda de Google.</p>
              <p>El uso de este software implica la aceptación de que el juego tiene consecuencias reales en tu posicionamiento orgánico.</p>
            </div>
            <button 
              onClick={() => { playClick(); setShowTermsModal(false); }} 
              className="mt-8 btn-3d btn-white w-full py-3 text-slate-800"
            >
              CERRAR
            </button>
          </div>
        </div>
      )}

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

    </div>
  );
}
