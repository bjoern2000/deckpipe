import { Router } from 'express';
import { config } from '../config.js';

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

// GET /v1/unsplash/search?query=...&per_page=9&orientation=landscape
unsplashRouter.get('/search', async (req, res) => {
  if (!config.unsplashAccessKey) {
    res.status(503).json({ error: 'Unsplash API not configured' });
    return;
  }

  const query = req.query.query as string;
  if (!query) {
    res.status(400).json({ error: 'query parameter is required' });
    return;
  }

  const params = new URLSearchParams({
    query,
    per_page: String(Math.min(Number(req.query.per_page) || 9, 30)),
    ...(req.query.page && { page: String(req.query.page) }),
    ...(req.query.orientation && { orientation: String(req.query.orientation) }),
    ...(req.query.color && { color: String(req.query.color) }),
  });

  try {
    const response = await fetch(`${UNSPLASH_API}/search/photos?${params}`, {
      headers: { Authorization: `Client-ID ${config.unsplashAccessKey}` },
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`[unsplash] search failed: ${response.status} ${text}`);
      res.status(response.status).json({ error: 'Unsplash API error' });
      return;
    }

    const data = await response.json() as UnsplashSearchResponse;

    const results = data.results.map((photo) => ({
      id: photo.id,
      urls: {
        regular: photo.urls.regular,
        small: photo.urls.small,
        thumb: photo.urls.thumb,
      },
      alt_description: photo.alt_description,
      photographer: {
        name: photo.user.name,
        url: photo.user.links.html,
      },
      download_location: photo.links.download_location,
    }));

    res.json({ total: data.total, total_pages: data.total_pages, results });
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
