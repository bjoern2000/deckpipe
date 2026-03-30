import { html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { SlideBase } from './slide-base.js';

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
      table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 8px;
        font-size: 0.95em;
      }
      th {
        background: var(--dp-table-header-bg, #f1f5f9);
        font-weight: 600;
        text-align: left;
        padding: 10px 14px;
        color: var(--dp-text-title, #1a1a1a);
        border-bottom: 2px solid var(--dp-accent, #2563eb);
      }
      td {
        padding: 9px 14px;
        border-bottom: 1px solid #eee;
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
      <div class="slide">
        <h1
          ?contenteditable=${this.editable}
          @blur=${(e: FocusEvent) => this.emitChange('title', (e.target as HTMLElement).textContent)}
        >${this.title}</h1>
        ${this.renderKeyTakeaway(this.keyTakeaway)}
        <table>
          <thead>
            <tr>
              ${headers.map((h, ci) => html`
                <th class="${ci === highlight_column ? 'highlight' : ''}"
                  ?contenteditable=${this.editable}
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
                    ?contenteditable=${this.editable}
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
      </div>
    `;
  }
}
