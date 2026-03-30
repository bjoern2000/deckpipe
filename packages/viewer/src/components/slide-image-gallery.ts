import { html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { SlideBase } from './slide-base.js';

@customElement('slide-image-gallery')
export class SlideImageGallery extends SlideBase {
  static styles = [
    SlideBase.baseStyles,
    css`
      .gallery {
        display: flex;
        gap: 16px;
        flex: 1;
        align-items: stretch;
      }
      .gallery-item {
        flex: 1;
        overflow: hidden;
        border-radius: 6px;
      }
      .gallery-item img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .caption {
        text-align: center;
        color: var(--dp-text-body, #64748b);
        font-size: 0.85em;
        margin-top: 12px;
      }
    `,
  ];

  @property() title = '';
  @property() caption = '';
  @property({ type: Array }) images: string[] = [];
  @property({ attribute: 'key-takeaway' }) keyTakeaway = '';
  @property({ type: Boolean }) editable = false;

  render() {
    return html`
      <div class="slide">
        ${this.title ? html`
          <h1
            ?contenteditable=${this.editable}
            @blur=${(e: FocusEvent) => this.emitChange('title', (e.target as HTMLElement).textContent)}
          >${this.title}</h1>
        ` : nothing}
        ${this.renderKeyTakeaway(this.keyTakeaway)}
        <div class="gallery">
          ${this.images.map(src => html`
            <div class="gallery-item">
              <img src="${src}" alt="" />
            </div>
          `)}
        </div>
        ${this.caption ? html`
          <div
            class="caption"
            ?contenteditable=${this.editable}
            @blur=${(e: FocusEvent) => this.emitChange('caption', (e.target as HTMLElement).textContent)}
          >${this.caption}</div>
        ` : nothing}
      </div>
    `;
  }
}
