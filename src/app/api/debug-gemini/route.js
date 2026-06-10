import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

async function testGemini(model, api, apiKey) {
  const baseUrl = `https://generativelanguage.googleapis.com/${api}/models/${model}:generateContent`;
  const headers = {
    'Content-Type': 'application/json',
    'x-goog-api-key': apiKey,
  };

  const start = Date.now();
  const res = await fetch(baseUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'Say OK' }] }] }),
    signal: AbortSignal.timeout(8000),
  });
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const errMsg = data?.error?.message || '';
  return {
    step: `Gemini ${model} (${api}, x-goog-api-key)`,
    ms: Date.now() - start,
    status: res.status,
    response: res.ok ? text.substring(0, 50) : errMsg.substring(0, 120),
  };
}

export async function GET() {
  const results = [];
  const totalStart = Date.now();
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();

  results.push({
    step: 'API Key check',
    value: apiKey
      ? `exists (len=${apiKey.length}, starts ${apiKey.substring(0, 6)}..., ends ...${apiKey.slice(-4)}, ${apiKey.startsWith('AQ.') ? 'AQ header auth' : 'AIza query auth'})`
      : 'MISSING!',
  });

  try {
    const start = Date.now();
    const res = await fetch('https://www.55detailshop.com.ar/', {
      headers: { 'User-Agent': 'SEOJUMP-Bot/1.0', Accept: 'text/html' },
      signal: AbortSignal.timeout(4000),
    });
    results.push({ step: 'Scrape home', ms: Date.now() - start, status: res.status });
  } catch (e) {
    results.push({ step: 'Scrape home', error: e.message });
  }

  if (!apiKey) {
    results.push({ step: 'TOTAL', ms: Date.now() - totalStart });
    return NextResponse.json({ ok: false, results }, { status: 200 });
  }

  for (const model of ['gemini-2.5-flash']) {
    for (const api of ['v1beta', 'v1']) {
      try {
        results.push(await testGemini(model, api, apiKey));
      } catch (e) {
        results.push({ step: `Gemini ${model} (${api})`, error: e.message });
      }
    }
  }

  results.push({ step: 'TOTAL', ms: Date.now() - totalStart });

  return NextResponse.json({ ok: true, results }, { status: 200 });
}
