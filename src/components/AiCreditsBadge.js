"use client";

import Link from "next/link";

export default function AiCreditsBadge({ credits, loading, compact = false }) {
  if (loading) {
    return (
      <div className="text-xs font-bold text-slate-400 animate-pulse">
        Consultas IA…
      </div>
    );
  }

  if (!credits) return null;

  if (credits.isUnlimited) {
    return (
      <span className="text-xs font-black text-green-600 dark:text-green-400 uppercase tracking-wider">
        IA ilimitada
      </span>
    );
  }

  const used = credits.usedToday;
  const limit = credits.limitDay;
  const remaining = credits.remainingToday;
  const low = remaining <= 1 && remaining > 0;
  const empty = remaining === 0;

  const color = empty
    ? "text-red-500 dark:text-red-400 border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/40"
    : low
      ? "text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40"
      : "text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/60";

  if (compact) {
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-black ${color}`}>
        🤖 {used}/{limit}
      </span>
    );
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 px-3 py-2 rounded-xl border ${color}`}>
      <span className="text-xs font-black uppercase tracking-wider">
        Consultas IA hoy: {used}/{limit}
      </span>
      <span className="text-xs font-bold opacity-80">
        Plan {credits.planLabel}
      </span>
      {empty && (
        <Link href="/precios" className="text-xs font-black underline hover:no-underline">
          Ver PRO
        </Link>
      )}
    </div>
  );
}
