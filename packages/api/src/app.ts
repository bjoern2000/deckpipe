import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { decksRouter } from './routes/decks.js';
import { commentsRouter } from './routes/comments.js';
import { imagesRouter } from './routes/images.js';
import { mcpRouter } from './routes/mcp.js';
import { adminRouter } from './routes/admin.js';
import { unsplashRouter } from './routes/unsplash.js';
import { errorHandler } from './middleware/error-handler.js';
import { basicAuth } from './middleware/basic-auth.js';
import { query } from './db/client.js';
import { config } from './config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);

  app.use(cors());

  // Request logging
  app.use((req, _res, next) => {
    if (req.path !== '/health') {
      console.log(`[api] ${req.method} ${req.path}`);
    }
    next();
  });

  // MCP endpoint (before JSON parser — transport reads raw body)
  app.use('/mcp', mcpRouter);

  app.use(express.json({ limit: '1mb' }));

  // Routes
  app.use('/v1/decks', decksRouter);
  app.use('/v1/decks/:id/comments', commentsRouter);
  app.use('/v1/images', imagesRouter);
  app.use('/v1/unsplash', unsplashRouter);

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Admin panel
  app.use('/admin', basicAuth, adminRouter);

  // Serve viewer static files in production
  const viewerDist = path.resolve(__dirname, '../../viewer/dist');
  if (fs.existsSync(viewerDist)) {
    // Landing page at root
    const landingPage = path.join(viewerDist, 'landing.html');
    if (fs.existsSync(landingPage)) {
      app.get('/', (_req, res) => {
        res.sendFile(landingPage);
      });
    }

    // Inject OG meta tags for deck URLs (link previews in Slack, Discord, etc.)
    app.get('/d/:deckId/:slug?', async (req, res) => {
      const htmlPath = path.join(viewerDist, 'index.html');
      let htmlContent = fs.readFileSync(htmlPath, 'utf-8');

      try {
        const result = await query('SELECT title, slides FROM decks WHERE deck_id = $1', [req.params.deckId]);
        if (result.rows.length > 0) {
          const deck = result.rows[0];
          const deckUrl = `${config.viewerUrl}/d/${req.params.deckId}`;
          const slideCount = deck.slides?.length ?? 0;
          const description = `${slideCount}-slide deck — view and edit on deckpipe`;

          // Find first available image from slides for og:image
          let ogImage = '';
          for (const slide of deck.slides || []) {
            const url = slide.content?.image_url;
            if (url) { ogImage = url; break; }
            const images = slide.content?.images;
            if (Array.isArray(images) && images.length > 0) { ogImage = images[0]; break; }
          }

          const ogTags = [
            `<meta name="robots" content="noindex, nofollow" />`,
            `<meta property="og:title" content="${escapeHtml(deck.title)}" />`,
            `<meta property="og:description" content="${escapeHtml(description)}" />`,
            `<meta property="og:url" content="${escapeHtml(deckUrl)}" />`,
            `<meta property="og:type" content="website" />`,
            `<meta name="twitter:card" content="summary" />`,
            `<meta name="twitter:title" content="${escapeHtml(deck.title)}" />`,
            `<meta name="twitter:description" content="${escapeHtml(description)}" />`,
            ogImage ? `<meta property="og:image" content="${escapeHtml(ogImage)}" />` : '',
            ogImage ? `<meta name="twitter:image" content="${escapeHtml(ogImage)}" />` : '',
            `<title>${escapeHtml(deck.title)} — deckpipe</title>`,
          ].filter(Boolean).join('\n    ');

          htmlContent = htmlContent.replace('</head>', `    ${ogTags}\n  </head>`);
        }
      } catch {
        // On error, serve plain index.html without OG tags
      }

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(htmlContent);
    });

    app.use(express.static(viewerDist));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(viewerDist, 'index.html'));
    });
  }

  // Error handler (must be last)
  app.use(errorHandler);

  return app;
}
