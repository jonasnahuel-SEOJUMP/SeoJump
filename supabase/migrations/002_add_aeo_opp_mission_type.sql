-- ============================================================
-- SEO Jump — Migración 002: Agregar tipo de misión AEO_OPP
-- Ejecutar desde: Supabase Dashboard > SQL Editor
-- Fecha: 2026-06
--
-- PROBLEMA: El CHECK constraint original solo permitía
-- 'H1', 'META', 'ALT', 'QUICK_WIN'.
-- Las misiones de tipo 'AEO_OPP' (Answer Engine Optimization)
-- eran rechazadas en silencio por la BD, sin llegar a guardarse.
-- ============================================================

-- 1. Eliminar el CHECK constraint anterior (en Postgres no se puede ALTER)
ALTER TABLE public.user_missions
  DROP CONSTRAINT IF EXISTS user_missions_mission_type_check;

-- 2. Agregar el nuevo CHECK con AEO_OPP incluido
ALTER TABLE public.user_missions
  ADD CONSTRAINT user_missions_mission_type_check
  CHECK (mission_type IN (
    'H1',        -- Optimizar el H1 de una página
    'META',      -- Optimizar la meta descripción
    'ALT',       -- Optimizar el texto ALT de imágenes
    'QUICK_WIN', -- Quick Win de posición 8-15
    'AEO_OPP'   -- Oportunidad de Answer Engine Optimization
  ));

-- ─────────────────────────────────────────────────────────────
-- FIN DE LA MIGRACIÓN 002
-- ─────────────────────────────────────────────────────────────
