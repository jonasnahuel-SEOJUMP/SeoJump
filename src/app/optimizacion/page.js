"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession, signIn, signOut } from "next-auth/react";
import Link from "next/link";
import { useAudio } from "../../hooks/useAudio";
import { useTheme } from "../../hooks/useTheme";
import { getRealMissions, verifyMission, getQuickWins, verifyQuickWin, markMissionComplete, fetchCompletedMissions, getAeoOpportunities, verifyAeoMission, checkIsAdmin, getPageLivePreview } from "../../lib/actions";
import UpgradeModal from "../../components/UpgradeModal";
import AiCreditsBadge from "../../components/AiCreditsBadge";
import PlatformSelector from "../../components/PlatformSelector";
import MissionEditorGuide from "../../components/MissionEditorGuide";
import { getStoredPlatform, detectPageType, getMissionDisplayPlain, getPlainMissionLabels, getOwlExplanation, getCurrentValueFromPreview } from "../../lib/cmsGuide";
import { textsMatchLoosely } from "../../lib/textUtils";
import { useSubscription } from "../../hooks/useSubscription";
import { loadLocalCompletedIds, idsFromSupabaseMissions, filterPendingMissions, isMissionCompleted, isPageAlreadyWorked, buildAeoKey, isAeoCompleted } from "../../lib/missionMemory";
import { getPhaseProgress, syncStateWithServer, pullStateFromServer } from "../../lib/progression";
import Header from "../../components/Header";
import PaywallModal from "../../components/PaywallModal";

const CLIENT_FETCH_TIMEOUT_MS = 28000;

/** Evita que la UI quede en "cargando" si la server action no responde (común en móvil/Vercel). */
function callWithTimeout(promise, label = "La solicitud") {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(
        () => reject(new Error(`${label} tardó demasiado. Tocá Reintentar.`)),
        CLIENT_FETCH_TIMEOUT_MS
      );
    }),
  ]);
}

function readQuickWinsCache(siteUrl) {
  try {
    const savedUrl = localStorage.getItem("seojump_quick_wins_url");
    if (savedUrl && siteUrl && savedUrl !== siteUrl) return null;
    const saved = localStorage.getItem("seojump_quick_wins");
    if (!saved) return null;
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function readSkippedQuickWins(siteUrl) {
  try {
    const savedUrl = localStorage.getItem("seojump_skipped_quick_wins_url");
    if (savedUrl && siteUrl && savedUrl !== siteUrl) return [];
    const saved = localStorage.getItem("seojump_skipped_quick_wins");
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normQuickWinPage(url) {
  return String(url || "").replace(/\/$/, "").toLowerCase();
}

function readAeoCache(siteUrl) {
  try {
    const savedUrl = localStorage.getItem("seojump_aeo_opportunities_url");
    if (savedUrl && siteUrl && savedUrl !== siteUrl) return null;
    const saved = localStorage.getItem("seojump_aeo_opportunities");
    if (!saved) return null;
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

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

// ── SmartWpLocation: detecta el tipo de página y muestra la ruta exacta en WordPress
function SmartWpLocation({ pageUrl, playClick }) {
  const [open, setOpen] = React.useState(false);

  if (!pageUrl) return null;

  const url = pageUrl.toLowerCase();

  // Detectar tipo de página según patrones de URL
  const isProduct     = /\/(producto|product|productos|products)\//.test(url);
  const isCategory    = /\/(categoria-producto|product-category|categoria|category)\//.test(url);
  const isBlog        = /\/(blog|entrada|post|articulo|article|news)\//.test(url);
  const isHome        = /^https?:\/\/[^/]+(\/?)(index\.html?)?$/.test(url.trim());

  let icon, label, path, color;
  if (isCategory) {
    icon = '🗂️'; label = 'Categoría de tienda'; color = 'text-purple-300';
    path = <><strong className="text-white">Productos</strong> → <strong className="text-purple-300">Categorías</strong></>;
  } else if (isProduct) {
    icon = '🛍️'; label = 'Producto de WooCommerce'; color = 'text-amber-300';
    path = <><strong className="text-white">Productos</strong> → <strong className="text-amber-300">Todos los productos</strong></>;
  } else if (isBlog) {
    icon = '✍️'; label = 'Entrada de blog'; color = 'text-sky-300';
    path = <><strong className="text-white">Entradas</strong> → <strong className="text-sky-300">Todas las entradas</strong></>;
  } else if (isHome) {
    icon = '🏠'; label = 'Página de inicio'; color = 'text-green-300';
    path = <><strong className="text-white">Páginas</strong> → <strong className="text-green-300">Todas las páginas</strong> → Inicio</>;
  } else {
    icon = '📄'; label = 'Página estática'; color = 'text-slate-300';
    path = <><strong className="text-white">Páginas</strong> → <strong className="text-slate-300">Todas las páginas</strong></>;
  }

  return (
    <div className="mt-2">
      <button
        onClick={(e) => { e.stopPropagation(); if (playClick) playClick(); setOpen(o => !o); }}
        className="text-xs font-black text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors"
      >
        {open ? '▲' : '▼'} ¿Dónde aplico esto en WordPress?
      </button>
      {open && (
        <div className="mt-2 bg-slate-800/80 border border-slate-700 rounded-xl p-3 space-y-3">
          {/* Cartel inteligente de ubicación */}
          <div className="flex items-center gap-2 bg-slate-900/60 rounded-lg px-3 py-2 border border-slate-600">
            <span className="text-lg flex-shrink-0">{icon}</span>
            <div>
              <p className={`text-xs font-black uppercase tracking-wide ${color}`}>{label}</p>
              <p className="text-xs text-slate-300 font-bold mt-0.5">📍 En WordPress: {path}</p>
            </div>
          </div>
          {/* Pasos generales */}
          <ol className="text-xs text-slate-300 space-y-1 list-decimal list-inside">
            <li>Buscá la entrada usando la ruta indicada arriba.</li>
            <li>Abrí el editor y bajá hasta <strong className="text-white">Yoast SEO</strong> o <strong className="text-white">Rank Math</strong>.</li>
            <li>En <strong className="text-amber-300">"Título SEO"</strong> pegá el título sugerido.</li>
            <li>Hacé clic en <strong className="text-white">Actualizar</strong> y esperá 1-2 días.</li>
          </ol>
          {/* Tabs otras plataformas */}
          <details className="mt-1">
            <summary className="text-xs text-slate-500 hover:text-slate-300 cursor-pointer font-bold select-none">¿Usás Shopify o Tiendanube? →</summary>
            <div className="mt-2 space-y-2">
              <div>
                <p className="text-xs font-black text-slate-400 mb-1">Shopify</p>
                <ol className="text-xs text-slate-400 space-y-0.5 list-decimal list-inside">
                  <li>Tienda → Páginas / Productos.</li>
                  <li>Bajá hasta <strong className="text-amber-300">"Edición de SEO"</strong>.</li>
                  <li>Cambiá el Título de la página y guardá.</li>
                </ol>
              </div>
              <div>
                <p className="text-xs font-black text-slate-400 mb-1">Tiendanube</p>
                <ol className="text-xs text-slate-400 space-y-0.5 list-decimal list-inside">
                  <li>Marketing → SEO o abrí el producto.</li>
                  <li>Buscá <strong className="text-amber-300">"Meta título"</strong> o <strong className="text-amber-300">"Título para Google"</strong>.</li>
                  <li>Pegá el título sugerido y guardá.</li>
                </ol>
              </div>
            </div>
          </details>
        </div>
      )}
    </div>
  );
}

// ── QuickWinHelp (legacy — ya no se usa, reemplazado por SmartWpLocation)
function QuickWinHelp({ playClick }) {
  const [open, setOpen] = React.useState(false);
  const [tab, setTab] = React.useState('wordpress');
  const tabs = [
    { id: 'wordpress', label: 'WordPress' },
    { id: 'shopify', label: 'Shopify' },
    { id: 'tiendanube', label: 'Tiendanube' },
  ];
  const content = {
    wordpress: (
      <ol className="text-xs text-slate-300 space-y-2 list-decimal list-inside">
        <li>
          Buscá la página en tu WordPress según su tipo:
          <ul className="mt-1 ml-4 space-y-0.5 list-none">
            <li>📄 <strong className="text-white">Páginas estáticas</strong> → Páginas → Todas las páginas</li>
            <li>🛍️ <strong className="text-amber-300">Producto de tienda</strong> → Productos → Todos los productos</li>
            <li>🗂️ <strong className="text-purple-300">Sección del catálogo</strong> → Productos → Categorías</li>
            <li>✍️ <strong className="text-sky-300">Artículo de blog</strong> → Entradas → Todas las entradas</li>
          </ul>
        </li>
        <li>Abrí el editor y bajá hasta el bloque de <strong className="text-white">Yoast SEO</strong> o <strong className="text-white">Rank Math</strong>.</li>
        <li>En el campo <strong className="text-amber-300">"Título SEO"</strong> pegá el título sugerido.</li>
        <li>Hacé clic en <strong className="text-white">Actualizar</strong> y esperá 1-2 días.</li>
      </ol>
    ),
    shopify: (
      <ol className="text-xs text-slate-300 space-y-1 list-decimal list-inside">
        <li>Andá a <strong className="text-white">Tienda → Páginas / Productos</strong>.</li>
        <li>Abrí la página y bajá hasta <strong className="text-amber-300">"Edición de SEO para motores de búsqueda"</strong>.</li>
        <li>Cambiá el <strong className="text-amber-300">Título de la página</strong>.</li>
        <li>Hacé clic en <strong className="text-white">Guardar</strong>.</li>
      </ol>
    ),
    tiendanube: (
      <ol className="text-xs text-slate-300 space-y-1 list-decimal list-inside">
        <li>Andá a <strong className="text-white">Marketing → SEO</strong> o abrí el producto/página.</li>
        <li>Buscá el campo <strong className="text-amber-300">"Meta título"</strong> o <strong className="text-amber-300">"Título para Google"</strong>.</li>
        <li>Pegá el título sugerido y guardá.</li>
        <li>Esperá 1-3 días para que Google actualice.</li>
      </ol>
    ),
  };
  return (
    <div className="mt-2">
      <button
        onClick={(e) => { e.stopPropagation(); if (playClick) playClick(); setOpen(o => !o); }}
        className="text-xs font-black text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors"
      >
        {open ? '▲' : '▼'} ¿Dónde aplico esto?
      </button>
      {open && (
        <div className="mt-2 bg-slate-800/80 border border-slate-700 rounded-xl p-3 space-y-3">
          <div className="flex gap-2">
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={(e) => { e.stopPropagation(); setTab(t.id); }}
                className={`text-xs font-black px-2.5 py-1 rounded-lg transition-colors ${
                  tab === t.id ? 'bg-amber-500 text-slate-950' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >{t.label}</button>
            ))}
          </div>
          {content[tab]}
        </div>
      )}
    </div>
  );
}

export default function Optimizacion() {
  const { data: session, status } = useSession();
  const { isMuted, toggleMute, playClick, playThemeToggle, playSuccess, playLevelUp } = useAudio();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();

  // ── God Mode: estado reactivo cargado desde server action ──────────────────
  const [isAdmin, setIsAdmin] = useState(false);

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
  const [hasFetchedQuickWins, setHasFetchedQuickWins] = useState(false);
  const [verifyingQuickWinIndex, setVerifyingQuickWinIndex] = useState(null);
  const [verifyQuickWinResult, setVerifyQuickWinResult] = useState({});
  const [completedQuickWins, setCompletedQuickWins] = useState(new Set());
  const [isQuickWinsMock, setIsQuickWinsMock] = useState(false);
  const [xpPopup, setXpPopup] = useState(null);
  const [activeTab, setActiveTab] = useState("quickwins");
  const [showPaywallModal, setShowPaywallModal] = useState(false);
  const [copyToast, setCopyToast] = useState(false);
  const [skippedQuickWins, setSkippedQuickWins] = useState([]);
  const [businessFocus, setBusinessFocus] = useState("");
  const [myBrands, setMyBrands] = useState("");
  const { hasPremiumAccess, credits: aiCredits, loading: creditsLoading, refresh: refreshCredits } = useSubscription();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeMessage, setUpgradeMessage] = useState("");
  const [cmsPlatform, setCmsPlatform] = useState("wp_woo");
  const [pagePreview, setPagePreview] = useState(null);
  const [pagePreviewLoading, setPagePreviewLoading] = useState(false);

  const handleAiLimitResponse = (res) => {
    if (res?.upgrade) {
      setUpgradeMessage(res.error || "");
      setShowUpgradeModal(true);
    }
    refreshCredits();
  };

  // AEO State
  const [aeoOpportunities, setAeoOpportunities] = useState([]);
  const [aeoLoading, setAeoLoading] = useState(false);
  const [aeoError, setAeoError] = useState(null);
  const [hasFetchedAeo, setHasFetchedAeo] = useState(false);
  const [completedAeo, setCompletedAeo] = useState(new Set());
  const [verifyingAeoIndex, setVerifyingAeoIndex] = useState(null);
  const [verifyAeoResult, setVerifyAeoResult] = useState({});
  const [manualAeoUrl, setManualAeoUrl] = useState('');

  useEffect(() => {
    localStorage.removeItem("isPremium");
    const savedFocus = localStorage.getItem("seojump_business_focus");
    if (savedFocus) setBusinessFocus(savedFocus);
    const savedBrands = localStorage.getItem("seojump_brands");
    if (savedBrands) setMyBrands(savedBrands);
    setCmsPlatform(getStoredPlatform());
  }, []);

  useEffect(() => {
    if (businessFocus) {
      localStorage.setItem("seojump_business_focus", businessFocus);
    }
  }, [businessFocus]);

  useEffect(() => {
    try {
      localStorage.setItem("seojump_brands", myBrands);
    } catch (e) {}
  }, [myBrands]);

  useEffect(() => {
    if (siteUrl) {
      setSkippedQuickWins(readSkippedQuickWins(siteUrl));
    }
  }, [siteUrl]);

  // Level-up sound tracking
  const prevXpRef = useRef(0);
  useEffect(() => {
    if (prevXpRef.current > 0 && Math.floor(xp / 100) > Math.floor(prevXpRef.current / 100)) {
      playLevelUp();
    }
    prevXpRef.current = xp;
  }, [xp, playLevelUp]);

  // Guard: only run the heavy init ONCE per mount (prevents re-fetching on tab focus)
  const hasInitialized = useRef(false);
  // Pull state from server on mount if logged in, otherwise load from local storage.
  // The hasInitialized guard prevents this from re-running when NextAuth re-validates
  // the session token on tab focus (which creates a new session object reference).
  useEffect(() => {
    if (status === 'loading') return;          // wait for session to resolve
    if (hasInitialized.current) return;        // already ran — don't re-run on focus
    hasInitialized.current = true;

    const init = async () => {
      // Resolver estado de administrador antes de calcular fases
      const adminResult = await checkIsAdmin().catch(() => false);
      setIsAdmin(adminResult);

      setServerLoading(true);
      if (session) {
        // ✅ FIX amnesia: leer localStorage ANTES de llamar a Supabase
        // Si Supabase falló en el pasado (sin schema), el usuario no pierde su progreso local.
        let localQuickWins = [];
        let localAeo = [];
        const localCompleted = loadLocalCompletedIds();
        try { localQuickWins = JSON.parse(localStorage.getItem('seojump_completed_quick_wins') || '[]'); } catch(e) {}
        try { localAeo = JSON.parse(localStorage.getItem('seojump_completed_aeo') || '[]'); } catch(e) {}

        // Mostrar progreso local de inmediato (no esperar a Supabase)
        setCompletedIds(localCompleted);
        setCompletedAeo(new Set(localAeo));

        // Combinar con Supabase cuando responda
        fetchCompletedMissions().then(cwResult => {

          if (cwResult.success && cwResult.missions) {
            console.log(`[Init] Supabase devolvió ${cwResult.missions.length} misiones completadas.`);
            const {
              completedIds: fromSupabase,
              completedQuickWins: fromSupabaseQw,
              completedAeo: fromSupabaseAeo,
              totalXp,
            } = idsFromSupabaseMissions(cwResult.missions);

            const newCompletedIds = new Set([...localCompleted, ...fromSupabase]);
            const newCompletedQuickWins = new Set([...localQuickWins, ...fromSupabaseQw]);
            const newCompletedAeo = new Set([...localAeo, ...fromSupabaseAeo]);

            const localXp = parseInt(localStorage.getItem('seojump_xp') || '0', 10);
            setXp(Math.max(totalXp, localXp));

            setCompletedIds(() => {
              localStorage.setItem('seojump_completed_missions', JSON.stringify(Array.from(newCompletedIds)));
              return newCompletedIds;
            });

            setCompletedQuickWins(() => {
              localStorage.setItem('seojump_completed_quick_wins', JSON.stringify(Array.from(newCompletedQuickWins)));
              console.log(`[Init] Quick Wins completados (Supabase+local): ${newCompletedQuickWins.size}`, Array.from(newCompletedQuickWins));
              return newCompletedQuickWins;
            });

            setCompletedAeo(() => {
              localStorage.setItem('seojump_completed_aeo', JSON.stringify(Array.from(newCompletedAeo)));
              return newCompletedAeo;
            });

            // Fallback load from local storage for other state
            const savedUrl = localStorage.getItem('seojump_site_url');
            if (savedUrl) setSiteUrl(savedUrl);

            const activeKeyword = localStorage.getItem('gold-tu-busqueda') || '';
            setHasGoldKeyword(!!activeKeyword);
            setGoldKeyword(activeKeyword);

            const prestige = parseInt(localStorage.getItem('seojump_prestigio_cycles') || '0', 10);
            setPrestigeCycles(prestige);

            let missionsList = [];
            const savedMissions = localStorage.getItem('seojump_missions');
            if (savedMissions) {
              try {
                const parsed = JSON.parse(savedMissions);
                if (Array.isArray(parsed) && parsed.length > 0) {
                  missionsList = filterPendingMissions(parsed, newCompletedIds);
                  setMissions(missionsList);
                  setHasMissions(missionsList.length > 0);
                }
              } catch (e) {}
            }

            let suggestionsList = [];
            const savedSuggestions = localStorage.getItem('gold-suggestions');
            if (savedSuggestions) {
              try { suggestionsList = JSON.parse(savedSuggestions); } catch (e) {}
            }

            // Load Quick Wins from local storage
            const savedQuickWins = localStorage.getItem('seojump_quick_wins');
            if (savedQuickWins) {
              try { setQuickWins(JSON.parse(savedQuickWins)); } catch(e) {}
            }

            const p = getPhaseProgress(
              newCompletedIds,
              suggestionsList,
              missionsList,
              activeKeyword,
              savedUrl,
              isAdmin
            );
            setProg(p);
          } else {
            // Supabase faló o no hay sesion: usar solo localStorage
            console.warn('[Init] Supabase no devolvio datos, usando solo localStorage.');
            setCompletedQuickWins(new Set(localQuickWins));
            setCompletedAeo(new Set(localAeo));
            setCompletedIds(new Set(localCompleted));
            const localXp = parseInt(localStorage.getItem('seojump_xp') || '0', 10);
            setXp(localXp);
          }
          setServerLoading(false);
        }).catch(() => {
          // Si Supabase falla completamente, cargar desde localStorage
          setCompletedQuickWins(new Set(localQuickWins));
          setCompletedAeo(new Set(localAeo));
          setCompletedIds(new Set(localCompleted));
          setXp(parseInt(localStorage.getItem('seojump_xp') || '0', 10));
          setServerLoading(false);
        });

        return;
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

      const completedSet = loadLocalCompletedIds();
      setCompletedIds(completedSet);

      const savedMissions = localStorage.getItem("seojump_missions");
      let missionsList = [];
      if (savedMissions) {
        try {
          const parsed = JSON.parse(savedMissions);
          if (Array.isArray(parsed) && parsed.length > 0) {
            missionsList = filterPendingMissions(parsed, completedSet);
            setMissions(missionsList);
            setHasMissions(missionsList.length > 0);
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
      // Load completed AEO from local storage
      const savedCompletedAeo = localStorage.getItem("seojump_completed_aeo");
      if (savedCompletedAeo) {
        try { setCompletedAeo(new Set(JSON.parse(savedCompletedAeo))); } catch(e) {}
      }

      const p = getPhaseProgress(completedSet, suggestions, missionsList, keyword, savedUrl, isAdmin);
      setProg(p);
      setServerLoading(false);
    };
    init();
  }, [session, status]);


  // Re-calculate progression whenever state changes
  useEffect(() => {
    let suggestions = [];
    try {
      suggestions = JSON.parse(localStorage.getItem("gold-suggestions") || "[]");
    } catch (e) {}
    const p = getPhaseProgress(completedIds, suggestions, missions, goldKeyword, siteUrl, isAdmin);
    setProg(p);
  }, [completedIds, missions, goldKeyword, siteUrl, isAdmin]);

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

  const quickWinsFetchRef = useRef(false);

  // Red de seguridad: nunca dejar el spinner colgado más de 30s
  useEffect(() => {
    if (!quickWinsLoading) return;
    const timer = setTimeout(() => {
      setQuickWinsLoading(false);
      setHasFetchedQuickWins(true);
      quickWinsFetchRef.current = false;
      setQuickWinsError("El análisis tardó demasiado. Tocá Reintentar.");
    }, 30000);
    return () => clearTimeout(timer);
  }, [quickWinsLoading]);

  useEffect(() => {
    if (!aeoLoading) return;
    const timer = setTimeout(() => {
      setAeoLoading(false);
      setHasFetchedAeo(true);
      setAeoError("El análisis AEO tardó demasiado. Tocá Reintentar.");
    }, 30000);
    return () => clearTimeout(timer);
  }, [aeoLoading]);

  // Load Quick Wins when siteUrl is available
  const loadQuickWins = (excludeList = skippedQuickWins, { useCache = true } = {}) => {
    if (!siteUrl || quickWinsFetchRef.current) return;

    if (useCache) {
      const cached = readQuickWinsCache(siteUrl);
      if (cached && cached.length > 0) {
        setQuickWins(cached);
        setHasFetchedQuickWins(true);
        return;
      }
    }

    quickWinsFetchRef.current = true;
    setQuickWinsLoading(true);
    setQuickWinsError(null);

    const focus = businessFocus.trim() || undefined;
    callWithTimeout(
      getQuickWins(siteUrl, goldKeyword || undefined, excludeList, focus),
      "El análisis de oportunidades"
    )
      .then(res => {
        if (res.success && Array.isArray(res.quickWins)) {
          setQuickWins(res.quickWins);
          setIsQuickWinsMock(!!res.isMockData);
          if (res.quickWins.length > 0) {
            localStorage.setItem("seojump_quick_wins", JSON.stringify(res.quickWins));
            localStorage.setItem("seojump_quick_wins_url", siteUrl);
          } else if (res.message) {
            setQuickWinsError(res.message);
          }
        } else {
          handleAiLimitResponse(res);
          setQuickWinsError(res.error || "No se pudieron obtener oportunidades rápidas.");
        }
      })
      .catch(err => {
        setQuickWinsError(err?.message || "Error de conexión al cargar oportunidades rápidas.");
      })
      .finally(() => {
        setQuickWinsLoading(false);
        setHasFetchedQuickWins(true);
        quickWinsFetchRef.current = false;
        refreshCredits();
      });
  };

  useEffect(() => {
    if (!siteUrl || quickWinsLoading || hasFetchedQuickWins) return;
    loadQuickWins(skippedQuickWins, { useCache: true });
  }, [siteUrl, quickWinsLoading, hasFetchedQuickWins, goldKeyword]);

  const handleSkipQuickWin = (qw) => {
    playClick();
    const pageKey = normQuickWinPage(qw.page);
    const nextSkipped = skippedQuickWins.includes(pageKey)
      ? skippedQuickWins
      : [...skippedQuickWins, pageKey];
    setSkippedQuickWins(nextSkipped);
    localStorage.setItem("seojump_skipped_quick_wins", JSON.stringify(nextSkipped));
    localStorage.setItem("seojump_skipped_quick_wins_url", siteUrl);
    localStorage.removeItem("seojump_quick_wins");
    localStorage.removeItem("seojump_quick_wins_url");
    setQuickWins([]);
    setHasFetchedQuickWins(false);
    quickWinsFetchRef.current = false;
    setTimeout(() => loadQuickWins(nextSkipped, { useCache: false }), 0);
  };

  const handleRefreshQuickWins = () => {
    playClick();
    localStorage.removeItem("seojump_quick_wins");
    localStorage.removeItem("seojump_quick_wins_url");
    setQuickWins([]);
    setQuickWinsError(null);
    setHasFetchedQuickWins(false);
    quickWinsFetchRef.current = false;
    setTimeout(() => loadQuickWins(skippedQuickWins, { useCache: false }), 0);
  };

  const handleResetSkippedQuickWins = () => {
    playClick();
    setSkippedQuickWins([]);
    localStorage.removeItem("seojump_skipped_quick_wins");
    localStorage.removeItem("seojump_skipped_quick_wins_url");
    localStorage.removeItem("seojump_quick_wins");
    localStorage.removeItem("seojump_quick_wins_url");
    setQuickWins([]);
    setQuickWinsError(null);
    setHasFetchedQuickWins(false);
    quickWinsFetchRef.current = false;
    setTimeout(() => loadQuickWins([], { useCache: false }), 0);
  };

  // Persist completed Quick Wins
  useEffect(() => {
    localStorage.setItem("seojump_completed_quick_wins", JSON.stringify(Array.from(completedQuickWins)));
  }, [completedQuickWins]);

  const aeoFetchRef = useRef(false);

  // Load AEO opportunities when tab is active and siteUrl is available
  useEffect(() => {
    if (activeTab !== "aeo" || !siteUrl || aeoLoading || hasFetchedAeo || aeoFetchRef.current) return;

    const cached = readAeoCache(siteUrl);
    if (cached && cached.length > 0) {
      setAeoOpportunities(cached);
      setHasFetchedAeo(true);
      return;
    }

    aeoFetchRef.current = true;
    setAeoLoading(true);
    setAeoError(null);

    const focus = businessFocus.trim() || undefined;
    callWithTimeout(getAeoOpportunities(siteUrl, goldKeyword || undefined, undefined, focus), "El análisis AEO")
      .then(res => {
        if (res.success && Array.isArray(res.data)) {
          setAeoOpportunities(res.data);
          localStorage.setItem("seojump_aeo_opportunities", JSON.stringify(res.data));
          localStorage.setItem("seojump_aeo_opportunities_url", siteUrl);
        } else {
          handleAiLimitResponse(res);
          setAeoError(res.error || "No se pudieron obtener oportunidades AEO.");
        }
      })
      .catch(err => {
        setAeoError(err?.message || "Error de conexión al cargar oportunidades AEO.");
      })
      .finally(() => {
        setAeoLoading(false);
        setHasFetchedAeo(true);
        aeoFetchRef.current = false;
        refreshCredits();
      });
  }, [activeTab, siteUrl, aeoLoading, hasFetchedAeo, goldKeyword]);

  // Persist completed AEO
  useEffect(() => {
    localStorage.setItem('seojump_completed_aeo', JSON.stringify(Array.from(completedAeo)));
  }, [completedAeo]);

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
    if (mission.page) {
      getPageLivePreview(mission.page)
        .then((res) => {
          if (res.success) {
            setPagePreview(res.preview);
            const suggested = getMissionDisplayPlain(mission, goldKeyword, siteUrl).suggestedText;
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
        if (!isMissionCompleted(completedIds, selectedMission)) {
          // Use functional updater to avoid stale XP closure value
          setXp(prev => {
            const newXp = prev + (selectedMission.xp || 50);
            localStorage.setItem("seojump_xp", newXp.toString());
            return newXp;
          });
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
          // Persistir en Supabase — log si falla para diagnóstico
          markMissionComplete(
            selectedMission.type,        // 'H1' | 'META' | 'ALT'
            selectedMission.page,        // URL de la página objetivo
            selectedMission.xp || 50,
            h1Value.trim() || undefined  // El valor que ingresó el usuario
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

  const handleVerifyAeo = async (index, pageUrl, headingText, optimizedText) => {
    setVerifyingAeoIndex(index);
    setVerifyAeoResult(prev => ({ ...prev, [index]: { success: false, message: '', loading: true } }));
    try {
      const res = await verifyAeoMission(pageUrl, headingText, optimizedText);
      setVerifyAeoResult(prev => ({ ...prev, [index]: { success: res.success, message: res.message, loading: false } }));
      if (res.success) {
        playSuccess();
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 3000);
        const aeoKey = buildAeoKey(pageUrl, headingText);
        if (!isAeoCompleted(completedAeo, pageUrl, headingText)) {
          setXp(prev => { const n = prev + 30; localStorage.setItem('seojump_xp', n.toString()); return n; });
          setCompletedAeo(prev => {
            const next = new Set(prev);
            next.add(aeoKey);
            localStorage.setItem('seojump_completed_aeo', JSON.stringify(Array.from(next)));
            return next;
          });
          setXpPopup({ amount: 30, message: '¡Snack informativo aplicado!' });
          setTimeout(() => setXpPopup(null), 4000);
          setTimeout(() => syncStateWithServer(), 100);
          markMissionComplete('AEO_OPP', pageUrl, 30, headingText).then(r => {
            if (!r.success) console.warn('[AEO] No se guardó en Supabase — ¿aplicaste la migración 002?');
          }).catch(() => {});
        }
      }
    } catch (e) {
      setVerifyAeoResult(prev => ({ ...prev, [index]: { success: false, message: 'Error al verificar.', loading: false } }));
    } finally {
      setVerifyingAeoIndex(null);
    }
  };

  const handleLoadAeo = (customUrl) => {
    setAeoOpportunities([]);
    setAeoError(null);
    setAeoLoading(true);
    setHasFetchedAeo(false);
    aeoFetchRef.current = true;
    localStorage.removeItem("seojump_aeo_opportunities");
    localStorage.removeItem("seojump_aeo_opportunities_url");

    const focus = businessFocus.trim() || undefined;
    callWithTimeout(
      getAeoOpportunities(siteUrl, goldKeyword || undefined, customUrl || undefined, focus),
      "El análisis AEO"
    )
      .then(res => {
        if (res.success && Array.isArray(res.data)) {
          setAeoOpportunities(res.data);
          localStorage.setItem("seojump_aeo_opportunities", JSON.stringify(res.data));
          localStorage.setItem("seojump_aeo_opportunities_url", siteUrl);
        } else {
          setAeoError(res.error || "No se pudieron obtener oportunidades AEO.");
        }
      })
      .catch(err => setAeoError(err?.message || "Error de conexión."))
      .finally(() => {
        setAeoLoading(false);
        setHasFetchedAeo(true);
        aeoFetchRef.current = false;
      });
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

  const pendingMissions = filterPendingMissions(missions, completedIds).slice(0, 10);

  return (
    <div className="flex-1 flex flex-col items-center p-4 md:p-8 w-full max-w-screen-lg mx-auto space-y-8 bg-transparent transition-colors duration-300 text-slate-100 min-h-screen relative font-fredoka px-4">
      <div className="fixed inset-0 pointer-events-none bg-glow-emerald opacity-60 z-[-1]"></div>

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
        activePhase={(isAdmin || prog?.p3?.unlocked) ? 3 : null}
        isAdmin={isAdmin}
      />

      {/* Main Layout: 3 columns on desktop */}
      <div className="w-full flex flex-wrap lg:flex-nowrap gap-8 items-start mt-4 overflow-x-hidden">

        {/* ─── LEFT SIDEBAR ─── — oculto en móvil al abrir una misión */}
        <div className={`w-full lg:w-[300px] flex-shrink-0 flex-col gap-6 lg:sticky lg:top-44 min-w-0 ${selectedMission ? 'hidden lg:flex' : 'flex'}`}>
          {/* Site & Level */}
          <div className="card-3d bg-white dark:bg-slate-800 p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-duo-blue rounded-lg flex items-center justify-center text-white text-xl flex-shrink-0">🌐</div>
              <span className="text-base lg:text-lg font-black text-slate-800 dark:text-slate-100 truncate">{siteUrl || "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xl font-black text-duo-yellow">NIVEL {Math.floor(xp / 100) + 1}</span>
              <span className="text-sm font-bold text-slate-555">{xp} XP totales</span>
            </div>
            <div className="w-full h-6 bg-gray-100 dark:bg-slate-700 rounded-full border-2 border-slate-200 dark:border-slate-600 overflow-hidden">
              <div className="h-full bg-duo-yellow transition-all duration-1000" style={{ width: `${Math.min(xp % 100, 100)}%` }} />
            </div>
          </div>

          {/* Stats Panel */}
          <div className="card-3d bg-slate-800 text-white border-slate-700 shadow-xl relative overflow-hidden p-6">
            <div className="flex justify-center mb-2"><img src="/images/logo-owl.png" alt="SEO Jump" className="w-14 h-14 object-contain animate-bounce" /></div>
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
              <div className="text-center space-y-3 py-4 w-full max-w-xl mx-auto mt-4 relative">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-emerald-500/20 blur-3xl rounded-full pointer-events-none"></div>
                <div className="flex justify-center mb-2"><img src="/images/logo-owl.png" alt="SEO Jump" className="w-16 h-16 md:w-20 md:h-20 object-contain drop-shadow-[0_0_15px_rgba(16,185,129,0.5)]" /></div>
                <h1 className="text-3xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-b from-emerald-300 to-emerald-600 drop-shadow-md">
                  {activeTab === 'quickwins' ? 'Tu Plan de Acción 🚀' : activeTab === 'aeo' ? 'Auditoría AEO 🤖' : 'Fase 3: Optimización On-Page 🛠️'}
                </h1>
                <div className="pt-1">
                  <button
                    onClick={() => { if (playClick) playClick(); router.push('/'); }}
                    className="inline-flex items-center gap-1.5 btn-3d btn-white !py-2 !px-4 text-xs font-black text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors uppercase tracking-wider"
                  >
                    ⬅️ Volver al Dashboard
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
                        ? "bg-gradient-to-r from-yellow-400 to-yellow-500 border-yellow-300 text-slate-950 shadow-[0_0_15px_rgba(250,204,21,0.35)] scale-105"
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
                  <button
                    onClick={() => { playClick(); setActiveTab('aeo'); }}
                    className={`px-5 py-2.5 rounded-full font-black text-xs md:text-sm border-2 transition-all duration-300 flex items-center gap-2 ${
                      activeTab === 'aeo'
                        ? 'bg-gradient-to-r from-purple-500 to-violet-500 border-purple-400 text-white shadow-[0_0_15px_rgba(139,92,246,0.3)] scale-105'
                        : 'bg-slate-800/40 border-slate-700 text-slate-300 hover:border-slate-600 hover:text-white'
                    }`}
                  >
                    🤖 Oportunidades AEO
                  </button>
                </div>
              </div>

              <div className="flex justify-end">
                <AiCreditsBadge credits={aiCredits} loading={creditsLoading} />
              </div>

              {/* QUICK WINS TAB VIEW */}
              {activeTab === "quickwins" ? (
                <div className="space-y-6">
                  <div className="card-3d p-4 md:p-5 space-y-3 border border-slate-600/40">
                    <label className="text-xs font-black text-slate-300 uppercase tracking-wider block">
                      🏪 ¿Qué vendés? (ayuda a la IA a no equivocarse)
                    </label>
                    <input
                      type="text"
                      value={businessFocus}
                      onChange={(e) => setBusinessFocus(e.target.value)}
                      placeholder="Ej: vinilo líquido removible y pintura de retoque — no pintura de taller"
                      className="w-full px-4 py-3 rounded-xl bg-slate-900 border-2 border-slate-700 text-white font-bold text-sm focus:border-duo-blue focus:outline-none"
                    />
                    <p className="text-xs text-slate-500 font-bold">
                      Si una sugerencia no encaja, usá <span className="text-duo-blue">«No me sirve»</span> para buscar otra página.
                    </p>

                    <label className="text-xs font-black text-slate-300 uppercase tracking-wider block pt-2">
                      🏷️ Mis marcas (opcional)
                    </label>
                    <input
                      type="text"
                      value={myBrands}
                      onChange={(e) => setMyBrands(e.target.value)}
                      placeholder="Ej: Black Line, Meguiars, Koch Chemie — las marcas que vendés o distribuís"
                      className="w-full px-4 py-3 rounded-xl bg-slate-900 border-2 border-slate-700 text-white font-bold text-sm focus:border-duo-blue focus:outline-none"
                    />
                    <p className="text-xs text-slate-500 font-bold">
                      Si vendés varias marcas, escribilas separadas por comas. La IA las usará para sugerir títulos más inteligentes (ideal para tiendas multimarca).
                    </p>
                  </div>

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
                      <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        <button
                          onClick={handleRefreshQuickWins}
                          className="btn-3d btn-green inline-block py-3 px-8 text-lg font-black"
                        >
                          BUSCAR OTRAS
                        </button>
                        {skippedQuickWins.length > 0 && (
                          <button
                            onClick={handleResetSkippedQuickWins}
                            className="btn-3d btn-white inline-block py-3 px-8 text-sm font-black text-slate-700"
                          >
                            RESTABLECER DESCARTADAS
                          </button>
                        )}
                      </div>
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
                      
                      {/* ── Pending Quick Wins ── */}
                      {quickWins.filter(qw => !completedQuickWins.has(qw.page) && !isPageAlreadyWorked(completedIds, qw.page)).map((qw, index) => {
                        const isUnlocked = hasPremiumAccess || index < 2;
                        
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
                                  <span className="text-yellow-400 font-black">El Insight:</span> Estás en posición <strong className="text-white font-bold">{qw.position?.toFixed(0)}</strong>. {qw.explanation} Cambiá el título de tu página para captar el clic.
                                </p>

                                {/* Título Sugerido con botón copiar */}
                                <div className="bg-amber-955/30 border border-amber-500/30 rounded-2xl p-4 mt-2 text-left">
                                  <div className="flex items-center justify-between mb-2">
                                    <p className="text-xs font-black text-amber-400 uppercase tracking-wider">🎯 Título Sugerido:</p>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        navigator.clipboard.writeText(qw.suggestedTitle);
                                        if (playClick) playClick();
                                        setCopyToast(true);
                                        setTimeout(() => setCopyToast(false), 7000);
                                      }}
                                      className="text-xs font-black text-amber-300 hover:text-white bg-amber-800/50 hover:bg-amber-700/50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                                    >
                                      📋 COPIAR
                                    </button>
                                  </div>
                                  <p className="text-base font-bold text-amber-200 leading-relaxed">"{qw.suggestedTitle}"</p>
                                </div>

                                {/* Acordeón de ayuda */}
                                <SmartWpLocation pageUrl={qw.page} playClick={playClick} />

                                <p className="text-xs text-slate-300 bg-slate-950/40 p-3 rounded-xl border border-slate-800 leading-normal mt-2">
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
                                <div className="pt-2 flex flex-col sm:flex-row gap-3">
                                  <button
                                    onClick={() => handleVerifyQuickWin(index, qw.page, qw.suggestedTitle)}
                                    disabled={verifyResult.loading}
                                    className="btn-3d btn-yellow text-sm md:text-base font-black px-6 py-3"
                                  >
                                    {verifyResult.loading ? '⏳ VERIFICANDO...' : 'YA LO CAMBIÉ'}
                                  </button>
                                  <button
                                    onClick={() => handleSkipQuickWin(qw)}
                                    disabled={quickWinsLoading}
                                    className="btn-3d bg-slate-700 border-slate-600 border-b-4 hover:bg-slate-600 text-white text-sm font-black px-6 py-3"
                                  >
                                    {quickWinsLoading ? '⏳ BUSCANDO...' : '👎 NO ME SIRVE — BUSCAR OTRA'}
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {/* ── Completed Quick Wins — panel colapsable ── */}
                      {quickWins.filter(qw => completedQuickWins.has(qw.page)).length > 0 && (
                        <details className="card-3d border border-green-500/30 bg-green-950/20 rounded-2xl overflow-hidden">
                          <summary className="p-4 cursor-pointer font-black text-green-400 text-sm flex items-center gap-2 select-none list-none">
                            ✅ {quickWins.filter(qw => completedQuickWins.has(qw.page)).length} misión{quickWins.filter(qw => completedQuickWins.has(qw.page)).length > 1 ? 'es' : ''} completada{quickWins.filter(qw => completedQuickWins.has(qw.page)).length > 1 ? 's' : ''} — <span className="text-green-300 font-bold">Ver historial</span>
                          </summary>
                          <div className="px-4 pb-4 space-y-2">
                            {quickWins.filter(qw => completedQuickWins.has(qw.page)).map((qw, i) => (
                              <div key={i} className="flex items-start gap-3 py-2 border-t border-green-500/20">
                                <span className="text-green-400 text-lg flex-shrink-0">🎉</span>
                                <div className="min-w-0">
                                  <p className="text-green-300 font-black text-sm truncate">{qw.keyword}</p>
                                  <p className="text-slate-400 font-bold text-xs truncate">{qw.page}</p>
                                  <p className="text-slate-500 text-xs mt-0.5">Título aplicado: <span className="text-slate-300">"{qw.suggestedTitle}"</span></p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-12 card-3d">
                      <div className="text-6xl mb-4">🏆</div>
                      <p className="text-slate-400 font-bold text-xl">No detectamos oportunidades en el rango de posiciones 8 a 15 para tu sitio aún. ¡Seguí optimizando!</p>
                    </div>
                  )}
                </div>
              ) : activeTab === 'aeo' ? (
                // AEO OPPORTUNITIES TAB VIEW
                <div className="space-y-6">
                  {/* Manual URL input */}
                  <div className="card-3d p-5 flex flex-col sm:flex-row gap-3 items-end">
                    <div className="flex-1 w-full">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-wider mb-1 block">🔗 Analizar una URL específica (opcional)</label>
                      <input
                        type="url"
                        value={manualAeoUrl}
                        onChange={e => setManualAeoUrl(e.target.value)}
                        placeholder="https://tusitio.com/pagina-a-analizar"
                        className="w-full px-4 py-3 rounded-xl bg-slate-900 border-2 border-slate-700 text-white font-bold text-sm focus:border-purple-500 focus:outline-none transition-colors"
                      />
                    </div>
                    <button
                      onClick={() => { playClick(); handleLoadAeo(manualAeoUrl || undefined); }}
                      disabled={aeoLoading}
                      className="btn-3d bg-purple-600 border-purple-700 border-b-4 hover:bg-purple-500 text-white font-black text-sm py-3 px-6 whitespace-nowrap"
                    >
                      {aeoLoading ? '⏳ ANALIZANDO...' : '🔍 ANALIZAR WEB'}
                    </button>
                  </div>

                  {aeoLoading ? (
                    <div className="text-center py-12 card-3d">
                      <div className="relative w-16 h-16 mx-auto mb-4">
                        <div className="absolute inset-0 rounded-full border-4 border-purple-500/20 animate-pulse" />
                        <div className="absolute inset-0 rounded-full border-4 border-t-purple-500 border-r-purple-500/50 animate-spin" />
                      </div>
                      <p className="text-slate-400 font-bold uppercase tracking-wider animate-pulse">Escaneando tu web para oportunidades AEO...</p>
                      <p className="text-xs text-slate-500 mt-2">Analizando H2/H3 y párrafos con IA</p>
                    </div>
                  ) : aeoError ? (
                    <div className="text-center py-12 card-3d space-y-4">
                      <div className="text-6xl">⚠️</div>
                      <p className="text-red-400 font-bold text-lg">{aeoError}</p>
                      <p className="text-sm text-slate-500 font-bold max-w-md mx-auto">
                        Si tu clave empieza con <strong className="text-slate-400">AQ.</strong>, Google todavía no la acepta bien. Creá una clave que empiece con <strong className="text-slate-400">AIza</strong> en Google Cloud Console → Credenciales.
                      </p>
                      <button
                        onClick={() => { playClick(); handleLoadAeo(manualAeoUrl || undefined); }}
                        className="btn-3d btn-green inline-block py-3 px-8 text-lg font-black mt-4"
                      >
                        REINTENTAR
                      </button>
                    </div>
                  ) : aeoOpportunities.length > 0 ? (() => {
                    const pendingAeo = aeoOpportunities.filter(
                      opp => !isAeoCompleted(completedAeo, opp.pageUrl, opp.heading_affected)
                    );
                    const doneFromCache = aeoOpportunities.filter(
                      opp => isAeoCompleted(completedAeo, opp.pageUrl, opp.heading_affected)
                    );
                    if (pendingAeo.length === 0) {
                      return (
                        <div className="text-center py-12 card-3d space-y-4">
                          <div className="text-6xl">✅</div>
                          <p className="text-green-400 font-bold text-xl">¡Ya completaste las oportunidades AEO de esta lista!</p>
                          <p className="text-sm text-slate-500">Tocá <strong className="text-purple-400">ANALIZAR WEB</strong> para buscar en otra URL, o volvé mañana si agregaste contenido nuevo.</p>
                          {doneFromCache.length > 0 && (
                            <p className="text-xs text-slate-500">{doneFromCache.length} tarea(s) AEO guardada(s) en tu progreso.</p>
                          )}
                        </div>
                      );
                    }
                    return (
                    <div className="space-y-6">
                      {pendingAeo.map((opp, index) => {
                        const isUnlocked = hasPremiumAccess || index < 2;
                        const result = verifyAeoResult[index] || {};

                        if (!isUnlocked) {
                          return (
                            <div key={index} onClick={() => { playClick(); setShowPaywallModal(true); }}
                              className="card-3d relative overflow-hidden p-6 md:p-8 flex flex-col gap-4 transition-all duration-300 border-dashed border-2 border-slate-700 bg-slate-900/60 hover:border-purple-500/50 cursor-pointer group">
                              <div className="absolute inset-0 backdrop-blur-[2px] bg-slate-950/10 pointer-events-none rounded-3xl" />
                              <div className="relative z-10 flex flex-col md:flex-row items-center gap-4 opacity-70 group-hover:opacity-100 transition-opacity">
                                <div className="w-16 h-16 rounded-2xl flex-shrink-0 flex items-center justify-center bg-slate-800 border-2 border-slate-700 text-3xl font-black text-slate-400 group-hover:text-purple-500 group-hover:bg-purple-500/10 transition-colors shadow-inner">🔒</div>
                                <div className="flex-1 text-center md:text-left">
                                  <h3 className="text-xl md:text-2xl font-black text-slate-400 mb-2 blur-[1px] group-hover:blur-none transition-all">🤖 Misión Oculta AEO</h3>
                                  <p className="text-sm font-bold text-slate-500 mb-4">Optimizá la definición de tu servicio principal para ser citado por ChatGPT y Gemini.</p>
                                  <button className="btn-3d !text-sm !py-2 !px-4 bg-purple-600 border-purple-700 border-b-4 text-white font-black">
                                    DESBLOQUEAR {aeoOpportunities.length - 2} MISIONES AEO
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div key={index} className="card-3d relative overflow-hidden p-6 md:p-8 flex flex-col gap-5 transition-all duration-300 border-purple-500/30">
                            <div className="space-y-4 text-left w-full">
                              {/* Header */}
                              <div className="flex items-start gap-3">
                                <div className="w-14 h-14 rounded-2xl flex-shrink-0 flex items-center justify-center bg-purple-600 border-b-4 border-purple-800 text-2xl font-black text-white">🤖</div>
                                <div>
                                  <h3 className="text-xl md:text-2xl font-black text-white">Oportunidad AEO</h3>
                                  <p className="text-sm font-bold text-purple-400">Heading: <span className="text-purple-300">«{opp.heading_affected}»</span> <span className="text-slate-500">({opp.heading_tag})</span></p>
                                  <code className="text-xs font-mono text-slate-500 truncate block max-w-md mt-1">{opp.pageUrl}</code>
                                </div>
                              </div>

                              {/* Problem */}
                              <div className="bg-red-950/30 border border-red-500/30 rounded-2xl p-4">
                                <p className="text-sm font-bold text-red-400"><span className="text-red-300 font-black">⚠️ Problema:</span> {opp.problem_identified}</p>
                              </div>

                              {/* Current text */}
                              <div className="bg-slate-900/60 border border-slate-700/50 rounded-2xl p-4">
                                <p className="text-xs font-black text-slate-500 uppercase tracking-wider mb-2">📝 Texto actual en tu web:</p>
                                <p className="text-sm font-bold text-slate-400 italic leading-relaxed">"{opp.current_text_snippet}"</p>
                              </div>

                              {/* Optimized text */}
                              <div className="bg-purple-950/30 border border-purple-500/30 rounded-2xl p-4">
                                <div className="flex items-center justify-between mb-2">
                                  <p className="text-xs font-black text-purple-400 uppercase tracking-wider">✅ Texto optimizado para IA ({opp.word_count} palabras):</p>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(opp.optimized_text_replacement); playClick(); }}
                                    className="text-xs font-black text-purple-300 hover:text-white bg-purple-800/50 hover:bg-purple-700/50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                                  >📋 COPIAR</button>
                                </div>
                                <p className="text-base font-bold text-purple-200 leading-relaxed">"{opp.optimized_text_replacement}"</p>
                              </div>

                              {/* Verification result */}
                              {result.message && (
                                <div className={`p-4 rounded-xl border text-sm font-bold ${result.success ? 'bg-green-950/40 border-green-500/50 text-green-300' : 'bg-red-950/40 border-red-500/50 text-red-400'}`}>
                                  {result.success ? '✅' : '⚠️'} {result.message}
                                </div>
                              )}

                              {/* Verify button */}
                              <div className="pt-2">
                                <button
                                  onClick={() => handleVerifyAeo(index, opp.pageUrl, opp.heading_affected, opp.optimized_text_replacement)}
                                  disabled={result.loading}
                                  className="btn-3d bg-purple-600 border-purple-700 border-b-4 hover:bg-purple-500 text-white text-sm md:text-base font-black px-6 py-3"
                                >
                                  {result.loading ? '⏳ VERIFICANDO...' : 'YA LO CAMBIÉ (+30 XP)'}
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    );
                  })() : (
                    <div className="text-center py-12 card-3d">
                      <div className="text-6xl mb-4">🤖</div>
                      <p className="text-slate-400 font-bold text-xl">Hacé clic en "ANALIZAR WEB" para escanear tu sitio y encontrar oportunidades AEO.</p>
                      <p className="text-sm text-slate-500 mt-2">Vamos a buscar textos bajo tus H2/H3 que pueden optimizarse para que la IA te cite como fuente.</p>
                    </div>
                  )}
                </div>
              ) : (
                // OPTIMIZATION MISSIONS TAB VIEW
                <div className="space-y-6">
                  {/* Keyword activa — banner contextual */}
                  {goldKeyword ? (
                    <div className="flex items-center gap-3 bg-duo-blue/10 border border-duo-blue/30 rounded-2xl px-5 py-3">
                      <span className="text-xl flex-shrink-0">🎯</span>
                      <p className="text-sm font-black text-sky-300/90 leading-snug">
                        Objetivo activo: <span className="text-sky-200">«{goldKeyword}»</span> — Incluí esta frase en el título, la descripción de Google y las imágenes.
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

                  <PlatformSelector value={cmsPlatform} onChange={setCmsPlatform} playClick={playClick} />

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
                          const isUnlocked = hasPremiumAccess || originalIndex < 2;

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

                          const pageType = detectPageType(mission.page);
                          const display = getMissionDisplayPlain(mission, goldKeyword, siteUrl);
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
                                  <span className={`text-sm font-black px-3 py-1 rounded-md ${pageType.badgeColor}`}>{pageType.label}</span>
                                  {mission.source === 'web' && (
                                    <span className="text-xs font-black px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300">
                                      🌐 Basado en tu web
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 mb-1.5 w-full min-w-0">
                                  <code className="text-xs md:text-sm font-mono text-slate-500 dark:text-slate-400 truncate block w-full max-w-[200px] min-[400px]:max-w-[260px] sm:max-w-[380px] md:max-w-[450px]">{mission.page}</code>
                                  <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(mission.page); playClick(); }}
                                    className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors text-slate-400 hover:text-slate-655 text-lg flex-shrink-0" title="Copiar URL">📋</button>
                                </div>
                                <p className="text-sm text-slate-400 font-bold italic mb-2 truncate" title={display.suggestedText}>
                                  💡 Sugerencia: {display.suggestedText}
                                </p>
                                <p className="font-bold text-slate-655 dark:text-slate-350 text-base md:text-lg lg:text-xl leading-relaxed mb-2">{display.description}</p>
                                {display.objective && (
                                   <div className="inline-flex items-center gap-2 bg-duo-blue/15 border border-duo-blue/30 rounded-xl px-3 py-1.5 mt-1 mb-2">
                                     <p className="text-xs font-black text-sky-300">{display.objective}</p>
                                   </div>
                                )}
                                {mission.source === 'web' || mission.position == null ? (
                                  <div className="flex flex-wrap gap-2 mt-3 text-xs font-bold text-amber-300/90">
                                    <span>🔍 Detectado al analizar tu web · conectá Search Console para ver tus ventas y posiciones reales</span>
                                  </div>
                                ) : (
                                  <div className="flex flex-wrap gap-4 mt-3 text-sm font-bold text-slate-550 dark:text-slate-400">
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
            <div className="w-full max-w-full min-w-0 space-y-6 md:space-y-8 animate-in fade-in duration-300">
              <div className="flex items-start md:items-center flex-col md:flex-row gap-4 mb-4 min-w-0 w-full">
                <button onClick={() => { playClick(); closeMission(); }} className="text-5xl text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 hidden md:block">✕</button>
                <div className="min-w-0 w-full">
                  <h2 className="text-2xl md:text-3xl lg:text-4xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-3">
                    <button onClick={() => { playClick(); closeMission(); }} className="text-2xl text-slate-500 md:hidden flex-shrink-0">←</button>
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
                siteUrl={siteUrl}
                platformId={cmsPlatform}
                goldKeyword={goldKeyword}
                pagePreview={pagePreview}
                previewLoading={pagePreviewLoading}
                playClick={playClick}
              />

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2 md:gap-4 min-w-0 w-full">
                {[
                  { label: "Oportunidades de Venta", value: selectedMission.clicks,              color: "text-duo-blue" },
                  { label: "Dinero sobre la mesa",   value: selectedMission.impressions,          color: "text-duo-yellow" },
                  { label: "Posición",               value: `#${selectedMission.position?.toFixed(0)}`, color: "text-duo-green" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-white dark:bg-slate-800 rounded-2xl p-2 md:p-4 text-center border-2 border-gray-100 dark:border-slate-700 shadow-sm min-w-0">
                    <div className={`text-xl md:text-3xl lg:text-4xl font-black ${color}`}>{value}</div>
                    <div className="text-[10px] md:text-sm font-bold text-slate-550 dark:text-slate-400 leading-tight">{label}</div>
                  </div>
                ))}
              </div>

              {/* Owl Guide */}
              <div className="w-full">
                <button onClick={() => { playClick(); setShowOwl(!showOwl); }}
                  className={`w-full flex items-center justify-between p-5 rounded-2xl border-2 font-black transition-all text-xl md:text-2xl ${showOwl ? 'bg-slate-800 border-slate-600 text-white' : 'bg-white dark:bg-slate-800 border-gray-100 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300'}`}>
                  <span className="flex items-center gap-4"><img src="/images/logo-owl.png" alt="Búho" className="w-10 h-10 object-contain" /> Explicación del Búho</span>
                  <span className="text-3xl">{showOwl ? '−' : '+'}</span>
                </button>
                <div className={`overflow-hidden transition-all duration-300 ease-in-out mt-2 ${showOwl ? 'max-h-80 opacity-100' : 'max-h-0 opacity-0'}`}>
                  <div className="bg-slate-900 p-6 rounded-2xl border-2 border-slate-700 shadow-xl flex gap-4 items-start">
                    <img src="/images/logo-owl.png" alt="SEO Jump" className="w-16 h-16 md:w-20 md:h-20 object-contain animate-bounce flex-shrink-0" />
                    <div className="flex-1">
                      <div className="bg-slate-800 text-slate-200 p-6 rounded-2xl rounded-tl-none font-bold text-base md:text-lg lg:text-xl leading-relaxed shadow-lg border border-slate-600 relative">
                        <p>{getOwlExplanation(selectedMission.type, selectedMission.keyword || goldKeyword)}</p>
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
              <div className="card-3d bg-white dark:bg-slate-800 space-y-6 p-4 md:p-8 min-w-0 w-full overflow-hidden">
                <p className="font-bold text-slate-655 dark:text-slate-300 text-base md:text-lg lg:text-xl break-words">
                  {getPlainMissionLabels(selectedMission.type).verifyLabel}
                  {goldKeyword && (
                    <> — debe incluir <span className="text-duo-blue font-black">«{goldKeyword}»</span></>
                  )}:
                </p>
                <input
                  type="text"
                  placeholder={
                    getMissionDisplayPlain(selectedMission, goldKeyword, siteUrl).suggestedText
                  }
                  value={h1Value}
                  onChange={(e) => setH1Value(e.target.value)}
                  className="w-full max-w-full p-4 md:p-5 text-base md:text-xl border-2 border-slate-200 dark:border-slate-600 rounded-xl focus:border-duo-green outline-none font-black text-slate-800 dark:text-slate-100 dark:bg-slate-700"
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

                <div className="p-4 bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-600/40 rounded-2xl text-sm font-bold text-slate-700 dark:text-slate-300 flex gap-3 items-start shadow-sm leading-relaxed text-left animate-in fade-in slide-in-from-bottom duration-300">
                  <span className="text-2xl flex-shrink-0 select-none">🦉</span>
                  <p>
                    <strong className="font-black text-slate-800 dark:text-slate-200">¡Tip de experto!</strong> Para que el sistema detecte tus cambios, asegurate de cerrar el panel de administrador y abrir tu web como un visitor común. Google lee tu sitio tal como lo ven tus clientes, no desde el editor.
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

      {/* Copy Toast */}
      {copyToast && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 flex items-center gap-3 bg-slate-900 border-2 border-amber-500/60 text-amber-300 font-black rounded-2xl px-6 py-3 shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
          <span className="text-xl">📋</span>
          <div>
            <p className="text-sm font-black">¡Título copiado!</p>
            <p className="text-xs font-bold text-slate-400">Pegalo en el campo <span className="text-amber-300">"Título SEO"</span> de Yoast / Rank Math / Shopify — NO en la descripción.</p>
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

      {showPaywallModal && (
        <PaywallModal 
          onClose={() => setShowPaywallModal(false)} 
          totalHiddenMissions={missions.length > 2 ? missions.length - 2 : 0} 
          playClick={playClick}
        />
      )}

      <UpgradeModal
        open={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        playClick={playClick}
        message={upgradeMessage}
      />

    </div>
  );
}
