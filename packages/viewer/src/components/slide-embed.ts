import { html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { SlideBase } from './slide-base.js';
import { mdInline } from '../utils/markdown.js';

@customElement('slide-embed')
export class SlideEmbed extends SlideBase {
  static styles = [
    SlideBase.baseStyles,
    css`
      .slide {
        padding: 0;
        align-items: center;
        justify-content: center;
      }
      .embed-wrapper {
        width: 90%;
        height: 90%;
        display: flex;
        flex-direction: column;
      }
      .embed-container {
        width: 100%;
        flex: 1;
        position: relative;
        border-radius: 8px;
        overflow: hidden;
        background: #f1f5f9;
      }
      iframe {
        width: 100%;
        height: 100%;
        border: none;
      }
      .caption {
        font-size: 0.85em;
        color: var(--dp-text-body, #64748b);
        margin-top: 10px;
        text-align: center;
      }
      .print-placeholder {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 12px;
        background: #f1f5f9;
        border-radius: 8px;
        padding: 32px;
      }
      .print-placeholder .url {
        font-family: 'SF Mono', Menlo, monospace;
        font-size: 0.8em;
        color: var(--dp-accent, #7c3aed);
        word-break: break-all;
      }
      .print-placeholder .label {
        font-size: 0.9em;
        color: var(--dp-text-body, #64748b);
      }
    `,
  ];

  @property() title = '';
  @property() url = '';
  @property() caption = '';
  @property({ attribute: 'aspect-ratio' }) aspectRatio = '16:9';
  @property({ attribute: 'key-takeaway' }) keyTakeaway = '';
  @property({ type: Boolean }) editable = false;

  private _isPrint(): boolean {
    return new URLSearchParams(window.location.search).has('print');
  }

  private _ratioClass(): string {
    const map: Record<string, string> = { '16:9': 'ratio-16-9', '4:3': 'ratio-4-3', '1:1': 'ratio-1-1' };
    return map[this.aspectRatio] || 'ratio-16-9';
  }

  render() {
    return html`
      <div class="slide">
        ${this._isPrint()
          ? html`
            <div class="print-placeholder">
              <div class="label">Embedded content</div>
              <div class="url">${this.url}</div>
            </div>
          `
          : html`
            <div class="embed-wrapper">
              <div class="embed-container">
                <iframe src="${this.url}"
                  sandbox="allow-scripts allow-same-origin allow-popups"
                  loading="lazy"
                  allowfullscreen
                ></iframe>
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
          `}
      </div>
    `;
  }
}
