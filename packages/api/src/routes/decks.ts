import { Router, type Request, type Response, type NextFunction } from 'express';
import { CreateDeckSchema, UpdateDeckSchema, generateDeckId, generateSlideId, generateEditKey, slugify, ApiError, type SlideOperation } from '@deckpipe/shared';
import { validate } from '../middleware/validate.js';
import { createDeckLimiter, getDeckLimiter, updateDeckLimiter, exportPdfLimiter } from '../middleware/rate-limiter.js';
import { query } from '../db/client.js';
import { config } from '../config.js';
import { detectUnknownFields, extractImageUrls, validateImageUrls } from '../utils/slide-warnings.js';
import { triggerUnsplashDownload, lookupUnsplashImage } from './unsplash.js';
export const decksRouter = Router();

/** Fire Unsplash download tracking for any slides with unsplash attribution, then strip download_location before storage */
function processUnsplashDownloads(slides: any[]) {
  for (const slide of slides) {
    const c = slide.content;
    if (!c) continue;

    // Top-level image_attribution
    if (c.image_attribution?.source?.toLowerCase() === 'unsplash' && c.image_attribution?.download_location) {
      triggerUnsplashDownload(c.image_attribution.download_location);
      delete c.image_attribution.download_location;
    }

    // image_gallery per-image attribution
    if (Array.isArray(c.image_details)) {
      for (const detail of c.image_details) {
        if (detail?.attribution?.source?.toLowerCase() === 'unsplash' && detail.attribution?.download_location) {
          triggerUnsplashDownload(detail.attribution.download_location);
          delete detail.attribution.download_location;
        }
      }
    }

    // team members
    if (Array.isArray(c.members)) {
      for (const member of c.members) {
        if (member?.image_attribution?.source?.toLowerCase() === 'unsplash' && member.image_attribution?.download_location) {
          triggerUnsplashDownload(member.image_attribution.download_location);
          delete member.image_attribution.download_location;
        }
      }
    }

    // comparison sides
    for (const side of ['left', 'right']) {
      if (c[side]?.image_attribution?.source?.toLowerCase() === 'unsplash' && c[side].image_attribution?.download_location) {
        triggerUnsplashDownload(c[side].image_attribution.download_location);
        delete c[side].image_attribution.download_location;
      }
    }
  }
}

/**
 * Canvas slides embed Unsplash URLs directly in HTML — there's no image_ref
 * intermediary that would normally fire download tracking. Scan the slide
 * HTML/CSS, extract any Unsplash CDN photo IDs, and trigger one download
 * ping per unique photo so we stay compliant with Unsplash's API terms.
 */
async function trackCanvasUnsplashUsage(slides: any[]) {
  const seenPhotoIds = new Set<string>();
  const photoIdRe = /images\.unsplash\.com\/(photo-[a-z0-9-]+)/gi;

  for (const slide of slides) {
    const c = slide?.content;
    if (!c) continue;
    const text = `${c.html || ''}\n${c.css || ''}`;
    let m;
    while ((m = photoIdRe.exec(text)) !== null) {
      seenPhotoIds.add(m[1]);
    }
  }

  if (seenPhotoIds.size === 0) return;

  for (const photoId of seenPhotoIds) {
    const result = await query(
      `SELECT download_location FROM unsplash_images WHERE url_regular LIKE '%' || $1 || '%' LIMIT 1`,
      [photoId],
    );
    if (result.rows.length > 0) {
      triggerUnsplashDownload(result.rows[0].download_location);
    }
  }
}

function buildAttribution(img: { photographer_name: string; photographer_url: string }) {
  return {
    name: img.photographer_name,
    url: `${img.photographer_url}?utm_source=deckpipe&utm_medium=referral`,
    source: 'Unsplash',
    source_url: 'https://unsplash.com/?utm_source=deckpipe&utm_medium=referral',
  };
}

/** Resolve image_ref / image_refs to real URLs + attribution, trigger download tracking */
async function resolveImageRefs(slides: any[]) {
  for (const slide of slides) {
    const c = slide.content;
    if (!c) continue;

    // Top-level image_ref → image_url + image_attribution
    if (c.image_ref && typeof c.image_ref === 'string') {
      const img = await lookupUnsplashImage(c.image_ref);
      if (img) {
        c.image_url = img.url_regular;
        c.image_attribution = buildAttribution(img);
        triggerUnsplashDownload(img.download_location);
      }
      delete c.image_ref;
    }

    // image_gallery: image_refs[] → images[] + image_details[].attribution
    if (Array.isArray(c.image_refs)) {
      const urls: string[] = c.images || [];
      const details: any[] = c.image_details || [];
      for (let i = 0; i < c.image_refs.length; i++) {
        const img = await lookupUnsplashImage(c.image_refs[i]);
        if (img) {
          urls.push(img.url_regular);
          details.push({ ...(details[urls.length - 1] || {}), attribution: buildAttribution(img) });
          triggerUnsplashDownload(img.download_location);
        }
      }
      c.images = urls;
      c.image_details = details;
      delete c.image_refs;
    }
  }
}

/** Resolve image_ref/image_refs in request body before validation */
async function resolveRefsMiddleware(req: Request, _res: Response, next: NextFunction) {
  try {
    if (req.body?.slides && Array.isArray(req.body.slides)) {
      await resolveImageRefs(req.body.slides);
    }
    // Also resolve in slide_operations (insert/replace slides)
    if (req.body?.slide_operations && Array.isArray(req.body.slide_operations)) {
      for (const op of req.body.slide_operations) {
        if (op.slide) await resolveImageRefs([op.slide]);
      }
    }
    next();
  } catch (err) {
    next(err);
  }
}

/** Snapshot raw body before Zod strips unrecognized fields */
function saveRawBody(req: Request, _res: Response, next: NextFunction) {
  (req as any)._rawBody = structuredClone(req.body);
  next();
}

function isPlaceholderUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.hostname === 'placehold.co' || u.hostname === 'via.placeholder.com';
  } catch { return false; }
}

function extractPlaceholderText(url: string): string {
  try {
    const u = new URL(url);
    const text = u.searchParams.get('text');
    if (text) return text.replace(/\+/g, ' ');
    // placehold.co encodes text in the path: /800x500/bg/fg?text=...
    return '';
  } catch { return ''; }
}

function convertPlaceholderUrls(slides: any[]): any[] {
  return slides.map(slide => {
    const c = { ...slide.content };

    // Convert image_url placeholder to image_prompt
    if (c.image_url && isPlaceholderUrl(c.image_url)) {
      const text = extractPlaceholderText(c.image_url);
      if (text) c.image_prompt = c.image_prompt || text;
      delete c.image_url;
    }

    // Filter placeholder URLs from image_gallery images[]
    if (Array.isArray(c.images)) {
      c.images = c.images.filter((img: string) => !isPlaceholderUrl(img));
      if (c.images.length === 0) delete c.images;
    }

    return { ...slide, content: c };
  });
}

function ensureSlideIds(slides: any[]): any[] {
  return slides.map(s => s.slide_id ? s : { ...s, slide_id: generateSlideId() });
}

// POST /v1/decks — Create a new deck
decksRouter.post('/', createDeckLimiter, resolveRefsMiddleware, saveRawBody, validate(CreateDeckSchema), async (req, res, next) => {
  try {
    const { title, heading_font, body_font, agent_name, stylesheet, head, slides: rawSlides } = req.body;
    const slides = ensureSlideIds(convertPlaceholderUrls(rawSlides));
    const deckId = generateDeckId();
    const editKey = generateEditKey();
    const slug = slugify(title);

    // Collect warnings: unknown content fields
    const warnings: string[] = [];
    const rawBody = (req as any)._rawBody;
    if (rawBody?.slides && Array.isArray(rawBody.slides)) {
      for (let i = 0; i < rawBody.slides.length; i++) {
        const raw = rawBody.slides[i];
        if (raw?.layout && raw?.content && typeof raw.content === 'object') {
          warnings.push(...detectUnknownFields(raw.layout, Object.keys(raw.content), i));
        }
      }
    }

    // Collect warnings: unreachable image URLs (non-blocking, 5s timeout per URL)
    const imageWarnings = await validateImageUrls(extractImageUrls(slides));
    warnings.push(...imageWarnings);

    // Trigger Unsplash download tracking and strip download_location before storage
    processUnsplashDownloads(slides);
    // Same for canvas slides that embed Unsplash URLs directly in HTML/CSS
    await trackCanvasUnsplashUsage(slides);

    await query(
      'INSERT INTO decks (deck_id, title, heading_font, body_font, agent_name, stylesheet, head, slides, edit_key) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
      [deckId, title, heading_font ?? null, body_font ?? null, agent_name ?? null, stylesheet ?? null, head ? JSON.stringify(head) : null, JSON.stringify(slides), editKey]
    );

    const result = await query('SELECT created_at FROM decks WHERE deck_id = $1', [deckId]);
    const shareUrl = `${config.viewerUrl}/d/${deckId}/${slug}`;

    res.status(201).json({
      deck_id: deckId,
      viewer_url: `${shareUrl}?key=${editKey}`,
      share_url: shareUrl,
      created_at: result.rows[0].created_at,
      slide_count: slides.length,
      ...(warnings.length > 0 && { warnings }),
    });
  } catch (err) {
    next(err);
  }
});

// GET /v1/decks/:id — Retrieve deck
decksRouter.get('/:id', getDeckLimiter, async (req, res, next) => {
  try {
    const result = await query('SELECT * FROM decks WHERE deck_id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      throw new ApiError('not_found', `Deck '${req.params.id}' not found`);
    }

    const deck = result.rows[0];

    // Embed open comments into each slide
    const commentsResult = await query(
      'SELECT * FROM comments WHERE deck_id = $1 AND status = $2 ORDER BY created_at ASC',
      [req.params.id, 'open']
    );
    const commentsBySlide = new Map<string, any[]>();
    for (const row of commentsResult.rows) {
      const list = commentsBySlide.get(row.slide_id) || [];
      list.push({
        id: row.id,
        content_path: row.content_path,
        status: row.status,
        messages: row.messages,
        created_at: row.created_at,
      });
      commentsBySlide.set(row.slide_id, list);
    }

    const slides = deck.slides.map((slide: any) => ({
      ...slide,
      comments: commentsBySlide.get(slide.slide_id) || [],
    }));

    res.json({
      deck_id: deck.deck_id,
      title: deck.title,
      heading_font: deck.heading_font ?? null,
      body_font: deck.body_font ?? null,
      agent_name: deck.agent_name ?? null,
      stylesheet: deck.stylesheet ?? null,
      head: deck.head ?? null,
      slides,
      edit_key: deck.edit_key,
      created_at: deck.created_at,
      updated_at: deck.updated_at,
    });
  } catch (err) {
    next(err);
  }
});

function applySlideOperations(slides: any[], operations: SlideOperation[]): any[] {
  const result = [...slides];
  for (const op of operations) {
    switch (op.op) {
      case 'delete':
        if (op.index >= result.length) {
          throw new ApiError('validation_error', `Delete index ${op.index} out of range (0-${result.length - 1})`, `slide_operations`);
        }
        result.splice(op.index, 1);
        break;
      case 'insert':
        if (op.index > result.length) {
          throw new ApiError('validation_error', `Insert index ${op.index} out of range (0-${result.length})`, `slide_operations`);
        }
        result.splice(op.index, 0, { ...op.slide, slide_id: generateSlideId() });
        break;
      case 'move': {
        if (op.from >= result.length) {
          throw new ApiError('validation_error', `Move from index ${op.from} out of range (0-${result.length - 1})`, `slide_operations`);
        }
        const [moved] = result.splice(op.from, 1);
        if (op.to > result.length) {
          throw new ApiError('validation_error', `Move to index ${op.to} out of range (0-${result.length})`, `slide_operations`);
        }
        result.splice(op.to, 0, moved);
        break;
      }
      case 'replace':
        if (op.index >= result.length) {
          throw new ApiError('validation_error', `Replace index ${op.index} out of range (0-${result.length - 1})`, `slide_operations`);
        }
        result[op.index] = { ...op.slide, slide_id: result[op.index].slide_id };
        break;
    }
  }
  return result;
}

// PATCH /v1/decks/:id — Update deck
decksRouter.patch('/:id', updateDeckLimiter, resolveRefsMiddleware, validate(UpdateDeckSchema), async (req, res, next) => {
  try {
    const existing = await query('SELECT * FROM decks WHERE deck_id = $1', [req.params.id]);
    if (existing.rows.length === 0) {
      throw new ApiError('not_found', `Deck '${req.params.id}' not found`);
    }

    const deck = existing.rows[0];
    const { title, heading_font, body_font, stylesheet, head, slides, slide_operations } = req.body;

    const warnings: string[] = [];

    // Apply updates
    const newTitle = title ?? deck.title;
    const newHeadingFont = heading_font !== undefined ? heading_font : deck.heading_font;
    const newBodyFont = body_font !== undefined ? body_font : deck.body_font;
    const newStylesheet = stylesheet !== undefined ? stylesheet : deck.stylesheet;
    const newHead = head !== undefined ? head : deck.head;
    let newSlides = ensureSlideIds(deck.slides);

    // Step 1: Apply structural slide operations (sequential, order matters)
    if (slide_operations && slide_operations.length > 0) {
      newSlides = applySlideOperations(newSlides, slide_operations);
    }

    // Step 2: Apply content edits (indices reference post-operations state)
    if (slides) {
      for (const update of slides) {
        const { index, content } = update;
        if (index < 0 || index >= newSlides.length) {
          throw new ApiError('validation_error', `Slide index ${index} out of range (0-${newSlides.length - 1})`, `slides[${index}].index`);
        }
        // Warn about unrecognized content fields for this slide's layout
        const layout = newSlides[index].layout;
        if (layout && content && typeof content === 'object') {
          warnings.push(...detectUnknownFields(layout, Object.keys(content), index));
        }
        newSlides[index] = {
          ...newSlides[index],
          content: { ...newSlides[index].content, ...content },
        };
      }
    }

    // Step 3: Clean up placeholders and validate bounds
    if (slides || slide_operations) {
      newSlides = convertPlaceholderUrls(newSlides);
    }
    if (newSlides.length < 1) {
      throw new ApiError('validation_error', 'Deck must have at least 1 slide', 'slide_operations');
    }
    if (newSlides.length > 50) {
      throw new ApiError('validation_error', 'Deck cannot have more than 50 slides', 'slide_operations');
    }

    // Validate image URLs in changed slides only
    if (slides || slide_operations) {
      const indicesToCheck = new Set<number>();
      if (slide_operations) {
        // Structural ops can shift everything — check all new/moved slides
        for (let i = 0; i < newSlides.length; i++) indicesToCheck.add(i);
      }
      if (slides) {
        for (const u of slides) indicesToCheck.add(u.index);
      }
      const slidesWithIndex = [...indicesToCheck].map(i => ({
        ...newSlides[i],
        _realIndex: i,
      }));
      const refs = extractImageUrls(slidesWithIndex).map(ref => ({
        ...ref,
        slideIndex: slidesWithIndex[ref.slideIndex]._realIndex,
      }));
      const imageWarnings = await validateImageUrls(refs);
      warnings.push(...imageWarnings);
    }

    // Trigger Unsplash download tracking and strip download_location before storage
    processUnsplashDownloads(newSlides);
    // Same for canvas slides that embed Unsplash URLs directly in HTML/CSS
    await trackCanvasUnsplashUsage(newSlides);

    await query(
      'UPDATE decks SET title = $1, heading_font = $2, body_font = $3, stylesheet = $4, head = $5, slides = $6, updated_at = NOW() WHERE deck_id = $7',
      [newTitle, newHeadingFont ?? null, newBodyFont ?? null, newStylesheet ?? null, newHead ? JSON.stringify(newHead) : null, JSON.stringify(newSlides), req.params.id]
    );

    const result = await query('SELECT * FROM decks WHERE deck_id = $1', [req.params.id]);
    const updated = result.rows[0];

    res.json({
      deck_id: updated.deck_id,
      title: updated.title,
      heading_font: updated.heading_font ?? null,
      body_font: updated.body_font ?? null,
      agent_name: updated.agent_name ?? null,
      stylesheet: updated.stylesheet ?? null,
      head: updated.head ?? null,
      slides: updated.slides,
      created_at: updated.created_at,
      updated_at: updated.updated_at,
      ...(warnings.length > 0 && { warnings }),
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /v1/decks/:id
decksRouter.delete('/:id', async (req, res, next) => {
  try {
    const result = await query('DELETE FROM decks WHERE deck_id = $1 RETURNING deck_id', [req.params.id]);
    if (result.rows.length === 0) {
      throw new ApiError('not_found', `Deck '${req.params.id}' not found`);
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// GET /v1/decks/:id/export/pdf — placeholder, implemented in Phase 7
decksRouter.get('/:id/export/pdf', exportPdfLimiter, async (_req, res) => {
  res.status(501).json({ error: { code: 'server_error', message: 'PDF export not yet implemented' } });
});
