import { html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { SlideBase } from './slide-base.js';
import { mdInline } from '../utils/markdown.js';

interface TableData {
  headers: string[];
  rows: string[][];
  highlight_column?: number;
}

@customElement('slide-title-and-table')
export class SlideTitleAndTable extends SlideBase {
  static styles = [
    SlideBase.baseStyles,
    css`
      :host {
        --table-cell-padding-v: 7px;
        --table-cell-padding-h: 12px;
      }
      h1 {
        margin-bottom: 16px;
        font-size: 1.9em;
      }
      .key-takeaway {
        margin-bottom: 16px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 4px;
        font-size: 0.9em;
      }
      th {
        background: var(--dp-table-header-bg, #f1f5f9);
        font-weight: 600;
        text-align: left;
        padding: var(--table-cell-padding-v) var(--table-cell-padding-h);
        color: var(--dp-text-title, #1a1a1a);
        border-bottom: 2px solid var(--dp-accent, #2563eb);
      }
      td {
        padding: var(--table-cell-padding-v) var(--table-cell-padding-h);
        border-bottom: 1px solid #eee;
        line-height: 1.4;
      }
      tr:nth-child(even) td {
        background: var(--dp-table-stripe-bg, #f8fafc);
      }
      .highlight {
        background: var(--dp-table-highlight-bg, #dbeafe) !important;
        font-weight: 600;
      }
    `,
  ];

  @property() title = '';
  @property({ type: Object }) table: TableData = { headers: [], rows: [] };
  @property({ attribute: 'key-takeaway' }) keyTakeaway = '';
  @property({ type: Boolean }) editable = false;

  render() {
    const { headers, rows, highlight_column } = this.table;
    return html`
      <div class="slide" data-content-path="slide">
        ${this.editable ? this.wrapDeletable('title', html`
          <h1 data-content-path="title" contenteditable="true"
            @blur=${(e: FocusEvent) => this.emitChange('title', (e.target as HTMLElement).textContent)}
          >${this.title}</h1>
        `) : html`<h1 data-content-path="title">${this.title}</h1>`}
        ${this.renderKeyTakeaway(this.keyTakeaway, this.editable)}
        ${this.editable ? this.wrapDeletable('table', html`
          <table data-content-path="table">
            <thead>
              <tr>
                ${headers.map((h, ci) => html`
                  <th class="${ci === highlight_column ? 'highlight' : ''}"
                    contenteditable="true"
                    @blur=${(e: FocusEvent) => {
                      const newHeaders = [...headers];
                      newHeaders[ci] = (e.target as HTMLElement).textContent || '';
                      this.emitChange('table', { ...this.table, headers: newHeaders });
                    }}
                  >${h}</th>
                `)}
              </tr>
            </thead>
            <tbody>
              ${rows.map((row, ri) => html`
                <tr>
                  ${row.map((cell, ci) => html`
                    <td class="${ci === highlight_column ? 'highlight' : ''}"
                      contenteditable="true"
                      @blur=${(e: FocusEvent) => {
                        const newRows = rows.map(r => [...r]);
                        newRows[ri][ci] = (e.target as HTMLElement).textContent || '';
                        this.emitChange('table', { ...this.table, rows: newRows });
                      }}
                    >${cell}</td>
                  `)}
                </tr>
              `)}
            </tbody>
          </table>
        `, null) : html`
          <table data-content-path="table">
            <thead>
              <tr>${headers.map((h, ci) => html`<th class="${ci === highlight_column ? 'highlight' : ''}">${mdInline(h)}</th>`)}</tr>
            </thead>
            <tbody>
              ${rows.map(row => html`
                <tr>${row.map((cell, ci) => html`<td class="${ci === highlight_column ? 'highlight' : ''}">${mdInline(cell)}</td>`)}</tr>
              `)}
            </tbody>
          </table>
        `}
      </div>
    `;
  }
}
