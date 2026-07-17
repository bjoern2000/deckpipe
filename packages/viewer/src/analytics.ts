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

    posthog.init(key, {
      api_host: host,
      ui_host: 'https://eu.posthog.com',
      defaults: '2026-05-30',
      capture_pageview: true,
      capture_pageleave: true,
      autocapture: true,
      persistence: 'localStorage+cookie',
      person_profiles: 'identified_only',
    });

    const isDev =
      window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    posthog.register({
      product: 'deckpipe',
      surface: 'app',
      environment: isDev ? 'dev' : 'production',
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
