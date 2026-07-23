"use client";

import LandingPage from "../../components/LandingPage";
import { useAudio } from "../../hooks/useAudio";

/**
 * Landing dedicada para ads / campañas del Espía de la Competencia.
 * Misma UI que la home (variant spy). Los CTA de entrada usan Server Actions
 * dentro de LandingPage, así que no hace falta lógica de sesión acá.
 */
export default function EspiaCompetenciaPage() {
  const { playClick } = useAudio();

  return (
    <div className="min-h-screen bg-[#07070d] w-full font-fredoka">
      <LandingPage playClick={playClick} variant="spy" />
    </div>
  );
}
