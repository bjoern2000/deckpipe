import { html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { SlideBase } from './slide-base.js';

@customElement('slide-stats')
export class SlideStats extends SlideBase {
  static styles = [
    SlideBase.baseStyles,
    css`
      .metrics {
        display: grid;
        grid-template-columns: repeat(var(--metric-count, 4), 1fr);
        grid-template-rows: auto auto;
        gap: 12px 32px;
        flex: 1;
        align-content: center;
        text-align: center;
      }
      .metric-value {
        font-family: var(--dp-font-heading, 'DM Sans', sans-serif);
        font-size: 2.4em;
        font-weight: 700;
        color: var(--dp-accent, #7c3aed);
        line-height: 1.1;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .metric-label {
        font-size: 0.9em;
        color: var(--dp-text-body, #64748b);
      }
    `,
  ];

  @property() title = '';
  @property({ type: Array }) metrics: Array<{ value: string; label: string }> = [];
  @property({ attribute: 'key-takeaway' }) keyTakeaway = '';
  @property({ type: Boolean }) editable = false;

  render() {
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
        ${this.editable ? this.wrapDeletable('metrics', html`
          <div class="metrics" style="--metric-count:${this.metrics.length}">
            ${this.metrics.map((m, i) => html`
              <div class="metric-value" contenteditable="true"
                @blur=${(e: FocusEvent) => {
                  const newMetrics = this.metrics.map((met, idx) =>
                    idx === i
                      ? { ...met, value: (e.target as HTMLElement).textContent || '' }
                      : met
                  );
                  this.emitChange('metrics', newMetrics);
                }}
              >${m.value}</div>
            `)}
            ${this.metrics.map((m, i) => html`
              <div class="metric-label" contenteditable="true"
                @blur=${(e: FocusEvent) => {
                  const newMetrics = this.metrics.map((met, idx) =>
                    idx === i
                      ? { ...met, label: (e.target as HTMLElement).textContent || '' }
                      : met
                  );
                  this.emitChange('metrics', newMetrics);
                }}
              >${m.label}</div>
            `)}
          </div>
        `, []) : html`
          <div class="metrics" style="--metric-count:${this.metrics.length}">
            ${this.metrics.map(m => html`
              <div class="metric-value">${m.value}</div>
            `)}
            ${this.metrics.map(m => html`
              <div class="metric-label">${m.label}</div>
            `)}
          </div>
        `}
      </div>
    `;
  }
}
