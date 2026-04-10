# MCP Agent Instructions

All tool descriptions and parameter hints that agents see when using Deckpipe MCP tools. This is a review document — the source of truth lives in two places that must be kept in sync:

- **Remote MCP**: `packages/api/src/routes/mcp.ts`
- **Standalone MCP**: `deckpipe-mcp` repo — `src/index.ts`

---

## create_deck

### Description

Create a new slide deck and get a shareable viewer URL.

Keep slide copy short and scannable — use shorthand phrases, not full sentences. Bullets: 5-8 words max.

MARKDOWN: All text content fields support markdown rendering. Use **bold**, *italic*, `code`, [links](url), and lists (1. ordered, - unordered) in body, subtitle, bullets, table cells, and key_takeaway fields. Body text fields support full block markdown including numbered and bulleted lists.

Layouts: "title", "title_and_body", "title_and_bullets", "title_and_table", "two_columns", "section_break", "image_and_text", "image_gallery", "stats", "quote", "full_image", "timeline", "comparison", "code", "callout", "icons_and_text", "team", "embed", "pros_and_cons", "agenda", "closing", "swot", "quadrant", "venn_diagram", "chart".

Content fields per layout (all layouts support optional key_takeaway):
- title: { title, subtitle?, image_url? }
- title_and_body: { title, body, image_url?, image_prompt? }
- title_and_bullets: { title, bullets[], image_url?, image_prompt? }
- title_and_table: { title, table: { headers[], rows[][], highlight_column? } }
- two_columns: { title, left: { heading, body }, right: { heading, body }, image_url?, image_prompt? }
- section_break: { title }
- image_and_text: { title, body, image_url (required unless image_prompt provided), image_prompt? }
- image_gallery: { title?, caption?, images[] (2-5 URLs, required unless image_prompt provided), image_prompt? }
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
- closing: { heading?, subheading?, contact_lines?[], image_url? }
- swot: { title?, strengths[], weaknesses[], opportunities[], threats[] (1-5 items each) }
- quadrant: { title?, body?, bullets?[], x_label?, y_label?, quadrant_labels?[4], items[]: { label, x: 0-1, y: 0-1 } (1-12 items) }
- venn_diagram: { title?, body?, circles[]: { label, items?[] } (2-3 circles, required), overlaps?[]: { sets: [circle indices], label } (max 4) }
- chart: { chart_type: "bar"|"line"|"pie"|"donut" (required), data: { labels[] (2-12 strings), datasets[]: { label?, values: number[], color? } (1-5 datasets) } (required), title? }

IMAGE PLACEHOLDERS: Use image_prompt (any layout that supports image_url) to suggest an image without providing one. Renders as a dashed placeholder box with your prompt text so the user knows what image to drop in. Example: image_prompt: "Screenshot of the iOS app home screen". When the user drops in an image, it replaces the placeholder.

RICH BULLETS: In any layout with bullets (title_and_bullets, comparison, swot, pros_and_cons, quadrant), bullets can be plain strings OR objects: { text, detail?, sources?: [{ label, url? }] }. Use "detail" for hover-accessible explanations (info icon tooltip). Use "sources" for citation footnotes (superscript numbers at bottom of slide).

Optionally set heading_font and body_font (any Google Font name) and accent_color (hex like "#ff6600") to customize the look.
Use upload_image first to get hosted URLs for any images.

WARNINGS: The response may include a "warnings" array with actionable feedback:
- Unrecognized content fields (typos, wrong fields for a layout) — the field was silently ignored
- Unreachable image URLs — the image will not render in the viewer
Check warnings after every create/update call and fix any issues with a follow-up update_deck call.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `title` | string | yes | Deck title |
| `heading_font` | string | no | Google Font for headings (e.g. "Playfair Display"). Default: DM Sans. |
| `body_font` | string | no | Google Font for body text (e.g. "Inter"). Default: DM Sans. |
| `accent_color` | string | no | Hex color (e.g. "#ff6600"). Overrides default purple accent. |
| `agent_name` | string | no | Your agent name (e.g. "Acme Strategy Agent"). Shown as author on comments you post. Set this once at deck creation. |
| `slides` | array | yes | Array of slides |
| `slides[].layout` | enum | yes | One of the 25 layout types |
| `slides[].content` | object | yes | Content fields (vary by layout). All layouts support optional key_takeaway. |

---

## get_deck

### Description

Retrieve a deck by ID, including any user edits made in the viewer.

Each slide includes a comments[] array with all open comments. Each comment has: id, content_path (the JSON field it refers to, e.g. "title", "bullets[2]", "slide" for general), status, messages[] thread, and created_at.

WORKFLOW: Always call get_deck first when iterating on a deck. Read the comments on each slide to understand user feedback, then use update_deck to address it and reply_to_comment to explain what you changed.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `deck_id` | string | yes | The deck ID (e.g. "dk_a1b2c3d4") |

---

## update_deck

### Description

Update a deck. NEVER recreate a deck — always use this tool. This tool has TWO separate parameters for two different purposes:

1. "slide_operations" — STRUCTURAL changes (adding, removing, reordering slides). This is the ONLY way to add new slides.
2. "slides" — CONTENT edits to existing slides (partial merge by index). This does NOT add slides — it only updates content of slides that already exist.

IMPORTANT: To add a new slide, you MUST use slide_operations with op "insert", NOT the slides array. The slides array only merges content into existing slide indices.

slide_operations examples (executed in order):
- ADD a new slide: { "op": "insert", "index": 5, "slide": { "layout": "title_and_bullets", "content": { "title": "New Slide", "bullets": ["Point 1", "Point 2"] } } }
- Remove a slide: { "op": "delete", "index": 2 }
- Reorder: { "op": "move", "from": 0, "to": 3 }
- Replace entirely: { "op": "replace", "index": 4, "slide": { "layout": "stats", "content": { "metrics": [{ "value": "99%", "label": "Uptime" }] } } }

slides (content edit) examples — only for updating EXISTING slides:
- Update title of slide 0: { "index": 0, "content": { "title": "New Title" } }

slide_operations run first, then slides content edits apply to the post-operations array. All text fields support markdown.

WARNINGS: The response may include a "warnings" array flagging unrecognized content fields (typos/wrong layout fields) and unreachable image URLs. Always check warnings and fix issues.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `deck_id` | string | yes | Deck ID to update |
| `title` | string | no | New deck title |
| `heading_font` | string | no | Google Font for headings (e.g. "Playfair Display") |
| `body_font` | string | no | Google Font for body text (e.g. "Inter") |
| `accent_color` | string | no | Hex color (e.g. "#ff6600") |
| `slide_operations` | array | no | Structural changes: add, remove, reorder, or replace slides. Use this to INSERT NEW SLIDES — do not recreate the deck. |
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

Upload a base64-encoded image to get a hosted URL for use in slide image_url fields.

Accepts PNG, JPG, WebP up to 10MB. Upload first, then use the returned URL when creating or updating a deck.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `image_data` | string | yes | Base64-encoded image data |
| `filename` | string | yes | Filename with extension (e.g. "photo.jpg") |
| `content_type` | enum | yes | "image/png", "image/jpeg", or "image/webp" |

---

## list_layouts

### Description

List all available slide layouts, their content fields, and themes. Use this to discover what is supported before creating a deck.

### Parameters

None.

### Response

Returns a JSON object with three sections:

**`layouts`** — Array of objects, each with:
- `name` — Layout identifier
- `description` — Short human-readable description
- `fields` — Content fields with types and required/optional markers

**`customization`** — Styling options:
- `heading_font`: Optional Google Font for headings (e.g. "Playfair Display"). Default: DM Sans.
- `body_font`: Optional Google Font for body text (e.g. "Inter"). Default: DM Sans.
- `accent_color`: Optional hex color (e.g. "#ff6600"). Default: #7c3aed (purple).

**`style_guide`** — Guidance for producing good slides:
- `copy`: Keep text short and scannable. Use shorthand phrases, not full sentences. Bullets: 5-8 words max. Stats: abbreviate large numbers (e.g. "2.4M" not "2,400,000"). Quotes: under 30 words.
- `images`: Use upload_image to host images. image_gallery works best with 2-5 portrait images of consistent aspect ratio. full_image needs high-res landscape images.
- `rich_bullets`: Bullets in title_and_bullets, comparison, swot, pros_and_cons, and quadrant can be plain strings or objects: { text, detail?, sources?: [{ label, url? }] }. Use detail for hover tooltips. Use sources for footnote citations.
- `image_prompt`: Use image_prompt instead of image_url to suggest an image the user should provide. Renders as a dashed placeholder with your descriptive text. Example: "Screenshot of the competitor app onboarding flow". User drops in the real image later.

---

## list_comments

### Description

List comments on a deck. Use this to check for user feedback before making updates.

WORKFLOW — always follow this when iterating on a deck:
1. Call list_comments to see open feedback
2. Read each comment's content_path to know which field it refers to (e.g. "title", "bullets[2]", "left.heading", or "slide" for general feedback)
3. Use the slide_id to find the right slide in the deck
4. Call update_deck to address the feedback
5. Call reply_to_comment explaining what you changed
6. The user will resolve the comment once satisfied — do NOT resolve comments yourself unless explicitly asked

Each comment has a messages[] thread. The first message is the original comment; subsequent messages are replies from users or agents.

RETURNS: Array of comment objects, each with: id, slide_id, content_path, status ("open"/"resolved"), messages[], created_at, updated_at.

TIP: Use the "since" parameter with an ISO timestamp to only fetch comments that are new or have new replies since your last check. Save the current timestamp before each call and pass it as "since" on the next call.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `deck_id` | string | yes | The deck ID |
| `status` | enum | no | Filter by "open" or "resolved". Defaults to showing all. Use "open" to see only unresolved feedback. |
| `slide_id` | string | no | Filter to a specific slide by its stable slide_id (e.g. "sld_a1b2c3d4") |
| `since` | string | no | ISO timestamp. Only return comments created or updated since this time. Use this to poll for new feedback efficiently. |

---

## reply_to_comment

### Description

Reply to a comment thread on a deck. Use this after addressing user feedback to explain what you changed.

The user will see your reply in the comment thread and can resolve the comment or continue the conversation. Keep replies concise — summarize the change you made, don't repeat the feedback.

Example: "Updated the title to focus on ROI metrics as suggested. Also shortened the bullet points on this slide."

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

Resolve a comment, marking it as addressed. Typically the user resolves comments after reviewing your changes, but you may resolve if explicitly asked to.

Do NOT resolve comments proactively — always let the user confirm the feedback has been addressed.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `deck_id` | string | yes | The deck ID |
| `comment_id` | string | yes | The comment ID to resolve |
