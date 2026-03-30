import { html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { SlideBase } from './slide-base.js';

@customElement('slide-quadrant')
export class SlideQuadrant extends SlideBase {
  static styles = [
    SlideBase.baseStyles,
    css`
      .plot-wrapper {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 8px 24px 24px 24px;
      }
      .plot-area {
        position: relative;
        aspect-ratio: 1;
        height: 100%;
        max-width: 100%;
        border-left: 2px solid color-mix(in srgb, var(--dp-text-body, #64748b) 25%, transparent);
        border-bottom: 2px solid color-mix(in srgb, var(--dp-text-body, #64748b) 25%, transparent);
      }
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
        left: -22px;
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
  @property({ attribute: 'x-label' }) xLabel = '';
  @property({ attribute: 'y-label' }) yLabel = '';
  @property({ type: Array }) quadrantLabels: string[] = [];
  @property({ type: Array }) items: Array<{ label: string; x: number; y: number }> = [];
  @property({ attribute: 'key-takeaway' }) keyTakeaway = '';
  @property({ type: Boolean }) editable = false;

  render() {
    const ql = this.quadrantLabels;
    return html`
      <div class="slide">
        ${this.title
          ? this.editable
            ? this.wrapDeletable('title', html`
                <h1 contenteditable="true"
                  @blur=${(e: FocusEvent) => this.emitChange('title', (e.target as HTMLElement).textContent)}
                >${this.title}</h1>
              `)
            : html`<h1>${this.title}</h1>`
          : nothing}
        ${this.renderKeyTakeaway(this.keyTakeaway, this.editable)}
        <div class="plot-wrapper">
          <div class="plot-area">
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
            ${this.items.map(item => html`
              <div class="item" style="left:${item.x * 100}%;bottom:${item.y * 100}%">
                <div class="item-dot"></div>
                <div class="item-label">${item.label}</div>
              </div>
            `)}
          </div>
        </div>
      </div>
    `;
  }
}
