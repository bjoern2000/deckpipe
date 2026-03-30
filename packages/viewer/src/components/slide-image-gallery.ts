import { html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { SlideBase } from './slide-base.js';
import { focalPointToObjectPosition } from '../utils/focal-point.js';

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
  @property({ type: Array }) imageFocuses: Array<{ x: number; y: number }> = [];
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
        ${this.editable ? this.wrapDeletable('images', html`
          <div class="gallery">
            ${this.images.map((src, i) => html`
              <div class="gallery-item">
                <img src="${src}" alt="" style="object-position:${focalPointToObjectPosition(this.imageFocuses[i])}" />
              </div>
            `)}
          </div>
        `, []) : html`
          <div class="gallery">
            ${this.images.map((src, i) => html`
              <div class="gallery-item">
                <img src="${src}" alt="" style="object-position:${focalPointToObjectPosition(this.imageFocuses[i])}" />
              </div>
            `)}
          </div>
        `}
        ${this.caption || this.editable
          ? this.editable
            ? this.wrapDeletable('caption', html`
                <div class="caption" contenteditable="true"
                  @blur=${(e: FocusEvent) => this.emitChange('caption', (e.target as HTMLElement).textContent)}
                >${this.caption}</div>
              `)
            : html`<div class="caption">${this.caption}</div>`
          : nothing}
      </div>
    `;
  }
}
