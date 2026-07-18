import { NextResponse } from "next/server";
import { analyzeComprehension } from "../../../../lib/comprehension";
import { isPublicUrlSafe } from "../../../../lib/urlSafety";
import { checkRateLimit } from "../../../../lib/rateLimit";
import { fetchPageHtml } from "../../../../lib/fetchPage";
import { captureAppError } from "../../../../lib/sentry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Máximo de análisis gratuitos por IP y hora (gancho de marketing, no herramienta ilimitada).
const MAX_PER_HOUR = 8;

function getClientIp(req) {
  const fwd = req.headers.get("x-forwarded-for") || "";
  const first = fwd.split(",")[0].trim();
  return first || req.headers.get("x-real-ip") || "unknown";
}

/** Proyección pública del mapa: diagnóstico completo, SIN el código (eso queda tras registro). */
function toPublicMap(map) {
  return {
    pageUrl: map.pageUrl,
    pageType: map.pageType,
    pageTypeLabel: map.pageTypeLabel,
    headline: map.headline,
    confidence: map.confidence,
    confidenceScore: map.confidenceScore,
    entities: map.entities,
    checks: map.checks.map((c) => ({
      id: c.id,
      label: c.label,
      present: c.present,
      detail: c.detail,
      applicable: c.applicable,
    })),
  };
}

export async function POST(req) {
  try {
    const ip = getClientIp(req);
    const rl = checkRateLimit(`pubcomp:${ip}`, MAX_PER_HOUR, 60 * 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json(
        {
          ok: false,
          error: `Llegaste al límite de análisis gratuitos por ahora. Registrate gratis para seguir analizando sin límite.`,
          retryAfterSec: rl.retryAfterSec,
        },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const safe = isPublicUrlSafe(body?.url || "");
    if (!safe.safe) {
      return NextResponse.json({ ok: false, error: safe.reason }, { status: 400 });
    }

    const fetched = await fetchPageHtml(safe.url);
    if (!fetched.ok) {
      // 200 con ok:false para que el cliente muestre el mensaje amigable sin tratarlo como fallo de red.
      return NextResponse.json({ ok: false, error: fetched.message }, { status: 200 });
    }

    const map = analyzeComprehension(fetched.html, safe.url);
    const offer = map.offer;

    return NextResponse.json({
      ok: true,
      map: toPublicMap(map),
      // Teaser del arreglo: se muestra QUÉ se puede corregir, nunca el código.
      offerTeaser: offer
        ? { type: offer.type, missionTitle: offer.missionTitle, description: offer.description }
        : null,
    });
  } catch (err) {
    captureAppError(err, { where: "api/public/comprehension" });
    return NextResponse.json(
      { ok: false, error: "No pudimos analizar la página en este momento. Probá de nuevo en un rato." },
      { status: 500 }
    );
  }
}
