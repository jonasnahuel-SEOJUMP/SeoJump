-- ======supabase/migrations/009_user_game_state.sql====================
-- SEO Jump — Migración 009: progreso de juego persistente (reemplaza disco Vercel)
-- Ejecutar en: Supabase Dashboard > SQL Editor
--
-- Problema: /api/user-state escribía JSON en data/user-states/ del filesystem
-- del servidor. En Vercel ese disco es efímero (multi-instancia + deploys) →
-- se pierde XP, fases, gold missions y prestigio al cambiar de dispositivo.
-- Solución: tabla en Postgres ligada al profile (CASCADE al borrar cuenta).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_game_state (
  profile_id          UUID          PRIMARY KEY
                      REFERENCES public.profiles(id) ON DELETE CASCADE,
  email               TEXT          NOT NULL UNIQUE,
  xp                  INTEGER       NOT NULL DEFAULT 0 CHECK (xp >= 0),
  completed_missions  JSONB         NOT NULL DEFAULT '[]'::jsonb,
  ciclos_prestigio    INTEGER       NOT NULL DEFAULT 0 CHECK (ciclos_prestigio >= 0),
  fase_actual         INTEGER       NOT NULL DEFAULT 1 CHECK (fase_actual BETWEEN 1 AND 4),
  site_url            TEXT,
  gold_query          TEXT,
  gold_suggestions    JSONB         NOT NULL DEFAULT '[]'::jsonb,
  missions_list       JSONB         NOT NULL DEFAULT '[]'::jsonb,
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_game_state_email
  ON public.user_game_state (email);

CREATE TRIGGER trg_user_game_state_updated_at
  BEFORE UPDATE ON public.user_game_state
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.user_game_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_only_user_game_state" ON public.user_game_state;
CREATE POLICY "service_role_only_user_game_state"
  ON public.user_game_state USING (auth.role() = 'service_role');
