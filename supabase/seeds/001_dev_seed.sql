-- ============================================================
-- SEO Jump — Seeds de referencia (NO ejecutar en producción)
-- Solo para desarrollo local y testing
-- ============================================================

-- Perfil de ejemplo (desarrollador)
INSERT INTO public.profiles (email, business_name, website_url, subscription_status)
VALUES
  ('dev@seojump.ai', 'SEO Jump Dev', 'https://seojump.ai', 'pro')
ON CONFLICT (email) DO NOTHING;

-- Misiones de ejemplo para el perfil de dev
INSERT INTO public.user_missions (user_id, mission_type, target_url, gold_keyword, status, xp_awarded, suggested_value)
SELECT
  p.id,
  'H1',
  'https://seojump.ai/',
  'SEO para PyMEs',
  'completed',
  150,
  'SEO Jump | Optimizá tu web sin ser técnico'
FROM public.profiles p WHERE p.email = 'dev@seojump.ai'
ON CONFLICT (user_id, mission_type, target_url) DO NOTHING;
