import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const results = [];
  const totalStart = Date.now();
  const apiKey = process.env.GEMINI_API_KEY;

  // Step 1: Test API key exists
  results.push({ step: 'API Key check', value: apiKey ? `exists (starts with ${apiKey.substring(0, 6)}...)` : 'MISSING!' });

  // Step 2: Test scrapeMetadata
  try {
    const start = Date.now();
    const res = await fetch('https://www.55detailshop.com.ar/', {
      headers: { 'User-Agent': 'SEOJUMP-Bot/1.0', 'Accept': 'text/html' },
      signal: AbortSignal.timeout(4000),
    });
    results.push({ step: 'Scrape home', ms: Date.now() - start, status: res.status });
  } catch (e) {
    results.push({ step: 'Scrape home', error: e.message });
  }

  // Step 3: Test gemini-2.5-flash via REST
  const models = ['gemini-2.5-flash', 'gemini-2.0-flash-lite', 'gemini-2.0-flash'];
  for (const model of models) {
    try {
      const start = Date.now();
      const url = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'Say OK' }] }] }),
        signal: AbortSignal.timeout(8000),
      });
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const errMsg = data?.error?.message || '';
      results.push({
        step: `Gemini ${model}`,
        ms: Date.now() - start,
        status: res.status,
        response: res.ok ? text.substring(0, 50) : errMsg.substring(0, 120),
      });
    } catch (e) {
      results.push({ step: `Gemini ${model}`, error: e.message });
    }
  }

  // Step 4: Test v1beta endpoint too
  try {
    const start = Date.now();
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'Say OK' }] }] }),
      signal: AbortSignal.timeout(8000),
    });
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const errMsg = data?.error?.message || '';
    results.push({
      step: 'Gemini 2.5-flash (v1beta)',
      ms: Date.now() - start,
      status: res.status,
      response: res.ok ? text.substring(0, 50) : errMsg.substring(0, 120),
    });
  } catch (e) {
    results.push({ step: 'Gemini 2.5-flash (v1beta)', error: e.message });
  }

  results.push({ step: 'TOTAL', ms: Date.now() - totalStart });

  return NextResponse.json({ ok: true, results }, { status: 200 });
}
