"use client";

import { useSession, signIn } from "next-auth/react";
import LandingPage from "../../components/LandingPage";
import { useAudio } from "../../hooks/useAudio";

/**
 * Landing dedicada para ads / campañas del Espía de la Competencia.
 * Misma UI que la home; CTA de usuarios logueados va directo al Detective.
 */
export default function EspiaCompetenciaPage() {
  const { data: session } = useSession();
  const { playClick } = useAudio();

  const handleStart = () => {
    playClick();
    if (!session) {
      signIn("google");
      return;
    }
    window.location.href = "/detective-de-enlaces?view=spy";
  };

  return (
    <div className="min-h-screen bg-[#07070d] w-full font-fredoka">
      <LandingPage onStart={handleStart} playClick={playClick} />
    </div>
  );
}
