/**
 * Deck-level design tokens — a flat custom-property map ({ "--name": "value" })
 * injected into every canvas slide's shadow root as `:host { … }`.
 */

/** Stored with a leading `--` so create/patch keys collide consistently. */
export function normalizeTokenKey(k: string): string {
  return k.startsWith('--') ? k : `--${k}`;
}

/**
 * Merge a token patch into existing deck tokens.
 * - patch === null      → clear all tokens (returns null)
 * - patch === undefined → leave tokens unchanged
 * - otherwise: a string value sets/overwrites a key, a null value deletes it
 *
 * Keys are normalized to a leading `--`. Returns null when the result is empty
 * so the DB column stays clean (NULL rather than `{}`).
 */
export function mergeTokens(
  existing: Record<string, string> | null,
  patch: Record<string, string | null> | null | undefined,
): Record<string, string> | null {
  if (patch === null) return null;
  if (patch === undefined) return existing ?? null;
  const out: Record<string, string> = {};
  if (existing) {
    for (const [k, v] of Object.entries(existing)) out[normalizeTokenKey(k)] = v;
  }
  for (const [k, v] of Object.entries(patch)) {
    const nk = normalizeTokenKey(k);
    if (v === null) delete out[nk];
    else out[nk] = v;
  }
  return Object.keys(out).length > 0 ? out : null;
}
