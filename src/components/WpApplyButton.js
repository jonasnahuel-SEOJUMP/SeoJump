"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  applyMissionToWordpress,
  getWpConnectionStatus,
} from "../lib/wpActions";

/**
 * Botón «Aplicar automáticamente» para misiones de Título SEO (tipo H1) / META.
 * Escribe seo_title o meta vía el plugin — nunca toca Nombre ni slug.
 * Si no hay WordPress conectado, invita a Perfil.
 */
export default function WpApplyButton({
  missionType,
  pageUrl,
  value,
  playClick,
}) {
  const canApply = missionType === "H1" || missionType === "META";
  const [connected, setConnected] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [applying, setApplying] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    if (!canApply) {
      setLoadingStatus(false);
      return;
    }
    let cancelled = false;
    setLoadingStatus(true);
    getWpConnectionStatus()
      .then((res) => {
        if (!cancelled) setConnected(Boolean(res?.connected));
      })
      .catch(() => {
        if (!cancelled) setConnected(false);
      })
      .finally(() => {
        if (!cancelled) setLoadingStatus(false);
      });
    return () => {
      cancelled = true;
    };
  }, [canApply]);

  useEffect(() => {
    setMessage(null);
  }, [pageUrl, value, missionType]);

  if (!canApply) return null;

  if (loadingStatus) {
    return (
      <span className="text-xs font-bold text-slate-500 self-center px-2">
        …
      </span>
    );
  }

  if (!connected) {
    return (
      <Link
        href="/perfil#wp-connect"
        onClick={() => playClick?.()}
        className="btn-3d !py-2.5 !px-5 !text-sm !normal-case !tracking-normal w-full sm:w-auto bg-slate-700 text-sky-200 text-center"
      >
        🔌 Conectar WordPress
      </Link>
    );
  }

  return (
    <div className="flex flex-col gap-1 w-full sm:w-auto">
      <button
        type="button"
        disabled={applying || !value?.trim() || !pageUrl}
        onClick={async (e) => {
          e?.stopPropagation?.();
          playClick?.();
          setApplying(true);
          setMessage(null);
          try {
            const res = await applyMissionToWordpress({
              pageUrl,
              missionType,
              value,
            });
            if (!res.success) {
              const hint =
                res.code === "NOT_FOUND"
                  ? " Si es una categoría, descargá de nuevo el plugin desde Perfil (v1.2+) y reemplazalo en WordPress → Plugins → Subir."
                  : "";
              setMessage({ ok: false, text: (res.error || "No se pudo aplicar.") + hint });
              return;
            }
            setMessage({
              ok: true,
              text: res.message || "Aplicado.",
            });
          } catch {
            setMessage({
              ok: false,
              text: "No se pudo aplicar. Probá de nuevo o usá Copiar.",
            });
          } finally {
            setApplying(false);
          }
        }}
        className="btn-3d btn-green !py-3 !px-6 !text-sm !normal-case !tracking-normal w-full sm:w-auto disabled:opacity-50 shadow-lg"
      >
        {applying ? "Aplicando…" : "🚀 Aplicar automáticamente (recomendado)"}
      </button>
      <p className="text-[11px] font-bold text-duo-green/90 leading-snug max-w-xs">
        Escribe solo el Título SEO / meta en Rank Math o Yoast. No toca Nombre, slug ni URL.
      </p>
      {message && (
        <p className={`text-xs font-bold ${message.ok ? "text-duo-green" : "text-amber-300"}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}
