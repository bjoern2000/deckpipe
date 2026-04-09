import { html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { SlideBase } from './slide-base.js';

@customElement('slide-section-break')
export class SlideSectionBreak extends SlideBase {
  static styles = [
    SlideBase.baseStyles,
    css`
      .slide {
        align-items: center;
        justify-content: center;
        text-align: center;
        background: color-mix(in srgb, var(--dp-accent, #2563eb) 8%, var(--dp-bg, #ffffff));
      }
      h1 {
        color: var(--dp-accent, #2563eb);
        font-size: 2.8em;
      }
    `,
  ];

  @property() title = '';
  @property({ attribute: 'key-takeaway' }) keyTakeaway = '';
  @property({ type: Boolean }) editable = false;

  render() {
    return html`
      <div class="slide" data-content-path="slide">
        ${this.editable ? this.wrapDeletable('title', html`
          <h1 data-content-path="title" contenteditable="true"
            @blur=${(e: FocusEvent) => this.emitChange('title', (e.target as HTMLElement).textContent)}
          >${this.title}</h1>
        `) : html`<h1 data-content-path="title">${this.title}</h1>`}
        ${this.renderKeyTakeaway(this.keyTakeaway, this.editable)}
      </div>
    `;
  }
}
