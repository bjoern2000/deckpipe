import { html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { SlideBase } from './slide-base.js';
import { mdInline } from '../utils/markdown.js';

@customElement('slide-code')
export class SlideCode extends SlideBase {
  static styles = [
    SlideBase.baseStyles,
    css`
      .code-container {
        flex: 1;
        background: #1e293b;
        border-radius: 12px;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        min-height: 0;
      }
      .code-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 16px;
        background: #0f172a;
      }
      .window-dots {
        display: flex;
        gap: 6px;
      }
      .window-dots span {
        width: 10px;
        height: 10px;
        border-radius: 50%;
      }
      .window-dots span:nth-child(1) { background: #ef4444; }
      .window-dots span:nth-child(2) { background: #eab308; }
      .window-dots span:nth-child(3) { background: #22c55e; }
      .lang-badge {
        font-family: 'SF Mono', 'Fira Code', 'Fira Mono', Menlo, monospace;
        font-size: 0.65em;
        color: #94a3b8;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      .code-body {
        padding: 20px 24px;
        overflow: auto;
        flex: 1;
        min-height: 0;
      }
      pre {
        margin: 0;
        font-family: 'SF Mono', 'Fira Code', 'Fira Mono', Menlo, monospace;
        font-size: 0.8em;
        line-height: 1.6;
        color: #e2e8f0;
        white-space: pre;
        tab-size: 2;
      }
      .caption {
        font-size: 0.85em;
        color: var(--dp-text-body, #64748b);
        margin-top: 12px;
      }
    `,
  ];

  @property() title = '';
  @property() code = '';
  @property() language = '';
  @property() caption = '';
  @property({ attribute: 'key-takeaway' }) keyTakeaway = '';
  @property({ type: Boolean }) editable = false;

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
        <div class="code-container">
          <div class="code-header">
            <div class="window-dots"><span></span><span></span><span></span></div>
            ${this.language ? html`<span class="lang-badge">${this.language}</span>` : nothing}
          </div>
          <div class="code-body">
            ${this.editable
              ? html`<pre contenteditable="true" @blur=${(e: FocusEvent) => this.emitChange('code', (e.target as HTMLElement).textContent)}>${this.code}</pre>`
              : html`<pre>${this.code}</pre>`}
          </div>
        </div>
        ${this.caption
          ? this.editable
            ? this.wrapDeletable('caption', html`
                <p class="caption" contenteditable="true"
                  @blur=${(e: FocusEvent) => this.emitChange('caption', (e.target as HTMLElement).textContent)}
                >${this.caption}</p>
              `)
            : html`<p class="caption">${mdInline(this.caption)}</p>`
          : nothing}
      </div>
    `;
  }
}
