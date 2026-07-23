"use client";

import { useSession, signIn } from "next-auth/react";
import LandingPage from "../../components/LandingPage";
import { SPY_CALLBACK_PATH, spyGoogleSignInHref } from "../../lib/spyCta";
import { useAudio } from "../../hooks/useAudio";

/**
 * Landing dedicada para ads / campañas del Espía de la Competencia.
 * Misma UI que la home; CTA de usuarios logueados va directo al Detective.
 */
export default function EspiaCompetenciaPage() {
  const { data: session, status } = useSession();
  const { playClick } = useAudio();

  const handleStart = () => {
    try {
      playClick();
    } catch {
      /* ignore */
    }
    if (status === "authenticated" && session?.user) {
      window.location.href = SPY_CALLBACK_PATH;
      return;
    }
    signIn("google", { callbackUrl: SPY_CALLBACK_PATH });
  };

  return (
    <div className="min-h-screen bg-[#07070d] w-full font-fredoka">
      <LandingPage
        onStart={handleStart}
        onStartSpy={handleStart}
        spyHref={spyGoogleSignInHref()}
        playClick={playClick}
        variant="spy"
      />
    </div>
  );
}
