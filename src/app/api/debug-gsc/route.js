import { NextResponse } from 'next/server';
import { auth } from '../../../auth';
import { getSearchConsoleData } from '../../../lib/google';
import { requireAdmin } from '../../../lib/adminGuard';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  const results = [];
  const totalStart = Date.now();

  // Step 1: Check auth session
  let session;
  try {
    session = await auth();
    results.push({
      step: '1. Auth Session',
      hasSession: !!session,
      hasAccessToken: !!session?.accessToken,
      tokenPrefix: session?.accessToken ? session.accessToken.substring(0, 20) + '...' : 'NONE',
      userEmail: session?.user?.email || 'NONE',
    });
  } catch (e) {
    results.push({ step: '1. Auth Session', error: e.message });
    return NextResponse.json({ ok: false, results }, { status: 200 });
  }

  if (!session?.accessToken) {
    results.push({ step: 'ABORT', reason: 'No access token — user not logged in or token expired' });
    return NextResponse.json({ ok: false, results }, { status: 200 });
  }

  // Step 2: List all GSC properties
  try {
    const start = Date.now();
    const res = await fetch('https://www.googleapis.com/webmasters/v3/sites', {
      headers: { Authorization: `Bearer ${session.accessToken}` },
      signal: AbortSignal.timeout(5000),
    });
    const data = await res.json();
    const sites = (data.siteEntry || []).map(s => ({
      siteUrl: s.siteUrl,
      permissionLevel: s.permissionLevel,
    }));
    results.push({
      step: '2. GSC Properties (RAW)',
      ms: Date.now() - start,
      status: res.status,
      totalProperties: sites.length,
      properties: sites,
      rawError: data.error || null,
    });
  } catch (e) {
    results.push({ step: '2. GSC Properties', error: e.message });
  }

  // Step 3: Try getSearchConsoleData with the user's site URL
  const testUrl = 'https://www.55detailshop.com.ar';
  try {
    const start = Date.now();
    const rows = await getSearchConsoleData(session.accessToken, testUrl, undefined, 10);
    results.push({
      step: '3. getSearchConsoleData (no keyword)',
      ms: Date.now() - start,
      rowCount: rows.length,
      first3Rows: rows.slice(0, 3).map(r => ({
        page: r.keys?.[0],
        query: r.keys?.[1],
        position: r.position,
        clicks: r.clicks,
        impressions: r.impressions,
      })),
    });
  } catch (e) {
    results.push({ step: '3. getSearchConsoleData', error: e.message });
  }

  // Step 4: Try direct query to GSC with known property format
  const propertyFormats = [
    'https://www.55detailshop.com.ar/',
    'https://www.55detailshop.com.ar',
    'http://www.55detailshop.com.ar/',
    'sc-domain:55detailshop.com.ar',
    'https://55detailshop.com.ar/',
  ];
  for (const prop of propertyFormats) {
    try {
      const start = Date.now();
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const res = await fetch(
        `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(prop)}/searchAnalytics/query`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            startDate,
            endDate,
            dimensions: ['page', 'query'],
            rowLimit: 5,
          }),
          signal: AbortSignal.timeout(5000),
        }
      );
      const data = await res.json();
      results.push({
        step: `4. Direct query: ${prop}`,
        ms: Date.now() - start,
        status: res.status,
        rowCount: (data.rows || []).length,
        error: data.error?.message || null,
        first2Rows: (data.rows || []).slice(0, 2).map(r => ({
          page: r.keys?.[0],
          query: r.keys?.[1],
          position: r.position,
          clicks: r.clicks,
        })),
      });
    } catch (e) {
      results.push({ step: `4. Direct query: ${prop}`, error: e.message });
    }
  }

  results.push({ step: 'TOTAL', ms: Date.now() - totalStart });

  return NextResponse.json({ ok: true, results }, { status: 200 });
}
