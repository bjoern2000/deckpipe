<p align="center">
  <img src="assets/deckpipe_icon@2x.png" alt="Deckpipe" width="140" />
</p>

# Deckpipe

**Agent-first slide deck rendering engine.** Agents author each slide as HTML/CSS/JS; Deckpipe renders it inside a sandboxed 1920×1080 shadow root, themes it via deck-level CSS variables, gives every deck a shareable viewer URL, and supports threaded commenting from collaborators.

- **Hosted:** [deckpipe.dev](https://deckpipe.dev)
- **Remote MCP:** `https://deckpipe.dev/mcp` (Streamable HTTP)
- **Stdio MCP:** [`npx deckpipe-mcp`](https://www.npmjs.com/package/deckpipe-mcp)

---

## How it works

An agent calls `create_deck` with HTML, CSS, and (optionally) JS for each slide:

```json
{
  "title": "Q2 Launch",
  "head": [
    { "tag": "link", "attrs": { "rel": "stylesheet", "href": "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400&display=swap" } }
  ],
  "stylesheet": ".hero { font-family: 'Fraunces', serif; font-size: 128px; color: #0f172a; }",
  "slides": [
    {
      "layout": "canvas",
      "content": {
        "html": "<h1 class=\"hero\" data-dp-anchor=\"title\">Q2 launch</h1>",
        "js": "slide.querySelector('h1').animate([{opacity:0},{opacity:1}], 600);"
      }
    }
  ]
}
```

Each slide mounts in an **open shadow root**, so CSS is auto-scoped — no BEM, no class prefixes. Deck-level `stylesheet` is adopted by every slide, so a design system written once shows up everywhere. Load fonts via `head` entries and reference them in your stylesheet.

Reviewers open the viewer URL and can comment on **any DOM element** (auto-anchored via `data-dp-anchor` for stability across edits). The agent reads those comments via MCP, edits the deck, and replies — full collaborative loop without humans touching JSON.

The hosted instance at deckpipe.dev is free and unauthenticated — decks are addressed by unguessable IDs. You can also self-host the whole stack.

## Use it

### From Claude.ai / Claude Desktop / any Streamable HTTP MCP client

Add `https://deckpipe.dev/mcp` as a custom remote MCP server. No auth.

### From Claude Code (local stdio)

```bash
claude mcp add deckpipe -- npx deckpipe-mcp
```

### Manual MCP config

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

Then ask the agent to "build a deck about X". The agent gets back a viewer URL you can open and comment on.

## Skill for Claude Code

The MCP `INSTRUCTIONS` your agent receives are intentionally tight. The richer design guidance — brief-clarification questions, density rules, reference-style cheatsheet, the layout-safety pattern, post-create overflow sweep — lives in a Claude Code [skill](https://deckpipe.dev/skill.md).

Read it: **<https://deckpipe.dev/skill.md>**

Install in any project so your Claude Code agent auto-loads it:

```bash
mkdir -p .claude/skills/deckpipe-design
curl -o .claude/skills/deckpipe-design/SKILL.md https://deckpipe.dev/skill.md
```

For Cursor, Windsurf, or any other MCP client — paste the skill content into your system prompt or rules file. It's plain markdown.

The canonical source lives in this repo at [`.claude/skills/deckpipe-design/SKILL.md`](.claude/skills/deckpipe-design/SKILL.md).

## Self-host

```bash
git clone https://github.com/bjoern2000/deckpipe
cd deckpipe
npm install

cp .env.example .env       # set DATABASE_URL, PORT, IMAGE_STORAGE_PATH, etc.
npm run db:migrate         # apply SQL migrations (local Postgres)

npm run dev                # API on :3010, viewer on :5173
npm run build              # production builds for all packages
```

Point your MCP client at `http://localhost:3010/mcp`, or run the stdio shim with `DECKPIPE_API_URL=http://localhost:3010 npx deckpipe-mcp`.

## Architecture

This is a single Node.js / TypeScript monorepo (npm workspaces). Five packages:

| Package | What |
|---|---|
| `packages/shared` | Zod schemas, types, ID generators. Source of truth for the data model. |
| `packages/mcp-core` | MCP tool definitions (`registerTools`, `INSTRUCTIONS`). Imported by both MCP transports — single source of truth. |
| `packages/api` | Express REST API on `/v1/*` plus the remote MCP transport at `/mcp`. PostgreSQL with JSONB. |
| `packages/viewer` | Lit web components. Renders canvas slides into shadow roots, handles edit mode, comment overlay, presenter/print modes. |
| `packages/mcp` | Standalone npm package `deckpipe-mcp` — stdio + HTTP transports for local agents. Pure transport plumbing, calls into `mcp-core`. |

Tools (MCP):

| Tool | Description |
|---|---|
| `create_deck` | Create a new deck, get a shareable viewer URL. |
| `get_deck` | Read deck state including open comments. |
| `update_deck` | Edit slide content, restructure slides, change theme. |
| `delete_deck` | Permanently delete a deck. |
| `upload_image` | Upload base64 PNG/JPG/WebP, get a hosted URL. |
| `search_images` | Unsplash search with automatic attribution + download tracking. |
| `preview_slide` | Render a transient slide (no persistence) and return a screenshot + render report. |
| `get_slide_screenshot` | Render a specific slide of an existing deck. Cached on `updated_at`. |
| `list_layouts` | Describe the canvas layout and deck-level theming options. |
| `list_comments` | List comments on a deck (filter by status, slide, since-timestamp). |
| `reply_to_comment` | Reply to a comment thread. |
| `resolve_comment` | Mark a comment as resolved. |

A note on layouts: Deckpipe 0.2 had 25 templated layouts (`title_and_bullets`, `stats`, `swot`, etc.). They're now deprecated for new content — `canvas` is the only layout the MCP advertises. Existing decks using templated layouts still render unchanged, and the schema still accepts them. See `CLAUDE.md → "Resurrecting deprecated layouts"` for the steps to re-enable them on the MCP surface.

## Contributing

Issues and pull requests welcome. Before sending substantial changes, please open an issue to discuss the approach.

This project will eventually require a Contributor License Agreement (CLA) so contributions can be relicensed alongside the auto-conversion to Apache 2.0 in 2030. For now, every PR is reviewed by hand and small contributions are accepted under the file's existing license.

## License

[FSL-1.1-Apache-2.0](./LICENSE) — Functional Source License, Version 1.1, Apache 2.0 Future License.

Free for: self-hosting, internal use, education, research, and any non-competing use. Prohibited until 2030-05-11: offering Deckpipe (or a substantially-similar service) as a commercial hosted product to third parties. After the change date the entire repository auto-converts to Apache 2.0.

"Deckpipe" is a trademark held separately. Forks must rename.

Copyright © 2026 Björn Schefzyk.
