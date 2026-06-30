"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

function getPreapprovalIdFromPage() {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  return (
    params.get("preapproval_id") ||
    params.get("preapprovalId") ||
    sessionStorage.getItem("seojump_mp_preapproval_id") ||
    null
  );
}

export default function PagoExitoPage() {
  const router = useRouter();
  const [message, setMessage] = useState("Confirmando tu suscripción PRO…");
  const [syncing, setSyncing] = useState(true);

  const runSync = useCallback(async () => {
    setSyncing(true);
    setMessage("Confirmando tu suscripción PRO…");
    const preapprovalId = getPreapprovalIdFromPage();

    for (let attempt = 0; attempt < 8; attempt++) {
      try {
        const res = await fetch("/api/mercadopago/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(preapprovalId ? { preapprovalId } : {}),
        });
        const data = await res.json();

        if (data.status === "activated") {
          try {
            sessionStorage.removeItem("seojump_mp_preapproval_id");
          } catch {
            /* ignore */
          }
          setMessage("¡Plan PRO activado! Redirigiendo al panel…");
          setSyncing(false);
          setTimeout(() => router.push("/?plan=pro"), 1500);
          return;
        }
        if (data.status === "pending") {
          setMessage("Pago en proceso. Te avisamos cuando se confirme.");
          setSyncing(false);
          return;
        }
      } catch {
        /* retry */
      }
      await new Promise((r) => setTimeout(r, 2000));
    }

    setMessage(
      "Recibimos tu pago. Tocá «Reintentar activación» o escribinos a nahuel@seo-jump.ai"
    );
    setSyncing(false);
  }, [router]);

  useEffect(() => {
    runSync();
  }, [runSync]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-fredoka flex items-center justify-center px-4">
      <div className="max-w-md text-center space-y-6">
        <div className="text-6xl">✅</div>
        <h1 className="text-3xl font-black text-white">¡Gracias por suscribirte!</h1>
        <p className="text-slate-400 font-semibold">{message}</p>
        <div className="flex flex-col gap-3">
          {!syncing && (
            <button
              type="button"
              onClick={runSync}
              className="btn-3d btn-green font-black py-3 px-8 rounded-xl"
            >
              Reintentar activación
            </button>
          )}
          <Link
            href="/"
            className="inline-block text-sm font-bold text-slate-400 hover:text-white"
          >
            Ir al panel
          </Link>
        </div>
      </div>
    </div>
  );
}
