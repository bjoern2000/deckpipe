import { Router } from 'express';
import { generateUnsplashImageId } from '@deckpipe/shared';
import { config } from '../config.js';
import { query } from '../db/client.js';

export const unsplashRouter = Router();

const UNSPLASH_API = 'https://api.unsplash.com';

interface UnsplashPhoto {
  id: string;
  alt_description: string | null;
  urls: { regular: string; small: string; thumb: string };
  user: { name: string; links: { html: string } };
  links: { download_location: string };
}

interface UnsplashSearchResponse {
  total: number;
  total_pages: number;
  results: UnsplashPhoto[];
}

interface StoredResult {
  id: string;
  url: string;
  url_full: string;
  url_thumb: string;
  alt: string | null;
  photographer: {
    name: string;
    profile_url: string;
  };
  attribution_html: string;
  download_location: string;
}

// Unsplash terms require attribution + UTM params on photographer + Unsplash links.
const UTM = 'utm_source=deckpipe&utm_medium=referral';

function withUtm(url: string): string {
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}${UTM}`;
}

// urls.regular from Unsplash is w=1080. For HD-canvas slides agents typically
// want bigger — swap the w= query param. Unsplash CDN respects this.
function resizeUnsplashUrl(url: string, width: number): string {
  return url.replace(/([?&])w=\d+/, `$1w=${width}`);
}

async function searchAndStore(
  searchQuery: string,
  perPage: number,
  orientation?: string,
  color?: string,
): Promise<StoredResult[]> {
  const params = new URLSearchParams({
    query: searchQuery,
    per_page: String(perPage),
    ...(orientation && { orientation }),
    ...(color && { color }),
  });

  const response = await fetch(`${UNSPLASH_API}/search/photos?${params}`, {
    headers: { Authorization: `Client-ID ${config.unsplashAccessKey}` },
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`[unsplash] search failed: ${response.status} ${text}`);
    throw new Error(`Unsplash API error: ${response.status}`);
  }

  const data = await response.json() as UnsplashSearchResponse;

  const results: StoredResult[] = [];

  for (const photo of data.results) {
    const id = generateUnsplashImageId();

    await query(
      `INSERT INTO unsplash_images (id, unsplash_id, url_regular, url_small, url_thumb, alt_description, photographer_name, photographer_url, download_location)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [id, photo.id, photo.urls.regular, photo.urls.small, photo.urls.thumb, photo.alt_description, photo.user.name, photo.user.links.html, photo.links.download_location],
    );

    const profileUrl = withUtm(photo.user.links.html);
    const unsplashUrl = withUtm('https://unsplash.com/');
    const attributionHtml = `Photo: <a href="${profileUrl}" target="_blank" rel="noopener">${photo.user.name}</a> / <a href="${unsplashUrl}" target="_blank" rel="noopener">Unsplash</a>`;

    results.push({
      id,
      url: resizeUnsplashUrl(photo.urls.regular, 1920),
      url_full: resizeUnsplashUrl(photo.urls.regular, 2400),
      url_thumb: photo.urls.thumb,
      alt: photo.alt_description,
      photographer: {
        name: photo.user.name,
        profile_url: profileUrl,
      },
      attribution_html: attributionHtml,
      download_location: photo.links.download_location,
    });
  }

  return results;
}

// GET /v1/unsplash/search?query=...&queries=[...]&per_page=5&orientation=landscape
unsplashRouter.get('/search', async (req, res) => {
  if (!config.unsplashAccessKey) {
    res.status(503).json({ error: 'Unsplash API not configured' });
    return;
  }

  const singleQuery = req.query.query as string | undefined;
  const batchQueries = req.query.queries as string | undefined;
  const perPage = Math.min(Number(req.query.per_page) || 5, 30);
  const orientation = req.query.orientation as string | undefined;
  const color = req.query.color as string | undefined;

  if (!singleQuery && !batchQueries) {
    res.status(400).json({ error: 'query or queries parameter is required' });
    return;
  }

  try {
    if (batchQueries) {
      // Batch mode: queries is a JSON array of strings
      let queries: string[];
      try {
        queries = JSON.parse(batchQueries);
        if (!Array.isArray(queries) || queries.length === 0) throw new Error();
      } catch {
        res.status(400).json({ error: 'queries must be a JSON array of strings' });
        return;
      }

      // Cap at 5 queries to avoid abuse
      queries = queries.slice(0, 5);

      const grouped: Record<string, StoredResult[]> = {};
      const searchResults = await Promise.all(
        queries.map(async (q) => ({
          query: q,
          results: await searchAndStore(q, perPage, orientation, color),
        })),
      );
      for (const { query: q, results } of searchResults) {
        grouped[q] = results;
      }

      res.json({ results: grouped });
    } else {
      // Single query mode
      const results = await searchAndStore(singleQuery!, perPage, orientation, color);
      res.json({ results });
    }
  } catch (err) {
    console.error(`[unsplash] search error:`, err);
    res.status(500).json({ error: 'Failed to search Unsplash' });
  }
});

// POST /v1/unsplash/download — trigger download tracking
unsplashRouter.post('/download', async (req, res) => {
  if (!config.unsplashAccessKey) {
    res.status(503).json({ error: 'Unsplash API not configured' });
    return;
  }

  const { download_location } = req.body as { download_location?: string };
  if (!download_location) {
    res.status(400).json({ error: 'download_location is required' });
    return;
  }

  try {
    await triggerUnsplashDownload(download_location);
    res.json({ ok: true });
  } catch (err) {
    console.error(`[unsplash] download tracking error:`, err);
    res.status(500).json({ error: 'Failed to trigger download tracking' });
  }
});

export async function triggerUnsplashDownload(downloadLocation: string) {
  if (!config.unsplashAccessKey) return;
  try {
    await fetch(downloadLocation, {
      headers: { Authorization: `Client-ID ${config.unsplashAccessKey}` },
    });
    console.log(`[unsplash] download tracked: ${downloadLocation}`);
  } catch (err) {
    console.error(`[unsplash] download tracking failed:`, err);
  }
}

/** Look up a stored unsplash image by ref ID */
export async function lookupUnsplashImage(refId: string) {
  const result = await query('SELECT * FROM unsplash_images WHERE id = $1', [refId]);
  if (result.rows.length === 0) return null;
  return result.rows[0] as {
    id: string;
    unsplash_id: string;
    url_regular: string;
    url_small: string;
    url_thumb: string;
    alt_description: string | null;
    photographer_name: string;
    photographer_url: string;
    download_location: string;
  };
}
