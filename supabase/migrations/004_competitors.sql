-- ============================================================
-- SEO Jump — Migración 004: Espía de la Competencia (Fase 1)
-- Ejecutar desde: Supabase Dashboard > SQL Editor
-- Fecha: 2026-06
--
-- Guarda un snapshot del último espionaje por (perfil + URL rival).
-- Permite detección de cambios on-demand sin cron:
-- al volver a espiar, comparamos el snapshot nuevo con el guardado.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.competitors (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id      UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  competitor_url  TEXT        NOT NULL,
  last_snapshot   JSONB,                      -- { title, h1, headings: [], scrapedAt }
  last_checked_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Un rival único por perfil (al re-espiar se actualiza el snapshot).
  CONSTRAINT uq_competitor UNIQUE (profile_id, competitor_url)
);

CREATE INDEX IF NOT EXISTS idx_competitors_profile ON public.competitors (profile_id);

-- ─── RLS (service_role only, igual que migraciones anteriores) ───────────────
ALTER TABLE public.competitors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_only_competitors"
  ON public.competitors USING (auth.role() = 'service_role');

-- ─────────────────────────────────────────────────────────────
-- FIN DE LA MIGRACIÓN 004
-- ─────────────────────────────────────────────────────────────
