"use client";

import LandingPage from "../../components/LandingPage";
import { useAudio } from "../../hooks/useAudio";

/**
 * Landing dedicada para ads / campañas del Espía de la Competencia.
 * Misma UI que la home (variant spy). El cajón de URL va a /comenzar?spy=1&url=…
 * vía form GET (Route Handler), sin lógica de sesión acá.
 */
export default function EspiaCompetenciaPage() {
  const { playClick } = useAudio();

  return (
    <div className="min-h-screen bg-[#07070d] w-full font-fredoka">
      <LandingPage playClick={playClick} variant="spy" />
    </div>
  );
}
