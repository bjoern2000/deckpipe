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
      }
      .gallery-item {
        flex: 1;
        display: flex;
        flex-direction: column;
        min-width: 0;
      }
      .gallery-item .image-wrap {
        flex: 1;
        overflow: hidden;
        border-radius: 6px;
      }
      .gallery-item img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .gallery-item .item-title {
        text-align: center;
        font-family: var(--dp-font-heading, 'DM Sans', sans-serif);
        font-weight: 600;
        color: var(--dp-text-title, #0f172a);
        font-size: 0.75em;
        margin-top: 8px;
      }
      .gallery-item .item-caption {
        text-align: center;
        color: var(--dp-text-body, #64748b);
        font-size: 0.7em;
        margin-top: 2px;
      }
    `,
  ];

  @property() title = '';
  @property() caption = '';
  @property({ type: Array }) images: string[] = [];
  @property({ type: Array }) imageDetails: Array<{ title?: string; caption?: string; attribution?: { name?: string; url?: string; source?: string; source_url?: string } }> = [];
  @property({ type: Array }) imageFocuses: Array<{ x: number; y: number }> = [];
  @property({ attribute: 'image-prompt' }) imagePrompt = '';
  @property({ attribute: 'key-takeaway' }) keyTakeaway = '';
  @property({ type: Boolean }) editable = false;

  /** Fallback: split legacy caption string into per-image captions */
  private get legacyCaptions(): string[] {
    if (!this.caption) return [];
    return this.caption.split(/\s*[•·|]\s*/).map(s => s.trim()).filter(Boolean);
  }

  private itemTitle(i: number): string {
    return this.imageDetails[i]?.title || '';
  }

  private itemCaption(i: number): string {
    return this.imageDetails[i]?.caption || this.legacyCaptions[i] || '';
  }

  private renderGalleryItem(src: string, i: number) {
    const title = this.itemTitle(i);
    const caption = this.itemCaption(i);
    return html`
      <div class="gallery-item" data-content-path="images[${i}]">
        <div class="image-wrap">
          <img src="${src}" alt="" style="object-position:${focalPointToObjectPosition(this.imageFocuses[i])}" @error=${this.onImgError} />
        </div>
        ${title ? html`<div class="item-title">${title}</div>` : nothing}
        ${caption ? html`<div class="item-caption">${caption}</div>` : nothing}
        ${this.renderAttribution(this.imageDetails[i]?.attribution)}
      </div>
    `;
  }

  render() {
    return html`
      <div class="slide" data-content-path="slide">
        ${this.title
          ? this.editable
            ? this.wrapDeletable('title', html`
                <h1 contenteditable="true" data-content-path="title"
                  @blur=${(e: FocusEvent) => this.emitChange('title', (e.target as HTMLElement).textContent)}
                >${this.title}</h1>
              `)
            : html`<h1 data-content-path="title">${this.title}</h1>`
          : nothing}
        ${this.renderKeyTakeaway(this.keyTakeaway, this.editable)}
        ${this.images.length > 0
          ? this.editable ? this.wrapDeletable('images', html`
              <div class="gallery">
                ${this.images.map((src, i) => this.renderGalleryItem(src, i))}
              </div>
            `, []) : html`
              <div class="gallery">
                ${this.images.map((src, i) => this.renderGalleryItem(src, i))}
              </div>
            `
          : this.renderImagePrompt(this.imagePrompt)}
      </div>
    `;
  }
}
