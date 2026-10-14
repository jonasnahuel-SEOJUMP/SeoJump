import { NextResponse } from 'next/server';
import { auth } from '../../../auth';
import { sanitizeGameStatePayload } from '../../../lib/progression';
import { getUserGameState, upsertUserGameState } from '../../../lib/supabase';

/**
 * Persistencia del progreso de juego (XP, fases, gold, prestigio).
 * Antes: JSON en disco (data/user-states/) — no sobrevive en Vercel.
 * Ahora: tabla Supabase user_game_state.
 */

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'No authenticated session' }, { status: 401 });
    }

    const state = await getUserGameState(session.user.email);
    return NextResponse.json({ success: true, data: state });
  } catch (error) {
    console.error('Error reading user state:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'No authenticated session' }, { status: 401 });
    }

    const body = await request.json();
    const toSave = sanitizeGameStatePayload(body);

    const saved = await upsertUserGameState(session.user.email, toSave);
    if (!saved) {
      return NextResponse.json(
        {
          success: false,
          error: 'supabase_unavailable',
          hint:
            'No se pudo guardar en Supabase. Si el proyecto está pausado, restaurarlo en el dashboard. Si falta la migración 009, correrla en SQL Editor.',
        },
        { status: 503 }
      );
    }

    return NextResponse.json({ success: true, data: saved });
  } catch (error) {
    console.error('Error saving user state:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
