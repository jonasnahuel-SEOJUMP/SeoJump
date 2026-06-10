"use client";

import { useState, useEffect, useRef } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Header from "../components/Header";
import LandingPage from "../components/LandingPage";

import PrivacyModal from '../components/PrivacyModal';
import TermsModal from '../components/TermsModal';
import PaywallModal from "../components/PaywallModal";
import AICatch from "../components/AICatch";
import LoginButton from "../components/LoginButton";
import NotificationBell from "../components/NotificationBell";
import { getRealMissions, verifyMission, getQuickWins, verifyQuickWin, markMissionComplete, fetchCompletedMissions, checkIsAdmin, getPageLivePreview } from "../lib/actions";
import PlatformSelector from "../components/PlatformSelector";
import MissionEditorGuide from "../components/MissionEditorGuide";
import { loadLocalCompletedIds, idsFromSupabaseMissions, filterPendingMissions, isMissionCompleted, isPageAlreadyWorked } from "../lib/missionMemory";
import { useAudio } from "../hooks/useAudio";
import { useTheme } from "../hooks/useTheme";
import { getPhaseProgress, syncStateWithServer, pullStateFromServer } from "../lib/progression";
import { getMissionDisplayPlain, getPlainMissionLabels, getOwlExplanation, getStoredPlatform, getCurrentValueFromPreview } from "../lib/cmsGuide";
import { textsMatchLoosely } from "../lib/textUtils";
import { useSubscription } from "../hooks/useSubscription";

const getBadgeInfo = (url) => {
  const staticResponse = { text: "Página Estática", color: "bg-slate-500/20 text-slate-200 border border-slate-400/30", wpPath: "🗺️ Ruta en WP: Páginas" };
  const homeResponse = { text: "Página de Inicio", color: "bg-emerald-500/20 text-emerald-200 border border-emerald-400/30", wpPath: "🗺️ Ruta en WP: Páginas" };
  const categoryResponse = { text: "Categoría de Tienda", color: "bg-purple-500/20 text-purple-200 border border-purple-400/30", wpPath: "🗺️ Ruta en WP: Productos > Categorías" };
  const productResponse = { text: "Producto", color: "bg-blue-500/20 text-sky-200 border border-blue-400/30", wpPath: "🗺️ Ruta en WP: Productos > Todos los productos" };

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

// Componente destacado de Oportunidades AEO (El Gancho)
function QuickWinsHighlight({ quickWins, completedQuickWins, playClick, router }) {
  const pendingWinsCount = quickWins && quickWins.length > 0 
    ? quickWins.filter(qw => !completedQuickWins.has(qw.page)).length 
    : "Múltiples";

  // Si pasamos el array real y resulta que todo está completado, ahí sí lo ocultamos.
  if (quickWins && quickWins.length > 0 && quickWins.filter(qw => !completedQuickWins.has(qw.page)).length === 0) {
    return null;
  }

  return (
    <div className="w-full mb-8 relative rounded-3xl border-2 border-purple-500/50 bg-gradient-to-r from-violet-950/90 via-purple-900/85 to-indigo-950/90 p-6 md:p-8 shadow-[0_0_50px_rgba(139,92,246,0.4)] hover:scale-[1.01] transition-transform duration-300">
      <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-purple-500/10 via-transparent to-cyan-500/10 opacity-60"></div>
      <div className="relative z-10 flex flex-col gap-5">

        {/* Texto */}
        <div className="text-left space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 bg-purple-500/30 border border-purple-400/50 rounded-full text-purple-200 text-xs font-black uppercase tracking-wider">🤖 AEO</span>
            <span className="text-purple-300 text-xs font-bold">Answer Engine Optimization</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-black text-white">
            ⚡ {pendingWinsCount} Oportunidades AEO detectadas
          </h2>
          <p className="text-slate-200 text-sm md:text-base font-semibold leading-relaxed">
            Páginas con potencial para ser citadas por <span className="text-purple-300 font-bold">ChatGPT, Gemini</span> y las respuestas con IA de Google.
          </p>
        </div>

        {/* Botón siempre debajo */}
        <button
          onClick={() => { playClick(); router.push("/optimizacion"); }}
          className="btn-3d btn-yellow w-full !text-sm md:!text-base font-black px-6 py-3.5"
        >
          VER OPORTUNIDADES AEO
        </button>

      </div>
    </div>
  );
}


export default function Home() {
  const { data: session, status } = useSession();
  const { isMuted, toggleMute, playClick, playThemeToggle, playSuccess, playLevelUp } = useAudio();
  const { theme, toggleTheme } = useTheme();

  // ── God Mode: estado reactivo cargado desde server action ──────────────────
  // checkIsAdmin() lee ALLOWED_EMAILS en el servidor en tiempo de request,
  // sin depender de NEXT_PUBLIC_ vars que requieren rebuild para activarse.
  const [isAdmin, setIsAdmin] = useState(false);

  const [step, setStep] = useState(1);
  const [url, setUrl] = useState("");
  const [goal, setGoal] = useState("");
  const [scanProgress, setScanProgress] = useState(0);
  const [scanMessage, setScanMessage] = useState("Iniciando análisis...");
  const [missions, setMissions] = useState([]);
  const [missionError, setMissionError] = useState(null);
  const [selectedMission, setSelectedMission] = useState(null);
  const [showPaywallModal, setShowPaywallModal] = useState(false);
  const { hasPremiumAccess } = useSubscription();

  useEffect(() => {
    localStorage.removeItem("isPremium");
    setCmsPlatform(getStoredPlatform());
    const savedGoal = localStorage.getItem("seojump_goal");
    if (savedGoal) setGoal(savedGoal);
  }, []);
  
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
  const [skipIntroRemember, setSkipIntroRemember] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [cmsPlatform, setCmsPlatform] = useState("wp_woo");
  const [pagePreview, setPagePreview] = useState(null);
  const [pagePreviewLoading, setPagePreviewLoading] = useState(false);
  const [missionsLoading, setMissionsLoading] = useState(false);
  const missionsAutoFetchDone = useRef(false);

  const filterHomeMissions = (list) =>
    (list || []).filter(m => m.pagePath !== '/' && m.pagePath !== '');

  const loadMissionsFromServer = async (siteUrl, keyword) => {
    if (!siteUrl || !session) return;
    setMissionsLoading(true);
    setMissionError(null);
    try {
      const res = await getRealMissions(siteUrl, keyword || undefined, goal || undefined);
      if (!res.success) throw new Error(res.error || "Error al cargar misiones");
      const pending = filterPendingMissions(filterHomeMissions(res.data || []), loadLocalCompletedIds());
      setMissions(pending);
      if (pending.length > 0) {
        localStorage.setItem("seojump_missions", JSON.stringify(pending));
        localStorage.setItem("seojump_site_url", siteUrl);
      } else {
        localStorage.removeItem("seojump_missions");
      }
    } catch (err) {
      const msg = err?.message || "Error al obtener misiones";
      if (msg === "MISSING_SEARCH_CONSOLE_SCOPE") {
        setMissionError("MISSING_SEARCH_CONSOLE_SCOPE");
      } else {
        setMissionError(msg);
      }
      setMissions([]);
    } finally {
      setMissionsLoading(false);
    }
  };

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

  // Guard: only run the heavy init ONCE per mount (prevents re-fetching on tab focus).
  // Without this, if NextAuth refreshes the session object reference on focus,
  // the [session] dependency would trigger a full re-fetch from Supabase.
  const hasInitialized = useRef(false);

  // Pull state from server on mount if logged in, otherwise load from local storage
  useEffect(() => {
    if (status === 'loading') return;  // wait for session to resolve
    if (hasInitialized.current) return; // already ran — don't re-run on focus
    hasInitialized.current = true;
    const init = async () => {
      // Resolver estado de administrador antes de calcular fases
      // checkIsAdmin() lee ALLOWED_EMAILS en el servidor sin necesitar rebuild
      const adminResult = await checkIsAdmin().catch(() => false);
      setIsAdmin(adminResult);

      setServerLoading(true);

      // Cargar Quick Wins y sus completados desde caché local antes de sincronizar
      const savedQuickWins = localStorage.getItem("seojump_quick_wins");
      if (savedQuickWins) {
        try { setQuickWins(JSON.parse(savedQuickWins)); } catch (e) {}
      }
      const savedCompletedQuickWins = localStorage.getItem("seojump_completed_quick_wins");
      if (savedCompletedQuickWins) {
        try { setCompletedQuickWins(new Set(JSON.parse(savedCompletedQuickWins))); } catch (e) {}
      }

      if (session) {
        // Cargar progreso local de inmediato (no esperar a Supabase)
        const localCompleted = loadLocalCompletedIds();
        setCompletedIds(localCompleted);

        // Combinar con Supabase cuando responda
        fetchCompletedMissions().then(cwResult => {
          if (cwResult.success && cwResult.missions) {
            const {
              completedIds: fromSupabase,
              completedQuickWins: newCompletedQuickWins,
              completedAeo: newCompletedAeo,
              totalXp,
            } = idsFromSupabaseMissions(cwResult.missions);

            const mergedCompleted = new Set([...localCompleted, ...fromSupabase]);
            const localXp = parseInt(localStorage.getItem("seojump_xp") || "0", 10);
            setXp(Math.max(totalXp, localXp));

            setCompletedIds(() => {
              localStorage.setItem("seojump_completed_missions", JSON.stringify(Array.from(mergedCompleted)));
              return mergedCompleted;
            });

            setCompletedQuickWins(prev => {
              const merged = new Set([...prev, ...newCompletedQuickWins]);
              localStorage.setItem("seojump_completed_quick_wins", JSON.stringify(Array.from(merged)));
              return merged;
            });

            // Fallback load from local storage for other state
            const savedUrl = (localStorage.getItem("seojump_site_url") || "").toLowerCase().trim();
            if (savedUrl) setUrl(savedUrl);

            const activeKeyword = localStorage.getItem("gold-tu-busqueda");
            setHasGoldKeyword(!!activeKeyword);

            const prestige = parseInt(localStorage.getItem("seojump_prestigio_cycles") || "0", 10);
            setPrestigeCycles(prestige);

            let missionsList = [];
            const savedMissions = localStorage.getItem("seojump_missions");
            if (savedMissions) {
              try {
                const parsed = JSON.parse(savedMissions);
                if (Array.isArray(parsed) && parsed.length > 0) {
                  missionsList = filterPendingMissions(filterHomeMissions(parsed), mergedCompleted);
                  setMissions(missionsList);
                  if (savedUrl && missionsList.length > 0) setStep(6);
                }
              } catch (e) {}
            }

            let suggestionsList = [];
            const savedSuggestions = localStorage.getItem("gold-suggestions");
            if (savedSuggestions) {
              try { suggestionsList = JSON.parse(savedSuggestions); } catch (e) {}
            }

            const p = getPhaseProgress(
              mergedCompleted,
              suggestionsList,
              missionsList,
              activeKeyword,
              savedUrl,
              isAdmin
            );
            setProg(p);

            if (savedUrl && missionsList.length > 0) {
              setStep(6);
            } else {
              setShowIntroModal(true);
            }
          }
          setServerLoading(false);
        }).catch(() => {
          // Si Supabase falla, conservar lo que ya cargamos desde localStorage
          setServerLoading(false);
        });

        return;
      }

      const savedXp = localStorage.getItem("seojump_xp");
      if (savedXp) setXp(parseInt(savedXp, 10));

      const savedUrl = (localStorage.getItem("seojump_site_url") || "").toLowerCase().trim();
      if (savedUrl) setUrl(savedUrl);

      const activeKeyword = localStorage.getItem("gold-tu-busqueda");
      setHasGoldKeyword(!!activeKeyword);

      const prestige = parseInt(localStorage.getItem("seojump_prestigio_cycles") || "0", 10);
      setPrestigeCycles(prestige);

      const completedSet = loadLocalCompletedIds();
      setCompletedIds(completedSet);

      const savedMissions = localStorage.getItem("seojump_missions");
      let missionsList = [];
      if (savedMissions) {
        try {
          const parsed = JSON.parse(savedMissions);
          if (Array.isArray(parsed) && parsed.length > 0) {
            missionsList = filterPendingMissions(filterHomeMissions(parsed), completedSet);
            setMissions(missionsList);
            if (savedUrl && missionsList.length > 0) {
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



      const p = getPhaseProgress(completedSet, suggestions, missionsList, activeKeyword, savedUrl, isAdmin);
      setProg(p);
      setServerLoading(false);
    };
    init();
  }, [session, status]);

  // Recalculate progress when state updates
  useEffect(() => {
    let suggestionsList = [];
    try {
      suggestionsList = JSON.parse(localStorage.getItem("gold-suggestions") || "[]");
    } catch (e) {}
    const p = getPhaseProgress(completedIds, suggestionsList, missions, localStorage.getItem("gold-tu-busqueda"), url, isAdmin);
    setProg(p);
  }, [completedIds, missions, url, isAdmin]);

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
    if (step >= 6 && url && quickWins.length === 0 && !quickWinsLoading && !quickWinsError) {
      const saved = localStorage.getItem("seojump_quick_wins");
      const savedUrl = localStorage.getItem("seojump_quick_wins_url");
      if (saved && savedUrl === url) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setQuickWins(parsed);
            return;
          }
        } catch (e) {}
      }
      setQuickWinsLoading(true);
      const activeKeyword = localStorage.getItem("gold-tu-busqueda") || undefined;
      getQuickWins(url, activeKeyword)
        .then((res) => {
          if (res.success && res.quickWins) {
            setQuickWins(res.quickWins);
            localStorage.setItem("seojump_quick_wins", JSON.stringify(res.quickWins));
            localStorage.setItem("seojump_quick_wins_url", url);
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
  }, [step, url, quickWins.length, quickWinsLoading, quickWinsError]);

  useEffect(() => {
    missionsAutoFetchDone.current = false;
  }, [url]);

  // Si llegás al tablero sin misiones en caché, recargar una vez desde Search Console
  useEffect(() => {
    if (step !== 6 || !session || !url || missions.length > 0 || missionsLoading || missionsAutoFetchDone.current) return;
    missionsAutoFetchDone.current = true;
    const kw = typeof window !== 'undefined' ? localStorage.getItem("gold-tu-busqueda") : null;
    loadMissionsFromServer(url, kw);
  }, [step, session, url, missions.length, missionsLoading]);

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
          
          getQuickWins(url, goldKeyword).then(qwRes => {
            if (qwRes.success && qwRes.quickWins) {
              setQuickWins(qwRes.quickWins);
              localStorage.setItem("seojump_quick_wins", JSON.stringify(qwRes.quickWins));
              localStorage.setItem("seojump_quick_wins_url", url);
            }
          }).catch(err => console.error("Fallo al precargar quick wins:", err));

          getRealMissions(url, goldKeyword, goal || undefined).then(res => {
            if (!res.success) {
              throw new Error(res.error);
            }
            const realMissions = filterPendingMissions(res.data, loadLocalCompletedIds());
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
        if (!isMissionCompleted(completedIds, selectedMission)) {
          // Use functional updater to avoid stale closure XP value
          setXp(prev => {
            const newXp = prev + (selectedMission.xp || 50);
            localStorage.setItem("seojump_xp", newXp.toString());
            return newXp;
          });
          // Show XP popup toast (same as optimizacion page)
          setXpPopup({ amount: selectedMission.xp || 50, message: "¡Crecimiento detectado!" });
          setTimeout(() => setXpPopup(null), 4000);
          setCompletedIds(prev => {
            const updated = new Set([...prev, selectedMission.id]);
            localStorage.setItem("seojump_completed_missions", JSON.stringify(Array.from(updated)));
            setTimeout(() => syncStateWithServer(), 100);
            return updated;
          });
          // Persistir en Supabase — log si falla para diagnóstico
          markMissionComplete(
            selectedMission.type,
            selectedMission.page,
            selectedMission.xp || 50,
            h1Value.trim() || undefined
          ).then(r => {
            if (!r.success) console.warn('[markMissionComplete] Supabase save failed for', selectedMission.id);
          }).catch(err => console.warn('[markMissionComplete] Error:', err));
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
          setTimeout(() => syncStateWithServer(), 100);
          // Guardar en Supabase para memoria cross-device
          markMissionComplete('QUICK_WIN', pageUrl, 100, suggestedTitle).catch(() => {});
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
    setPagePreview(null);
    setPagePreviewLoading(true);
    setStep(7);
    if (mission.page) {
      getPageLivePreview(mission.page)
        .then((res) => {
          if (res.success) {
            setPagePreview(res.preview);
            const suggested = getMissionDisplayPlain(mission, mission.keyword || (typeof window !== 'undefined' ? localStorage.getItem("gold-tu-busqueda") : '') || '', url).suggestedText;
            const current = getCurrentValueFromPreview(mission.type, res.preview);
            if (current && textsMatchLoosely(current, suggested)) {
              setH1Value(suggested);
            }
          }
        })
        .finally(() => setPagePreviewLoading(false));
    } else {
      setPagePreviewLoading(false);
    }
  };

   const clearAnalysisCache = () => {
    localStorage.removeItem("seojump_quick_wins");
    localStorage.removeItem("seojump_missions");
    localStorage.removeItem("gold-suggestions");
    localStorage.removeItem("seojump_completed_quick_wins");
    localStorage.removeItem("seojump_completed_missions");
    
    setQuickWins([]);
    setMissions([]);
    setCompletedIds(new Set());
    setCompletedQuickWins(new Set());
  };

  const nextStep = () => setStep(step + 1);
  const prevStep = () => setStep(step - 1);

  const INTRO_SEEN_KEY = 'seojump_intro_seen';

  const finishIntro = () => {
    playClick();
    if (skipIntroRemember && typeof window !== 'undefined') {
      localStorage.setItem(INTRO_SEEN_KEY, '1');
    }
    setShowIntroModal(false);
    nextStep();
  };

  const handleAnalyze = () => {
    clearAnalysisCache();
    if (!session) {
      signIn("google");
    } else {
      nextStep();
    }
  };

  // Re-escanear: actualiza misiones sin perder el progreso (XP, misiones completadas)
  const handleReScan = () => {
    localStorage.removeItem("seojump_quick_wins");
    localStorage.removeItem("seojump_missions");
    setQuickWins([]);
    setMissions([]);
    setMissionError(null);
    setStep(4); // Salta directo al escaneo, manteniendo URL y keyword ya guardadas
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

  // Compute current phase info for dynamic title
  const currentPhaseInfo = (() => {
    if (prog?.p4?.unlocked) return { title: "Fase 4: Detective", emoji: "🕵️‍♂️" };
    if (prog?.p3?.unlocked) return { title: "Fase 3: Optimización On-Page", emoji: "🛠️" };
    if (prog?.p2?.unlocked) return { title: "Fase 2: Contenido", emoji: "✍️" };
    return { title: "Fase 1: Búsqueda", emoji: "🔍" };
  })();

  if (step === 1 && !showIntroModal) {
    return (
      <div className="min-h-screen bg-[#07070d] w-full font-fredoka relative transition-colors duration-300">
        <LandingPage 
          onStart={() => { 
            playClick(); 
            if (!session) {
              signIn("google");
            } else if (typeof window !== 'undefined' && localStorage.getItem(INTRO_SEEN_KEY) === '1') {
              setStep(2);
            } else {
              setShowIntroModal(true);
            }
          }} 
          playClick={playClick} 
          onShowPrivacy={() => setShowPrivacyModal(true)}
          onShowTerms={() => setShowTermsModal(true)}
        />
        {showPrivacyModal && <PrivacyModal onClose={() => setShowPrivacyModal(false)} playClick={playClick} />}
        {showTermsModal && <TermsModal onClose={() => setShowTermsModal(false)} playClick={playClick} />}
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-transparent flex flex-col items-center ${step < 6 ? 'justify-center' : 'justify-start'} px-4 py-8 md:p-8 w-full font-fredoka relative transition-colors duration-300 text-slate-100 ${step < 6 ? 'max-w-lg md:max-w-3xl lg:max-w-4xl mx-auto border-x dark:border-slate-800 shadow-2xl' : ''}`}>
      
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



        {step === 1 && showIntroModal && (
          <div className="w-full max-w-lg mx-auto text-center space-y-6 animate-in zoom-in duration-500">
            <div className="flex justify-center">
              <img src="/images/logo-owl.png" alt="SEO Jump" className="w-24 h-24 object-contain drop-shadow-2xl" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
                {session?.user?.name
                  ? `¡Hola, ${session.user.name.split(' ')[0]}!`
                  : '¡Bienvenido a SEO Jump!'}
              </h2>
              <p className="text-base md:text-lg font-bold text-slate-300 leading-snug px-2">
                Cada misión que completes acá tiene{' '}
                <span className="text-cyan-400 font-black">impacto real en tu negocio</span>:
                más visibilidad cuando tus clientes buscan lo que vendés.
              </p>
            </div>

            <div className="bg-slate-900 text-white p-5 md:p-6 rounded-3xl border-2 border-slate-700 shadow-xl text-left space-y-4">
              <p className="text-xs font-black text-duo-green uppercase tracking-wider text-center">
                Cómo funciona en 3 pasos
              </p>

              <div className="flex gap-3 items-start">
                <span className="flex-shrink-0 w-9 h-9 rounded-full bg-duo-blue/20 border border-duo-blue/40 text-duo-blue font-black text-sm flex items-center justify-center">1</span>
                <div>
                  <p className="font-black text-white text-base">🔗 Conectá Google y tu sitio</p>
                  <p className="text-sm font-bold text-slate-400 mt-0.5 leading-snug">
                    Leemos tus datos de Search Console para ver qué buscan tus clientes hoy.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 items-start">
                <span className="flex-shrink-0 w-9 h-9 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-300 font-black text-sm flex items-center justify-center">2</span>
                <div>
                  <p className="font-black text-white text-base">✨ Recibí misiones con IA</p>
                  <p className="text-sm font-bold text-slate-400 mt-0.5 leading-snug">
                    Te damos tareas concretas y sugerencias generadas con IA, listas para copiar.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 items-start">
                <span className="flex-shrink-0 w-9 h-9 rounded-full bg-duo-green/20 border border-duo-green/40 text-duo-green font-black text-sm flex items-center justify-center">3</span>
                <div>
                  <p className="font-black text-white text-base">📈 Aplicá los cambios en tu web</p>
                  <p className="text-sm font-bold text-slate-400 mt-0.5 leading-snug">
                    Vos editás título, meta o contenido; SEO Jump te guía y sumás XP por cada avance.
                  </p>
                </div>
              </div>
            </div>

            <label className="flex items-center justify-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={skipIntroRemember}
                onChange={(e) => setSkipIntroRemember(e.target.checked)}
                className="w-4 h-4 rounded border-slate-600 accent-duo-green"
              />
              <span className="text-sm font-bold text-slate-400">No volver a mostrar</span>
            </label>

            <button
              onClick={finishIntro}
              className="btn-3d btn-green text-lg w-full py-3.5"
            >
              Empezar con mi sitio →
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="w-full max-w-md mx-auto px-4 flex flex-col items-center justify-center text-center space-y-6 animate-in slide-in-from-right duration-300">
            {/* Colorful Tabs Preview */}
            <nav className="flex gap-2 w-full opacity-90 pointer-events-none mb-6">
              <div className="flex-1 min-w-[65px] btn-3d btn-yellow text-center py-1.5 px-1 text-xs md:text-sm font-black">
                🔍 F1
              </div>
              <div className="flex-1 min-w-[65px] btn-3d btn-blue text-center py-1.5 px-1 text-xs md:text-sm font-black">
                ✍️ F2
              </div>
              <div className="flex-1 min-w-[65px] btn-3d btn-green text-center py-1.5 px-1 text-xs md:text-sm font-black">
                🛠️ F3
              </div>
              <div className="flex-1 min-w-[65px] btn-3d btn-purple text-center py-1.5 px-1 text-xs md:text-sm font-black">
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
                 onChange={(e) => setUrl(e.target.value.toLowerCase().trim())}
                 autoCapitalize="none"
                 autoCorrect="off"
                 spellCheck="false"
                 inputMode="url"
                 className="w-full p-3 md:p-4 text-lg md:text-xl border-2 border-slate-200 rounded-xl focus:border-duo-blue outline-none transition-colors font-black text-slate-750 placeholder-slate-400 dark:bg-slate-800 dark:border-slate-700"
               />
             </div>
             <div className="flex flex-col gap-4 w-full max-w-md mx-auto">
                <button 
                  onClick={() => { 
                    playClick(); 
                    clearAnalysisCache();
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
                   <div className="flex flex-col items-center gap-2 text-center">
                     <span className="text-duo-green font-bold">✅ Sesión iniciada: {session.user?.name}</span>
                     <button
                       onClick={() => {
                         playClick();
                         // Limpiar el estado local para que el próximo usuario empiece limpio
                         try {
                           localStorage.removeItem("seojump_site_url");
                           localStorage.removeItem("seojump_missions");
                           localStorage.removeItem("seojump_quick_wins");
                           localStorage.removeItem("seojump_quick_wins_url");
                         } catch (e) {}
                         signOut({ callbackUrl: "/" });
                       }}
                       className="text-xs font-bold text-slate-400 hover:text-red-400 transition-colors underline underline-offset-2"
                     >
                       Cambiar cuenta / Cerrar sesión
                     </button>
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
                  onClick={() => { playClick(); setGoal(option.id); try { localStorage.setItem("seojump_goal", option.id); } catch (e) {} }}
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
                     setStep(6);
                   }
                 }} 
                 className="btn-3d btn-green text-lg md:text-xl py-3.5 md:py-4 font-black tracking-wide w-full"
               >
                {session ? "VER MI DASHBOARD" : "CONECTAR PARA CONTINUAR"}
             </button>
          </div>
        )}

        {step >= 6 && (
          <div className="w-full max-w-7xl mx-auto flex flex-wrap lg:flex-nowrap gap-8 animate-in slide-in-from-bottom duration-500 items-start px-4 overflow-x-hidden">
             {/* PANEL IZQUIERDO (Lateral de Control) — oculto en móvil al abrir una misión */}
             <div className={`w-full lg:w-[380px] flex-shrink-0 flex-col gap-6 lg:sticky lg:top-8 z-10 min-w-0 ${step === 7 ? 'hidden lg:flex' : 'flex'}`}>
               {/* Dashboard Header */}
               <header className="w-full flex flex-col gap-6 items-stretch justify-between bg-white dark:bg-slate-800 p-4 md:p-5 rounded-2xl border-2 border-duo-white-shadow dark:border-slate-700 transition-colors duration-300">
                 <div className="flex items-center gap-4 w-full justify-between">
                   <div className="flex items-center gap-4 min-w-0">
                     <div className="w-12 h-12 bg-duo-blue rounded-lg flex items-center justify-center text-white text-2xl flex-shrink-0">🌐</div>
                     <span className="text-xl lg:text-2xl font-black text-slate-800 dark:text-slate-100 truncate min-w-0">{url}</span>
                   </div>
                 </div>
                 
                 <div className="flex items-center justify-between w-full gap-4 border-t border-slate-100 dark:border-slate-700/50 pt-3 flex-wrap">
                   <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className="text-3xl">🔥</span>
                      <span className="text-2xl lg:text-3xl font-black text-orange-500">{Math.floor(xp / 100) + 1}</span>
                   </div>
                   <div className="flex items-center gap-2 md:gap-3 flex-wrap">
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
                     <Link href="/perfil" onClick={playClick} className="hover:scale-105 transition-transform flex-shrink-0 relative" title="Ver Perfil">
                        {session?.user?.image ? (
                          <img src={session.user.image} alt="Avatar" className="w-12 h-12 rounded-full border-2 border-duo-green-shadow flex-shrink-0" />
                        ) : (
                          <div className="w-12 h-12 bg-duo-green rounded-full flex items-center justify-center border-b-4 border-duo-green-shadow text-white flex-shrink-0 text-xl">👤</div>
                        )}
                        {isAdmin && (
                          <span className="absolute -top-1 -right-1 bg-amber-400 text-amber-900 text-[9px] font-black px-1 rounded-full leading-4 shadow-sm" title="God Mode activo — todas las fases desbloqueadas">⚡</span>
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
                 <Link href="/buscador-de-oro" onClick={playClick} className="flex-1 btn-3d phase-idle-yellow text-center !py-2.5 !px-2 md:!py-5 md:!px-6 !text-xs md:!text-lg lg:!text-xl font-black transition-all">
                   <span className="md:hidden">🔍 F1</span><span className="hidden md:inline">🔍 Fase 1: Búsqueda</span>
                 </Link>
                 {prog?.p2?.unlocked ? (
                   <Link href="/contenido" onClick={playClick} className="flex-1 btn-3d phase-idle-blue text-center !py-2.5 !px-2 md:!py-5 md:!px-6 !text-xs md:!text-lg lg:!text-xl font-black transition-all">
                     <span className="md:hidden">✍️ F2</span><span className="hidden md:inline">✍️ Fase 2: Contenido</span>
                   </Link>
                 ) : (
                   <div className="flex-1 btn-3d btn-white phase-locked text-center !py-2.5 !px-2 md:!py-5 md:!px-6 !text-xs md:!text-lg lg:!text-xl font-black flex items-center justify-center gap-1"
                     title="🔒 Completá el 70% de la Fase 1 para avanzar">
                     <span className="md:hidden">🔒 F2</span><span className="hidden md:inline">🔒 Fase 2: Contenido</span>
                   </div>
                 )}
                 {prog?.p3?.unlocked ? (
                   <Link href="/optimizacion" onClick={playClick}
                     className="flex-1 btn-3d phase-idle-green text-center !py-2.5 !px-2 md:!py-5 md:!px-6 !text-xs md:!text-lg lg:!text-xl font-black transition-all">
                     <span className="md:hidden">🛠️ F3</span><span className="hidden md:inline">🛠️ Fase 3: Optimización</span>
                   </Link>
                 ) : (
                   <div className="flex-1 btn-3d btn-white phase-locked text-center !py-2.5 !px-2 md:!py-5 md:!px-6 !text-xs md:!text-lg lg:!text-xl font-black flex items-center justify-center gap-1"
                     title="🔒 Completá el 70% de la Fase 2 para avanzar">
                     <span className="md:hidden">🔒 F3</span><span className="hidden md:inline">🔒 Fase 3: Optimización</span>
                   </div>
                 )}
                 {prog?.p4?.unlocked ? (
                   <Link href="/detective-de-enlaces" onClick={playClick} className="flex-1 btn-3d phase-idle-purple text-center !py-2.5 !px-2 md:!py-5 md:!px-6 !text-xs md:!text-lg lg:!text-xl font-black transition-all">
                     <span className="md:hidden">🕵️‍♂️ F4</span><span className="hidden md:inline">🕵️‍♂️ Fase 4: Detective</span>
                   </Link>
                 ) : (
                   <div className="flex-1 btn-3d btn-white phase-locked text-center !py-2.5 !px-2 md:!py-5 md:!px-6 !text-xs md:!text-lg lg:!text-xl font-black flex items-center justify-center gap-1"
                     title="🔒 Completá el 70% de la Fase 3 para avanzar">
                     <span className="md:hidden">🔒 F4</span><span className="hidden md:inline">🔒 Fase 4: Detective</span>
                   </div>
                 )}
                 <Link href="/blog" onClick={playClick} className="flex-1 btn-3d phase-idle-cyan text-center !py-2.5 !px-2 md:!py-5 md:!px-6 !text-xs md:!text-lg lg:!text-xl font-black transition-all">
                   <span className="md:hidden">📖 Academia</span><span className="hidden md:inline">📖 Academia SEO</span>
                 </Link>
               </nav>
              </div>

              {/* PANEL CENTRAL (Misiones o Detalle) */}
              <div className="w-full lg:flex-1 min-w-0 max-w-5xl mx-auto flex flex-col gap-8">
                
                {step === 6 && (
                  <div className="w-full space-y-6 animate-in fade-in duration-300">
                    <h2 className="text-3xl lg:text-4xl font-black text-slate-800 dark:text-slate-100">Tus Misiones SEO 🎯</h2>
                    <p className="text-base lg:text-lg font-bold text-slate-500 dark:text-slate-400 flex items-center gap-2">{currentPhaseInfo.emoji} Progreso actual: {currentPhaseInfo.title}</p>

                    {/* --- QUICK WINS HIGHLIGHT (EL GANCHO) --- */}
                    <QuickWinsHighlight 
                      quickWins={quickWins} 
                      completedQuickWins={completedQuickWins} 
                      playClick={playClick} 
                      router={router} 
                    />

                    {/* --- BANNER EDUCATIVO + UPSELL A SEARCH CONSOLE (solo sin GSC) --- */}
                    {missions.length > 0 && missions.some((m) => m.source === 'web') && (
                      <div className="card-3d p-5 md:p-6 border-2 border-amber-500/40 bg-gradient-to-br from-amber-950/30 to-slate-900/60 space-y-4">
                        <div className="flex items-start gap-3">
                          <span className="text-3xl flex-shrink-0">🚀</span>
                          <div className="space-y-1">
                            <h3 className="text-lg md:text-xl font-black text-amber-200">
                              Estas misiones las armamos mirando tu web
                            </h3>
                            <p className="text-sm font-bold text-slate-300 leading-relaxed">
                              Ya podés empezar a mejorar tu sitio ahora mismo. Y cuando conectes <span className="text-amber-200">Google Search Console</span> (es gratis y te guiamos), tus misiones van a usar <span className="text-amber-200">datos reales de Google</span>: por qué búsquedas ya aparecés, cuáles están a un paso de la primera página y dónde estás dejando ventas sobre la mesa.
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="rounded-xl bg-slate-900/60 border border-slate-700/60 p-3">
                            <p className="text-xs font-black text-emerald-300 uppercase tracking-wide mb-1">📈 Más ventas</p>
                            <p className="text-xs font-bold text-slate-400 leading-snug">Detectamos las páginas a punto de explotar en Google para que les des el empujón final.</p>
                          </div>
                          <div className="rounded-xl bg-slate-900/60 border border-slate-700/60 p-3">
                            <p className="text-xs font-black text-sky-300 uppercase tracking-wide mb-1">🎯 Datos reales</p>
                            <p className="text-xs font-bold text-slate-400 leading-snug">Dejás de adivinar: ves las búsquedas exactas por las que te encuentran tus clientes.</p>
                          </div>
                          <div className="rounded-xl bg-slate-900/60 border border-slate-700/60 p-3">
                            <p className="text-xs font-black text-purple-300 uppercase tracking-wide mb-1">🤖 Te cita la IA (AEO)</p>
                            <p className="text-xs font-bold text-slate-400 leading-snug">Que ChatGPT y Google IA te recomienden es el nuevo aparecer primero. Y vale cada vez más.</p>
                          </div>
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
                          className="w-full btn-3d bg-green-500 border-green-600 border-b-4 hover:bg-green-450 active:border-b-0 active:translate-y-1 text-white text-sm md:text-base font-black py-3 flex items-center justify-center gap-2"
                        >
                          🔓 Conectar Search Console y desbloquear datos reales
                        </button>
                        <p className="text-[11px] font-bold text-slate-500 text-center">
                          Conexión 100% segura y de solo lectura. Nunca modificamos tu sitio.
                        </p>
                      </div>
                    )}

                    <div className="space-y-4">
                      {missions.length > 0 ? (() => {
                           const pendingMissions = filterPendingMissions(missions, completedIds).slice(0, 10);
                           if (pendingMissions.length === 0) {
                             return (
                               <div className="text-center py-4 bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-200 dark:border-slate-700">
                                 <p className="text-slate-500 font-bold text-lg">¡Todas las misiones completadas! 🎉</p>
                               </div>
                             );
                            }

                           // Show first 2 pending missions to free users (not first 2 of the full
                           // missions array – that old logic broke when the first 2 slots were
                           // already completed, leaving free users with 0 unlocked missions).
                           const unlockedMissions = hasPremiumAccess
                             ? pendingMissions
                             : pendingMissions.slice(0, 2);

                           const lockedCount = pendingMissions.length - unlockedMissions.length;

                           return (
                             <>
                               {unlockedMissions.map((mission) => (
                                 <div 
                                    key={mission.id}
                                    onClick={() => { playClick(); openMission(mission); }}
                                    className="card-3d flex flex-col md:flex-row items-start gap-4 md:gap-6 p-4 md:p-8 transition-colors group hover:bg-gray-50 dark:hover:bg-slate-750 cursor-pointer mb-4 w-full overflow-hidden"
                                 >
                                   <div className={`w-20 h-20 rounded-2xl flex-shrink-0 flex items-center justify-center border-b-4 text-3xl font-black ${
                                     mission.type === 'H1' ? 'bg-duo-green border-duo-green-shadow text-white' : 
                                     mission.type === 'ALT' ? 'bg-duo-blue border-duo-blue-shadow text-white' : 
                                     mission.type === 'AEO' ? 'bg-purple-600 border-purple-800 text-white' :
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
                                              <h3 className="text-xl md:text-2xl lg:text-3xl font-black transition-colors text-slate-800 dark:text-slate-100 group-hover:text-duo-green">{getMissionDisplayPlain(mission, mission.keyword || (typeof window !== 'undefined' ? localStorage.getItem("gold-tu-busqueda") : '') || '', url).title}</h3>
                                              <span className={`text-sm lg:text-base font-black px-3 py-1 rounded-md ${badge.color}`}>
                                                {badge.text}
                                              </span>
                                              {mission.type === 'AEO' && (
                                                <span className="text-xs font-black px-2 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-400">
                                                  🤖 Para la IA
                                                </span>
                                              )}
                                              {mission.source === 'web' && (
                                                <span className="text-xs font-black px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300">
                                                  🌐 Basado en tu web
                                                </span>
                                              )}
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
                                     <p className="font-bold text-slate-650 dark:text-slate-350 text-base lg:text-lg mb-2">{getMissionDisplayPlain(mission, mission.keyword || (typeof window !== 'undefined' ? localStorage.getItem("gold-tu-busqueda") : '') || '', url).description}</p>
                                     {mission.source === 'web' || mission.position == null ? (
                                       <div className="flex flex-wrap gap-2 mt-3 text-xs lg:text-sm font-bold text-amber-300/90">
                                         <span>🔍 Detectado al analizar tu web · conectá Search Console para ver tus ventas y posiciones reales</span>
                                       </div>
                                     ) : (
                                       <div className="flex flex-wrap gap-4 mt-3 text-sm lg:text-base font-bold text-slate-550 dark:text-slate-400">
                                         <span>👆 {mission.clicks} oportunidades de venta</span>
                                         <span>👁️ {mission.impressions} dinero sobre la mesa</span>
                                         <span>📊 Pos. {mission.position?.toFixed(1)}</span>
                                       </div>
                                     )}
                                     <div className="mt-4 w-full">
                                       <button className="btn-3d !text-sm sm:!text-base md:!text-lg lg:!text-xl !py-2.5 !px-4 sm:!py-3 sm:!px-6 btn-green w-full md:w-auto font-black">
                                         EMPEZAR (+{mission.xp} XP)
                                       </button>
                                     </div>
                                   </div>
                                 </div>
                               ))}
                               {!hasPremiumAccess && lockedCount > 0 && (
                                 <div 
                                    onClick={() => { playClick(); setShowPaywallModal(true); }}
                                    className="card-3d relative flex flex-col md:flex-row items-center md:items-start gap-4 md:gap-6 p-4 md:p-8 transition-all group cursor-pointer mb-4 w-full overflow-hidden bg-slate-800/40 dark:bg-slate-900/60 border-dashed border-2 border-slate-300 dark:border-slate-700 hover:border-duo-green/50 dark:hover:border-duo-green/50"
                                 >
                                   <div className="absolute inset-0 backdrop-blur-[2px] bg-white/5 dark:bg-slate-950/10 pointer-events-none rounded-3xl"></div>
                                   <div className="relative z-10 w-16 h-16 md:w-20 md:h-20 rounded-2xl flex-shrink-0 flex items-center justify-center bg-slate-200 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 text-3xl font-black text-slate-400 group-hover:text-duo-green group-hover:bg-green-500/10 transition-colors shadow-inner">
                                     🔒
                                   </div>
                                   <div className="relative z-10 flex-1 min-w-0 w-full text-center md:text-left opacity-70 group-hover:opacity-100 transition-opacity">
                                     <h3 className="text-lg md:text-xl lg:text-2xl font-black text-slate-500 dark:text-slate-400 mb-2 blur-[1px] group-hover:blur-none transition-all">Misiones Ocultas</h3>
                                     <p className="text-sm md:text-base font-bold text-slate-400 dark:text-slate-500 mb-4">Descubrí el resto de las oportunidades de optimización y acelerá tu crecimiento.</p>
                                     <button className="btn-3d !text-sm sm:!text-base !py-2 !px-4 btn-green font-black">
                                       DESBLOQUEAR {lockedCount} MISIONES OCULTAS
                                     </button>
                                   </div>
                                 </div>
                               )}
                             </>
                           );
                         })()
                    : (
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
                        ) : missionsLoading ? (
                          <p className="text-slate-400 font-bold animate-pulse">Buscando misiones en Search Console...</p>
                        ) : (
                          <div className="text-center space-y-4 py-4">
                            <p className="text-slate-500 font-bold">No encontramos misiones para este sitio todavía.</p>
                            <p className="text-sm text-slate-400 font-bold max-w-md mx-auto">
                              Puede pasar si todavía no elegiste palabra clave en el Buscador de Oro, o si Google solo tiene datos de tu página de inicio.
                            </p>
                            {session && url && (
                              <button
                                onClick={() => {
                                  playClick();
                                  const kw = localStorage.getItem("gold-tu-busqueda");
                                  loadMissionsFromServer(url, kw);
                                }}
                                className="btn-3d btn-green text-sm py-3 px-6 font-black"
                              >
                                🔄 BUSCAR MISIONES DE NUEVO
                              </button>
                            )}
                            <Link href="/buscador-de-oro" onClick={playClick} className="block text-sm font-black text-duo-yellow hover:underline">
                              Ir al Buscador de Oro para elegir palabra clave →
                            </Link>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* STEP 7: MISSION MODAL - Dynamic based on selectedMission */}
              {step === 7 && selectedMission && (
                <div className="w-full max-w-full min-w-0 space-y-6 md:space-y-8 animate-in fade-in duration-300">
                  {/* Mission Header */}
                  <div className="flex items-start md:items-center flex-col md:flex-row gap-4 mb-4 min-w-0 w-full">
                    <button onClick={() => { playClick(); setStep(6); }} className="text-5xl text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 hidden md:block">✕</button>
                    <div className="min-w-0 w-full">
                      <h2 className="text-2xl md:text-3xl lg:text-4xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-3">
                        <button onClick={() => { playClick(); setStep(6); }} className="text-2xl text-slate-500 md:hidden flex-shrink-0">←</button>
                        {getPlainMissionLabels(selectedMission.type).shortTitle}
                      </h2>
                      <p className="mission-path text-sm md:text-base lg:text-lg font-bold text-slate-550 dark:text-slate-400 mt-1 break-all" title={selectedMission.page}>
                        {selectedMission.page}
                      </p>
                    </div>
                  </div>

                  <PlatformSelector value={cmsPlatform} onChange={setCmsPlatform} playClick={playClick} />

                  <MissionEditorGuide
                    mission={selectedMission}
                    siteUrl={url || (typeof window !== 'undefined' ? localStorage.getItem("seojump_site_url") : '') || ''}
                    platformId={cmsPlatform}
                    goldKeyword={selectedMission.keyword || (typeof window !== 'undefined' ? localStorage.getItem("gold-tu-busqueda") : '') || ''}
                    pagePreview={pagePreview}
                    previewLoading={pagePreviewLoading}
                    playClick={playClick}
                  />

                  {/* Search Console Data Card */}
                  <div className="grid grid-cols-3 gap-2 md:gap-4 min-w-0 w-full">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl p-2 md:p-4 text-center border-2 border-gray-100 dark:border-slate-700 shadow-sm min-w-0">
                      <div className="text-xl md:text-3xl lg:text-4xl font-black text-duo-blue">{selectedMission.clicks}</div>
                      <div className="text-[10px] md:text-sm lg:text-base font-bold text-slate-555 dark:text-slate-400 leading-tight">Oportunidades de Venta</div>
                    </div>
                    <div className="bg-white dark:bg-slate-800 rounded-2xl p-2 md:p-4 text-center border-2 border-gray-100 dark:border-slate-700 shadow-sm min-w-0">
                      <div className="text-xl md:text-3xl lg:text-4xl font-black text-duo-yellow">{selectedMission.impressions}</div>
                      <div className="text-[10px] md:text-sm lg:text-base font-bold text-slate-555 dark:text-slate-400 leading-tight">Dinero sobre la mesa</div>
                    </div>
                    <div className="bg-white dark:bg-slate-800 rounded-2xl p-2 md:p-4 text-center border-2 border-gray-100 dark:border-slate-700 shadow-sm min-w-0">
                      <div className="text-xl md:text-3xl lg:text-4xl font-black text-duo-green">#{selectedMission.position?.toFixed(0)}</div>
                      <div className="text-[10px] md:text-sm lg:text-base font-bold text-slate-500 dark:text-slate-400 leading-tight">Posición</div>
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
                               <p>{getOwlExplanation(selectedMission.type, selectedMission.keyword || (typeof window !== 'undefined' ? localStorage.getItem("gold-tu-busqueda") : '') || '')}</p>
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
                    
                    <div className={`overflow-hidden transition-all duration-300 ease-in-out text-left mt-2 ${showHelp ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
                      <div className="bg-slate-800 p-6 rounded-2xl border-2 border-slate-700 shadow-inner space-y-4">
                        <h4 className="text-duo-yellow font-black mb-3 text-base lg:text-lg tracking-wide uppercase">Pasos sugeridos:</h4>
                        <ul className="space-y-3">
                          {(selectedMission.pistas?.classic || (Array.isArray(selectedMission.pistas) ? selectedMission.pistas : []))
                            .map((pista, idx) => (
                            <li key={idx} className="text-slate-300 text-base lg:text-lg font-bold flex gap-2">
                              <span className="text-duo-blue flex-shrink-0 min-w-[1.2rem]">{idx + 1}.</span>
                              <span>{pista}</span>
                            </li>
                          ))}
                        </ul>
                        {selectedMission.pistas?.cacheWarning && (
                          <p className="text-sky-400 text-sm font-bold mt-2 border-t border-slate-700 pt-3">
                            ⚡ Recordá vaciar el caché de tu sitio después de guardar los cambios.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Mission Input */}
                  <div className="card-3d bg-white dark:bg-slate-800 space-y-6 p-4 md:p-8 min-w-0 w-full overflow-hidden">
                    <p className="font-bold text-slate-650 dark:text-slate-300 text-base md:text-lg lg:text-xl break-words">
                      {getPlainMissionLabels(selectedMission.type).verifyLabel}
                      {(selectedMission.keyword || (typeof window !== 'undefined' ? localStorage.getItem("gold-tu-busqueda") : '')) && (
                        <> — debe incluir <span className="text-duo-blue font-black">«{selectedMission.keyword || (typeof window !== 'undefined' ? localStorage.getItem("gold-tu-busqueda") : '')}»</span></>
                      )}:
                    </p>

                    <input 
                      type="text"
                      placeholder={getMissionDisplayPlain(selectedMission, selectedMission.keyword || (typeof window !== 'undefined' ? localStorage.getItem("gold-tu-busqueda") : '') || '', url).suggestedText.split('\n').find((l) => l.startsWith('¿Para') || (l.length > 25 && !l.startsWith('['))) || 'Pegá acá el texto que escribiste'}
                      value={h1Value}
                      onChange={(e) => setH1Value(e.target.value)}
                      className="w-full max-w-full p-4 md:p-5 text-base md:text-xl border-2 border-slate-200 dark:border-slate-600 rounded-xl focus:border-duo-green outline-none font-black text-slate-800 dark:text-slate-100 dark:bg-slate-700"
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

                  {missionStatus === "success" ? (
                    <button onClick={() => { playClick(); setStep(6); }} className="btn-3d btn-green w-full text-2xl md:text-3xl py-5 mt-4 font-black">
                      VOLVER AL DASHBOARD
                    </button>
                  ) : (
                    <button onClick={() => { playClick(); setStep(6); }} className="btn-3d btn-white w-full text-lg md:text-xl py-3 mt-4 font-black text-slate-500 hover:text-slate-800 transition-colors uppercase">
                      ✖ Cancelar y volver al Dashboard
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* PANEL DERECHO (Panel de Boxes / Stats) */}
            <div className="hidden lg:flex w-[340px] flex-shrink-0 flex-col gap-6 lg:sticky lg:top-8 z-10">
               <div className="card-3d bg-slate-800 text-white border-slate-700 shadow-xl relative overflow-hidden p-8">
                 <div className="flex justify-center mb-3"><img src="/images/logo-owl.png" alt="SEO Jump" className="w-20 h-20 object-contain animate-bounce" /></div>
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
                   <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-5 rounded-full -mr-16 -mt-16 pointer-events-none"></div>
                 </div>
               </div>

                 <button
                    onClick={() => { playClick(); handleReScan(); }}
                    className="btn-3d btn-white w-full font-black text-duo-green hover:text-green-400 transition-colors text-base md:text-lg py-4 flex items-center justify-center gap-2 mt-6"
                    title="Obtener misiones actualizadas desde Google Search Console"
                 >
                    🔄 NUEVO ANÁLISIS
                 </button>
               
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
      {showPrivacyModal && <PrivacyModal onClose={() => setShowPrivacyModal(false)} playClick={playClick} />}

      {/* Terms Modal */}
      {showTermsModal && <TermsModal onClose={() => setShowTermsModal(false)} playClick={playClick} />}

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
