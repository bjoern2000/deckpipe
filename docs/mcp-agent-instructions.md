# MCP Agent Instructions

All agent-facing text for Deckpipe MCP tools. This is a review document — the source of truth lives in two places that must be kept in sync:

- **Remote MCP**: `packages/api/src/routes/mcp.ts`
- **Standalone MCP**: `deckpipe-mcp` repo — `src/index.ts`

---

## Server Instructions (sent automatically on connect)

Deckpipe is a slide deck rendering engine. You describe slides as JSON (layout + content); Deckpipe renders, themes, and exports them. Each deck gets a shareable viewer URL.

WORKFLOW
- Use create_deck for NEW decks. Use update_deck to modify EXISTING decks.
- NEVER recreate a deck to make changes. Recreating loses the URL, edit key, and comment history. Always update in place.
- To iterate on a deck: get_deck (read current state + comments) → update_deck (make changes) → reply_to_comment (explain what you changed).
- Check the "warnings" array in every create/update response. Fix unrecognized fields or unreachable image URLs with a follow-up update_deck call.

CONTENT STYLE
- Keep text short, crisp, and scannable. Use shorthand phrases, not full sentences.
- Bullets: 5-8 words max. Stats: abbreviate ("2.4M" not "2,400,000"). Quotes: under 30 words.
- All text fields support markdown: **bold**, *italic*, `code`, [links](url), lists. Body fields support full block markdown.

IMAGES
- Use search_images to find stock photos (Unsplash). You MUST include the returned image_attribution data when using any image from search results.
- Use upload_image to host your own images (PNG/JPG/WebP, base64-encoded).
- Use image_prompt instead of image_url to suggest an image the user should provide. Renders as a placeholder box with your descriptive text.

RICH BULLETS
- In layouts with bullets (title_and_bullets, comparison, swot, pros_and_cons, quadrant), bullets can be strings or objects: { text, detail?, sources?: [{ label, url? }] }.
- "detail" adds a hover tooltip (info icon). "sources" adds footnote citations (superscript numbers).

CUSTOMIZATION
- heading_font / body_font: any Google Font name (default: DM Sans).
- accent_color: hex color like "#ff6600" (default: #7c3aed purple).

CANVAS LAYOUT (agent-authored HTML)
- Beyond the 25 templated layouts, the "canvas" layout lets you write a slide as raw HTML/CSS/JS — full design freedom inside a 960×540 box.
- Fields: { html (required), css?, js?, static_render_only? }. The slide renders in a shadow root, so your CSS is scoped automatically; styles cannot leak in or out.
- Deck-level "stylesheet" is global CSS adopted by every canvas slide — define your design system once (typography, spacing, colors, components) and reference it from each slide's html.
- Deck-level "head" is an array of { tag, attrs?, body? } entries injected into the page head (e.g. { tag: "script", attrs: { src: "https://cdn.tailwindcss.com" } } to enable Tailwind utilities, or { tag: "link", attrs: { rel: "stylesheet", href: "..." } } for icon fonts).
- CSS variables --dp-accent, --dp-text-title, --dp-font-heading, --dp-font-body are forwarded into every canvas slide — prefer them over hardcoded colors so accent_color stays consistent.
- For commenting: mark elements you want feedback on with data-dp-anchor="<stable-name>" (e.g. data-dp-anchor="hero-title"). Preserve these IDs across edits — they keep comment threads attached.
- "js" runs as a module on slide enter with (root, slide) in scope; return a function to clean up on slide exit. Skipped in print mode if static_render_only is true.

---

## create_deck

### Description

Create a new slide deck. Returns viewer_url (owner link with edit key) and share_url (read-only).

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
- quadrant: { title?, body?, bullets?[], x_label?, y_label?, quadrant_labels?[4] (order: [top-left, top-right, bottom-left, bottom-right]), items[]: { label, x: 0-1, y: 0-1 } (1-12 items) }
- venn_diagram: { title?, body?, circles[]: { label, items?[] } (2-3 circles, required), overlaps?[]: { sets: [circle indices], label } (max 4) }
- chart: { chart_type: "bar"|"line"|"pie"|"donut" (required), data: { labels[] (2-12 strings), datasets[]: { label?, values: number[], color? } (1-5 datasets) } (required), title? }
- closing: { heading?, subheading?, contact_lines?[], image_url? }
- canvas: { html (required, agent-authored HTML), css?, js?, static_render_only? } — full design freedom in a shadow-root sandbox. Use deck-level stylesheet + head for shared CSS and CDN libraries (e.g. Tailwind). Mark commentable elements with data-dp-anchor="<id>".

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `title` | string | yes | Deck title |
| `heading_font` | string | no | Google Font for headings (e.g. "Playfair Display"). Default: DM Sans. |
| `body_font` | string | no | Google Font for body text (e.g. "Inter"). Default: DM Sans. |
| `accent_color` | string | no | Hex color (e.g. "#ff6600"). Overrides default purple accent. |
| `agent_name` | string | no | Your agent name (e.g. "Acme Strategy Agent"). Shown as author on comments you post. Set this once at deck creation. |
| `stylesheet` | string | no | Global CSS adopted by every canvas slide. Define a design system once and reference it from each slide. Up to 100KB. |
| `head` | array | no | `<link>`/`<script>`/`<style>` entries injected into the page head. Use to load CDN libraries (Tailwind, Chart.js, etc.). |
| `slides` | array | yes | Array of slides |
| `slides[].layout` | enum | yes | One of the 26 layout types (25 templated + canvas) |
| `slides[].content` | object | yes | Content fields (vary by layout). All layouts support optional key_takeaway. |

---

## get_deck

### Description

Retrieve a deck by ID. Returns all slides with their current content, including any edits made by the user in the viewer.

Each slide includes a comments[] array with open comments. Each comment has: id, content_path (e.g. "title", "bullets[2]", "slide" for general), status, messages[] thread, and created_at.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `deck_id` | string | yes | The deck ID (e.g. "dk_a1b2c3d4") |

---

## update_deck

### Description

Update an existing deck. Two parameters for two purposes:

1. "slide_operations" — structural changes (insert, delete, move, replace). The ONLY way to add new slides.
2. "slides" — content edits to existing slides by index (partial merge). Does NOT add slides.

slide_operations execute first, then slides content edits apply to the resulting array.

slide_operations examples:
- Insert: { "op": "insert", "index": 5, "slide": { "layout": "title_and_bullets", "content": { "title": "New", "bullets": ["..."] } } }
- Delete: { "op": "delete", "index": 2 }
- Move: { "op": "move", "from": 0, "to": 3 }
- Replace: { "op": "replace", "index": 4, "slide": { "layout": "stats", "content": { "metrics": [...] } } }

slides (content edit) examples:
- Update title of slide 0: { "index": 0, "content": { "title": "New Title" } }

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `deck_id` | string | yes | Deck ID to update |
| `title` | string | no | New deck title |
| `heading_font` | string | no | Google Font for headings (e.g. "Playfair Display") |
| `body_font` | string | no | Google Font for body text (e.g. "Inter") |
| `accent_color` | string | no | Hex color (e.g. "#ff6600") |
| `stylesheet` | string \| null | no | Replace deck-level global CSS for canvas slides. Pass null to clear. |
| `head` | array \| null | no | Replace deck-level head entries. Pass null to clear. |
| `slide_operations` | array | no | Structural changes: add, remove, reorder, or replace slides. |
| `slide_operations[].op` | enum | yes | "insert", "delete", "move", or "replace" |
| `slide_operations[].index` | number | no | Target slide index. Required for insert, delete, replace. |
| `slide_operations[].from` | number | no | Source index. Only for move. |
| `slide_operations[].to` | number | no | Destination index. Only for move. |
| `slide_operations[].slide` | object | no | The new slide (layout + content). Required for insert and replace. |
| `slides` | array | no | Content edits by index (applied after slide_operations) |
| `slides[].index` | number | yes | Zero-based slide index (post-operations) |
| `slides[].content` | object | yes | Partial content to merge |

---

## delete_deck

### Description

Delete a deck permanently.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `deck_id` | string | yes | Deck ID to delete |

---

## upload_image

### Description

Upload a base64-encoded image (PNG/JPG/WebP, max 10MB) to get a hosted URL for use in slide image_url fields.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `image_data` | string | yes | Base64-encoded image data |
| `filename` | string | yes | Filename with extension (e.g. "photo.jpg") |
| `content_type` | enum | yes | "image/png", "image/jpeg", or "image/webp" |

---

## search_images

### Description

Search Unsplash for stock photos. Returns URLs, photographer info, and attribution data.

When using an image from results, you MUST set both image_url and image_attribution:
1. image_url → use the urls.regular value
2. image_attribution → { name: "<photographer>", url: "<profile_url>?utm_source=deckpipe&utm_medium=referral", source: "Unsplash", source_url: "https://unsplash.com/?utm_source=deckpipe&utm_medium=referral", download_location: "<download_location from result>" }
3. For image_gallery: put attribution inside each image_details[] entry as an "attribution" object (same shape)

The download_location triggers required Unsplash download tracking automatically when the deck is saved.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | yes | Search terms (e.g. "modern office workspace", "sunset over mountains") |
| `per_page` | number | no | Number of results (default 9, max 30) |
| `orientation` | enum | no | "landscape", "portrait", or "squarish". Use "landscape" for full_image/image_and_text, "portrait" for image_gallery. |

---

## list_layouts

### Description

List all available slide layouts, their content fields, and themes. Use this to discover what is supported before creating a deck.

### Parameters

None.

---

## list_comments

### Description

List comments on a deck. Returns comment objects with: id, slide_id, content_path (e.g. "title", "bullets[2]", "slide"), status ("open"/"resolved"), messages[] thread, created_at, updated_at.

Use the "since" parameter with an ISO timestamp to only fetch comments added or updated since your last check.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `deck_id` | string | yes | The deck ID |
| `status` | enum | no | Filter by "open" or "resolved". Defaults to showing all. |
| `slide_id` | string | no | Filter to a specific slide by its stable slide_id (e.g. "sld_a1b2c3d4") |
| `since` | string | no | ISO timestamp. Only return comments created or updated since this time. |

---

## reply_to_comment

### Description

Reply to a comment thread. Keep replies concise — summarize what you changed, don't repeat the feedback.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `deck_id` | string | yes | The deck ID |
| `comment_id` | string | yes | The comment ID to reply to (e.g. "cmt_a1b2c3d4e5f6") |
| `body` | string | yes | Your reply message |
| `author_name` | string | no | Your agent name. Defaults to the agent_name set at deck creation, or "Agent" if none was set. |

---

## resolve_comment

### Description

Resolve a comment, marking it as addressed. Only resolve when explicitly asked — let the user confirm satisfaction first.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `deck_id` | string | yes | The deck ID |
| `comment_id` | string | yes | The comment ID to resolve |

---

## Examples

### Example 1: Create a multi-slide deck

**User prompt:** "Create a 4-slide deck about our Q2 product launch"

**Tool calls:**

1. `search_images` — find a relevant hero image:
```json
{
  "queries": ["product launch celebration", "rocket launch"],
  "orientation": "landscape",
  "per_page": 3
}
```

2. `create_deck` — build the deck with multiple layouts:
```json
{
  "title": "Q2 Product Launch",
  "accent_color": "#2563eb",
  "heading_font": "Inter",
  "slides": [
    {
      "layout": "title",
      "content": {
        "title": "Q2 Product Launch",
        "subtitle": "Shipping faster, together",
        "image_ref": "<id from search_images>"
      }
    },
    {
      "layout": "title_and_bullets",
      "content": {
        "title": "What's New",
        "bullets": [
          "Real-time collaboration for teams",
          "Redesigned dashboard with analytics",
          "API v2 with webhook support",
          "Mobile app for iOS and Android"
        ]
      }
    },
    {
      "layout": "stats",
      "content": {
        "title": "Early Access Results",
        "metrics": [
          { "value": "3.2x", "label": "Faster onboarding" },
          { "value": "94%", "label": "User satisfaction" },
          { "value": "12K", "label": "Beta sign-ups" }
        ]
      }
    },
    {
      "layout": "closing",
      "content": {
        "heading": "Ready to launch?",
        "subheading": "Available June 15",
        "contact_lines": ["product@example.com", "example.com/launch"]
      }
    }
  ]
}
```

**Response includes:**
- `viewer_url` — owner link with edit key (e.g. `https://deckpipe.dev/d/dk_abc123?key=ek_xyz`)
- `share_url` — read-only link (e.g. `https://deckpipe.dev/d/dk_abc123`)
- `warnings` — array of any issues to fix

---

### Example 2: Search for images and use them in slides

**User prompt:** "Add photos to my presentation about remote work"

**Tool calls:**

1. `search_images` — batch-search multiple topics at once:
```json
{
  "queries": ["remote work home office", "video call team meeting", "digital nomad laptop"],
  "orientation": "landscape",
  "per_page": 3
}
```

2. `update_deck` — add images to existing slides using image_ref:
```json
{
  "deck_id": "dk_abc123",
  "slides": [
    {
      "index": 0,
      "content": {
        "image_ref": "<id from 'remote work home office' results>"
      }
    },
    {
      "index": 2,
      "content": {
        "image_ref": "<id from 'video call team meeting' results>"
      }
    }
  ]
}
```

The `image_ref` field automatically resolves the Unsplash image ID to a hosted URL and handles attribution and download tracking.

---

### Example 3: Iterate on a deck based on comments

**User prompt:** "Check my deck for feedback and make the requested changes"

**Tool calls:**

1. `get_deck` — read current state with comments:
```json
{
  "deck_id": "dk_abc123"
}
```

Response includes slides with `comments[]` arrays. Example comment:
```json
{
  "id": "cmt_x1y2z3",
  "slide_id": "sld_m4n5o6",
  "content_path": "bullets[1]",
  "status": "open",
  "messages": [
    { "author_name": "Sarah", "body": "This bullet is too vague — add specific numbers" }
  ]
}
```

2. `update_deck` — apply the requested change:
```json
{
  "deck_id": "dk_abc123",
  "slides": [
    {
      "index": 2,
      "content": {
        "bullets": ["Revenue grew 34% YoY to $4.2M", "Expanded to 3 new markets", "NPS increased from 42 to 67"]
      }
    }
  ]
}
```

3. `reply_to_comment` — acknowledge the feedback:
```json
{
  "deck_id": "dk_abc123",
  "comment_id": "cmt_x1y2z3",
  "body": "Updated bullet with specific revenue and growth numbers."
}
```

The user can then review the changes in the viewer and resolve the comment when satisfied.
