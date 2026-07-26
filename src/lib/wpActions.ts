'use server';

import { auth } from '../auth';
import { requireSignedIn } from './actionGuard';
import {
  getWpConnectionByEmail,
  upsertWpConnection,
  updateWpConnectionStatus,
  revokeWpConnection,
} from './supabase';
import {
  generateWpToken,
  encryptWpToken,
  hintWpToken,
  normalizeSiteUrl,
} from './wpCrypto';
import {
  applyWpChange,
  mapMissionTypeToWpField,
  pingWpSite,
  type WpApplyField,
} from './wpConnector';

function pluginDownloadUrl(): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ||
    process.env.NEXTAUTH_URL?.replace(/\/$/, '') ||
    'https://seo-jump.ai';
  return `${base}/downloads/seo-jump-connector.zip`;
}

/**
 * Crea (o regenera) una conexión WordPress y devuelve el token en claro UNA vez.
 */
export async function createWpConnection(siteUrlInput: string) {
  const gate = await requireSignedIn('wp_connect', 20);
  if (gate.ok === false) {
    return { success: false as const, error: gate.error, code: gate.code };
  }

  const siteUrl = normalizeSiteUrl(siteUrlInput);
  if (!siteUrl) {
    return { success: false as const, error: 'Ingresá la URL de tu tienda. Ej: https://tutienda.com' };
  }

  let token: string;
  let tokenEncrypted: string;
  try {
    token = generateWpToken();
    tokenEncrypted = encryptWpToken(token);
  } catch (err: any) {
    return { success: false as const, error: err?.message || 'No se pudo generar el token.' };
  }

  const row = await upsertWpConnection({
    email: gate.email,
    siteUrl,
    tokenEncrypted,
    tokenHint: hintWpToken(token),
    status: 'pending',
  });

  if (!row) {
    return {
      success: false as const,
      error: 'No pudimos guardar la conexión. ¿Corriste la migración 007 en Supabase?',
    };
  }

  return {
    success: true as const,
    siteUrl,
    token,
    tokenHint: hintWpToken(token),
    pluginDownloadUrl: pluginDownloadUrl(),
    status: row.status,
  };
}

/** Estado de la conexión (sin exponer el token). */
export async function getWpConnectionStatus() {
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) {
    return { success: false as const, connected: false, error: 'Tenés que iniciar sesión.' };
  }

  const row = await getWpConnectionByEmail(email);
  if (!row) {
    return {
      success: true as const,
      connected: false,
      pluginDownloadUrl: pluginDownloadUrl(),
    };
  }

  return {
    success: true as const,
    connected: row.status === 'active',
    status: row.status,
    siteUrl: row.site_url,
    tokenHint: row.token_hint,
    pluginVersion: row.plugin_version,
    lastVerifiedAt: row.last_verified_at,
    pluginDownloadUrl: pluginDownloadUrl(),
  };
}

/** Verifica ping al plugin y marca la conexión como active/invalid. */
export async function verifyWpConnection() {
  const gate = await requireSignedIn('wp_verify', 30);
  if (gate.ok === false) {
    return { success: false as const, error: gate.error, code: gate.code };
  }

  const row = await getWpConnectionByEmail(gate.email);
  if (!row) {
    return { success: false as const, error: 'Todavía no generaste una conexión.' };
  }

  const { decryptWpToken } = await import('./wpCrypto');
  let token: string;
  try {
    token = decryptWpToken(row.token_encrypted);
  } catch {
    return { success: false as const, error: 'Token corrupto. Regenerá la conexión.' };
  }

  const ping = await pingWpSite(row.site_url, token);
  if (ping.ok === false) {
    await updateWpConnectionStatus(row.id, { status: 'invalid' });
    return { success: false as const, error: ping.error, code: ping.code };
  }

  await updateWpConnectionStatus(row.id, {
    status: 'active',
    plugin_version: ping.pluginVersion || null,
    last_verified_at: new Date().toISOString(),
  });

  return {
    success: true as const,
    siteName: ping.siteName,
    pluginVersion: ping.pluginVersion,
    siteUrl: row.site_url,
  };
}

export async function disconnectWpConnection() {
  const gate = await requireSignedIn('wp_disconnect', 20);
  if (gate.ok === false) {
    return { success: false as const, error: gate.error, code: gate.code };
  }
  const ok = await revokeWpConnection(gate.email);
  if (!ok) {
    return { success: false as const, error: 'No se pudo desconectar.' };
  }
  return { success: true as const };
}

/**
 * Aplica título SEO / meta en WordPress vía el plugin.
 * missionType: H1 → title, META → meta.
 */
export async function applyMissionToWordpress(params: {
  pageUrl: string;
  missionType: string;
  value: string;
}) {
  const gate = await requireSignedIn('wp_apply', 60);
  if (gate.ok === false) {
    return { success: false as const, error: gate.error, code: gate.code };
  }

  const field = mapMissionTypeToWpField(params.missionType);
  if (!field) {
    return {
      success: false as const,
      error: 'Por ahora solo se puede aplicar automático Título/H1 y Meta descripción.',
      code: 'UNSUPPORTED',
    };
  }

  const row = await getWpConnectionByEmail(gate.email);
  if (!row) {
    return {
      success: false as const,
      error: 'Conectá tu WordPress desde Perfil para usar «Aplicar en mi web».',
      code: 'NOT_CONNECTED',
    };
  }
  if (row.status !== 'active' && row.status !== 'pending') {
    return {
      success: false as const,
      error: 'Tu conexión WordPress no está activa. Verificá el plugin desde Perfil.',
      code: 'INACTIVE',
    };
  }

  const result = await applyWpChange({
    siteUrl: row.site_url,
    tokenEncrypted: row.token_encrypted,
    pageUrl: params.pageUrl,
    field: field as WpApplyField,
    value: params.value,
  });

  if (result.ok === false) {
    if (result.code === 'UNAUTHORIZED') {
      await updateWpConnectionStatus(row.id, { status: 'invalid' });
    }
    return { success: false as const, error: result.error, code: result.code };
  }

  // Si estaba pending y aplicó bien, marcar active
  if (row.status !== 'active') {
    await updateWpConnectionStatus(row.id, {
      status: 'active',
      last_verified_at: new Date().toISOString(),
    });
  }

  return {
    success: true as const,
    postId: result.postId,
    updated: result.updated,
    message:
      field === 'meta'
        ? 'Meta descripción aplicada en tu WordPress. Vaciá la caché y tocá Verificar.'
        : 'Título aplicado en tu WordPress. Vaciá la caché y tocá Verificar.',
  };
}
