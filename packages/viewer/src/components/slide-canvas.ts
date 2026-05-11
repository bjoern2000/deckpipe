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
    .canvas-root [contenteditable="true"] {
      outline: none;
      border-radius: 2px;
    }
    .canvas-root [contenteditable="true"]:hover {
      box-shadow: 0 0 0 1px rgba(124, 58, 237, 0.25);
    }
    .canvas-root [contenteditable="true"]:focus {
      box-shadow: 0 0 0 2px var(--dp-accent, #7c3aed);
    }
  `;

  @property() html = '';
  @property() css = '';
  @property() js = '';
  @property({ type: Boolean, attribute: 'static-render-only' }) staticRenderOnly = false;
  @property({ type: Boolean, attribute: 'disable-js' }) disableJs = false;
  @property({ type: Boolean }) editable = false;
  @property({ attribute: 'deck-stylesheet' }) deckStylesheet = '';

  private mountedHtml = '';
  private mountedCss = '';
  private mountedJs = '';
  private mountedDeckStylesheet = '';
  private mountedEditable = false;
  private jsCleanup: (() => void) | null = null;
  private blurHandler: ((e: FocusEvent) => void) | null = null;

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
      this.applyEditable(root);
      this.mountedEditable = this.editable;
      return;
    }

    if (this.editable !== this.mountedEditable) {
      this.mountedEditable = this.editable;
      this.applyEditable(root);
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
    this.detachBlurListener();
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

    // Translate data-dp-anchor → data-content-path="anchor:<name>" first so
    // explicit anchors keep their stable name across edits.
    const anchored = container.querySelectorAll<HTMLElement>('[data-dp-anchor]');
    anchored.forEach((el) => {
      const name = el.getAttribute('data-dp-anchor');
      if (name && !el.hasAttribute('data-content-path')) {
        el.setAttribute('data-content-path', `anchor:${name}`);
      }
    });

    // Assign auto:<index> to every remaining element so any DOM node is
    // commentable. Depth-first order — stable within a render, intentionally
    // fragile across structural edits (agents use data-dp-anchor for stability).
    let i = 0;
    const walker = container.ownerDocument.createTreeWalker(container, NodeFilter.SHOW_ELEMENT);
    let el = walker.nextNode() as HTMLElement | null;
    while (el) {
      if (!el.hasAttribute('data-content-path')) {
        el.setAttribute('data-content-path', `auto:${i}`);
      }
      i++;
      el = walker.nextNode() as HTMLElement | null;
    }
  }

  private applyEditable(root: ShadowRoot) {
    const container = root.querySelector('.canvas-root') as HTMLElement | null;
    if (!container) return;

    // Remove existing markers first so toggling off cleans up.
    container.querySelectorAll<HTMLElement>('[contenteditable="true"]').forEach(el => {
      el.removeAttribute('contenteditable');
    });
    this.detachBlurListener();

    if (!this.editable) return;

    // Mark text-bearing leaves as editable. A "leaf" here is an element with
    // no element children (only text) — covers h1/h2/p/span/etc. Compound
    // blocks like <p>Hello <strong>world</strong></p> won't be auto-editable
    // in v1; we can extend later if needed.
    container.querySelectorAll<HTMLElement>('*').forEach(el => {
      if (el.children.length > 0) return;
      const text = el.textContent || '';
      if (!text.trim()) return;
      el.setAttribute('contenteditable', 'true');
    });

    this.blurHandler = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target?.getAttribute?.('contenteditable') !== 'true') return;
      this.emitHtmlChange();
    };
    container.addEventListener('focusout', this.blurHandler as EventListener);
  }

  private detachBlurListener() {
    if (!this.blurHandler) return;
    const root = this.shadowRoot;
    const container = root?.querySelector('.canvas-root') as HTMLElement | null;
    container?.removeEventListener('focusout', this.blurHandler as EventListener);
    this.blurHandler = null;
  }

  private emitHtmlChange() {
    const root = this.shadowRoot;
    if (!root) return;
    const container = root.querySelector('.canvas-root') as HTMLElement | null;
    if (!container) return;

    // Clone, then strip programmatic attributes so the saved html stays clean.
    const clone = container.cloneNode(true) as HTMLElement;
    clone.querySelectorAll<HTMLElement>('[data-content-path]').forEach(el => {
      el.removeAttribute('data-content-path');
    });
    clone.querySelectorAll<HTMLElement>('[contenteditable]').forEach(el => {
      el.removeAttribute('contenteditable');
    });
    const cleaned = clone.innerHTML;

    // Update our mounted snapshot so the next render's diff check doesn't
    // remount and reset the cursor.
    this.mountedHtml = cleaned;

    this.dispatchEvent(new CustomEvent('slide-content-changed', {
      detail: { field: 'html', value: cleaned },
      bubbles: true,
      composed: true,
    }));
  }

  private runUserJs(root: ShadowRoot) {
    if (!this.js) return;
    if (this.disableJs) return;
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
