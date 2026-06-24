"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut, signIn } from "next-auth/react";
import { useAudio } from "../../hooks/useAudio";
import { useTheme } from "../../hooks/useTheme";
import { deleteUserAccount, activateUserPlan } from "../../lib/actions";
import { clearLocalUserData } from "../../lib/clearUserData";
import { useSubscription } from "../../hooks/useSubscription";
import { formatPlanExpiry } from "../../lib/subscription";
import Link from "next/link";

export default function Perfil() {
  const { data: session, status } = useSession();
  const { isMuted, toggleMute, playClick, playThemeToggle } = useAudio();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();

  const [xp, setXp] = useState(0);
  const [siteUrl, setSiteUrl] = useState("");
  const [hasMissions, setHasMissions] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const {
    plan,
    planLabel,
    hasPremiumAccess,
    isAdmin,
    subscriptionExpiresAt,
    credits,
    loading: planLoading,
    refresh: refreshPlan,
  } = useSubscription();
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPlan, setAdminPlan] = useState("pro");
  const [adminMonths, setAdminMonths] = useState(1);
  const [adminMsg, setAdminMsg] = useState(null);
  const [adminLoading, setAdminLoading] = useState(false);

  useEffect(() => {
    const savedXp = localStorage.getItem("seojump_xp");
    if (savedXp) setXp(parseInt(savedXp, 10));

    const savedUrl = localStorage.getItem("seojump_site_url");
    if (savedUrl) setSiteUrl(savedUrl);

    const savedMissions = localStorage.getItem("seojump_missions");
    if (savedMissions) {
      try {
        const parsed = JSON.parse(savedMissions);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setHasMissions(true);
        }
      } catch (e) {}
    }
  }, []);

  if (status === "loading") {
    return (
      <div className="h-screen flex items-center justify-center font-fredoka font-bold text-slate-400 text-xl bg-[#07070d] transition-colors duration-300">
        Cargando...
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-[#07070d] font-fredoka text-slate-200 px-4 py-16 flex flex-col items-center">
        <div className="max-w-lg w-full space-y-8 text-center">
          <Link href="/" className="text-emerald-400 hover:underline text-sm font-bold inline-block">
            ← Volver al inicio
          </Link>
          <div className="space-y-4">
            <div className="text-6xl">👤</div>
            <h1 className="text-3xl font-black text-white">Tu Perfil</h1>
            <p className="text-sm font-bold text-slate-400 leading-relaxed">
              Acá podés ver tu progreso, gestionar la conexión con Search Console y{" "}
              <strong className="text-white">eliminar tu cuenta y borrar tus datos</strong>.
              Para acceder, primero tenés que iniciar sesión con la misma cuenta de Google que usaste en SEO Jump.
            </p>
          </div>
          <button
            onClick={() => {
              playClick();
              signIn("google", { callbackUrl: "/perfil" });
            }}
            className="btn-3d btn-green w-full text-lg font-black py-4"
          >
            Iniciar sesión con Google
          </button>
          <p className="text-xs font-bold text-slate-500">
            Si no podés entrar, escribinos a{" "}
            <a href="mailto:nahuel@seo-jump.ai" className="text-emerald-400 underline">nahuel@seo-jump.ai</a>
            {" "}para solicitar el borrado de tus datos.
          </p>
        </div>
      </div>
    );
  }

  const level = Math.floor(xp / 100) + 1;
  const xpInLevel = xp % 100;

  const handleDeleteAccount = async () => {
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      const result = await deleteUserAccount();
      if (!result.success) {
        setDeleteError(result.error || "No se pudieron borrar los datos. Escribinos a nahuel@seo-jump.ai");
        return;
      }
      clearLocalUserData();
      setShowDeleteModal(false);
      await signOut({ callbackUrl: "/" });
    } catch (e) {
      setDeleteError("Ocurrió un error. Intentá de nuevo o escribinos a nahuel@seo-jump.ai");
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center p-4 md:p-8 w-full max-w-4xl mx-auto space-y-8 bg-transparent transition-colors duration-300 text-slate-100 min-h-screen relative font-fredoka">
      
      {/* ─── HEADER ─── */}
      <header className="w-full flex flex-col gap-4 bg-white dark:bg-slate-800 p-4 md:p-6 rounded-2xl border-2 border-duo-white-shadow dark:border-slate-700 sticky top-4 z-10 transition-colors duration-300">
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={() => {
              playClick();
              router.push("/");
            }}
            className="text-slate-600 dark:text-slate-350 text-sm md:text-lg font-black hover:text-slate-850 dark:hover:text-white flex items-center gap-1.5 flex-shrink-0"
          >
            ← <span className="hidden sm:inline">VOLVER AL DASHBOARD</span><span className="sm:hidden">VOLVER</span>
          </button>
          <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
            <button onClick={toggleMute} className="text-2xl md:text-3xl hover:scale-110 transition-transform flex-shrink-0" title={isMuted ? "Activar sonido" : "Silenciar"}>
              {isMuted ? "🔇" : "🔊"}
            </button>
            <button onClick={() => { toggleTheme(); playThemeToggle(theme === "light"); }} className="text-2xl md:text-3xl hover:scale-110 transition-transform flex-shrink-0">
              {theme === "light" ? "🌙" : "☀️"}
            </button>
          </div>
        </div>
      </header>

      {/* ─── MAIN PERFIL CARD ─── */}
      <div className="w-full bg-white dark:bg-slate-800 rounded-3xl border-2 border-slate-200 dark:border-slate-700 shadow-2xl p-6 md:p-12 space-y-10 relative overflow-hidden transition-colors duration-300">
        <div className="absolute top-0 right-0 w-64 h-64 bg-duo-green opacity-5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-yellow-500 opacity-5 rounded-full blur-3xl -ml-16 -mb-16 pointer-events-none"></div>

        {/* User profile image, name & email */}
        <div className="flex flex-col md:flex-row items-center gap-6 md:gap-8 pb-8 border-b-2 border-dashed border-slate-200 dark:border-slate-700">
          {session.user?.image ? (
            <img
              src={session.user.image}
              alt="Avatar"
              className="w-24 h-24 md:w-32 md:h-32 rounded-full border-4 border-duo-green shadow-xl flex-shrink-0"
            />
          ) : (
            <div className="w-24 h-24 md:w-32 md:h-32 bg-duo-green rounded-full flex items-center justify-center border-b-8 border-duo-green-shadow text-white text-5xl flex-shrink-0 shadow-xl">
              👤
            </div>
          )}
          <div className="text-center md:text-left space-y-2">
            <h1 className="text-3xl md:text-4xl font-black text-slate-800 dark:text-white leading-tight">
              {session.user?.name || "Buscador de Oro"}
            </h1>
            <p className="text-sm font-bold text-slate-500 dark:text-slate-450 font-mono">
              {session.user?.email}
            </p>
            <div className={`inline-block text-xs font-black uppercase tracking-widest rounded-full px-4 py-1.5 shadow-sm border ${
              hasPremiumAccess
                ? "bg-duo-green/15 border-duo-green text-duo-green"
                : "bg-duo-yellow/15 border-duo-yellow text-duo-yellow"
            }`}>
              {planLoading ? "…" : hasPremiumAccess ? `⭐ Plan ${planLabel}` : "🆓 Plan Gratis"}
            </div>
          </div>
        </div>

        {/* Plan y créditos IA */}
        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl border-2 border-slate-100 dark:border-slate-800/80 p-6 space-y-4">
          <h3 className="text-lg font-black text-slate-800 dark:text-slate-250 flex items-center gap-2">
            💳 Tu plan SEO Jump
          </h3>
          {planLoading ? (
            <p className="text-sm font-bold text-slate-500 animate-pulse">Cargando plan...</p>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-2xl font-black text-slate-800 dark:text-white">{planLabel}</span>
                {hasPremiumAccess && (
                  <span className="text-xs font-black px-2 py-1 rounded-full bg-duo-green/20 text-duo-green border border-duo-green/40">
                    Misiones desbloqueadas
                  </span>
                )}
                {isAdmin && (
                  <span className="text-xs font-black px-2 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40">
                    Admin
                  </span>
                )}
              </div>
              {subscriptionExpiresAt && (
                <p className="text-sm font-bold text-slate-500 dark:text-slate-400">
                  Válido hasta: {formatPlanExpiry(subscriptionExpiresAt)}
                </p>
              )}
              {credits && !credits.isUnlimited && (
                <p className="text-sm font-bold text-slate-500 dark:text-slate-400">
                  Consultas IA hoy: {credits.usedToday} / {credits.limitDay} — este mes: {credits.usedMonth} / {credits.limitMonth}
                </p>
              )}
              {credits?.isUnlimited && (
                <p className="text-sm font-bold text-duo-green">Consultas IA ilimitadas (admin)</p>
              )}
              {!hasPremiumAccess && (
                <Link href="/precios" onClick={playClick} className="btn-3d btn-green inline-block text-sm font-black py-2.5 px-5">
                  Ver planes PRO y Agencia
                </Link>
              )}
              <p className="text-xs font-bold text-slate-500 dark:text-slate-500">
                El cobro con Mobbex está en preparación para Argentina. En local, sin credenciales, el botón PRO activa el plan en modo prueba. Dudas: nahuel@seo-jump.ai.
              </p>
            </div>
          )}
        </div>

        {/* Panel admin: activar planes manualmente (backup si falla webhook) */}
        {isAdmin && (
          <div className="bg-purple-950/30 rounded-2xl border-2 border-purple-700/50 p-6 space-y-4">
            <h3 className="text-lg font-black text-purple-200">🛠️ Admin — activar plan</h3>
            <p className="text-sm font-bold text-slate-400">
              Asigná PRO o Agencia a un usuario por email. El pago automático vía Mobbex también activa PRO al confirmarse.
            </p>
            <input
              type="email"
              placeholder="email@usuario.com"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              className="w-full p-3 rounded-xl border-2 border-slate-600 bg-slate-800 text-white font-bold text-sm"
            />
            <div className="flex flex-wrap gap-3">
              <select
                value={adminPlan}
                onChange={(e) => setAdminPlan(e.target.value)}
                className="p-3 rounded-xl border-2 border-slate-600 bg-slate-800 text-white font-bold text-sm"
              >
                <option value="free">Gratis</option>
                <option value="pro">PRO</option>
                <option value="agency">Agencia</option>
              </select>
              <select
                value={adminMonths}
                onChange={(e) => setAdminMonths(Number(e.target.value))}
                className="p-3 rounded-xl border-2 border-slate-600 bg-slate-800 text-white font-bold text-sm"
                disabled={adminPlan === "free"}
              >
                <option value={1}>1 mes</option>
                <option value={3}>3 meses</option>
                <option value={12}>12 meses</option>
              </select>
              <button
                type="button"
                disabled={adminLoading || !adminEmail.trim()}
                onClick={async () => {
                  playClick();
                  setAdminLoading(true);
                  setAdminMsg(null);
                  const res = await activateUserPlan(adminEmail.trim(), adminPlan, adminMonths);
                  setAdminLoading(false);
                  if (res.success) {
                    setAdminMsg({ ok: true, text: `Plan ${adminPlan} activado para ${adminEmail}` });
                    refreshPlan();
                  } else {
                    setAdminMsg({ ok: false, text: res.error || "Error" });
                  }
                }}
                className="btn-3d btn-green text-sm font-black py-2.5 px-5 disabled:opacity-50"
              >
                {adminLoading ? "Guardando..." : "Activar plan"}
              </button>
            </div>
            {adminMsg && (
              <p className={`text-sm font-bold ${adminMsg.ok ? "text-duo-green" : "text-red-400"}`}>
                {adminMsg.text}
              </p>
            )}
          </div>
        )}

        {/* Gamified Level & XP Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl md:text-2xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
              🔥 Nivel de Estrategia: <span className="text-orange-500">{level}</span>
            </h3>
            <span className="text-base font-bold text-slate-500 dark:text-slate-400">
              {xpInLevel} / 100 XP
            </span>
          </div>
          <div className="w-full h-8 bg-gray-150 dark:bg-slate-700 rounded-full border-2 border-slate-200 dark:border-slate-600 overflow-hidden relative shadow-inner">
            <div
              className="h-full bg-gradient-to-r from-orange-500 to-yellow-450 transition-all duration-1000 rounded-full"
              style={{ width: `${xpInLevel}%` }}
            />
            <span className="absolute inset-0 flex items-center justify-center text-xs font-black text-slate-750 dark:text-slate-100 select-none">
              Progreso del Nivel: {xpInLevel}%
            </span>
          </div>
          <p className="text-sm font-bold text-slate-500 dark:text-slate-400">
            Has acumulado un total de <span className="text-slate-850 dark:text-white font-black">{xp} XP</span> mejorando el posicionamiento de tu web.
          </p>
        </div>

        {/* Connection status card */}
        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl border-2 border-slate-100 dark:border-slate-800/80 p-6 space-y-4">
          <h3 className="text-lg font-black text-slate-800 dark:text-slate-250 flex items-center gap-2">
            📡 Integración con Google Search Console
          </h3>

          {hasMissions ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="w-4 h-4 bg-emerald-500 rounded-full animate-pulse flex-shrink-0" />
                <span className="font-black text-emerald-600 dark:text-emerald-400 text-base">
                  Cuenta Vinculada y Activa (Acceso Completo)
                </span>
              </div>
              <p className="text-sm font-bold text-slate-500 dark:text-slate-400">
                Tu propiedad está correctamente conectada a SEOJUMP. Las misiones de optimización e indexación en la Fase 4 están totalmente operativas para tu dominio:
              </p>
              <div className="bg-white dark:bg-slate-800 rounded-xl border-2 border-slate-200/60 dark:border-slate-750 p-4 font-mono font-bold text-xs select-all text-slate-650 dark:text-slate-300 break-all">
                {siteUrl}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="w-4 h-4 bg-red-500 rounded-full flex-shrink-0" />
                <span className="font-black text-red-500 text-base">
                  Search Console No Conectado
                </span>
              </div>
              <p className="text-sm font-bold text-slate-500 dark:text-slate-400 leading-relaxed">
                Aún no has conectado tu cuenta de Google Search Console con permisos completos o no pudimos encontrar ninguna propiedad que coincida con tu URL.
              </p>
              <button
                onClick={() => {
                  playClick();
                  signIn("google", {
                    callbackUrl: "/perfil",
                    authorizationParams: {
                      scope: "openid email profile https://www.googleapis.com/auth/webmasters"
                    }
                  });
                }}
                className="btn-3d bg-green-500 border-green-600 border-b-4 hover:bg-green-450 active:border-b-0 active:translate-y-1 text-white text-sm font-black py-2.5 px-6 flex items-center justify-center gap-2"
              >
                Conectar Google Search Console
              </button>
            </div>
          )}
        </div>

        {/* Zona de privacidad */}
        <div className="bg-red-50 dark:bg-red-950/20 rounded-2xl border-2 border-red-200 dark:border-red-900/50 p-6 space-y-4">
          <h3 className="text-lg font-black text-red-700 dark:text-red-400 flex items-center gap-2">
            🔒 Privacidad y datos
          </h3>
          <p className="text-sm font-bold text-slate-600 dark:text-slate-400 leading-relaxed">
            Podés revocar el acceso a Google Search Console desde{" "}
            <a
              href="https://myaccount.google.com/permissions"
              target="_blank"
              rel="noopener noreferrer"
              className="text-red-600 dark:text-red-400 underline"
            >
              tu cuenta de Google
            </a>
            . Si querés que borremos también tu progreso guardado en SEO Jump (misiones, XP, sitio vinculado), usá el botón de abajo.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href="/privacidad"
              onClick={playClick}
              className="text-sm font-black text-slate-600 dark:text-slate-300 underline hover:text-slate-800 dark:hover:text-white"
            >
              Leer Política de Privacidad
            </Link>
            <button
              onClick={() => { playClick(); setDeleteError(null); setShowDeleteModal(true); }}
              className="text-sm font-black text-red-600 dark:text-red-400 underline hover:text-red-700 dark:hover:text-red-300 text-left"
            >
              Eliminar mi cuenta y borrar mis datos
            </button>
          </div>
        </div>

        {/* Action button row */}
        <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-slate-200 dark:border-slate-700">
          <button
            onClick={() => {
              playClick();
              router.push("/");
            }}
            className="flex-1 btn-3d btn-green text-center text-lg font-black py-4"
          >
            🕹️ VOLVER A JUGAR
          </button>
          <button
            onClick={() => {
              playClick();
              signOut({ callbackUrl: "/" });
            }}
            className="flex-1 btn-3d bg-red-550 border-red-700 border-b-4 hover:bg-red-500 active:border-b-0 active:translate-y-1 text-white text-lg font-black py-4"
          >
            🚪 CERRAR SESIÓN
          </button>
        </div>

      </div>

      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-3xl border-2 border-red-300 dark:border-red-800 p-6 md:p-8 max-w-md w-full shadow-2xl space-y-5">
            <h2 className="text-2xl font-black text-red-600 dark:text-red-400">¿Eliminar tu cuenta?</h2>
            <p className="text-sm font-bold text-slate-600 dark:text-slate-300 leading-relaxed">
              Se borrarán de forma permanente:
            </p>
            <ul className="text-sm font-bold text-slate-500 dark:text-slate-400 list-disc pl-5 space-y-1">
              <li>Tu perfil y misiones completadas en nuestros servidores</li>
              <li>Tu progreso, XP y sitio guardado en este navegador</li>
            </ul>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-450">
              Esto no cancela una suscripción de Mobbex si la tuvieras activa — hacelo aparte en Mobbex o contactándonos. Para revocar el acceso a Google, andá a{" "}
              <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer" className="text-red-500 underline">myaccount.google.com/permissions</a>.
            </p>
            {deleteError && (
              <p className="text-sm font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 rounded-xl p-3">{deleteError}</p>
            )}
            <div className="flex flex-col gap-3 pt-2">
              <button
                onClick={handleDeleteAccount}
                disabled={deleteLoading}
                className="btn-3d bg-red-600 border-red-800 border-b-4 hover:bg-red-550 text-white font-black py-3 disabled:opacity-60"
              >
                {deleteLoading ? "Borrando..." : "Sí, eliminar mis datos"}
              </button>
              <button
                onClick={() => { playClick(); setShowDeleteModal(false); setDeleteError(null); }}
                disabled={deleteLoading}
                className="btn-3d btn-white text-slate-700 font-black py-3"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
