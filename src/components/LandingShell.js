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

  return (
    <div className="min-h-screen bg-[#07070d] w-full font-fredoka relative transition-colors duration-300">
      <LandingPage
        onStart={() => {
          playClick();
          signIn("google");
        }}
        playClick={playClick}
        onShowPrivacy={() => setShowPrivacyModal(true)}
        onShowTerms={() => setShowTermsModal(true)}
      />
      {showPrivacyModal && (
        <PrivacyModal onClose={() => setShowPrivacyModal(false)} playClick={playClick} />
      )}
      {showTermsModal && (
        <TermsModal onClose={() => setShowTermsModal(false)} playClick={playClick} />
      )}
    </div>
  );
}
