/** Dispara toast global cuando se consume una consulta IA. */
export function notifyAiCreditUsed(credits) {
  if (typeof window === "undefined" || !credits || credits.isUnlimited) return;

  window.dispatchEvent(
    new CustomEvent("seojump:ai-credit-used", {
      detail: {
        used: credits.usedToday,
        limit: credits.limitDay,
        plan: credits.planLabel,
      },
    })
  );
}
