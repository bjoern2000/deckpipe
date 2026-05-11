import { LitElement, html, css, type CSSResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';

const stringSheetCache = new Map<string, CSSStyleSheet>();

function sheetFor(cssText: string | undefined): CSSStyleSheet | null {
  if (!cssText) return null;
  let sheet = stringSheetCache.get(cssText);
  if (!sheet) {
    sheet = new CSSStyleSheet();
    try {
      sheet.replaceSync(cssText);
    } catch (err) {
      console.warn('[deckpipe] canvas: failed to parse CSS', err);
      return null;
    }
    stringSheetCache.set(cssText, sheet);
  }
  return sheet;
}

@customElement('slide-canvas')
export class SlideCanvas extends LitElement {
  static styles = css`
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }
    .canvas-root {
      position: relative;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: var(--dp-bg, #ffffff);
      color: var(--dp-text-body, #334155);
      font-family: var(--dp-font-body, 'DM Sans', sans-serif);
    }
  `;

  @property() html = '';
  @property() css = '';
  @property() js = '';
  @property({ type: Boolean, attribute: 'static-render-only' }) staticRenderOnly = false;
  @property({ attribute: 'deck-stylesheet' }) deckStylesheet = '';

  private mountedHtml = '';
  private mountedCss = '';
  private mountedJs = '';
  private mountedDeckStylesheet = '';
  private jsCleanup: (() => void) | null = null;

  private isPrintMode(): boolean {
    return new URLSearchParams(window.location.search).has('print');
  }

  protected updated() {
    const root = this.shadowRoot;
    if (!root) return;

    if (this.deckStylesheet !== this.mountedDeckStylesheet || this.css !== this.mountedCss) {
      this.mountedDeckStylesheet = this.deckStylesheet;
      this.mountedCss = this.css;
      this.applyAdoptedSheets(root);
    }

    if (this.html !== this.mountedHtml) {
      this.teardownJs();
      this.mountedHtml = this.html;
      this.mountUserHtml(root);
      this.runUserJs(root);
      this.mountedJs = this.js;
      return;
    }

    if (this.js !== this.mountedJs) {
      this.teardownJs();
      this.mountedJs = this.js;
      this.runUserJs(root);
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.teardownJs();
  }

  private applyAdoptedSheets(root: ShadowRoot) {
    const baseSheets: CSSStyleSheet[] = [];
    const styles = (this.constructor as typeof LitElement).elementStyles;
    for (const s of styles || []) {
      const sheet = (s as CSSResult).styleSheet;
      if (sheet) baseSheets.push(sheet);
    }
    const extras: CSSStyleSheet[] = [];
    const deckSheet = sheetFor(this.deckStylesheet);
    if (deckSheet) extras.push(deckSheet);
    const slideSheet = sheetFor(this.css);
    if (slideSheet) extras.push(slideSheet);
    root.adoptedStyleSheets = [...baseSheets, ...extras];
  }

  private mountUserHtml(root: ShadowRoot) {
    const container = root.querySelector('.canvas-root') as HTMLElement | null;
    if (!container) return;
    container.setAttribute('data-content-path', 'slide');
    container.innerHTML = this.html;

    // Translate data-dp-anchor → data-content-path="anchor:<name>" so the
    // existing comment-layer walker picks up commentable elements.
    const anchored = container.querySelectorAll<HTMLElement>('[data-dp-anchor]');
    anchored.forEach((el) => {
      const name = el.getAttribute('data-dp-anchor');
      if (name && !el.hasAttribute('data-content-path')) {
        el.setAttribute('data-content-path', `anchor:${name}`);
      }
    });
  }

  private runUserJs(root: ShadowRoot) {
    if (!this.js) return;
    if (this.staticRenderOnly && this.isPrintMode()) return;

    const container = root.querySelector('.canvas-root') as HTMLElement | null;
    if (!container) return;

    try {
      const fn = new Function(
        'root', 'slide',
        `"use strict";\nconst __r = (function(){ ${this.js}\n })();\nreturn __r;`
      ) as (root: ShadowRoot, slide: HTMLElement) => unknown;
      const result = fn(root, container);
      if (typeof result === 'function') {
        this.jsCleanup = result as () => void;
      }
    } catch (err) {
      console.warn('[deckpipe] canvas: user js threw', err);
    }
  }

  private teardownJs() {
    if (this.jsCleanup) {
      try { this.jsCleanup(); } catch (err) { console.warn('[deckpipe] canvas: cleanup threw', err); }
      this.jsCleanup = null;
    }
  }

  render() {
    return html`<div class="canvas-root" data-content-path="slide"></div>`;
  }
}
