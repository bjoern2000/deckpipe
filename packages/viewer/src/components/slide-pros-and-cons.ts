import { html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { SlideBase } from './slide-base.js';
import { mdInline } from '../utils/markdown.js';

@customElement('slide-pros-and-cons')
export class SlideProsAndCons extends SlideBase {
  static styles = [
    SlideBase.baseStyles,
    css`
      .columns {
        display: flex;
        gap: 32px;
        flex: 1;
      }
      .column {
        flex: 1;
      }
      .column-heading {
        font-family: var(--dp-font-heading, 'DM Sans', sans-serif);
        font-size: 1.1em;
        font-weight: 700;
        margin-bottom: 16px;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .column-heading.pros { color: #16a34a; }
      .column-heading.cons { color: #dc2626; }
      .column-heading .icon {
        width: 24px;
        height: 24px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.7em;
        font-weight: 700;
        color: #fff;
        flex-shrink: 0;
      }
      .column-heading.pros .icon { background: #16a34a; }
      .column-heading.cons .icon { background: #dc2626; }
      ul {
        list-style: none;
        padding: 0;
        margin: 0;
      }
      li {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        margin-bottom: 10px;
        font-size: 0.9em;
        color: var(--dp-text-body, #334155);
      }
      li a { color: var(--dp-accent, #7c3aed); text-decoration: underline; }
      .bullet-icon {
        flex-shrink: 0;
        margin-top: 2px;
        font-size: 0.85em;
      }
      .pros-col .bullet-icon { color: #16a34a; }
      .cons-col .bullet-icon { color: #dc2626; }
    `,
  ];

  @property() title = '';
  @property({ attribute: 'pros-heading' }) prosHeading = '';
  @property({ attribute: 'cons-heading' }) consHeading = '';
  @property({ type: Array }) pros: string[] = [];
  @property({ type: Array }) cons: string[] = [];
  @property({ attribute: 'key-takeaway' }) keyTakeaway = '';
  @property({ type: Boolean }) editable = false;

  render() {
    const prosLabel = this.prosHeading || 'Pros';
    const consLabel = this.consHeading || 'Cons';

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
          <div class="column pros-col">
            ${this.editable
              ? html`<div class="column-heading pros">
                  <span class="icon">&#10003;</span>
                  <span contenteditable="true"
                    @blur=${(e: FocusEvent) => this.emitChange('pros_heading', (e.target as HTMLElement).textContent)}
                  >${prosLabel}</span>
                </div>`
              : html`<div class="column-heading pros"><span class="icon">&#10003;</span>${prosLabel}</div>`}
            ${this.editable ? this.wrapDeletable('pros', html`
              <ul>
                ${this.pros.map((p, i) => html`
                  <li>
                    <span class="bullet-icon">&#10003;</span>
                    <span contenteditable="true"
                      @blur=${(e: FocusEvent) => {
                        const newPros = [...this.pros];
                        newPros[i] = (e.target as HTMLElement).textContent || '';
                        this.emitChange('pros', newPros);
                      }}
                    >${p}</span>
                  </li>
                `)}
              </ul>
            `, []) : html`
              <ul>
                ${this.pros.map(p => html`<li><span class="bullet-icon">&#10003;</span><span>${mdInline(p)}</span></li>`)}
              </ul>
            `}
          </div>
          <div class="column cons-col">
            ${this.editable
              ? html`<div class="column-heading cons">
                  <span class="icon">&#10007;</span>
                  <span contenteditable="true"
                    @blur=${(e: FocusEvent) => this.emitChange('cons_heading', (e.target as HTMLElement).textContent)}
                  >${consLabel}</span>
                </div>`
              : html`<div class="column-heading cons"><span class="icon">&#10007;</span>${consLabel}</div>`}
            ${this.editable ? this.wrapDeletable('cons', html`
              <ul>
                ${this.cons.map((c, i) => html`
                  <li>
                    <span class="bullet-icon">&#10007;</span>
                    <span contenteditable="true"
                      @blur=${(e: FocusEvent) => {
                        const newCons = [...this.cons];
                        newCons[i] = (e.target as HTMLElement).textContent || '';
                        this.emitChange('cons', newCons);
                      }}
                    >${c}</span>
                  </li>
                `)}
              </ul>
            `, []) : html`
              <ul>
                ${this.cons.map(c => html`<li><span class="bullet-icon">&#10007;</span><span>${mdInline(c)}</span></li>`)}
              </ul>
            `}
          </div>
        </div>
      </div>
    `;
  }
}
