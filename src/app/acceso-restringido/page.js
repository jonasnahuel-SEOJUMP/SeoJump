"use client";

import Link from "next/link";

export default function AccesoRestringido() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center space-y-8 animate-in fade-in zoom-in-95 duration-500">

        {/* Owl logo */}
        <div className="flex justify-center">
          <img
            src="/images/logo-owl.png"
            alt="SEO Jump"
            className="w-20 h-20 object-contain opacity-80"
          />
        </div>

        {/* Lock icon */}
        <div className="text-7xl select-none">🔒</div>

        {/* Card */}
        <div className="bg-slate-900 border-2 border-slate-700 rounded-3xl p-8 shadow-2xl space-y-5">
          <h1 className="text-2xl md:text-3xl font-black text-white leading-tight">
            Acceso exclusivo para<br />
            <span className="text-amber-400">Beta Testers</span>
          </h1>

          <p className="text-slate-300 font-bold text-sm md:text-base leading-relaxed">
            SEO Jump se encuentra en etapa de pruebas cerrada.
            Tu cuenta de Google no está en la lista de acceso autorizado por el momento.
          </p>

          <div className="bg-amber-950/40 border border-amber-600/40 rounded-2xl px-5 py-4">
            <p className="text-amber-300 font-bold text-sm leading-relaxed">
              ¿Querés sumarte a las pruebas?<br />
              <span className="text-amber-200 font-black">
                Ponete en contacto con el administrador para solicitar acceso.
              </span>
            </p>
          </div>

          <Link
            href="/"
            className="inline-flex items-center gap-2 text-slate-400 hover:text-amber-400 font-black text-sm transition-colors uppercase tracking-wider"
          >
            ← Volver al inicio
          </Link>
        </div>

        {/* Footer */}
        <p className="text-slate-600 text-xs font-bold">
          SEO Jump · Beta Privada
        </p>

      </div>
    </div>
  );
}
