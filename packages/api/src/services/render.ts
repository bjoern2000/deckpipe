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
  /**
   * Elements that are visually broken. Two reasons:
   * - "off_canvas": the element's bounding rect extends past the 1920×1080 slide frame (cut off by the slide edge).
   * - "clipped": the element has overflow: hidden|scroll|auto and its scrollWidth/Height exceeds clientWidth/Height.
   * Benign overflow (italic descender bleed, negative letter-spacing on serif headings, etc.)
   * on elements with overflow: visible is NOT reported — those don't actually clip anything.
   */
  overflows: Array<{ selector: string; reason: 'off_canvas' | 'clipped'; overflow_x_px: number; overflow_y_px: number; text_preview: string }>;
  /**
   * Fonts the slide ACTUALLY paints text with and that resolved successfully,
   * as "Family weight[ style]" labels (e.g. "Poppins 700", "Space Mono 400 italic").
   * Only the first non-generic family of each text-bearing element is considered —
   * unused @font-face permutations and viewer theme fonts are excluded.
   */
  fonts_loaded: string[];
  /** Same labels, but for faces that are referenced yet did NOT load (typo'd name, missing head <link>, 404). */
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

    // Collect font load status — only for faces the slide ACTUALLY uses.
    //
    // The naive approach (enumerate document.fonts) reports every @font-face a
    // Google Fonts <link> declares — dozens of weight/charset permutations the
    // slide never references, all "unloaded" because they're never painted —
    // plus the viewer's own theme fonts. That noise made the whole report
    // untrustworthy. Instead: walk every text-bearing element (descending
    // shadow roots), take the first NON-generic family it renders with, and
    // classify it via document.fonts.check() — i.e. did the face actually load.
    const fontInfo = await page.evaluate(`(() => {
      const GENERIC = new Set([
        'serif','sans-serif','monospace','system-ui','ui-serif','ui-sans-serif',
        'ui-monospace','ui-rounded','cursive','fantasy','math','emoji','fangsong','inherit','initial','unset',
      ]);
      const firstFamily = (list) => {
        const first = (list || '').split(',')[0].trim().replace(/^["']|["']$/g, '');
        return first;
      };
      const used = new Map(); // label -> { family, spec }
      const visit = (root) => {
        const all = root.querySelectorAll('*');
        for (let i = 0; i < all.length; i++) {
          const el = all[i];
          if (el.shadowRoot) visit(el.shadowRoot);
          // Only elements that directly paint non-whitespace text.
          let hasText = false;
          for (let n = el.firstChild; n; n = n.nextSibling) {
            if (n.nodeType === 3 && n.textContent && n.textContent.trim()) { hasText = true; break; }
          }
          if (!hasText) continue;
          if (el.getClientRects().length === 0) continue; // not rendered
          const cs = getComputedStyle(el);
          const family = firstFamily(cs.fontFamily);
          if (!family || GENERIC.has(family.toLowerCase())) continue;
          const weight = cs.fontWeight;
          const style = cs.fontStyle && cs.fontStyle !== 'normal' ? ' ' + cs.fontStyle : '';
          const label = family + ' ' + weight + style;
          const spec = (cs.fontStyle && cs.fontStyle !== 'normal' ? cs.fontStyle + ' ' : '') + weight + ' 1em "' + family + '"';
          if (!used.has(label)) used.set(label, { family: family, spec: spec });
        }
      };
      visit(document);
      const loaded = [];
      const missing = [];
      used.forEach((info, label) => {
        let ok = false;
        try { ok = document.fonts.check(info.spec); } catch (e) { ok = false; }
        (ok ? loaded : missing).push(label);
      });
      loaded.sort();
      missing.sort();
      return { loaded: loaded, missing: missing };
    })()`) as { loaded: string[]; missing: string[] };
    report.fonts_loaded = fontInfo.loaded;
    report.fonts_missing = fontInfo.missing;

    // Collect overflow info, walking shadow roots since the slide lives inside Lit.
    //
    // Two real failure modes, both visually obvious in the screenshot:
    //   "off_canvas" — element's painted box extends past the 1920×1080 slide frame.
    //   "clipped"    — element clips its own content (overflow: hidden|scroll|auto)
    //                  and scrollWidth/Height exceeds clientWidth/Height.
    //
    // We deliberately do NOT report scrollWidth/Height overflow on elements with
    // overflow: visible. Italic glyph bleed, descenders, and negative letter-spacing
    // on serif headings all produce a few pixels of "overflow" the browser doesn't
    // clip — flagging those wastes agent iterations chasing phantoms.
    const NOISE_PX = 2;
    const overflows = await page.evaluate(`(() => {
      const NOISE_PX = ${NOISE_PX};
      const SLIDE_W = 1920;
      const SLIDE_H = 1080;
      const out = [];
      function visit(root) {
        const all = root.querySelectorAll('*');
        for (let i = 0; i < all.length; i++) {
          const el = all[i];
          if (!(el instanceof HTMLElement)) continue;
          if (el.tagName === 'HTML' || el.tagName === 'BODY') {
            if (el.shadowRoot) visit(el.shadowRoot);
            continue;
          }
          if (el.clientWidth === 0 && el.clientHeight === 0) {
            if (el.shadowRoot) visit(el.shadowRoot);
            continue;
          }
          const cs = getComputedStyle(el);
          const ovX = cs.overflowX;
          const ovY = cs.overflowY;
          const clipsX = ovX === 'hidden' || ovX === 'scroll' || ovX === 'auto';
          const clipsY = ovY === 'hidden' || ovY === 'scroll' || ovY === 'auto';

          const overflowX = el.scrollWidth - el.clientWidth;
          const overflowY = el.scrollHeight - el.clientHeight;
          const clipped =
            (clipsX && overflowX > NOISE_PX) ||
            (clipsY && overflowY > NOISE_PX);

          const rect = el.getBoundingClientRect();
          const offCanvas =
            rect.left < -NOISE_PX ||
            rect.top < -NOISE_PX ||
            rect.right > SLIDE_W + NOISE_PX ||
            rect.bottom > SLIDE_H + NOISE_PX;

          if (clipped || offCanvas) {
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
            // For off_canvas elements, report how far the bounding rect extends
            // past the slide frame on each axis. For clipped elements, report
            // the scrollWidth/Height overshoot — content that doesn't fit the box.
            const offX = offCanvas
              ? Math.max(0, Math.max(0 - rect.left, rect.right - SLIDE_W))
              : Math.max(0, overflowX);
            const offY = offCanvas
              ? Math.max(0, Math.max(0 - rect.top, rect.bottom - SLIDE_H))
              : Math.max(0, overflowY);
            out.push({
              selector: path.join(' > '),
              reason: clipped ? 'clipped' : 'off_canvas',
              overflow_x_px: Math.round(offX),
              overflow_y_px: Math.round(offY),
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
    })()`) as Array<{ selector: string; reason: 'off_canvas' | 'clipped'; overflow_x_px: number; overflow_y_px: number; text_preview: string }>;
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
