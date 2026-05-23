"use client";

import { useState, useEffect, useRef } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import LoginButton from "../components/LoginButton";
import { getRealMissions, verifyMission } from "../lib/actions";
import { useAudio } from "../hooks/useAudio";
import { useTheme } from "../hooks/useTheme";

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

  const router = useRouter();
  const [hasGoldKeyword, setHasGoldKeyword] = useState(false);
  
  // ─── READ GOLD KEYWORD STATUS ────────────────────────────────────────────
  // Read keyword state once on mount (no side-effect loops).
  useEffect(() => {
    const activeKeyword = localStorage.getItem("gold-tu-busqueda");
    setHasGoldKeyword(!!activeKeyword);
  }, []);

  // Persist XP and Completed Missions on mount
  useEffect(() => {
    const savedXp = localStorage.getItem("seojump_xp");
    if (savedXp) setXp(parseInt(savedXp, 10));

    const savedCompleted = localStorage.getItem("seojump_completed_missions");
    if (savedCompleted) {
      try {
        const parsed = JSON.parse(savedCompleted);
        if (Array.isArray(parsed)) {
          setCompletedIds(new Set(parsed));
        }
      } catch (e) {
        console.error("Error parsing completed missions", e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("seojump_xp", xp);
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
          // Fetch real missions before proceeding
          const goldKeyword = localStorage.getItem("gold-tu-busqueda") || undefined;
          getRealMissions(url, goldKeyword).then(realMissions => {
            setMissions(realMissions);
            setMissionError(null);
            // Persist missions so they survive navigation away and back
            try {
              localStorage.setItem("seojump_missions", JSON.stringify(realMissions));
            } catch (e) {}
            setTimeout(() => setStep(5), 1000);
          }).catch(err => {
            console.error("Failed to fetch missions:", err);
            setMissionError(err.message || 'Error al obtener datos de Search Console');
            setTimeout(() => setStep(5), 1000);
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
      const result = await verifyMission(selectedMission.page, selectedMission.type, h1Value);
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

  return (
    <div className={`min-h-screen bg-[#f7f7f7] dark:bg-slate-900 flex flex-col items-center p-8 font-fredoka relative overflow-hidden transition-colors duration-300 text-slate-800 dark:text-slate-100 ${step > 1 && step < 6 ? 'justify-center' : ''} ${step < 6 ? 'max-w-lg mx-auto w-full border-x dark:border-slate-800 shadow-2xl' : ''}`}>
      
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
          <div className="w-full flex flex-col gap-12 items-center animate-in fade-in zoom-in duration-500">
            
            {/* COLUMNA IZQUIERDA: Marketing y Valor */}
            <div className="space-y-10 text-left bg-slate-900 p-8 md:p-12 rounded-3xl border-2 border-slate-700 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-duo-green opacity-10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-yellow-500 opacity-5 rounded-full blur-3xl -ml-16 -mb-16 pointer-events-none"></div>

              {/* Título principal */}
              <div className="space-y-5">
                <div className="text-6xl">🏆</div>
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-white tracking-tight leading-[1.1]">
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
                    <h3 className="text-xl md:text-2xl font-black text-orange-400">Poné Primera en 10 Segundos</h3>
                    <p className="text-slate-300 font-semibold text-base md:text-lg leading-relaxed mt-1.5">Clavá tu URL y nuestro motor escaneará tu chasis web al instante para encontrar tus palabras de oro.</p>
                  </div>
                </div>
                <div className="flex items-start gap-5">
                  <div className="w-14 h-14 bg-yellow-500/20 rounded-xl flex items-center justify-center text-3xl flex-shrink-0 border border-yellow-500/30">💰</div>
                  <div>
                    <h3 className="text-xl md:text-2xl font-black text-yellow-400">Ahorrate cientos de miles de pesos al mes</h3>
                    <p className="text-slate-300 font-semibold text-base md:text-lg leading-relaxed mt-1.5">Hacele el rulo a las agencias. Automatizá las auditorías de etiquetas, títulos y metas con misiones que completás jugando en tus ratos libres.</p>
                  </div>
                </div>
                <div className="flex items-start gap-5">
                  <div className="w-14 h-14 bg-green-500/20 rounded-xl flex items-center justify-center text-3xl flex-shrink-0 border border-green-500/30">📈</div>
                  <div>
                    <h3 className="text-xl md:text-2xl font-black text-green-400">Más Tráfico, Más Ventas</h3>
                    <p className="text-slate-300 font-semibold text-base md:text-lg leading-relaxed mt-1.5">Cada luz verde que encendés en el tablero es una optimización real que impacta en Google para traerte clientes con la billetera en la mano.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* COLUMNA DERECHA: Acción */}
            <div className="flex flex-col items-center justify-center space-y-8 p-4 md:p-8">
              <div className="w-full max-w-sm text-center space-y-6">
                <h2 className="text-3xl font-black text-slate-800 dark:text-slate-100 mb-4">
                  ¿Listo para despegar?
                </h2>
                
                <button 
                  onMouseEnter={() => playClick()} 
                  onClick={() => { playClick(); setShowIntroModal(true); }} 
                  className="btn-3d btn-green text-2xl md:text-3xl px-8 py-5 w-full transform hover:scale-105 transition-all focus:ring-4 focus:ring-green-300/50"
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

                <div className="pt-6">
                  {session ? (
                    <div className="flex flex-col items-center gap-4">
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
          <div className="w-full text-center space-y-8 animate-in zoom-in duration-500">
             <div className="text-8xl animate-bounce">🦉</div>
             <h2 className="text-4xl md:text-5xl font-extrabold text-yellow-400 tracking-tight drop-shadow-md">
               ¡Atención, Jugador!
             </h2>
             <div className="bg-slate-900 text-white p-8 rounded-3xl border-2 border-slate-700 shadow-xl relative text-left max-w-3xl mx-auto">
               <p className="text-lg md:text-xl font-bold leading-relaxed mb-5">
                 Antes de arrancar, tenés que saber una <span className="text-yellow-400 font-black">regla de oro</span>: este juego tiene <span className="text-cyan-400 font-black">consecuencias en tu vida real</span>.
               </p>
               <p className="text-lg md:text-xl font-bold leading-relaxed mb-5">
                 Cada H1, Meta o texto ALT que optimices acá viaja directo a <span className="text-green-400 font-black">Google</span>. Sumar XP en SEOJUMP significa que clientes reales van a encontrar tu negocio en su celular.
               </p>
               <p className="text-xl md:text-2xl font-bold text-white text-center pt-2">
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
               className="btn-3d btn-green text-xl w-full py-4 mt-8"
             >
               ¡ENTENDIDO, VAMOS A JUGAR!
             </button>
          </div>
        )}

        {step === 2 && (
          <div className="w-full space-y-6 animate-in slide-in-from-right duration-300">
            {/* Colorful Tabs Preview */}
            <nav className="flex flex-wrap md:flex-nowrap gap-3 md:gap-4 w-full opacity-85 pointer-events-none mb-6">
              <div className="flex-1 min-w-[120px] btn-3d bg-yellow-50 text-duo-yellow text-center py-1.5 px-2 text-lg md:text-xl lg:text-2xl border-b-4 border-duo-yellow font-black">
                🔍 Fase 1
              </div>
              <div className="flex-1 min-w-[120px] btn-3d bg-blue-50 text-blue-600 text-center py-1.5 px-2 text-lg md:text-xl lg:text-2xl border-b-4 border-blue-500 font-black">
                ✍️ Fase 2
              </div>
              <div className="flex-1 min-w-[120px] btn-3d bg-white text-slate-800 text-center py-1.5 px-2 text-lg md:text-xl lg:text-2xl border-b-4 border-duo-green font-black">
                🛠️ Fase 3
              </div>
              <div className="flex-1 min-w-[120px] btn-3d bg-purple-50 text-purple-600 text-center py-1.5 px-2 text-lg md:text-xl lg:text-2xl border-b-4 border-purple-600 font-black">
                🕵️‍♂️ Fase 4
              </div>
            </nav>

            <h2 className="text-3xl font-black text-slate-800 text-center">
              ¿Cuál es tu sitio web?
            </h2>
             <div className="card-3d bg-white">
               <input 
                 type="text" 
                 placeholder="ej: miweb.com"
                 value={url}
                 onChange={(e) => setUrl(e.target.value)}
                 className="w-full p-3 md:p-4 text-3xl md:text-4xl border-2 border-slate-200 rounded-xl focus:border-duo-blue outline-none transition-colors font-black text-slate-750 placeholder-slate-400 dark:bg-slate-800 dark:border-slate-700"
               />
             </div>
             <div className="grid grid-cols-1 gap-4">
               <button 
                 onClick={() => { 
                   playClick(); 
                   localStorage.setItem("seojump_site_url", url);
                   nextStep(); 
                 }} 
                 disabled={!url.trim()}
                 className={`btn-3d btn-blue text-3xl md:text-4xl py-4 md:py-5 font-black tracking-wide ${!url.trim() ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
               >
                 CONTINUAR
               </button>
              
              <div className="relative py-4">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-gray-300"></span></div>
                <div className="relative flex justify-center text-sm uppercase"><span className="bg-[#f7f7f7] px-2 text-slate-500 font-bold">O también</span></div>
              </div>

              <div className="flex justify-center">
                {session ? (
                  <div className="flex items-center gap-2 text-duo-green font-bold">
                    <span>✅ Sesión iniciada: {session.user?.name}</span>
                  </div>
                ) : (
                  <LoginButton text="CONECTAR CON GOOGLE" />
                )}
              </div>

              <button onClick={() => { playClick(); prevStep(); }} className="text-slate-500 font-bold hover:text-slate-700 transition-colors">
                VOLVER ATRÁS
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="w-full space-y-6 animate-in slide-in-from-right duration-300">
            <h2 className="text-3xl font-black text-slate-800 text-center">
              ¿Cuál es tu objetivo?
            </h2>
            <div className="space-y-3">
              {[
                { id: 'vender', label: '💰 Vender más', color: 'btn-yellow' },
                { id: 'visitas', label: '📈 Conseguir más visitas', color: 'btn-blue' },
                { id: 'local', label: '📍 Ser el #1 en mi ciudad', color: 'btn-green' }
              ].map((option) => (
                <button 
                  key={option.id}
                  onClick={() => { playClick(); setGoal(option.id); }}
                  className={`btn-3d w-full text-3xl md:text-4xl py-3 md:py-4 px-6 font-black ${goal === option.id ? `${option.color} text-white` : 'btn-white text-slate-650 dark:text-slate-200 dark:bg-slate-800 dark:border-slate-700'}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-4">
              <button 
                onClick={() => { playClick(); handleAnalyze(); }} 
                disabled={!goal}
                className={`btn-3d btn-green text-3xl md:text-4xl py-4 md:py-5 font-black tracking-wide ${!goal ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
              >
                {session ? "ANALIZAR SITIO" : "CONECTAR Y ANALIZAR"}
              </button>
              <button onClick={() => { playClick(); prevStep(); }} className="btn-3d btn-white text-2xl md:text-3xl py-3.5 md:py-4 font-extrabold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100">
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
            <div className="space-y-4">
              <h2 className="text-3xl font-black text-slate-800 dark:text-slate-100">
                🦉 Conectando con los servidores del sitio web...
              </h2>
              <p className="text-xl font-bold text-duo-blue animate-pulse">
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
          <div className="w-full text-center space-y-8 animate-in fade-in duration-500">
             <div className="text-8xl">✨</div>
             <h2 className="text-4xl font-black text-duo-green">¡Todo listo!</h2>
             <div className="card-3d text-left">
                <p className="text-xl font-bold text-slate-800 mb-4">
                  Hemos analizado <span className="text-duo-blue">{url}</span>.
                </p>
                <p className="text-slate-600 font-bold italic">
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
                 className="btn-3d btn-green text-3xl md:text-4xl py-4 md:py-5 font-black tracking-wide w-full"
               >
                {session ? "VER MI DASHBOARD" : "CONECTAR PARA CONTINUAR"}
             </button>
          </div>
        )}

        {step >= 6 && (
          <div className="w-full max-w-[95%] lg:max-w-[1600px] mx-auto flex flex-col lg:flex-row gap-8 animate-in slide-in-from-bottom duration-500 items-start">
             {/* PANEL IZQUIERDO (Lateral de Control) */}
             <div className="w-full lg:w-[380px] flex-shrink-0 flex flex-col gap-6 sticky top-4">
               {/* Dashboard Header */}
               <header className="w-full flex flex-row lg:flex-col items-center lg:items-start justify-between bg-white dark:bg-slate-800 p-5 rounded-2xl border-2 border-duo-white-shadow dark:border-slate-700 transition-colors duration-300 gap-5">
                 <div className="flex items-center gap-4 w-full">
                   <div className="w-12 h-12 bg-duo-blue rounded-lg flex items-center justify-center text-white text-2xl flex-shrink-0">🌐</div>
                   <span className="text-xl lg:text-2xl font-black text-slate-800 dark:text-slate-100 truncate">{url}</span>
                 </div>
                 
                 <div className="flex items-center lg:w-full lg:justify-between gap-4 lg:gap-2">
                   <div className="flex items-center gap-1.5">
                      <span className="text-3xl">🔥</span>
                      <span className="text-2xl lg:text-3xl font-black text-orange-500">{Math.floor(xp / 100) + 1}</span>
                   </div>
                   <div className="flex gap-3">
                     <button onClick={toggleMute} className="text-3xl hover:scale-110 transition-transform" title={isMuted ? "Activar sonido" : "Silenciar"}>
                       {isMuted ? '🔇' : '🔊'}
                     </button>
                     <button onClick={() => { toggleTheme(); playThemeToggle(theme === "light"); }} className="text-3xl hover:scale-110 transition-transform" title="Cambiar Tema">
                       {theme === "light" ? '🌙' : '☀️'}
                     </button>
                   </div>
                   {session?.user?.image ? (
                     <img src={session.user.image} alt="Avatar" className="w-12 h-12 rounded-full border-2 border-duo-green-shadow flex-shrink-0" />
                   ) : (
                     <div className="w-12 h-12 bg-duo-green rounded-full flex items-center justify-center border-b-4 border-duo-green-shadow text-white flex-shrink-0 text-xl">👤</div>
                   )}
                 </div>
               </header>
 
               {/* Level & XP Stats */}
               <div className="card-3d bg-white dark:bg-slate-800 p-5">
                 <div className="flex items-center justify-between mb-3">
                   <span className="text-2xl lg:text-3xl font-black text-duo-yellow">NIVEL {Math.floor(xp / 100) + 1}</span>
                   <span className="text-base lg:text-lg font-bold text-slate-500 dark:text-slate-400">{xp % 100} / 100 XP</span>
                 </div>
                 <div className="w-full h-8 bg-gray-100 dark:bg-slate-700 rounded-full border-2 border-slate-200 dark:border-slate-600 overflow-hidden">
                   <div className="h-full bg-duo-yellow transition-all duration-1000" style={{ width: `${xp % 100}%` }}></div>
                 </div>
               </div>
 
               {/* Navigation Menu */}
               <nav className="flex flex-row lg:flex-col gap-3 lg:gap-4 w-full">
                 <Link href="/buscador-de-oro" onClick={playClick} className="flex-1 btn-3d btn-white text-slate-650 dark:text-slate-300 hover:text-duo-yellow text-center py-5 px-6 text-lg lg:text-xl font-black transition-colors">
                   🔍 Fase 1: Búsqueda
                 </Link>
                 {hasGoldKeyword ? (
                   <Link href="/contenido" onClick={playClick} className="flex-1 btn-3d btn-white text-slate-650 dark:text-slate-300 hover:text-blue-500 text-center py-5 px-6 text-lg lg:text-xl font-black transition-colors">
                     ✍️ Fase 2: Contenido
                   </Link>
                 ) : (
                   <div className="flex-1 btn-3d btn-white text-slate-400 bg-gray-50 dark:bg-slate-800 dark:border-slate-700 opacity-70 cursor-not-allowed text-center py-5 px-6 text-lg lg:text-xl font-black flex items-center justify-center gap-1" title="Debes elegir tu palabra de oro primero en la Fase 1">
                     🔒 Fase 2: Contenido
                   </div>
                 )}
                  <Link href="/optimizacion" onClick={playClick}
                    className={`flex-1 btn-3d text-center py-5 px-6 text-lg lg:text-xl font-black transition-colors btn-white text-slate-650 dark:text-slate-300 hover:text-duo-green`}>
                    🛠️ Fase 3: Optimización
                  </Link>
                 {xp >= 500 ? (
                   <Link href="/detective-de-enlaces" onClick={playClick} className="flex-1 btn-3d btn-white text-slate-600 dark:text-slate-300 hover:text-purple-650 text-center py-5 px-6 text-lg lg:text-xl font-black transition-colors">
                     🕵️‍♂️ Fase 4: Indexación
                   </Link>
                 ) : (
                   <div className="flex-1 btn-3d btn-white text-slate-400 bg-gray-50 dark:bg-slate-800 dark:border-slate-700 opacity-70 cursor-not-allowed text-center py-5 px-6 text-lg lg:text-xl font-black flex items-center justify-center gap-1">
                     🔒 Fase 4 (Nivel 6)
                   </div>
                 )}
               </nav>
               <div className="text-center pt-2 lg:hidden">
                 <button onClick={() => { playClick(); signOut(); }} className="text-slate-500 text-xs font-bold hover:text-red-500 transition-colors">
                   CERRAR SESIÓN
                 </button>
               </div>
             </div>

             {/* PANEL CENTRAL (Misiones o Detalle) */}
             <div className="flex-1 w-full max-w-5xl mx-auto flex flex-col gap-8">
               
              {step === 6 && (
                <div className="w-full space-y-6 animate-in fade-in duration-300">
                  <h2 className="text-3xl lg:text-4xl font-black text-slate-800 dark:text-slate-100">Fase 3: Optimización On-Page 🛠️</h2>
                  
                  <div className="space-y-4">
                    {missions.length > 0 ? (
                       <>
                         {/* Pendientes */}
                         {missions.filter(m => !completedIds.has(m.id)).length > 0 ? (
                           missions.filter(m => !completedIds.has(m.id)).map((mission) => {
                             return (
                               <div 
                                  key={mission.id}
                                  onClick={() => { playClick(); openMission(mission); }}
                                  className="card-3d flex flex-col md:flex-row items-start gap-6 p-6 md:p-8 transition-colors group hover:bg-gray-50 dark:hover:bg-slate-750 cursor-pointer mb-4"
                               >
                                 <div className={`w-20 h-20 rounded-2xl flex-shrink-0 flex items-center justify-center border-b-4 text-3xl font-black ${
                                   mission.type === 'H1' ? 'bg-duo-green border-duo-green-shadow text-white' : 
                                   mission.type === 'ALT' ? 'bg-duo-blue border-duo-blue-shadow text-white' : 
                                   'bg-duo-yellow border-duo-yellow-shadow text-white'
                                 }`}>
                                   {mission.icon}
                                 </div>
                                 <div className="flex-1 min-w-0">
                                   {(() => {
                                      const badge = getBadgeInfo(mission.page);
                                      return (
                                        <>
                                          <div className="flex items-center gap-3 flex-wrap mb-1.5">
                                            <h3 className="text-2xl lg:text-3xl font-black transition-colors text-slate-800 dark:text-slate-100 group-hover:text-duo-green">{mission.title}</h3>
                                            <span className={`text-sm lg:text-base font-black px-3 py-1 rounded-md ${badge.color}`}>
                                              {badge.text}
                                            </span>
                                          </div>
                                          <div className="flex items-center gap-3 mb-1.5">
                                            <code className="text-sm lg:text-base font-mono text-slate-500 dark:text-slate-400 truncate max-w-[300px] md:max-w-[450px]">
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
                                     <span>👆 {mission.clicks} clics</span>
                                     <span>👁️ {mission.impressions} impresiones</span>
                                     <span>📊 Pos. {mission.position?.toFixed(1)}</span>
                                   </div>
                                   <div className="mt-4 md:mt-5">
                                     <button className="btn-3d text-lg lg:text-xl py-3 px-6 btn-green w-full md:w-auto font-black">
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
                          <>
                            <p className="text-red-400 font-bold">⚠️ Error al conectar con Search Console</p>
                            <p className="text-sm text-slate-500 font-bold">{missionError}</p>
                            <button onClick={() => { playClick(); signOut(); }} className="btn-3d btn-green text-sm py-3 px-6">
                              🔄 RECONECTAR CON GOOGLE
                            </button>
                          </>
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
                      <div className="text-xs md:text-sm lg:text-base font-bold text-slate-500 dark:text-slate-400">Clics</div>
                    </div>
                    <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 text-center border-2 border-gray-100 dark:border-slate-700 shadow-sm">
                      <div className="text-2xl md:text-3xl lg:text-4xl font-black text-duo-yellow">{selectedMission.impressions}</div>
                      <div className="text-xs md:text-sm lg:text-base font-bold text-slate-500 dark:text-slate-400">Impresiones</div>
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
                     <p className="text-xs md:text-sm text-slate-400 uppercase font-black tracking-wider mb-1">Oportunidades de Clics</p>
                     <p className="text-3xl lg:text-4xl font-black text-duo-blue">{missions.reduce((acc, m) => acc + (m.clicks||0), 0).toLocaleString()}+</p>
                   </div>
                   <div className="bg-slate-900 rounded-xl p-4 border-2 border-slate-700 shadow-inner">
                     <p className="text-xs md:text-sm text-slate-400 uppercase font-black tracking-wider mb-1">Total de Impresiones</p>
                     <p className="text-3xl lg:text-4xl font-black text-duo-yellow">{missions.reduce((acc, m) => acc + (m.impressions||0), 0).toLocaleString()}</p>
                   </div>
                   <div className="bg-slate-900 rounded-xl p-4 border-2 border-slate-700 shadow-inner">
                     <p className="text-xs md:text-sm text-slate-400 uppercase font-black tracking-wider mb-1">XP Total Ganada</p>
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

    </div>
  );
}
