import { html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { SlideBase } from './slide-base.js';

@customElement('slide-two-columns')
export class SlideTwoColumns extends SlideBase {
  static styles = [
    SlideBase.baseStyles,
    css`
      .columns {
        display: flex;
        gap: 32px;
        flex: 1;
      }
      .column {
        flex: 1;
      }
      .column h2 {
        margin-bottom: 8px;
      }
      .column p {
        white-space: pre-wrap;
      }
      .bottom-image {
        margin-top: 16px;
        text-align: center;
      }
      .bottom-image img {
        max-height: 200px;
      }
    `,
  ];

  @property() title = '';
  @property({ type: Object }) left: { heading: string; body: string } = { heading: '', body: '' };
  @property({ type: Object }) right: { heading: string; body: string } = { heading: '', body: '' };
  @property({ attribute: 'image-url' }) imageUrl = '';
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
        <div class="columns">
          <div class="column">
            <h2
              ?contenteditable=${this.editable}
              @blur=${(e: FocusEvent) => this.emitChange('left', { ...this.left, heading: (e.target as HTMLElement).textContent || '' })}
            >${this.left.heading}</h2>
            <p
              ?contenteditable=${this.editable}
              @blur=${(e: FocusEvent) => this.emitChange('left', { ...this.left, body: (e.target as HTMLElement).textContent || '' })}
            >${this.left.body}</p>
          </div>
          <div class="column">
            <h2
              ?contenteditable=${this.editable}
              @blur=${(e: FocusEvent) => this.emitChange('right', { ...this.right, heading: (e.target as HTMLElement).textContent || '' })}
            >${this.right.heading}</h2>
            <p
              ?contenteditable=${this.editable}
              @blur=${(e: FocusEvent) => this.emitChange('right', { ...this.right, body: (e.target as HTMLElement).textContent || '' })}
            >${this.right.body}</p>
          </div>
        </div>
        ${this.imageUrl ? html`
          <div class="bottom-image"><img src="${this.imageUrl}" alt="" /></div>
        ` : ''}
      </div>
    `;
  }
}
