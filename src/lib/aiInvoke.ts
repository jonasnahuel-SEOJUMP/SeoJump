/**
 * Helper compartido para invocar Gemini consumiendo créditos IA.
 * Extraído de actions.ts porque lo usan varias server actions (misiones,
 * quick wins, AEO, espía, sugerencias). Es un helper server-side normal:
 * lo llaman las server actions, no se expone directamente al cliente.
 */

import {
  checkAndConsumeAiCredit,
  getAiCreditsStatus,
  getCachedGeminiResponse,
  setCachedGeminiResponse,
  type AiCreditsStatus,
} from './aiCredits';
import type { AiFeature } from './planLimits';
import { callGeminiREST } from './gemini';

export type GeminiCreditResult =
  | { ok: true; text: string; credits: AiCreditsStatus }
  | {
      ok: false;
      error: string;
      code?: string;
      credits?: AiCreditsStatus;
      upgrade?: boolean;
    };

/**
 * Devuelve respuesta cacheada si existe; si no, verifica/consume crédito IA
 * y llama a Gemini. Centraliza la lógica de créditos + caché para todas las
 * funciones de IA.
 */
export async function invokeGeminiWithCredits(params: {
  email: string;
  isAdmin: boolean;
  feature: AiFeature;
  cacheKey: string;
  prompt: string;
  apiKey: string;
}): Promise<GeminiCreditResult> {
  const cached = await getCachedGeminiResponse(params.cacheKey);
  if (cached) {
    const status = await getAiCreditsStatus(params.email, { isAdmin: params.isAdmin });
    return { ok: true, text: cached, credits: status };
  }

  const creditCheck = await checkAndConsumeAiCredit(params.email, params.feature, {
    isAdmin: params.isAdmin,
  });

  if (creditCheck.allowed === false) {
    return {
      ok: false,
      error: creditCheck.error,
      code: creditCheck.code,
      credits: creditCheck.status,
      upgrade: true,
    };
  }

  const text = await callGeminiREST(params.apiKey, params.prompt);
  await setCachedGeminiResponse(params.cacheKey, text);
  return { ok: true, text, credits: creditCheck.status };
}
