import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

@customElement('viewer-toolbar')
export class ViewerToolbar extends LitElement {
  static styles = css`
    :host {
      display: flex;
      align-items: center;
      gap: 8px;
      font-family: "Space Mono", monospace;
    }

    .actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    button {
      font-family: "Space Mono", monospace;
      background: none;
      border: 1px solid #ddd;
      border-radius: 6px;
      padding: 6px 12px;
      font-size: 13px;
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
      font-size: 12px;
      color: #999;
      min-width: 50px;
    }

    .share-feedback {
      font-size: 12px;
      color: #22c55e;
    }
  `;

  @property() title = '';
  @property({ type: Boolean }) editMode = false;
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
        <button @click=${this.onShare} title="Copy share link">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
          Share
        </button>
        ${this.canEdit ? html`
          <button
            class="${this.editMode ? 'active' : ''}"
            @click=${() => this.dispatchEvent(new CustomEvent('toggle-edit', { bubbles: true, composed: true }))}
            title="Toggle edit mode"
          >${this.editMode ? 'Editing' : 'Edit'}</button>
        ` : ''}
      </div>
    `;
  }
}
