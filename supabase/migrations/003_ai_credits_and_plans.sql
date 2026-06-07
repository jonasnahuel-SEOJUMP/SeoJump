-- ======supabase/migrations/003_ai_credits_and_plans.sql======================================================
-- SEO Jump — Migración 003: Créditos IA, planes y caché
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- ============================================================

-- Vencimiento de suscripción paga
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ;

-- ─── Uso diario de consultas IA ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_usage_daily (
  email       TEXT        NOT NULL,
  usage_date  DATE        NOT NULL DEFAULT CURRENT_DATE,
  count       INTEGER     NOT NULL DEFAULT 0 CHECK (count >= 0),
  PRIMARY KEY (email, usage_date)
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_daily_date ON public.ai_usage_daily (usage_date);

-- ─── Uso mensual de consultas IA ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_usage_monthly (
  email       TEXT        NOT NULL,
  year_month  TEXT        NOT NULL,
  count       INTEGER     NOT NULL DEFAULT 0 CHECK (count >= 0),
  PRIMARY KEY (email, year_month)
);

-- ─── Sitios de agencia (hasta 8 por cuenta agency) ──────────────────────────
CREATE TABLE IF NOT EXISTS public.agency_sites (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  site_url    TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_agency_site UNIQUE (profile_id, site_url)
);

CREATE INDEX IF NOT EXISTS idx_agency_sites_profile ON public.agency_sites (profile_id);

-- ─── Caché de respuestas Gemini (24h) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_response_cache (
  cache_key     TEXT        PRIMARY KEY,
  response_text TEXT        NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_response_cache_created ON public.ai_response_cache (created_at);

-- ─── RLS (service_role only, igual que 001) ─────────────────────────────────
ALTER TABLE public.ai_usage_daily    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_monthly  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agency_sites      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_response_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_only_ai_usage_daily"
  ON public.ai_usage_daily USING (auth.role() = 'service_role');

CREATE POLICY "service_role_only_ai_usage_monthly"
  ON public.ai_usage_monthly USING (auth.role() = 'service_role');

CREATE POLICY "service_role_only_agency_sites"
  ON public.agency_sites USING (auth.role() = 'service_role');

CREATE POLICY "service_role_only_ai_response_cache"
  ON public.ai_response_cache USING (auth.role() = 'service_role');

-- Limpiar caché vieja (opcional, ejecutar periódicamente o vía cron)
-- DELETE FROM public.ai_response_cache WHERE created_at < now() - interval '25 hours';

