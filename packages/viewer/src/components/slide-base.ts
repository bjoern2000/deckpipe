import { LitElement, css, html, nothing } from 'lit';

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
    return html`<div class="key-takeaway">${keyTakeaway}</div>`;
  }

  protected wrapDeletable(field: string, content: unknown, emptyValue: unknown = '') {
    return html`
      <div class="field-wrap">
        ${content}
        <button class="delete-btn" @click=${(e: Event) => { e.stopPropagation(); this.emitChange(field, emptyValue); }}>×</button>
      </div>
    `;
  }

  protected emitChange(field: string, value: unknown) {
    this.dispatchEvent(new CustomEvent('slide-content-changed', {
      detail: { field, value },
      bubbles: true,
      composed: true,
    }));
  }
}
