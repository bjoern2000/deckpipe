import { html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { SlideBase } from './slide-base.js';
import { mdInline } from '../utils/markdown.js';
import { focalPointToObjectPosition } from '../utils/focal-point.js';

@customElement('slide-comparison')
export class SlideComparison extends SlideBase {
  static styles = [
    SlideBase.baseStyles,
    css`
      .columns {
        display: flex;
        gap: 0;
        flex: 1;
        position: relative;
      }
      .side {
        flex: 1;
        padding: 0 24px;
      }
      .side:first-child {
        padding-left: 0;
      }
      .side:last-child {
        padding-right: 0;
      }
      .divider {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        width: 48px;
        flex-shrink: 0;
      }
      .divider::before,
      .divider::after {
        content: '';
        flex: 1;
        width: 2px;
        background: var(--dp-accent, #7c3aed);
        opacity: 0.2;
      }
      .vs-badge {
        font-family: var(--dp-font-heading, 'DM Sans', sans-serif);
        font-size: 0.7em;
        font-weight: 700;
        color: #fff;
        background: var(--dp-accent, #7c3aed);
        width: 32px;
        height: 32px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        margin: 8px 0;
      }
      .side h2 {
        margin-bottom: 12px;
      }
      .side ul {
        list-style: var(--dp-bullet-style, disc);
        padding-left: 24px;
        margin: 0;
      }
      .side li {
        margin-bottom: 8px;
      }
      .side li a { color: var(--dp-accent, #7c3aed); text-decoration: underline; }
      .side img {
        margin-top: 12px;
        max-height: 150px;
      }
      .verdict {
        background: var(--dp-accent, #7c3aed);
        color: #fff;
        padding: 12px 24px;
        border-radius: 8px;
        text-align: center;
        font-family: var(--dp-font-heading, 'DM Sans', sans-serif);
        font-weight: 600;
        font-size: 0.95em;
        margin-top: 16px;
      }
    `,
  ];

  @property() title = '';
  @property({ type: Object }) left: { heading: string; bullets: string[]; image_url?: string; image_focus?: { x: number; y: number } } = { heading: '', bullets: [] };
  @property({ type: Object }) right: { heading: string; bullets: string[]; image_url?: string; image_focus?: { x: number; y: number } } = { heading: '', bullets: [] };
  @property() verdict = '';
  @property({ attribute: 'key-takeaway' }) keyTakeaway = '';
  @property({ type: Boolean }) editable = false;

  private _renderSide(side: 'left' | 'right') {
    const data = this[side];
    if (this.editable) {
      return this.wrapDeletable(side, html`
        <div class="side">
          <h2 contenteditable="true"
            @blur=${(e: FocusEvent) => this.emitChange(side, { ...data, heading: (e.target as HTMLElement).textContent || '' })}
          >${data.heading}</h2>
          <ul>
            ${data.bullets.map((b, i) => html`
              <li contenteditable="true"
                @blur=${(e: FocusEvent) => {
                  const newBullets = [...data.bullets];
                  newBullets[i] = (e.target as HTMLElement).textContent || '';
                  this.emitChange(side, { ...data, bullets: newBullets });
                }}
              >${b}</li>
            `)}
          </ul>
          ${data.image_url ? html`<img src="${data.image_url}" alt="" style="object-position:${focalPointToObjectPosition(data.image_focus || null)}" @error=${this.onImgError} />` : nothing}
        </div>
      `, null);
    }
    return html`
      <div class="side">
        <h2>${data.heading}</h2>
        <ul>${data.bullets.map(b => html`<li>${mdInline(b)}</li>`)}</ul>
        ${data.image_url ? html`<img src="${data.image_url}" alt="" style="object-position:${focalPointToObjectPosition(data.image_focus || null)}" @error=${this.onImgError} />` : nothing}
      </div>
    `;
  }

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
        <div class="columns">
          ${this._renderSide('left')}
          <div class="divider"><span class="vs-badge">VS</span></div>
          ${this._renderSide('right')}
        </div>
        ${this.verdict
          ? this.editable
            ? this.wrapDeletable('verdict', html`
                <div class="verdict" contenteditable="true"
                  @blur=${(e: FocusEvent) => this.emitChange('verdict', (e.target as HTMLElement).textContent)}
                >${this.verdict}</div>
              `)
            : html`<div class="verdict">${mdInline(this.verdict)}</div>`
          : nothing}
      </div>
    `;
  }
}
