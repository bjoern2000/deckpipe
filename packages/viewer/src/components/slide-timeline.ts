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
        flex: 1;
        position: relative;
      }
      .timeline-line {
        position: absolute;
        top: 50%;
        left: 6%;
        right: 6%;
        height: 3px;
        margin-top: -1.5px;
        background: var(--dp-accent, #7c3aed);
        opacity: 0.25;
      }
      .event {
        position: absolute;
        text-align: center;
      }
      .dot {
        position: absolute;
        top: 50%;
        left: 50%;
        width: 18px;
        height: 18px;
        margin-top: -9px;
        margin-left: -9px;
        border-radius: 50%;
        background: var(--dp-accent, #7c3aed);
        flex-shrink: 0;
      }
      .event-content {
        position: absolute;
        left: 0;
        right: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
      }
      .event-content.below {
        top: calc(50% + 18px);
      }
      .event-content.above {
        bottom: calc(50% + 18px);
      }
      .event-label {
        font-family: var(--dp-font-heading, 'DM Sans', sans-serif);
        font-size: 0.65em;
        font-weight: 700;
        color: var(--dp-accent, #7c3aed);
        text-transform: uppercase;
        letter-spacing: 0.03em;
      }
      .event-title {
        font-family: var(--dp-font-heading, 'DM Sans', sans-serif);
        font-size: 0.8em;
        font-weight: 600;
        color: var(--dp-text-title, #0f172a);
        margin-top: 3px;
        line-height: 1.25;
      }
      .event-description {
        font-size: 0.65em;
        color: var(--dp-text-body, #64748b);
        margin-top: 2px;
        line-height: 1.3;
      }
    `,
  ];

  @property() title = '';
  @property({ type: Array }) events: Array<{ label: string; title: string; description?: string; position?: number }> = [];
  @property({ attribute: 'key-takeaway' }) keyTakeaway = '';
  @property({ type: Boolean }) editable = false;

  private getPositions(): number[] {
    const n = this.events.length;
    if (n <= 1) return [0.5];
    return this.events.map((e, i) => e.position ?? i / (n - 1));
  }

  private getLeft(pos: number): number {
    const PAD = 6;
    return PAD + pos * (100 - 2 * PAD);
  }

  render() {
    const positions = this.getPositions();
    const n = this.events.length;
    const colWidth = Math.floor(80 / n);
    const eventWidth = `${colWidth}%`;

    return html`
      <div class="slide" data-content-path="slide">
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
        ${this.editable ? this.wrapDeletable('events', html`
          <div class="timeline">
            <div class="timeline-line"></div>
            ${this.events.map((ev, i) => html`
              <div class="event" data-content-path="events[${i}]" style="left:${this.getLeft(positions[i]) - colWidth / 2}%;width:${eventWidth};top:0;bottom:0">
                <div class="dot"></div>
                <div class="event-content ${i % 2 === 0 ? 'below' : 'above'}">
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
              </div>
            `)}
          </div>
        `, []) : html`
          <div class="timeline">
            <div class="timeline-line"></div>
            ${this.events.map((ev, i) => html`
              <div class="event" data-content-path="events[${i}]" style="left:${this.getLeft(positions[i]) - colWidth / 2}%;width:${eventWidth};top:0;bottom:0">
                <div class="dot"></div>
                <div class="event-content ${i % 2 === 0 ? 'below' : 'above'}">
                  <div class="event-label">${ev.label}</div>
                  <div class="event-title">${mdInline(ev.title)}</div>
                  ${ev.description ? html`<div class="event-description">${mdInline(ev.description)}</div>` : nothing}
                </div>
              </div>
            `)}
          </div>
        `}
      </div>
    `;
  }
}
