-- ============================================================
-- SEO Jump — Migración 007: Conector WordPress (Aplicar en mi web)
-- Ejecutar desde: Supabase Dashboard > SQL Editor
--
-- Una conexión activa por perfil. El token se guarda cifrado en
-- la app (AES-GCM); acá solo persiste el ciphertext.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.wp_connections (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id       UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  site_url         TEXT        NOT NULL,
  token_encrypted  TEXT        NOT NULL,
  token_hint       TEXT        NOT NULL DEFAULT '',
  status           TEXT        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'invalid', 'revoked')),
  plugin_version   TEXT,
  last_verified_at TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Un sitio WordPress conectado por cuenta SEO Jump.
  CONSTRAINT uq_wp_connection_profile UNIQUE (profile_id)
);

CREATE INDEX IF NOT EXISTS idx_wp_connections_profile ON public.wp_connections (profile_id);

ALTER TABLE public.wp_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_only_wp_connections"
  ON public.wp_connections USING (auth.role() = 'service_role');

-- ─────────────────────────────────────────────────────────────
-- FIN DE LA MIGRACIÓN 007
-- ─────────────────────────────────────────────────────────────
