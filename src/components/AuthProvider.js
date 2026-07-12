"use client";

import { Suspense } from "react";
import { SessionProvider } from "next-auth/react";
import AiCreditToast from "./AiCreditToast";
import SeoWinToast from "./SeoWinToast";
import PostHogProvider from "./PostHogProvider";

/**
 * AuthProvider — wraps the app in NextAuth's SessionProvider.
 *
 * refetchOnWindowFocus={false}: prevents NextAuth from re-validating the
 * session token every time the browser tab regains focus. Without this,
 * the new session object reference triggers every useEffect([session])
 * to re-run, causing a full state re-fetch from Supabase on every tab switch.
 *
 * refetchInterval={0}: disable periodic background polling as well.
 */
export default function AuthProvider({ children }) {
  return (
    <SessionProvider refetchOnWindowFocus={false} refetchInterval={0}>
      <Suspense fallback={null}>
        <PostHogProvider>{children}</PostHogProvider>
      </Suspense>
      <AiCreditToast />
      <SeoWinToast />
    </SessionProvider>
  );
}
