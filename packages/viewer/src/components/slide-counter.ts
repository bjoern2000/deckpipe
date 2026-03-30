import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('slide-counter')
export class SlideCounter extends LitElement {
  static styles = css`
    :host {
      font-family: "Space Mono", monospace;
      font-size: 13px;
      color: #999;
    }
  `;

  @property({ type: Number }) current = 1;
  @property({ type: Number }) total = 1;

  render() {
    return html`${this.current} / ${this.total}`;
  }
}
