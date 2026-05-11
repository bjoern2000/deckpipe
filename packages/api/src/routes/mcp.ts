import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { Router } from 'express';
import { config } from '../config.js';

const INSTRUCTIONS = `Deckpipe is a slide deck rendering engine. You author each slide as HTML/CSS/JS — Deckpipe renders it inside a sandboxed 1920×1080 shadow root, themes it via deck-level CSS variables, and gives every deck a shareable viewer URL with built-in commenting.

WORKFLOW
- Use create_deck for NEW decks. Use update_deck to modify EXISTING decks.
- NEVER recreate a deck to make changes. Recreating loses the URL, edit key, and comment history. Always update in place.
- To iterate: get_deck (read current state + comments) → update_deck (make changes) → reply_to_comment (explain what you changed).
- Check the "warnings" array in every create/update response. Fix unrecognized fields or unreachable image URLs with a follow-up update_deck call.

THE CANVAS LAYOUT
- Every slide is { layout: "canvas", content: { html (required), css?, js?, static_render_only?, key_takeaway? } }.
- "html" is the full slide markup. Design at 1920×1080 — the viewer scales the slide to fit. CSS in "css" is scoped to this slide only; for shared styles use deck.stylesheet.
- Each slide mounts in an open shadow root, so your CSS is auto-scoped — no need for BEM or class prefixes.
- CSS variables forwarded into every slide: var(--dp-accent), var(--dp-text-title), var(--dp-text-body), var(--dp-font-heading), var(--dp-font-body). Use these so accent_color and font choices stay consistent across the deck.
- "js" runs on slide enter with (root, slide) in scope. Return a cleanup function to run on slide exit (clear timers, detach listeners). Set static_render_only: true to skip JS in print/PDF.

DECK-LEVEL THEMING
- stylesheet: global CSS string adopted by every canvas slide. Define your design system once (typography, color tokens, reusable card/grid classes) and reference it from each slide's html. Up to 100KB.
- head: array of { tag, attrs?, body? } entries injected into the page head. Use to load CDN libraries (Tailwind, Chart.js, icon fonts) that canvas slides depend on. Example: [{ tag: "script", attrs: { src: "https://cdn.tailwindcss.com" } }].
- accent_color / heading_font / body_font are forwarded as CSS variables.

COMMENTING
- Reviewers can leave comments on ANY DOM element in a canvas slide — Deckpipe auto-assigns a content_path to every element at render time.
- To make a comment thread STABLE across edits, mark the target element with data-dp-anchor="<stable-name>" (e.g. data-dp-anchor="hero-title"). Preserve those IDs across updates so the thread stays attached.
- Comments on unmarked elements use auto:<index> paths that are stable within a render but may shift if you restructure the HTML. Use anchors for anything you'll iterate on.

INLINE EDITS
- The viewer's edit mode makes text-bearing leaf elements (h1, p, span, etc.) contenteditable. On blur the full html is saved back via PATCH.
- Your "js" should be resilient to text changes — don't rely on exact text strings to find elements; use selectors or data attributes.

IMAGES
- Use search_images to find stock photos (Unsplash). The returned id is for use as image_ref via REST; in canvas slides, also fine to use the returned url directly in your <img src>. Attribution/download tracking still applies — include a credit caption.
- Use upload_image to host your own images (PNG/JPG/WebP, base64-encoded). Returns a hosted URL you can put in <img src>.

CONTENT STYLE
- Keep text short, crisp, and scannable. Use shorthand phrases, not full sentences.
- Stats: abbreviate ("2.4M" not "2,400,000"). Quotes: under 30 words. Headlines: ≤ 8 words.
- All text fields support markdown in key_takeaway. The html field is raw HTML.

LEGACY LAYOUTS
- 25 templated layouts (title, title_and_bullets, stats, chart, swot, …) are deprecated and not advertised here. Existing decks using them still render unchanged. New slides should always use the "canvas" layout.`;

function registerTools(server: McpServer) {
  server.tool(
    'create_deck',
    `Create a new slide deck. Returns viewer_url (owner link with edit key) and share_url (read-only).

Each slide is a canvas slide — you write the HTML/CSS/JS directly. Slide shape:
{ layout: "canvas", content: { html (required), css?, js?, static_render_only?, key_takeaway? } }

Design checklist:
- Design at 1920×1080. The viewer scales to fit.
- Define shared styles ONCE in deck.stylesheet (typography, color tokens, .card/.grid/.hero classes). Reference them from each slide's html.
- Use CSS variables already provided: var(--dp-accent), var(--dp-text-title), var(--dp-text-body), var(--dp-font-heading), var(--dp-font-body). Don't hardcode the accent color — it's set by the accent_color field.
- For Tailwind: add { tag: "script", attrs: { src: "https://cdn.tailwindcss.com" } } to deck.head. Other CDN libs (Chart.js, Lottie, icon fonts) go in head too.
- Mark commentable elements with data-dp-anchor="<stable-id>" so feedback threads survive edits.
- Optional "js" runs (root, slide) on slide enter — return a cleanup function. Set static_render_only: true to skip JS in PDF export.

IMPORTANT:
- To modify this deck later, use update_deck. NEVER create a new deck to make changes — it loses the URL and comment history.
- To iterate: get_deck (read current state + comments) → update_deck (make changes) → reply_to_comment (explain what you changed). The user resolves comments once satisfied.
- Check the "warnings" array in the response and fix any issues with a follow-up update_deck call.`,
    {
      title: z.string().describe('Deck title'),
      heading_font: z.string().optional().describe('Google Font for headings (e.g. "Playfair Display"). Default: DM Sans.'),
      body_font: z.string().optional().describe('Google Font for body text (e.g. "Inter"). Default: DM Sans.'),
      accent_color: z.string().optional().describe('Hex color (e.g. "#ff6600"). Overrides default purple accent. Exposed to canvas slides as var(--dp-accent).'),
      agent_name: z.string().optional().describe('Your agent name (e.g. "Acme Strategy Agent"). Shown as author on comments you post. Set this once at deck creation.'),
      stylesheet: z.string().optional().describe('Global CSS adopted by every canvas slide via shadow-root adoptedStyleSheets. Define your design system once (typography, components, color tokens) and reference classes from each slide.'),
      head: z.array(z.object({
        tag: z.enum(['link', 'script', 'style']),
        attrs: z.record(z.string()).optional(),
        body: z.string().optional(),
      })).optional().describe('Array of <link>/<script>/<style> entries injected into the page head. Use to load CDN libraries that canvas slides depend on. Example: [{ tag: "script", attrs: { src: "https://cdn.tailwindcss.com" } }] to enable Tailwind.'),
      slides: z.array(z.object({
        layout: z.literal('canvas').describe('Always "canvas". (25 legacy templated layouts exist but are deprecated for new content — see CLAUDE.md to re-enable.)'),
        content: z.object({
          html: z.string().describe('Required. Slide markup. Designed at 1920×1080, mounted in a shadow root.'),
          css: z.string().optional().describe('Optional per-slide CSS, scoped to this slide. For shared styles use deck.stylesheet instead.'),
          js: z.string().optional().describe('Optional JS. Runs on slide enter with (root, slide). Return a cleanup function. Don\'t rely on exact text strings — reviewers can edit text inline.'),
          static_render_only: z.boolean().optional().describe('If true, "js" is skipped in print/PDF mode. Use for animations that should freeze on export.'),
          key_takeaway: z.string().optional().describe('Optional one-line summary surfaced in agent-facing comment context.'),
        }).passthrough(),
      })).describe('Array of canvas slides. Each slide is HTML/CSS/JS the agent authors.'),
    },
    { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    async (args) => {
      console.log(`[mcp] tool: create_deck "${(args as Record<string, unknown>).title}"`);
      try {
        const apiUrl = config.apiUrl || `http://localhost:${config.port}`;
        const res = await fetch(`${apiUrl}/v1/decks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(args),
        });
        const data = await res.json();
        if (!res.ok) {
          console.log(`[mcp] create_deck failed: ${JSON.stringify(data)}`);
          return { content: [{ type: 'text' as const, text: `Error: ${JSON.stringify(data)}` }] };
        }
        console.log(`[mcp] create_deck success: ${(data as Record<string, unknown>).deck_id}`);
        return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        console.error(`[mcp] create_deck error:`, err);
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
      const apiUrl = config.apiUrl || `http://localhost:${config.port}`;
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
- Both are PARTIAL merges into the existing content object — other fields (js, key_takeaway, etc.) are preserved.

Editing existing decks that use the deprecated templated layouts is supported (the REST API still accepts them); just patch their content fields directly. New slides should be canvas.`,
    {
      deck_id: z.string().describe('Deck ID to update'),
      title: z.string().optional().describe('New deck title'),
      heading_font: z.string().optional().describe('Google Font for headings (e.g. "Playfair Display")'),
      body_font: z.string().optional().describe('Google Font for body text (e.g. "Inter")'),
      accent_color: z.string().optional().describe('Hex color (e.g. "#ff6600")'),
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
            key_takeaway: z.string().optional(),
          }).passthrough().describe('Canvas content object — { html, css?, js?, static_render_only?, key_takeaway? }.'),
        }).optional().describe('The new slide to add. Required for insert and replace.'),
      })).optional().describe('Structural changes: add, remove, reorder, or replace slides. Use this to INSERT NEW SLIDES — do not recreate the deck.'),
      slides: z.array(z.object({
        index: z.number().describe('Zero-based slide index (post-operations)'),
        content: z.record(z.unknown()).describe('Partial content to merge'),
      })).optional().describe('Content edits by index (applied after slide_operations)'),
    },
    { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    async ({ deck_id, ...body }) => {
      const apiUrl = config.apiUrl || `http://localhost:${config.port}`;
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
      const apiUrl = config.apiUrl || `http://localhost:${config.port}`;
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
      const apiUrl = config.apiUrl || `http://localhost:${config.port}`;
      const res = await fetch(`${apiUrl}/v1/images`, { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) return { content: [{ type: 'text' as const, text: `Error: ${JSON.stringify(data)}` }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'search_images',
    `Search Unsplash for stock photos. Returns image IDs and thumbnails. Use the returned id as image_ref in your slides — attribution, URLs, and download tracking are handled automatically.

Use the "queries" parameter to search for multiple terms in one call (e.g. one per slide) instead of making separate calls. Results are grouped by query.

For image_gallery: pass an array of IDs as image_refs instead of images.`,
    {
      query: z.string().optional().describe('Single search query (e.g. "modern office workspace"). Use this OR queries, not both.'),
      queries: z.array(z.string()).max(5).optional().describe('Multiple search queries in one call (max 5). Results grouped by query. More efficient than separate calls.'),
      per_page: z.number().min(1).max(30).optional().describe('Results per query (default 5, max 30)'),
      orientation: z.enum(['landscape', 'portrait', 'squarish']).optional().describe('Filter by orientation. Use "landscape" for full_image/image_and_text, "portrait" for image_gallery.'),
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    async ({ query, queries, per_page, orientation }) => {
      console.log(`[mcp] tool: search_images query=${query || ''} queries=${queries?.length || 0}`);
      try {
        const apiUrl = config.apiUrl || `http://localhost:${config.port}`;
        const params = new URLSearchParams();
        if (query) params.set('query', query);
        if (queries) params.set('queries', JSON.stringify(queries));
        if (per_page) params.set('per_page', String(per_page));
        if (orientation) params.set('orientation', orientation);
        const res = await fetch(`${apiUrl}/v1/unsplash/search?${params}`);
        const data = await res.json();
        if (!res.ok) {
          return { content: [{ type: 'text' as const, text: `Error: ${JSON.stringify(data)}` }] };
        }
        return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        console.error(`[mcp] search_images error:`, err);
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
          fields: 'html (required), css?, js?, static_render_only?, key_takeaway?',
        },
      ];
      const customization = {
        heading_font: 'Google Font for headings (e.g. "Playfair Display"). Default: DM Sans. Forwarded as var(--dp-font-heading) into every canvas slide.',
        body_font: 'Google Font for body text (e.g. "Inter"). Default: DM Sans. Forwarded as var(--dp-font-body).',
        accent_color: 'Hex color (e.g. "#ff6600"). Default: #7c3aed. Forwarded as var(--dp-accent).',
        stylesheet: 'Deck-level global CSS adopted by every canvas slide via shadow-root adoptedStyleSheets. Define your design system once and reference it from each slide. Up to 100KB.',
        head: 'Array of <link>/<script>/<style> entries injected into the page head. Use to load CDN libraries (Tailwind, Chart.js, etc.) or external fonts/icon sets that canvas slides depend on.',
      };
      const style_guide = {
        canvas: [
          'Design at 1920×1080 — the viewer scales the slide to fit.',
          'Each canvas slide is mounted into an open shadow root, so your CSS is auto-scoped — no need for BEM/prefixes.',
          'Prefer Tailwind for fast layout: enable it once via deck.head: [{ tag: "script", attrs: { src: "https://cdn.tailwindcss.com" } }]. Then write utility-class HTML.',
          'Use the forwarded CSS variables: var(--dp-accent), var(--dp-text-title), var(--dp-text-body), var(--dp-font-heading), var(--dp-font-body). This keeps slides consistent with accent_color and font choices.',
          'Define reusable styles once in deck.stylesheet (e.g. .dp-hero, .dp-stat-card) instead of duplicating CSS in every slide.css.',
          'Mark commentable elements with data-dp-anchor="<stable-id>" (e.g. <h1 data-dp-anchor="hero-title">). Preserve these IDs across edits so comment threads remain attached.',
          'Reviewers can comment on ANY DOM element — unmarked elements get auto:<index> paths that are stable within a render but may shift across structural edits. Use anchors for anything you\'ll iterate on.',
          'Reviewers can also edit text inline via the viewer\'s edit mode. Your js should not rely on exact text strings — use selectors or data attributes.',
          'js runs when the slide enters view. Signature: (root, slide) => optional cleanup function. Use for animations, interactivity. Set static_render_only: true to skip JS in print/PDF.',
          'Do NOT load arbitrary user-controlled scripts; the canvas runs in the parent JS context, not an iframe.',
        ],
        images: 'Use search_images for Unsplash photos or upload_image for your own; in canvas slides, place the returned URL directly in <img src>. Include a credit caption near the image.',
      };
      const deprecated_layouts = {
        note: 'These 25 templated layouts existed in Deckpipe 0.2 and earlier. They are deprecated for new content and intentionally hidden from this listing. Existing decks using them still render unchanged, and the REST API still accepts them. To re-enable them in the MCP surface, see CLAUDE.md → "Resurrecting deprecated layouts".',
        names: [
          'title', 'title_and_body', 'title_and_bullets', 'title_and_table',
          'two_columns', 'section_break', 'image_and_text', 'image_gallery',
          'stats', 'quote', 'full_image', 'timeline', 'comparison', 'code',
          'callout', 'icons_and_text', 'team', 'embed', 'pros_and_cons',
          'agenda', 'swot', 'quadrant', 'venn_diagram', 'chart', 'closing',
        ],
      };
      return { content: [{ type: 'text' as const, text: JSON.stringify({ layouts, customization, style_guide, deprecated_layouts }, null, 2) }] };
    }
  );

  // --- list_comments ---
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
      const apiUrl = config.apiUrl || `http://localhost:${config.port}`;
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

  // --- reply_to_comment ---
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
      const apiUrl = config.apiUrl || `http://localhost:${config.port}`;
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

  // --- resolve_comment ---
  server.tool(
    'resolve_comment',
    `Resolve a comment, marking it as addressed. Only resolve when explicitly asked — let the user confirm satisfaction first.`,
    {
      deck_id: z.string().describe('The deck ID'),
      comment_id: z.string().describe('The comment ID to resolve'),
    },
    { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    async ({ deck_id, comment_id }) => {
      const apiUrl = config.apiUrl || `http://localhost:${config.port}`;
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

const transports = new Map<string, StreamableHTTPServerTransport>();

export const mcpRouter = Router();

mcpRouter.post('/', async (req, res) => {
  try {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    console.log(`[mcp] POST session=${sessionId || 'new'}, active sessions: ${transports.size}`);

    if (sessionId && transports.has(sessionId)) {
      console.log(`[mcp] reusing existing session ${sessionId}`);
      const transport = transports.get(sessionId)!;
      await transport.handleRequest(req, res);
      return;
    }

    // If client sent a stale session ID, reject so it reconnects
    if (sessionId) {
      console.log(`[mcp] stale session ${sessionId}, asking client to reconnect`);
      res.status(404).json({ error: 'Session not found. Please reconnect.' });
      return;
    }

    // New session
    console.log(`[mcp] creating new session`);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
    });

    transport.onclose = () => {
      console.log(`[mcp] session ${transport.sessionId} closed`);
      if (transport.sessionId) transports.delete(transport.sessionId);
    };

    const mcpServer = new McpServer({ name: 'deckpipe', version: '0.3.1' }, { instructions: INSTRUCTIONS });
    registerTools(mcpServer);
    await mcpServer.connect(transport);
    await transport.handleRequest(req, res);

    // Session ID is set by handleRequest during initialize
    if (transport.sessionId) {
      console.log(`[mcp] new session ${transport.sessionId}`);
      transports.set(transport.sessionId, transport);
    }
    console.log(`[mcp] POST handled, response sent: ${res.headersSent}`);
  } catch (err) {
    console.error(`[mcp] POST error:`, err);
    if (!res.headersSent) res.status(500).json({ error: 'MCP server error' });
  }
});

mcpRouter.get('/', async (req, res) => {
  try {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    console.log(`[mcp] GET session=${sessionId || 'none'}`);
    if (sessionId && transports.has(sessionId)) {
      const transport = transports.get(sessionId)!;
      await transport.handleRequest(req, res);
      return;
    }
    res.status(404).json({ error: 'Session not found' });
  } catch (err) {
    console.error(`[mcp] GET error:`, err);
    if (!res.headersSent) res.status(500).json({ error: 'MCP server error' });
  }
});

mcpRouter.delete('/', async (req, res) => {
  try {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    console.log(`[mcp] DELETE session=${sessionId || 'none'}`);
    if (sessionId && transports.has(sessionId)) {
      const transport = transports.get(sessionId)!;
      await transport.handleRequest(req, res);
      return;
    }
    res.status(404).json({ error: 'Session not found' });
  } catch (err) {
    console.error(`[mcp] DELETE error:`, err);
    if (!res.headersSent) res.status(500).json({ error: 'MCP server error' });
  }
});

