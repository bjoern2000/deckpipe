# deckpipe-mcp

MCP server for [deckpipe](https://deckpipe.dev) — author slide decks as HTML/CSS/JS from any AI agent.

Each slide is a `canvas` slide: you write the HTML, optional scoped CSS, and optional JS. deckpipe mounts it in a sandboxed 1920×1080 shadow root, themes it via deck-level CSS variables, and gives every deck a shareable viewer URL with built-in commenting.

- **Hosted:** [deckpipe.dev](https://deckpipe.dev)
- **Remote MCP endpoint:** `https://deckpipe.dev/mcp` (Streamable HTTP)
- **Source:** [github.com/bjoern2000/deckpipe](https://github.com/bjoern2000/deckpipe) (this package lives at `packages/mcp/`)

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
| `get_deck` | Retrieve a deck by ID (includes open comments) |
| `update_deck` | Edit slide content, restructure slides, change theme |
| `delete_deck` | Delete a deck permanently |
| `upload_image` | Upload a base64 image, get a hosted URL |
| `search_images` | Search Unsplash for stock photos with automatic attribution |
| `preview_slide` | Render a transient slide (no persistence) and return a screenshot + render report. Iterate on html/css/js before committing to a deck. |
| `get_slide_screenshot` | Render a specific slide of an existing deck. Cached on `updated_at`. |
| `list_layouts` | Describe the canvas layout and deck-level theming options |
| `list_comments` | List comments on a deck (filter by status, slide, since-timestamp) |
| `reply_to_comment` | Reply to a comment thread after addressing feedback |
| `resolve_comment` | Mark a comment as resolved |

## The canvas slide

Every slide is a canvas slide:

```json
{
  "layout": "canvas",
  "content": {
    "html": "<h1 class=\"hero\" data-dp-anchor=\"title\">Q2 launch</h1>",
    "css": ".hero { font-weight: 800; letter-spacing: -0.02em; }",
    "js": "slide.querySelector('h1').animate([{opacity:0},{opacity:1}], 600);"
  }
}
```

- **Design space:** 1920×1080. The viewer scales the slide to fit.
- **CSS is auto-scoped.** Each slide mounts in an open shadow root — no BEM or class prefixes needed.
- **Deck-level `stylesheet`** is adopted by every canvas slide. Define a design system (typography, color tokens, reusable `.card`/`.grid`/`.hero` classes) once and reference it from every slide's html.
- **Deck-level `head`** is an array of `<link>` / `<script>` / `<style>` entries injected into the page head. Load Google Fonts here as `<link>` entries, then set `font-family` in your stylesheet.
- **`js` runs on slide enter** with `(root, slide)` in scope. Return a cleanup function to run on slide exit. Set `static_render_only: true` to skip JS in print/PDF.

## Commenting and inline editing

Reviewers can comment on **any DOM element** in a canvas slide — deckpipe auto-assigns a `content_path` to every element at render time. To make a comment thread stable across edits, mark the target element with `data-dp-anchor="<stable-name>"` (e.g. `<h1 data-dp-anchor="hero-title">`). Preserve those IDs in your updates and the thread stays attached.

The viewer's edit mode also makes text-bearing leaf elements (`h1`, `p`, `span`, etc.) `contenteditable`. On blur the full html is saved back via PATCH. Your `js` should be resilient to text changes — don't rely on exact text strings to find elements; use selectors or `data-*` attributes.

## Theming

| Field | Description |
|-------|-------------|
| `stylesheet` | Global CSS adopted by every canvas slide (up to 100KB). Define typography, color tokens, and reusable classes here. |
| `head` | `<link>` / `<script>` / `<style>` entries injected into the page head. Load Google Fonts via `<link>` here, then reference them as `font-family` in your stylesheet. |

## Comments workflow

1. Call `get_deck` — each slide includes a `comments[]` array with open comments
2. Each comment has a `content_path` (`anchor:hero-title`, `auto:5`, or `slide`) telling you which element it refers to
3. Use `update_deck` to address the feedback
4. Call `reply_to_comment` to explain what you changed
5. The user resolves the comment once satisfied

Set `agent_name` when calling `create_deck` (e.g. `"Acme Strategy Agent"`) — this name appears on your replies.

## Warnings

`create_deck` and `update_deck` responses may include a `warnings` array with actionable feedback:

```json
{
  "deck_id": "dk_abc",
  "viewer_url": "...",
  "warnings": [
    "Slide 2: image_url returned HTTP 404 — image may not render (https://example.com/missing.jpg)"
  ]
}
```

Unreachable images are flagged with a HEAD request during creation/update; fix them with a follow-up `update_deck` call.

## Configuration

By default the MCP server connects to `https://deckpipe.dev`. To use a self-hosted instance:

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

## Legacy templated layouts

deckpipe 0.2 had 25 templated layouts (`title`, `title_and_bullets`, `stats`, `swot`, etc.). They are deprecated and no longer advertised. Existing decks using them still render unchanged and the REST API still accepts them; new slides should always use `canvas`. See [CLAUDE.md → "Resurrecting deprecated layouts"](https://github.com/bjoern2000/deckpipe/blob/master/CLAUDE.md) if you need to re-enable them.

## Support

- **Issues, bug reports, feature requests:** [open an issue on GitHub](https://github.com/bjoern2000/deckpipe/issues)
- **Email:** [bjoern.schefzyk@gmail.com](mailto:bjoern.schefzyk@gmail.com)

## Legal

- [Privacy policy](https://deckpipe.dev/privacy.html)
- [Terms of use](https://deckpipe.dev/terms.html)

**Note:** Decks on the hosted instance are stored without authentication and accessible by anyone who has the deck ID. Do not store confidential or personal information in decks.

## License

[MIT](https://github.com/bjoern2000/deckpipe/blob/master/LICENSE) — use, modify, fork, host, and ship commercially.

Copyright © 2026 Björn Schefzyk.
