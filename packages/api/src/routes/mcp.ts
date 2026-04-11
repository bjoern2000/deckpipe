import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { Router } from 'express';
import { LayoutNames } from '@deckpipe/shared';
import { config } from '../config.js';

const INSTRUCTIONS = `Deckpipe is a slide deck rendering engine. You describe slides as JSON (layout + content); Deckpipe renders, themes, and exports them. Each deck gets a shareable viewer URL.

WORKFLOW
- Use create_deck for NEW decks. Use update_deck to modify EXISTING decks.
- NEVER recreate a deck to make changes. Recreating loses the URL, edit key, and comment history. Always update in place.
- To iterate on a deck: get_deck (read current state + comments) → update_deck (make changes) → reply_to_comment (explain what you changed).
- Check the "warnings" array in every create/update response. Fix unrecognized fields or unreachable image URLs with a follow-up update_deck call.

CONTENT STYLE
- Keep text short, crisp, and scannable. Use shorthand phrases, not full sentences.
- Bullets: 5-8 words max. Stats: abbreviate ("2.4M" not "2,400,000"). Quotes: under 30 words.
- All text fields support markdown: **bold**, *italic*, \`code\`, [links](url), lists. Body fields support full block markdown.

IMAGES
- Use search_images to find stock photos (Unsplash). You MUST include the returned image_attribution data when using any image from search results.
- Use upload_image to host your own images (PNG/JPG/WebP, base64-encoded).
- Use image_prompt instead of image_url to suggest an image the user should provide. Renders as a placeholder box with your descriptive text.

RICH BULLETS
- In layouts with bullets (title_and_bullets, comparison, swot, pros_and_cons, quadrant), bullets can be strings or objects: { text, detail?, sources?: [{ label, url? }] }.
- "detail" adds a hover tooltip (info icon). "sources" adds footnote citations (superscript numbers).

CUSTOMIZATION
- heading_font / body_font: any Google Font name (default: DM Sans).
- accent_color: hex color like "#ff6600" (default: #7c3aed purple).`;

function registerTools(server: McpServer) {
  server.tool(
    'create_deck',
    `Create a new slide deck. Returns viewer_url (owner link with edit key) and share_url (read-only).

25 layouts — call list_layouts for full details, descriptions, and style guide. Content fields per layout (all support optional key_takeaway):
- title: { title, subtitle?, image_url? }
- title_and_body: { title, body, image_url?, image_prompt? }
- title_and_bullets: { title, bullets[], image_url?, image_prompt? }
- title_and_table: { title, table: { headers[], rows[][], highlight_column? } }
- two_columns: { title, left: { heading, body }, right: { heading, body }, image_url?, image_prompt? }
- section_break: { title }
- image_and_text: { title, body, image_url (required unless image_prompt provided), image_prompt? }
- image_gallery: { title?, caption?, images[] (2-5 URLs, required unless image_prompt provided), image_details?[], image_prompt? }
- stats: { title?, metrics[]: { value, label } (2-4 items) }
- quote: { quote, attribution?, image_url? }
- full_image: { image_url (required unless image_prompt provided), image_prompt?, title?, subtitle? }
- timeline: { title?, events[]: { label, title, description?, position?: 0-1 } (3-6 items) }
- comparison: { title?, left: { heading, bullets[] }, right: { heading, bullets[] }, verdict? }
- code: { title?, code (required), language?, caption? }
- callout: { title?, value (required), label?, body? }
- icons_and_text: { title?, items[]: { icon, heading, description? } (3-6 items) }
- team: { title?, members[]: { name, role, bio?, image_url? } (1-6 items) }
- embed: { title?, url (required), caption?, aspect_ratio?: "16:9"|"4:3"|"1:1" }
- pros_and_cons: { title?, pros_heading?, cons_heading?, pros[], cons[] }
- agenda: { title?, items[]: { topic, duration?, description? } (1-10 items) }
- swot: { title?, strengths[], weaknesses[], opportunities[], threats[] (1-5 items each) }
- quadrant: { title?, body?, bullets?[], x_label?, y_label?, quadrant_labels?[4], items[]: { label, x: 0-1, y: 0-1 } (1-12 items) }
- venn_diagram: { title?, body?, circles[]: { label, items?[] } (2-3 circles, required), overlaps?[]: { sets: [circle indices], label } (max 4) }
- chart: { chart_type: "bar"|"line"|"pie"|"donut" (required), data: { labels[] (2-12 strings), datasets[]: { label?, values: number[], color? } (1-5 datasets) } (required), title? }
- closing: { heading?, subheading?, contact_lines?[], image_url? }`,
    {
      title: z.string().describe('Deck title'),
      heading_font: z.string().optional().describe('Google Font for headings (e.g. "Playfair Display"). Default: DM Sans.'),
      body_font: z.string().optional().describe('Google Font for body text (e.g. "Inter"). Default: DM Sans.'),
      accent_color: z.string().optional().describe('Hex color (e.g. "#ff6600"). Overrides default purple accent.'),
      agent_name: z.string().optional().describe('Your agent name (e.g. "Acme Strategy Agent"). Shown as author on comments you post. Set this once at deck creation.'),
      slides: z.array(z.object({
        layout: z.enum(LayoutNames),
        content: z.record(z.unknown()).describe('Content fields (vary by layout). All layouts support optional key_takeaway.'),
      })).describe('Array of slides'),
    },
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
2. "slides" — content edits to existing slides by index (partial merge). Does NOT add slides.

slide_operations execute first, then slides content edits apply to the resulting array.

slide_operations examples:
- Insert: { "op": "insert", "index": 5, "slide": { "layout": "title_and_bullets", "content": { "title": "New", "bullets": ["..."] } } }
- Delete: { "op": "delete", "index": 2 }
- Move: { "op": "move", "from": 0, "to": 3 }
- Replace: { "op": "replace", "index": 4, "slide": { "layout": "stats", "content": { "metrics": [...] } } }

slides (content edit) examples:
- Update title of slide 0: { "index": 0, "content": { "title": "New Title" } }`,
    {
      deck_id: z.string().describe('Deck ID to update'),
      title: z.string().optional().describe('New deck title'),
      heading_font: z.string().optional().describe('Google Font for headings (e.g. "Playfair Display")'),
      body_font: z.string().optional().describe('Google Font for body text (e.g. "Inter")'),
      accent_color: z.string().optional().describe('Hex color (e.g. "#ff6600")'),
      slide_operations: z.array(z.object({
        op: z.enum(['delete', 'insert', 'move', 'replace']).describe('Operation type: "insert" adds a new slide, "delete" removes one, "move" reorders, "replace" swaps layout+content'),
        index: z.number().optional().describe('Target slide index. Required for insert (position to insert at), delete, and replace.'),
        from: z.number().optional().describe('Source index. Only for move.'),
        to: z.number().optional().describe('Destination index. Only for move.'),
        slide: z.object({
          layout: z.enum(LayoutNames).describe('Slide layout type'),
          content: z.record(z.unknown()).describe('Full slide content object with all required fields for the layout'),
        }).optional().describe('The new slide to add. Required for insert and replace. Must include layout and content.'),
      })).optional().describe('Structural changes: add, remove, reorder, or replace slides. Use this to INSERT NEW SLIDES — do not recreate the deck.'),
      slides: z.array(z.object({
        index: z.number().describe('Zero-based slide index (post-operations)'),
        content: z.record(z.unknown()).describe('Partial content to merge'),
      })).optional().describe('Content edits by index (applied after slide_operations)'),
    },
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
    `Search Unsplash for stock photos. Returns URLs, photographer info, and attribution data.

When using an image from results, you MUST set both image_url and image_attribution:
1. image_url → use the urls.regular value
2. image_attribution → { name: "<photographer>", url: "<profile_url>?utm_source=deckpipe&utm_medium=referral", source: "Unsplash", source_url: "https://unsplash.com/?utm_source=deckpipe&utm_medium=referral", download_location: "<download_location from result>" }
3. For image_gallery: put attribution inside each image_details[] entry as an "attribution" object (same shape)

The download_location triggers required Unsplash download tracking automatically when the deck is saved.`,
    {
      query: z.string().describe('Search terms (e.g. "modern office workspace", "sunset over mountains")'),
      per_page: z.number().min(1).max(30).optional().describe('Number of results (default 9, max 30)'),
      orientation: z.enum(['landscape', 'portrait', 'squarish']).optional().describe('Filter by orientation. Use "landscape" for full_image/image_and_text, "portrait" for image_gallery.'),
    },
    async ({ query, per_page, orientation }) => {
      console.log(`[mcp] tool: search_images "${query}"`);
      try {
        const apiUrl = config.apiUrl || `http://localhost:${config.port}`;
        const params = new URLSearchParams({ query });
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
    'List all available slide layouts, their content fields, and themes. Use this to discover what is supported before creating a deck.',
    {},
    async () => {
      const layouts = [
        { name: 'title', description: 'Large centered title slide.', fields: 'title (required), subtitle?, image_url?, key_takeaway?' },
        { name: 'title_and_body', description: 'Title + paragraph.', fields: 'title (required), body (required), image_url?, image_prompt?, key_takeaway?' },
        { name: 'title_and_bullets', description: 'Title + bullet list.', fields: 'title (required), bullets[] (required), image_url?, image_prompt?, key_takeaway?' },
        { name: 'title_and_table', description: 'Title + data table.', fields: 'title (required), table: { headers[], rows[][], highlight_column? }, key_takeaway?' },
        { name: 'two_columns', description: 'Title + two columns.', fields: 'title (required), left: { heading, body }, right: { heading, body }, image_url?, image_prompt?, key_takeaway?' },
        { name: 'section_break', description: 'Bold section divider on accent bg.', fields: 'title (required), key_takeaway?' },
        { name: 'image_and_text', description: 'Image-primary (~60%) + text.', fields: 'title (required), body (required), image_url or image_prompt (one required), key_takeaway?' },
        { name: 'image_gallery', description: 'Horizontal row of portrait images — ideal for screenshot galleries.', fields: 'images[] (2-5 URLs, required), title?, caption?, key_takeaway?' },
        { name: 'stats', description: 'Big metrics/numbers with labels.', fields: 'metrics[]: { value, label } (2-4 items, required), title?, key_takeaway?' },
        { name: 'quote', description: 'Large pull-quote with optional attribution.', fields: 'quote (required), attribution?, image_url?, key_takeaway?' },
        { name: 'full_image', description: 'Full-bleed background image with optional overlay text.', fields: 'image_url or image_prompt (one required), title?, subtitle?, key_takeaway?' },
        { name: 'timeline', description: 'Horizontal timeline with 3-6 events.', fields: 'events[]: { label, title, description?, position?: 0-1 } (3-6 items, required), title?, key_takeaway?' },
        { name: 'comparison', description: 'Side-by-side A vs B with optional verdict.', fields: 'left: { heading, bullets[], image_url? }, right: { heading, bullets[], image_url? } (required), title?, verdict?, key_takeaway?' },
        { name: 'code', description: 'Styled code block with language badge.', fields: 'code (required), title?, language?, caption?, key_takeaway?' },
        { name: 'callout', description: 'Hero number or statement with supporting text.', fields: 'value (required), title?, label?, body?, key_takeaway?' },
        { name: 'icons_and_text', description: 'Grid of 3-6 items with emoji icon, heading, description.', fields: 'items[]: { icon, heading, description? } (3-6 items, required), title?, key_takeaway?' },
        { name: 'team', description: 'People grid with photos, names, roles.', fields: 'members[]: { name, role, bio?, image_url? } (1-6 items, required), title?, key_takeaway?' },
        { name: 'embed', description: 'Embedded iframe (YouTube, Figma, etc).', fields: 'url (required), title?, caption?, aspect_ratio? ("16:9"|"4:3"|"1:1"), key_takeaway?' },
        { name: 'pros_and_cons', description: 'Two-column green/red pros and cons list.', fields: 'pros[] (required), cons[] (required), title?, pros_heading?, cons_heading?, key_takeaway?' },
        { name: 'agenda', description: 'Numbered topic list with optional durations.', fields: 'items[]: { topic, duration?, description? } (1-10 items, required), title?, key_takeaway?' },
        { name: 'swot', description: '2x2 SWOT analysis grid.', fields: 'strengths[], weaknesses[], opportunities[], threats[] (1-5 items each, all required), title?, key_takeaway?' },
        { name: 'quadrant', description: 'X/Y positioning grid with labeled dots.', fields: 'items[]: { label, x: 0-1, y: 0-1 } (1-12 items, required), title?, body?, bullets?[], x_label?, y_label?, quadrant_labels?[4], key_takeaway?' },
        { name: 'venn_diagram', description: 'Venn diagram with 2 or 3 overlapping circles. Centered when no text; text-left/diagram-right when title/body provided.', fields: 'circles[]: { label, items?[] } (2-3 items, required), overlaps?[]: { sets: [circle indices], label } (max 4), title?, body?, key_takeaway?' },
        { name: 'chart', description: 'Bar, line, pie, or donut chart from structured data.', fields: 'chart_type: "bar"|"line"|"pie"|"donut" (required), data: { labels[] (2-12 strings), datasets[]: { label?, values: number[], color? } (1-5 datasets) } (required), title?, key_takeaway?' },
        { name: 'closing', description: 'Thank you / contact info slide. Use as final slide.', fields: 'heading?, subheading?, contact_lines?[], image_url?, key_takeaway?' },
      ];
      const customization = {
        heading_font: 'Optional Google Font for headings (e.g. "Playfair Display"). Default: DM Sans.',
        body_font: 'Optional Google Font for body text (e.g. "Inter"). Default: DM Sans.',
        accent_color: 'Optional hex color (e.g. "#ff6600"). Default: #7c3aed (purple).',
      };
      const style_guide = {
        images: 'image_gallery works best with 2-5 portrait images of consistent aspect ratio. full_image needs high-res landscape images. Use search_images with orientation "landscape" for full_image/image_and_text, "portrait" for image_gallery.',
      };
      return { content: [{ type: 'text' as const, text: JSON.stringify({ layouts, customization, style_guide }, null, 2) }] };
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

    const mcpServer = new McpServer({ name: 'deckpipe', version: '0.2.9' }, { instructions: INSTRUCTIONS });
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

