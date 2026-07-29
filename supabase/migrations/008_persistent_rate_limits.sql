-- ======supabase/migrations/008_persistent_rate_limits.sql====================
-- SEO Jump — Migración 008: rate limits persistentes + consumo atómico de IA
-- Ejecutar en: Supabase Dashboard > SQL Editor
--
-- Problema: el rate-limit en memoria no sobrevive cold starts / multi-instancia
-- serverless, y el incremento read-modify-write de créditos IA tiene race.
-- Solución: buckets en Postgres + RPCs con advisory lock.
-- ============================================================

-- ─── Buckets de rate limit (acciones / endpoints públicos) ───────────────────
CREATE TABLE IF NOT EXISTS public.rate_limit_buckets (
  bucket_key  TEXT        PRIMARY KEY,
  count       INTEGER     NOT NULL DEFAULT 0 CHECK (count >= 0),
  reset_at    TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_buckets_reset
  ON public.rate_limit_buckets (reset_at);

ALTER TABLE public.rate_limit_buckets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_only_rate_limit_buckets" ON public.rate_limit_buckets;
CREATE POLICY "service_role_only_rate_limit_buckets"
  ON public.rate_limit_buckets USING (auth.role() = 'service_role');

-- check_rate_limit: incrementa atómicamente dentro de la ventana.
-- Retorna { allowed, remaining, retryAfterSec }.
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_key TEXT,
  p_max INTEGER,
  p_window_ms BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now     TIMESTAMPTZ := clock_timestamp();
  v_count   INTEGER;
  v_reset   TIMESTAMPTZ;
  v_retry   INTEGER;
  v_window  INTERVAL;
BEGIN
  IF p_key IS NULL OR length(trim(p_key)) = 0 THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'remaining', 0,
      'retryAfterSec', 60
    );
  END IF;

  IF p_max IS NULL OR p_max < 1 THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'remaining', 0,
      'retryAfterSec', 60
    );
  END IF;

  v_window := make_interval(secs => GREATEST(p_window_ms, 1)::double precision / 1000.0);

  -- Serializa por clave (evita races entre instancias serverless).
  PERFORM pg_advisory_xact_lock(hashtext('rl:' || p_key));

  SELECT count, reset_at
    INTO v_count, v_reset
  FROM public.rate_limit_buckets
  WHERE bucket_key = p_key;

  IF NOT FOUND OR v_reset <= v_now THEN
    v_reset := v_now + v_window;
    INSERT INTO public.rate_limit_buckets (bucket_key, count, reset_at)
    VALUES (p_key, 1, v_reset)
    ON CONFLICT (bucket_key) DO UPDATE
      SET count = 1,
          reset_at = EXCLUDED.reset_at;

    RETURN jsonb_build_object(
      'allowed', true,
      'remaining', GREATEST(p_max - 1, 0),
      'retryAfterSec', NULL
    );
  END IF;

  IF v_count >= p_max THEN
    v_retry := GREATEST(1, CEIL(EXTRACT(EPOCH FROM (v_reset - v_now))));
    RETURN jsonb_build_object(
      'allowed', false,
      'remaining', 0,
      'retryAfterSec', v_retry
    );
  END IF;

  UPDATE public.rate_limit_buckets
     SET count = count + 1
   WHERE bucket_key = p_key
   RETURNING count INTO v_count;

  RETURN jsonb_build_object(
    'allowed', true,
    'remaining', GREATEST(p_max - v_count, 0),
    'retryAfterSec', NULL
  );
END;
$$;

REVOKE ALL ON FUNCTION public.check_rate_limit(TEXT, INTEGER, BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(TEXT, INTEGER, BIGINT) TO service_role;

-- ─── Consumo atómico de 1 crédito IA (día + mes) ────────────────────────────
-- Retorna { allowed, code?, usedToday, usedMonth }.
CREATE OR REPLACE FUNCTION public.consume_ai_credit(
  p_email TEXT,
  p_limit_day INTEGER,
  p_limit_month INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email  TEXT := lower(trim(COALESCE(p_email, '')));
  v_date   DATE := (timezone('utc', now()))::date;
  v_ym     TEXT := to_char(timezone('utc', now()), 'YYYY-MM');
  v_day    INTEGER;
  v_month  INTEGER;
BEGIN
  IF v_email = '' THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'code', 'NOT_AUTHENTICATED',
      'usedToday', 0,
      'usedMonth', 0
    );
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('ai:' || v_email));

  INSERT INTO public.ai_usage_daily (email, usage_date, count)
  VALUES (v_email, v_date, 0)
  ON CONFLICT (email, usage_date) DO NOTHING;

  INSERT INTO public.ai_usage_monthly (email, year_month, count)
  VALUES (v_email, v_ym, 0)
  ON CONFLICT (email, year_month) DO NOTHING;

  SELECT count INTO v_day
  FROM public.ai_usage_daily
  WHERE email = v_email AND usage_date = v_date
  FOR UPDATE;

  SELECT count INTO v_month
  FROM public.ai_usage_monthly
  WHERE email = v_email AND year_month = v_ym
  FOR UPDATE;

  IF v_month >= p_limit_month THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'code', 'AI_CREDIT_MONTHLY',
      'usedToday', v_day,
      'usedMonth', v_month
    );
  END IF;

  IF v_day >= p_limit_day THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'code', 'AI_CREDIT_DAILY',
      'usedToday', v_day,
      'usedMonth', v_month
    );
  END IF;

  UPDATE public.ai_usage_daily
     SET count = count + 1
   WHERE email = v_email AND usage_date = v_date
   RETURNING count INTO v_day;

  UPDATE public.ai_usage_monthly
     SET count = count + 1
   WHERE email = v_email AND year_month = v_ym
   RETURNING count INTO v_month;

  RETURN jsonb_build_object(
    'allowed', true,
    'usedToday', v_day,
    'usedMonth', v_month
  );
END;
$$;

REVOKE ALL ON FUNCTION public.consume_ai_credit(TEXT, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_ai_credit(TEXT, INTEGER, INTEGER) TO service_role;

-- Limpieza opcional de buckets vencidos (cron / manual):
-- DELETE FROM public.rate_limit_buckets WHERE reset_at < now() - interval '2 hours';
