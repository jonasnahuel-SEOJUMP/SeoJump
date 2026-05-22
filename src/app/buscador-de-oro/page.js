"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useAudio } from "../../hooks/useAudio";
import { useTheme } from "../../hooks/useTheme";
import { verifyContentMission } from "../../lib/actions";

// Filtro Purificador Universal (UI-safe and encoding-safe parser)
const purifyText = (text) => {
  if (!text) return "";
  
  let clean = text;

  // 1) Decodificación de caracteres rotos/UTF-8 y entidades HTML comunes de WordPress
  clean = clean
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#8211;|&#8212;|&ndash;|&mdash;|\u2013|\u2014/g, "-")
    .replace(/&#8220;|&#8221;|&ldquo;|&rdquo;/g, '"');

  // Decodificación de patrones UTF-8 rotos comunes
  clean = clean
    .replace(/Ã±/g, "ñ")
    .replace(/Ã‘/g, "Ñ")
    .replace(/Ã¡/g, "á")
    .replace(/Ã©/g, "é")
    .replace(/Ã­/g, "í")
    .replace(/Ã³/g, "ó")
    .replace(/Ãº/g, "ú")
    .replace(/Ã/g, "ñ") // fallback
    .replace(/\uFFFD/g, "ñ"); // reemplazar rombos negros explícitamente

  // Corrección específica de error de tipeo / extracción
  clean = clean.replace(/\bpaos\b/gi, "paños");

  // 4) Limpiar espacios extras en extremos y dobles espacios internos
  clean = clean.trim().replace(/\s+/g, " ");

  return clean;
};

export default function BuscadorDeOro() {
  const { data: session, status } = useSession();
  const { isMuted, toggleMute, playClick, playThemeToggle, playSuccess } = useAudio();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  
  const DAILY_LIMIT = 2;

  // ── Truco de Dueño: bypass VIP ───────────────────────────────────────────
  // Emails con acceso ilimitado (separa varios con coma en .env.local)
  // ej: NEXT_PUBLIC_ADMIN_EMAILS=jonas@gmail.com,otro@gmail.com
  const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  const isVip = () => {
    // Bypass 1: estamos en localhost
    if (typeof window !== "undefined" && window.location.hostname === "localhost") return true;
    // Bypass 2: el email del usuario logueado es admin
    const userEmail = session?.user?.email?.toLowerCase() || "";
    if (userEmail && ADMIN_EMAILS.includes(userEmail)) return true;
    return false;
  };

  const [xp, setXp] = useState(0);
  const [query, setQuery] = useState("");
  const [excludedWords, setExcludedWords] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [error, setError] = useState(null);
  const [siteUrl, setSiteUrl] = useState("");
  const [verifyingIndex, setVerifyingIndex] = useState(null);
  const [completedSuggestions, setCompletedSuggestions] = useState(new Set());
  const [showConfetti, setShowConfetti] = useState(false);
  const [showOwl, setShowOwl] = useState(false);
  const [dailyCredits, setDailyCredits] = useState(0);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [discardedSuggestions, setDiscardedSuggestions] = useState(new Set());
  const [dismissingIndex, setDismissingIndex] = useState(null);

  // ── Helpers de créditos diarios ──────────────────────────────────────────
  const getTodayStr = () => new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  const readCredits = () => {
    // VIPs siempre tienen créditos disponibles
    if (isVip()) return 0;
    try {
      const raw = localStorage.getItem("seojump_credits");
      if (!raw) return 0;
      const { date, count } = JSON.parse(raw);
      if (date !== getTodayStr()) {
        // Nuevo día → resetear
        localStorage.setItem("seojump_credits", JSON.stringify({ date: getTodayStr(), count: 0 }));
        return 0;
      }
      return typeof count === "number" ? count : 0;
    } catch {
      return 0;
    }
  };

  const consumeCredit = () => {
    // VIPs no consumen créditos
    if (isVip()) return 0;
    const today = getTodayStr();
    const current = readCredits();
    const next = current + 1;
    localStorage.setItem("seojump_credits", JSON.stringify({ date: today, count: next }));
    setDailyCredits(next);
    return next;
  };

  // Load XP and global completed missions from localStorage
  useEffect(() => {
    const savedXp = localStorage.getItem("seojump_xp");
    const currentXp = savedXp ? parseInt(savedXp, 10) : 0;
    setXp(currentXp);

    const savedUrl = localStorage.getItem("seojump_site_url");
    if (savedUrl) setSiteUrl(savedUrl);

    // Cargar Búsqueda Anterior
    const savedQuery = localStorage.getItem("gold-tu-busqueda");
    if (savedQuery) setQuery(purifyText(savedQuery));

    const savedSuggestions = localStorage.getItem("gold-suggestions");
    if (savedSuggestions) {
      try {
        const parsed = JSON.parse(savedSuggestions);
        if (Array.isArray(parsed)) {
          // Compatibilidad retroactiva: acepta strings viejos y objetos nuevos
          setSuggestions(parsed.map(s =>
            typeof s === 'string'
              ? { text: purifyText(s), intent: 'venta' }
              : { text: purifyText(s.text || ''), intent: s.intent === 'atraccion' ? 'atraccion' : 'venta' }
          ));
        }
      } catch(e) {}
    }

    const savedCompleted = localStorage.getItem("seojump_completed_missions");
    if (savedCompleted) {
      try {
        const parsed = JSON.parse(savedCompleted);
        if (Array.isArray(parsed)) {
          setCompletedSuggestions(new Set(parsed));
        }
      } catch (e) {
        console.error("Error parsing completed missions", e);
      }
    }

    // Leer créditos diarios (auto-resetea si cambió el día)
    const credits = readCredits();
    setDailyCredits(credits);

  }, [router]);

  // Auth Protection
  useEffect(() => {
    if (!session && status !== "loading") {
      router.push("/");
    }
  }, [session, status, router]);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    // Verificar límite diario ANTES de la búsqueda
    const currentCredits = readCredits();
    if (currentCredits >= DAILY_LIMIT) {
      setShowPremiumModal(true);
      return;
    }

    playClick();
    setLoading(true);
    setError(null);
    setSuggestions([]);

    try {
      // Parsear palabras excluidas: separadas por coma, limpiar espacios
      const parsedExcluded = excludedWords
        .split(',')
        .map((w) => w.trim())
        .filter(Boolean)
        .join(',');

      const response = await fetch(
        `/api/suggestions?q=${encodeURIComponent(query)}&siteUrl=${encodeURIComponent(siteUrl)}${
          parsedExcluded ? `&excludedWords=${encodeURIComponent(parsedExcluded)}` : ''
        }`
      );
      if (!response.ok) throw new Error("Error al buscar oportunidades.");

      const data = await response.json();
      const rawSug = data.suggestions || [];
      // Normalizar: la API ahora devuelve {text, intent}[]; garantizar compat
      const purifiedSug = rawSug.map(s =>
        typeof s === 'string'
          ? { text: purifyText(s), intent: 'venta' }
          : { text: purifyText(s.text || ''), intent: s.intent === 'atraccion' ? 'atraccion' : 'venta' }
      );
      setSuggestions(purifiedSug);

      // Guardar en localStorage y consumir crédito solo si la búsqueda fue exitosa
      localStorage.setItem("gold-tu-busqueda", query);
      localStorage.setItem("gold-suggestions", JSON.stringify(purifiedSug));
      const used = consumeCredit();
      if (used >= DAILY_LIMIT) setShowPremiumModal(false); // ya se mostrará en el form
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDiscard = (index) => {
    playClick();
    // Animar salida primero, luego descartar
    setDismissingIndex(index);
    setTimeout(() => {
      setDiscardedSuggestions(prev => new Set([...prev, index]));
      setDismissingIndex(null);
    }, 280);
  };

  const handleVerify = async (suggestion, index, targetUrl) => {
    const urlToCheck = targetUrl || siteUrl;
    if (!urlToCheck) {
       alert("No sabemos la URL de tu sitio. Volvé al Dashboard y agregala primero, o pegala manualmente.");
       return;
    }
    
    playClick();
    setVerifyingIndex(index);

    try {
      const result = await verifyContentMission(urlToCheck, suggestion);
      if (result.success) {
        setShowConfetti(true);
        playSuccess();
        
        // Sum 20 XP for a Gold Mission
        const newXp = xp + 20;
        setXp(newXp);
        localStorage.setItem("seojump_xp", newXp);

        // Mark as completed globally
        const missionId = `gold-${suggestion}`;
        setCompletedSuggestions(prev => {
          const updated = new Set([...prev, missionId]);
          localStorage.setItem("seojump_completed_missions", JSON.stringify(Array.from(updated)));
          
          // Check if all suggestions are completed now
          const allNowCompleted = suggestions.length > 0 && suggestions.every(s => updated.has(`gold-${s.text}`));
          if (allNowCompleted) {
            setShowOwl(true);
          }
          
          return updated;
        });

        // Hide confetti after 3s
        setTimeout(() => setShowConfetti(false), 3000);
      } else {
        alert(result.message);
      }
    } catch (err) {
      alert("Ocurrió un error al verificar: " + err.message);
    } finally {
      setVerifyingIndex(null);
    }
  };

  // Only render if session exists
  if (status === "loading" || !session) {
    return <div className="h-full flex items-center justify-center font-bold text-slate-500">Cargando...</div>;
  }

  return (
    <div className="flex-1 flex flex-col items-center p-4 md:p-8 overflow-y-auto animate-in slide-in-from-bottom duration-500 w-full max-w-7xl mx-auto space-y-8 bg-[#f7f7f7] dark:bg-slate-900 transition-colors duration-300 text-slate-800 dark:text-slate-100 min-h-screen relative">
      
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
      <header className="w-full flex flex-col gap-4 bg-white dark:bg-slate-800 p-6 rounded-2xl border-2 border-duo-white-shadow dark:border-slate-700 sticky top-4 z-10 transition-colors duration-300">
         <div className="flex items-center justify-between">
           <button 
             onClick={() => {
               playClick();
               router.push("/");
             }}
             className="text-slate-500 text-base md:text-lg font-black hover:text-slate-800 flex items-center gap-2"
           >
             ← VOLVER AL DASHBOARD
           </button>
           <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                 <span className="text-3xl">🔥</span>
                 <span className="font-black text-2xl text-orange-500">{Math.floor(xp / 100) + 1}</span>
              </div>
              <button 
                onClick={toggleMute} 
                className="text-3xl hover:scale-110 transition-transform"
                title={isMuted ? "Activar sonido" : "Silenciar"}
              >
                {isMuted ? '🔇' : '🔊'}
              </button>
              <button 
                onClick={() => { toggleTheme(); playThemeToggle(theme === "light"); }} 
                className="text-3xl hover:scale-110 transition-transform"
                title={theme === "light" ? "Activar Modo Oscuro" : "Activar Modo Claro"}
              >
                {theme === "light" ? '🌙' : '☀️'}
              </button>
              {session?.user?.image ? (
                <img src={session.user.image} alt="Avatar" className="w-12 h-12 rounded-full border-2 border-duo-green-shadow" />
              ) : (
                <div className="w-12 h-12 bg-duo-green rounded-full flex items-center justify-center border-b-4 border-duo-green-shadow text-white text-xl">
                   👤
                </div>
              )}
           </div>
         </div>
         {/* Navigation Tabs */}
         <nav className="flex flex-wrap md:flex-nowrap gap-3 md:gap-4 w-full mt-2">
            <div className="flex-1 btn-3d bg-yellow-50 text-duo-yellow font-black text-center py-5 px-6 text-lg lg:text-xl border-2 border-duo-yellow border-b-4 cursor-default">
              🔍 Fase 1: Búsqueda
            </div>
            <button onClick={() => { playClick(); router.push("/contenido"); }} className="flex-1 btn-3d btn-white text-slate-600 dark:text-slate-300 hover:text-blue-500 text-center py-5 px-6 text-lg lg:text-xl font-black transition-colors">
              ✍️ Fase 2: Contenido
            </button>
            <button onClick={() => { playClick(); router.push("/optimizacion"); }} className="flex-1 btn-3d btn-white text-slate-600 dark:text-slate-300 hover:text-slate-800 text-center py-5 px-6 text-lg lg:text-xl font-black transition-colors">
              🛠️ Fase 3: Optimización
            </button>
            {xp >= 500 ? (
              <button onClick={() => { playClick(); router.push("/detective-de-enlaces"); }} className="flex-1 btn-3d btn-white text-slate-600 dark:text-slate-300 hover:text-purple-650 text-center py-5 px-6 text-lg lg:text-xl font-black transition-colors">
                🕵️‍♂️ Fase 4: Indexación
              </button>
            ) : (
              <div className="flex-1 btn-3d btn-white text-slate-400 bg-gray-50 dark:bg-slate-800 dark:border-slate-700 opacity-70 cursor-not-allowed text-center py-5 px-6 text-lg lg:text-xl font-black flex items-center justify-center gap-1">
                🔒 Fase 4 (Nivel 6)
              </div>
            )}
         </nav>
      </header>

      {/* Main Content: Layout de Dos Columnas */}
      <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-start relative z-0">
        
        {/* CABINA DE CONTROL (Columna Izquierda) */}
        <div className="lg:col-span-5 w-full flex flex-col gap-6 lg:sticky lg:top-48">
           <div className="text-center md:text-left space-y-4">
             <h1 className="text-4xl lg:text-5xl font-black text-duo-yellow">Fase 1: Buscador de Oro 👑</h1>
             <p className="text-xl lg:text-2xl font-bold text-slate-600 dark:text-slate-400">
               Descubrí qué busca la gente realmente y capturá clientes convirtiendo esas búsquedas en texto para tu web.
             </p>
           </div>
           
           {/* Contador de fichas — solo visible para usuarios no-VIP */}
           {!isVip() ? (
             <div className="flex items-center justify-between bg-slate-800/60 border border-slate-700/50 rounded-xl px-4 py-2.5">
               <span className="text-sm font-black text-slate-400 uppercase tracking-wider">Fichas de hoy</span>
               <div className="flex items-center gap-2">
                 {[...Array(DAILY_LIMIT)].map((_, i) => (
                   <div
                     key={i}
                     className={`w-6 h-6 rounded-full border-2 transition-all ${
                       i < dailyCredits
                         ? "bg-amber-500 border-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]"
                         : "bg-slate-700 border-slate-600"
                     }`}
                   />
                 ))}
                 <span className={`text-sm font-black ml-1 ${
                   dailyCredits >= DAILY_LIMIT ? "text-red-400" : "text-amber-400"
                 }`}>
                   {dailyCredits}/{DAILY_LIMIT}
                 </span>
               </div>
             </div>
           ) : (
             <div className="flex items-center justify-between bg-green-900/30 border border-green-700/40 rounded-xl px-4 py-2.5">
               <span className="text-sm font-black text-green-400 uppercase tracking-wider">🔑 Modo Admin — Ilimitado</span>
               <span className="text-sm font-black text-green-300">∞ fichas</span>
             </div>
           )}

           {/* Search Form */}
           {!isVip() && dailyCredits >= DAILY_LIMIT ? (
             /* ── CARTEL DE BOXES BLOQUEADO ── */
             <div className="w-full space-y-5 animate-in fade-in duration-300">
               <div className="bg-slate-900 rounded-3xl border-2 border-amber-700/50 shadow-2xl overflow-hidden relative">
                 <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500 opacity-5 rounded-full blur-3xl pointer-events-none" />
                 <div className="absolute bottom-0 left-0 w-32 h-32 bg-red-500 opacity-5 rounded-full blur-3xl pointer-events-none" />
                 <div className="relative z-10 p-7 flex flex-col items-center text-center gap-5">
                   <div className="text-7xl animate-bounce">🦉</div>
                   <div className="space-y-2">
                     <h3 className="text-2xl md:text-3xl font-black text-amber-400">¡Frená en boxes, campeón!</h3>
                     <p className="text-base md:text-lg font-bold text-slate-300 leading-relaxed">
                       Ya usaste tus <span className="text-white font-black">2 fichas gratuitas</span> de hoy. El tanque se vuelve a llenar automáticamente en{" "}
                       <span className="text-amber-400 font-black">24 horas</span>.
                     </p>
                     <p className="text-sm font-bold text-slate-400 pt-1">
                       Si querés mapear y optimizar todo el stock de tu negocio ahora mismo sin esperar, pasá al Plan Premium Ilimitado.
                     </p>
                   </div>
                   <button
                     onClick={() => {
                       playClick();
                       alert("🚀 Próximamente disponible. ¡Gracias por tu interés en el Plan Premium!");
                     }}
                     className="w-full btn-3d bg-amber-500 border-amber-600 border-b-4 hover:bg-amber-400 active:border-b-0 active:translate-y-1 text-white text-xl md:text-2xl font-black py-5 flex items-center justify-center gap-3"
                   >
                     🚀 Desbloquear Modo Ilimitado (Mercado Pago)
                   </button>
                   <p className="text-xs font-bold text-slate-500">
                     🔒 Próximamente disponible · Beta Gratuita activa
                   </p>
                 </div>
               </div>
             </div>
           ) : (
             <form onSubmit={handleSearch} className="w-full space-y-4">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Ej: limpieza de tapizados, tratamiento acrílico..."
                  className="w-full p-5 text-xl md:text-2xl border-2 border-slate-200 dark:border-slate-600 rounded-xl focus:border-duo-yellow outline-none font-black text-slate-800 dark:text-slate-100 dark:bg-slate-800"
                />

                {/* ── Filtro Dinámico de Exclusión ── */}
                <div className="relative">
                  <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                    <span className="text-lg select-none">🚫</span>
                  </div>
                  <input
                    type="text"
                    value={excludedWords}
                    onChange={(e) => setExcludedWords(e.target.value)}
                    placeholder="Marcas o palabras a excluir (ej: full car, mercadolibre)"
                    className="w-full pl-11 pr-4 py-3.5 text-base md:text-lg border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl focus:border-red-400 focus:border-solid outline-none font-bold text-slate-600 dark:text-slate-300 dark:bg-slate-800 placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-all"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !query.trim()}
                  className={`btn-3d w-full text-2xl py-5 font-black ${loading || !query.trim() ? "btn-white text-slate-400" : "bg-amber-500 border-amber-600 border-b-4 hover:bg-amber-400 active:border-b-0 active:translate-y-1 text-white"}`}
                >
                  {loading ? "BUSCANDO..." : `DETECTAR OPORTUNIDAD (${DAILY_LIMIT - dailyCredits} ficha${DAILY_LIMIT - dailyCredits === 1 ? "" : "s"} restante${DAILY_LIMIT - dailyCredits === 1 ? "" : "s"})`}
                </button>
              </form>
           )}

           {/* Módulo Educativo ("Explicación del Búho") */}
            {(() => {
              const allCompleted = suggestions.length > 0 && suggestions.every(sug => completedSuggestions.has(`gold-${sug.text}`));
              return (
                <div className="w-full">
                  <button 
                    onClick={() => { playClick(); setShowOwl(!showOwl); }} 
                    className={`w-full flex items-center justify-between p-5 rounded-2xl border-2 font-black transition-all ${showOwl ? 'bg-slate-800 border-slate-600 text-white text-xl md:text-2xl' : 'bg-white dark:bg-slate-800 border-gray-100 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600 text-xl md:text-2xl'}`}
                  >
                    <span className="flex items-center gap-4">
                      <span className="text-4xl">🦉</span> 
                      {allCompleted ? "¡Mensaje Especial del Búho! 🦉" : "Explicación del Búho"}
                    </span>
                    <span className="text-3xl">{showOwl ? '−' : '+'}</span>
                  </button>
                  
                  <div className={`overflow-hidden transition-all duration-300 ease-in-out mt-2 ${showOwl ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
                    <div className="bg-slate-900 p-6 rounded-2xl border-2 border-slate-700 shadow-xl flex gap-4 items-start relative">
                       <div className="text-6xl md:text-7xl animate-bounce flex-shrink-0 drop-shadow-lg z-10">🦉</div>
                       <div className="flex-1">
                          <div className="bg-slate-800 text-slate-200 p-6 rounded-2xl rounded-tl-none font-bold text-base md:text-lg lg:text-xl leading-relaxed shadow-lg border border-slate-600 relative">
                             {allCompleted ? (
                               <p>
                                 <strong className="text-yellow-450">¡Felicidades, buscador de oro! 🎉</strong> Has conquistado todas las misiones para la palabra clave actual. ¡Espectacular trabajo! Pero recordá: el SEO nunca se termina. Te invito a ingresar una <strong className="text-duo-yellow">NUEVA palabra clave</strong> en el panel de la izquierda para abrir otra veta de oro y reiniciar el tablero de misiones.
                               </p>
                             ) : (
                               <p>El <strong className="text-duo-yellow">Buscador de Oro</strong> no analiza errores técnicos, escarba la mente de tu cliente real. Acá te mostramos qué palabras escribe la gente en Google en este milisegundo para comprar lo que vos vendés. Si creás una página o un producto para esa frase exacta, capturás la demanda antes que la competencia.</p>
                             )}
                             <div className="absolute top-0 -left-2 w-0 h-0 border-t-[10px] border-t-slate-800 border-l-[10px] border-l-transparent"></div>
                          </div>
                       </div>
                    </div>
                  </div>
                </div>
              );
            })()}
           
           {/* Error Message */}
           {error && (
             <p className="text-red-500 font-bold text-center mt-4">{error}</p>
           )}
        </div>

        {/* TABLERO DE MINAS DE ORO (Columna Derecha) */}
        <div className="lg:col-span-7 w-full flex flex-col gap-6">
          {/* Results as Actionable Missions */}
          {suggestions.length > 0 ? (
            <div className="w-full space-y-6 animate-in fade-in duration-300">
              <h2 className="text-3xl lg:text-4xl font-black text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-3 justify-center md:justify-start">
                <span className="text-4xl">🪙</span> Resultados de Oro
              </h2>

              {/* ── Consejo del Búho — Tutor de SEO Premium ── */}
              <div className="relative rounded-2xl overflow-hidden border border-amber-500/30 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 shadow-[0_0_30px_rgba(251,191,36,0.08)] mb-2">
                {/* Glow decorativo */}
                <div className="absolute top-0 left-0 w-40 h-40 bg-amber-400 opacity-5 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute bottom-0 right-0 w-32 h-32 bg-orange-500 opacity-5 rounded-full blur-2xl pointer-events-none" />

                {/* Pill de badge superior */}
                <div className="relative z-10 px-5 pt-5 pb-1 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-black uppercase tracking-widest rounded-full px-3 py-1">
                    <span className="text-sm">🦉</span> Consejo Premium
                  </span>
                </div>

                {/* Cuerpo del callout */}
                <div className="relative z-10 px-5 pb-5 pt-3 flex gap-4 items-start">
                  {/* Búho */}
                  <div className="hidden sm:flex flex-shrink-0 w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 items-center justify-center text-3xl">
                    🦉
                  </div>

                  {/* Texto */}
                  <div className="flex-1 min-w-0">
                    <p className="text-amber-300 font-black text-base md:text-lg mb-3 leading-snug">
                      ¡Atención! Para que Google y mi radar detecten tu palabra clave, debe estar en lugares estratégicos.
                    </p>
                    <p className="text-slate-400 text-sm font-bold mb-3">
                      Asegurate de incluirla en estos <span className="text-white font-black">4 puntos calientes</span> de tu web:
                    </p>
                    <ol className="space-y-2">
                      {[
                        { num: "1️⃣", label: "La URL / Slug", example: "ej: /apc-detailing" },
                        { num: "2️⃣", label: "El Título Principal (H1)", example: "de la página" },
                        { num: "3️⃣", label: "El primer párrafo del texto", example: "de forma natural" },
                        { num: "4️⃣", label: "El Meta Título y Meta Descripción", example: "" },
                      ].map(({ num, label, example }) => (
                        <li key={num} className="flex items-start gap-2.5">
                          <span className="text-base flex-shrink-0 leading-snug">{num}</span>
                          <span className="text-slate-200 font-bold text-sm md:text-base leading-snug">
                            {label}
                            {example && (
                              <span className="text-slate-500 font-medium ml-1.5">({example})</span>
                            )}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              </div>

              {/* Todas descartadas — mensaje del Búho */}
              {suggestions.every((_, i) => discardedSuggestions.has(i)) ? (
                <div className="text-center py-14 px-6 bg-slate-900 rounded-3xl border-2 border-slate-700 shadow-xl animate-in fade-in duration-300">
                  <div className="text-7xl mb-5 animate-bounce">🦉</div>
                  <h3 className="text-2xl md:text-3xl font-black text-amber-400 mb-3">¡Pista despejada!</h3>
                  <p className="text-base md:text-lg font-bold text-slate-300 leading-relaxed max-w-sm mx-auto">
                    Podés usar tu siguiente ficha diaria para buscar una nueva tanda de palabras clave enfocadas en tu stock.
                  </p>
                </div>
              ) : (
                suggestions.map((sug, index) => {
                  if (discardedSuggestions.has(index)) return null;
                  const missionId = `gold-${sug.text}`;
                  const isCompleted = completedSuggestions.has(missionId);
                  const isVerifying = verifyingIndex === index;
                  const isDismissing = dismissingIndex === index;
                  const isVenta = sug.intent !== 'atraccion';

                  return (
                    <div
                      key={index}
                      className={`card-3d bg-white dark:bg-slate-800 flex flex-col gap-4 p-6 md:p-8 transition-all duration-300 hover:shadow-lg relative ${
                        isCompleted ? 'border-green-400 opacity-80 bg-green-50/50 dark:bg-green-900/10' : ''
                      } ${
                        isDismissing ? 'opacity-0 scale-95 -translate-y-1' : 'opacity-100 scale-100'
                      }`}
                    >
                      {/* Botón descartar */}
                      {!isCompleted && (
                        <button
                          onClick={() => handleDiscard(index)}
                          title="Descartar palabra clave"
                          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-200 text-lg font-black"
                        >
                          ✕
                        </button>
                      )}

                      <div className="flex flex-wrap items-center gap-3 pr-8">
                        <span className="text-4xl">{isCompleted ? '✅' : '🎯'}</span>
                        <h3 className={`text-2xl lg:text-3xl font-black ${isCompleted ? 'text-green-600 dark:text-green-400' : 'text-slate-800 dark:text-slate-100'}`}>
                          {isCompleted ? '¡Misión Completada!' : 'Misión Oro'}
                        </h3>
                        {/* ── Badge de Intención ── */}
                        {!isCompleted && (
                          <span className={`inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wide rounded-full px-3 py-1 border ${
                            isVenta
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/60'
                              : 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-400 dark:border-violet-800/60'
                          }`}>
                            {isVenta ? '🛒' : '📝'}
                            {isVenta ? 'Producto / Servicio' : 'Blog / FAQ'}
                          </span>
                        )}
                      </div>

                      <p className={`text-lg lg:text-xl font-bold ${isCompleted ? 'line-through text-slate-400' : 'text-slate-700 dark:text-slate-200'}`}>
                        Tu web no menciona la frase exacta <strong className="text-duo-blue dark:text-cyan-400">"{sug.text}"</strong>.
                      </p>

                      {isCompleted ? (
                        <div className="mt-4 border-t-2 border-slate-100 dark:border-slate-700 pt-4">
                          <button
                            disabled
                            className="w-full py-4 text-base md:text-lg lg:text-xl flex items-center justify-center gap-2 rounded-xl border border-green-250 bg-green-50 text-green-600 font-black dark:bg-green-950/20 dark:border-green-900/50 dark:text-green-400 cursor-not-allowed transition-all duration-200 shadow-sm"
                          >
                            <span>✅ Misión Ganada (+20 XP)</span>
                          </button>
                        </div>
                      ) : (
                        <>
                          <p className="text-base lg:text-lg font-bold text-slate-550 dark:text-slate-450 leading-relaxed">
                            Agregála en un párrafo nuevo o en un subtítulo (H2) para capturar esos clientes que buscan exactamente esto en Google.
                          </p>

                          <div className="mt-4 space-y-4 border-t-2 border-slate-100 dark:border-slate-700 pt-4">
                            <label className="text-sm lg:text-base font-black text-slate-550 uppercase dark:text-slate-450 block">URL del artículo a verificar:</label>
                            <input
                              type="text"
                              defaultValue={siteUrl}
                              id={`url-input-${index}`}
                              className="w-full p-4 text-base md:text-lg border-2 border-slate-200 dark:border-slate-700 rounded-xl focus:border-indigo-500 outline-none font-bold text-slate-700 bg-gray-50 dark:bg-slate-900 dark:text-slate-200 transition-colors"
                              placeholder="Ej: https://miweb.com/blog/nota"
                            />
                            <button
                              onClick={() => {
                                const targetUrl = document.getElementById(`url-input-${index}`).value;
                                handleVerify(sug.text, index, targetUrl);
                              }}
                              disabled={isVerifying}
                              className={`w-full py-4 text-base md:text-lg lg:text-xl flex items-center justify-center gap-2 rounded-xl border transition-all duration-200 shadow-sm font-black active:scale-[0.99] ${
                                isVerifying
                                  ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed dark:bg-slate-800 dark:border-slate-700 dark:text-slate-500'
                                  : 'bg-slate-700 border-slate-800 text-white hover:bg-slate-600 hover:ring-2 hover:ring-slate-300 dark:bg-indigo-950/50 dark:border-indigo-800/80 dark:text-indigo-200 dark:hover:bg-indigo-900/60 dark:hover:text-white dark:hover:ring-2 dark:hover:ring-indigo-950'
                              }`}
                            >
                              <span>{isVerifying ? '⏳ Escaneando web...' : '🔍 Verificar en mi Web'}</span>
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          ) : (
             /* Empty State after search or initial state */
             <div className="text-center py-16 px-6 card-3d bg-white/50 dark:bg-slate-800/50 border-dashed border-2 border-slate-200 dark:border-slate-700 shadow-none">
               {!loading && query && !error ? (
                 <div className="space-y-4">
                   <div className="text-7xl opacity-50 mb-2">🌵</div>
                   <p className="text-slate-500 font-black text-2xl">No encontramos oro para esta búsqueda.</p>
                   <p className="text-slate-450 font-bold text-lg">¡Probá con otra palabra más general o un sinónimo!</p>
                 </div>
               ) : (
                 <div className="space-y-4">
                   <div className="text-7xl opacity-50 mb-2 animate-pulse">⛏️</div>
                   <p className="text-slate-500 font-black text-2xl">Esperando para escarbar...</p>
                   <p className="text-slate-455 font-bold text-lg">Usá el panel izquierdo para buscar tu primera mina de oro.</p>
                 </div>
               )}
             </div>
          )}
        </div>
      </div>
    </div>
  );
}
