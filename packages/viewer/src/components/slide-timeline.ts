import { html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { SlideBase } from './slide-base.js';
import { mdInline } from '../utils/markdown.js';

@customElement('slide-timeline')
export class SlideTimeline extends SlideBase {
  static styles = [
    SlideBase.baseStyles,
    css`
      .timeline {
        display: grid;
        grid-template-columns: repeat(var(--event-count, 4), 1fr);
        gap: 0;
        flex: 1;
        align-content: center;
      }
      .event {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        padding: 0 12px;
        position: relative;
      }
      .dot-row {
        position: relative;
        width: 100%;
        display: flex;
        justify-content: center;
        padding: 8px 0;
      }
      .dot-row::before {
        content: '';
        position: absolute;
        top: 50%;
        left: 0;
        right: 0;
        height: 3px;
        margin-top: -1.5px;
        background: var(--dp-accent, #7c3aed);
        opacity: 0.25;
      }
      .event:first-child .dot-row::before { left: 50%; }
      .event:last-child .dot-row::before { right: 50%; }
      .dot {
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: var(--dp-accent, #7c3aed);
        flex-shrink: 0;
        z-index: 1;
        position: relative;
      }
      .event-label {
        font-family: var(--dp-font-heading, 'DM Sans', sans-serif);
        font-size: 0.75em;
        font-weight: 700;
        color: var(--dp-accent, #7c3aed);
        margin-top: 12px;
        text-transform: uppercase;
        letter-spacing: 0.03em;
      }
      .event-title {
        font-family: var(--dp-font-heading, 'DM Sans', sans-serif);
        font-size: 0.95em;
        font-weight: 600;
        color: var(--dp-text-title, #0f172a);
        margin-top: 6px;
      }
      .event-description {
        font-size: 0.8em;
        color: var(--dp-text-body, #64748b);
        margin-top: 4px;
      }
    `,
  ];

  @property() title = '';
  @property({ type: Array }) events: Array<{ label: string; title: string; description?: string }> = [];
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
        ${this.editable ? this.wrapDeletable('events', html`
          <div class="timeline" style="--event-count:${this.events.length}">
            ${this.events.map((ev, i) => html`
              <div class="event">
                <div class="dot-row"><div class="dot"></div></div>
                <div class="event-label" contenteditable="true"
                  @blur=${(e: FocusEvent) => {
                    const newEvents = this.events.map((evt, idx) =>
                      idx === i ? { ...evt, label: (e.target as HTMLElement).textContent || '' } : evt
                    );
                    this.emitChange('events', newEvents);
                  }}
                >${ev.label}</div>
                <div class="event-title" contenteditable="true"
                  @blur=${(e: FocusEvent) => {
                    const newEvents = this.events.map((evt, idx) =>
                      idx === i ? { ...evt, title: (e.target as HTMLElement).textContent || '' } : evt
                    );
                    this.emitChange('events', newEvents);
                  }}
                >${ev.title}</div>
                ${ev.description ? html`
                  <div class="event-description" contenteditable="true"
                    @blur=${(e: FocusEvent) => {
                      const newEvents = this.events.map((evt, idx) =>
                        idx === i ? { ...evt, description: (e.target as HTMLElement).textContent || '' } : evt
                      );
                      this.emitChange('events', newEvents);
                    }}
                  >${ev.description}</div>
                ` : nothing}
              </div>
            `)}
          </div>
        `, []) : html`
          <div class="timeline" style="--event-count:${this.events.length}">
            ${this.events.map(ev => html`
              <div class="event">
                <div class="dot-row"><div class="dot"></div></div>
                <div class="event-label">${ev.label}</div>
                <div class="event-title">${mdInline(ev.title)}</div>
                ${ev.description ? html`<div class="event-description">${mdInline(ev.description)}</div>` : nothing}
              </div>
            `)}
          </div>
        `}
      </div>
    `;
  }
}
