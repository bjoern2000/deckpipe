/**
 * Screenshot + preview endpoints. Both render through packages/api/src/services/render.ts.
 *
 *   GET  /v1/decks/:id/slides/:slideIndex/screenshot   — render an existing slide
 *   POST /v1/preview                                   — render a transient (unpersisted) slide
 *   GET  /v1/preview/:previewId                        — viewer fetches the transient deck (60s TTL)
 *   GET  /v1/preview/:previewId/screenshot             — render+return the transient slide
 */

import { Router } from 'express';
import path from 'node:path';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { z } from 'zod';
import { ApiError } from '@deckpipe/shared';
import { query } from '../db/client.js';
import { config } from '../config.js';
import { renderSlide } from '../services/render.js';
import { renderLimiter, previewLimiter } from '../middleware/rate-limiter.js';
import { validate } from '../middleware/validate.js';

export const renderRouter = Router();

// ---------- /v1/decks/:id/slides/:slideIndex/screenshot ----------

renderRouter.get('/decks/:id/slides/:slideIndex/screenshot', renderLimiter, async (req, res, next) => {
  try {
    const slideIndexRaw = String(req.params.slideIndex ?? '');
    const slideIndex = parseInt(slideIndexRaw, 10);
    if (!Number.isFinite(slideIndex) || slideIndex < 0) {
      throw new ApiError('validation_error', `slide_index must be a non-negative integer (got '${slideIndexRaw}')`, 'slide_index');
    }
    const formatParam = Array.isArray(req.query.format) ? req.query.format[0] : req.query.format;
    const format: 'png' | 'jpeg' = formatParam === 'jpeg' ? 'jpeg' : 'png';

    const result = await query(
      'SELECT deck_id, updated_at, slides FROM decks WHERE deck_id = $1',
      [req.params.id],
    );
    if (result.rows.length === 0) {
      throw new ApiError('not_found', `Deck '${req.params.id}' not found`);
    }
    const deck = result.rows[0];
    if (slideIndex >= (deck.slides?.length ?? 0)) {
      throw new ApiError('validation_error', `slide_index ${slideIndex} out of range (0-${deck.slides.length - 1})`, 'slide_index');
    }

    // Cache key includes updated_at so it invalidates on every edit.
    const stamp = new Date(deck.updated_at).getTime();
    const cacheDir = path.join(config.imageStoragePath, 'screenshots');
    const cacheFile = path.join(cacheDir, `${deck.deck_id}-${slideIndex}-${stamp}.${format}`);

    let reportPath = `${cacheFile}.report.json`;
    let cached: { png: Buffer; report: unknown } | null = null;
    try {
      const [png, reportRaw] = await Promise.all([
        fs.readFile(cacheFile),
        fs.readFile(reportPath, 'utf-8').catch(() => 'null'),
      ]);
      cached = { png, report: JSON.parse(reportRaw) };
    } catch { /* miss */ }

    let png: Buffer;
    let report: unknown;
    let durationMs = 0;
    if (cached) {
      png = cached.png;
      report = cached.report;
    } else {
      const viewerUrl = `${config.viewerUrl}/d/${deck.deck_id}?screenshot=1&slide=${slideIndex + 1}`;
      const rendered = await renderSlide({ url: viewerUrl, format });
      png = rendered.png;
      report = rendered.report;
      durationMs = rendered.duration_ms;

      await fs.mkdir(cacheDir, { recursive: true }).catch(() => {});
      await Promise.all([
        fs.writeFile(cacheFile, png),
        fs.writeFile(reportPath, JSON.stringify(rendered.report)),
      ]).catch(() => { /* cache write best-effort */ });
    }

    // Render report as JSON header — small enough for the typical report.
    res.setHeader('X-Render-Report', encodeURIComponent(JSON.stringify(report)));
    if (durationMs) res.setHeader('X-Render-Duration-Ms', String(durationMs));
    res.setHeader('Content-Type', format === 'jpeg' ? 'image/jpeg' : 'image/png');
    // Public cache so social-card crawlers (LinkedIn, Slack, Discord, etc.)
    // can hold the og:image. SSR cache-busts via ?v=<updated_at> so stale
    // copies are bypassed once a deck is edited.
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
    res.send(png);
  } catch (err) {
    next(err);
  }
});

// ---------- /v1/preview ----------
//
// A "preview deck" is held in memory for 60 seconds — long enough for the
// headless renderer to fetch it. After that it disappears. Useful for
// per-slide dry-runs from agents (preview_slide MCP tool).

interface PreviewEntry {
  expires_at: number;
  payload: PreviewPayload;
}

interface PreviewPayload {
  // canvas-slide content fields
  html: string;
  css?: string;
  js?: string;
  static_render_only?: boolean;
  // optional deck-level context so the slide can use design-system tokens
  stylesheet?: string;
  tokens?: Record<string, string>;
  head?: unknown[];
  heading_font?: string;
  body_font?: string;
}

const PREVIEW_TTL_MS = 60_000;
const previewStore = new Map<string, PreviewEntry>();

function gcPreviewStore() {
  const now = Date.now();
  for (const [id, entry] of previewStore) {
    if (entry.expires_at < now) previewStore.delete(id);
  }
}

const HeadEntrySchema = z.object({
  tag: z.enum(['link', 'script', 'style']),
  attrs: z.record(z.string()).optional(),
  body: z.string().optional(),
});

const PreviewSchema = z.object({
  html: z.string().min(1, 'html is required').max(200_000),
  css: z.string().max(100_000).optional(),
  js: z.string().max(100_000).optional(),
  static_render_only: z.boolean().optional(),
  stylesheet: z.string().max(100_000).optional(),
  tokens: z.record(z.string().max(2_000)).optional(),
  head: z.array(HeadEntrySchema).optional(),
  heading_font: z.string().max(80).optional(),
  body_font: z.string().max(80).optional(),
  format: z.enum(['png', 'jpeg']).optional(),
});

// POST /v1/preview — render a transient slide, return base64 PNG + report.
renderRouter.post('/preview', previewLimiter, validate(PreviewSchema), async (req, res, next) => {
  try {
    gcPreviewStore();
    const { format, ...payload } = req.body as z.infer<typeof PreviewSchema>;
    const previewId = `pv_${crypto.randomBytes(12).toString('base64url')}`;
    previewStore.set(previewId, {
      expires_at: Date.now() + PREVIEW_TTL_MS,
      payload,
    });

    const viewerUrl = `${config.viewerUrl}/preview/${previewId}?screenshot=1&slide=1`;
    const rendered = await renderSlide({ url: viewerUrl, format: format ?? 'png' });

    // Clean up immediately — we don't keep transient payloads after the screenshot lands.
    previewStore.delete(previewId);

    res.json({
      image: {
        base64: rendered.png.toString('base64'),
        mime_type: format === 'jpeg' ? 'image/jpeg' : 'image/png',
        width: 1920,
        height: 1080,
      },
      report: rendered.report,
      duration_ms: rendered.duration_ms,
    });
  } catch (err) {
    next(err);
  }
});

// GET /v1/preview/:previewId — the viewer fetches this in screenshot mode to
// pull the transient deck (no DB lookup). Mirrors the shape of GET /v1/decks/:id.
renderRouter.get('/preview/:previewId', (req, res) => {
  gcPreviewStore();
  const entry = previewStore.get(req.params.previewId);
  if (!entry) {
    res.status(404).json({ error: { code: 'not_found', message: 'Preview expired or never existed' } });
    return;
  }
  const p = entry.payload;
  res.json({
    deck_id: req.params.previewId,
    title: 'preview',
    heading_font: p.heading_font ?? null,
    body_font: p.body_font ?? null,
    agent_name: null,
    stylesheet: p.stylesheet ?? null,
    tokens: p.tokens ?? null,
    head: p.head ?? null,
    slides: [{
      slide_id: 'sl_preview',
      layout: 'canvas',
      content: {
        html: p.html,
        css: p.css ?? '',
        js: p.js ?? '',
        static_render_only: p.static_render_only ?? false,
      },
      comments: [],
    }],
    edit_key: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
});
