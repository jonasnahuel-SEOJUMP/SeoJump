// Simulate timing of each step in getQuickWins
const key = process.env.GEMINI_API_KEY || ''; // ⚠️ NUNCA hardcodear API keys en el código

async function timeFetch(label, url, opts) {
  const start = Date.now();
  try {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(url, { ...opts, signal: ctrl.signal });
    clearTimeout(to);
    console.log(`  ${label}: ${Date.now()-start}ms (status=${res.status})`);
    return res;
  } catch(e) {
    console.log(`  ${label}: ${Date.now()-start}ms (ERROR: ${e.message})`);
    return null;
  }
}

(async () => {
  const total = Date.now();
  
  // Step 1: scrapeMetadata (home)
  console.log('Step 1: scrapeMetadata(home)');
  await timeFetch('55detailshop.com.ar', 'https://www.55detailshop.com.ar/', {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SEOJUMP-Bot/1.0)', 'Accept': 'text/html' }
  });

  // Step 2: Gemini call
  console.log('Step 2: Gemini API (gemini-3.5-flash)');
  const prompt = 'Respond with a JSON array of 3 items: [{"page":"a","keyword":"b","position":9,"clicks":5,"impressions":100,"intentMatches":true,"suggestedTitle":"Title","explanation":"Exp"}]';
  await timeFetch('gemini-3.5-flash', 
    `https://generativelanguage.googleapis.com/v1/models/gemini-3.5-flash:generateContent?key=${key}`,
    { method: 'POST', headers: {'Content-Type':'application/json'}, 
      body: JSON.stringify({ contents: [{ role:'user', parts:[{text:prompt}] }] }) }
  );

  console.log(`\nTotal so far: ${Date.now()-total}ms`);
  console.log('(Real function also includes: GSC API calls + parallel page scrapes)');
})();
