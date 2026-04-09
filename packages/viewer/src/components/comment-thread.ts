import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { Comment } from '../utils/comment-api.js';
import { getAuthorName, setAuthorName } from '../utils/author-cookie.js';

@customElement('comment-thread')
export class CommentThread extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .popover {
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.18), 0 0 0 1px rgba(0, 0, 0, 0.05);
      width: 300px;
      max-height: 400px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      font-family: 'DM Sans', system-ui, sans-serif;
    }

    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      cursor: grab;
      padding: 10px 14px;
      border-bottom: 1px solid #f1f5f9;
      font-size: 12px;
      font-weight: 600;
      color: #64748b;
    }

    .header-actions {
      display: flex;
      gap: 6px;
    }

    .header-btn {
      background: none;
      border: none;
      cursor: pointer;
      font-size: 11px;
      font-weight: 600;
      padding: 3px 8px;
      border-radius: 4px;
      transition: background 0.15s;
      font-family: inherit;
    }

    .resolve-btn {
      color: #22c55e;
    }

    .resolve-btn:hover {
      background: #f0fdf4;
    }

    .reopen-btn {
      color: #f59e0b;
    }

    .reopen-btn:hover {
      background: #fffbeb;
    }

    .close-btn {
      color: #94a3b8;
    }

    .close-btn:hover {
      background: #f1f5f9;
    }

    .messages {
      overflow-y: auto;
      max-height: 250px;
      padding: 8px 0;
    }

    .message {
      padding: 6px 14px;
    }

    .message-author {
      font-size: 12px;
      font-weight: 600;
      color: #1e293b;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .agent-badge {
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      background: #ede9fe;
      color: #7c3aed;
      padding: 1px 5px;
      border-radius: 3px;
    }

    .message-body {
      font-size: 13px;
      color: #475569;
      line-height: 1.5;
      margin: 2px 0 0 0;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .message-time {
      font-size: 10px;
      color: #94a3b8;
      margin-top: 2px;
    }

    .reply-area {
      border-top: 1px solid #f1f5f9;
      padding: 10px 14px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .name-input, .reply-input {
      font-family: inherit;
      font-size: 13px;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 8px 10px;
      resize: none;
      outline: none;
      transition: border-color 0.15s;
    }

    .name-input:focus, .reply-input:focus {
      border-color: #7c3aed;
    }

    .reply-input {
      min-height: 36px;
      max-height: 200px;
      resize: vertical;
    }

    .send-btn {
      align-self: flex-end;
      background: #7c3aed;
      color: #fff;
      border: none;
      border-radius: 6px;
      padding: 6px 14px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
      transition: background 0.15s;
    }

    .send-btn:hover {
      background: #6d28d9;
    }

    .send-btn:disabled {
      background: #cbd5e1;
      cursor: not-allowed;
    }

    .resolved-banner {
      background: #f0fdf4;
      color: #16a34a;
      font-size: 11px;
      font-weight: 600;
      text-align: center;
      padding: 6px;
    }
  `;

  @property({ attribute: false }) comment: Comment | null = null;
  @property() contentPath = '';
  @state() private replyText = '';
  @state() private authorName = getAuthorName() ?? '';
  @state() private needsName = !getAuthorName();

  private formatTime(iso: string): string {
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  private submit() {
    const body = this.replyText.trim();
    const name = this.authorName.trim();
    if (!body || !name) return;

    if (this.needsName) {
      setAuthorName(name);
      this.needsName = false;
    }

    if (this.comment) {
      this.dispatchEvent(new CustomEvent('reply-added', {
        detail: { comment_id: this.comment.id, body, author_name: name },
        bubbles: true, composed: true,
      }));
    } else {
      this.dispatchEvent(new CustomEvent('comment-created', {
        detail: { content_path: this.contentPath, body, author_name: name },
        bubbles: true, composed: true,
      }));
    }
    this.replyText = '';
  }

  private resolve() {
    if (!this.comment) return;
    this.dispatchEvent(new CustomEvent('comment-status-changed', {
      detail: { comment_id: this.comment.id, status: 'resolved' },
      bubbles: true, composed: true,
    }));
  }

  private reopen() {
    if (!this.comment) return;
    this.dispatchEvent(new CustomEvent('comment-status-changed', {
      detail: { comment_id: this.comment.id, status: 'open' },
      bubbles: true, composed: true,
    }));
  }

  private close() {
    this.dispatchEvent(new CustomEvent('popover-close', { bubbles: true, composed: true }));
  }

  private onHeaderMouseDown(e: MouseEvent) {
    // Don't drag when clicking buttons
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    this.dispatchEvent(new CustomEvent('drag-start', {
      detail: { clientX: e.clientX, clientY: e.clientY },
      bubbles: true, composed: true,
    }));
  }

  private onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      this.submit();
    }
  }

  render() {
    const isNew = !this.comment;
    const isResolved = this.comment?.status === 'resolved';

    return html`
      <div class="popover" @click=${(e: Event) => e.stopPropagation()}>
        <div class="header" @mousedown=${this.onHeaderMouseDown}
          <span>${isNew ? 'New comment' : `${this.comment!.messages.length} message${this.comment!.messages.length !== 1 ? 's' : ''}`}</span>
          <div class="header-actions">
            ${this.comment && !isResolved ? html`
              <button class="header-btn resolve-btn" @click=${this.resolve}>Resolve</button>
            ` : nothing}
            ${isResolved ? html`
              <button class="header-btn reopen-btn" @click=${this.reopen}>Reopen</button>
            ` : nothing}
            <button class="header-btn close-btn" @click=${this.close}>✕</button>
          </div>
        </div>
        ${isResolved ? html`<div class="resolved-banner">Resolved</div>` : nothing}
        ${!isNew ? html`
          <div class="messages">
            ${this.comment!.messages.map(msg => html`
              <div class="message">
                <div class="message-author">
                  ${msg.author_name}
                  ${msg.author_type === 'agent' ? html`<span class="agent-badge">Agent</span>` : nothing}
                </div>
                <div class="message-body">${msg.body}</div>
                <div class="message-time">${this.formatTime(msg.created_at)}</div>
              </div>
            `)}
          </div>
        ` : nothing}
        <div class="reply-area">
          ${this.needsName ? html`
            <input class="name-input"
              placeholder="Your name"
              .value=${this.authorName}
              @input=${(e: InputEvent) => { this.authorName = (e.target as HTMLInputElement).value; }}
            />
          ` : nothing}
          <textarea class="reply-input"
            placeholder="${isNew ? 'Add a comment...' : 'Reply...'}"
            .value=${this.replyText}
            @input=${(e: InputEvent) => { this.replyText = (e.target as HTMLTextAreaElement).value; }}
            @keydown=${this.onKeyDown}
          ></textarea>
          <button class="send-btn"
            ?disabled=${!this.replyText.trim() || !this.authorName.trim()}
            @click=${this.submit}
          >${isNew ? 'Comment' : 'Reply'}</button>
        </div>
      </div>
    `;
  }
}
