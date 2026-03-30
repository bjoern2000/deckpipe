import { html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { SlideBase } from './slide-base.js';
import { mdInline } from '../utils/markdown.js';

@customElement('slide-agenda')
export class SlideAgenda extends SlideBase {
  static styles = [
    SlideBase.baseStyles,
    css`
      .items {
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: 4px;
      }
      .agenda-item {
        display: flex;
        align-items: baseline;
        gap: 20px;
        padding: 12px 0;
        border-bottom: 1px solid color-mix(in srgb, var(--dp-text-body, #64748b) 12%, transparent);
      }
      .agenda-item:last-child {
        border-bottom: none;
      }
      .number {
        font-family: var(--dp-font-heading, 'DM Sans', sans-serif);
        font-size: 1.5em;
        font-weight: 800;
        color: var(--dp-accent, #7c3aed);
        min-width: 36px;
        text-align: right;
        opacity: 0.7;
      }
      .item-content {
        flex: 1;
      }
      .topic {
        font-family: var(--dp-font-heading, 'DM Sans', sans-serif);
        font-size: 1em;
        font-weight: 600;
        color: var(--dp-text-title, #0f172a);
      }
      .description {
        font-size: 0.8em;
        color: var(--dp-text-body, #64748b);
        margin-top: 2px;
      }
      .duration {
        font-size: 0.75em;
        font-weight: 600;
        color: var(--dp-accent, #7c3aed);
        background: color-mix(in srgb, var(--dp-accent, #7c3aed) 10%, transparent);
        padding: 4px 10px;
        border-radius: 12px;
        white-space: nowrap;
        flex-shrink: 0;
      }
    `,
  ];

  @property() title = '';
  @property({ type: Array }) items: Array<{ topic: string; duration?: string; description?: string }> = [];
  @property({ attribute: 'key-takeaway' }) keyTakeaway = '';
  @property({ type: Boolean }) editable = false;

  render() {
    const heading = this.title || 'Agenda';

    return html`
      <div class="slide">
        ${this.editable ? this.wrapDeletable('title', html`
          <h1 contenteditable="true"
            @blur=${(e: FocusEvent) => this.emitChange('title', (e.target as HTMLElement).textContent)}
          >${heading}</h1>
        `) : html`<h1>${heading}</h1>`}
        ${this.renderKeyTakeaway(this.keyTakeaway, this.editable)}
        ${this.editable ? this.wrapDeletable('items', html`
          <div class="items">
            ${this.items.map((item, i) => html`
              <div class="agenda-item">
                <div class="number">${i + 1}</div>
                <div class="item-content">
                  <div class="topic" contenteditable="true"
                    @blur=${(e: FocusEvent) => {
                      const newItems = this.items.map((it, idx) =>
                        idx === i ? { ...it, topic: (e.target as HTMLElement).textContent || '' } : it
                      );
                      this.emitChange('items', newItems);
                    }}
                  >${item.topic}</div>
                  ${item.description ? html`
                    <div class="description" contenteditable="true"
                      @blur=${(e: FocusEvent) => {
                        const newItems = this.items.map((it, idx) =>
                          idx === i ? { ...it, description: (e.target as HTMLElement).textContent || '' } : it
                        );
                        this.emitChange('items', newItems);
                      }}
                    >${item.description}</div>
                  ` : nothing}
                </div>
                ${item.duration ? html`
                  <div class="duration" contenteditable="true"
                    @blur=${(e: FocusEvent) => {
                      const newItems = this.items.map((it, idx) =>
                        idx === i ? { ...it, duration: (e.target as HTMLElement).textContent || '' } : it
                      );
                      this.emitChange('items', newItems);
                    }}
                  >${item.duration}</div>
                ` : nothing}
              </div>
            `)}
          </div>
        `, []) : html`
          <div class="items">
            ${this.items.map((item, i) => html`
              <div class="agenda-item">
                <div class="number">${i + 1}</div>
                <div class="item-content">
                  <div class="topic">${mdInline(item.topic)}</div>
                  ${item.description ? html`<div class="description">${mdInline(item.description)}</div>` : nothing}
                </div>
                ${item.duration ? html`<div class="duration">${item.duration}</div>` : nothing}
              </div>
            `)}
          </div>
        `}
      </div>
    `;
  }
}
