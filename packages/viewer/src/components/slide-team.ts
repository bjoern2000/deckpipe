import { html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { SlideBase } from './slide-base.js';
import { focalPointToObjectPosition } from '../utils/focal-point.js';

@customElement('slide-team')
export class SlideTeam extends SlideBase {
  static styles = [
    SlideBase.baseStyles,
    css`
      .grid {
        display: grid;
        grid-template-columns: repeat(var(--col-count, 3), 1fr);
        gap: 32px;
        flex: 1;
        align-content: center;
      }
      .member {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
      }
      .avatar {
        width: 80px;
        height: 80px;
        border-radius: 50%;
        object-fit: cover;
        margin-bottom: 12px;
        background: color-mix(in srgb, var(--dp-accent, #7c3aed) 12%, transparent);
      }
      .initials {
        width: 80px;
        height: 80px;
        border-radius: 50%;
        background: color-mix(in srgb, var(--dp-accent, #7c3aed) 12%, transparent);
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: var(--dp-font-heading, 'DM Sans', sans-serif);
        font-size: 1.4em;
        font-weight: 700;
        color: var(--dp-accent, #7c3aed);
        margin-bottom: 12px;
      }
      .name {
        font-family: var(--dp-font-heading, 'DM Sans', sans-serif);
        font-size: 0.95em;
        font-weight: 600;
        color: var(--dp-text-title, #0f172a);
      }
      .role {
        font-size: 0.8em;
        color: var(--dp-accent, #7c3aed);
        margin-top: 2px;
      }
      .bio {
        font-size: 0.75em;
        color: var(--dp-text-body, #64748b);
        margin-top: 6px;
      }
    `,
  ];

  @property() title = '';
  @property({ type: Array }) members: Array<{ name: string; role: string; bio?: string; image_url?: string; image_focus?: { x: number; y: number } }> = [];
  @property({ attribute: 'key-takeaway' }) keyTakeaway = '';
  @property({ type: Boolean }) editable = false;

  private _getInitials(name: string): string {
    return name.split(/\s+/).map(w => w[0] || '').slice(0, 2).join('').toUpperCase();
  }

  private _colCount(): number {
    const len = this.members.length;
    if (len <= 2) return len;
    if (len <= 3) return 3;
    if (len === 4) return 2;
    return 3;
  }

  render() {
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
        ${this.editable ? this.wrapDeletable('members', html`
          <div class="grid" style="--col-count:${this._colCount()}">
            ${this.members.map((m, i) => html`
              <div class="member">
                ${m.image_url
                  ? html`<img class="avatar" src="${m.image_url}" alt="" style="object-position:${focalPointToObjectPosition(m.image_focus || null)}" @error=${this.onImgError} />`
                  : html`<div class="initials">${this._getInitials(m.name)}</div>`}
                <div class="name" contenteditable="true"
                  @blur=${(e: FocusEvent) => {
                    const newMembers = this.members.map((mem, idx) =>
                      idx === i ? { ...mem, name: (e.target as HTMLElement).textContent || '' } : mem
                    );
                    this.emitChange('members', newMembers);
                  }}
                >${m.name}</div>
                <div class="role" contenteditable="true"
                  @blur=${(e: FocusEvent) => {
                    const newMembers = this.members.map((mem, idx) =>
                      idx === i ? { ...mem, role: (e.target as HTMLElement).textContent || '' } : mem
                    );
                    this.emitChange('members', newMembers);
                  }}
                >${m.role}</div>
                ${m.bio ? html`
                  <div class="bio" contenteditable="true"
                    @blur=${(e: FocusEvent) => {
                      const newMembers = this.members.map((mem, idx) =>
                        idx === i ? { ...mem, bio: (e.target as HTMLElement).textContent || '' } : mem
                      );
                      this.emitChange('members', newMembers);
                    }}
                  >${m.bio}</div>
                ` : nothing}
              </div>
            `)}
          </div>
        `, []) : html`
          <div class="grid" style="--col-count:${this._colCount()}">
            ${this.members.map(m => html`
              <div class="member">
                ${m.image_url
                  ? html`<img class="avatar" src="${m.image_url}" alt="" style="object-position:${focalPointToObjectPosition(m.image_focus || null)}" @error=${this.onImgError} />`
                  : html`<div class="initials">${this._getInitials(m.name)}</div>`}
                <div class="name">${m.name}</div>
                <div class="role">${m.role}</div>
                ${m.bio ? html`<div class="bio">${m.bio}</div>` : nothing}
              </div>
            `)}
          </div>
        `}
      </div>
    `;
  }
}
