import { LitElement, css, html, nothing } from 'lit';
import { mdInline } from '../utils/markdown.js';

export class SlideBase extends LitElement {
  static baseStyles = css`
    :host {
      display: block;
      width: 100%;
      height: 100%;
      overflow: hidden;
    }

    .slide {
      box-sizing: border-box;
      width: 100%;
      height: 100%;
      padding: 48px 56px;
      display: flex;
      flex-direction: column;
      background: var(--dp-bg, #ffffff);
      font-family: var(--dp-font-body, 'DM Sans', sans-serif);
      font-weight: 400;
      color: var(--dp-text-body, #334155);
      position: relative;
      overflow: hidden;
    }

    h1 {
      font-family: var(--dp-font-heading, 'DM Sans', sans-serif);
      font-weight: 700;
      color: var(--dp-text-title, #0f172a);
      margin: 0 0 32px 0;
      font-size: 2.2em;
      line-height: 1.2;
    }

    h2 {
      font-family: var(--dp-font-heading, 'DM Sans', sans-serif);
      font-weight: 700;
      color: var(--dp-text-title, #0f172a);
      margin: 0 0 12px 0;
      font-size: 1.4em;
      line-height: 1.3;
    }

    p, li, td {
      font-size: 1.05em;
      line-height: 1.6;
    }

    ul { list-style-type: square; }

    th {
      background: #1e1b4b;
      color: #ffffff;
    }

    tr:nth-child(even) td {
      background: var(--dp-table-stripe-bg, #f5f3ff);
    }

    img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
      border-radius: 4px;
    }

    .key-takeaway {
      background: #f1f5f9;
      color: #475569;
      font-size: 0.95em;
      font-weight: 600;
      line-height: 1.5;
      padding: 10px 16px;
      border-radius: 8px;
      margin: 0 0 32px 0;
      font-family: var(--dp-font-body, 'DM Sans', sans-serif);
    }

    .key-takeaway a { color: var(--dp-accent, #7c3aed); text-decoration: underline; }
    .key-takeaway code { background: rgba(0,0,0,0.06); padding: 1px 4px; border-radius: 3px; font-size: 0.9em; }

    [contenteditable="true"] {
      outline: none;
      cursor: text;
      border-radius: 2px;
      transition: box-shadow 0.15s ease;
    }

    [contenteditable="true"]:hover {
      box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.12) dashed;
    }

    [contenteditable="true"]:focus {
      box-shadow: 0 0 0 2px var(--dp-accent, #7c3aed);
    }

    .field-wrap {
      position: relative;
    }

    .field-wrap .delete-btn {
      display: none;
      position: absolute;
      top: -6px;
      right: -6px;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: #ef4444;
      color: #fff;
      border: 2px solid #fff;
      font-size: 11px;
      line-height: 1;
      cursor: pointer;
      align-items: center;
      justify-content: center;
      z-index: 10;
      padding: 0;
      box-shadow: 0 1px 3px rgba(0,0,0,0.2);
    }

    .field-wrap:hover .delete-btn {
      display: flex;
    }

    .img-error {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 6px;
      background: #f1f5f9;
      width: 100%;
      height: 100%;
      min-height: 60px;
      border-radius: 4px;
    }
    .img-error .img-error-label {
      font-size: 0.5em;
      color: #94a3b8;
      font-weight: 500;
    }
    .img-error .img-error-url {
      font-size: 7px;
      color: #b0b8c4;
      max-width: 80%;
      text-align: center;
      word-break: break-all;
      line-height: 1.3;
    }
  `;

  private _fitPending = false;

  protected updated(_changedProperties: Map<string, unknown>) {
    super.updated(_changedProperties);
    if (this._fitPending) return;
    this._fitPending = true;
    requestAnimationFrame(() => {
      this.fitContent();
      this._fitPending = false;
    });
  }

  private fitContent() {
    const slideEl = this.shadowRoot?.querySelector('.slide') as HTMLElement;
    if (!slideEl) return;

    // Reset to base size
    slideEl.style.fontSize = '';

    if (slideEl.scrollHeight <= slideEl.clientHeight) return;

    // Binary search for the right font scale
    let lo = 0.55;
    let hi = 1.0;
    while (hi - lo > 0.02) {
      const mid = (lo + hi) / 2;
      slideEl.style.fontSize = `${mid}em`;
      if (slideEl.scrollHeight > slideEl.clientHeight) {
        hi = mid;
      } else {
        lo = mid;
      }
    }
    slideEl.style.fontSize = `${lo}em`;
  }

  protected renderKeyTakeaway(keyTakeaway: string | undefined, editable = false) {
    if (!keyTakeaway && !editable) return nothing;
    if (!keyTakeaway) return nothing;
    if (editable) {
      return this.wrapDeletable('key_takeaway', html`
        <div class="key-takeaway"
          contenteditable="true"
          @blur=${(e: FocusEvent) => this.emitChange('key_takeaway', (e.target as HTMLElement).textContent)}
        >${keyTakeaway}</div>
      `);
    }
    return html`<div class="key-takeaway">${mdInline(keyTakeaway)}</div>`;
  }

  protected wrapDeletable(field: string, content: unknown, emptyValue: unknown = '') {
    return html`
      <div class="field-wrap">
        ${content}
        <button class="delete-btn" @click=${(e: Event) => { e.stopPropagation(); this.emitChange(field, emptyValue); }}>×</button>
      </div>
    `;
  }

  protected onImgError(e: Event) {
    const img = e.target as HTMLImageElement;
    const src = img.src || 'unknown';
    const placeholder = document.createElement('div');
    placeholder.className = 'img-error';

    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('width', '24');
    svg.setAttribute('height', '24');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', '#94a3b8');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    const elements: [string, Record<string, string>][] = [
      ['line', { x1: '2', x2: '22', y1: '2', y2: '22' }],
      ['path', { d: 'M10.41 10.41a2 2 0 1 1-2.83-2.83' }],
      ['line', { x1: '13.5', x2: '6', y1: '13.5', y2: '21' }],
      ['line', { x1: '18', x2: '21', y1: '12', y2: '15' }],
      ['path', { d: 'M3.59 3.59A1.99 1.99 0 0 0 3 5v14a2 2 0 0 0 2 2h14c.55 0 1.052-.22 1.41-.59' }],
      ['path', { d: 'M21 15V5a2 2 0 0 0-2-2H9' }],
    ];
    for (const [tag, attrs] of elements) {
      const el = document.createElementNS(svgNS, tag);
      for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
      svg.appendChild(el);
    }

    const label = document.createElement('span');
    label.className = 'img-error-label';
    label.textContent = 'Failed to load image';

    const url = document.createElement('span');
    url.className = 'img-error-url';
    url.textContent = src;

    placeholder.appendChild(svg);
    placeholder.appendChild(label);
    placeholder.appendChild(url);
    img.replaceWith(placeholder);
  }

  protected emitChange(field: string, value: unknown) {
    this.dispatchEvent(new CustomEvent('slide-content-changed', {
      detail: { field, value },
      bubbles: true,
      composed: true,
    }));
  }
}
