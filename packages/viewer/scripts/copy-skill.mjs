#!/usr/bin/env node
// Copies the canonical deckpipe-design skill (lives at the repo root for
// Claude Code auto-load) into the viewer's public dir, so the published
// site exposes it at /skill.md for anyone to read or paste into their agent.
// Run via prebuild + predev so it stays in sync.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const src = path.resolve(__dirname, '../../../.claude/skills/deckpipe-design/SKILL.md');
const dst = path.resolve(__dirname, '../public/skill.md');

if (!fs.existsSync(src)) {
  console.warn(`[copy-skill] source missing: ${src} — skipping`);
  process.exit(0);
}

fs.mkdirSync(path.dirname(dst), { recursive: true });
fs.copyFileSync(src, dst);
console.log(`[copy-skill] ${path.relative(process.cwd(), src)} -> ${path.relative(process.cwd(), dst)}`);
