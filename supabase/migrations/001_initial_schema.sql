-- ============================================================
-- SEO Jump — Migración 001: Esquema inicial
-- Ejecutar desde: Supabase Dashboard > SQL Editor
-- Fecha: 2026-05
--
-- ESTRATEGIA DE AUTH: Opción A
--   El login sigue siendo NextAuth + Google.
--   El campo `email` actúa como clave de negocio (business key)
--   para relacionar la sesión de NextAuth con los registros de
--   Supabase. No se usa el Auth interno de Supabase.
-- ============================================================


-- ─────────────────────────────────────────────────────────────
-- 1. TABLA: profiles
--    Un registro por usuario. Se crea la primera vez que el
--    usuario accede a la app (upsert por email).
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  email               TEXT          NOT NULL UNIQUE,
  business_name       TEXT,                           -- Nombre de la PyME (opcional al inicio)
  website_url         TEXT,                           -- URL del sitio que analiza
  subscription_status TEXT          NOT NULL DEFAULT 'free'
                        CHECK (subscription_status IN ('free', 'pro', 'agency')),
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- Índice para búsquedas por email (el lookup más frecuente)
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles (email);

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ─────────────────────────────────────────────────────────────
-- 2. TABLA: user_missions
--    Historial de misiones generadas y completadas por usuario.
--    Una misión = combinación única (user_id + mission_type + target_url).
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_missions (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID          NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  mission_type    TEXT          NOT NULL
                    CHECK (mission_type IN (
                      'H1',           -- Optimizar el H1 de una página
                      'META',         -- Optimizar la meta descripción
                      'ALT',          -- Optimizar el texto ALT de imágenes
                      'QUICK_WIN'     -- Quick Win de posición 8-15
                    )),
  target_url      TEXT          NOT NULL,  -- URL de la página objetivo
  gold_keyword    TEXT,                    -- Palabra clave asociada (puede ser NULL)
  status          TEXT          NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'completed', 'skipped')),
  suggested_value TEXT,                    -- Valor sugerido por IA (título, meta, etc.)
  completed_at    TIMESTAMPTZ,             -- Cuándo se completó (NULL si pending)
  xp_awarded      INTEGER       NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),

  -- Restricción: no puede haber dos misiones del mismo tipo para la misma URL en el mismo usuario
  CONSTRAINT uq_user_mission UNIQUE (user_id, mission_type, target_url)
);

-- Índices para los patrones de consulta más frecuentes
CREATE INDEX IF NOT EXISTS idx_user_missions_user_id    ON public.user_missions (user_id);
CREATE INDEX IF NOT EXISTS idx_user_missions_status     ON public.user_missions (status);
CREATE INDEX IF NOT EXISTS idx_user_missions_user_status ON public.user_missions (user_id, status);


-- ─────────────────────────────────────────────────────────────
-- 3. ROW LEVEL SECURITY (RLS)
--
--    NOTA (Opción A): Como usamos NextAuth (no Supabase Auth),
--    las operaciones se hacen desde el servidor con la
--    SUPABASE_SERVICE_ROLE_KEY, que bypasea RLS por diseño.
--    Aun así, activamos RLS como buena práctica de seguridad
--    por si en el futuro se migra a Supabase Auth (Opción B).
--
--    Por ahora, las políticas permiten todo desde service_role
--    y bloquean acceso directo desde el browser (anon key).
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_missions  ENABLE ROW LEVEL SECURITY;

-- Política de emergencia: solo service_role puede leer/escribir
-- (el cliente browser anon no tiene acceso directo a estas tablas)
CREATE POLICY "service_role_only_profiles"
  ON public.profiles
  USING (auth.role() = 'service_role');

CREATE POLICY "service_role_only_missions"
  ON public.user_missions
  USING (auth.role() = 'service_role');


-- ─────────────────────────────────────────────────────────────
-- 4. FUNCIÓN HELPER: upsert_profile
--    Crea o actualiza el perfil de un usuario en un solo paso.
--    Se llama desde el Server Action de Next.js al iniciar sesión.
--
--    Parámetros:
--      p_email         TEXT  — email de la sesión NextAuth
--      p_website_url   TEXT  — URL del sitio (puede ser NULL)
--      p_business_name TEXT  — Nombre de la PyME (puede ser NULL)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.upsert_profile(
  p_email         TEXT,
  p_website_url   TEXT  DEFAULT NULL,
  p_business_name TEXT  DEFAULT NULL
)
RETURNS public.profiles AS $$
DECLARE
  v_profile public.profiles;
BEGIN
  INSERT INTO public.profiles (email, website_url, business_name)
  VALUES (p_email, p_website_url, p_business_name)
  ON CONFLICT (email) DO UPDATE
    SET
      website_url   = COALESCE(EXCLUDED.website_url,   profiles.website_url),
      business_name = COALESCE(EXCLUDED.business_name, profiles.business_name),
      updated_at    = now()
  RETURNING * INTO v_profile;

  RETURN v_profile;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ─────────────────────────────────────────────────────────────
-- FIN DE LA MIGRACIÓN 001
-- ─────────────────────────────────────────────────────────────
