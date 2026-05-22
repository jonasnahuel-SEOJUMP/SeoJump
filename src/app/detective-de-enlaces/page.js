"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useAudio } from "../../hooks/useAudio";
import { useTheme } from "../../hooks/useTheme";

export default function DetectiveDeEnlaces() {
  const { data: session, status } = useSession();
  const { isMuted, toggleMute, playClick, playThemeToggle } = useAudio();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();

  const [xp, setXp] = useState(0);
  const [hasGoldKeyword, setHasGoldKeyword] = useState(false);

  useEffect(() => {
    const savedXp = localStorage.getItem("seojump_xp");
    if (savedXp) setXp(parseInt(savedXp, 10));
    const keyword = localStorage.getItem("gold-tu-busqueda");
    setHasGoldKeyword(!!keyword);
  }, []);

  // Auth protection only — no XP gate that redirects
  useEffect(() => {
    if (!session && status !== "loading") {
      router.push("/");
    }
  }, [session, status, router]);

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
            {session?.user?.image
              ? <img src={session.user.image} alt="Avatar" className="w-12 h-12 rounded-full border-2 border-duo-green-shadow" />
              : <div className="w-12 h-12 bg-duo-green rounded-full flex items-center justify-center border-b-4 border-duo-green-shadow text-white text-xl">👤</div>
            }
          </div>
        </div>

        {/* Nav Tabs */}
        <nav className="flex flex-wrap md:flex-nowrap gap-3 md:gap-4 w-full mt-2">
          <Link href="/buscador-de-oro" onClick={playClick}
            className="flex-1 btn-3d btn-white text-slate-650 dark:text-slate-300 hover:text-duo-yellow text-center py-5 px-6 text-lg lg:text-xl font-black transition-colors">
            🔍 Fase 1: Búsqueda
          </Link>
          {hasGoldKeyword ? (
            <Link href="/contenido" onClick={playClick}
              className="flex-1 btn-3d btn-white text-slate-650 dark:text-slate-300 hover:text-blue-500 text-center py-5 px-6 text-lg lg:text-xl font-black transition-colors">
              ✍️ Fase 2: Contenido
            </Link>
          ) : (
            <div className="flex-1 btn-3d btn-white text-slate-400 opacity-70 cursor-not-allowed text-center py-5 px-6 text-lg lg:text-xl font-black flex items-center justify-center"
              title="Elegí tu palabra de oro en la Fase 1 primero">
              🔒 Fase 2: Contenido
            </div>
          )}
          <Link href="/optimizacion" onClick={playClick}
            className="flex-1 btn-3d btn-white text-slate-650 dark:text-slate-300 hover:text-duo-green text-center py-5 px-6 text-lg lg:text-xl font-black transition-colors">
            🛠️ Fase 3: Optimización
          </Link>
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

          {/* Locked badge */}
          <div className="card-3d bg-slate-800 text-white border-slate-700 p-6 text-center space-y-4 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full bg-purple-900/20 pointer-events-none" />
            <div className="text-6xl animate-pulse relative z-10">🔒</div>
            <h3 className="text-lg font-black text-purple-300 relative z-10">Contenido Premium</h3>
            <p className="text-sm font-bold text-slate-400 leading-relaxed relative z-10">
              Esta fase se desbloquea en la versión oficial. Seguí sumando XP en las fases anteriores.
            </p>
            <div className="w-full bg-slate-700 rounded-full h-3 border border-slate-600 relative z-10">
              <div className="h-full bg-purple-500 rounded-full" style={{ width: `${Math.min((xp / 500) * 100, 100)}%` }} />
            </div>
            <p className="text-xs font-black text-slate-500 relative z-10">{xp} / 500 XP acumulados</p>
          </div>

          {/* Go back CTA */}
          <Link href="/optimizacion" onClick={playClick}
            className="btn-3d btn-green w-full text-center text-lg font-black py-4">
            🛠️ SEGUIR EN FASE 3
          </Link>
        </div>

        {/* CENTER: Coming soon hero */}
        <div className="flex-1 w-full flex flex-col gap-8">

          {/* Hero card */}
          <div className="w-full bg-slate-900 rounded-3xl border-2 border-slate-700 shadow-2xl overflow-hidden relative">
            {/* Glow decoration */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-purple-700 opacity-10 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-700 opacity-10 rounded-full blur-3xl -ml-20 -mb-20 pointer-events-none" />

            <div className="relative z-10 p-8 md:p-12 flex flex-col items-center text-center gap-8">
              {/* Detective icon cluster */}
              <div className="relative">
                <div className="text-9xl filter drop-shadow-2xl animate-pulse">🕵️‍♂️</div>
                <div className="absolute -bottom-2 -right-4 text-5xl">🔗</div>
                <div className="absolute -top-2 -left-4 text-4xl opacity-60">🔍</div>
              </div>

              {/* Badge */}
              <div className="inline-flex items-center gap-2 bg-purple-900/50 border border-purple-600/50 rounded-full px-5 py-2">
                <span className="w-2 h-2 bg-purple-400 rounded-full animate-pulse" />
                <span className="text-sm font-black text-purple-300 tracking-widest uppercase">Próximamente · Versión Premium</span>
              </div>

              {/* Title */}
              <div className="space-y-3">
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-white leading-tight">
                  🕵️‍♂️ Detective de <span className="text-purple-400">Enlaces</span>
                </h1>
                <p className="text-xl md:text-2xl font-black text-purple-300">
                  Fase 4 — Indexación & Search Console
                </p>
              </div>

              {/* Owl message */}
              <div className="w-full max-w-2xl bg-slate-800/80 rounded-2xl border border-slate-700 p-6 md:p-8 flex gap-5 items-start text-left">
                <div className="text-5xl md:text-6xl animate-bounce flex-shrink-0">🦉</div>
                <div className="space-y-3">
                  <p className="text-base md:text-lg font-bold text-slate-200 leading-relaxed">
                    En esta fase vas a poder conectar tu{" "}
                    <span className="text-green-400 font-black">Google Search Console</span>{" "}
                    para enviar tus URLs modificadas directo a los servidores de Google con un solo clic,{" "}
                    <span className="text-purple-400 font-black">indexando tus páginas en minutos</span>{" "}
                    y midiendo tus clics reales en este tablero.
                  </p>
                  <p className="text-base md:text-lg font-black text-yellow-400">
                    ¡Seguí sumando XP en las fases anteriores para tener tu chasis listo! 🏎️
                  </p>
                </div>
              </div>

              {/* Feature preview grid */}
              <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
                {[
                  { icon: "⚡", color: "text-yellow-400", title: "Indexación Express", desc: "Enviá URLs a Google en segundos, sin esperar semanas." },
                  { icon: "📊", color: "text-blue-400", title: "Métricas Reales", desc: "Clics, impresiones y posición directamente de Search Console." },
                  { icon: "🔗", color: "text-purple-400", title: "Detector de 404", desc: "Encontrá links rotos antes de que Google te penalice." },
                ].map(({ icon, color, title, desc }) => (
                  <div key={title} className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-5 space-y-2">
                    <div className={`text-4xl ${color}`}>{icon}</div>
                    <h3 className="text-lg font-black text-white">{title}</h3>
                    <p className="text-sm font-bold text-slate-400 leading-relaxed">{desc}</p>
                    <div className="inline-flex items-center gap-1.5 bg-slate-700/50 rounded-lg px-3 py-1">
                      <span className="w-1.5 h-1.5 bg-purple-400 rounded-full" />
                      <span className="text-xs font-black text-slate-400">Próximamente</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* CTA to earlier phases */}
              <div className="flex flex-col sm:flex-row gap-4 w-full max-w-lg">
                <Link href="/optimizacion" onClick={playClick}
                  className="flex-1 btn-3d btn-green text-center text-xl font-black py-4">
                  🛠️ IR A FASE 3
                </Link>
                <Link href="/buscador-de-oro" onClick={playClick}
                  className="flex-1 btn-3d btn-white text-slate-700 dark:text-slate-200 text-center text-xl font-black py-4">
                  🔍 IR A FASE 1
                </Link>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
