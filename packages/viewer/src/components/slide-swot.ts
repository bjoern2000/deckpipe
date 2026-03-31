import { html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { SlideBase } from './slide-base.js';
import { mdInline } from '../utils/markdown.js';

@customElement('slide-swot')
export class SlideSwot extends SlideBase {
  static styles = [
    SlideBase.baseStyles,
    css`
      .grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        grid-template-rows: 1fr 1fr;
        gap: 12px;
        flex: 1;
      }
      .quadrant {
        border-radius: 10px;
        overflow: hidden;
        display: flex;
        flex-direction: column;
      }
      .quadrant-header {
        padding: 8px 16px;
        font-family: var(--dp-font-heading, 'DM Sans', sans-serif);
        font-size: 0.8em;
        font-weight: 700;
        color: #fff;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .strengths .quadrant-header { background: #16a34a; }
      .weaknesses .quadrant-header { background: #dc2626; }
      .opportunities .quadrant-header { background: #2563eb; }
      .threats .quadrant-header { background: #ea580c; }
      .quadrant-body {
        padding: 10px 16px;
        flex: 1;
        background: #f8fafc;
      }
      .strengths .quadrant-body { background: color-mix(in srgb, #16a34a 5%, white); }
      .weaknesses .quadrant-body { background: color-mix(in srgb, #dc2626 5%, white); }
      .opportunities .quadrant-body { background: color-mix(in srgb, #2563eb 5%, white); }
      .threats .quadrant-body { background: color-mix(in srgb, #ea580c 5%, white); }
      .quadrant-body ul {
        list-style: disc;
        padding-left: 18px;
        margin: 0;
      }
      .quadrant-body li {
        font-size: 0.75em;
        color: var(--dp-text-body, #334155);
        margin-bottom: 4px;
      }
      .quadrant-body li a { color: var(--dp-accent, #7c3aed); text-decoration: underline; }
    `,
  ];

  @property() title = '';
  @property({ type: Array }) strengths: string[] = [];
  @property({ type: Array }) weaknesses: string[] = [];
  @property({ type: Array }) opportunities: string[] = [];
  @property({ type: Array }) threats: string[] = [];
  @property({ attribute: 'key-takeaway' }) keyTakeaway = '';
  @property({ type: Boolean }) editable = false;

  private _renderQuadrant(name: string, field: 'strengths' | 'weaknesses' | 'opportunities' | 'threats', items: string[]) {
    if (this.editable) {
      return html`
        <div class="quadrant ${field}">
          <div class="quadrant-header">${name}</div>
          <div class="quadrant-body">
            ${this.wrapDeletable(field, html`
              <ul>
                ${items.map((item, i) => html`
                  <li contenteditable="true"
                    @blur=${(e: FocusEvent) => {
                      const newItems = [...items];
                      newItems[i] = (e.target as HTMLElement).textContent || '';
                      this.emitChange(field, newItems);
                    }}
                  >${item}</li>
                `)}
              </ul>
            `, [])}
          </div>
        </div>
      `;
    }
    return html`
      <div class="quadrant ${field}">
        <div class="quadrant-header">${name}</div>
        <div class="quadrant-body">
          <ul>${items.map(item => html`<li>${mdInline(item)}</li>`)}</ul>
        </div>
      </div>
    `;
  }

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
        <div class="grid">
          ${this._renderQuadrant('\u{1F4AA} Strengths', 'strengths', this.strengths)}
          ${this._renderQuadrant('\u{26A0}\uFE0F Weaknesses', 'weaknesses', this.weaknesses)}
          ${this._renderQuadrant('\u{1F680} Opportunities', 'opportunities', this.opportunities)}
          ${this._renderQuadrant('\u{1F6E1}\uFE0F Threats', 'threats', this.threats)}
        </div>
      </div>
    `;
  }
}
