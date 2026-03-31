import { html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { SlideBase, BulletItem, normalizeBullet } from './slide-base.js';
import { focalPointToObjectPosition } from '../utils/focal-point.js';

@customElement('slide-title-and-bullets')
export class SlideTitleAndBullets extends SlideBase {
  static styles = [
    SlideBase.baseStyles,
    css`
      .with-image {
        flex-direction: column;
      }
      .body-area {
        display: flex;
        flex: 1;
        gap: 32px;
      }
      ul {
        flex: 1;
        list-style: var(--dp-bullet-style, disc);
        padding-left: 24px;
        margin: 0;
      }
      li {
        margin-bottom: 10px;
      }
      li a { color: var(--dp-accent, #7c3aed); text-decoration: underline; }
      li code { background: #f1f5f9; padding: 1px 4px; border-radius: 3px; font-size: 0.9em; }
      .image-area {
        flex: 0 0 40%;
        display: flex;
        align-items: center;
        justify-content: center;
      }
    `,
  ];

  @property() title = '';
  @property({ type: Array }) bullets: BulletItem[] = [];
  @property({ attribute: 'image-url' }) imageUrl = '';
  @property({ type: Object }) imageFocus: { x: number; y: number } | null = null;
  @property({ attribute: 'image-prompt' }) imagePrompt = '';
  @property({ attribute: 'key-takeaway' }) keyTakeaway = '';
  @property({ type: Boolean }) editable = false;

  render() {
    const hasImage = !!this.imageUrl || !!this.imagePrompt;
    const allSources = this.collectSources(this.bullets);
    return html`
      <div class="slide ${hasImage ? 'with-image' : ''}">
        ${this.editable ? this.wrapDeletable('title', html`
          <h1 contenteditable="true"
            @blur=${(e: FocusEvent) => this.emitChange('title', (e.target as HTMLElement).textContent)}
          >${this.title}</h1>
        `) : html`<h1>${this.title}</h1>`}
        ${this.renderKeyTakeaway(this.keyTakeaway, this.editable)}
        <div class="body-area">
          ${this.editable ? this.wrapDeletable('bullets', html`
            <ul>
              ${this.bullets.map((b, i) => html`
                <li contenteditable="true"
                  @blur=${(e: FocusEvent) => {
                    const newBullets = [...this.bullets];
                    const orig = normalizeBullet(this.bullets[i]);
                    const newText = (e.target as HTMLElement).textContent || '';
                    newBullets[i] = orig.detail || orig.sources ? { ...orig, text: newText } : newText;
                    this.emitChange('bullets', newBullets);
                  }}
                >${normalizeBullet(b).text}</li>
              `)}
            </ul>
          `, []) : html`
            ${this.renderBulletList(this.bullets)}
          `}
          ${this.imageUrl
            ? this.editable
              ? this.wrapDeletable('image_url', html`
                  <div class="image-area"><img src="${this.imageUrl}" alt="" style="object-position:${focalPointToObjectPosition(this.imageFocus)}" @error=${this.onImgError} /></div>
                `, null)
              : html`<div class="image-area"><img src="${this.imageUrl}" alt="" style="object-position:${focalPointToObjectPosition(this.imageFocus)}" @error=${this.onImgError} /></div>`
            : this.imagePrompt
              ? html`<div class="image-area">${this.renderImagePrompt(this.imagePrompt)}</div>`
              : ''}
        </div>
        ${this.editable ? '' : this.renderFootnotes(allSources)}
      </div>
    `;
  }
}
