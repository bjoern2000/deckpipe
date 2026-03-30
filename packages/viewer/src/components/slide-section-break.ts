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
        background: var(--dp-accent, #2563eb);
      }
      h1 {
        color: #ffffff;
        font-size: 2.8em;
      }
    `,
  ];

  @property() title = '';
  @property({ attribute: 'key-takeaway' }) keyTakeaway = '';
  @property({ type: Boolean }) editable = false;

  render() {
    return html`
      <div class="slide">
        <h1
          ?contenteditable=${this.editable}
          @blur=${(e: FocusEvent) => this.emitChange('title', (e.target as HTMLElement).textContent)}
        >${this.title}</h1>
        ${this.renderKeyTakeaway(this.keyTakeaway)}
      </div>
    `;
  }
}
