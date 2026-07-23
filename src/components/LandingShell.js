"use client";

import { useState } from "react";
import { signIn, useSession } from "next-auth/react";
import LandingPage from "./LandingPage";
import PrivacyModal from "./PrivacyModal";
import TermsModal from "./TermsModal";
import { useAudio } from "../hooks/useAudio";
import { SPY_CALLBACK_PATH, spyGoogleSignInHref } from "../lib/spyCta";

/** Landing pública — visitantes sin sesión y crawlers (HTML renderizado en servidor). */
export default function LandingShell() {
  const { playClick } = useAudio();
  const { data: session, status } = useSession();
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);

  const startApp = () => {
    try {
      playClick();
    } catch {
      /* ignore audio */
    }
    if (status === "authenticated" && session?.user) {
      window.location.href = "/";
      return;
    }
    signIn("google", { callbackUrl: "/" });
  };

  const startSpy = () => {
    try {
      playClick();
    } catch {
      /* ignore audio */
    }
    if (status === "authenticated" && session?.user) {
      window.location.href = SPY_CALLBACK_PATH;
      return;
    }
    Promise.resolve(signIn("google", { callbackUrl: SPY_CALLBACK_PATH })).catch(() => {
      window.location.href = spyGoogleSignInHref();
    });
  };

  return (
    <div className="min-h-screen bg-[#07070d] w-full font-fredoka relative transition-colors duration-300">
      <LandingPage
        onStart={startApp}
        onStartSpy={startSpy}
        spyHref={spyGoogleSignInHref()}
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
