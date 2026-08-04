'use server';

import { auth } from '../auth';
import { requireSignedIn } from './actionGuard';
import { getSiteUrl } from './siteUrl';
import {
  getWpConnectionByEmail,
  upsertWpConnection,
  updateWpConnectionStatus,
  revokeWpConnection,
} from './supabase';
import {
  generateWpToken,
  encryptWpToken,
  decryptWpToken,
  hintWpToken,
  normalizeSiteUrl,
} from './wpCrypto';
import {
  applyWpChange,
  mapMissionTypeToWpField,
  pingWpSite,
} from './wpConnector';
import { isHomePage } from './linkAudit';
import {
  extractBrandHints,
  sanitizeHubTitleSuggestion,
} from './seoTitle';

function pluginDownloadUrl(): string {
  return `${getSiteUrl()}/downloads/seo-jump-connector.zip`;
}

/**
 * Crea o regenera la conexión WordPress del usuario.
 * Devuelve el token en claro una sola vez.
 */
export async function createWpConnection(siteUrlInput: string) {
  const gate = await requireSignedIn('wp_connect', 20);
  if (gate.ok === false) {
    return { success: false as const, error: gate.error, code: gate.code };
  }

  const siteUrl = normalizeSiteUrl(siteUrlInput);
  if (!siteUrl) {
    return {
      success: false as const,
      error: 'Ingresá la URL de tu tienda. Ej: https://tutienda.com',
    };
  }

  let token: string;
  let tokenEncrypted: string;
  try {
    token = generateWpToken();
    tokenEncrypted = encryptWpToken(token);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'No se pudo generar el token.';
    return { success: false as const, error: message };
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

/** Ping al plugin y marca la conexión active/invalid. */
export async function verifyWpConnection() {
  const gate = await requireSignedIn('wp_verify', 30);
  if (gate.ok === false) {
    return { success: false as const, error: gate.error, code: gate.code };
  }

  const row = await getWpConnectionByEmail(gate.email);
  if (!row) {
    return { success: false as const, error: 'Todavía no generaste una conexión.' };
  }

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

  if (ping.seoPlugin === 'none') {
    await updateWpConnectionStatus(row.id, {
      status: 'invalid',
      plugin_version: ping.pluginVersion || null,
    });
    return {
      success: false as const,
      error:
        'El plugin responde, pero falta Yoast SEO o Rank Math en tu WordPress. Instalá uno de los dos para poder aplicar título/meta.',
      code: 'NO_SEO_PLUGIN',
    };
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
    seoPlugin: ping.seoPlugin,
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
 * Aplica título SEO o meta en WordPress.
 * Requiere conexión verificada (status active).
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
      error: 'Por ahora solo se puede aplicar automático Título y Meta descripción.',
      code: 'UNSUPPORTED',
    };
  }

  const row = await getWpConnectionByEmail(gate.email);
  if (!row || row.status === 'revoked') {
    return {
      success: false as const,
      error: 'Conectá tu WordPress desde Perfil para usar «Aplicar en mi web».',
      code: 'NOT_CONNECTED',
    };
  }
  if (row.status !== 'active') {
    return {
      success: false as const,
      error: 'Primero verificá la conexión en Perfil → Conectar WordPress.',
      code: 'NOT_VERIFIED',
    };
  }

  // Red de seguridad: nunca escribir un título de un solo producto en la HOME.
  let valueToApply = (params.value || '').trim();
  let hubCorrected = false;
  if (field === 'seo_title' && valueToApply && isHomePage(params.pageUrl, row.site_url)) {
    let siteBrand = '';
    try {
      siteBrand = new URL(row.site_url).hostname.replace(/^www\./i, '');
    } catch { /* ignore */ }
    const brandHints = extractBrandHints(valueToApply, siteBrand);
    const hub = sanitizeHubTitleSuggestion({
      suggested: valueToApply,
      currentTitle: valueToApply,
      brandHint: brandHints.find((b) => /detail/i.test(b)) || brandHints[0] || siteBrand,
      isHubPage: true,
    });
    if (hub.corrected) {
      valueToApply = hub.title;
      hubCorrected = true;
      console.warn(
        `[applyMissionToWordpress] Bloqueó título de producto en home: "${params.value}" → "${valueToApply}"`
      );
    }
  }

  const result = await applyWpChange({
    siteUrl: row.site_url,
    tokenEncrypted: row.token_encrypted,
    pageUrl: params.pageUrl,
    field,
    value: valueToApply,
  });

  if (result.ok === false) {
    if (result.code === 'UNAUTHORIZED') {
      await updateWpConnectionStatus(row.id, { status: 'invalid' });
    }
    return { success: false as const, error: result.error, code: result.code };
  }

  return {
    success: true as const,
    postId: result.postId,
    termId: result.termId,
    updated: result.updated,
    appliedValue: valueToApply,
    hubCorrected,
    message: hubCorrected
      ? 'La home no puede enfocarse en un solo producto. Aplicamos un título de catálogo/mayorista. Vaciá la caché y tocá Verificar.'
      : field === 'meta'
        ? 'Meta descripción aplicada (página, producto o categoría). Vaciá la caché y tocá Verificar.'
        : 'Título SEO aplicado (página, producto o categoría). Vaciá la caché y tocá Verificar.',
  };
}
