"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function PagoExitoPage() {
  const router = useRouter();
  const [message, setMessage] = useState("Confirmando tu suscripción PRO…");

  useEffect(() => {
    let cancelled = false;

    async function sync() {
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          const res = await fetch("/api/mobbex/sync", { method: "POST" });
          const data = await res.json();
          if (cancelled) return;

          if (data.status === "activated") {
            setMessage("¡Plan PRO activado! Redirigiendo al panel…");
            setTimeout(() => router.push("/"), 2000);
            return;
          }
          if (data.status === "pending") {
            setMessage("Pago en proceso. Te avisamos cuando se confirme.");
            return;
          }
        } catch {
          /* retry */
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
      if (!cancelled) {
        setMessage(
          "Recibimos tu pago. Si PRO no aparece en unos minutos, recargá la página o escribinos a nahuel@seo-jump.ai"
        );
      }
    }

    sync();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-fredoka flex items-center justify-center px-4">
      <div className="max-w-md text-center space-y-6">
        <div className="text-6xl">✅</div>
        <h1 className="text-3xl font-black text-white">¡Gracias por suscribirte!</h1>
        <p className="text-slate-400 font-semibold">{message}</p>
        <Link
          href="/"
          className="inline-block btn-3d btn-green font-black py-3 px-8 rounded-xl"
        >
          Ir al panel
        </Link>
      </div>
    </div>
  );
}
