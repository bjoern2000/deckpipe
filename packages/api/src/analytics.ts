/**
 * PostHog server-side analytics (product: deckpipe, surface: 'api').
 *
 * All capture goes through track() — fire-and-forget, never throws, never
 * blocks a request. Events flow through here for both REST callers and the
 * remote MCP transport (MCP tools call the same REST handlers over HTTP).
 *
 * Disabled when POSTHOG_DISABLED=1 or NODE_ENV=test.
 */
import { PostHog } from 'posthog-node';
import type { Request } from 'express';
import { config } from './config.js';

let client: PostHog | null = null;

if (process.env.POSTHOG_DISABLED !== '1' && process.env.NODE_ENV !== 'test') {
  try {
    client = new PostHog(config.posthogKey, { host: config.posthogHost });
  } catch {
    client = null;
  }
}

const baseProps = {
  product: 'deckpipe',
  surface: 'api',
  environment: process.env.NODE_ENV === 'production' ? 'production' : 'dev',
};

/**
 * How a request reached the REST API. MCP tools (remote /mcp transport and
 * the standalone deckpipe-mcp package) call the REST API through mcp-core's
 * apiFetch, which tags requests with `x-deckpipe-via: mcp`. Everything else
 * is a plain REST caller.
 */
export function viaOf(req: Request): 'rest' | 'mcp' {
  return req.headers['x-deckpipe-via'] === 'mcp' ? 'mcp' : 'rest';
}

/**
 * Capture a server-side event. Safe no-op when PostHog is disabled.
 * Only pass ids, counts, and enum-ish metadata — never content payloads.
 */
export function track(distinctId: string, event: string, props?: Record<string, unknown>) {
  if (!client) return;
  try {
    client.capture({
      distinctId,
      event,
      properties: { ...baseProps, ...props },
    });
  } catch {
    // Analytics must never fail a request.
  }
}

/** Flush pending events. Called from the graceful-shutdown path. */
export async function shutdownAnalytics() {
  if (!client) return;
  try {
    await client.shutdown();
  } catch {
    // ignore
  }
}

// Mirror the SIGINT/SIGTERM style used by services/render.ts for the browser.
for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.once(sig, () => {
    void shutdownAnalytics();
  });
}
