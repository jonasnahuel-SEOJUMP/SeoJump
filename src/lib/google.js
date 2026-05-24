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
    }
  );

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    const code = errData?.error?.code;
    const msg = errData?.error?.message;
    if (code === 403 && (msg?.includes('insufficient authentication scopes') || msg?.includes('Insufficient Permission'))) {
      throw new Error('MISSING_SEARCH_CONSOLE_SCOPE');
    }
    throw new Error(msg || "Error al obtener las propiedades de Search Console");
  }

  const data = await response.json();
  const siteEntry = data.siteEntry || [];

  const normalizedInput = normalizeUrl(userInputUrl);

  // Try to find a match by comparing normalized URLs
  const match = siteEntry.find(site => {
    return normalizeUrl(site.siteUrl) === normalizedInput;
  });

  if (match) {
    return match.siteUrl; // Use exact GSC registered property URL
  }

  // Fallback check: check if it matches a domain property (e.g. sc-domain:example.com)
  const domainOnly = userInputUrl.replace(/^https?:\/\//, '').replace(/\/$/, '').replace(/^www\./, '').toLowerCase();
  const domainMatch = siteEntry.find(site => {
    const cleanSite = site.siteUrl.replace(/^sc-domain:/, '').replace(/\/$/, '').replace(/^www\./, '').toLowerCase();
    return cleanSite === domainOnly;
  });

  if (domainMatch) {
    return domainMatch.siteUrl;
  }

  return null;
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
    }
  );

  return response;
}

export async function getSearchConsoleData(accessToken, siteUrl) {
  const endDate = new Date().toISOString().split('T')[0];
  const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const body = {
    startDate,
    endDate,
    dimensions: ['page'],
    orderBy: [{ fieldName: 'clicks', sortOrder: 'ASCENDING' }], // Worst performers first
    rowLimit: 10,
  };

  console.log('--- DEBUG SEARCH CONSOLE ---');
  console.log('Input URL:', siteUrl);

  try {
    const verifiedProperty = await getVerifiedSiteProperty(accessToken, siteUrl);
    if (!verifiedProperty) {
      console.warn(`No matching Search Console property found for: ${siteUrl}`);
      return [];
    }

    console.log(`✅ Success finding matching GSC property: "${verifiedProperty}"`);
    const response = await querySearchConsole(accessToken, verifiedProperty, body);

    if (response.ok) {
      const data = await response.json();
      return data.rows || [];
    } else {
      const errorData = await response.json().catch(() => ({}));
      const code = errorData?.error?.code;
      const msg = errorData?.error?.message;
      console.log(`❌ Failed querySearchConsole: [${code}] ${msg}`);
      if (code === 403 && (msg?.includes('insufficient authentication scopes') || msg?.includes('Insufficient Permission'))) {
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
      if (code === 403 && (msg?.includes('insufficient authentication scopes') || msg?.includes('Insufficient Permission'))) {
        throw new Error('MISSING_SEARCH_CONSOLE_SCOPE');
      }
      throw new Error(msg || "Error en la API de Google");
    }
  } catch (err) {
    console.error(`Error submitting sitemap:`, err.message);
    throw err;
  }
}
