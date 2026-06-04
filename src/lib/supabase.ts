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
  created_at: string;
  updated_at: string;
};

export type MissionStatus = 'pending' | 'completed' | 'skipped';
export type MissionType = 'H1' | 'META' | 'ALT' | 'QUICK_WIN' | 'AEO_OPP';

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
};

// ─── Configuración ───────────────────────────────────────────────────────────

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

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
  suggestedValue?: string
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
