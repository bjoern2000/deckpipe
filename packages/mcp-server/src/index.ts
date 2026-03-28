import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { config } from './config.js';

const server = new McpServer({
  name: 'deckpipe',
  version: '0.1.0',
});

// --- create_deck ---
server.tool(
  'create_deck',
  `Create a new slide deck and get a shareable viewer URL.

Layouts: "title", "title_and_body", "title_and_bullets", "title_and_table", "two_columns", "section_break", "image_and_text".
Themes: "minimal" (clean, Inter font), "modern" (bold, DM Sans), "classic" (serif headings, earth tones).

Content fields per layout:
- title: { title, subtitle?, image_url? }
- title_and_body: { title, body, image_url? }
- title_and_bullets: { title, bullets[], image_url? }
- title_and_table: { title, table: { headers[], rows[][], highlight_column? } }
- two_columns: { title, left: { heading, body }, right: { heading, body }, image_url? }
- section_break: { title }
- image_and_text: { title, body, image_url (required) }

Use upload_image first to get hosted URLs for any images.`,
  {
    title: z.string().describe('Deck title'),
    theme: z.enum(['minimal', 'modern', 'classic']).optional().describe('Visual theme (default: minimal)'),
    slides: z.array(z.object({
      layout: z.enum(['title', 'title_and_body', 'title_and_bullets', 'title_and_table', 'two_columns', 'section_break', 'image_and_text']),
      content: z.record(z.unknown()).describe('Content fields (vary by layout)'),
    })).describe('Array of slides'),
  },
  async (args) => {
    const res = await fetch(`${config.apiUrl}/v1/decks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });
    const data = await res.json();
    if (!res.ok) return { content: [{ type: 'text' as const, text: `Error: ${JSON.stringify(data)}` }] };
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  }
);

// --- get_deck ---
server.tool(
  'get_deck',
  'Retrieve a deck by ID, including any user edits made in the viewer.',
  {
    deck_id: z.string().describe('The deck ID (e.g. "dk_a1b2c3d4")'),
  },
  async ({ deck_id }) => {
    const res = await fetch(`${config.apiUrl}/v1/decks/${deck_id}`);
    const data = await res.json();
    if (!res.ok) return { content: [{ type: 'text' as const, text: `Error: ${JSON.stringify(data)}` }] };
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  }
);

// --- update_deck ---
server.tool(
  'update_deck',
  `Update a deck's title, theme, or individual slide content. Slides are updated by index with partial content merge.

Example: { "deck_id": "dk_abc", "slides": [{ "index": 2, "content": { "title": "New Title" } }] }`,
  {
    deck_id: z.string().describe('Deck ID to update'),
    title: z.string().optional().describe('New deck title'),
    theme: z.enum(['minimal', 'modern', 'classic']).optional().describe('New theme'),
    slides: z.array(z.object({
      index: z.number().describe('Zero-based slide index'),
      content: z.record(z.unknown()).describe('Partial content to merge'),
    })).optional().describe('Slide updates'),
  },
  async ({ deck_id, ...body }) => {
    const res = await fetch(`${config.apiUrl}/v1/decks/${deck_id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) return { content: [{ type: 'text' as const, text: `Error: ${JSON.stringify(data)}` }] };
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  }
);

// --- delete_deck ---
server.tool(
  'delete_deck',
  'Delete a deck permanently.',
  {
    deck_id: z.string().describe('Deck ID to delete'),
  },
  async ({ deck_id }) => {
    const res = await fetch(`${config.apiUrl}/v1/decks/${deck_id}`, { method: 'DELETE' });
    if (res.status === 204) {
      return { content: [{ type: 'text' as const, text: `Deck ${deck_id} deleted successfully.` }] };
    }
    const data = await res.json();
    return { content: [{ type: 'text' as const, text: `Error: ${JSON.stringify(data)}` }] };
  }
);

// --- upload_image ---
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

    const res = await fetch(`${config.apiUrl}/v1/images`, {
      method: 'POST',
      body: form,
    });
    const data = await res.json();
    if (!res.ok) return { content: [{ type: 'text' as const, text: `Error: ${JSON.stringify(data)}` }] };
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  }
);

// --- list_layouts ---
server.tool(
  'list_layouts',
  'List all available slide layouts, their content fields, and themes. Use this to discover what is supported before creating a deck.',
  {},
  async () => {
    const layouts = [
      { name: 'title', description: 'Large centered title slide.', fields: 'title (required), subtitle?, image_url?' },
      { name: 'title_and_body', description: 'Title + paragraph.', fields: 'title (required), body (required), image_url?' },
      { name: 'title_and_bullets', description: 'Title + bullet list.', fields: 'title (required), bullets[] (required), image_url?' },
      { name: 'title_and_table', description: 'Title + data table.', fields: 'title (required), table: { headers[], rows[][], highlight_column? }' },
      { name: 'two_columns', description: 'Title + two columns.', fields: 'title (required), left: { heading, body }, right: { heading, body }, image_url?' },
      { name: 'section_break', description: 'Bold section divider on accent bg.', fields: 'title (required)' },
      { name: 'image_and_text', description: 'Image-primary (~60%) + text.', fields: 'title (required), body (required), image_url (required)' },
    ];
    const themes = ['minimal', 'modern', 'classic'];
    return { content: [{ type: 'text' as const, text: JSON.stringify({ layouts, themes }, null, 2) }] };
  }
);

// Start with stdio transport
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Deckpipe MCP server running on stdio');
}

main().catch((err) => {
  console.error('MCP server error:', err);
  process.exit(1);
});
