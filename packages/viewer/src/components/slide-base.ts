import { LitElement, css, html, nothing, TemplateResult } from 'lit';
import { mdInline } from '../utils/markdown.js';

export type BulletItem = string | { text: string; detail?: string; sources?: Array<{ label: string; url?: string }> };

export function normalizeBullet(b: BulletItem): { text: string; detail?: string; sources?: Array<{ label: string; url?: string }> } {
  if (typeof b === 'string') return { text: b };
  return b;
}

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
      overflow: visible;
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

    /* --- Image prompt placeholder --- */
    .image-prompt-placeholder {
      display: inline-flex;
      flex-direction: row;
      align-items: center;
      gap: 6px;
      background: #f1f5f9;
      border: 1px dashed #cbd5e1;
      border-radius: 6px;
      padding: 5px 10px;
      width: fit-content;
      max-width: 100%;
      box-sizing: border-box;
    }
    .image-prompt-icon {
      color: #94a3b8;
      flex-shrink: 0;
      width: 14px;
      height: 14px;
    }
    .image-prompt-text {
      font-size: 0.42em;
      color: #94a3b8;
      line-height: 1.3;
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 220px;
    }
    .image-prompt-hint {
      display: none;
    }

    /* --- Rich bullet: detail tooltip --- */
    .bullet-content {
      display: inline;
    }
    .bullet-detail-trigger {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: #e2e8f0;
      color: #64748b;
      font-size: 0.5em;
      font-weight: 700;
      font-style: normal;
      cursor: default;
      margin-left: 5px;
      vertical-align: 3px;
      position: relative;
      line-height: 1;
    }
    .bullet-detail-trigger:hover .bullet-tooltip,
    .bullet-detail-trigger:focus-within .bullet-tooltip {
      display: block;
    }
    /* Default: tooltip above */
    .bullet-tooltip {
      display: none;
      position: absolute;
      left: 50%;
      bottom: calc(100% + 8px);
      transform: translateX(-50%);
      background: #1e293b;
      color: #f1f5f9;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 1.6em;
      font-weight: 400;
      line-height: 1.4;
      max-width: 280px;
      width: max-content;
      z-index: 100;
      pointer-events: none;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      text-align: left;
    }
    .bullet-tooltip::after {
      content: '';
      position: absolute;
      left: 50%;
      transform: translateX(-50%);
      border-left: 6px solid transparent;
      border-right: 6px solid transparent;
    }
    /* Arrow below tooltip (default: tooltip above trigger) */
    .bullet-tooltip:not(.below)::after {
      top: 100%;
      border-top: 6px solid #1e293b;
    }
    /* Flipped: tooltip below trigger */
    .bullet-tooltip.below {
      bottom: auto;
      top: calc(100% + 8px);
    }
    .bullet-tooltip.below::after {
      bottom: 100%;
      border-bottom: 6px solid #1e293b;
    }

    /* --- Rich bullet: source superscripts --- */
    .source-sup {
      font-size: 0.55em;
      vertical-align: super;
      color: #94a3b8;
      font-weight: 500;
      margin-left: 1px;
      line-height: 1;
    }

    /* --- Footnotes section --- */
    .footnotes {
      position: absolute;
      bottom: 20px;
      left: 56px;
      right: 56px;
      padding-top: 0;
      border-top: none;
      font-size: 0.42em;
      color: #b0b8c4;
      line-height: 1.3;
    }
    .footnotes .footnote-list {
      margin: 0;
      padding: 0;
      display: flex;
      flex-wrap: wrap;
      gap: 2px 14px;
    }
    .footnotes .footnote-item {
      margin: 0;
      font-size: 1em;
      line-height: 1.3;
      white-space: nowrap;
    }
    .footnotes a {
      color: #94a3b8;
      text-decoration: underline;
    }
  `;

  private _fitPending = false;

  private _positionTooltip(e: Event) {
    const trigger = e.currentTarget as HTMLElement;
    const tooltip = trigger.querySelector('.bullet-tooltip') as HTMLElement;
    if (!tooltip) return;
    const slide = trigger.closest('.slide') as HTMLElement;
    if (!slide) return;
    const triggerRect = trigger.getBoundingClientRect();
    const slideRect = slide.getBoundingClientRect();
    // If trigger is in the top 35% of the slide, flip tooltip below
    const relativeTop = (triggerRect.top - slideRect.top) / slideRect.height;
    if (relativeTop < 0.35) {
      tooltip.classList.add('below');
    } else {
      tooltip.classList.remove('below');
    }
  }

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

    // Need overflow:hidden for measurement, then revert so tooltips can escape
    slideEl.style.overflow = 'hidden';
    slideEl.style.fontSize = '';

    if (slideEl.scrollHeight <= slideEl.clientHeight) {
      slideEl.style.overflow = '';
      return;
    }

    // Binary search for the right font scale
    let lo = 0.42;
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
    slideEl.style.overflow = '';
  }

  protected renderKeyTakeaway(keyTakeaway: string | undefined, editable = false) {
    if (!keyTakeaway && !editable) return nothing;
    if (!keyTakeaway) return nothing;
    if (editable) {
      return this.wrapDeletable('key_takeaway', html`
        <div class="key-takeaway" data-content-path="key_takeaway"
          contenteditable="true"
          @blur=${(e: FocusEvent) => this.emitChange('key_takeaway', (e.target as HTMLElement).textContent)}
        >${keyTakeaway}</div>
      `);
    }
    return html`<div class="key-takeaway" data-content-path="key_takeaway">${mdInline(keyTakeaway)}</div>`;
  }

  protected renderImagePrompt(imagePrompt: string | undefined) {
    if (!imagePrompt) return nothing;
    return html`
      <div class="image-prompt-placeholder">
        <svg class="image-prompt-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <polyline points="21 15 16 10 5 21"/>
        </svg>
        <span class="image-prompt-text">${imagePrompt}</span>
        <span class="image-prompt-hint">Drop image or use Edit mode</span>
      </div>
    `;
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

  private _bulletIndex = 0;

  protected renderBulletItem(
    bullet: BulletItem,
    sourceStartIndex: number,
  ): { tmpl: TemplateResult; sourceCount: number } {
    const b = normalizeBullet(bullet);
    const sources = b.sources || [];
    const idx = this._bulletIndex++;
    return {
      tmpl: html`<li data-content-path="bullets[${idx}]">
        <span class="bullet-content">${mdInline(b.text)}</span>${b.detail ? html`<span class="bullet-detail-trigger" tabindex="0" @mouseover=${this._positionTooltip}>i<span class="bullet-tooltip">${b.detail}</span></span>` : nothing}${sources.map((_, j) => html`<span class="source-sup">${sourceStartIndex + j + 1}</span>`)}
      </li>`,
      sourceCount: sources.length,
    };
  }

  protected collectSources(bullets: BulletItem[]): Array<{ label: string; url?: string }> {
    const sources: Array<{ label: string; url?: string }> = [];
    for (const b of bullets) {
      const norm = normalizeBullet(b);
      if (norm.sources) sources.push(...norm.sources);
    }
    return sources;
  }

  protected renderFootnotes(sources: Array<{ label: string; url?: string }>): TemplateResult | typeof nothing {
    if (!sources.length) return nothing;
    return html`
      <div class="footnotes">
        <div class="footnote-list">
          ${sources.map((s, i) => html`<span class="footnote-item">${i + 1}. ${s.url ? html`<a href="${s.url}" target="_blank" rel="noopener">${s.label}</a>` : s.label}</span>`)}
        </div>
      </div>
    `;
  }

  protected renderBulletList(bullets: BulletItem[]): TemplateResult {
    this._bulletIndex = 0;
    let sourceIndex = 0;
    const items: TemplateResult[] = [];
    for (const b of bullets) {
      const { tmpl, sourceCount } = this.renderBulletItem(b, sourceIndex);
      items.push(tmpl);
      sourceIndex += sourceCount;
    }
    return html`<ul>${items}</ul>`;
  }

  protected emitChange(field: string, value: unknown) {
    this.dispatchEvent(new CustomEvent('slide-content-changed', {
      detail: { field, value },
      bubbles: true,
      composed: true,
    }));
  }
}
