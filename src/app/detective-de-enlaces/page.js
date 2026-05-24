"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useAudio } from "../../hooks/useAudio";
import { useTheme } from "../../hooks/useTheme";
import { requestGoogleIndexing } from "../../lib/actions";

export default function DetectiveDeEnlaces() {
  const { data: session, status } = useSession();
  const { isMuted, toggleMute, playClick, playThemeToggle, playSuccess } = useAudio();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();

  const [xp, setXp] = useState(0);
  const [hasGoldKeyword, setHasGoldKeyword] = useState(false);
  const [hasMissions, setHasMissions] = useState(false);
  const [siteUrl, setSiteUrl] = useState("");

  // Checkbox states for Launch Authorization
  const [h1Checked, setH1Checked] = useState(false);
  const [keywordChecked, setKeywordChecked] = useState(false);
  const [savedChecked, setSavedChecked] = useState(false);
  const [indexingStatus, setIndexingStatus] = useState("idle"); // idle | loading | success
  const [indexingError, setIndexingError] = useState(null);

  useEffect(() => {
    const savedXp = localStorage.getItem("seojump_xp");
    if (savedXp) setXp(parseInt(savedXp, 10));
    const keyword = localStorage.getItem("gold-tu-busqueda");
    setHasGoldKeyword(!!keyword);

    const savedUrl = localStorage.getItem("seojump_site_url");
    if (savedUrl) setSiteUrl(savedUrl);

    const savedMissions = localStorage.getItem("seojump_missions");
    if (savedMissions) {
      try {
        const parsed = JSON.parse(savedMissions);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setHasMissions(true);
        }
      } catch (e) {}
    }
  }, []);

  // Auth protection only — no XP gate that redirects
  useEffect(() => {
    if (!session && status !== "loading") {
      router.push("/");
    }
  }, [session, status, router]);

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

  if (status === "loading" || !session) {
    return (
      <div className="h-screen flex items-center justify-center font-fredoka font-bold text-slate-500 text-xl bg-[#f7f7f7] dark:bg-slate-900">
        Cargando...
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center p-4 md:p-8 w-full max-w-7xl mx-auto space-y-8 bg-[#f7f7f7] dark:bg-slate-900 transition-colors duration-300 text-slate-800 dark:text-slate-100 min-h-screen relative font-fredoka">

      {/* ─── HEADER ─── */}
      <header className="w-full flex flex-col gap-4 bg-white dark:bg-slate-800 p-6 rounded-2xl border-2 border-duo-white-shadow dark:border-slate-700 sticky top-4 z-10 transition-colors duration-300">
        <div className="flex items-center justify-between">
          <Link
            href="/buscador-de-oro"
            onClick={playClick}
            className="text-slate-500 text-base md:text-lg font-black hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-2"
          >
            ← VOLVER AL DASHBOARD
          </Link>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="text-3xl">🔥</span>
              <span className="font-black text-2xl text-orange-500">{Math.floor(xp / 100) + 1}</span>
            </div>
            <button onClick={toggleMute} className="text-3xl hover:scale-110 transition-transform" title={isMuted ? "Activar sonido" : "Silenciar"}>
              {isMuted ? "🔇" : "🔊"}
            </button>
            <button onClick={() => { toggleTheme(); playThemeToggle(theme === "light"); }} className="text-3xl hover:scale-110 transition-transform">
              {theme === "light" ? "🌙" : "☀️"}
            </button>
            <button
              onClick={() => {
                playClick();
                router.push("/perfil");
              }}
              className="hover:scale-105 transition-transform focus:outline-none"
              title="Ver Perfil"
            >
              {session?.user?.image
                ? <img src={session.user.image} alt="Avatar" className="w-12 h-12 rounded-full border-2 border-duo-green-shadow" />
                : <div className="w-12 h-12 bg-duo-green rounded-full flex items-center justify-center border-b-4 border-duo-green-shadow text-white text-xl">👤</div>
              }
            </button>
          </div>
        </div>

        {/* Nav Tabs */}
        <nav className="flex flex-wrap md:flex-nowrap gap-3 md:gap-4 w-full mt-2">
          <Link href="/buscador-de-oro" onClick={playClick}
            className="flex-1 btn-3d btn-white text-slate-650 dark:text-slate-350 hover:text-duo-yellow text-center py-5 px-6 text-lg lg:text-xl font-black transition-colors">
            🔍 Fase 1: Búsqueda
          </Link>
          {hasMissions && hasGoldKeyword ? (
            <Link href="/contenido" onClick={playClick}
              className="flex-1 btn-3d btn-white text-slate-650 dark:text-slate-350 hover:text-blue-500 text-center py-5 px-6 text-lg lg:text-xl font-black transition-colors">
              ✍️ Fase 2: Contenido
            </Link>
          ) : (
            <div className="flex-1 btn-3d btn-white text-slate-400 opacity-70 cursor-not-allowed text-center py-5 px-6 text-lg lg:text-xl font-black flex items-center justify-center gap-1"
              title={!hasMissions ? "Debes cargar misiones vinculando tu Search Console primero" : "Elegí tu palabra de oro en la Fase 1 primero"}>
              🔒 Fase 2: Contenido
            </div>
          )}
          {hasMissions ? (
            <Link href="/optimizacion" onClick={playClick}
              className="flex-1 btn-3d btn-white text-slate-650 dark:text-slate-350 hover:text-duo-green text-center py-5 px-6 text-lg lg:text-xl font-black transition-colors">
              🛠️ Fase 3: Optimización
            </Link>
          ) : (
            <div className="flex-1 btn-3d btn-white text-slate-400 opacity-70 cursor-not-allowed text-center py-5 px-6 text-lg lg:text-xl font-black flex items-center justify-center gap-1"
              title="Debes cargar misiones vinculando tu Search Console primero">
              🔒 Fase 3: Optimización
            </div>
          )}
          <div className="flex-1 btn-3d bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 text-center py-5 px-6 text-lg lg:text-xl font-black border-2 border-purple-400 border-b-4 cursor-default">
            🕵️‍♂️ Fase 4: Indexación
          </div>
        </nav>
      </header>

      {/* ─── MAIN CONTENT ─── */}
      <div className="w-full flex flex-col lg:flex-row gap-8 items-start">

        {/* LEFT: Owl panel */}
        <div className="w-full lg:w-[320px] flex-shrink-0 flex flex-col gap-6 lg:sticky lg:top-44">

          {/* Level card */}
          <div className="card-3d bg-white dark:bg-slate-800 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xl font-black text-duo-yellow">NIVEL {Math.floor(xp / 100) + 1}</span>
              <span className="text-sm font-bold text-slate-500">{xp % 100} / 100 XP</span>
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
                {indexingStatus === "success" ? (
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
        <div className="flex-1 w-full flex flex-col gap-8">

          {/* Hero card */}
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

        </div>
      </div>
    </div>
  );
}
