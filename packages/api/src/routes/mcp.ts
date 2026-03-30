import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { Router } from 'express';
import { config } from '../config.js';

function registerTools(server: McpServer) {
  server.tool(
    'create_deck',
    `Create a new slide deck and get a shareable viewer URL.

Keep slide copy short and scannable — use shorthand phrases, not full sentences. Bullets: 5-8 words max.

MARKDOWN: All text content fields support markdown rendering. Use **bold**, *italic*, \`code\`, [links](url), and lists (1. ordered, - unordered) in body, subtitle, bullets, table cells, and key_takeaway fields. Body text fields support full block markdown including numbered and bulleted lists.

Layouts: "title", "title_and_body", "title_and_bullets", "title_and_table", "two_columns", "section_break", "image_and_text", "image_gallery", "stats", "quote", "full_image".

Content fields per layout (all layouts support optional key_takeaway):
- title: { title, subtitle?, image_url? }
- title_and_body: { title, body, image_url? }
- title_and_bullets: { title, bullets[], image_url? }
- title_and_table: { title, table: { headers[], rows[][], highlight_column? } }
- two_columns: { title, left: { heading, body }, right: { heading, body }, image_url? }
- section_break: { title }
- image_and_text: { title, body, image_url (required) }
- image_gallery: { title?, caption?, images[] (2-5 URLs) }
- stats: { title?, metrics[]: { value, label } (2-4 items) }
- quote: { quote, attribution?, image_url? }
- full_image: { image_url (required), title?, subtitle? }

Optionally set heading_font and body_font (any Google Font name) and accent_color (hex like "#ff6600") to customize the look.
Use upload_image first to get hosted URLs for any images.`,
    {
      title: z.string().describe('Deck title'),
      heading_font: z.string().optional().describe('Google Font for headings (e.g. "Playfair Display"). Default: DM Sans.'),
      body_font: z.string().optional().describe('Google Font for body text (e.g. "Inter"). Default: DM Sans.'),
      accent_color: z.string().optional().describe('Hex color (e.g. "#ff6600"). Overrides default purple accent.'),
      slides: z.array(z.object({
        layout: z.enum(['title', 'title_and_body', 'title_and_bullets', 'title_and_table', 'two_columns', 'section_break', 'image_and_text', 'image_gallery', 'stats', 'quote', 'full_image']),
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
    'Retrieve a deck by ID, including any user edits made in the viewer.',
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
    `Update a deck's title, fonts, accent color, or individual slide content. All text content fields support markdown (**bold**, *italic*, \`code\`, [links](url), numbered/bulleted lists). Slides are updated by index with partial content merge.

Example: { "deck_id": "dk_abc", "slides": [{ "index": 2, "content": { "title": "New Title" } }] }`,
    {
      deck_id: z.string().describe('Deck ID to update'),
      title: z.string().optional().describe('New deck title'),
      heading_font: z.string().optional().describe('Google Font for headings'),
      body_font: z.string().optional().describe('Google Font for body text'),
      accent_color: z.string().optional().describe('Hex color (e.g. "#ff6600")'),
      slides: z.array(z.object({
        index: z.number().describe('Zero-based slide index'),
        content: z.record(z.unknown()).describe('Partial content to merge'),
      })).optional().describe('Slide updates'),
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
    `Upload a base64-encoded image to get a hosted URL for use in slide image_url fields.

Accepts PNG, JPG, WebP up to 10MB. Upload first, then use the returned URL when creating or updating a deck.`,
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
    'list_layouts',
    'List all available slide layouts, their content fields, and themes. Use this to discover what is supported before creating a deck.',
    {},
    async () => {
      const layouts = [
        { name: 'title', fields: 'title (required), subtitle?, image_url?, key_takeaway?' },
        { name: 'title_and_body', fields: 'title (required), body (required), image_url?, key_takeaway?' },
        { name: 'title_and_bullets', fields: 'title (required), bullets[] (required), image_url?, key_takeaway?' },
        { name: 'title_and_table', fields: 'title (required), table: { headers[], rows[][], highlight_column? }, key_takeaway?' },
        { name: 'two_columns', fields: 'title (required), left: { heading, body }, right: { heading, body }, image_url?, key_takeaway?' },
        { name: 'section_break', fields: 'title (required), key_takeaway?' },
        { name: 'image_and_text', fields: 'title (required), body (required), image_url (required), key_takeaway?' },
        { name: 'image_gallery', fields: 'images[] (2-5 URLs, required), title?, caption?, key_takeaway?' },
        { name: 'stats', fields: 'metrics[]: { value, label } (2-4 items, required), title?, key_takeaway?' },
        { name: 'quote', fields: 'quote (required), attribution?, image_url?, key_takeaway?' },
        { name: 'full_image', fields: 'image_url (required), title?, subtitle?, key_takeaway?' },
      ];
      const customization = {
        heading_font: 'Google Font for headings. Default: DM Sans.',
        body_font: 'Google Font for body text. Default: DM Sans.',
        accent_color: 'Hex color. Default: #7c3aed.',
      };
      return { content: [{ type: 'text' as const, text: JSON.stringify({ layouts, customization }, null, 2) }] };
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

    const mcpServer = new McpServer({ name: 'deckpipe', version: '0.1.2' });
    registerTools(mcpServer);
    await mcpServer.connect(transport);

    if (transport.sessionId) {
      console.log(`[mcp] new session ${transport.sessionId}`);
      transports.set(transport.sessionId, transport);
    }

    await transport.handleRequest(req, res);
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

