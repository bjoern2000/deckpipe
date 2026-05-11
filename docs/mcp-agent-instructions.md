# MCP Agent Instructions

All agent-facing text for Deckpipe MCP tools. This is a review document — the source of truth lives in two places that must be kept in sync:

- **Remote MCP**: `packages/api/src/routes/mcp.ts`
- **Standalone MCP**: `deckpipe-mcp` repo — `src/index.ts`

---

## Server Instructions (sent automatically on connect)

Deckpipe is a slide deck rendering engine. You author each slide as HTML/CSS/JS — Deckpipe renders it inside a sandboxed 1920×1080 shadow root, themes it via deck-level CSS variables, and gives every deck a shareable viewer URL with built-in commenting.

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
- stylesheet: global CSS string adopted by every canvas slide. Define your design system once (typography, color tokens, reusable card/grid classes) and reference classes from each slide's html. Up to 100KB.
- head: array of { tag, attrs?, body? } entries injected into the page head. Use to load CDN libraries (Tailwind, Chart.js, icon fonts). Example: [{ tag: "script", attrs: { src: "https://cdn.tailwindcss.com" } }].
- accent_color / heading_font / body_font are forwarded as CSS variables.

COMMENTING
- Reviewers can leave comments on ANY DOM element in a canvas slide — Deckpipe auto-assigns a content_path to every element at render time.
- To make a comment thread STABLE across edits, mark the target element with data-dp-anchor="<stable-name>" (e.g. data-dp-anchor="hero-title"). Preserve those IDs across updates.
- Comments on unmarked elements use auto:<index> paths that are stable within a render but may shift if you restructure the HTML.

INLINE EDITS
- The viewer's edit mode makes text-bearing leaf elements (h1, p, span, etc.) contenteditable. On blur the full html is saved back via PATCH.
- Your "js" should be resilient to text changes — don't rely on exact text strings.

IMAGES
- Use search_images to find stock photos (Unsplash). In canvas slides, place the returned url directly in <img src>. Include a credit caption near the image.
- Use upload_image to host your own images (PNG/JPG/WebP, base64-encoded).

CONTENT STYLE
- Keep text short, crisp, and scannable. Stats: abbreviate ("2.4M" not "2,400,000"). Quotes: under 30 words. Headlines: ≤ 8 words.

LEGACY LAYOUTS
- 25 templated layouts (title, title_and_bullets, stats, chart, swot, …) are deprecated and not advertised. Existing decks using them still render. New slides should always use "canvas". See CLAUDE.md → "Resurrecting deprecated layouts" if you need to re-enable them in the MCP surface.

---

## create_deck

### Description

Create a new slide deck. Returns viewer_url (owner link with edit key) and share_url (read-only).

Each slide is a canvas slide — you write HTML/CSS/JS directly:
`{ layout: "canvas", content: { html (required), css?, js?, static_render_only?, key_takeaway? } }`

Design checklist:
- Design at 1920×1080. The viewer scales to fit.
- Define shared styles ONCE in deck.stylesheet (typography, color tokens, reusable classes).
- Use forwarded CSS variables: var(--dp-accent), var(--dp-text-title), var(--dp-text-body), var(--dp-font-heading), var(--dp-font-body).
- For Tailwind: add `{ tag: "script", attrs: { src: "https://cdn.tailwindcss.com" } }` to deck.head.
- Mark commentable elements with `data-dp-anchor="<stable-id>"`.
- Optional "js" runs `(root, slide)` on slide enter — return a cleanup function.

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
| `slides` | array | yes | Array of canvas slides |
| `slides[].layout` | literal | yes | Always `"canvas"`. (Templated layouts deprecated — see CLAUDE.md to re-enable.) |
| `slides[].content.html` | string | yes | Slide markup, designed at 1920×1080 |
| `slides[].content.css` | string | no | Per-slide CSS (scoped to this slide). For shared styles use deck.stylesheet. |
| `slides[].content.js` | string | no | Runs on slide enter; receives `(root, slide)`. Return a cleanup function. |
| `slides[].content.static_render_only` | boolean | no | Skip JS in print/PDF mode. |
| `slides[].content.key_takeaway` | string | no | One-line summary surfaced in agent-facing comment context. |

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
- Insert: { "op": "insert", "index": 5, "slide": { "layout": "canvas", "content": { "html": "<div class=\"slide\">...</div>" } } }
- Delete: { "op": "delete", "index": 2 }
- Move: { "op": "move", "from": 0, "to": 3 }
- Replace: { "op": "replace", "index": 4, "slide": { "layout": "canvas", "content": { "html": "..." } } }

slides (content edit) examples:
- Replace the html of slide 0: { "index": 0, "content": { "html": "<div class=\"slide\">new markup</div>" } }
- Tweak the css of slide 2: { "index": 2, "content": { "css": ".card { border-radius: 24px; }" } }
- Editing existing decks that use the deprecated templated layouts is supported (the REST API still accepts them); just patch their content fields directly.

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
