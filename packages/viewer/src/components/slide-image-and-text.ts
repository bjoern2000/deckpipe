import { html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { SlideBase } from './slide-base.js';
import { md } from '../utils/markdown.js';
import { focalPointToObjectPosition } from '../utils/focal-point.js';

@customElement('slide-image-and-text')
export class SlideImageAndText extends SlideBase {
  static styles = [
    SlideBase.baseStyles,
    css`
      .slide {
        flex-direction: row;
        gap: 32px;
      }
      .image-area {
        flex: 0 0 58%;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
      }
      .image-area img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        border-radius: 6px;
      }
      .text-area {
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: center;
      }
      .body-text { white-space: pre-wrap; }
      .body-md { }
      .body-md p { margin: 0 0 0.5em 0; }
      .body-md p:last-child { margin-bottom: 0; }
      .body-md ol, .body-md ul { padding-left: 24px; margin: 0 0 0.5em 0; }
      .body-md li { margin-bottom: 4px; }
      .body-md a { color: var(--dp-accent, #7c3aed); text-decoration: underline; }
      .body-md code { background: #f1f5f9; padding: 1px 4px; border-radius: 3px; font-size: 0.9em; }
    `,
  ];

  @property() title = '';
  @property() body = '';
  @property({ attribute: 'image-url' }) imageUrl = '';
  @property({ type: Object }) imageFocus: { x: number; y: number } | null = null;
  @property({ attribute: 'image-prompt' }) imagePrompt = '';
  @property({ attribute: 'key-takeaway' }) keyTakeaway = '';
  @property({ type: Boolean }) editable = false;

  render() {
    return html`
      <div class="slide">
        <div class="image-area">
          ${this.imageUrl
            ? this.editable
              ? this.wrapDeletable('image_url', html`<img src="${this.imageUrl}" alt="" style="object-position:${focalPointToObjectPosition(this.imageFocus)}" @error=${this.onImgError} />`, null)
              : html`<img src="${this.imageUrl}" alt="" style="object-position:${focalPointToObjectPosition(this.imageFocus)}" @error=${this.onImgError} />`
            : this.renderImagePrompt(this.imagePrompt)}
        </div>
        <div class="text-area">
          ${this.editable ? this.wrapDeletable('title', html`
            <h1 contenteditable="true"
              @blur=${(e: FocusEvent) => this.emitChange('title', (e.target as HTMLElement).textContent)}
            >${this.title}</h1>
          `) : html`<h1>${this.title}</h1>`}
          ${this.renderKeyTakeaway(this.keyTakeaway, this.editable)}
          ${this.editable ? this.wrapDeletable('body', html`
            <p class="body-text" contenteditable="true"
              @blur=${(e: FocusEvent) => this.emitChange('body', (e.target as HTMLElement).textContent)}
            >${this.body}</p>
          `) : html`<div class="body-md">${md(this.body)}</div>`}
        </div>
      </div>
    `;
  }
}
