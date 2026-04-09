import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { lucideIcon } from '../utils/lucide.js';

@customElement('viewer-toolbar')
export class ViewerToolbar extends LitElement {
  static styles = css`
    :host {
      display: flex;
      align-items: center;
      gap: 8px;
      font-family: "Inconsolata", monospace;
    }

    .actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    button {
      font-family: "Inconsolata", monospace;
      font-weight: 700;
      background: none;
      border: 1px solid #ddd;
      border-radius: 6px;
      padding: 6px 8px;
      font-size: 15px;
      cursor: pointer;
      color: #555;
      transition: all 0.15s;
      display: flex;
      align-items: center;
      gap: 5px;
    }

    button:hover {
      background: #f5f5f5;
      border-color: #bbb;
    }

    button.active {
      background: var(--dp-accent, #2563eb);
      color: white;
      border-color: var(--dp-accent, #2563eb);
    }

    button svg {
      width: 14px;
      height: 14px;
    }

    .save-indicator {
      font-size: 14px;
      color: #999;
      min-width: 50px;
    }

    .share-feedback {
      font-size: 14px;
      color: #22c55e;
    }

    .comment-btn-wrap {
      position: relative;
      display: flex;
    }

    .badge {
      position: absolute;
      top: -4px;
      right: -4px;
      background: #ef4444;
      color: #fff;
      font-size: 9px;
      font-weight: 700;
      min-width: 16px;
      height: 16px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0 3px;
      pointer-events: none;
      font-family: system-ui, sans-serif;
    }
  `;

  @property() title = '';
  @property({ type: Boolean }) editMode = false;
  @property({ type: Boolean }) commentMode = false;
  @property({ type: Number }) commentCount = 0;
  @property({ type: Boolean }) canEdit = false;
  @property() saveStatus: 'idle' | 'saving' | 'saved' = 'idle';
  @state() private shareConfirm = false;

  private onShare() {
    this.dispatchEvent(new CustomEvent('share-deck', { bubbles: true, composed: true }));
    this.shareConfirm = true;
    setTimeout(() => { this.shareConfirm = false; }, 2000);
  }

  render() {
    return html`
      <div class="actions">
        <span class="save-indicator">
          ${this.saveStatus === 'saving' ? 'Saving...' : this.saveStatus === 'saved' ? 'Saved' : ''}
        </span>
        ${this.shareConfirm ? html`<span class="share-feedback">Link copied</span>` : ''}
        <div class="comment-btn-wrap">
          <button
            class="${this.commentMode ? 'active' : ''}"
            @click=${() => this.dispatchEvent(new CustomEvent('toggle-comments', { bubbles: true, composed: true }))}
            title="Toggle comments"
          >${unsafeHTML(lucideIcon('message-square'))}
          </button>
          ${this.commentCount > 0 ? html`<span class="badge">${this.commentCount}</span>` : ''}
        </div>
        <button @click=${() => this.dispatchEvent(new CustomEvent('start-presentation', { bubbles: true, composed: true }))} title="Present fullscreen">
          ${unsafeHTML(lucideIcon('play'))}
        </button>
        <button @click=${this.onShare} title="Copy share link">
          ${unsafeHTML(lucideIcon('share'))}
        </button>
        ${this.canEdit ? html`
          <button
            class="${this.editMode ? 'active' : ''}"
            @click=${() => this.dispatchEvent(new CustomEvent('toggle-edit', { bubbles: true, composed: true }))}
            title="Toggle edit mode"
          >${unsafeHTML(lucideIcon('pencil'))}
          </button>
        ` : ''}
      </div>
    `;
  }
}
