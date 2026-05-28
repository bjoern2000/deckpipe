# MCP Agent Instructions

All agent-facing text for deckpipe MCP tools. This is a review document — the source of truth lives at `packages/mcp-core/src/index.ts`, imported by both the remote MCP transport (`packages/api/src/routes/mcp.ts`) and the standalone npm package (`packages/mcp`, published as `deckpipe-mcp`).

---

## Server Instructions (sent automatically on connect)

deckpipe is a slide deck rendering engine. You author each slide as HTML/CSS/JS — deckpipe renders it inside a sandboxed 1920×1080 shadow root, themes it via deck-level CSS variables, and gives every deck a shareable viewer URL with built-in commenting.

WORKFLOW
- Use create_deck for NEW decks. Use update_deck to modify EXISTING decks.
- START FROM A TEMPLATE: to base a new deck on an existing one, use clone_deck (any deck ID works as a template) to get a fresh deck with its own URL + edit key and no inherited comments, then shape it with update_deck. Don't hand-copy slides through create_deck, and never edit the template itself when you mean to make a copy.
- NEVER recreate a deck to make changes. Recreating loses the URL, edit key, and comment history. Always update in place.
- CALIBRATE DENSITY FIRST: before authoring a whole deck, build ONE representative content-heavy slide via preview_slide and look at the actual screenshot. The cover/title is the wrong slide to calibrate on — pick one that carries real text. If the user hasn't specified slide count or a reference style (Apple keynote / Pentagram case study / NYT Magazine / investor pitch / status update), ASK before committing — those signals are what tell you how much whitespace to use.
- ITERATE BEFORE COMMITTING: use preview_slide to render an HTML/CSS/JS draft and get a screenshot + render report. Both preview_slide and get_slide_screenshot return the actual rendered PNG inline — read it. The image is ground truth.
- SWEEP FOR OVERFLOWS AFTER CREATING: after create_deck, call get_slide_screenshot on every slide that carries dense text, large headlines, charts, or images. Read the "overflows" list. Any entry with reason:"off_canvas" or reason:"clipped" is a real bug — fix with update_deck before declaring the deck done.
- Round trip on an existing deck: get_deck (read state + open comments) → get_slide_screenshot (see how a slide actually renders) → update_deck (make changes) → reply_to_comment (explain what you changed).
- Check the "warnings" array in every create/update response. Fix unrecognized fields or unreachable image URLs with a follow-up update_deck call.

LAYOUT SAFETY (the box-sizing + footer-reserve trap)
- Open every deck.stylesheet with a universal box-sizing reset: `*, *::before, *::after { box-sizing: border-box }`. Without it, an element with `height:100%; padding:Xpx` becomes 100% + 2X in computed height and overflows its parent. This is the #1 cause of "content overlaps the footer" bugs.
- If a slide has a bottom-fixed footer/page-number row (e.g. `position:absolute; bottom:48px`), the in-flow content's bottom padding must clear it. Safe pattern: `.slide { padding: 112px 128px 160px }`. For full-bleed slides where `.slide` has no padding, apply the same reserve on the inner content container.
- After authoring the stylesheet, build the most vertically dense slide first (one with big headline + body + chart/diagram + footer) and screenshot it. If a headline + body + chart overflows, you'll see it before propagating the same mistake to every slide.

CONTENT DENSITY
- One idea per slide. If a slide is carrying a headline + lede + tag row + callout + pull-quote + attribution, you have three slides compressed into one — split it.
- Whitespace is a design element, not wasted space. Editorial decks read better at 20 sparse slides than 12 dense ones. Prefer breathing room unless the user explicitly asked for an information-dense format.
- Headlines ≤ 8 words. One concept per paragraph. Strip ornamentation before the final pass.
- The render report's "overflows" list is a SYNTACTIC check (off-canvas elements, content clipped by overflow:hidden). It says nothing about whether the slide looks good. A wall of text with no overflows is still a wall of text — the screenshot is the only signal that catches "too dense to read". Look at the image.

THE CANVAS LAYOUT
- Every slide is { layout: "canvas", content: { html (required), css?, js?, static_render_only? } }.
- "html" is the full slide markup. Design at 1920×1080 — the viewer scales the slide to fit. CSS in "css" is scoped to this slide only; for shared styles use deck.stylesheet.
- Each slide mounts in an open shadow root, so your CSS is auto-scoped — no need for BEM or class prefixes. No CSS framework ships by default; use deck.stylesheet for shared utilities.
- "js" runs on slide enter with (root, slide) in scope. Return a cleanup function to run on slide exit (clear timers, detach listeners). Set static_render_only: true to skip JS in print/PDF and screenshots.

DECK-LEVEL THEMING
- stylesheet: global CSS string adopted by every canvas slide. Define your design system once (typography, color tokens, reusable card/grid classes) and reference classes from each slide's html. Up to 100KB. Pick concrete pixel values for 1920×1080: h1 ≈ 96–128px, body ≈ 24–32px, padding ≈ 96–144px. It's adopted into a shadow root, so declare deck-wide custom properties on :host (a bare :root is auto-rewritten to :host).
- tokens: a flat { "--name": "value" } map injected into every slide as :host { … }. Put your palette / spacing / radius here, reference with var(--name). Unlike stylesheet, tokens are PATCHABLE one at a time via update_deck — flip --accent without re-sending the whole stylesheet.
- head: array of { tag, attrs?, body? } entries injected into the page head. Load Google Fonts here as <link> entries, then set font-family in deck.stylesheet on your typography classes. Font <link>s here are honored in screenshots (the renderer waits for them).

COMMENTING
- Reviewers can leave comments on ANY DOM element in a canvas slide — deckpipe auto-assigns a content_path to every element at render time.
- To make a comment thread STABLE across edits, mark the target element with data-dp-anchor="<stable-name>" (e.g. data-dp-anchor="hero-title"). Preserve those IDs across updates.
- Comments on unmarked elements use auto:<index> paths that are stable within a render but may shift if you restructure the HTML.

INLINE EDITS
- The viewer's edit mode makes text-bearing leaf elements (h1, p, span, etc.) contenteditable. On blur the full html is saved back via PATCH.
- Your "js" should be resilient to text changes — don't rely on exact text strings.

IMAGES
- Use search_images to find stock photos (Unsplash). Each result includes a full-resolution `url`, optional `url_full` (2400px) for hero shots, photographer info with UTM-tagged profile link, and a pre-built `attribution_html` snippet. Drop the url into <img src> and drop `attribution_html` into a small caption near the image. Deckpipe fires the required Unsplash download ping server-side on create_deck/update_deck — no manual tracking call needed.
- Use upload_image to host your own images (PNG/JPG/WebP/GIF/SVG, max 10MB). Provide it the simplest available way: a local file `path` (only when the MCP server runs on your machine), a remote `url` the server fetches and re-hosts, or base64 `image_data` + filename + content_type. Pass exactly one.

CONTENT STYLE
- Keep text short, crisp, and scannable. Stats: abbreviate ("2.4M" not "2,400,000"). Quotes: under 30 words. Headlines: ≤ 8 words.

AUTHORING GOTCHAS (the things you'd otherwise learn by trial and error)
- CSS lives in a SHADOW ROOT. deck.stylesheet and per-slide css are adopted into each slide's shadow tree, so selectors only match inside the slide. Declare deck-wide custom properties on :host — a bare ":root { … }" is auto-rewritten to ":host" for you. Once a token is defined there (or in tokens), var() resolves EVERYWHERE, including background:, background-image:, and gradients.
- Change one value cheaply. To tweak a single design value, PATCH the tokens map (update_deck { tokens: { "--accent": "#e11" } }) instead of re-sending the whole stylesheet. Pass return:"summary" so update_deck returns a small ack instead of echoing every slide's html/css/js.
- Fonts DO load from head <link>s. Add a Google Fonts <link> in head (or @font-face in stylesheet), then set font-family in stylesheet/tokens. Screenshots wait for head <link>s and force the used faces to load before capture. fonts_loaded/fonts_missing now reports only the faces your slide actually paints with.
- Uploading images: pass a local "path" (local server) or remote "url" — only the string crosses the wire. Reserve base64 "image_data" for tiny images; large blobs bloat (and may be truncated in) your context.
- Inspect without re-authoring. preview_slide AND get_slide_screenshot both return the rendered PNG inline. get_slide_screenshot renders a slide of an EXISTING deck, so you can see a live slide without re-sending its html.
- Address slides by slide_id. In update_deck.slides prefer { slide_id, content } over { index, content } — slide_id won't drift if the same call also reorders slides.

LEGACY LAYOUTS
- 25 templated layouts (title, title_and_bullets, stats, chart, swot, …) are deprecated and not advertised. Existing decks using them still render. New slides should always use "canvas". See CLAUDE.md → "Resurrecting deprecated layouts" if you need to re-enable them in the MCP surface.

---

## create_deck

### Description

Create a new slide deck. Returns viewer_url (owner link with edit key) and share_url (read-only).

Each slide is a canvas slide — you write HTML/CSS/JS directly:
`{ layout: "canvas", content: { html (required), css?, js?, static_render_only? } }`

Design checklist:
- Design at 1920×1080. The viewer scales to fit.
- Pick concrete pixel values: h1 ≈ 96–128px, body ≈ 24–32px, padding ≈ 96–144px. Designs sized for a 16px-base browser look tiny at HD.
- ONE IDEA PER SLIDE. If a slide has a headline + lede + tags + callout + quote + attribution, split it into two or three. Whitespace is a design element. For editorial decks, prefer 20 sparse slides over 12 dense ones unless the user asked for dense.
- BUILD ONE REPRESENTATIVE SLIDE FIRST. Pick a content-heavy slide (not the cover), preview_slide it, look at the actual screenshot, calibrate density, THEN author the rest at that bar.
- If the brief is vague ("hi-fi", "make it visual"), ASK for a reference (Apple keynote / Pentagram case study / NYT Magazine / investor pitch / status update) and a slide count before committing.
- Define shared styles ONCE in deck.stylesheet (typography, color tokens, reusable classes).
- Mark commentable elements with `data-dp-anchor="<stable-id>"`.
- Optional "js" runs `(root, slide)` on slide enter — return a cleanup function.
- Verify before committing: call `preview_slide` and READ THE SCREENSHOT and the render report. After creation, `get_slide_screenshot` returns the image inline so you can SEE what reviewers see.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `title` | string | yes | Deck title |
| `agent_name` | string | no | Your agent name (e.g. "Acme Strategy Agent"). Shown as author on comments you post. Set this once at deck creation. |
| `stylesheet` | string | no | Global CSS adopted by every canvas slide. Define a design system once and reference it from each slide. Up to 100KB. Adopted into a shadow root — use `:host` for deck-wide custom properties (a bare `:root` is auto-rewritten to `:host`). |
| `tokens` | object | no | Flat `{ "--name": "value" }` design-token map injected into every slide as `:host { … }`. Reference via `var(--name)`. Patchable one-at-a-time via update_deck. |
| `head` | array | no | `<link>`/`<script>`/`<style>` entries injected into the page head. Use for Google Fonts links, icon-font stylesheets, or trusted CDN scripts. Font `<link>`s here are honored in screenshots. |
| `slides` | array | yes | Array of canvas slides |
| `slides[].layout` | literal | yes | Always `"canvas"`. (Templated layouts deprecated — see CLAUDE.md to re-enable.) |
| `slides[].content.html` | string | yes | Slide markup, designed at 1920×1080 |
| `slides[].content.css` | string | no | Per-slide CSS (scoped to this slide). For shared styles use deck.stylesheet. |
| `slides[].content.js` | string | no | Runs on slide enter; receives `(root, slide)`. Return a cleanup function. |
| `slides[].content.static_render_only` | boolean | no | Skip JS in print/PDF mode and screenshots. |

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

## clone_deck

### Description

Duplicate an existing deck into a BRAND-NEW deck — the way to start from a template. The source can be any deck you have the ID of; there's no separate "template" type. The clone gets its own deck_id, viewer_url, and edit key, copies the source's slides / stylesheet / head / fonts verbatim (with fresh slide IDs), and does NOT inherit the source's comments. The source deck is left untouched.

Typical flow: clone_deck (from your template) → update_deck (replace placeholder content). Returns the same shape as create_deck plus `cloned_from`.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `source_deck_id` | string | yes | ID of the deck to clone from (your template) |
| `title` | string | no | Title for the new deck. Defaults to "Copy of <source title>". |
| `agent_name` | string | no | Author name for comments on the clone. Defaults to the source's agent_name. |

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
- Replace the html of a slide by id: { "slide_id": "sld_a1b2c3d4", "content": { "html": "<div class=\"slide\">new markup</div>" } }
- Tweak the css of slide 2 by index: { "index": 2, "content": { "css": ".card { border-radius: 24px; }" } }
- Address by slide_id (preferred — can't go stale across slide_operations) or index.
- Editing existing decks that use the deprecated templated layouts is supported (the REST API still accepts them); just patch their content fields directly.

Cheap edits (save context):
- Flip one design value via the patchable tokens map instead of re-sending stylesheet: { "tokens": { "--accent": "#e11d48" } }. A null value deletes that token; tokens:null clears all.
- Pass "return": "summary" to get back { deck_id, slide_count, updated_indices, warnings } instead of the entire deck echoed.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `deck_id` | string | yes | Deck ID to update |
| `title` | string | no | New deck title |
| `stylesheet` | string \| null | no | Replace deck-level global CSS for canvas slides (wholesale). Pass null to clear. Prefer `tokens` for single-value changes. |
| `tokens` | object \| null | no | PATCH the design-token map. A string value sets/overwrites a token, null deletes that one token, top-level null clears all. The cheap way to flip one value without re-sending the stylesheet. |
| `head` | array \| null | no | Replace deck-level head entries (wholesale). Pass null to clear. |
| `slide_operations` | array | no | Structural changes: add, remove, reorder, or replace slides. |
| `slide_operations[].op` | enum | yes | "insert", "delete", "move", or "replace" |
| `slide_operations[].index` | number | no | Target slide index. Required for insert, delete, replace. |
| `slide_operations[].from` | number | no | Source index. Only for move. |
| `slide_operations[].to` | number | no | Destination index. Only for move. |
| `slide_operations[].slide` | object | no | The new slide (layout + content). Required for insert and replace. |
| `slides` | array | no | Content edits to existing slides (applied after slide_operations) |
| `slides[].slide_id` | string | no | Stable slide id to target (preferred over index). Provide this OR index. |
| `slides[].index` | number | no | Zero-based slide index (post-operations). Provide this OR slide_id. |
| `slides[].content` | object | yes | Partial content to merge |
| `return` | enum | no | `"full"` (default) echoes the whole deck; `"summary"` returns just `{ deck_id, slide_count, updated_indices, warnings }`. |

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

Host an image (PNG/JPG/WebP/GIF/SVG, max 10MB) and get back a URL for use in `<img src>` on a canvas slide. Provide the image one of three ways — use the simplest available — and pass exactly one:

- `path` — absolute path to a local image file. Only offered when the MCP server runs on your machine (stdio); it reads the file directly, no encoding needed.
- `url` — a remote image URL the server fetches and re-hosts. Best when you found an image online or already have a hosted URL.
- `image_data` — base64-encoded bytes (with `filename` + `content_type`). Fallback for raw bytes.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `path` | string | no | Absolute path to a local image file. Only available on local (stdio) servers. |
| `url` | string | no | Remote image URL (http/https) to fetch and re-host. |
| `image_data` | string | no | Base64-encoded image data. Requires filename + content_type. |
| `filename` | string | no | Filename with extension (e.g. "photo.jpg"). Required with image_data. |
| `content_type` | enum | no | "image/png", "image/jpeg", "image/webp", "image/gif", or "image/svg+xml". Required with image_data. |

---

## search_images

### Description

Search Unsplash for stock photos. Each result returns everything you need to embed an image with proper attribution — no round-trip required.

Each result includes:
- `url` — 1920px wide URL, ready for `<img src="">` on a canvas slide
- `url_full` — 2400px wide URL, for full-bleed hero images
- `url_thumb` — 400px wide URL, for thumbnails
- `alt` — alt text from Unsplash
- `photographer` — `{ name, profile_url }` (UTM params already attached)
- `attribution_html` — pre-built credit snippet (e.g. `Photo: <a href="...">Jane Doe</a> / <a href="...">Unsplash</a>`)
- `download_location` — the Unsplash tracking endpoint. You don't need to call it. Deckpipe fires the download ping server-side when it sees the URL in your slide HTML on create_deck/update_deck.

Attribution is required by Unsplash terms. Drop `attribution_html` into a small caption near every image you use (a footer line, a corner overlay, etc.). Do not strip the UTM params from `photographer.profile_url`.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | yes | Search terms (e.g. "modern office workspace", "sunset over mountains") |
| `per_page` | number | no | Number of results (default 9, max 30) |
| `orientation` | enum | no | "landscape", "portrait", or "squarish". Use "landscape" for full_image/image_and_text, "portrait" for image_gallery. |

---

## preview_slide

### Description

Render a single canvas slide without persisting anything. Returns a PNG screenshot (base64) plus a render report (`js_errors`, `console_errors`, `overflows`, `fonts_loaded`, `fonts_missing`, `failed_requests`).

Use to iterate on slide html/css/js before calling `create_deck` or `update_deck`. The render runs through the real viewer pipeline at 1920×1080 — exactly what reviewers will see.

Each entry in `overflows` includes a `reason` field — `"off_canvas"` (element extends past the 1920×1080 slide frame) or `"clipped"` (element has `overflow: hidden|scroll|auto` and its content exceeds its box). The detector does NOT flag benign rendering bleed (italic descenders, negative letter-spacing on serif headings) on elements with `overflow: visible`. If the report comes back clean but the screenshot looks wrong, trust the screenshot — overflows is a syntactic check, the image is visual truth.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `html` | string | yes | Slide HTML (the markup that would go in `content.html`). |
| `css` | string | no | Optional per-slide CSS, scoped to this slide. |
| `js` | string | no | Optional per-slide JS. Runs with `(root, slide)`. |
| `static_render_only` | boolean | no | If true, your `js` is skipped during the preview. |
| `stylesheet` | string | no | Deck-level CSS to adopt (mirrors `deck.stylesheet`). Use so the preview matches your design system. |
| `tokens` | object | no | Deck-level design tokens (mirrors `deck.tokens`), injected as `:host { … }` so the preview resolves the same `var(--name)` references. |
| `head` | array | no | Deck-level head entries (Google Fonts links etc.). Same shape as `deck.head`. |
| `format` | enum | no | "png" (default) or "jpeg". |

---

## get_slide_screenshot

### Description

Render a specific slide of an existing deck. Returns the PNG inline (base64) so the agent can see exactly what reviewers see, plus a render report (JS errors, text overflows, font load status). Cache invalidates on every PATCH (keyed on `deck.updated_at`), so unchanged slides return instantly.

The render report's `overflows` list uses the same `reason` field as `preview_slide` (`"off_canvas"` or `"clipped"`). Absence of overflows is a syntactic check, not a visual one — the screenshot is ground truth.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `deck_id` | string | yes | The deck ID (e.g. `dk_a1b2c3d4`). |
| `slide_index` | number | yes | Zero-based slide index. |
| `format` | enum | no | "png" (default) or "jpeg". |

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
