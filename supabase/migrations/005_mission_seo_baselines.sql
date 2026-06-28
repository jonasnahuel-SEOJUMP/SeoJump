-- Baseline GSC al completar misión + control de notificación de victoria SEO
ALTER TABLE public.user_missions
  ADD COLUMN IF NOT EXISTS baseline_position     NUMERIC,
  ADD COLUMN IF NOT EXISTS baseline_clicks       INTEGER,
  ADD COLUMN IF NOT EXISTS baseline_impressions  INTEGER,
  ADD COLUMN IF NOT EXISTS win_notified_at       TIMESTAMPTZ;

COMMENT ON COLUMN public.user_missions.baseline_position IS 'Posición GSC al completar la misión';
COMMENT ON COLUMN public.user_missions.win_notified_at IS 'Cuándo se notificó mejora SEO (evita duplicados)';
