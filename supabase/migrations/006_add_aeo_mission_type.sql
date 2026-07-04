-- ============================================================
-- SEO Jump — Migración 006: Aceptar el tipo de misión 'AEO'
-- Ejecutar desde: Supabase Dashboard > SQL Editor
-- Fecha: 2026-07
--
-- PROBLEMA: Las misiones regulares de tipo FAQ (buildMissionTypes)
-- se generan con mission_type = 'AEO', pero el CHECK constraint solo
-- aceptaba 'H1', 'META', 'ALT', 'QUICK_WIN', 'AEO_OPP'. Al completar
-- una misión 'AEO', la BD la rechazaba EN SILENCIO (igual que pasó con
-- 'AEO_OPP' antes de la migración 002). Como no se guardaba, la misión
-- reaparecía indefinidamente aunque el usuario ya la hubiera hecho.
--
-- SOLUCIÓN: Agregar 'AEO' al CHECK. Es un tipo distinto de 'AEO_OPP'
-- (este último es la oportunidad detectada; 'AEO' es la misión FAQ
-- generada desde Search Console).
-- ============================================================

-- 1. Eliminar el CHECK constraint anterior (en Postgres no se puede ALTER)
ALTER TABLE public.user_missions
  DROP CONSTRAINT IF EXISTS user_missions_mission_type_check;

-- 2. Agregar el nuevo CHECK con 'AEO' incluido
ALTER TABLE public.user_missions
  ADD CONSTRAINT user_missions_mission_type_check
  CHECK (mission_type IN (
    'H1',        -- Optimizar el H1 de una página
    'META',      -- Optimizar la meta descripción
    'ALT',       -- Optimizar el texto ALT de imágenes
    'QUICK_WIN', -- Quick Win de posición 8-15
    'AEO_OPP',   -- Oportunidad de Answer Engine Optimization
    'AEO'        -- Misión FAQ (Answer Engine Optimization) desde Search Console
  ));

-- ─────────────────────────────────────────────────────────────
-- FIN DE LA MIGRACIÓN 006
-- ─────────────────────────────────────────────────────────────
