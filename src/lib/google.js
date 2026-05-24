/**
 * Utility to interact with Google Search Console API
 * Tries multiple URL formats to find a matching property.
 */

/**
 * Generates all possible URL formats for a given user input.
 * Search Console properties can be registered in many ways.
 */
function generateUrlVariants(input) {
  // Strip protocol and trailing slashes to get the raw domain
  const raw = input
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '');

  const withWww = raw.startsWith('www.') ? raw : `www.${raw}`;
  const withoutWww = raw.startsWith('www.') ? raw.slice(4) : raw;

  return [
    `https://${withWww}/`,
    `https://${withoutWww}/`,
    `http://${withWww}/`,
    `http://${withoutWww}/`,
    `sc-domain:${withoutWww}`,
    `sc-domain:${withWww}`,
  ];
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

  const urlVariants = generateUrlVariants(siteUrl);

  console.log('--- DEBUG SEARCH CONSOLE ---');
  console.log('Input URL:', siteUrl);
  console.log('Trying variants:', urlVariants);

  for (const variant of urlVariants) {
    try {
      console.log(`Trying: ${variant}`);
      const response = await querySearchConsole(accessToken, variant, body);

      if (response.ok) {
        const data = await response.json();
        console.log(`✅ Success with "${variant}" — Found ${data.rows?.length || 0} rows`);
        return data.rows || [];
      } else {
        const errorData = await response.json();
        const code = errorData?.error?.code;
        const msg = errorData?.error?.message;
        console.log(`❌ Failed "${variant}": [${code}] ${msg}`);

        // If it's a scope/auth error (403 insufficient scopes), no point retrying variants
        if (code === 403 && msg?.includes('insufficient authentication scopes')) {
          throw new Error('MISSING_SEARCH_CONSOLE_SCOPE');
        }
      }
    } catch (err) {
      // Re-throw auth errors immediately
      if (err.message?.includes('insufficient authentication scopes')) {
        throw err;
      }
      console.error(`Error trying variant "${variant}":`, err.message);
    }
  }

  // All variants failed — return empty without throwing (URL not in Search Console)
  console.warn(`No matching Search Console property found for: ${siteUrl}`);
  return [];
}

export async function submitGoogleIndexing(accessToken, siteUrl, urlToIndex) {
  const urlVariants = generateUrlVariants(siteUrl);
  
  // Try to submit the sitemap of the site as a notification of change
  const cleanSiteUrl = siteUrl.replace(/\/$/, '');
  const sitemapUrl = `${cleanSiteUrl}/sitemap.xml`;

  console.log('--- SUBMIT INDEXING TO SEARCH CONSOLE ---');
  console.log('Site URL:', siteUrl);
  console.log('URL to Index:', urlToIndex);
  console.log('Sitemap to submit:', sitemapUrl);

  let lastError = null;

  for (const variant of urlVariants) {
    try {
      console.log(`Submitting sitemap to property variant: ${variant}`);
      const response = await fetch(
        `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(variant)}/sitemaps/${encodeURIComponent(sitemapUrl)}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (response.ok) {
        console.log(`✅ Sitemap submitted successfully to "${variant}"`);
        return { success: true, variant, message: "Indexación solicitada con éxito a través de sitemap." };
      } else {
        const errorData = await response.json().catch(() => ({}));
        const code = errorData?.error?.code;
        const msg = errorData?.error?.message;
        console.log(`❌ Failed to submit to "${variant}": [${code}] ${msg}`);
        lastError = new Error(msg || "Error en la API de Google");
      }
    } catch (err) {
      console.error(`Error trying variant "${variant}" for sitemap submission:`, err.message);
      lastError = err;
    }
  }

  throw lastError || new Error("No se pudo encontrar una propiedad de Search Console coincidente para este sitio.");
}
