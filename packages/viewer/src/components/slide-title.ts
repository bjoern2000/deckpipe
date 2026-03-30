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
      }
      h1 { font-size: 3em; margin-bottom: 12px; }
      .subtitle {
        font-size: 1.3em;
        color: var(--dp-text-body, #666);
        margin-top: 8px;
      }
      .subtitle a { color: var(--dp-accent, #7c3aed); text-decoration: underline; }
      .subtitle code { background: #f1f5f9; padding: 1px 4px; border-radius: 3px; font-size: 0.9em; }
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
      <div class="slide">
        ${this.imageUrl
          ? this.editable
            ? this.wrapDeletable('image_url', html`<img class="bg-image" src="${this.imageUrl}" alt="" style="object-position:${focalPointToObjectPosition(this.imageFocus)}" />`, null)
            : html`<img class="bg-image" src="${this.imageUrl}" alt="" style="object-position:${focalPointToObjectPosition(this.imageFocus)}" />`
          : ''}
        <div class="content">
          ${this.editable ? this.wrapDeletable('title', html`
            <h1 contenteditable="true"
              @blur=${(e: FocusEvent) => this.emitChange('title', (e.target as HTMLElement).textContent)}
            >${this.title}</h1>
          `) : html`<h1>${this.title}</h1>`}
          ${this.renderKeyTakeaway(this.keyTakeaway, this.editable)}
          ${this.subtitle || this.editable ? this.editable
            ? this.wrapDeletable('subtitle', html`
                <p class="subtitle" contenteditable="true"
                  @blur=${(e: FocusEvent) => this.emitChange('subtitle', (e.target as HTMLElement).textContent)}
                >${this.subtitle}</p>
              `)
            : html`<p class="subtitle">${mdInline(this.subtitle)}</p>`
          : ''}
        </div>
      </div>
    `;
  }
}
