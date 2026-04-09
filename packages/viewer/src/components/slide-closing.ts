import { html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { SlideBase } from './slide-base.js';
import { mdInline } from '../utils/markdown.js';
import { focalPointToObjectPosition } from '../utils/focal-point.js';

@customElement('slide-closing')
export class SlideClosing extends SlideBase {
  static styles = [
    SlideBase.baseStyles,
    css`
      .slide {
        align-items: center;
        justify-content: center;
        text-align: center;
        background: var(--dp-accent, #7c3aed);
      }
      .bg-image {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        opacity: 0.12;
        z-index: 0;
      }
      .content {
        position: relative;
        z-index: 1;
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        width: 100%;
      }
      .spacer { flex: 1; }
      .heading {
        font-family: var(--dp-font-heading, 'DM Sans', sans-serif);
        font-size: 3em;
        font-weight: 800;
        color: #ffffff;
        margin: 0;
      }
      .subheading {
        font-size: 1.2em;
        color: rgba(255, 255, 255, 0.8);
        margin-top: 12px;
      }
      .contact-lines {
        list-style: none;
        padding: 0;
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .contact-lines li {
        font-size: 0.9em;
        color: rgba(255, 255, 255, 0.7);
      }
      .contact-lines li a {
        color: #ffffff;
        text-decoration: underline;
      }
    `,
  ];

  @property() heading = '';
  @property() subheading = '';
  @property({ type: Array }) contactLines: string[] = [];
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
          : nothing}
        <div class="content">
          <div class="spacer"></div>
          ${this.heading || this.editable
            ? this.editable
              ? this.wrapDeletable('heading', html`
                  <h1 class="heading" data-content-path="heading" contenteditable="true"
                    @blur=${(e: FocusEvent) => this.emitChange('heading', (e.target as HTMLElement).textContent)}
                  >${this.heading || 'Thank You'}</h1>
                `)
              : html`<h1 class="heading" data-content-path="heading">${this.heading}</h1>`
            : nothing}
          ${this.renderKeyTakeaway(this.keyTakeaway, this.editable)}
          ${this.subheading || this.editable
            ? this.editable
              ? this.wrapDeletable('subheading', html`
                  <p class="subheading" data-content-path="subheading" contenteditable="true"
                    @blur=${(e: FocusEvent) => this.emitChange('subheading', (e.target as HTMLElement).textContent)}
                  >${this.subheading}</p>
                `)
              : html`<p class="subheading" data-content-path="subheading">${mdInline(this.subheading)}</p>`
            : nothing}
          <div class="spacer"></div>
          ${this.contactLines.length
            ? this.editable
              ? this.wrapDeletable('contact_lines', html`
                  <ul class="contact-lines">
                    ${this.contactLines.map((line, i) => html`
                      <li data-content-path="contact_lines[${i}]" contenteditable="true"
                        @blur=${(e: FocusEvent) => {
                          const newLines = [...this.contactLines];
                          newLines[i] = (e.target as HTMLElement).textContent || '';
                          this.emitChange('contact_lines', newLines);
                        }}
                      >${line}</li>
                    `)}
                  </ul>
                `, [])
              : html`
                <ul class="contact-lines">
                  ${this.contactLines.map((line, i) => html`<li data-content-path="contact_lines[${i}]">${mdInline(line)}</li>`)}
                </ul>
              `
            : nothing}
        </div>
      </div>
    `;
  }
}
