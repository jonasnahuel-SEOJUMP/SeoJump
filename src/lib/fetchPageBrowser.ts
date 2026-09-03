/**
 * fetchPageBrowser.ts — Camino de respaldo con Chromium headless.
 *
 * Usado cuando el fetch HTTP simple no alcanza (desafíos JS tipo Cloudflare).
 * Siempre valida la URL con assertSafePublicUrl antes de navegar (anti-SSRF).
 */

import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import { assertSafePublicUrl } from './urlSafety.js';

export type BrowserFetchOpts = {
  timeoutMs?: number;
  /** Inyectable en tests (mock de DNS). */
  dnsApi?: import('node:dns/promises');
};

export type BrowserFetchResult =
  | { ok: true; html: string; finalUrl?: string }
  | { ok: false; message: string };

const DEFAULT_NAV_TIMEOUT_MS = 15000;

/**
 * Descarga el HTML final renderizado con Chromium headless
 * (@sparticuz/chromium + puppeteer-core).
 */
export async function fetchPageHtmlWithBrowser(
  pageUrl: string,
  opts: BrowserFetchOpts = {}
): Promise<BrowserFetchResult> {
  const safe = await assertSafePublicUrl(pageUrl, opts.dnsApi);
  if (safe.safe === false) {
    return { ok: false, message: safe.reason };
  }

  const timeoutMs = Math.min(
    Math.max(opts.timeoutMs ?? DEFAULT_NAV_TIMEOUT_MS, 5000),
    20000
  );

  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;

  try {
    // Sin WebGL: más liviano en serverless (no extrae swiftshader).
    chromium.setGraphicsMode = false;

    const executablePath = await chromium.executablePath();
    browser = await puppeteer.launch({
      args: puppeteer.defaultArgs({ args: chromium.args, headless: 'shell' }),
      defaultViewport: {
        width: 1280,
        height: 720,
        deviceScaleFactor: 1,
      },
      executablePath,
      headless: 'shell',
      ignoreHTTPSErrors: true,
    });

    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(timeoutMs);
    page.setDefaultTimeout(timeoutMs);

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    );

    // networkidle2: espera a ≤2 conexiones por 500ms; si no llega, cae al timeout.
    const response = await page.goto(safe.url, {
      waitUntil: 'networkidle2',
      timeout: timeoutMs,
    });

    if (!response) {
      return { ok: false, message: 'El navegador no obtuvo respuesta de la página.' };
    }

    // Algunos desafíos CF terminan en 403/503; igual intentamos leer el DOM
    // por si el challenge ya resolvió y el status quedó viejo.
    const html = await page.content();
    const finalUrl = page.url() || safe.url;

    if (!html || html.replace(/<[^>]+>/g, ' ').trim().length < 20) {
      return {
        ok: false,
        message: `No pude acceder a la página (Error ${response.status()}). Verificá que la URL sea pública.`,
      };
    }

    return { ok: true, html, finalUrl };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/timeout|timed out/i.test(msg)) {
      return {
        ok: false,
        message: 'La página tardó demasiado en responder. Intentá de nuevo.',
      };
    }
    return {
      ok: false,
      message: `Error al acceder a la página con navegador: ${msg}`,
    };
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch {
        /* ignore close errors */
      }
    }
  }
}
