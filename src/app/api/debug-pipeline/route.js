import { NextResponse } from 'next/server';
import { auth } from '../../../auth';
import { getSearchConsoleData } from '../../../lib/google';

export const dynamic = 'force-dynamic';

export async function GET() {
  const trace = [];
  const siteUrl = 'https://www.55detailshop.com.ar';

  try {
    const session = await auth();
    trace.push({ step: '1. Auth', hasToken: !!session?.accessToken });

    if (!session?.accessToken) {
      trace.push({ step: 'ABORT', reason: 'No access token' });
      return NextResponse.json({ trace });
    }

    // Step 2: Get GSC rows (same as getQuickWins does)
    let gscRows = [];
    try {
      gscRows = await getSearchConsoleData(session.accessToken, siteUrl, undefined, 100);
      trace.push({ step: '2. GSC rows (raw)', totalRows: gscRows.length });
    } catch (e) {
      trace.push({ step: '2. GSC rows', error: e.message });
    }

    // Step 3: Position filter 8-15
    const inRange = gscRows.filter(r => r.position >= 8 && r.position <= 15);
    trace.push({
      step: '3. Position filter 8-15',
      rowsInRange: inRange.length,
      rows: inRange.slice(0, 10).map(r => ({
        page: r.keys?.[0],
        query: r.keys?.[1],
        position: Math.round(r.position * 100) / 100,
        clicks: r.clicks,
        impressions: r.impressions,
      })),
    });

    // Step 4: Show ALL position ranges for context
    const ranges = {
      'pos 1-3': gscRows.filter(r => r.position >= 1 && r.position < 3).length,
      'pos 3-8': gscRows.filter(r => r.position >= 3 && r.position < 8).length,
      'pos 8-15': inRange.length,
      'pos 15-30': gscRows.filter(r => r.position >= 15 && r.position <= 30).length,
      'pos 30+': gscRows.filter(r => r.position > 30).length,
    };
    trace.push({ step: '4. Position distribution', ranges, totalRows: gscRows.length });

    // Step 5: Show top 10 rows by impressions (regardless of position)
    const byImpressions = [...gscRows].sort((a, b) => (b.impressions || 0) - (a.impressions || 0));
    trace.push({
      step: '5. Top 10 rows by impressions (ALL positions)',
      rows: byImpressions.slice(0, 10).map(r => ({
        page: r.keys?.[0]?.replace('https://www.55detailshop.com.ar', ''),
        query: r.keys?.[1],
        position: Math.round(r.position * 100) / 100,
        clicks: r.clicks,
        impressions: r.impressions,
      })),
    });

    // Step 6: Check Supabase completed missions filter
    try {
      const { getMissionsByEmail } = await import('../../../lib/supabase');
      const doneMissions = await getMissionsByEmail(session.user?.email, 'completed');
      const quickWinDone = doneMissions.filter(m => m.mission_type === 'QUICK_WIN');
      trace.push({
        step: '6. Supabase completed QUICK_WIN missions',
        totalCompleted: quickWinDone.length,
        urls: quickWinDone.map(m => m.target_url),
      });
    } catch (e) {
      trace.push({ step: '6. Supabase', error: e.message });
    }

    // Step 7: Check Gemini API key and model
    const apiKey = process.env.GEMINI_API_KEY;
    trace.push({
      step: '7. Gemini config',
      hasKey: !!apiKey,
      keyPrefix: apiKey ? apiKey.substring(0, 8) + '...' : 'NONE',
    });

  } catch (e) {
    trace.push({ step: 'ERROR', error: e.message });
  }

  return NextResponse.json({ ok: true, trace });
}
