"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  createWpConnection,
  getWpConnectionStatus,
  verifyWpConnection,
  disconnectWpConnection,
} from "../lib/wpActions";

const WP_GUIDE_HREF = "/blog/conectar-wordpress-aplicar-titulo-meta";

/**
 * Panel de conexión WordPress (Perfil).
 * Flujo: generar token → instalar plugin → pegar token → verificar.
 */
export default function WpConnectPanel({ defaultSiteUrl = "", playClick }) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [siteUrl, setSiteUrl] = useState(defaultSiteUrl || "");
  const [status, setStatus] = useState(null);
  const [freshToken, setFreshToken] = useState(null);
  const [msg, setMsg] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (defaultSiteUrl && !siteUrl) setSiteUrl(defaultSiteUrl);
  }, [defaultSiteUrl, siteUrl]);

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await getWpConnectionStatus();
      setStatus(res);
      if (res.siteUrl) setSiteUrl((prev) => prev || res.siteUrl);
    } catch {
      setStatus({ success: false, connected: false });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const onCreate = async () => {
    playClick?.();
    setBusy(true);
    setMsg(null);
    setFreshToken(null);
    try {
      const res = await createWpConnection(siteUrl);
      if (!res.success) {
        setMsg({ ok: false, text: res.error });
        return;
      }
      setFreshToken(res.token);
      setMsg({
        ok: true,
        text: "Token listo. Abajo: 1) descargá el ZIP 2) copiá el token → pegalo en Ajustes → SEO Jump → Verificá acá.",
      });
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const onVerify = async () => {
    playClick?.();
    setBusy(true);
    setMsg(null);
    try {
      const res = await verifyWpConnection();
      if (!res.success) {
        setMsg({ ok: false, text: res.error });
        return;
      }
      const seo =
        res.seoPlugin === "yoast"
          ? " (Yoast)"
          : res.seoPlugin === "rankmath"
            ? " (Rank Math)"
            : "";
      setMsg({
        ok: true,
        text: `¡Conectado${res.siteName ? ` a «${res.siteName}»` : ""}${seo}! Ya podés usar «Aplicar en mi web» en misiones de título y meta (páginas, productos y categorías).`,
      });
      setFreshToken(null);
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const onDisconnect = async () => {
    playClick?.();
    if (!confirm("¿Desconectar WordPress? Vas a tener que pegar un token nuevo.")) return;
    setBusy(true);
    try {
      const res = await disconnectWpConnection();
      if (!res.success) {
        setMsg({ ok: false, text: res.error });
        return;
      }
      setFreshToken(null);
      setMsg({ ok: true, text: "Desconectado." });
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const copyToken = async () => {
    if (!freshToken) return;
    try {
      await navigator.clipboard.writeText(freshToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const downloadUrl = status?.pluginDownloadUrl || "/downloads/seo-jump-connector.zip";
  const connected = Boolean(status?.connected);
  const hasConnection = Boolean(status?.status);

  return (
    <div className="bg-sky-950/30 rounded-2xl border-2 border-sky-700/40 p-6 space-y-4">
      <h3 id="wp-connect" className="text-lg font-black text-sky-200 flex items-center gap-2 scroll-mt-24">
        🔌 Conectar WordPress
      </h3>
      <p className="text-sm font-bold text-slate-400 leading-relaxed">
        Acá conectás <span className="text-white">todo el WordPress una sola vez</span> (la URL de
        inicio de tu tienda). Después, en cada misión de título o meta,{" "}
        <span className="text-white">«Aplicar en mi web»</span> usa la URL de{" "}
        <span className="text-white">ese producto/página</span> — no la home. Solo escribe título SEO
        y meta (Yoast o Rank Math). No toca el nombre del producto ni el diseño.
      </p>
      <div className="rounded-xl bg-slate-900/60 border border-sky-700/40 px-4 py-3 space-y-2">
        <p className="text-sm font-black text-sky-200">¿Cómo conectar tu sitio?</p>
        <ol className="space-y-1.5 text-sm font-bold text-slate-300 list-decimal pl-5">
          <li>
            Abajo poné la URL de <span className="text-white">inicio</span> de tu tienda (ej.{" "}
            <span className="text-sky-300">https://tutienda.com</span>), no la de un producto.
          </li>
          <li>
            Tocá <span className="text-white">Generar token</span>, copialo, y descargá el{" "}
            <a
              href={downloadUrl}
              className="text-sky-300 underline hover:text-sky-200"
              onClick={() => playClick?.()}
            >
              plugin (.zip)
            </a>
            .
          </li>
          <li>
            En WordPress: <span className="text-white">Plugins → Añadir nuevo → Subir</span> el ZIP →
            Activar. Luego <span className="text-white">Ajustes → SEO Jump</span> → pegá el token →
            Guardar.
          </li>
          <li>
            Volvé acá y tocá <span className="text-white">Verificar conexión</span>.
          </li>
        </ol>
        <Link
          href={WP_GUIDE_HREF}
          className="inline-flex text-sm font-black text-sky-300 underline hover:text-sky-200"
          onClick={() => playClick?.()}
        >
          📖 Ver guía paso a paso completa
        </Link>
      </div>

      {loading ? (
        <p className="text-sm font-bold text-slate-500 animate-pulse">Cargando…</p>
      ) : (
        <>
          {connected ? (
            <div className="rounded-xl bg-duo-green/10 border border-duo-green/40 px-4 py-3 space-y-1">
              <p className="text-sm font-black text-duo-green">✓ WordPress conectado</p>
              <p className="text-xs font-bold text-slate-400">
                {status.siteUrl}
                {status.pluginVersion ? ` · plugin v${status.pluginVersion}` : ""}
                {status.tokenHint ? ` · token ${status.tokenHint}` : ""}
              </p>
            </div>
          ) : status?.status === "pending" || status?.status === "invalid" ? (
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/40 px-4 py-3">
              <p className="text-sm font-black text-amber-200">
                {status.status === "invalid"
                  ? "Conexión inválida — regenerá el token o verificá de nuevo"
                  : "Token generado — falta verificar el plugin"}
              </p>
              {status.siteUrl && (
                <p className="text-xs font-bold text-slate-400 mt-1">{status.siteUrl}</p>
              )}
            </div>
          ) : (
            <p className="text-sm font-bold text-slate-500">Todavía no conectaste WordPress.</p>
          )}

          <p className="text-xs font-bold text-slate-500">
            Necesitás Yoast SEO o Rank Math (casi todas las tiendas ya lo tienen).
          </p>

          <label className="block space-y-1.5">
            <span className="text-xs font-black uppercase tracking-wide text-sky-300">
              URL de tu tienda (inicio del sitio)
            </span>
            <input
              type="url"
              placeholder="https://tutienda.com"
              value={siteUrl}
              onChange={(e) => setSiteUrl(e.target.value)}
              className="w-full p-3 rounded-xl border-2 border-slate-600 bg-slate-800 text-white font-bold text-sm"
              disabled={busy}
            />
            <span className="block text-xs font-bold text-slate-500 leading-snug">
              Va la home (ej. https://tutienda.com), no un producto. Cada misión aplica el cambio a
              su propia URL cuando tocás «Aplicar en mi web».
            </span>
          </label>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={busy || !siteUrl.trim()}
              onClick={onCreate}
              className="btn-3d btn-blue !py-2.5 !px-5 !text-sm !normal-case disabled:opacity-50"
            >
              {busy ? "…" : hasConnection ? "Regenerar token" : "Generar token"}
            </button>
            <button
              type="button"
              disabled={busy || (!hasConnection && !freshToken)}
              onClick={onVerify}
              className="btn-3d btn-green !py-2.5 !px-5 !text-sm !normal-case disabled:opacity-50"
            >
              Verificar conexión
            </button>
            {hasConnection && (
              <button
                type="button"
                disabled={busy}
                onClick={onDisconnect}
                className="btn-3d !py-2.5 !px-5 !text-sm !normal-case bg-slate-700 text-slate-200 disabled:opacity-50"
              >
                Desconectar
              </button>
            )}
          </div>

          {freshToken && (
            <div className="rounded-xl bg-slate-900 border-2 border-sky-500/50 p-4 space-y-3">
              <div className="space-y-2">
                <p className="text-xs font-black text-sky-300 uppercase">
                  1) Descargá el plugin (archivo ZIP)
                </p>
                <a
                  href={downloadUrl}
                  className="btn-3d btn-blue !py-2 !px-4 !text-xs !normal-case inline-block"
                  onClick={() => playClick?.()}
                >
                  Descargar seo-jump-connector.zip
                </a>
                <p className="text-[11px] font-bold text-slate-500">
                  En WordPress: Plugins → Añadir nuevo → Subir plugin → elegí este archivo → Activar.
                </p>
              </div>
              <div className="space-y-2 border-t border-slate-700 pt-3">
                <p className="text-xs font-black text-sky-300 uppercase">
                  2) Copiá el token (pegálo en Ajustes → SEO Jump)
                </p>
                <code className="block text-sm font-mono text-white break-all bg-black/40 rounded-lg p-3">
                  {freshToken}
                </code>
                <button
                  type="button"
                  onClick={copyToken}
                  className="btn-3d btn-green !py-2 !px-4 !text-xs !normal-case"
                >
                  {copied ? "✓ Copiado" : "Copiar token"}
                </button>
                <p className="text-[11px] font-bold text-slate-500">
                  El token completo solo se muestra ahora. Si lo perdés, regeneralo.
                </p>
              </div>
            </div>
          )}

          {msg && (
            <p className={`text-sm font-bold ${msg.ok ? "text-duo-green" : "text-red-400"}`}>
              {msg.text}
            </p>
          )}
        </>
      )}
    </div>
  );
}
