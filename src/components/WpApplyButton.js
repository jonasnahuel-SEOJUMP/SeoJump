"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  applyMissionToWordpress,
  getWpConnectionStatus,
} from "../lib/wpActions";

/**
 * Botón «Aplicar en mi web» para misiones H1 / META.
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
              setMessage({ ok: false, text: res.error });
              return;
            }
            setMessage({
              ok: true,
              text:
                (res.message || "Aplicado.") +
                (pageUrl ? ` Página: ${pageUrl}` : ""),
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
        className="btn-3d btn-blue !py-2.5 !px-5 !text-sm !normal-case !tracking-normal w-full sm:w-auto disabled:opacity-50"
      >
        {applying ? "Aplicando…" : "🚀 Aplicar en mi web"}
      </button>
      {message && (
        <p className={`text-xs font-bold ${message.ok ? "text-duo-green" : "text-amber-300"}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}
