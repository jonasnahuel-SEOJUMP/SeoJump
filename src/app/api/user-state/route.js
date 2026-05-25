import { NextResponse } from 'next/server';
import { auth } from '../../../auth';
import fs from 'fs';
import path from 'path';
import { getPhaseProgress } from '../../../lib/progression';

const DATA_DIR = path.join(process.cwd(), 'data', 'user-states');

function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'No authenticated session' }, { status: 401 });
    }

    const email = session.user.email;
    const sanitizedEmail = email.replace(/[^a-zA-Z0-9_.-]/g, '_');
    const filePath = path.join(DATA_DIR, `${sanitizedEmail}.json`);

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ success: true, data: null });
    }

    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const state = JSON.parse(fileContent);

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

    const email = session.user.email;
    const sanitizedEmail = email.replace(/[^a-zA-Z0-9_.-]/g, '_');
    
    ensureDirectoryExists(DATA_DIR);
    const filePath = path.join(DATA_DIR, `${sanitizedEmail}.json`);

    const body = await request.json();
    
    // Server-side validation of phase progression to prevent fetch tampering
    const completedList = body.completed_missions || [];
    const completedSet = new Set(completedList);
    const suggestions = body.gold_suggestions || [];
    const missions = body.missions_list || [];
    const query = body.gold_query || "";
    const siteUrl = body.site_url || "";
    
    const prog = getPhaseProgress(completedSet, suggestions, missions, query, siteUrl);
    
    // Filter completed missions to enforce locked phases
    let filteredCompleted = [...completedList];
    
    // If Phase 2 is locked, remove Phase 2 missions
    if (!prog.p2.unlocked) {
      filteredCompleted = filteredCompleted.filter(m => !m.startsWith('fase2-'));
    }
    // If Phase 3 is locked, remove Phase 3 missions
    if (!prog.p3.unlocked) {
      const wpMissionIds = new Set(missions.map(m => m.id));
      filteredCompleted = filteredCompleted.filter(m => !wpMissionIds.has(m));
    }
    // If Phase 4 is locked, remove Phase 4 missions
    if (!prog.p4.unlocked) {
      filteredCompleted = filteredCompleted.filter(m => !m.startsWith('fase4-'));
    }
    
    // Recalculate fase_actual to guarantee accuracy
    let recalculatedFase = 1;
    if (prog.p4.unlocked) recalculatedFase = 4;
    else if (prog.p3.unlocked) recalculatedFase = 3;
    else if (prog.p2.unlocked) recalculatedFase = 2;
    
    const state = {
      ...body,
      completed_missions: filteredCompleted,
      fase_actual: recalculatedFase,
      email,
      updated_at: new Date().toISOString()
    };

    fs.writeFileSync(filePath, JSON.stringify(state, null, 2), 'utf-8');

    return NextResponse.json({ success: true, data: state });
  } catch (error) {
    console.error('Error saving user state:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
