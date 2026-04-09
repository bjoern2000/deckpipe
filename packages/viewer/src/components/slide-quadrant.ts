import { html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { SlideBase, BulletItem, normalizeBullet } from './slide-base.js';
import { md } from '../utils/markdown.js';

@customElement('slide-quadrant')
export class SlideQuadrant extends SlideBase {
  static styles = [
    SlideBase.baseStyles,
    css`
      .layout {
        flex: 1;
        display: flex;
        min-height: 0;
        gap: 0;
      }
      .left-panel {
        width: 38%;
        display: flex;
        flex-direction: column;
        justify-content: flex-start;
        padding-right: 24px;
        flex-shrink: 0;
      }
      .left-panel h1 {
        margin-bottom: 16px;
      }
      .body {
        font-size: 0.9em;
        color: var(--dp-text-body, #334155);
        line-height: 1.5;
      }
      .body :first-child { margin-top: 0; }
      .body :last-child { margin-bottom: 0; }
      .bullets {
        list-style: disc;
        padding-left: 20px;
        margin: 0;
      }
      .bullets li {
        font-size: 0.9em;
        color: var(--dp-text-body, #334155);
        line-height: 1.5;
        margin-bottom: 6px;
      }
      .bullets li a { color: var(--dp-accent, #7c3aed); text-decoration: underline; }
      .slide { padding-bottom: 24px; }
      .plot-wrapper {
        flex: 1;
        display: flex;
        align-items: stretch;
        justify-content: flex-end;
        padding: 0 0 20px 0;
        min-height: 0;
      }
      .plot-area {
        position: relative;
        aspect-ratio: 1;
        height: 100%;
      }
      /* Main axes with arrows */
      .axis-x {
        position: absolute;
        left: 0;
        right: -6px;
        bottom: 0;
        height: 2px;
        background: color-mix(in srgb, var(--dp-text-body, #64748b) 25%, transparent);
      }
      .axis-x::after {
        content: '';
        position: absolute;
        right: 0;
        top: 50%;
        transform: translateY(-50%);
        border-left: 7px solid color-mix(in srgb, var(--dp-text-body, #64748b) 25%, transparent);
        border-top: 5px solid transparent;
        border-bottom: 5px solid transparent;
      }
      .axis-y {
        position: absolute;
        left: 0;
        top: -6px;
        bottom: 0;
        width: 2px;
        background: color-mix(in srgb, var(--dp-text-body, #64748b) 25%, transparent);
      }
      .axis-y::after {
        content: '';
        position: absolute;
        top: 0;
        left: 50%;
        transform: translateX(-50%);
        border-bottom: 7px solid color-mix(in srgb, var(--dp-text-body, #64748b) 25%, transparent);
        border-left: 5px solid transparent;
        border-right: 5px solid transparent;
      }
      /* Midpoint grid lines */
      .axis-line-x {
        position: absolute;
        left: 0;
        right: 0;
        top: 50%;
        height: 1px;
        background: color-mix(in srgb, var(--dp-text-body, #64748b) 15%, transparent);
      }
      .axis-line-y {
        position: absolute;
        top: 0;
        bottom: 0;
        left: 50%;
        width: 1px;
        background: color-mix(in srgb, var(--dp-text-body, #64748b) 15%, transparent);
      }
      .x-label {
        position: absolute;
        bottom: -22px;
        left: 50%;
        transform: translateX(-50%);
        font-size: 0.7em;
        font-weight: 600;
        color: var(--dp-text-body, #64748b);
        white-space: nowrap;
      }
      .y-label {
        position: absolute;
        right: 100%;
        top: 50%;
        transform: translateY(-50%) rotate(-90deg);
        font-size: 0.7em;
        font-weight: 600;
        color: var(--dp-text-body, #64748b);
        white-space: nowrap;
      }
      .quadrant-label {
        position: absolute;
        font-size: 0.65em;
        font-weight: 600;
        color: color-mix(in srgb, var(--dp-text-body, #64748b) 40%, transparent);
        text-transform: uppercase;
        letter-spacing: 0.03em;
        pointer-events: none;
      }
      .ql-tl { top: 8px; left: 8px; }
      .ql-tr { top: 8px; right: 8px; text-align: right; }
      .ql-bl { bottom: 8px; left: 8px; }
      .ql-br { bottom: 8px; right: 8px; text-align: right; }
      .item {
        position: absolute;
        transform: translate(-50%, 50%);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        z-index: 1;
      }
      .item-dot {
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: var(--dp-accent, #7c3aed);
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--dp-accent, #7c3aed) 20%, transparent);
      }
      .item-label {
        font-family: var(--dp-font-heading, 'DM Sans', sans-serif);
        font-size: 0.65em;
        font-weight: 600;
        color: var(--dp-text-title, #0f172a);
        white-space: nowrap;
        background: color-mix(in srgb, var(--dp-bg, #ffffff) 85%, transparent);
        padding: 1px 6px;
        border-radius: 4px;
      }
    `,
  ];

  @property() title = '';
  @property() body = '';
  @property({ type: Array }) bullets: BulletItem[] = [];
  @property({ attribute: 'x-label' }) xLabel = '';
  @property({ attribute: 'y-label' }) yLabel = '';
  @property({ type: Array }) quadrantLabels: string[] = [];
  @property({ type: Array }) items: Array<{ label: string; x: number; y: number }> = [];
  @property({ attribute: 'key-takeaway' }) keyTakeaway = '';
  @property({ type: Boolean }) editable = false;

  render() {
    const ql = this.quadrantLabels;
    const hasLeft = this.title || this.body || this.bullets.length || this.editable;

    return html`
      <div class="slide" data-content-path="slide">
        <div class="layout">
          ${hasLeft ? html`
            <div class="left-panel">
              ${this.title
                ? this.editable
                  ? this.wrapDeletable('title', html`
                      <h1 contenteditable="true" data-content-path="title"
                        @blur=${(e: FocusEvent) => this.emitChange('title', (e.target as HTMLElement).textContent)}
                      >${this.title}</h1>
                    `)
                  : html`<h1 data-content-path="title">${this.title}</h1>`
                : nothing}
              ${this.renderKeyTakeaway(this.keyTakeaway, this.editable)}
              ${this.body
                ? this.editable
                  ? this.wrapDeletable('body', html`
                      <div class="body" data-content-path="body" contenteditable="true"
                        @blur=${(e: FocusEvent) => this.emitChange('body', (e.target as HTMLElement).textContent)}
                      >${this.body}</div>
                    `)
                  : html`<div class="body" data-content-path="body">${md(this.body)}</div>`
                : nothing}
              ${this.bullets.length
                ? this.editable
                  ? this.wrapDeletable('bullets', html`
                      <ul class="bullets">
                        ${this.bullets.map((b, i) => html`
                          <li contenteditable="true"
                            @blur=${(e: FocusEvent) => {
                              const newBullets = [...this.bullets];
                              const orig = normalizeBullet(this.bullets[i]);
                              const newText = (e.target as HTMLElement).textContent || '';
                              newBullets[i] = orig.detail || orig.sources ? { ...orig, text: newText } : newText;
                              this.emitChange('bullets', newBullets);
                            }}
                          >${normalizeBullet(b).text}</li>
                        `)}
                      </ul>
                    `, [])
                  : html`
                    ${this.renderBulletList(this.bullets)}
                  `
                : nothing}
            </div>
          ` : nothing}
          <div class="plot-wrapper">
            <div class="plot-area">
              <div class="axis-x"></div>
              <div class="axis-y"></div>
              <div class="axis-line-x"></div>
              <div class="axis-line-y"></div>
              ${this.xLabel
                ? this.editable
                  ? html`<div class="x-label" contenteditable="true"
                      @blur=${(e: FocusEvent) => this.emitChange('x_label', (e.target as HTMLElement).textContent)}
                    >${this.xLabel}</div>`
                  : html`<div class="x-label">${this.xLabel}</div>`
                : nothing}
              ${this.yLabel
                ? this.editable
                  ? html`<div class="y-label" contenteditable="true"
                      @blur=${(e: FocusEvent) => this.emitChange('y_label', (e.target as HTMLElement).textContent)}
                    >${this.yLabel}</div>`
                  : html`<div class="y-label">${this.yLabel}</div>`
                : nothing}
              ${ql.length === 4 ? html`
                <div class="quadrant-label ql-tl">${ql[0]}</div>
                <div class="quadrant-label ql-tr">${ql[1]}</div>
                <div class="quadrant-label ql-bl">${ql[2]}</div>
                <div class="quadrant-label ql-br">${ql[3]}</div>
              ` : nothing}
              ${this.items.map((item, i) => html`
                <div class="item" data-content-path="items[${i}]" style="left:${item.x * 100}%;bottom:${item.y * 100}%">
                  <div class="item-dot"></div>
                  <div class="item-label">${item.label}</div>
                </div>
              `)}
            </div>
          </div>
        </div>
      </div>
    `;
  }
}
