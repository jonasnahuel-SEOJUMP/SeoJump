/**
 * Utility to interact with Google Search Console API
 */

const normalizeUrl = (u) => (u || '').replace(/\/$/, '').toLowerCase();

/**
 * Fetches verified sites from GSC and finds a matching property
 * using trailing slash normalization.
 */
async function getVerifiedSiteProperty(accessToken, userInputUrl) {
  const response = await fetch(
    "https://www.googleapis.com/webmasters/v3/sites",
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      signal: AbortSignal.timeout(5000),
    }
  );

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    const code = errData?.error?.code;
    const msg = errData?.error?.message;
    if (code === 403) {
      throw new Error('MISSING_SEARCH_CONSOLE_SCOPE');
    }
    throw new Error(msg || "Error al obtener las propiedades de Search Console");
  }

  const data = await response.json();
  const siteEntry = data.siteEntry || [];

  const normalizedInput = normalizeUrl(userInputUrl);

  console.log(`[GSC Match] Input URL: "${userInputUrl}" → normalized: "${normalizedInput}"`);
  console.log(`[GSC Match] User has ${siteEntry.length} GSC properties:`, siteEntry.map(s => s.siteUrl));

  // Try to find a match by comparing normalized URLs
  const match = siteEntry.find(site => {
    return normalizeUrl(site.siteUrl) === normalizedInput;
  });

  if (match) {
    console.log(`[GSC Match] ✅ Exact match: "${match.siteUrl}"`);
    return match.siteUrl; // Use exact GSC registered property URL
  }
  console.log(`[GSC Match] No exact match, trying domain fallback...`);

  // Fallback check: compare by bare domain (strip protocol + www + trailing slash)
  const domainOnly = userInputUrl
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '')
    .replace(/^www\./, '')
    .toLowerCase();

  const domainMatch = siteEntry.find(site => {
    const cleanSite = site.siteUrl
      .replace(/^sc-domain:/, '')   // strip Domain Property prefix
      .replace(/^https?:\/\//, '')  // strip protocol FIRST (was missing → www strip never worked)
      .replace(/\/$/, '')           // strip trailing slash
      .replace(/^www\./, '')        // now www is at the start — this works correctly
      .toLowerCase();
    return cleanSite === domainOnly;
  });

  if (domainMatch) {
    console.log(`[GSC Match] ✅ Domain fallback match: "${domainMatch.siteUrl}" (domainOnly="${domainOnly}")`);
    return domainMatch.siteUrl;
  }

  console.warn(`[GSC Match] ❌ No property found for "${userInputUrl}" (domainOnly="${domainOnly}"). All properties: ${siteEntry.map(s => s.siteUrl).join(', ')}`);
  return null;
}

/**
 * Diagnostica el estado de conexión con Search Console para un sitio.
 * No lanza: devuelve un objeto con el estado para que la UI guíe al usuario.
 *
 * status:
 *  - 'no_scope'    → el permiso de webmasters no fue concedido (403) o no hay token
 *  - 'no_property' → permiso OK, pero el sitio no está dado de alta/verificado en GSC
 *  - 'connected'   → el sitio está verificado y accesible
 *  - 'error'       → fallo inesperado (red, timeout)
 */
export async function getSearchConsoleConnectionStatus(accessToken, siteUrl) {
  if (!accessToken) {
    return { status: 'no_scope', matchedProperty: null, properties: [] };
  }

  let response;
  try {
    response = await fetch('https://www.googleapis.com/webmasters/v3/sites', {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    console.warn('[GSC Status] fetch falló:', err?.message || err);
    return { status: 'error', matchedProperty: null, properties: [] };
  }

  if (!response.ok) {
    if (response.status === 403 || response.status === 401) {
      return { status: 'no_scope', matchedProperty: null, properties: [] };
    }
    return { status: 'error', matchedProperty: null, properties: [] };
  }

  const data = await response.json().catch(() => ({}));
  const siteEntry = data.siteEntry || [];
  const properties = siteEntry.map((s) => s.siteUrl);

  const normalizedInput = normalizeUrl(siteUrl);
  const domainOnly = (siteUrl || '')
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '')
    .replace(/^www\./, '')
    .toLowerCase();

  const match = siteEntry.find((site) => normalizeUrl(site.siteUrl) === normalizedInput)
    || siteEntry.find((site) => {
      const cleanSite = site.siteUrl
        .replace(/^sc-domain:/, '')
        .replace(/^https?:\/\//, '')
        .replace(/\/$/, '')
        .replace(/^www\./, '')
        .toLowerCase();
      return cleanSite === domainOnly;
    });

  if (match) {
    return { status: 'connected', matchedProperty: match.siteUrl, properties };
  }

  return { status: 'no_property', matchedProperty: null, properties };
}

async function querySearchConsole(accessToken, siteUrl, body) {
  const response = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    }
  );

  return response;
}

export async function getSearchConsoleData(
  accessToken,
  siteUrl,
  goldKeyword,
  rowLimit = 10,
  options = {}
) {
  const endDate = new Date().toISOString().split('T')[0];
  const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const buildBody = (filterKeyword, limit) => {
    const body = {
      startDate,
      endDate,
      dimensions: ['page', 'query'],
      orderBy: [
        { fieldName: 'clicks', sortOrder: 'descending' },
        { fieldName: 'impressions', sortOrder: 'descending' }
      ],
      rowLimit: limit,
    };

    if (filterKeyword) {
      body.dimensionFilterGroups = [
        {
          filters: [
            {
              dimension: 'query',
              operator: 'contains',
              expression: filterKeyword
            }
          ]
        }
      ];
    }

    return body;
  };

  console.log('--- DEBUG SEARCH CONSOLE ---');
  console.log('Input URL:', siteUrl);
  if (goldKeyword) {
    console.log('Filter (query contains):', goldKeyword);
  }

  try {
    const verifiedProperty = await getVerifiedSiteProperty(accessToken, siteUrl);
    if (!verifiedProperty) {
      console.warn(`No matching Search Console property found for: ${siteUrl}`);
      return [];
    }

    console.log(`✅ Success finding matching GSC property: "${verifiedProperty}"`);

    // ── Tier 1: Exact keyword filter ──
    if (goldKeyword) {
      const response = await querySearchConsole(accessToken, verifiedProperty, buildBody(goldKeyword, rowLimit));
      if (response.ok) {
        const data = await response.json();
        const rows = data.rows || [];
        if (rows.length > 0) {
          console.log(`✅ Tier 1 (exact keyword "${goldKeyword}"): ${rows.length} rows found`);
          return rows;
        }
        console.log(`⚠️ Tier 1 returned 0 rows for "${goldKeyword}". Trying broader search...`);
      }

      // Modo rápido (Quick Wins): saltear tier 2 para ahorrar ~5s en Vercel/móvil
      if (!options?.fastMode) {
      // ── Tier 2: First word only (broader match) ──
      const firstWord = goldKeyword.trim().split(/\s+/)[0];
      if (firstWord && firstWord !== goldKeyword.trim()) {
        console.log(`🔄 Tier 2: Trying with first word "${firstWord}"...`);
        const response2 = await querySearchConsole(accessToken, verifiedProperty, buildBody(firstWord, Math.max(rowLimit, 25)));
        if (response2.ok) {
          const data2 = await response2.json();
          const rows2 = data2.rows || [];
          if (rows2.length > 0) {
            console.log(`✅ Tier 2 (first word "${firstWord}"): ${rows2.length} rows found`);
            return rows2;
          }
          console.log(`⚠️ Tier 2 also returned 0 rows.`);
        }
      }
      }

      // ── Tier 3: No keyword filter at all — get site's top queries ──
      const tier3Limit = options?.fastMode ? rowLimit : Math.max(rowLimit, 50);
      console.log(`🔄 Tier 3: Fetching top queries without any keyword filter (limit ${tier3Limit})...`);
      const response3 = await querySearchConsole(accessToken, verifiedProperty, buildBody(null, tier3Limit));
      if (response3.ok) {
        const data3 = await response3.json();
        const rows3 = data3.rows || [];
        console.log(`${rows3.length > 0 ? '✅' : '⚠️'} Tier 3 (no filter): ${rows3.length} rows found`);
        return rows3;
      }

      // If tier 3 also failed (non-ok response), return empty
      const errorData3 = await response3.json().catch(() => ({}));
      const code3 = errorData3?.error?.code;
      if (code3 === 403) {
        throw new Error('MISSING_SEARCH_CONSOLE_SCOPE');
      }
      console.log(`❌ All tiers failed for "${goldKeyword}"`);
      return [];
    }

    // No goldKeyword provided — single query without filter
    const response = await querySearchConsole(accessToken, verifiedProperty, buildBody(null, rowLimit));
    if (response.ok) {
      const data = await response.json();
      return data.rows || [];
    } else {
      const errorData = await response.json().catch(() => ({}));
      const code = errorData?.error?.code;
      const msg = errorData?.error?.message;
      console.log(`❌ Failed querySearchConsole: [${code}] ${msg}`);
      if (code === 403) {
        throw new Error('MISSING_SEARCH_CONSOLE_SCOPE');
      }
      throw new Error(msg || "Error querying Search Console data");
    }
  } catch (err) {
    if (err.message === 'MISSING_SEARCH_CONSOLE_SCOPE') {
      throw err;
    }
    console.error("Error in getSearchConsoleData:", err.message);
    return [];
  }
}

/**
 * Métricas GSC actuales para una página (+ keyword opcional), ventana ~28 días.
 */
export async function getPageQueryMetrics(accessToken, siteUrl, pageUrl, query) {
  const verifiedProperty = await getVerifiedSiteProperty(accessToken, siteUrl);
  if (!verifiedProperty || !pageUrl) return null;

  const endDate = new Date().toISOString().split('T')[0];
  const startDate = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const pageVariants = [...new Set([
    pageUrl,
    pageUrl.replace(/\/$/, ''),
    pageUrl.endsWith('/') ? pageUrl : `${pageUrl}/`,
  ].filter(Boolean))];

  for (const pageExpr of pageVariants) {
    const filters = [{ dimension: 'page', operator: 'equals', expression: pageExpr }];
    const dimensions = ['page'];

    if (query?.trim()) {
      filters.push({ dimension: 'query', operator: 'equals', expression: query.trim() });
      dimensions.push('query');
    }

    const body = {
      startDate,
      endDate,
      dimensions,
      rowLimit: 1,
      dimensionFilterGroups: [{ filters }],
    };

    try {
      const response = await querySearchConsole(accessToken, verifiedProperty, body);
      if (!response.ok) continue;
      const data = await response.json();
      const row = data.rows?.[0];
      if (!row) continue;
      return {
        clicks: row.clicks ?? 0,
        impressions: row.impressions ?? 0,
        position: row.position ?? null,
      };
    } catch {
      continue;
    }
  }

  return null;
}

export async function submitGoogleIndexing(accessToken, siteUrl, urlToIndex) {
  const cleanSiteUrl = siteUrl.replace(/\/$/, '');
  const sitemapUrl = `${cleanSiteUrl}/sitemap.xml`;

  console.log('--- SUBMIT INDEXING TO SEARCH CONSOLE ---');
  console.log('Site URL:', siteUrl);
  console.log('URL to Index:', urlToIndex);
  console.log('Sitemap to submit:', sitemapUrl);

  try {
    const verifiedProperty = await getVerifiedSiteProperty(accessToken, siteUrl);
    if (!verifiedProperty) {
      throw new Error("No se pudo encontrar una propiedad de Search Console coincidente para este sitio.");
    }

    console.log(`Submitting sitemap to property: ${verifiedProperty}`);
    const response = await fetch(
      `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(verifiedProperty)}/sitemaps/${encodeURIComponent(sitemapUrl)}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (response.ok) {
      console.log(`✅ Sitemap submitted successfully to "${verifiedProperty}"`);
      return { success: true, variant: verifiedProperty, message: "Indexación solicitada con éxito a través de sitemap." };
    } else {
      const errorData = await response.json().catch(() => ({}));
      const code = errorData?.error?.code;
      const msg = errorData?.error?.message;
      if (code === 403) {
        throw new Error('MISSING_SEARCH_CONSOLE_SCOPE');
      }
      throw new Error(msg || "Error en la API de Google");
    }
  } catch (err) {
    console.error(`Error submitting sitemap:`, err.message);
    throw err;
  }
}
