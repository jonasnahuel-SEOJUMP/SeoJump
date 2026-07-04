/**
 * Cliente y helpers para la API REST de Google Gemini.
 * Extraído de actions.ts para mantener la lógica de IA aislada y testeable.
 * Módulo puro (sin "use server"): solo lo consumen server actions.
 */

import { decodeHtmlEntities } from './textUtils';

export function readGeminiApiKey(): string {
  return (process.env.GEMINI_API_KEY || '').trim();
}

/** Pista de configuración cuando una clave AQ. de AI Studio no autentica. */
export function geminiKeyHint(apiKey: string): string | null {
  if (apiKey.startsWith('AQ.')) {
    return 'La clave AQ. de AI Studio no autenticó. En aistudio.google.com → API Keys → creá una clave nueva en el proyecto donde cargaste créditos (gen-lang-client-0918139206). Si sigue fallando, usá una clave clásica AIza… del mismo proyecto en Vercel → GEMINI_API_KEY.';
  }
  return null;
}

/** Extrae título y razón del JSON que devuelve Gemini (tolera markdown y nombres alternativos). */
export function parseTitleSuggestionFromGemini(
  raw: string
): { suggestedTitle: string; reason: string } | null {
  const clean = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(clean);
  } catch {
    const match = clean.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      parsed = JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
  const suggestedTitle = decodeHtmlEntities(
    String(parsed.suggestedTitle || parsed.suggested_title || parsed.title || '').trim()
  );
  const reason = String(parsed.reason || parsed.explanation || '').trim();
  if (!suggestedTitle) return null;
  return { suggestedTitle, reason };
}

/** Mensaje claro según el tipo de fallo de Gemini (saldo, cuota, clave, etc.). */
export function geminiErrorToUserMessage(rawError: string): string {
  const errMsg = String(rawError || '').toLowerCase();

  if (
    errMsg.includes('prepayment credits are depleted') ||
    errMsg.includes('prepayment credit') ||
    errMsg.includes('credits are depleted') ||
    (errMsg.includes('saldo') && errMsg.includes('agot'))
  ) {
    return 'Saldo de Google agotado. El administrador debe cargar créditos en AI Studio (aistudio.google.com) → tu proyecto → Comprar créditos.';
  }

  if (errMsg.includes('api key expired') || errMsg.includes('api_key_invalid') || errMsg.includes('key expired') || errMsg.includes('key invalid') || errMsg.includes('invalid authentication')) {
    return '⚠️ La clave de API de Gemini venció o es inválida. El administrador debe renovarla en Google AI Studio.';
  }

  if (errMsg.includes('429') || errMsg.includes('quota') || errMsg.includes('rate limit') || errMsg.includes('resource_exhausted')) {
    return 'La IA está procesando muchas consultas. Esperá 30 segundos e intentá de nuevo.';
  }

  if (errMsg.includes('404') || errMsg.includes('not found')) {
    return 'El modelo de IA no está disponible temporalmente. Intentá de nuevo en unos minutos.';
  }

  return 'Error temporal al conectar con la IA. Intentá de nuevo en unos segundos.';
}

/**
 * Realiza una llamada directa a la API REST de Google Gemini, omitiendo el SDK.
 * Prueba varias configuraciones (json+fast, json, plain) y hace fallback a
 * autenticación por query param para claves clásicas AIza.
 */
export async function callGeminiREST(apiKey: string, promptText: string): Promise<string> {
  // thinkingBudget: 0 desactiva la fase de "razonamiento" de gemini-2.5-flash,
  // que con prompts largos tarda 20-50s y provoca timeouts. Sin ella responde en segundos.
  const attempts: Array<{ name: string; api: string; label: string; config: Record<string, unknown> | null }> = [
    { name: 'gemini-2.5-flash', api: 'v1beta', label: 'json+fast', config: { responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } } },
    { name: 'gemini-2.5-flash', api: 'v1beta', label: 'json', config: { responseMimeType: 'application/json' } },
    { name: 'gemini-2.5-flash', api: 'v1beta', label: 'plain', config: null },
  ];
  let lastError = '';

  for (const { name, api, label, config } of attempts) {
    for (let attempt = 0; attempt < 2; attempt++) {
      console.log(`[Gemini REST] ${name} ${api} (${label}) (attempt ${attempt + 1})...`);

      try {
        const baseUrl = `https://generativelanguage.googleapis.com/${api}/models/${name}:generateContent`;
        const response = await fetch(baseUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          cache: 'no-store',
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: promptText }] }],
            ...(config ? { generationConfig: config } : {}),
          }),
          signal: AbortSignal.timeout(25000),
        });

        if ((response.status === 429 || response.status === 503) && attempt === 0) {
          lastError = `${name}: ${response.status}`;
          console.warn(`[Gemini REST] ${response.status}, retry in 2s...`);
          await new Promise((r) => setTimeout(r, 2000));
          continue;
        }

        if (!response.ok) {
          const errText = await response.text();
          lastError = `${name} (${api}): ${response.status} ${errText.substring(0, 200)}`;
          break;
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (!text) {
          lastError = `${name}: empty response`;
          break;
        }
        console.log(`[Gemini REST] ✅ ${name} (${api}) OK`);
        return text;
      } catch (fetchErr: any) {
        lastError = `${name}: ${fetchErr.message}`;
        break;
      }
    }
  }

  // Respaldo: claves AIza clásicas a veces responden solo con ?key= en la URL.
  if (apiKey.startsWith('AIza')) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: promptText }] }],
          generationConfig: { responseMimeType: 'application/json' },
        }),
        signal: AbortSignal.timeout(10000),
      });
      if (response.ok) {
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (text) {
          console.log('[Gemini REST] ✅ gemini-2.5-flash (query key fallback) OK');
          return text;
        }
      }
    } catch { /* seguimos con el error principal */ }
  }

  const keyHint = geminiKeyHint(apiKey);
  if (keyHint && (lastError.includes('401') || lastError.includes('invalid authentication'))) {
    throw new Error(keyHint);
  }
  throw new Error(`Gemini failed. Last error: ${lastError}`);
}
