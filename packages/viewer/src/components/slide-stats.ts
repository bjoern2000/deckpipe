import { html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { SlideBase } from './slide-base.js';

@customElement('slide-stats')
export class SlideStats extends SlideBase {
  static styles = [
    SlideBase.baseStyles,
    css`
      .metrics {
        display: flex;
        gap: 32px;
        justify-content: center;
        align-items: center;
        flex: 1;
      }
      .metric {
        flex: 1;
        text-align: center;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .metric-value {
        font-family: var(--dp-font-heading, 'DM Sans', sans-serif);
        font-size: 3em;
        font-weight: 700;
        color: var(--dp-accent, #7c3aed);
        line-height: 1.1;
      }
      .metric-label {
        font-size: 1em;
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
        ${this.title ? html`
          <h1
            ?contenteditable=${this.editable}
            @blur=${(e: FocusEvent) => this.emitChange('title', (e.target as HTMLElement).textContent)}
          >${this.title}</h1>
        ` : nothing}
        ${this.renderKeyTakeaway(this.keyTakeaway)}
        <div class="metrics">
          ${this.metrics.map((m, i) => html`
            <div class="metric">
              <div
                class="metric-value"
                ?contenteditable=${this.editable}
                @blur=${(e: FocusEvent) => {
                  const newMetrics = this.metrics.map((met, idx) =>
                    idx === i
                      ? { ...met, value: (e.target as HTMLElement).textContent || '' }
                      : met
                  );
                  this.emitChange('metrics', newMetrics);
                }}
              >${m.value}</div>
              <div
                class="metric-label"
                ?contenteditable=${this.editable}
                @blur=${(e: FocusEvent) => {
                  const newMetrics = this.metrics.map((met, idx) =>
                    idx === i
                      ? { ...met, label: (e.target as HTMLElement).textContent || '' }
                      : met
                  );
                  this.emitChange('metrics', newMetrics);
                }}
              >${m.label}</div>
            </div>
          `)}
        </div>
      </div>
    `;
  }
}
