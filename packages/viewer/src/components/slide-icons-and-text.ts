import { html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { SlideBase } from './slide-base.js';
import { mdInline } from '../utils/markdown.js';

@customElement('slide-icons-and-text')
export class SlideIconsAndText extends SlideBase {
  static styles = [
    SlideBase.baseStyles,
    css`
      .grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 28px;
        flex: 1;
        align-content: center;
      }
      .item {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
      }
      .icon-circle {
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background: color-mix(in srgb, var(--dp-accent, #7c3aed) 12%, transparent);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.6em;
        margin-bottom: 12px;
      }
      .item-heading {
        font-family: var(--dp-font-heading, 'DM Sans', sans-serif);
        font-size: 0.95em;
        font-weight: 600;
        color: var(--dp-text-title, #0f172a);
        margin-bottom: 4px;
      }
      .item-description {
        font-size: 0.8em;
        color: var(--dp-text-body, #64748b);
      }
    `,
  ];

  @property() title = '';
  @property({ type: Array }) items: Array<{ icon: string; heading: string; description?: string }> = [];
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
        ${this.editable ? this.wrapDeletable('items', html`
          <div class="grid">
            ${this.items.map((item, i) => html`
              <div class="item">
                <div class="icon-circle" contenteditable="true"
                  @blur=${(e: FocusEvent) => {
                    const newItems = this.items.map((it, idx) =>
                      idx === i ? { ...it, icon: (e.target as HTMLElement).textContent || '' } : it
                    );
                    this.emitChange('items', newItems);
                  }}
                >${item.icon}</div>
                <div class="item-heading" contenteditable="true"
                  @blur=${(e: FocusEvent) => {
                    const newItems = this.items.map((it, idx) =>
                      idx === i ? { ...it, heading: (e.target as HTMLElement).textContent || '' } : it
                    );
                    this.emitChange('items', newItems);
                  }}
                >${item.heading}</div>
                ${item.description ? html`
                  <div class="item-description" contenteditable="true"
                    @blur=${(e: FocusEvent) => {
                      const newItems = this.items.map((it, idx) =>
                        idx === i ? { ...it, description: (e.target as HTMLElement).textContent || '' } : it
                      );
                      this.emitChange('items', newItems);
                    }}
                  >${item.description}</div>
                ` : nothing}
              </div>
            `)}
          </div>
        `, []) : html`
          <div class="grid">
            ${this.items.map(item => html`
              <div class="item">
                <div class="icon-circle">${item.icon}</div>
                <div class="item-heading">${item.heading}</div>
                ${item.description ? html`<div class="item-description">${mdInline(item.description)}</div>` : nothing}
              </div>
            `)}
          </div>
        `}
      </div>
    `;
  }
}
