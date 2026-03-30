# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Deckpipe is an agent-first slide deck rendering engine. Agents describe slides as JSON (layout + content); Deckpipe renders, themes, and exports them. Three packages in a Node.js/TypeScript monorepo.

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

**`packages/shared`** — Zod schemas, TypeScript types, ID generators, error types. Every other package depends on this. `schema.ts` defines the discriminated union for 11 slide layouts and is the single source of truth for the data model.

**`packages/api`** — Express REST API on `/v1/decks` and `/v1/images`. PostgreSQL with JSONB for slide data. Image uploads stored to disk at `IMAGE_STORAGE_PATH`. External image URLs in slides are automatically re-hosted on deck creation (`rehostImagesInDeck`). Rate limiting per-endpoint.

**`packages/viewer`** — Lit web components. `viewer-app.ts` is the top-level shell (deck loading, navigation state, edit mode, auto-save). `slide-renderer.ts` is a factory that maps `layout` to the correct `<slide-*>` component. Themes are pure CSS custom properties (`.theme-minimal` etc.) applied as a class on the slide container — zero theme logic in JS. Slide dimensions computed via ResizeObserver to fit 16:9 in available space.

## Key Patterns

- **Slide schema**: Discriminated union on `layout` field. 11 layouts: `title`, `title_and_body`, `title_and_bullets`, `title_and_table`, `two_columns`, `section_break`, `image_and_text`, `image_gallery`, `stats`, `quote`, `full_image`. Each has layout-specific content fields plus optional `key_takeaway`.
- **PATCH semantics**: Index-based partial slide updates with deep merge: `{ slides: [{ index: 2, content: { title: "New" } }] }`. Also supports top-level `title`/`theme` updates.
- **Viewer edit flow**: `contenteditable` on text elements → `blur` emits `slide-content-changed` CustomEvent → `viewer-app` debounces (1s) → PATCH to API.
- **Print mode**: `?print` query param renders all slides stacked with page breaks, no chrome. Used by Puppeteer for PDF export.
- **Fonts**: Deck-level `heading_font` and `body_font` (optional, any Google Font). Default: DM Sans. Applied via `--dp-font-heading` and `--dp-font-body` CSS custom properties.

## Related Repository

**`deckpipe-mcp`** (`/Users/bjornschefzyk/Projects/deckpipe-mcp`) — The MCP server package (`deckpipe-mcp` on npm). Six tools (`create_deck`, `get_deck`, `update_deck`, `delete_deck`, `upload_image`, `list_layouts`) that wrap the REST API. Separate repo with its own build and release cycle.

## Environment

Config in `.env` (see `.env.example`). Key vars: `DATABASE_URL`, `PORT`, `API_URL`, `VIEWER_URL`, `IMAGE_STORAGE_PATH`. The API config loads `.env` from the repo root via relative path resolution.

## Database

PostgreSQL. Two tables: `decks` (JSONB slides), `images` (metadata). Migrations in `packages/api/src/db/migrations/` — plain SQL files run by a simple tracker in `_migrations` table.
