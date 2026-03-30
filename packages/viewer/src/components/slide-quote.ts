import { html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { SlideBase } from './slide-base.js';
import { mdInline } from '../utils/markdown.js';
import { focalPointToObjectPosition } from '../utils/focal-point.js';

@customElement('slide-quote')
export class SlideQuote extends SlideBase {
  static styles = [
    SlideBase.baseStyles,
    css`
      .slide {
        align-items: center;
        justify-content: center;
        text-align: center;
        padding: 64px 80px;
      }
      blockquote {
        font-family: var(--dp-font-heading, 'DM Sans', sans-serif);
        font-size: 1.8em;
        font-weight: 500;
        font-style: italic;
        color: var(--dp-text-title, #0f172a);
        line-height: 1.4;
        margin: 0 0 24px 0;
        position: relative;
      }
      blockquote::before {
        content: '\u201C';
        font-size: 3em;
        color: var(--dp-accent, #7c3aed);
        position: absolute;
        top: -20px;
        left: -30px;
        opacity: 0.3;
      }
      .attribution {
        display: flex;
        align-items: center;
        gap: 12px;
        justify-content: center;
        font-size: 1em;
        color: var(--dp-text-body, #64748b);
      }
      .avatar {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        object-fit: cover;
      }
    `,
  ];

  @property() quote = '';
  @property() attribution = '';
  @property({ attribute: 'image-url' }) imageUrl = '';
  @property({ type: Object }) imageFocus: { x: number; y: number } | null = null;
  @property({ attribute: 'key-takeaway' }) keyTakeaway = '';
  @property({ type: Boolean }) editable = false;

  render() {
    return html`
      <div class="slide">
        ${this.editable ? this.wrapDeletable('quote', html`
          <blockquote contenteditable="true"
            @blur=${(e: FocusEvent) => this.emitChange('quote', (e.target as HTMLElement).textContent)}
          >${this.quote}</blockquote>
        `) : html`<blockquote>${mdInline(this.quote)}</blockquote>`}
        ${this.renderKeyTakeaway(this.keyTakeaway, this.editable)}
        ${this.attribution || this.editable
          ? this.editable
            ? this.wrapDeletable('attribution', html`
                <div class="attribution">
                  ${this.imageUrl
                    ? this.wrapDeletable('image_url', html`<img class="avatar" src="${this.imageUrl}" alt="" style="object-position:${focalPointToObjectPosition(this.imageFocus)}" @error=${this.onImgError} />`, null)
                    : nothing}
                  <span contenteditable="true"
                    @blur=${(e: FocusEvent) => this.emitChange('attribution', (e.target as HTMLElement).textContent)}
                  >${this.attribution}</span>
                </div>
              `)
            : html`
              <div class="attribution">
                ${this.imageUrl ? html`<img class="avatar" src="${this.imageUrl}" alt="" style="object-position:${focalPointToObjectPosition(this.imageFocus)}" @error=${this.onImgError} />` : nothing}
                <span>${this.attribution}</span>
              </div>
            `
          : nothing}
      </div>
    `;
  }
}
