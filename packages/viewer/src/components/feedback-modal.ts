import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { lucideIcon } from '../utils/lucide.js';

const FEEDBACK_TO = 'bjoern.schefzyk@gmail.com';
const FEEDBACK_SUBJECT = 'deckpipe feedback';

export type FeedbackChannel = 'mailto' | 'gmail';

/**
 * Feedback modal: lets deck owners (edit-key holders) pick how to send
 * feedback — default mail client via mailto: or Gmail compose in a new tab.
 */
@customElement('feedback-modal')
export class FeedbackModal extends LitElement {
  static styles = css`
    :host {
      display: contents;
    }

    .backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.35);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      font-family: "Inconsolata", monospace;
    }

    .dialog {
      position: relative;
      background: #fff;
      border-radius: 12px;
      padding: 28px 28px 24px;
      width: min(440px, calc(100vw - 32px));
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.25);
      color: #333;
    }

    .close {
      position: absolute;
      top: 12px;
      right: 12px;
      background: none;
      border: none;
      padding: 6px;
      cursor: pointer;
      color: #999;
      border-radius: 6px;
      display: flex;
    }

    .close:hover {
      background: #f5f5f5;
      color: #555;
    }

    .close svg {
      width: 16px;
      height: 16px;
    }

    h2 {
      margin: 0 0 10px;
      font-size: 20px;
      font-weight: 700;
    }

    p {
      margin: 0 0 22px;
      font-size: 15px;
      line-height: 1.5;
      color: #555;
    }

    .options {
      display: flex;
      gap: 10px;
    }

    a.option {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 12px 14px;
      border: 1px solid #ddd;
      border-radius: 8px;
      font-family: "Inconsolata", monospace;
      font-size: 15px;
      font-weight: 700;
      color: #333;
      text-decoration: none;
      transition: all 0.15s;
    }

    a.option:hover {
      background: #f5f5f5;
      border-color: #bbb;
    }

    a.option.primary {
      background: var(--dp-accent, #2563eb);
      border-color: var(--dp-accent, #2563eb);
      color: #fff;
    }

    a.option.primary:hover {
      filter: brightness(1.08);
    }

    a.option svg {
      width: 16px;
      height: 16px;
    }

    .addr {
      margin: 16px 0 0;
      font-size: 13px;
      color: #999;
      text-align: center;
    }
  `;

  @property({ type: Boolean }) open = false;

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && this.open) {
      e.stopPropagation();
      this.close();
    }
  };

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener('keydown', this.onKeyDown, true);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('keydown', this.onKeyDown, true);
  }

  private close() {
    this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
  }

  private onPick(channel: FeedbackChannel) {
    this.dispatchEvent(new CustomEvent('feedback-pick', { detail: { channel }, bubbles: true, composed: true }));
    // Let the link's default navigation happen, then dismiss.
    setTimeout(() => this.close(), 0);
  }

  render() {
    if (!this.open) return null;

    const subject = encodeURIComponent(FEEDBACK_SUBJECT);
    const mailtoHref = `mailto:${FEEDBACK_TO}?subject=${subject}`;
    const gmailHref = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(FEEDBACK_TO)}&su=${subject}`;

    return html`
      <div class="backdrop" @click=${(e: MouseEvent) => { if (e.target === e.currentTarget) this.close(); }}>
        <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="feedback-title">
          <button class="close" @click=${this.close} title="Close" aria-label="Close">
            ${unsafeHTML(lucideIcon('x'))}
          </button>
          <h2 id="feedback-title">Send feedback</h2>
          <p>
            deckpipe.dev is built by an indie dev, and I appreciate any kind of feedback —
            bugs, ideas, rough edges, or just how it's working for you.
          </p>
          <div class="options">
            <a class="option primary" href=${mailtoHref} @click=${() => this.onPick('mailto')}>
              ${unsafeHTML(lucideIcon('mail'))} Email app
            </a>
            <a class="option" href=${gmailHref} target="_blank" rel="noopener" @click=${() => this.onPick('gmail')}>
              ${unsafeHTML(lucideIcon('send'))} Gmail
            </a>
          </div>
          <p class="addr">${FEEDBACK_TO}</p>
        </div>
      </div>
    `;
  }
}
