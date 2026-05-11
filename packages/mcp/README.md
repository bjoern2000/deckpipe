# deckpipe-mcp

MCP server for [deckpipe](https://deckpipe.dev) — create, edit, and share slide decks from any AI agent. You describe slides as JSON (layout + content); Deckpipe renders, themes, and exports them. Every deck gets a shareable viewer URL.

Ten tools for the full deck lifecycle: create, read, update, delete, search stock photos, upload images, list layouts, and collaborate via threaded comments. No account or API key required — decks are addressed by unique unguessable IDs.

- **Website & viewer:** [deckpipe.dev](https://deckpipe.dev)
- **Remote MCP endpoint:** `https://deckpipe.dev/mcp` (Streamable HTTP)
- **npm package:** [`deckpipe-mcp`](https://www.npmjs.com/package/deckpipe-mcp) (stdio for local agents)
- **Source:** [github.com/bjoern2000/deckpipe-mcp](https://github.com/bjoern2000/deckpipe-mcp)

## Use cases

You can use Deckpipe to:

Create Decks from a Prompt:
"Build a 6-slide pitch deck for our AI launch with a bold, editorial tone"

Turn Documents into Slides:
"Summarize my Q2 strategy doc as a 10-slide exec deck with key takeaways"

Illustrate with Stock Photos:
"Create a travel guide for Tokyo with full-bleed Unsplash photos and a gallery of must-visit spots"

Visualize Data:
"Add a bar chart showing monthly signups for Q1 and a stats slide for conversion metrics"

Compare & Analyze:
"Make a SWOT deck for entering the European market, with a quadrant of competitors by price and features"

Iterate Based on Feedback:
"Check the deck for open comments, apply the requested edits, and reply to each thread"

Restructure Existing Decks:
"Move the pricing slide before the testimonials and replace the closing with a contact slide"

Brand & Theme:
"Rebuild this deck using Playfair Display for headings, Inter for body, and accent color #0ea5e9"

## Install

### Remote (Claude.ai, Claude Desktop, any Streamable HTTP MCP client)

Add `https://deckpipe.dev/mcp` as a custom remote MCP server. No authentication required.

### Local (stdio)

**Claude Code**
```bash
claude mcp add deckpipe -- npx deckpipe-mcp
```

**Manual MCP config** (Claude Desktop, Cursor, etc.)
```json
{
  "mcpServers": {
    "deckpipe": {
      "command": "npx",
      "args": ["-y", "deckpipe-mcp"]
    }
  }
}
```

## Tools

| Tool | Description |
|------|-------------|
| `create_deck` | Create a new deck and get a shareable viewer URL |
| `get_deck` | Retrieve a deck by ID |
| `update_deck` | Update title, fonts, accent color, slide content, or slide structure (insert, delete, move, replace) |
| `delete_deck` | Delete a deck permanently |
| `upload_image` | Upload a base64 image, get a hosted URL |
| `search_images` | Search Unsplash for stock photos with automatic attribution |
| `list_layouts` | List available layouts, customization options, and style guide |
| `list_comments` | List comments on a deck (filter by status or slide) |
| `reply_to_comment` | Reply to a comment thread after addressing feedback |
| `resolve_comment` | Mark a comment as resolved |

## Layouts

| Layout | Description | Required Fields |
|--------|-------------|----------------|
| `title` | Large centered title slide | `title`, optional `subtitle`, `image_url` |
| `title_and_body` | Title + paragraph | `title`, `body`, optional `image_url` |
| `title_and_bullets` | Title + bullet list | `title`, `bullets[]`, optional `image_url` |
| `title_and_table` | Title + data table | `title`, `table: { headers[], rows[][] }` |
| `two_columns` | Title + two columns | `title`, `left: { heading, body }`, `right: { heading, body }` |
| `section_break` | Bold section divider | `title` |
| `image_and_text` | Image-primary (~60%) + text | `title`, `body`, `image_url` or `image_prompt` |
| `image_gallery` | Horizontal row of portrait images | `images[]` (2-5 URLs), optional `title`, `caption` |
| `stats` | Big metrics/numbers with labels | `metrics[]: { value, label }` (2-4), optional `title` |
| `quote` | Inline curly quotation marks with attribution | `quote`, optional `attribution`, `image_url` |
| `full_image` | Full-bleed background image with overlay text | `image_url` or `image_prompt`, optional `title`, `subtitle` |
| `timeline` | Continuous timeline with positioned milestones | `events[]: { label, title, description?, position? }` (3-6). `position` (0-1) places milestone at relative point; events alternate above/below line |
| `comparison` | Side-by-side comparison with verdict | `left: { heading, bullets[] }`, `right: { heading, bullets[] }`, optional `title`, `verdict` |
| `code` | Syntax-highlighted code block (18 languages) | `code`, optional `title`, `language`, `caption` |
| `callout` | Large featured value with context | `value`, optional `title`, `label`, `body` |
| `icons_and_text` | Icon grid with headings and descriptions | `items[]: { icon, heading, description? }` (3-6), optional `title`. `icon` accepts any [Lucide icon name](https://lucide.dev/icons/) (e.g. `"clock"`, `"message-square"`) or emoji |
| `team` | Team member cards with roles and bios | `members[]: { name, role, bio?, image_url? }` (1-6), optional `title` |
| `embed` | Full-slide iframe embed (90% area) | `url`, optional `caption`, `aspect_ratio` |
| `pros_and_cons` | Two-column pros vs cons list | `pros[]`, `cons[]`, optional `title`, `pros_heading`, `cons_heading` |
| `agenda` | Numbered agenda items with durations | `items[]: { topic, duration?, description? }` (1-10), optional `title` |
| `swot` | Four-quadrant SWOT analysis with emoji headers | `strengths[]`, `weaknesses[]`, `opportunities[]`, `threats[]` (1-5 each), optional `title` |
| `quadrant` | 2D scatter plot with labeled axes and items | `items[]: { label, x: 0-1, y: 0-1 }` (1-12), optional `title`, `body`, `bullets[]`, `x_label`, `y_label`, `quadrant_labels[4]` |
| `venn_diagram` | 2 or 3 overlapping circles with labels and items | `circles[]: { label, items[]? }` (2-3), optional `title`, `body`, `overlaps[]: { sets[], label }` |
| `closing` | Accent-colored ending slide with contact info | optional `heading`, `subheading`, `contact_lines[]`, `image_url` |
| `chart` | Bar, line, pie, or donut chart from structured data | `chart_type` (`"bar"`/`"line"`/`"pie"`/`"donut"`), `data: { labels[], datasets[]: { label?, values[], color? } }`, optional `title` |

All layouts support an optional `key_takeaway` field — a highlighted sentence rendered below the title.

**[See all 25 layouts in action →](https://deckpipe.dev/d/dk_KRtXiuKV/the-clean-energy-transition-2026-outlook)**

## Image placeholders

Any layout that accepts `image_url` also accepts `image_prompt` as an alternative. When set, a dashed placeholder box is rendered showing the prompt text — useful when you want to create a complete deck without sourcing images, letting the user drop them in later.

```json
{
  "layout": "title_and_bullets",
  "content": {
    "title": "Electric Vehicles",
    "bullets": ["Range anxiety solved", "Charging network expansion"],
    "image_prompt": "Hero shot of a sleek EV on a mountain road at golden hour"
  }
}
```

## Stock photo search

Use the `search_images` tool to find stock photos from Unsplash. Results return simple IDs and thumbnails — use the ID as `image_ref` in your slides and Deckpipe handles attribution, URLs, and download tracking automatically.

```json
// Search returns IDs + thumbnails
{ "results": [{ "id": "uimg_abc123", "thumb": "https://...", "alt": "mountain landscape" }] }

// Use image_ref in slides — no attribution needed
{
  "layout": "full_image",
  "content": {
    "image_ref": "uimg_abc123",
    "title": "Mountain Adventure"
  }
}
```

Use `queries` to search for multiple terms in one call (max 5) instead of making separate calls per slide:

```json
{ "queries": ["sunset beach", "modern office", "mountain hiking"], "orientation": "landscape" }
```

- `image_ref` resolves to a real Unsplash URL with proper attribution caption
- For `image_gallery`, use `image_refs` (array of IDs) instead of `images`
- Use `orientation: "landscape"` for `full_image`/`image_and_text`, `"portrait"` for `image_gallery`

## Rich bullets

Any `bullets[]`, `pros[]`, `cons[]`, `strengths[]`, `weaknesses[]`, `opportunities[]`, or `threats[]` field accepts either plain strings or rich bullet objects:

```json
{
  "text": "Model 3 leads in range",
  "detail": "EPA-rated 358 miles; closest competitor is 270 miles",
  "sources": [
    { "label": "EPA 2024", "url": "https://fueleconomy.gov" }
  ]
}
```

- `detail` renders as a hover tooltip (ℹ icon) — great for adding nuance without cluttering the slide
- `sources` render as superscript numbers with a footnote row at the bottom of the slide

Plain strings still work as before (backward compatible).

## Slide operations

`update_deck` supports structural slide changes via the `slide_operations` field — an ordered array of operations executed sequentially before any content edits.

| Operation | Fields | Effect |
|-----------|--------|--------|
| `delete` | `index` | Remove slide at index |
| `insert` | `index`, `slide` | Insert new slide at index (shifts others down) |
| `move` | `from`, `to` | Move slide from one position to another |
| `replace` | `index`, `slide` | Replace slide entirely (new layout + content) |

Operations are applied in order, so each operation sees the array as modified by previous ones. Content edits in `slides` use indices relative to the post-operations array.

```json
{
  "deck_id": "dk_abc",
  "slide_operations": [
    { "op": "delete", "index": 3 },
    { "op": "insert", "index": 1, "slide": { "layout": "title_and_body", "content": { "title": "New Slide", "body": "Hello" } } },
    { "op": "move", "from": 0, "to": 4 }
  ],
  "slides": [
    { "index": 2, "content": { "title": "Updated Title" } }
  ]
}
```

## Customization

Both `create_deck` and `update_deck` accept optional styling fields:

| Field | Description | Default |
|-------|-------------|---------|
| `heading_font` | Google Font for headings (e.g. `"Playfair Display"`, `"Space Grotesk"`) | DM Sans |
| `body_font` | Google Font for body text (e.g. `"Inter"`, `"Roboto"`) | DM Sans |
| `accent_color` | Hex color (e.g. `"#ff6600"`) | `#7c3aed` (purple) |

## Example prompts

> Create a deck about the rise of electric vehicles. Search the web for relevant photos and use them. Use heading font "Space Grotesk", body font "Inter", and accent color "#0ea5e9".

> Create a deck about the Apollo 11 moon landing. Search the web for historic NASA photos and use them as full-bleed images. Include a timeline of the mission, stats on the Saturn V rocket, and a famous quote from Neil Armstrong. Use heading font "Libre Baskerville" and accent color "#1e3a5f".

> Build a lecture deck on how neural networks learn. Use a comparison table for activation functions, bullet points for key concepts, and add a key takeaway to each slide.

> Create a travel guide deck for Tokyo. Search the web for photos and include an image gallery of must-visit spots, stats on tourism, and a full-bleed image cover slide.

## Warnings

Both `create_deck` and `update_deck` responses may include a `warnings` array with actionable feedback for the agent:

```json
{
  "deck_id": "dk_abc",
  "viewer_url": "...",
  "warnings": [
    "Slide 0 (title): unrecognized content field \"body\" — this field was ignored. Valid fields: image_focus, image_prompt, image_url, key_takeaway, subtitle, title",
    "Slide 2: image_url returned HTTP 404 — image may not render (https://example.com/missing.jpg)"
  ]
}
```

**Unrecognized content fields** — If you pass a field name that doesn't exist for that layout (e.g. `body` on a `title` slide), the field is silently dropped but a warning tells you exactly what happened and lists valid fields for that layout.

**Unreachable image URLs** — All `image_url` values are checked with a HEAD request during creation/update. If a URL returns an error or is unreachable, a warning is returned so you can fix it with a follow-up `update_deck` call.

## Comments

Deckpipe supports threaded comments for collaborative feedback between users and agents. Users place comments on specific slide elements in the viewer; agents read and respond to them.

**Workflow for agents:**
1. Call `get_deck` — each slide includes a `comments[]` array with open comments
2. Each comment has a `content_path` (e.g. `"title"`, `"bullets[2]"`, `"slide"`) telling you which field it refers to
3. Use `update_deck` to address the feedback
4. Call `reply_to_comment` to explain what you changed
5. The user resolves the comment once satisfied

**Agent identity:** Set `agent_name` when calling `create_deck` (e.g. `"Acme Strategy Agent"`) — this name appears on your replies.

## Configuration

By default the MCP server connects to `https://deckpipe.dev`. To use a different API endpoint:

```json
{
  "mcpServers": {
    "deckpipe": {
      "command": "npx",
      "args": ["-y", "deckpipe-mcp"],
      "env": {
        "DECKPIPE_API_URL": "http://localhost:3010"
      }
    }
  }
}
```

## Support

- **Questions, bug reports, feature requests:** [open an issue on GitHub](https://github.com/bjoern2000/deckpipe-mcp/issues)
- **Email:** [bjoern.schefzyk@gmail.com](mailto:bjoern.schefzyk@gmail.com)

## Legal

- [Privacy policy](https://deckpipe.dev/privacy.html) — what data is stored, retention, GDPR rights
- [Terms of use](https://deckpipe.dev/terms.html) — acceptable use, liability

**Note:** Decks are stored without authentication and are accessible by anyone who has the deck ID. Do not store confidential or personal information in decks.

## License

[MIT](./LICENSE) © Björn Schefzyk
