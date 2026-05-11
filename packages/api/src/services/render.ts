/**
 * Headless slide renderer. Single source of truth for any place we need
 * to turn a slide into a PNG + a render report (screenshot endpoint,
 * preview endpoint, future PDF export).
 *
 * Reuses one Puppeteer browser across calls. Each render gets a fresh
 * page. The viewer URL passed in is expected to set
 * document.documentElement[data-ready=true] when the slide has settled
 * (see packages/viewer/src/viewer-app.ts).
 */

import puppeteer, { type Browser, type Page } from 'puppeteer';

export interface RenderReport {
  /** JS errors thrown during the slide's lifetime (uncaught exceptions, syntax errors in user js). */
  js_errors: Array<{ message: string; stack?: string }>;
  /** console.error / console.warn output. */
  console_errors: Array<{ level: 'error' | 'warn'; text: string }>;
  /** Elements where scrollWidth/scrollHeight exceed clientWidth/clientHeight. */
  overflows: Array<{ selector: string; overflow_x_px: number; overflow_y_px: number; text_preview: string }>;
  /** Fonts the page declared and successfully loaded. */
  fonts_loaded: string[];
  /** Fonts the page declared but didn't load. */
  fonts_missing: string[];
  /** Network requests that failed (image 404s, font 403s, etc.). */
  failed_requests: Array<{ url: string; reason: string }>;
}

export interface RenderResult {
  png: Buffer;
  report: RenderReport;
  duration_ms: number;
}

export interface RenderOptions {
  /** Viewer URL with whatever params signal "render this single slide as a screenshot". */
  url: string;
  /** Defaults to 1920×1080. */
  viewport?: { width: number; height: number };
  /** Defaults to png. */
  format?: 'png' | 'jpeg';
  /** Max ms to wait for the viewer to set data-ready. Defaults to 12000. */
  ready_timeout_ms?: number;
}

let browserPromise: Promise<Browser> | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    }).catch((err) => {
      browserPromise = null;
      throw err;
    });
  }
  return browserPromise;
}

async function closeBrowser(): Promise<void> {
  if (browserPromise) {
    const browser = await browserPromise.catch(() => null);
    browserPromise = null;
    if (browser) await browser.close().catch(() => {});
  }
}

// Graceful shutdown so we don't leave Chromium processes orphaned.
let shutdownRegistered = false;
function registerShutdown() {
  if (shutdownRegistered) return;
  shutdownRegistered = true;
  for (const sig of ['SIGINT', 'SIGTERM'] as const) {
    process.once(sig, () => { void closeBrowser(); });
  }
}

export async function renderSlide(opts: RenderOptions): Promise<RenderResult> {
  registerShutdown();
  const start = Date.now();
  const viewport = opts.viewport ?? { width: 1920, height: 1080 };
  const readyTimeout = opts.ready_timeout_ms ?? 12000;
  const format = opts.format ?? 'png';

  const browser = await getBrowser();
  const page: Page = await browser.newPage();
  await page.setViewport({ width: viewport.width, height: viewport.height, deviceScaleFactor: 1 });

  const report: RenderReport = {
    js_errors: [],
    console_errors: [],
    overflows: [],
    fonts_loaded: [],
    fonts_missing: [],
    failed_requests: [],
  };

  page.on('pageerror', (err: unknown) => {
    if (err instanceof Error) {
      report.js_errors.push({ message: err.message, stack: err.stack });
    } else {
      report.js_errors.push({ message: String(err) });
    }
  });
  page.on('console', (msg) => {
    const type = msg.type();
    if (type === 'error' || type === 'warn') {
      report.console_errors.push({ level: type as 'error' | 'warn', text: msg.text() });
    }
  });
  page.on('requestfailed', (req) => {
    report.failed_requests.push({ url: req.url(), reason: req.failure()?.errorText ?? 'unknown' });
  });

  try {
    await page.goto(opts.url, { waitUntil: 'domcontentloaded', timeout: readyTimeout });
    await page.waitForFunction(
      () => document.documentElement.getAttribute('data-ready') === 'true',
      { timeout: readyTimeout },
    ).catch(() => {
      // Soft-fail — proceed to screenshot even if the page didn't signal ready.
      report.console_errors.push({
        level: 'warn',
        text: `Viewer did not signal data-ready within ${readyTimeout}ms — screenshot may be partial.`,
      });
    });

    // Both page.evaluate callbacks below are passed as strings so the
    // TypeScript transpiler (tsx/esbuild) doesn't inject helpers like
    // __name that don't exist in the browser context.

    // Collect font load status (best-effort).
    const fontInfo = await page.evaluate(`(() => {
      const loaded = [];
      const missing = [];
      try {
        for (const f of document.fonts) {
          const label = (f.family + ' ' + f.weight + ' ' + f.style).trim();
          (f.status === 'loaded' ? loaded : missing).push(label);
        }
      } catch (e) { /* ignore */ }
      return { loaded: loaded, missing: missing };
    })()`) as { loaded: string[]; missing: string[] };
    report.fonts_loaded = fontInfo.loaded;
    report.fonts_missing = fontInfo.missing;

    // Collect overflow info, walking shadow roots since the slide lives inside Lit.
    const overflows = await page.evaluate(`(() => {
      const out = [];
      function visit(root) {
        const all = root.querySelectorAll('*');
        for (let i = 0; i < all.length; i++) {
          const el = all[i];
          if (!(el instanceof HTMLElement)) continue;
          const overflowX = el.scrollWidth - el.clientWidth;
          const overflowY = el.scrollHeight - el.clientHeight;
          if ((overflowX > 1 || overflowY > 1) && (el.clientWidth > 0 || el.clientHeight > 0)) {
            if (el.tagName === 'HTML' || el.tagName === 'BODY') continue;
            const path = [];
            let node = el;
            for (let j = 0; j < 4 && node; j++) {
              const tag = node.tagName.toLowerCase();
              const id = node.id ? '#' + node.id : '';
              const cls = node.classList[0] ? '.' + node.classList[0] : '';
              path.unshift(tag + id + cls);
              node = node.parentElement;
            }
            const txt = (el.textContent || '').trim().slice(0, 60);
            out.push({
              selector: path.join(' > '),
              overflow_x_px: Math.max(0, overflowX),
              overflow_y_px: Math.max(0, overflowY),
              text_preview: txt,
            });
          }
          if (el.shadowRoot) visit(el.shadowRoot);
        }
      }
      visit(document);
      const seenSel = new Set();
      return out.filter(function (o) {
        if (seenSel.has(o.selector)) return false;
        seenSel.add(o.selector);
        return true;
      }).slice(0, 20);
    })()`) as Array<{ selector: string; overflow_x_px: number; overflow_y_px: number; text_preview: string }>;
    report.overflows = overflows;

    // Screenshot just the viewport — viewer renders the slide flush at (0,0)
    // in screenshot mode, so a full-viewport capture is exactly the slide.
    const png = await page.screenshot({ type: format, fullPage: false });

    return { png: png as Buffer, report, duration_ms: Date.now() - start };
  } finally {
    await page.close().catch(() => {});
  }
}

export { closeBrowser };
