import { html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { SlideBase } from './slide-base.js';

@customElement('slide-title')
export class SlideTitle extends SlideBase {
  static styles = [
    SlideBase.baseStyles,
    css`
      .slide {
        align-items: center;
        justify-content: center;
        text-align: center;
      }
      h1 { font-size: 3em; margin-bottom: 12px; }
      .subtitle {
        font-size: 1.3em;
        color: var(--dp-text-body, #666);
        margin-top: 8px;
      }
      .bg-image {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        opacity: 0.15;
        z-index: 0;
      }
      .content { position: relative; z-index: 1; }
    `,
  ];

  @property() title = '';
  @property() subtitle = '';
  @property({ attribute: 'image-url' }) imageUrl = '';
  @property({ attribute: 'key-takeaway' }) keyTakeaway = '';
  @property({ type: Boolean }) editable = false;

  render() {
    return html`
      <div class="slide">
        ${this.imageUrl ? html`<img class="bg-image" src="${this.imageUrl}" alt="" />` : ''}
        <div class="content">
          <h1
            ?contenteditable=${this.editable}
            @blur=${(e: FocusEvent) => this.emitChange('title', (e.target as HTMLElement).textContent)}
          >${this.title}</h1>
          ${this.renderKeyTakeaway(this.keyTakeaway)}
          ${this.subtitle ? html`
            <p class="subtitle"
              ?contenteditable=${this.editable}
              @blur=${(e: FocusEvent) => this.emitChange('subtitle', (e.target as HTMLElement).textContent)}
            >${this.subtitle}</p>
          ` : ''}
        </div>
      </div>
    `;
  }
}
