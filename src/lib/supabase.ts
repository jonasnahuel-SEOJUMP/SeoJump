/**
 * src/lib/supabase.ts
 *
 * Clientes de Supabase para SEO Jump.
 *
 * ARQUITECTURA (Opción A):
 *   - La autenticación sigue siendo NextAuth + Google.
 *   - Supabase actúa solo como base de datos relacional.
 *   - El email de la sesión NextAuth es el identificador de usuario.
 *
 * DOS CLIENTES:
 *   - supabasePublic  → usa la ANON KEY (segura para el cliente/browser)
 *   - supabaseAdmin   → usa la SERVICE ROLE KEY (solo servidor, bypasea RLS)
 *
 * GUARD DE CONFIGURACIÓN:
 *   - Si las variables de entorno no están definidas, ambos clientes
 *     son `null` y las funciones que los usan devuelven un error
 *     controlado en lugar de romper el build o el runtime.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type Profile = {
  id: string;
  email: string;
  business_name: string | null;
  website_url: string | null;
  subscription_status: 'free' | 'pro' | 'agency';
  subscription_expires_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type MissionStatus = 'pending' | 'completed' | 'skipped';
export type MissionType = 'H1' | 'META' | 'ALT' | 'QUICK_WIN' | 'AEO_OPP' | 'AEO';

export type UserMission = {
  id: string;
  user_id: string;
  mission_type: MissionType;
  target_url: string;
  gold_keyword: string | null;
  status: MissionStatus;
  suggested_value: string | null;
  completed_at: string | null;
  xp_awarded: number;
  created_at: string;
  baseline_position?: number | null;
  baseline_clicks?: number | null;
  baseline_impressions?: number | null;
  win_notified_at?: string | null;
};

export type MissionBaselineInput = {
  gold_keyword?: string | null;
  baseline_position?: number | null;
  baseline_clicks?: number | null;
  baseline_impressions?: number | null;
};

// ─── Configuración ───────────────────────────────────────────────────────────

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

const isConfigured = Boolean(supabaseUrl && supabaseAnon);

if (!isConfigured) {
  console.warn(
    '[Supabase] Variables de entorno no configuradas. ' +
    'Agregá NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY al .env.local. ' +
    'La persistencia en la nube está desactivada hasta tanto.'
  );
}

// ─── Cliente público (anon key — safe for browser) ───────────────────────────

export const supabasePublic: SupabaseClient | null = isConfigured
  ? createClient(supabaseUrl!, supabaseAnon!)
  : null;

// ─── Cliente admin (service role — SOLO SERVIDOR) ────────────────────────────
// ⚠️ NUNCA importar este cliente desde un componente de React o un archivo
//    con 'use client'. Solo usarlo en Server Actions y Route Handlers.

export const supabaseAdmin: SupabaseClient | null =
  isConfigured && supabaseServiceRole
    ? createClient(supabaseUrl!, supabaseServiceRole, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      })
    : null;

// ─── Helpers de base de datos ────────────────────────────────────────────────

/**
 * Obtiene o crea el perfil de un usuario por email.
 * Upsert: si existe lo devuelve, si no lo crea con los datos proporcionados.
 *
 * @param email        Email de la sesión NextAuth (identificador único)
 * @param websiteUrl   URL del sitio (opcional, se actualiza si viene)
 * @param businessName Nombre de la PyME (opcional)
 */
export async function upsertProfile(
  email: string,
  websiteUrl?: string,
  businessName?: string
): Promise<Profile | null> {
  if (!supabaseAdmin) {
    console.warn('[Supabase] supabaseAdmin no disponible — Supabase no está configurado.');
    return null;
  }

  const { data, error } = await supabaseAdmin.rpc('upsert_profile', {
    p_email: email,
    p_website_url: websiteUrl ?? null,
    p_business_name: businessName ?? null,
  });

  if (error) {
    console.error('[Supabase] Error en upsert_profile:', error.message);
    return null;
  }

  return data as Profile;
}

/**
 * Obtiene todas las misiones de un usuario por su email.
 * Filtra por status si se proporciona.
 */
export async function getMissionsByEmail(
  email: string,
  status?: MissionStatus
): Promise<UserMission[]> {
  if (!supabaseAdmin) return [];

  // Primero obtener el profile id por email
  const { data: profile, error: profileErr } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('email', email)
    .single();

  if (profileErr || !profile) return [];

  let query = supabaseAdmin
    .from('user_missions')
    .select('*')
    .eq('user_id', profile.id);

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[Supabase] Error en getMissionsByEmail:', error.message);
    return [];
  }

  return (data ?? []) as UserMission[];
}

/**
 * Marca una misión como completada.
 * Si la misión no existe, la crea directamente como 'completed'.
 *
 * @param email       Email del usuario (sesión NextAuth)
 * @param missionType Tipo de misión
 * @param targetUrl   URL objetivo
 * @param xpAwarded   XP a otorgar
 * @param suggestedValue Valor sugerido por la IA
 */
export async function completeMission(
  email: string,
  missionType: MissionType,
  targetUrl: string,
  xpAwarded: number = 0,
  suggestedValue?: string,
  baseline?: MissionBaselineInput
): Promise<UserMission | null> {
  if (!supabaseAdmin) {
    console.warn('[Supabase] completeMission: Supabase no configurado, operación ignorada.');
    return null;
  }

  // Auto-crear o actualizar perfil (upsert) para que la primera misión
  // completada no falle por falta de registro en la tabla profiles.
  const { data: profileRow, error: rpcErr } = await supabaseAdmin.rpc('upsert_profile', {
    p_email: email,
    p_website_url: null,
    p_business_name: null,
  });

  if (rpcErr) {
    console.error('[Supabase] completeMission: Error en upsert_profile para:', email, '—', rpcErr.message, '| code:', rpcErr.code);
    return null;
  }

  const profile = profileRow as Profile | null;
  if (!profile?.id) {
    console.error('[Supabase] completeMission: El RPC upsert_profile no devolvió un profile válido para:', email, '| data recibida:', JSON.stringify(profileRow));
    return null;
  }

  console.log(`[Supabase] completeMission: guardando misión ${missionType} para ${email} (profile.id: ${profile.id}), url: ${targetUrl}`);

  const { data, error } = await supabaseAdmin
    .from('user_missions')
    .upsert(
      {
        user_id: profile.id,
        mission_type: missionType,
        target_url: targetUrl,
        status: 'completed',
        completed_at: new Date().toISOString(),
        xp_awarded: xpAwarded,
        suggested_value: suggestedValue ?? null,
        gold_keyword: baseline?.gold_keyword ?? null,
        baseline_position: baseline?.baseline_position ?? null,
        baseline_clicks: baseline?.baseline_clicks ?? null,
        baseline_impressions: baseline?.baseline_impressions ?? null,
      },
      {
        onConflict: 'user_id,mission_type,target_url',
        ignoreDuplicates: false,
      }
    )
    .select()
    .single();

  if (error) {
    console.error('[Supabase] completeMission: Error en upsert user_missions para:', email, '| missionType:', missionType, '| targetUrl:', targetUrl, '| error:', error.message, '| code:', error.code, '| details:', error.details);
    return null;
  }

  console.log(`[Supabase] completeMission: ✅ Misión ${missionType} guardada para ${email}`);
  return data as UserMission;
}

/** Misiones completadas hace ≥ minDays sin notificación de victoria SEO. */
export async function getMissionsPendingSeoWinCheck(
  email: string,
  minDays: number = 7,
  limit: number = 6
): Promise<UserMission[]> {
  if (!supabaseAdmin) return [];

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('email', email)
    .single();

  if (!profile) return [];

  const cutoff = new Date(Date.now() - minDays * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabaseAdmin
    .from('user_missions')
    .select('*')
    .eq('user_id', profile.id)
    .eq('status', 'completed')
    .is('win_notified_at', null)
    .not('baseline_position', 'is', null)
    .lte('completed_at', cutoff)
    .order('completed_at', { ascending: true })
    .limit(limit);

  if (error) {
    console.warn('[Supabase] getMissionsPendingSeoWinCheck:', error.message);
    return [];
  }

  return (data ?? []) as UserMission[];
}

export async function markMissionWinNotified(missionId: string): Promise<boolean> {
  if (!supabaseAdmin) return false;

  const { error } = await supabaseAdmin
    .from('user_missions')
    .update({ win_notified_at: new Date().toISOString() })
    .eq('id', missionId);

  if (error) {
    console.warn('[Supabase] markMissionWinNotified:', error.message);
    return false;
  }
  return true;
}

/**
 * Verifica si una misión específica ya fue completada por el usuario.
 * Uso: filtrar Quick Wins antes de renderizar.
 */
export async function isMissionCompleted(
  email: string,
  missionType: MissionType,
  targetUrl: string
): Promise<boolean> {
  if (!supabaseAdmin) return false;

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('email', email)
    .single();

  if (!profile) return false;

  const { data, error } = await supabaseAdmin
    .from('user_missions')
    .select('id')
    .eq('user_id', profile.id)
    .eq('mission_type', missionType)
    .eq('target_url', targetUrl)
    .eq('status', 'completed')
    .maybeSingle();

  if (error) return false;
  return data !== null;
}

/**
 * Elimina el perfil del usuario y todas sus misiones (CASCADE en user_missions).
 */
/**
 * Actualiza el plan de suscripción de un usuario (activación manual PRO/Agencia).
 */
function formatSupabaseConnectionError(err: unknown, host?: string | null): string {
  const message = err instanceof Error ? err.message : String(err);
  if (/fetch failed|ENOTFOUND|ECONNREFUSED|ETIMEDOUT|getaddrinfo/i.test(message)) {
    const target = host ? ` (${host})` : '';
    return (
      `No se pudo conectar con Supabase${target}. ` +
      'Revisá en Vercel → Settings → Environment Variables que NEXT_PUBLIC_SUPABASE_URL ' +
      'sea exactamente la Project URL del dashboard de Supabase (Settings → API), sin espacios al final. ' +
      'Luego redeploy. Probá también /api/debug-supabase'
    );
  }
  return message;
}

export async function updateSubscriptionPlan(
  email: string,
  plan: 'free' | 'pro' | 'agency',
  expiresAt?: string | null
): Promise<{ ok: boolean; error?: string }> {
  if (!supabaseAdmin) {
    return { ok: false, error: 'Supabase no configurado en el servidor (faltan variables en Vercel).' };
  }

  const normalizedEmail = email.trim().toLowerCase();
  const projectHost = supabaseUrl ? safeSupabaseHost(supabaseUrl) : null;

  try {
    const { error: upsertErr } = await supabaseAdmin.rpc('upsert_profile', {
      p_email: normalizedEmail,
      p_website_url: null,
      p_business_name: null,
    });
    if (upsertErr) {
      console.error('[Supabase] updateSubscriptionPlan upsert_profile:', upsertErr.message);
      return { ok: false, error: upsertErr.message };
    }

    const baseUpdate = {
      subscription_status: plan,
      updated_at: new Date().toISOString(),
    };

    let { data, error } = await supabaseAdmin
      .from('profiles')
      .update({
        ...baseUpdate,
        subscription_expires_at: expiresAt ?? null,
      })
      .eq('email', normalizedEmail)
      .select('id')
      .maybeSingle();

    // Fallback si no corrieron migración 003 (columna subscription_expires_at)
    if (
      error &&
      /subscription_expires_at/i.test(error.message)
    ) {
      ({ data, error } = await supabaseAdmin
        .from('profiles')
        .update(baseUpdate)
        .eq('email', normalizedEmail)
        .select('id')
        .maybeSingle());
    }

    if (error) {
      console.error('[Supabase] updateSubscriptionPlan:', error.message);
      return { ok: false, error: error.message };
    }
    if (!data?.id) {
      const msg = `No se encontró perfil para ${normalizedEmail}`;
      console.error('[Supabase] updateSubscriptionPlan:', msg);
      return { ok: false, error: msg };
    }
    return { ok: true };
  } catch (err) {
    const error = formatSupabaseConnectionError(err, projectHost);
    console.error('[Supabase] updateSubscriptionPlan:', error);
    return { ok: false, error };
  }
}

function safeSupabaseHost(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

// ─── Espía de la Competencia (Fase 1) ───────────────────────────────────────

export type CompetitorSnapshot = {
  title: string;
  h1: string;
  headings: string[];
  scrapedAt: string;
  /** Preguntas detectadas en la página (FAQ visible, H2 con ?, acordeones). */
  faqQuestions?: string[];
  /** Pares pregunta+respuesta (para generar Schema FAQ copiable). */
  faqPairs?: Array<{ question: string; answer: string }>;
  /** Tiene Schema FAQPage (lo que Google/IA leen para rich results). */
  hasFaqSchema?: boolean;
  /** Tipos Schema.org encontrados (Product, FAQPage, Organization…). */
  schemaTypes?: string[];
};

/** Resuelve (o crea) el profile id por email. Devuelve null si Supabase no está. */
async function resolveProfileId(email: string): Promise<string | null> {
  if (!supabaseAdmin) return null;
  const { data, error } = await supabaseAdmin.rpc('upsert_profile', {
    p_email: email.trim().toLowerCase(),
    p_website_url: null,
    p_business_name: null,
  });
  if (error) {
    console.error('[Supabase] resolveProfileId:', error.message);
    return null;
  }
  return (data as Profile | null)?.id ?? null;
}

/** Lista las URLs de competidores ya guardadas para un usuario. */
export async function listCompetitorUrls(email: string): Promise<string[]> {
  if (!supabaseAdmin) return [];
  const profileId = await resolveProfileId(email);
  if (!profileId) return [];

  const { data, error } = await supabaseAdmin
    .from('competitors')
    .select('competitor_url')
    .eq('profile_id', profileId);

  if (error) {
    console.error('[Supabase] listCompetitorUrls:', error.message);
    return [];
  }
  return (data ?? []).map((r: { competitor_url: string }) => r.competitor_url);
}

/** Devuelve el último snapshot guardado de un rival, o null si nunca se espió. */
export async function getCompetitorSnapshot(
  email: string,
  competitorUrl: string
): Promise<CompetitorSnapshot | null> {
  if (!supabaseAdmin) return null;
  const profileId = await resolveProfileId(email);
  if (!profileId) return null;

  const { data, error } = await supabaseAdmin
    .from('competitors')
    .select('last_snapshot')
    .eq('profile_id', profileId)
    .eq('competitor_url', competitorUrl)
    .maybeSingle();

  if (error || !data?.last_snapshot) return null;
  return data.last_snapshot as CompetitorSnapshot;
}

/** Guarda (upsert) el snapshot del rival para detección de cambios futura. */
export async function saveCompetitorSnapshot(
  email: string,
  competitorUrl: string,
  snapshot: CompetitorSnapshot
): Promise<boolean> {
  if (!supabaseAdmin) return false;
  const profileId = await resolveProfileId(email);
  if (!profileId) return false;

  const { error } = await supabaseAdmin.from('competitors').upsert(
    {
      profile_id: profileId,
      competitor_url: competitorUrl,
      last_snapshot: snapshot,
      last_checked_at: new Date().toISOString(),
    },
    { onConflict: 'profile_id,competitor_url', ignoreDuplicates: false }
  );

  if (error) {
    console.error('[Supabase] saveCompetitorSnapshot:', error.message);
    return false;
  }
  return true;
}

export async function deleteProfileByEmail(email: string): Promise<boolean> {
  if (!supabaseAdmin) {
    console.warn('[Supabase] deleteProfileByEmail: Supabase no configurado.');
    return true;
  }

  const { error } = await supabaseAdmin.from('profiles').delete().eq('email', email);

  if (error) {
    console.error('[Supabase] deleteProfileByEmail:', error.message);
    return false;
  }

  console.log(`[Supabase] deleteProfileByEmail: perfil eliminado para ${email}`);
  return true;
}

// ─── Conector WordPress ──────────────────────────────────────────────────────

export type WpConnectionRow = {
  id: string;
  profile_id: string;
  site_url: string;
  token_encrypted: string;
  token_hint: string;
  status: 'pending' | 'active' | 'invalid' | 'revoked';
  plugin_version: string | null;
  last_verified_at: string | null;
  created_at: string;
  updated_at: string;
};

export async function getWpConnectionByEmail(email: string): Promise<WpConnectionRow | null> {
  if (!supabaseAdmin) return null;
  const profileId = await resolveProfileId(email);
  if (!profileId) return null;

  const { data, error } = await supabaseAdmin
    .from('wp_connections')
    .select('*')
    .eq('profile_id', profileId)
    .neq('status', 'revoked')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[Supabase] getWpConnectionByEmail:', error.message);
    return null;
  }
  return (data as WpConnectionRow) || null;
}

export async function upsertWpConnection(params: {
  email: string;
  siteUrl: string;
  tokenEncrypted: string;
  tokenHint: string;
  status?: WpConnectionRow['status'];
}): Promise<WpConnectionRow | null> {
  if (!supabaseAdmin) return null;
  const profileId = await resolveProfileId(params.email);
  if (!profileId) return null;

  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from('wp_connections')
    .upsert(
      {
        profile_id: profileId,
        site_url: params.siteUrl,
        token_encrypted: params.tokenEncrypted,
        token_hint: params.tokenHint,
        status: params.status || 'pending',
        plugin_version: null,
        last_verified_at: null,
        updated_at: now,
      },
      { onConflict: 'profile_id', ignoreDuplicates: false }
    )
    .select('*')
    .single();

  if (error) {
    console.error('[Supabase] upsertWpConnection:', error.message);
    return null;
  }
  return data as WpConnectionRow;
}

export async function updateWpConnectionStatus(
  connectionId: string,
  patch: Partial<Pick<WpConnectionRow, 'status' | 'plugin_version' | 'last_verified_at'>>
): Promise<boolean> {
  if (!supabaseAdmin) return false;
  const { error } = await supabaseAdmin
    .from('wp_connections')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', connectionId);

  if (error) {
    console.error('[Supabase] updateWpConnectionStatus:', error.message);
    return false;
  }
  return true;
}

export async function revokeWpConnection(email: string): Promise<boolean> {
  if (!supabaseAdmin) return false;
  const profileId = await resolveProfileId(email);
  if (!profileId) return false;

  const { error } = await supabaseAdmin
    .from('wp_connections')
    .update({ status: 'revoked', updated_at: new Date().toISOString() })
    .eq('profile_id', profileId)
    .neq('status', 'revoked');

  if (error) {
    console.error('[Supabase] revokeWpConnection:', error.message);
    return false;
  }
  return true;
}
