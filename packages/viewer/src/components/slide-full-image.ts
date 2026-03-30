import { html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { SlideBase } from './slide-base.js';

@customElement('slide-full-image')
export class SlideFullImage extends SlideBase {
  static styles = [
    SlideBase.baseStyles,
    css`
      .slide {
        padding: 0;
        position: relative;
      }
      .bg {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        border-radius: 0;
      }
      .overlay {
        position: absolute;
        inset: 0;
        background: linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 60%);
      }
      .content {
        position: relative;
        z-index: 1;
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
        height: 100%;
        padding: 48px 56px;
      }
      h1 {
        color: #ffffff;
        text-shadow: 0 1px 4px rgba(0,0,0,0.3);
      }
      .subtitle {
        color: rgba(255,255,255,0.85);
        font-size: 1.2em;
        margin: 0;
      }
      .key-takeaway {
        background: rgba(255,255,255,0.15);
        color: #ffffff;
      }
    `,
  ];

  @property({ attribute: 'image-url' }) imageUrl = '';
  @property() title = '';
  @property() subtitle = '';
  @property({ attribute: 'key-takeaway' }) keyTakeaway = '';
  @property({ type: Boolean }) editable = false;

  render() {
    return html`
      <div class="slide">
        ${this.imageUrl ? html`<img class="bg" src="${this.imageUrl}" alt="" />` : nothing}
        <div class="overlay"></div>
        <div class="content">
          ${this.title ? html`
            <h1
              ?contenteditable=${this.editable}
              @blur=${(e: FocusEvent) => this.emitChange('title', (e.target as HTMLElement).textContent)}
            >${this.title}</h1>
          ` : nothing}
          ${this.renderKeyTakeaway(this.keyTakeaway)}
          ${this.subtitle ? html`
            <p
              class="subtitle"
              ?contenteditable=${this.editable}
              @blur=${(e: FocusEvent) => this.emitChange('subtitle', (e.target as HTMLElement).textContent)}
            >${this.subtitle}</p>
          ` : nothing}
        </div>
      </div>
    `;
  }
}
