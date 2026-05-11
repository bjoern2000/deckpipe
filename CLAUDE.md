# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Deckpipe is an agent-first slide deck rendering engine. Agents author each slide as HTML/CSS/JS (the `canvas` layout); Deckpipe renders it inside a sandboxed shadow root, themes it via deck-level CSS variables, and gives every deck a shareable viewer URL with built-in commenting. Three packages in a Node.js/TypeScript monorepo.

As of Deckpipe 0.3, `canvas` is the only agent-facing layout. The 25 templated layouts from 0.2 still exist in the codebase and the REST API still accepts them — see "Resurrecting deprecated layouts" below for the resurrection path.

## Commands

```bash
# Dev setup (local Postgres must be running)
npm install
npm run db:migrate          # Run SQL migrations

# Development
npm run dev                 # API + Viewer concurrently
npm run dev:api             # API only (port from .env, currently 3010)
npm run dev:viewer          # Vite dev server (port 5173, proxies /v1/* to API)
# Build
npm run build               # All packages (shared must build first)
npm run build:shared        # Just shared (others depend on it)
```

## Architecture

**`packages/shared`** — Zod schemas, TypeScript types, ID generators, error types. Every other package depends on this. `schema.ts` defines the discriminated union of slide layouts (`canvas` plus 25 deprecated templated layouts kept for backward compatibility) and is the single source of truth for the data model. Deck-level `stylesheet` and `head` fields live here too.

**`packages/api`** — Express REST API on `/v1/decks` and `/v1/images`. PostgreSQL with JSONB for slide data plus `stylesheet TEXT` and `head JSONB` columns. Image uploads stored to disk at `IMAGE_STORAGE_PATH`. External image URLs in slides are automatically re-hosted on deck creation. Rate limiting per-endpoint. The REST API still accepts all layouts so legacy decks remain editable.

**`packages/viewer`** — Lit web components. `viewer-app.ts` is the top-level shell (deck loading, navigation state, edit mode, auto-save, head-entry injection). `slide-renderer.ts` is a factory that routes `layout` to a component — `canvas` → `<slide-canvas>` (open shadow root, adopts deck stylesheet + slide css, runs slide js on enter), everything else → the legacy `<slide-*>` components. Slide dimensions computed via ResizeObserver to fit 16:9 in available space.

## Key Patterns

- **Canvas slide**: `{ layout: "canvas", content: { html (required), css?, js?, static_render_only?, key_takeaway? } }`. `<slide-canvas>` mounts the html into an open shadow root, adopts (deck.stylesheet + slide.css) via `adoptedStyleSheets`, and runs `js` on enter with `(root, slide)` in scope. Custom properties `--dp-accent / --dp-text-* / --dp-font-*` are forwarded into every shadow root.
- **Slide schema**: Discriminated union on `layout` field. `canvas` is the only advertised layout; the 25 legacy layouts (`title`, `title_and_bullets`, `stats`, `chart`, etc.) are still in the union so old decks render and the REST API stays compatible. The MCP surface forces new content to `canvas`.
- **PATCH semantics**: Index-based partial slide updates with deep merge: `{ slides: [{ index: 2, content: { html: "<div>…</div>" } }] }`. Top-level `title`/`heading_font`/`body_font`/`accent_color`/`stylesheet`/`head` updates supported. Structural changes via `slide_operations` array (insert, delete, move, replace) — executed sequentially before content edits.
- **Viewer edit flow (canvas)**: `<slide-canvas>` walks the shadow root, marks text-bearing leaf elements (`h1`, `p`, `span`, …) as `contenteditable` when `editable` is true. On `focusout`, the full cleaned `innerHTML` is emitted via `slide-content-changed` with field `'html'`; `viewer-app` debounces (1s) and PATCHes. Legacy `<slide-*>` components retain their per-field contenteditable flow.
- **Commenting (canvas)**: On mount, `<slide-canvas>` translates `data-dp-anchor="<name>"` → `data-content-path="anchor:<name>"` for stable anchors, then walks every other element depth-first and assigns `data-content-path="auto:<index>"`. The existing `comment-layer` walker descends into the open shadow root and uses smallest-area hit-testing. Anchors survive structural edits; `auto:*` paths only survive within a render.
- **Print mode**: `?print` query param renders all slides stacked with page breaks, no chrome. Used by Puppeteer for PDF export. Canvas slides with `static_render_only: true` skip their `js` in print.
- **Presenter mode**: Fullscreen presentation via "Present" button. Keyboard nav (arrows, spacebar, Escape). Cursor auto-hides after 3s inactivity. Black background, no chrome.
- **Fonts**: Deck-level `heading_font` and `body_font` (optional, any Google Font). Default: DM Sans. Applied via `--dp-font-heading` and `--dp-font-body` CSS custom properties, forwarded into canvas shadow roots.

## Resurrecting deprecated layouts

The 25 templated layouts from 0.2 (`title`, `title_and_bullets`, `stats`, `chart`, `swot`, `quadrant`, `venn_diagram`, `comparison`, `timeline`, `code`, `callout`, `icons_and_text`, `team`, `embed`, `pros_and_cons`, `agenda`, `swot`, `closing`, `title_and_body`, `title_and_table`, `two_columns`, `section_break`, `image_and_text`, `image_gallery`, `quote`, `full_image`) are still fully implemented:

- `packages/shared/src/schema.ts` — content schemas + the discriminated union entries
- `packages/viewer/src/components/slide-*.ts` — Lit components for each
- `packages/viewer/src/components/slide-renderer.ts` — routing switch
- `packages/api/src/utils/slide-warnings.ts` — content field validation
- `docs/mcp-agent-instructions.md` — review-friendly text

What changed in 0.3 is the **agent-facing MCP surface**. Specifically:

- `packages/api/src/routes/mcp.ts` and `deckpipe-mcp/src/index.ts` both narrow `create_deck.slides[].layout` and `slide_operations.slide.layout` to `z.literal('canvas')`.
- `list_layouts` returns only `canvas` plus a `deprecated_layouts` block.
- The `INSTRUCTIONS` and `create_deck`/`update_deck` descriptions document canvas only.

To bring the templated layouts back into the agent-facing surface:

1. In both `mcp.ts` files, re-import `LayoutNames` from `@deckpipe/shared` and swap the two `z.literal('canvas')` calls back to `z.enum(LayoutNames)`. Restore the `content: z.record(z.unknown())` shape.
2. Restore the full 25-layout listing in `list_layouts` (the data is preserved in git history pre-0.3.1, or reconstruct from the `slide-*.ts` components and `slide-warnings.ts`).
3. Update the `INSTRUCTIONS` constant to describe the templated layouts again.
4. Mirror in `docs/mcp-agent-instructions.md`.

Nothing else needs to change — the schema, viewer components, and REST API are unchanged.

## Related Repository

**`deckpipe-mcp`** (`/Users/bjornschefzyk/Projects/deckpipe-mcp`) — The MCP server package (`deckpipe-mcp` on npm). Nine tools (`create_deck`, `get_deck`, `update_deck`, `delete_deck`, `upload_image`, `list_layouts`, `list_comments`, `reply_to_comment`, `resolve_comment`) that wrap the REST API. Separate repo with its own build and release cycle.

**Important:** MCP tool definitions exist in **two places** that must be kept in sync:
1. `packages/api/src/routes/mcp.ts` — the remote MCP server (served at `/mcp`, used by Claude.ai and other remote clients)
2. `/Users/bjornschefzyk/Projects/deckpipe-mcp/src/index.ts` — the standalone npm package (used via `npx deckpipe-mcp`)

When updating MCP tools, **always update both files**. This includes: tool descriptions, parameter schemas, parameter `.describe()` hints, `list_layouts` response data (layout names, descriptions, fields, style_guide), and version strings. A review-friendly copy of all agent-facing text lives in `docs/mcp-agent-instructions.md` — update it too after any description change.

## Environment

Config in `.env` (see `.env.example`). Key vars: `DATABASE_URL`, `PORT`, `API_URL`, `VIEWER_URL`, `IMAGE_STORAGE_PATH`. The API config loads `.env` from the repo root via relative path resolution.

## Database

PostgreSQL. Two tables: `decks` (JSONB slides), `images` (metadata). Migrations in `packages/api/src/db/migrations/` — plain SQL files run by a simple tracker in `_migrations` table.
