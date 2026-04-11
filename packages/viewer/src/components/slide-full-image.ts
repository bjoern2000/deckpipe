import { html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { SlideBase } from './slide-base.js';
import { focalPointToObjectPosition } from '../utils/focal-point.js';

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
        margin-bottom: 8px;
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
      .image-attribution { position: absolute; bottom: 8px; right: 16px; z-index: 2; color: rgba(255,255,255,0.5); }
      .image-attribution a { color: rgba(255,255,255,0.5); text-decoration-color: rgba(255,255,255,0.2); }
      .image-attribution a:hover { color: rgba(255,255,255,0.7); }
    `,
  ];

  @property({ attribute: 'image-url' }) imageUrl = '';
  @property({ type: Object }) imageFocus: { x: number; y: number } | null = null;
  @property({ type: Object }) imageAttribution: { name?: string; url?: string; source?: string; source_url?: string } | null = null;
  @property() title = '';
  @property() subtitle = '';
  @property({ attribute: 'image-prompt' }) imagePrompt = '';
  @property({ attribute: 'key-takeaway' }) keyTakeaway = '';
  @property({ type: Boolean }) editable = false;

  render() {
    return html`
      <div class="slide" data-content-path="slide">
        ${this.imageUrl
          ? this.editable
            ? this.wrapDeletable('image_url', html`<img class="bg" src="${this.imageUrl}" alt="" style="object-position:${focalPointToObjectPosition(this.imageFocus)}" @error=${this.onImgError} />`, null)
            : html`<img class="bg" src="${this.imageUrl}" alt="" style="object-position:${focalPointToObjectPosition(this.imageFocus)}" @error=${this.onImgError} />`
          : this.imagePrompt ? html`<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:48px">${this.renderImagePrompt(this.imagePrompt)}</div>` : nothing}
        <div class="overlay"></div>
        <div class="content">
          ${this.title
            ? this.editable
              ? this.wrapDeletable('title', html`
                  <h1 data-content-path="title" contenteditable="true"
                    @blur=${(e: FocusEvent) => this.emitChange('title', (e.target as HTMLElement).textContent)}
                  >${this.title}</h1>
                `)
              : html`<h1 data-content-path="title">${this.title}</h1>`
            : nothing}
          ${this.renderKeyTakeaway(this.keyTakeaway, this.editable)}
          ${this.subtitle || this.editable
            ? this.editable
              ? this.wrapDeletable('subtitle', html`
                  <p class="subtitle" data-content-path="subtitle" contenteditable="true"
                    @blur=${(e: FocusEvent) => this.emitChange('subtitle', (e.target as HTMLElement).textContent)}
                  >${this.subtitle}</p>
                `)
              : html`<p class="subtitle" data-content-path="subtitle">${this.subtitle}</p>`
            : nothing}
        </div>
        ${this.imageUrl ? this.renderAttribution(this.imageAttribution) : ''}
      </div>
    `;
  }
}
