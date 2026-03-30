import { html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { SlideBase } from './slide-base.js';

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
      .image-area {
        flex: 0 0 40%;
        display: flex;
        align-items: center;
        justify-content: center;
      }
    `,
  ];

  @property() title = '';
  @property({ type: Array }) bullets: string[] = [];
  @property({ attribute: 'image-url' }) imageUrl = '';
  @property({ attribute: 'key-takeaway' }) keyTakeaway = '';
  @property({ type: Boolean }) editable = false;

  render() {
    const hasImage = !!this.imageUrl;
    return html`
      <div class="slide ${hasImage ? 'with-image' : ''}">
        <h1
          ?contenteditable=${this.editable}
          @blur=${(e: FocusEvent) => this.emitChange('title', (e.target as HTMLElement).textContent)}
        >${this.title}</h1>
        ${this.renderKeyTakeaway(this.keyTakeaway)}
        <div class="body-area">
          <ul>
            ${this.bullets.map((b, i) => html`
              <li
                ?contenteditable=${this.editable}
                @blur=${(e: FocusEvent) => {
                  const newBullets = [...this.bullets];
                  newBullets[i] = (e.target as HTMLElement).textContent || '';
                  this.emitChange('bullets', newBullets);
                }}
              >${b}</li>
            `)}
          </ul>
          ${hasImage ? html`
            <div class="image-area">
              <img src="${this.imageUrl}" alt="" />
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }
}
