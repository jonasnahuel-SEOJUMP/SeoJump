"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { getUserPlanForSession } from "../lib/actions";

/**
 * Lee el plan desde Supabase (subscription_status).
 * Reemplaza localStorage isPremium — listo para cuando Mercado Pago actualice el plan.
 */
export function useSubscription() {
  const { data: session, status } = useSession();
  const [planSnapshot, setPlanSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    if (!session?.user?.email) {
      setPlanSnapshot(null);
      setLoading(false);
      return Promise.resolve(null);
    }
    setLoading(true);
    return getUserPlanForSession()
      .then((data) => {
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
