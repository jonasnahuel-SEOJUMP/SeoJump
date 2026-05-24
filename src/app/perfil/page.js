"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut, signIn } from "next-auth/react";
import { useAudio } from "../../hooks/useAudio";
import { useTheme } from "../../hooks/useTheme";
import Link from "next/link";

export default function Perfil() {
  const { data: session, status } = useSession();
  const { isMuted, toggleMute, playClick, playThemeToggle } = useAudio();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();

  const [xp, setXp] = useState(0);
  const [siteUrl, setSiteUrl] = useState("");
  const [hasMissions, setHasMissions] = useState(false);

  useEffect(() => {
    // Auth protection
    if (!session && status !== "loading") {
      router.push("/");
    }
  }, [session, status, router]);

  useEffect(() => {
    const savedXp = localStorage.getItem("seojump_xp");
    if (savedXp) setXp(parseInt(savedXp, 10));

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

  if (status === "loading" || !session) {
    return (
      <div className="h-screen flex items-center justify-center font-fredoka font-bold text-slate-500 text-xl bg-[#f7f7f7] dark:bg-slate-900 transition-colors duration-300">
        Cargando...
      </div>
    );
  }

  const level = Math.floor(xp / 100) + 1;
  const xpInLevel = xp % 100;

  return (
    <div className="flex-1 flex flex-col items-center p-4 md:p-8 w-full max-w-4xl mx-auto space-y-8 bg-[#f7f7f7] dark:bg-slate-900 transition-colors duration-300 text-slate-800 dark:text-slate-100 min-h-screen relative font-fredoka">
      
      {/* ─── HEADER ─── */}
      <header className="w-full flex flex-col gap-4 bg-white dark:bg-slate-800 p-6 rounded-2xl border-2 border-duo-white-shadow dark:border-slate-700 sticky top-4 z-10 transition-colors duration-300">
        <div className="flex items-center justify-between">
          <button
            onClick={() => {
              playClick();
              router.push("/");
            }}
            className="text-slate-500 text-base md:text-lg font-black hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-2"
          >
            ← VOLVER AL DASHBOARD
          </button>
          <div className="flex items-center gap-4">
            <button onClick={toggleMute} className="text-3xl hover:scale-110 transition-transform" title={isMuted ? "Activar sonido" : "Silenciar"}>
              {isMuted ? "🔇" : "🔊"}
            </button>
            <button onClick={() => { toggleTheme(); playThemeToggle(theme === "light"); }} className="text-3xl hover:scale-110 transition-transform">
              {theme === "light" ? "🌙" : "☀️"}
            </button>
          </div>
        </div>
      </header>

      {/* ─── MAIN PERFIL CARD ─── */}
      <div className="w-full bg-white dark:bg-slate-800 rounded-3xl border-2 border-slate-200 dark:border-slate-700 shadow-2xl p-6 md:p-12 space-y-10 relative overflow-hidden transition-colors duration-300">
        <div className="absolute top-0 right-0 w-64 h-64 bg-duo-green opacity-5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-yellow-500 opacity-5 rounded-full blur-3xl -ml-16 -mb-16 pointer-events-none"></div>

        {/* User profile image, name & email */}
        <div className="flex flex-col md:flex-row items-center gap-6 md:gap-8 pb-8 border-b-2 border-dashed border-slate-200 dark:border-slate-700">
          {session.user?.image ? (
            <img
              src={session.user.image}
              alt="Avatar"
              className="w-24 h-24 md:w-32 md:h-32 rounded-full border-4 border-duo-green shadow-xl flex-shrink-0"
            />
          ) : (
            <div className="w-24 h-24 md:w-32 md:h-32 bg-duo-green rounded-full flex items-center justify-center border-b-8 border-duo-green-shadow text-white text-5xl flex-shrink-0 shadow-xl">
              👤
            </div>
          )}
          <div className="text-center md:text-left space-y-2">
            <h1 className="text-3xl md:text-4xl font-black text-slate-800 dark:text-white leading-tight">
              {session.user?.name || "Buscador de Oro"}
            </h1>
            <p className="text-sm font-bold text-slate-500 dark:text-slate-450 font-mono">
              {session.user?.email}
            </p>
            <div className="inline-block bg-duo-yellow/15 border border-duo-yellow text-duo-yellow text-xs font-black uppercase tracking-widest rounded-full px-4 py-1.5 shadow-sm">
              👑 Explorador de SEO
            </div>
          </div>
        </div>

        {/* Gamified Level & XP Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl md:text-2xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
              🔥 Nivel de Estrategia: <span className="text-orange-500">{level}</span>
            </h3>
            <span className="text-base font-bold text-slate-500 dark:text-slate-400">
              {xpInLevel} / 100 XP
            </span>
          </div>
          <div className="w-full h-8 bg-gray-150 dark:bg-slate-700 rounded-full border-2 border-slate-200 dark:border-slate-600 overflow-hidden relative shadow-inner">
            <div
              className="h-full bg-gradient-to-r from-orange-500 to-yellow-450 transition-all duration-1000 rounded-full"
              style={{ width: `${xpInLevel}%` }}
            />
            <span className="absolute inset-0 flex items-center justify-center text-xs font-black text-slate-750 dark:text-slate-100 select-none">
              Progreso del Nivel: {xpInLevel}%
            </span>
          </div>
          <p className="text-sm font-bold text-slate-500 dark:text-slate-400">
            Has acumulado un total de <span className="text-slate-850 dark:text-white font-black">{xp} XP</span> mejorando el posicionamiento de tu web.
          </p>
        </div>

        {/* Connection status card */}
        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl border-2 border-slate-100 dark:border-slate-800/80 p-6 space-y-4">
          <h3 className="text-lg font-black text-slate-800 dark:text-slate-250 flex items-center gap-2">
            📡 Integración con Google Search Console
          </h3>

          {hasMissions ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="w-4 h-4 bg-emerald-500 rounded-full animate-pulse flex-shrink-0" />
                <span className="font-black text-emerald-600 dark:text-emerald-400 text-base">
                  Cuenta Vinculada y Activa (Acceso Completo)
                </span>
              </div>
              <p className="text-sm font-bold text-slate-500 dark:text-slate-400">
                Tu propiedad está correctamente conectada a SEOJUMP. Las misiones de optimización e indexación en la Fase 4 están totalmente operativas para tu dominio:
              </p>
              <div className="bg-white dark:bg-slate-800 rounded-xl border-2 border-slate-200/60 dark:border-slate-750 p-4 font-mono font-bold text-xs select-all text-slate-650 dark:text-slate-300 break-all">
                {siteUrl}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="w-4 h-4 bg-red-500 rounded-full flex-shrink-0" />
                <span className="font-black text-red-500 text-base">
                  Search Console No Conectado
                </span>
              </div>
              <p className="text-sm font-bold text-slate-500 dark:text-slate-400 leading-relaxed">
                Aún no has conectado tu cuenta de Google Search Console con permisos completos o no pudimos encontrar ninguna propiedad que coincida con tu URL.
              </p>
              <button
                onClick={() => {
                  playClick();
                  signIn("google", {
                    authorizationParams: {
                      scope: "openid email profile https://www.googleapis.com/auth/webmasters"
                    }
                  });
                }}
                className="btn-3d bg-green-500 border-green-600 border-b-4 hover:bg-green-450 active:border-b-0 active:translate-y-1 text-white text-sm font-black py-2.5 px-6 flex items-center justify-center gap-2"
              >
                Conectar Google Search Console
              </button>
            </div>
          )}
        </div>

        {/* Action button row */}
        <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-slate-200 dark:border-slate-700">
          <button
            onClick={() => {
              playClick();
              router.push("/");
            }}
            className="flex-1 btn-3d btn-green text-center text-lg font-black py-4"
          >
            🕹️ VOLVER A JUGAR
          </button>
          <button
            onClick={() => {
              playClick();
              signOut({ callbackUrl: "/" });
            }}
            className="flex-1 btn-3d bg-red-550 border-red-700 border-b-4 hover:bg-red-500 active:border-b-0 active:translate-y-1 text-white text-lg font-black py-4"
          >
            🚪 CERRAR SESIÓN
          </button>
        </div>

      </div>
    </div>
  );
}
