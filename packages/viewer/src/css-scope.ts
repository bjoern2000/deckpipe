/**
 * Shadow-DOM CSS scoping helpers.
 *
 * Kept dependency-free (no Lit, no DOM) so it can be unit-tested directly.
 */

/**
 * Rewrite `:root` selectors to `:host` so deck/slide CSS works inside the
 * shadow root. A stylesheet adopted into a shadow root has its selectors
 * matched against the shadow tree only — and `:root` matches the *document*
 * root element (<html>), which is never part of a shadow tree. So tokens
 * declared as `:root { --accent: … }` silently apply to nothing, and any
 * `var(--accent)` reference (background, color, anything) falls back to its
 * initial value. `:host` is the shadow-DOM equivalent and inherits into the
 * tree.
 *
 * Agents naturally reach for `:root { --token: … }` (it's the light-DOM
 * idiom), so we translate it rather than make them learn the quirk. The `\b`
 * keeps `.root`, `:root-ish`, etc. from matching the selector token.
 */
export function scopeRootToHost(cssText: string): string {
  return cssText.replace(/:root\b/g, ':host');
}

/**
 * Serialize a flat token map into a `:host { … }` rule so deck-level design
 * tokens cascade into the shadow tree. Keys may be given with or without the
 * leading `--`. Values are emitted verbatim; the caller owns trust.
 * Returns '' for an empty/absent map so callers can skip adopting a sheet.
 */
export function tokensToCss(tokens: Record<string, string> | null | undefined): string {
  if (!tokens) return '';
  const decls = Object.entries(tokens)
    .filter(([k, v]) => k && v != null)
    .map(([k, v]) => {
      const name = k.startsWith('--') ? k : `--${k}`;
      return `  ${name}: ${v};`;
    });
  if (decls.length === 0) return '';
  return `:host {\n${decls.join('\n')}\n}`;
}
