/**
 * @deckpipe/mcp-core
 *
 * Single source of truth for the deckpipe MCP tool definitions. Both the
 * remote MCP server (packages/api/src/routes/mcp.ts, mounted at /mcp) and
 * the standalone npm package (packages/mcp, published as `deckpipe-mcp`)
 * call `registerTools(server, { apiUrl })` from here.
 *
 * If you're updating a tool description, parameter schema, or the
 * instructions string — this is the only file you touch.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

export const DEPRECATED_LAYOUTS = [
  'title', 'title_and_body', 'title_and_bullets', 'title_and_table',
  'two_columns', 'section_break', 'image_and_text', 'image_gallery',
  'stats', 'quote', 'full_image', 'timeline', 'comparison', 'code',
  'callout', 'icons_and_text', 'team', 'embed', 'pros_and_cons',
  'agenda', 'swot', 'quadrant', 'venn_diagram', 'chart', 'closing',
] as const;

export const INSTRUCTIONS = `deckpipe is a slide deck rendering engine. You author each slide as HTML/CSS/JS — deckpipe renders it inside a sandboxed 1920×1080 shadow root and gives every deck a shareable viewer URL with built-in commenting.

WORKFLOW
- Use create_deck for NEW decks. Use update_deck to modify EXISTING decks.
- NEVER recreate a deck to make changes. Recreating loses the URL, edit key, and comment history. Always update in place.
- CALIBRATE DENSITY FIRST: before authoring a whole deck, build ONE representative content-heavy slide via preview_slide and look at the actual screenshot. The cover/title is the wrong slide to calibrate on — pick one that carries real text. If the user hasn't specified slide count or a reference style (Apple keynote / Pentagram case study / NYT Magazine / investor pitch / status update), ASK before committing — those signals are what tell you how much whitespace to use.
- ITERATE BEFORE COMMITTING: use preview_slide to render an HTML/CSS/JS draft and get a screenshot + render report. Both preview_slide and get_slide_screenshot return the actual rendered PNG inline — read it. The image is ground truth.
- SWEEP FOR OVERFLOWS AFTER CREATING: after create_deck, call get_slide_screenshot on every slide that carries dense text, large headlines, charts, or images. Read the "overflows" list. Any entry with reason:"off_canvas" or reason:"clipped" is a real bug — fix with update_deck before declaring the deck done. Pay special attention to slides where headlines + body + footer compete for vertical space.
- Round trip on an existing deck: get_deck (read state + open comments) → get_slide_screenshot (see how a slide actually renders) → update_deck (make changes) → reply_to_comment (explain what you changed).
- Check the "warnings" array in every create/update response.

CONTENT DENSITY
- One idea per slide. If a slide is carrying a headline + lede + tag row + callout + pull-quote + attribution, you have three slides compressed into one — split it.
- Whitespace is a design element, not wasted space. Editorial decks read better at 20 sparse slides than 12 dense ones. Prefer breathing room unless the user explicitly asked for an information-dense format.
- Headlines ≤ 8 words. One concept per paragraph. Strip ornamentation before the final pass.
- The render report's "overflows" list is a SYNTACTIC check (off-canvas elements, content clipped by overflow:hidden). It says nothing about whether the slide looks good. A wall of text with no overflows is still a wall of text — the screenshot is the only signal that catches "too dense to read". Look at the image.

THE CANVAS LAYOUT
- Every slide is { layout: "canvas", content: { html (required), css?, js?, static_render_only? } }.
- "html" is the full slide markup, rendered into a 1920×1080 frame. CSS in "css" is scoped to this slide only; for shared styles use deck.stylesheet.
- Each slide mounts in an open shadow root, so your CSS is auto-scoped — no BEM, no class prefixes.
- "js" runs on slide enter with (root, slide) in scope. Return a cleanup function for slide exit. Set static_render_only: true to skip JS in print/PDF and screenshots.

LAYOUT SAFETY (the box-sizing + footer-reserve trap)
- Open every deck.stylesheet with a universal box-sizing reset: \`*, *::before, *::after { box-sizing: border-box }\`. Without it, an element with \`height:100%; padding:Xpx\` becomes 100% + 2X in computed height and overflows its parent. This is the #1 cause of "content overlaps the footer" bugs.
- If a slide has a bottom-fixed footer/page-number row (e.g. \`position:absolute; bottom:48px\`), the in-flow content's bottom padding must clear it. A safe pattern is \`.slide { padding: 112px 128px 160px }\` so content never reaches the footer band. Same for any full-bleed slide's \`.hero-content\` analogue — its padding-bottom must reserve ~160px.
- After authoring the stylesheet, build the most VERTICALLY DENSE slide first (one with big headline + body + chart/diagram + footer) and screenshot it. If a headline + body + chart overflows, you'll see it here before propagating the same mistake to every slide.

DECK-LEVEL THEMING (define once, reference everywhere)
- stylesheet: global CSS string (up to 100KB) adopted by every canvas slide. Define your design system here. Worked example for a real 1920×1080 design system:

    *, *::before, *::after { box-sizing: border-box; }
    .slide      { width: 1920px; height: 1080px; padding: 112px 144px 160px; font-family: 'Inter', system-ui, sans-serif; color: #0f172a; background: #fafaf9; position: relative; overflow: hidden; }
    .h1         { font-family: 'Fraunces', serif; font-size: 128px; line-height: 0.98; letter-spacing: -0.03em; margin: 0; }
    .h2         { font-family: 'Fraunces', serif; font-size: 64px; line-height: 1.05; margin: 0; }
    .lead       { font-size: 32px; line-height: 1.45; color: #475569; max-width: 1500px; }
    .label      { font-family: 'JetBrains Mono', monospace; font-size: 18px; letter-spacing: 0.18em; text-transform: uppercase; color: #94a3b8; }
    .card       { padding: 56px; border-radius: 28px; background: #ffffff; border: 1px solid #e2e8f0; }
    .row        { display: flex; gap: 48px; align-items: stretch; }

  Notice the scale: padding in 100s of px, body in 24–32px, h1 in 100+px. Designs sized for a 16px-base browser look tiny at 1920×1080.
- head: array of { tag, attrs?, body? } entries injected into the page head. Load Google Fonts here as <link> entries, then set font-family in deck.stylesheet on .h1/.h2/.body classes (or whatever your design system calls them).

COMMENTING
- Reviewers can comment on ANY DOM element in a canvas slide — deckpipe auto-assigns a content_path to every element at render time.
- For comment threads that survive edits, mark target elements with data-dp-anchor="<stable-name>" (e.g. data-dp-anchor="hero-title"). Preserve those IDs in updates so threads stay attached.
- Unmarked elements get auto:<index> paths — stable within a render but may shift if you restructure. Use anchors for anything you'll iterate on.

INLINE EDITS
- The viewer's edit mode makes text-bearing leaf elements (h1, p, span, etc.) contenteditable. On blur the full html is saved back via PATCH.
- Your "js" should be resilient to text changes — find elements with selectors or data attributes, never with exact strings.

IMAGES
- search_images returns full-resolution URLs (url, url_full), photographer info, and a pre-built attribution_html snippet. Drop the url into <img src> on a canvas slide and the attribution_html into a small caption near the image. Download tracking fires server-side automatically.
- upload_image hosts your own PNG/JPG/WebP and returns a URL for <img src>.

CONTENT STYLE
- Short, crisp, scannable. Headlines ≤ 8 words. Stats abbreviated ("2.4M" not "2,400,000"). Quotes under 30 words.

LEGACY LAYOUTS
- 25 templated layouts (title, title_and_bullets, stats, chart, swot, …) are deprecated and not advertised. Existing decks using them still render. New slides should always use the "canvas" layout.`;

export interface RegisterToolsOptions {
  /** Base URL of the deckpipe REST API (no trailing slash). */
  apiUrl: string;
}

export function registerTools(server: McpServer, opts: RegisterToolsOptions): void {
  const { apiUrl } = opts;

  server.tool(
    'create_deck',
    `Create a new slide deck. Returns viewer_url (owner link with edit key) and share_url (read-only).

Each slide is a canvas slide — you write the HTML/CSS/JS directly. Slide shape:
{ layout: "canvas", content: { html (required), css?, js?, static_render_only? } }

Design checklist:
- Design at 1920×1080. The viewer scales to fit.
- Pick concrete pixel values: h1 ≈ 96–128px, body ≈ 24–32px, padding ≈ 96–144px, gap ≈ 32–64px. Designs sized for a 16px browser look tiny at HD.
- ONE IDEA PER SLIDE. If a slide has a headline + lede + tags + callout + quote + attribution, split it into two or three. Whitespace is a design element. For editorial decks, prefer 20 sparse slides over 12 dense ones unless the user asked for dense.
- BUILD ONE REPRESENTATIVE SLIDE FIRST. Pick a content-heavy slide (not the cover), preview_slide it, look at the actual screenshot, calibrate density, THEN author the rest at that bar. Don't preview the cover and assume the body slides will be fine.
- If the brief is vague ("hi-fi", "make it visual"), ASK for a reference (Apple keynote / Pentagram case study / NYT Magazine / investor pitch / status update) and a slide count before committing.
- Define shared styles ONCE in deck.stylesheet (typography, color tokens, .card/.grid/.hero classes). Reference them from each slide's html.
- Mark commentable elements with data-dp-anchor="<stable-id>" so feedback threads survive edits.
- Optional "js" runs (root, slide) on slide enter — return a cleanup function. Set static_render_only: true to freeze animations in print/PDF and screenshots.
- VERIFY BEFORE COMMITTING: call preview_slide with your draft html/css/js and read both the screenshot and the render report. After creation, call get_slide_screenshot on any slide you didn't preview — it returns the image inline so you can SEE what reviewers see.

IMPORTANT:
- To modify this deck later, use update_deck. NEVER create a new deck to make changes — it loses the URL and comment history.
- To iterate: get_deck (read state + comments) → get_slide_screenshot (see actual render) → update_deck → reply_to_comment.
- Check the "warnings" array and fix issues with a follow-up update_deck call.`,
    {
      title: z.string().describe('Deck title'),
      agent_name: z.string().optional().describe('Your agent name (e.g. "Acme Strategy Agent"). Shown as author on comments you post. Set this once at deck creation.'),
      stylesheet: z.string().optional().describe('Global CSS adopted by every canvas slide via shadow-root adoptedStyleSheets. Define your design system once (typography, components, color tokens) and reference classes from each slide.'),
      head: z.array(z.object({
        tag: z.enum(['link', 'script', 'style']),
        attrs: z.record(z.string()).optional(),
        body: z.string().optional(),
      })).optional().describe('Array of <link>/<script>/<style> entries injected into the page head. Use for Google Fonts links, icon-font stylesheets, or trusted CDN scripts your js depends on.'),
      slides: z.array(z.object({
        layout: z.literal('canvas').describe('Always "canvas". (25 legacy templated layouts exist but are deprecated for new content — see CLAUDE.md to re-enable.)'),
        content: z.object({
          html: z.string().describe('Required. Slide markup. Designed at 1920×1080, mounted in a shadow root.'),
          css: z.string().optional().describe('Optional per-slide CSS, scoped to this slide. For shared styles use deck.stylesheet instead.'),
          js: z.string().optional().describe('Optional JS. Runs on slide enter with (root, slide). Return a cleanup function. Don\'t rely on exact text strings — reviewers can edit text inline.'),
          static_render_only: z.boolean().optional().describe('If true, "js" is skipped in print/PDF and screenshots. Use for animations that should freeze on export.'),
        }).passthrough(),
      })).describe('Array of canvas slides. Each slide is HTML/CSS/JS the agent authors.'),
    },
    { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    async (args) => {
      try {
        const res = await fetch(`${apiUrl}/v1/decks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(args),
        });
        const data = await res.json();
        if (!res.ok) {
          return { content: [{ type: 'text' as const, text: `Error: ${JSON.stringify(data)}` }] };
        }
        return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text' as const, text: `Error: ${err}` }] };
      }
    }
  );

  server.tool(
    'get_deck',
    `Retrieve a deck by ID. Returns all slides with their current content, including any edits made by the user in the viewer.

Each slide includes a comments[] array with open comments. Each comment has: id, content_path (e.g. "title", "bullets[2]", "slide" for general), status, messages[] thread, and created_at.`,
    { deck_id: z.string().describe('The deck ID (e.g. "dk_a1b2c3d4")') },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    async ({ deck_id }) => {
      const res = await fetch(`${apiUrl}/v1/decks/${deck_id}`);
      const data = await res.json();
      if (!res.ok) return { content: [{ type: 'text' as const, text: `Error: ${JSON.stringify(data)}` }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'update_deck',
    `Update an existing deck. Two parameters for two purposes:

1. "slide_operations" — structural changes (insert, delete, move, replace). The ONLY way to add new slides.
2. "slides" — content edits to existing slides by index (partial merge of the content object). Does NOT add slides.

slide_operations execute first, then slides content edits apply to the resulting array.

slide_operations examples:
- Insert: { "op": "insert", "index": 5, "slide": { "layout": "canvas", "content": { "html": "<div class=\\"slide\\">...</div>", "css": "...", "js": "..." } } }
- Delete: { "op": "delete", "index": 2 }
- Move: { "op": "move", "from": 0, "to": 3 }
- Replace: { "op": "replace", "index": 4, "slide": { "layout": "canvas", "content": { "html": "..." } } }

slides (content edit) examples:
- Replace the html of slide 0: { "index": 0, "content": { "html": "<div class=\\"slide\\">new markup</div>" } }
- Tweak the css of slide 2: { "index": 2, "content": { "css": ".card { border-radius: 24px; }" } }
- Both are PARTIAL merges into the existing content object — other fields (js, static_render_only, etc.) are preserved.

Editing existing decks that use the deprecated templated layouts is supported (the REST API still accepts them); just patch their content fields directly. New slides should be canvas.`,
    {
      deck_id: z.string().describe('Deck ID to update'),
      title: z.string().optional().describe('New deck title'),
      stylesheet: z.string().nullable().optional().describe('Replace the deck-level global CSS string used by canvas slides. Pass null to clear.'),
      head: z.array(z.object({
        tag: z.enum(['link', 'script', 'style']),
        attrs: z.record(z.string()).optional(),
        body: z.string().optional(),
      })).nullable().optional().describe('Replace the deck-level head entries. Pass null to clear.'),
      slide_operations: z.array(z.object({
        op: z.enum(['delete', 'insert', 'move', 'replace']).describe('Operation type: "insert" adds a new slide, "delete" removes one, "move" reorders, "replace" swaps layout+content'),
        index: z.number().optional().describe('Target slide index. Required for insert (position to insert at), delete, and replace.'),
        from: z.number().optional().describe('Source index. Only for move.'),
        to: z.number().optional().describe('Destination index. Only for move.'),
        slide: z.object({
          layout: z.literal('canvas').describe('New slides must use the canvas layout. Templated layouts are deprecated for new content.'),
          content: z.object({
            html: z.string().describe('Required slide markup, designed at 1920×1080.'),
            css: z.string().optional(),
            js: z.string().optional(),
            static_render_only: z.boolean().optional(),
          }).passthrough().describe('Canvas content object — { html, css?, js?, static_render_only? }.'),
        }).optional().describe('The new slide to add. Required for insert and replace.'),
      })).optional().describe('Structural changes: add, remove, reorder, or replace slides. Use this to INSERT NEW SLIDES — do not recreate the deck.'),
      slides: z.array(z.object({
        index: z.number().describe('Zero-based slide index (post-operations)'),
        content: z.record(z.unknown()).describe('Partial content to merge'),
      })).optional().describe('Content edits by index (applied after slide_operations)'),
    },
    { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    async ({ deck_id, ...body }) => {
      const res = await fetch(`${apiUrl}/v1/decks/${deck_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) return { content: [{ type: 'text' as const, text: `Error: ${JSON.stringify(data)}` }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'delete_deck',
    'Delete a deck permanently.',
    { deck_id: z.string().describe('Deck ID to delete') },
    { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
    async ({ deck_id }) => {
      const res = await fetch(`${apiUrl}/v1/decks/${deck_id}`, { method: 'DELETE' });
      if (res.status === 204) return { content: [{ type: 'text' as const, text: `Deck ${deck_id} deleted successfully.` }] };
      const data = await res.json();
      return { content: [{ type: 'text' as const, text: `Error: ${JSON.stringify(data)}` }] };
    }
  );

  server.tool(
    'upload_image',
    `Upload a base64-encoded image (PNG/JPG/WebP, max 10MB) to get a hosted URL for use in slide image_url fields.`,
    {
      image_data: z.string().describe('Base64-encoded image data'),
      filename: z.string().describe('Filename with extension (e.g. "photo.jpg")'),
      content_type: z.enum(['image/png', 'image/jpeg', 'image/webp']).describe('MIME type'),
    },
    { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    async ({ image_data, filename, content_type }) => {
      const buffer = Buffer.from(image_data, 'base64');
      const blob = new Blob([buffer], { type: content_type });
      const form = new FormData();
      form.append('file', blob, filename);
      const res = await fetch(`${apiUrl}/v1/images`, { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) return { content: [{ type: 'text' as const, text: `Error: ${JSON.stringify(data)}` }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'search_images',
    `Search Unsplash for stock photos. Each result includes everything you need to embed the image with proper attribution — no round-trip required.

Returned per result:
- url           — 1920px wide, ready for <img src=""> on a canvas slide
- url_full      — 2400px wide, for full-bleed hero images
- url_thumb     — 400px wide, for thumbnails or low-priority spots
- alt           — Unsplash's alt text, drop into <img alt="">
- photographer  — { name, profile_url } (UTM params already attached)
- attribution_html — pre-built credit snippet ("Photo: <a>Name</a> / <a>Unsplash</a>") — drop near the image
- download_location — Unsplash tracking URL. You don't need to call it. Deckpipe fires the download ping server-side when it sees the URL in your slide HTML on create_deck/update_deck.

Use the "queries" parameter to search for multiple terms in one call (e.g. one per slide) instead of making separate calls — results are grouped by query.

Attribution is required by Unsplash terms. Drop attribution_html into a small caption near every image you use (a footer line, a corner overlay, etc.). Do not strip the UTM params from photographer.profile_url.`,
    {
      query: z.string().optional().describe('Single search query (e.g. "modern office workspace"). Use this OR queries, not both.'),
      queries: z.array(z.string()).max(5).optional().describe('Multiple search queries in one call (max 5). Results grouped by query. More efficient than separate calls.'),
      per_page: z.number().min(1).max(30).optional().describe('Results per query (default 5, max 30)'),
      orientation: z.enum(['landscape', 'portrait', 'squarish']).optional().describe('Filter by orientation. Use "landscape" for full_image/image_and_text, "portrait" for image_gallery.'),
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    async ({ query, queries, per_page, orientation }) => {
      try {
        const params = new URLSearchParams();
        if (query) params.set('query', query);
        if (queries) params.set('queries', JSON.stringify(queries));
        if (per_page) params.set('per_page', String(per_page));
        if (orientation) params.set('orientation', orientation);
        const res = await fetch(`${apiUrl}/v1/unsplash/search?${params}`);
        const data = await res.json();
        if (!res.ok) return { content: [{ type: 'text' as const, text: `Error: ${JSON.stringify(data)}` }] };
        return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return { content: [{ type: 'text' as const, text: `Error: ${err}` }] };
      }
    }
  );

  server.tool(
    'list_layouts',
    'Describe the slide layouts and deck-level customization fields. New content uses a single layout — "canvas" — where you author HTML/CSS/JS directly.',
    {},
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    async () => {
      const layouts = [
        {
          name: 'canvas',
          description: 'Agent-authored HTML/CSS/JS rendered in a 1920×1080 shadow-rooted sandbox. The ONLY layout for new content.',
          fields: 'html (required), css?, js?, static_render_only?',
        },
      ];
      const customization = {
        stylesheet: 'Deck-level global CSS adopted by every canvas slide via shadow-root adoptedStyleSheets. Define your design system once and reference it from each slide. Up to 100KB.',
        head: 'Array of <link>/<script>/<style> entries injected into the page head. Load Google Fonts (or icon-font stylesheets, or trusted CDN scripts) here. Then set font-family in deck.stylesheet on your typography classes.',
      };
      const style_guide = {
        canvas: [
          'Design at 1920×1080 — the viewer scales the slide to fit.',
          'Pick concrete pixel values: h1 ≈ 96–128px, body ≈ 24–32px, padding ≈ 96–144px, gap ≈ 32–64px. Designs sized for a 16px-base browser look tiny at HD.',
          'Each canvas slide is mounted into an open shadow root, so your CSS is auto-scoped — no need for BEM/prefixes. No CSS framework ships by default; use deck.stylesheet for shared utilities and per-slide css for overrides.',
          'Define reusable styles once in deck.stylesheet (e.g. .hero, .card, .stat). Reference them from each slide\'s html instead of duplicating CSS per slide.',
          'Mark commentable elements with data-dp-anchor="<stable-id>" (e.g. <h1 data-dp-anchor="hero-title">). Preserve these IDs across edits so comment threads remain attached.',
          'Reviewers can comment on ANY DOM element — unmarked elements get auto:<index> paths that are stable within a render but may shift across structural edits. Use anchors for anything you\'ll iterate on.',
          'Reviewers can also edit text inline via the viewer\'s edit mode. Your js should not rely on exact text strings — use selectors or data attributes.',
          'js runs when the slide enters view. Signature: (root, slide) => optional cleanup function. Use for animations, interactivity. Set static_render_only: true to skip JS in print/PDF and screenshots.',
          'Verify before committing: use preview_slide to render an HTML/CSS/JS draft and get a screenshot + render report (JS errors, overflows). Cheap, doesn\'t persist anything.',
          'Do NOT load arbitrary user-controlled scripts; the canvas runs in the parent JS context, not an iframe.',
        ],
        images: 'Use search_images for Unsplash photos (returns full-res URLs + a pre-built attribution_html snippet — drop both into the slide; download tracking happens server-side) or upload_image for your own files.',
      };
      const deprecated_layouts = {
        note: 'These 25 templated layouts existed in deckpipe 0.2 and earlier. They are deprecated for new content and intentionally hidden from this listing. Existing decks using them still render unchanged, and the REST API still accepts them. To re-enable them in the MCP surface, see CLAUDE.md → "Resurrecting deprecated layouts".',
        names: DEPRECATED_LAYOUTS,
      };
      return { content: [{ type: 'text' as const, text: JSON.stringify({ layouts, customization, style_guide, deprecated_layouts }, null, 2) }] };
    }
  );

  server.tool(
    'list_comments',
    `List comments on a deck. Returns comment objects with: id, slide_id, content_path (e.g. "title", "bullets[2]", "slide"), status ("open"/"resolved"), messages[] thread, created_at, updated_at.

Use the "since" parameter with an ISO timestamp to only fetch comments added or updated since your last check.`,
    {
      deck_id: z.string().describe('The deck ID'),
      status: z.enum(['open', 'resolved']).optional().describe('Filter by status. Defaults to showing all. Use "open" to see only unresolved feedback.'),
      slide_id: z.string().optional().describe('Filter to a specific slide by its stable slide_id (e.g. "sld_a1b2c3d4")'),
      since: z.string().optional().describe('ISO timestamp. Only return comments created or updated since this time. Use this to poll for new feedback efficiently.'),
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    async ({ deck_id, status, slide_id, since }) => {
      const qs = new URLSearchParams();
      if (status) qs.set('status', status);
      if (slide_id) qs.set('slide_id', slide_id);
      if (since) qs.set('since', since);
      const url = `${apiUrl}/v1/decks/${deck_id}/comments${qs.toString() ? '?' + qs : ''}`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) return { content: [{ type: 'text' as const, text: `Error: ${JSON.stringify(data)}` }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'reply_to_comment',
    `Reply to a comment thread. Keep replies concise — summarize what you changed, don't repeat the feedback.`,
    {
      deck_id: z.string().describe('The deck ID'),
      comment_id: z.string().describe('The comment ID to reply to (e.g. "cmt_a1b2c3d4e5f6")'),
      body: z.string().describe('Your reply message'),
      author_name: z.string().optional().describe('Your agent name. Defaults to the agent_name set at deck creation, or "Agent" if none was set.'),
    },
    { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    async ({ deck_id, comment_id, body, author_name }) => {
      let name = author_name;
      if (!name) {
        try {
          const deckRes = await fetch(`${apiUrl}/v1/decks/${deck_id}`);
          if (deckRes.ok) {
            const deck = await deckRes.json() as Record<string, unknown>;
            name = (deck.agent_name as string) || 'Agent';
          }
        } catch { /* fall through */ }
        name = name || 'Agent';
      }
      const res = await fetch(`${apiUrl}/v1/decks/${deck_id}/comments/${comment_id}/replies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ author_name: name, author_type: 'agent', body }),
      });
      const data = await res.json();
      if (!res.ok) return { content: [{ type: 'text' as const, text: `Error: ${JSON.stringify(data)}` }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'preview_slide',
    `Render a single canvas slide without persisting anything. Returns a PNG screenshot (base64) plus a render report (JS errors, console errors, text overflows, font load status, failed network requests).

Use this to iterate on slide html/css/js BEFORE calling create_deck or update_deck. The render runs through the real viewer pipeline at 1920×1080 — exactly what reviewers will see. Catches:
- JS errors thrown by your "js"
- console.error / console.warn output
- elements that are off-canvas (bounding rect extends past 1920×1080) or clipped (overflow: hidden/scroll/auto with overflowing content). Each entry in report.overflows includes a "reason" field: "off_canvas" or "clipped".
- Google Fonts that didn't load (typo in font name, missing head entry)
- failed image / asset requests

The overflows list does NOT report benign rendering bleed (italic descenders, negative letter-spacing on serif headings, etc.) when nothing is actually clipped. If the report comes back clean but the screenshot looks wrong, trust the screenshot — overflows is a syntactic check, the image is the visual truth.

Common workflow:
1. Draft html/css/js for one slide.
2. preview_slide → READ THE SCREENSHOT, then inspect report.overflows and report.js_errors.
3. Fix issues, preview again.
4. Once clean, include the slide in create_deck (or update_deck).

The screenshot is the slide alone — no viewer chrome.`,
    {
      html: z.string().describe('Slide HTML (the markup that would go in content.html).'),
      css: z.string().optional().describe('Optional per-slide CSS, scoped to this slide.'),
      js: z.string().optional().describe('Optional per-slide JS. Runs with (root, slide). Skipped if static_render_only=true (which screenshot mode forces).'),
      static_render_only: z.boolean().optional().describe('Set true to skip your "js" during the preview render. Useful to isolate CSS/HTML issues.'),
      stylesheet: z.string().optional().describe('Deck-level CSS to adopt (mirrors deck.stylesheet). Use this so the preview matches your actual design system.'),
      head: z.array(z.object({
        tag: z.enum(['link', 'script', 'style']),
        attrs: z.record(z.string()).optional(),
        body: z.string().optional(),
      })).optional().describe('Deck-level head entries (Google Fonts links, etc.). Same shape as deck.head.'),
      format: z.enum(['png', 'jpeg']).optional().describe('Image format. Defaults to png.'),
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    async (args) => {
      try {
        const res = await fetch(`${apiUrl}/v1/preview`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(args),
        });
        const data = await res.json();
        if (!res.ok) return { content: [{ type: 'text' as const, text: `Error: ${JSON.stringify(data)}` }] };
        const img = data.image;
        const report = data.report;
        return {
          content: [
            {
              type: 'image' as const,
              data: img.base64,
              mimeType: img.mime_type,
            },
            {
              type: 'text' as const,
              text: `Render report:\n${JSON.stringify(report, null, 2)}\n\nDuration: ${data.duration_ms}ms`,
            },
          ],
        };
      } catch (err) {
        return { content: [{ type: 'text' as const, text: `Error: ${err}` }] };
      }
    }
  );

  server.tool(
    'get_slide_screenshot',
    `Render a specific slide of an existing deck and return the PNG inline (base64) so you can see exactly what reviewers see. Also returns a render report (JS errors, text overflows, font load status). Results are cached on deck.updated_at — instant for unchanged slides.

Use after update_deck to verify a change actually rendered the way you intended, or to inspect a slide a reviewer commented on. The screenshot is the slide alone, at 1920×1080, no viewer chrome.

The render report's overflow list is a syntactic check, not a visual one. Each overflow entry now includes a "reason" field ("off_canvas" or "clipped") so you know whether something is actually getting cut off. The image is ground truth — read it before iterating.`,
    {
      deck_id: z.string().describe('The deck ID (e.g. "dk_a1b2c3d4")'),
      slide_index: z.number().int().min(0).describe('Zero-based slide index.'),
      format: z.enum(['png', 'jpeg']).optional().describe('Image format. Defaults to png.'),
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    async ({ deck_id, slide_index, format }) => {
      try {
        const fmt = format ?? 'png';
        const url = `${apiUrl}/v1/decks/${deck_id}/slides/${slide_index}/screenshot?format=${fmt}`;
        const res = await fetch(url);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          return { content: [{ type: 'text' as const, text: `Error: ${JSON.stringify(data)}` }] };
        }
        const reportHeader = res.headers.get('x-render-report');
        const durationHeader = res.headers.get('x-render-duration-ms');
        const report = reportHeader ? JSON.parse(decodeURIComponent(reportHeader)) : null;
        const mimeType = fmt === 'jpeg' ? 'image/jpeg' : 'image/png';
        const buffer = Buffer.from(await res.arrayBuffer());
        return {
          content: [
            {
              type: 'image' as const,
              data: buffer.toString('base64'),
              mimeType,
            },
            {
              type: 'text' as const,
              text: `Render report:\n${JSON.stringify(report, null, 2)}${durationHeader ? `\n\nDuration: ${durationHeader}ms` : ''}`,
            },
          ],
        };
      } catch (err) {
        return { content: [{ type: 'text' as const, text: `Error: ${err}` }] };
      }
    }
  );

  server.tool(
    'resolve_comment',
    `Resolve a comment, marking it as addressed. Only resolve when explicitly asked — let the user confirm satisfaction first.`,
    {
      deck_id: z.string().describe('The deck ID'),
      comment_id: z.string().describe('The comment ID to resolve'),
    },
    { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    async ({ deck_id, comment_id }) => {
      const res = await fetch(`${apiUrl}/v1/decks/${deck_id}/comments/${comment_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'resolved' }),
      });
      const data = await res.json();
      if (!res.ok) return { content: [{ type: 'text' as const, text: `Error: ${JSON.stringify(data)}` }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );
}
