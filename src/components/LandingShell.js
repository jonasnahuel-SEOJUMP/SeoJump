"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import LandingPage from "./LandingPage";
import PrivacyModal from "./PrivacyModal";
import TermsModal from "./TermsModal";
import { useAudio } from "../hooks/useAudio";

/** Landing pública — visitantes sin sesión y crawlers (HTML renderizado en servidor). */
export default function LandingShell() {
  const { playClick } = useAudio();
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);

  // onRegister se dispara desde el diagnóstico gratuito (PublicComprehension),
  // ya en pleno uso con JS activo, así que un signIn de cliente es seguro acá.
  const handleRegister = () => {
    try {
      playClick();
    } catch {
      /* ignore */
    }
    signIn("google", { callbackUrl: "/" });
  };

  return (
    <div className="min-h-screen bg-[#07070d] w-full font-fredoka relative transition-colors duration-300">
      <LandingPage onRegister={handleRegister} playClick={playClick} />
      {showPrivacyModal && (
        <PrivacyModal onClose={() => setShowPrivacyModal(false)} playClick={playClick} />
      )}
      {showTermsModal && (
        <TermsModal onClose={() => setShowTermsModal(false)} playClick={playClick} />
      )}
    </div>
  );
}
