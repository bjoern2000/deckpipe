import { html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { SlideBase } from './slide-base.js';
import { mdInline, md } from '../utils/markdown.js';

@customElement('slide-callout')
export class SlideCallout extends SlideBase {
  static styles = [
    SlideBase.baseStyles,
    css`
      .callout-content {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
      }
      .value {
        font-family: var(--dp-font-heading, 'DM Sans', sans-serif);
        font-size: 4em;
        font-weight: 800;
        color: var(--dp-text-title, var(--dp-accent, #7c3aed));
        line-height: 1.1;
        margin: 8px 0;
      }
      .label {
        font-size: 1em;
        font-weight: 600;
        color: var(--dp-accent, #7c3aed);
        text-transform: uppercase;
        letter-spacing: 0.05em;
        margin-bottom: 4px;
      }
      .body {
        font-size: 1.1em;
        color: var(--dp-text-body, #64748b);
        margin-top: 16px;
        max-width: 600px;
      }
      .body p { margin: 0 0 0.5em 0; }
      .body p:last-child { margin-bottom: 0; }
      .body a { color: var(--dp-accent, #7c3aed); text-decoration: underline; }
    `,
  ];

  @property() title = '';
  @property() value = '';
  @property() label = '';
  @property() body = '';
  @property({ attribute: 'key-takeaway' }) keyTakeaway = '';
  @property({ type: Boolean }) editable = false;

  render() {
    return html`
      <div class="slide" data-content-path="slide">
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
        <div class="callout-content">
          ${this.label
            ? this.editable
              ? this.wrapDeletable('label', html`
                  <div class="label" data-content-path="label" contenteditable="true"
                    @blur=${(e: FocusEvent) => this.emitChange('label', (e.target as HTMLElement).textContent)}
                  >${this.label}</div>
                `)
              : html`<div class="label" data-content-path="label">${this.label}</div>`
            : nothing}
          ${this.editable
            ? this.wrapDeletable('value', html`
                <div class="value" data-content-path="value" contenteditable="true"
                  @blur=${(e: FocusEvent) => this.emitChange('value', (e.target as HTMLElement).textContent)}
                >${this.value}</div>
              `)
            : html`<div class="value" data-content-path="value">${this.value}</div>`}
          ${this.body
            ? this.editable
              ? this.wrapDeletable('body', html`
                  <div class="body" data-content-path="body" contenteditable="true"
                    @blur=${(e: FocusEvent) => this.emitChange('body', (e.target as HTMLElement).textContent)}
                  >${this.body}</div>
                `)
              : html`<div class="body" data-content-path="body">${md(this.body)}</div>`
            : nothing}
        </div>
      </div>
    `;
  }
}
