"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import NotificationBell from "./NotificationBell";

export default function Header({
  xp,
  prestigeCycles = 0,
  isMuted,
  toggleMute,
  theme,
  toggleTheme,
  playThemeToggle,
  playClick,
  prog,
  activePhase, // 1, 2, 3, or 4
  isDashboard = false,
}) {
  const { data: session } = useSession();
  const router = useRouter();

  const handleLinkClick = () => {
    if (playClick) playClick();
  };

  return (
    <header className="w-full flex flex-col gap-4 bg-white dark:bg-slate-800 p-4 md:p-6 rounded-2xl border-2 border-duo-white-shadow dark:border-slate-700 relative z-10 transition-colors duration-300 shadow-sm max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-2">
        {isDashboard ? (
          <div className="flex items-center">
            <img src="/logo.png" alt="SEOJump" className="h-8 md:h-10 object-contain" />
          </div>
        ) : (
          <Link
            href="/"
            onClick={handleLinkClick}
            className="text-slate-600 dark:text-slate-350 text-sm md:text-lg font-black hover:text-slate-850 dark:hover:text-white flex items-center gap-1.5 flex-shrink-0"
          >
            ← <span className="hidden sm:inline">VOLVER AL DASHBOARD</span>
            <span className="sm:hidden">VOLVER</span>
          </Link>
        )}

        <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
          <div className="flex items-center gap-1">
            <span className="text-2xl md:text-3xl">🔥</span>
            <span className="font-black text-lg md:text-2xl text-orange-500">
              {Math.floor((xp || 0) / 100) + 1}
            </span>
          </div>
          {prestigeCycles > 0 && (
            <span className="px-2.5 py-1 bg-gradient-to-r from-yellow-500 to-amber-600 text-slate-900 font-black text-xs rounded-full shadow-sm animate-pulse">
              🪙 Prestigio x{prestigeCycles}
            </span>
          )}
          <button
            onClick={toggleMute}
            className="text-2xl md:text-3xl hover:scale-110 transition-transform flex-shrink-0 focus:outline-none"
            title={isMuted ? "Activar sonido" : "Silenciar"}
          >
            {isMuted ? "🔇" : "🔊"}
          </button>
          <button
            onClick={() => {
              toggleTheme();
              if (playThemeToggle) playThemeToggle(theme === "light");
            }}
            className="text-2xl md:text-3xl hover:scale-110 transition-transform flex-shrink-0 focus:outline-none"
            title="Cambiar Tema"
          >
            {theme === "light" ? "🌙" : "☀️"}
          </button>
          <NotificationBell />
          <button
            onClick={() => {
              handleLinkClick();
              router.push("/perfil");
            }}
            className="hover:scale-105 transition-transform focus:outline-none flex-shrink-0"
            title="Ver Perfil"
          >
            {session?.user?.image ? (
              <img
                src={session.user.image}
                alt="Avatar"
                className="w-8 h-8 md:w-12 md:h-12 rounded-full border-2 border-duo-green-shadow"
              />
            ) : (
              <div className="w-8 h-8 md:w-12 md:h-12 bg-duo-green rounded-full flex items-center justify-center border-b-2 md:border-b-4 border-duo-green-shadow overflow-hidden p-1">
                <img src="/favicon.png" alt="SEOJump Avatar" className="w-full h-full object-contain" />
              </div>
            )}
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <nav className="flex flex-wrap md:flex-nowrap gap-2 md:gap-4 w-full mt-2">
        {/* Phase 1 */}
        {activePhase === 1 ? (
          <div className="flex-1 btn-3d bg-yellow-50 text-duo-yellow font-black text-center !py-2.5 !px-2 md:!py-5 md:!px-6 !text-xs md:!text-lg lg:!text-xl border-2 border-duo-yellow border-b-4 cursor-default">
            <span className="md:hidden">🔍 F1</span>
            <span className="hidden md:inline">🔍 Fase 1: Búsqueda</span>
          </div>
        ) : (
          <Link
            href="/buscador-de-oro"
            onClick={handleLinkClick}
            className="flex-1 btn-3d btn-white text-slate-655 dark:text-slate-350 hover:text-duo-yellow text-center !py-2.5 !px-2 md:!py-5 md:!px-6 !text-xs md:!text-lg lg:!text-xl font-black transition-colors"
          >
            <span className="md:hidden">🔍 F1</span>
            <span className="hidden md:inline">🔍 Fase 1: Búsqueda</span>
          </Link>
        )}

        {/* Phase 2 */}
        {activePhase === 2 ? (
          <div className="flex-1 btn-3d bg-blue-50 text-blue-650 font-black text-center !py-2.5 !px-2 md:!py-5 md:!px-6 !text-xs md:!text-lg lg:!text-xl border-2 border-blue-500 border-b-4 cursor-default">
            <span className="md:hidden">✍️ F2</span>
            <span className="hidden md:inline">✍️ Fase 2: Contenido</span>
          </div>
        ) : prog?.p2?.unlocked ? (
          <Link
            href="/contenido"
            onClick={handleLinkClick}
            className="flex-1 btn-3d btn-white text-slate-655 dark:text-slate-355 hover:text-blue-500 text-center !py-2.5 !px-2 md:!py-5 md:!px-6 !text-xs md:!text-lg lg:!text-xl font-black transition-colors"
          >
            <span className="md:hidden">✍️ F2</span>
            <span className="hidden md:inline">✍️ Fase 2: Contenido</span>
          </Link>
        ) : (
          <div
            className="flex-1 btn-3d btn-white text-slate-400 opacity-70 cursor-not-allowed text-center !py-2.5 !px-2 md:!py-5 md:!px-6 !text-xs md:!text-lg lg:!text-xl font-black flex items-center justify-center gap-1"
            title="🔒 Completá el 70% de la Fase 1 para avanzar"
          >
            <span className="md:hidden">🔒 F2</span>
            <span className="hidden md:inline">🔒 Fase 2: Contenido</span>
          </div>
        )}

        {/* Phase 3 */}
        {activePhase === 3 ? (
          <div className="flex-1 btn-3d bg-white text-slate-800 dark:bg-slate-800 dark:text-slate-100 text-center !py-2.5 !px-2 md:!py-5 md:!px-6 !text-xs md:!text-lg lg:!text-xl font-black border-b-4 border-duo-green cursor-default">
            <span className="md:hidden">🛠️ F3</span>
            <span className="hidden md:inline">🛠️ Fase 3: Optimización</span>
          </div>
        ) : prog?.p3?.unlocked ? (
          <Link
            href="/optimizacion"
            onClick={handleLinkClick}
            className="flex-1 btn-3d btn-white text-slate-655 dark:text-slate-350 hover:text-duo-green text-center !py-2.5 !px-2 md:!py-5 md:!px-6 !text-xs md:!text-lg lg:!text-xl font-black transition-colors"
          >
            <span className="md:hidden">🛠️ F3</span>
            <span className="hidden md:inline">🛠️ Fase 3: Optimización</span>
          </Link>
        ) : (
          <div
            className="flex-1 btn-3d btn-white text-slate-400 opacity-70 cursor-not-allowed text-center !py-2.5 !px-2 md:!py-5 md:!px-6 !text-xs md:!text-lg lg:!text-xl font-black flex items-center justify-center gap-1"
            title="🔒 Completá el 70% de la Fase 2 para avanzar"
          >
            <span className="md:hidden">🔒 F3</span>
            <span className="hidden md:inline">🔒 Fase 3: Optimización</span>
          </div>
        )}

        {/* Phase 4 */}
        {activePhase === 4 ? (
          <div className="flex-1 btn-3d bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 text-center !py-2.5 !px-2 md:!py-5 md:!px-6 !text-xs md:!text-lg lg:!text-xl font-black border-2 border-purple-400 border-b-4 cursor-default">
            <span className="md:hidden">🕵️‍♂️ F4</span>
            <span className="hidden md:inline">🕵️‍♂️ Fase 4: Detective</span>
          </div>
        ) : prog?.p4?.unlocked ? (
          <Link
            href="/detective-de-enlaces"
            onClick={handleLinkClick}
            className="flex-1 btn-3d btn-white text-slate-655 dark:text-slate-355 hover:text-purple-650 text-center !py-2.5 !px-2 md:!py-5 md:!px-6 !text-xs md:!text-lg lg:!text-xl font-black transition-colors"
          >
            <span className="md:hidden">🕵️‍♂️ F4</span>
            <span className="hidden md:inline">🕵️‍♂️ Fase 4: Detective</span>
          </Link>
        ) : (
          <div
            className="flex-1 btn-3d btn-white text-slate-400 opacity-70 cursor-not-allowed text-center !py-2.5 !px-2 md:!py-5 md:!px-6 !text-xs md:!text-lg lg:!text-xl font-black flex items-center justify-center gap-1"
            title="🔒 Completá el 70% de la Fase 3 para avanzar"
          >
            <span className="md:hidden">🔒 F4</span>
            <span className="hidden md:inline">🔒 Fase 4: Detective</span>
          </div>
        )}
      </nav>
    </header>
  );
}
