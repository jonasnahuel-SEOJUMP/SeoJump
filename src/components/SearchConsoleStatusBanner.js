"use client";

import { useCallback, useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { checkSearchConsoleStatus } from "../lib/actions";

const GSC_CONSOLE_URL = "https://search.google.com/search-console/welcome";

/**
 * Banner inteligente de estado de Search Console.
 * Detecta el caso real y adapta el mensaje (sin bloquear el uso de la app):
 *  - no_scope    → falta el permiso → botón para reconectar con Google (OAuth)
 *  - no_property → permiso OK pero el sitio no está dado de alta → guía paso a paso
 *  - connected   → no muestra nada
 */
export default function SearchConsoleStatusBanner({ siteUrl, playClick, callbackUrl = "/" }) {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);
  const [properties, setProperties] = useState([]);

  const runCheck = useCallback(() => {
    if (!siteUrl) {
      setStatus("no_site");
      setLoading(false);
      return;
    }
    setLoading(true);
    checkSearchConsoleStatus(siteUrl)
      .then((res) => {
        setStatus(res.status);
        setProperties(res.properties || []);
      })
      .catch(() => setStatus("error"))
      .finally(() => setLoading(false));
  }, [siteUrl]);

  useEffect(() => {
    let cancelled = false;
    if (!siteUrl) {
      setStatus("no_site");
      setLoading(false);
      return;
    }
    setLoading(true);
    checkSearchConsoleStatus(siteUrl)
      .then((res) => {
        if (cancelled) return;
        setStatus(res.status);
        setProperties(res.properties || []);
      })
      .catch(() => { if (!cancelled) setStatus("error"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [siteUrl]);

  // No molestar: nada mientras carga, si ya está conectado o ante estados no accionables.
  if (loading || status === "connected" || status === "no_site" || status === "error" || !status) {
    return null;
  }

  const reconnect = () => {
    if (playClick) playClick();
    signIn("google", {
      callbackUrl,
      authorizationParams: { scope: "openid email profile https://www.googleapis.com/auth/webmasters" },
    });
  };

  // ── CASO 1: falta el permiso de Search Console ──────────────────────────────
  if (status === "no_scope") {
    return (
      <div className="card-3d p-5 md:p-6 border-2 border-amber-500/40 bg-gradient-to-br from-amber-950/30 to-slate-900/60 space-y-4">
        <div className="flex items-start gap-3">
          <span className="text-3xl flex-shrink-0">🚀</span>
          <div className="space-y-1">
            <h3 className="text-lg md:text-xl font-black text-amber-200">
              Conectá Search Console y trabajá con datos reales de Google
            </h3>
            <p className="text-sm font-bold text-slate-300 leading-relaxed">
              Por ahora armamos tus misiones mirando tu web. Cuando conectes <span className="text-amber-200">Google Search Console</span> (es gratis y de solo lectura), vas a ver por qué búsquedas ya aparecés, cuáles están a un paso de la primera página y dónde estás dejando ventas sobre la mesa.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl bg-slate-900/60 border border-slate-700/60 p-3">
            <p className="text-xs font-black text-emerald-300 uppercase tracking-wide mb-1">📈 Más ventas</p>
            <p className="text-xs font-bold text-slate-400 leading-snug">Detectamos las páginas a punto de explotar en Google para que les des el empujón final.</p>
          </div>
          <div className="rounded-xl bg-slate-900/60 border border-slate-700/60 p-3">
            <p className="text-xs font-black text-sky-300 uppercase tracking-wide mb-1">🎯 Datos reales</p>
            <p className="text-xs font-bold text-slate-400 leading-snug">Dejás de adivinar: ves las búsquedas exactas por las que te encuentran tus clientes.</p>
          </div>
          <div className="rounded-xl bg-slate-900/60 border border-slate-700/60 p-3">
            <p className="text-xs font-black text-purple-300 uppercase tracking-wide mb-1">🤖 Te cita la IA (AEO)</p>
            <p className="text-xs font-bold text-slate-400 leading-snug">Que ChatGPT y Google IA te recomienden es el nuevo aparecer primero. Y vale cada vez más.</p>
          </div>
        </div>

        <button
          onClick={reconnect}
          className="w-full btn-3d bg-green-500 border-green-600 border-b-4 hover:bg-green-450 active:border-b-0 active:translate-y-1 text-white text-sm md:text-base font-black py-3 flex items-center justify-center gap-2"
        >
          🔓 Conectar Search Console y desbloquear datos reales
        </button>
        <p className="text-[11px] font-bold text-slate-500 text-center">
          Conexión 100% segura y de solo lectura. Nunca modificamos tu sitio.
        </p>
      </div>
    );
  }

  // ── CASO 2: permiso OK pero el sitio no está dado de alta en Search Console ──
  return (
    <div className="card-3d p-5 md:p-6 border-2 border-sky-500/40 bg-gradient-to-br from-sky-950/30 to-slate-900/60 space-y-4">
      <div className="flex items-start gap-3">
        <span className="text-3xl flex-shrink-0">🔑</span>
        <div className="space-y-1">
          <h3 className="text-lg md:text-xl font-black text-sky-200">
            Permiso concedido ✅ — falta dar de alta tu sitio en Search Console
          </h3>
          <p className="text-sm font-bold text-slate-300 leading-relaxed">
            Nos diste acceso, pero tu sitio todavía no figura como propiedad verificada en tu Search Console. Por eso, mientras tanto, trabajamos con los datos de tu web. Darlo de alta es gratis y se hace una sola vez:
          </p>
        </div>
      </div>

      <ol className="list-decimal list-inside space-y-1.5 text-sm font-bold text-slate-300 bg-slate-900/50 border border-slate-700/60 rounded-xl p-4">
        <li>Entrá a <span className="text-sky-300">Google Search Console</span> con el mismo Gmail.</li>
        <li>Agregá una propiedad tipo <span className="text-sky-300">Prefijo de URL</span> y pegá tu dirección exacta.</li>
        <li>Verificá que sos el dueño (Google te ofrece varios métodos: etiqueta HTML, DNS, etc.).</li>
        <li>Volvé acá y tocá <span className="text-sky-300">"Ya lo di de alta"</span>.</li>
      </ol>

      {properties.length > 0 && (
        <div className="rounded-xl bg-amber-950/30 border border-amber-700/50 p-3">
          <p className="text-xs font-black text-amber-300 uppercase tracking-wide mb-1">💡 Ojo con esto</p>
          <p className="text-xs font-bold text-slate-400 leading-snug">
            En tu cuenta ya hay {properties.length === 1 ? "una propiedad" : "estas propiedades"}: <span className="text-slate-300">{properties.join(" · ")}</span>. Si alguna es tu sitio, revisá que coincida exactamente (con o sin <span className="text-slate-300">www</span>, <span className="text-slate-300">http</span> vs <span className="text-slate-300">https</span>) o cargalo como <span className="text-slate-300">propiedad de Dominio</span>.
          </p>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <a
          href={GSC_CONSOLE_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => { if (playClick) playClick(); }}
          className="flex-1 btn-3d bg-sky-500 border-sky-600 border-b-4 hover:bg-sky-450 active:border-b-0 active:translate-y-1 text-white text-sm md:text-base font-black py-3 flex items-center justify-center gap-2 text-center"
        >
          🔗 Abrir Search Console
        </a>
        <button
          onClick={() => { if (playClick) playClick(); runCheck(); }}
          className="flex-1 btn-3d btn-white text-sm font-black py-3 text-slate-600 hover:text-sky-600"
        >
          🔄 Ya lo di de alta — verificar
        </button>
      </div>
      <p className="text-[11px] font-bold text-slate-500 text-center">
        Tranquilo: podés seguir usando todas las misiones igual. Esto solo suma datos reales de Google.
      </p>
    </div>
  );
}
