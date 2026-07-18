/**
 * PostHog analytics for the deckpipe viewer app (surface: 'app').
 *
 * All capture goes through track() — no raw posthog.capture() calls anywhere
 * else. track() is a no-op if init failed or was skipped, and never throws.
 */
import posthog from 'posthog-js';

const DEFAULT_KEY = 'phc_uUq5DaCoF5SpGeXo353jR3uMenhy75QFgv6NUpzCzTPg';
const DEFAULT_HOST = 'https://eu.i.posthog.com';

let initialized = false;

export function initAnalytics() {
  if (initialized) return;

  // Headless renders (Puppeteer screenshot/print/preview pipelines) are
  // server-driven, not real users — don't count them as traffic.
  const params = new URLSearchParams(window.location.search);
  if (params.has('screenshot') || params.has('print')) return;

  try {
    const key = import.meta.env.VITE_POSTHOG_KEY ?? DEFAULT_KEY;
    const host = import.meta.env.VITE_POSTHOG_HOST ?? DEFAULT_HOST;

    const isDev =
      window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    // The landing page embeds live decks in iframes; label (don't drop)
    // embedded-viewer traffic so it's filterable from real app usage.
    const embedded = window.self !== window.top;
    let embedReferrerHost = '';
    if (embedded) {
      try {
        embedReferrerHost = document.referrer ? new URL(document.referrer).hostname : '';
      } catch {
        embedReferrerHost = '';
      }
    }

    posthog.init(key, {
      api_host: host,
      ui_host: 'https://eu.posthog.com',
      defaults: '2026-05-30',
      capture_pageview: true,
      capture_pageleave: true,
      autocapture: true,
      persistence: 'localStorage+cookie',
      person_profiles: 'identified_only',
      // Stamp product/surface/environment per-event instead of register():
      // localStorage is shared across surfaces on deckpipe.dev, so persisted
      // super props from the marketing snippet would otherwise leak into (or
      // be clobbered by) app events. before_send always wins over persisted
      // state.
      before_send: (event) => {
        if (!event) return null;
        event.properties = {
          ...event.properties,
          product: 'deckpipe',
          surface: 'app',
          environment: isDev ? 'dev' : 'production',
          embedded,
          ...(embedded ? { embed_referrer_host: embedReferrerHost } : {}),
        };
        return event;
      },
    });

    initialized = true;
  } catch {
    // Analytics must never break the viewer.
  }
}

export function track(event: string, props?: Record<string, unknown>) {
  if (!initialized) return;
  try {
    posthog.capture(event, props);
  } catch {
    // no-op
  }
}
