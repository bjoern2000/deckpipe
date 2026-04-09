import { html, css, nothing } from 'lit';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { customElement, property } from 'lit/decorators.js';
import { SlideBase } from './slide-base.js';
import { mdInline } from '../utils/markdown.js';
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import python from 'highlight.js/lib/languages/python';
import css_ from 'highlight.js/lib/languages/css';
import xml from 'highlight.js/lib/languages/xml';
import json from 'highlight.js/lib/languages/json';
import bash from 'highlight.js/lib/languages/bash';
import sql from 'highlight.js/lib/languages/sql';
import go from 'highlight.js/lib/languages/go';
import rust from 'highlight.js/lib/languages/rust';
import java from 'highlight.js/lib/languages/java';
import csharp from 'highlight.js/lib/languages/csharp';
import ruby from 'highlight.js/lib/languages/ruby';
import php from 'highlight.js/lib/languages/php';
import swift from 'highlight.js/lib/languages/swift';
import kotlin from 'highlight.js/lib/languages/kotlin';
import yaml from 'highlight.js/lib/languages/yaml';
import markdown from 'highlight.js/lib/languages/markdown';

hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('js', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('ts', typescript);
hljs.registerLanguage('python', python);
hljs.registerLanguage('css', css_);
hljs.registerLanguage('html', xml);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('json', json);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('shell', bash);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('go', go);
hljs.registerLanguage('rust', rust);
hljs.registerLanguage('java', java);
hljs.registerLanguage('csharp', csharp);
hljs.registerLanguage('ruby', ruby);
hljs.registerLanguage('php', php);
hljs.registerLanguage('swift', swift);
hljs.registerLanguage('kotlin', kotlin);
hljs.registerLanguage('yaml', yaml);
hljs.registerLanguage('markdown', markdown);

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
      /* highlight.js token colors (matches dark bg) */
      .hljs-keyword, .hljs-selector-tag, .hljs-built_in { color: #c084fc; }
      .hljs-string, .hljs-attr { color: #86efac; }
      .hljs-number, .hljs-literal { color: #fbbf24; }
      .hljs-function .hljs-title, .hljs-title.function_ { color: #60a5fa; }
      .hljs-comment, .hljs-quote { color: #64748b; font-style: italic; }
      .hljs-params { color: #e2e8f0; }
      .hljs-type, .hljs-class .hljs-title { color: #38bdf8; }
      .hljs-property { color: #7dd3fc; }
      .hljs-meta { color: #94a3b8; }
      .hljs-punctuation { color: #94a3b8; }
      .hljs-operator { color: #f472b6; }
      .hljs-variable { color: #e2e8f0; }
      .hljs-regexp { color: #fb923c; }
      .hljs-attribute { color: #fbbf24; }
      .hljs-name, .hljs-tag { color: #f87171; }
      .hljs-selector-class, .hljs-selector-id { color: #86efac; }
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

  private highlight(code: string, language: string) {
    const lang = language.toLowerCase();
    if (lang && hljs.getLanguage(lang)) {
      return unsafeHTML(hljs.highlight(code, { language: lang }).value);
    }
    return unsafeHTML(hljs.highlightAuto(code).value);
  }

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
        <div class="code-container">
          <div class="code-header">
            <div class="window-dots"><span></span><span></span><span></span></div>
            ${this.language ? html`<span class="lang-badge">${this.language}</span>` : nothing}
          </div>
          <div class="code-body">
            ${this.editable
              ? html`<pre data-content-path="code" contenteditable="true" @blur=${(e: FocusEvent) => this.emitChange('code', (e.target as HTMLElement).textContent)}>${this.code}</pre>`
              : html`<pre data-content-path="code">${this.highlight(this.code, this.language)}</pre>`}
          </div>
        </div>
        ${this.caption
          ? this.editable
            ? this.wrapDeletable('caption', html`
                <p class="caption" data-content-path="caption" contenteditable="true"
                  @blur=${(e: FocusEvent) => this.emitChange('caption', (e.target as HTMLElement).textContent)}
                >${this.caption}</p>
              `)
            : html`<p class="caption" data-content-path="caption">${mdInline(this.caption)}</p>`
          : nothing}
      </div>
    `;
  }
}
