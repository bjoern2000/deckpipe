import { html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { SlideBase } from './slide-base.js';
import { mdInline } from '../utils/markdown.js';
import { focalPointToObjectPosition } from '../utils/focal-point.js';

@customElement('slide-title')
export class SlideTitle extends SlideBase {
  static styles = [
    SlideBase.baseStyles,
    css`
      .slide {
        align-items: center;
        justify-content: center;
        text-align: center;
        background: var(--dp-accent, #2563eb);
      }
      h1 { font-size: 3em; margin-bottom: 12px; color: #ffffff; }
      .subtitle {
        font-size: 1.3em;
        color: rgba(255, 255, 255, 0.85);
        margin-top: 8px;
      }
      .subtitle a { color: rgba(255, 255, 255, 0.9); text-decoration: underline; }
      .subtitle code { background: rgba(255, 255, 255, 0.15); color: #fff; padding: 1px 4px; border-radius: 3px; font-size: 0.9em; }
      .key-takeaway { background: rgba(255, 255, 255, 0.15); color: rgba(255, 255, 255, 0.9); }
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
  @property({ type: Object }) imageFocus: { x: number; y: number } | null = null;
  @property({ attribute: 'key-takeaway' }) keyTakeaway = '';
  @property({ type: Boolean }) editable = false;

  render() {
    return html`
      <div class="slide" data-content-path="slide">
        ${this.imageUrl
          ? this.editable
            ? this.wrapDeletable('image_url', html`<img class="bg-image" src="${this.imageUrl}" alt="" style="object-position:${focalPointToObjectPosition(this.imageFocus)}" @error=${this.onImgError} />`, null)
            : html`<img class="bg-image" src="${this.imageUrl}" alt="" style="object-position:${focalPointToObjectPosition(this.imageFocus)}" @error=${this.onImgError} />`
          : ''}
        <div class="content">
          ${this.editable ? this.wrapDeletable('title', html`
            <h1 data-content-path="title" contenteditable="true"
              @blur=${(e: FocusEvent) => this.emitChange('title', (e.target as HTMLElement).textContent)}
            >${this.title}</h1>
          `) : html`<h1 data-content-path="title">${this.title}</h1>`}
          ${this.renderKeyTakeaway(this.keyTakeaway, this.editable)}
          ${this.subtitle || this.editable ? this.editable
            ? this.wrapDeletable('subtitle', html`
                <p class="subtitle" data-content-path="subtitle" contenteditable="true"
                  @blur=${(e: FocusEvent) => this.emitChange('subtitle', (e.target as HTMLElement).textContent)}
                >${this.subtitle}</p>
              `)
            : html`<p class="subtitle" data-content-path="subtitle">${mdInline(this.subtitle)}</p>`
          : ''}
        </div>
      </div>
    `;
  }
}
