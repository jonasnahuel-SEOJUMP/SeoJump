"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { getUserPlanForSession } from "../lib/actions";
import { notifyAiCreditUsed } from "../lib/aiCreditToast";

/**
 * Lee el plan desde Supabase (subscription_status).
 * Plan y créditos IA desde Supabase (Mercado Pago / Stripe actualizan subscription_status).
 */
export function useSubscription() {
  const { data: session, status } = useSession();
  const [planSnapshot, setPlanSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const prevUsedTodayRef = useRef(null);

  const refresh = useCallback(() => {
    if (!session?.user?.email) {
      setPlanSnapshot(null);
      setLoading(false);
      prevUsedTodayRef.current = null;
      return Promise.resolve(null);
    }
    setLoading(true);
    return getUserPlanForSession()
      .then((data) => {
        if (data?.credits) {
          const used = data.credits.usedToday;
          const prev = prevUsedTodayRef.current;
          if (prev !== null && used > prev) {
            notifyAiCreditUsed(data.credits);
          }
          prevUsedTodayRef.current = used;
        }
        setPlanSnapshot(data);
        return data;
      })
      .catch(() => {
        setPlanSnapshot(null);
        return null;
      })
      .finally(() => setLoading(false));
  }, [session?.user?.email]);

  useEffect(() => {
    if (status === "loading") return;
    refresh();
  }, [status, refresh]);

  return {
    plan: planSnapshot?.plan ?? "free",
    planLabel: planSnapshot?.planLabel ?? "Gratis",
    hasPremiumAccess: planSnapshot?.hasPremiumAccess ?? false,
    isAdmin: planSnapshot?.isAdmin ?? false,
    subscriptionExpiresAt: planSnapshot?.subscriptionExpiresAt ?? null,
    credits: planSnapshot?.credits ?? null,
    loading,
    refresh,
  };
}
