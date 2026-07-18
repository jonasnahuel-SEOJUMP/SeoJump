"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useAudio } from "../../hooks/useAudio";
import { useTheme } from "../../hooks/useTheme";
import Header from "../../components/Header";
import ComprehensionPanel from "../../components/ComprehensionPanel";

/**
 * Entrada libre al Mapa de comprensión.
 * No requiere Fase 1 ni palabra clave: cualquier usuario logueado puede
 * analizar una URL y ver qué entienden Google y las IA de su página.
 */
export default function MapaComprensionPage() {
  const { data: session, status } = useSession();
  const { isMuted, toggleMute, playClick, playThemeToggle, playSuccess } = useAudio();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();

  const [xp, setXp] = useState(0);
  const [prestigeCycles, setPrestigeCycles] = useState(0);
  const [siteUrl, setSiteUrl] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    setXp(parseInt(localStorage.getItem("seojump_xp") || "0", 10));
    setPrestigeCycles(parseInt(localStorage.getItem("seojump_prestigio_cycles") || "0", 10));
    setSiteUrl(localStorage.getItem("seojump_site_url") || "");
  }, []);

  // Auth: si no hay sesión, al inicio
  useEffect(() => {
    if (!session && status !== "loading") {
      router.push("/");
    }
  }, [session, status, router]);

  const handleMissionComplete = (missionId, gainedXp) => {
    if (typeof window === "undefined") return;
    try {
      const completed = new Set(JSON.parse(localStorage.getItem("seojump_completed_missions") || "[]"));
      if (completed.has(missionId)) return;
      completed.add(missionId);
      localStorage.setItem("seojump_completed_missions", JSON.stringify(Array.from(completed)));
      const newXp = (parseInt(localStorage.getItem("seojump_xp") || "0", 10) || 0) + (gainedXp || 40);
      localStorage.setItem("seojump_xp", String(newXp));
      setXp(newXp);
    } catch (e) {
      /* ignore */
    }
  };

  if (status === "loading" || !session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#07070d]">
        <div className="relative w-20 h-20">
          <div className="absolute inset-0 rounded-full border-4 border-cyan-500/20 animate-pulse"></div>
          <div className="absolute inset-0 rounded-full border-4 border-t-cyan-500 border-r-cyan-500/50 animate-spin"></div>
        </div>
        <h3 className="mt-6 text-xl font-black text-white uppercase tracking-wider animate-pulse">Cargando…</h3>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center p-4 md:p-8 overflow-y-auto animate-in slide-in-from-bottom duration-500 w-full max-w-7xl mx-auto space-y-8 bg-transparent transition-colors duration-300 text-slate-100 min-h-screen relative font-fredoka">
      <div className="fixed inset-0 pointer-events-none bg-glow-sapphire opacity-60 z-[-1]"></div>

      <Header
        xp={xp}
        prestigeCycles={prestigeCycles}
        isMuted={isMuted}
        toggleMute={toggleMute}
        theme={theme}
        toggleTheme={toggleTheme}
        playThemeToggle={playThemeToggle}
        playClick={playClick}
        prog={null}
        isAdmin={false}
      />

      <div className="w-full text-center space-y-4 max-w-3xl mx-auto mt-4 relative">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-cyan-500/20 blur-3xl rounded-full pointer-events-none"></div>
        <p className="text-xs md:text-sm font-black text-cyan-400 uppercase tracking-widest">Herramienta libre · sin necesidad de fases</p>
        <h1 className="text-4xl lg:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-b from-cyan-300 to-cyan-600 drop-shadow-md">
          Mapa de comprensión
        </h1>
        <p className="text-base lg:text-lg font-bold text-slate-400 leading-relaxed">
          Pegá cualquier URL de tu sitio y descubrí al instante qué entienden Google y las IA
          (ChatGPT, Gemini, Perplexity) sobre esa página — y qué le falta para que te encuentren mejor.
        </p>
      </div>

      <div className="w-full max-w-3xl mx-auto">
        <div className="rounded-2xl bg-slate-950 border border-cyan-500/20 p-4 md:p-6">
          <ComprehensionPanel
            defaultUrl={siteUrl}
            playClick={playClick}
            playSuccess={playSuccess}
            onMissionComplete={handleMissionComplete}
          />
        </div>
      </div>

      <div className="w-full max-w-3xl mx-auto text-center pt-2">
        <p className="text-sm font-bold text-slate-500">
          ¿Querés el plan completo para posicionar tu negocio?{" "}
          <Link href="/buscador-de-oro" onClick={playClick} className="text-cyan-400 hover:text-cyan-300 underline">
            Empezá por la Fase 1 →
          </Link>
        </p>
      </div>
    </div>
  );
}
