import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { Comment } from '../utils/comment-api.js';
import { SLIDE_WIDTH, SLIDE_HEIGHT } from '../constants.js';

interface PinPosition {
  top: number;
  right: number;
  commentId: string | null;
  contentPath: string;
  count: number;
}

@customElement('comment-layer')
export class CommentLayer extends LitElement {
  static styles = css`
    :host {
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 50;
    }

    :host([active]) {
      pointer-events: auto;
      cursor: crosshair;
    }

    .highlight {
      position: absolute;
      border: 2px solid rgba(124, 58, 237, 0.5);
      background: rgba(124, 58, 237, 0.06);
      border-radius: 4px;
      pointer-events: none;
      transition: all 0.15s ease;
    }

    .pin {
      position: absolute;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: #7c3aed;
      color: #fff;
      font-size: 11px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      pointer-events: auto;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
      transition: transform 0.15s;
      z-index: 60;
      font-family: 'DM Sans', system-ui, sans-serif;
    }

    .pin:hover {
      transform: scale(1.15);
    }

    .pin.resolved {
      background: #94a3b8;
    }
  `;

  @property() deckId = '';
  @property() slideId = '';
  @property({ attribute: false }) comments: Comment[] = [];
  @property({ type: Boolean, reflect: true, attribute: 'active' }) commentMode = false;
  @property({ type: Boolean }) showResolved = false;

  @state() private hoveredPath: string | null = null;
  @state() private highlightRect: { top: number; left: number; width: number; height: number } | null = null;

  private hoverTimeout: ReturnType<typeof setTimeout> | null = null;

  private findContentPathElements(): Map<string, Element> {
    const map = new Map<string, Element>();
    const slideRenderer = this.parentElement?.querySelector('slide-renderer');
    if (!slideRenderer?.shadowRoot) return map;

    const walkShadow = (root: ShadowRoot | Element) => {
      const els = root.querySelectorAll('[data-content-path]');
      els.forEach(el => {
        map.set(el.getAttribute('data-content-path')!, el);
      });
      root.querySelectorAll('*').forEach(el => {
        if (el.shadowRoot) walkShadow(el.shadowRoot);
      });
    };

    walkShadow(slideRenderer.shadowRoot);
    return map;
  }

  private getElementRect(el: Element): { top: number; left: number; width: number; height: number } | null {
    const container = this.parentElement;
    if (!container) return null;
    const containerRect = container.getBoundingClientRect();
    const scaleX = SLIDE_WIDTH / containerRect.width;
    const scaleY = SLIDE_HEIGHT / containerRect.height;
    const padScreen = 4; // uniform padding in screen pixels

    // Use a Range to measure actual content bounds (not full block width)
    let rect: DOMRect;
    if (el.childNodes.length > 0 && el.getAttribute('data-content-path') !== 'slide') {
      const range = document.createRange();
      range.selectNodeContents(el);
      rect = range.getBoundingClientRect();
    } else {
      rect = el.getBoundingClientRect();
    }

    // Apply padding in screen space, then convert to native space
    return {
      top: (rect.top - containerRect.top - padScreen) * scaleY,
      left: (rect.left - containerRect.left - padScreen) * scaleX,
      width: (rect.width + padScreen * 2) * scaleX,
      height: (rect.height + padScreen + (padScreen - 2)) * scaleY,
    };
  }

  /** Get element rect in screen pixels (relative to viewport) for positioning popover outside slide */
  private getElementScreenRect(el: Element): { top: number; left: number; width: number; height: number } {
    const rect = el.getBoundingClientRect();
    return { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
  }

  private hitTestContentPath(clientX: number, clientY: number): { path: string; el: Element } | null {
    const elements = this.findContentPathElements();
    let best: { path: string; el: Element; area: number } | null = null;

    for (const [path, el] of elements) {
      const rect = el.getBoundingClientRect();
      if (
        clientX >= rect.left && clientX <= rect.right &&
        clientY >= rect.top && clientY <= rect.bottom
      ) {
        const area = rect.width * rect.height;
        if (!best || (path !== 'slide' && (best.path === 'slide' || area < best.area))) {
          best = { path, el, area };
        }
      }
    }

    return best;
  }

  /** When set, show a persistent highlight on this content path (active thread) */
  @property() activeContentPath: string | null = null;

  private onMouseMove = (e: MouseEvent) => {
    if (!this.commentMode || this.activeContentPath) {
      if (this.highlightRect) {
        this.hoveredPath = null;
        this.highlightRect = null;
      }
      return;
    }

    // Debounce hover to reduce flicker
    if (this.hoverTimeout) clearTimeout(this.hoverTimeout);
    this.hoverTimeout = setTimeout(() => {
      const hit = this.hitTestContentPath(e.clientX, e.clientY);
      const path = hit?.path ?? null;
      if (path !== this.hoveredPath) {
        this.hoveredPath = path;
        if (hit) {
          this.highlightRect = this.getElementRect(hit.el);
        } else {
          this.highlightRect = null;
        }
      }
    }, 40);
  };

  private onMouseLeave = () => {
    if (this.hoverTimeout) clearTimeout(this.hoverTimeout);
    this.hoveredPath = null;
    this.highlightRect = null;
  };

  private onClick = (e: MouseEvent) => {
    if (!this.commentMode) return;
    const hit = this.hitTestContentPath(e.clientX, e.clientY);
    if (!hit) {
      this.dispatchEvent(new CustomEvent('comment-click-empty', { bubbles: true, composed: true }));
      return;
    }

    const { path, el } = hit;
    const screenRect = this.getElementScreenRect(el);

    // Check if there's an existing open comment for this path
    const existing = this.comments.find(c => c.content_path === path && c.status === 'open');

    this.dispatchEvent(new CustomEvent('comment-element-click', {
      detail: {
        contentPath: path,
        commentId: existing?.id ?? null,
        screenRect,
      },
      bubbles: true,
      composed: true,
    }));
  };

  private onPinClick(e: Event, commentId: string) {
    e.stopPropagation();
    const comment = this.comments.find(c => c.id === commentId);
    if (!comment) return;

    // Use the pin element's own position for thread placement
    const pinEl = e.currentTarget as HTMLElement;
    const pinRect = pinEl.getBoundingClientRect();

    this.dispatchEvent(new CustomEvent('comment-pin-click', {
      detail: {
        contentPath: comment.content_path,
        commentId: comment.id,
        pinRect: { top: pinRect.top, left: pinRect.left, width: pinRect.width, height: pinRect.height },
      },
      bubbles: true,
      composed: true,
    }));
  }

  private computePins(): PinPosition[] {
    const elements = this.findContentPathElements();
    const pins: PinPosition[] = [];
    const seen = new Set<string>();

    for (const comment of this.comments) {
      if (!this.showResolved && comment.status === 'resolved') continue;
      if (seen.has(comment.content_path)) continue;
      seen.add(comment.content_path);

      const el = elements.get(comment.content_path);
      if (!el) continue;
      const rect = this.getElementRect(el);
      if (!rect) continue;

      const count = this.comments.filter(
        c => c.content_path === comment.content_path && (this.showResolved || c.status === 'open'),
      ).length;

      // For "slide" level comments, inset the pin so it's fully visible
      const isSlide = comment.content_path === 'slide';
      const pinPad = isSlide ? 28 : 0;
      pins.push({
        top: rect.top + pinPad,
        right: SLIDE_WIDTH - (rect.left + rect.width) + pinPad,
        commentId: comment.id,
        contentPath: comment.content_path,
        count,
      });
    }

    return pins;
  }

  private getActiveHighlightRect(): { top: number; left: number; width: number; height: number } | null {
    if (!this.activeContentPath) return null;
    const elements = this.findContentPathElements();
    const el = elements.get(this.activeContentPath);
    if (!el) return null;
    return this.getElementRect(el);
  }

  render() {
    const pins = this.computePins();
    const activeRect = this.getActiveHighlightRect();
    const showRect = activeRect ?? (this.commentMode ? this.highlightRect : null);

    return html`
      <div
        style="position:absolute;inset:0"
        @mousemove=${this.onMouseMove}
        @mouseleave=${this.onMouseLeave}
        @click=${this.onClick}
      >
        ${showRect ? html`
          <div class="highlight" style="
            top:${showRect.top}px;
            left:${showRect.left}px;
            width:${showRect.width}px;
            height:${showRect.height}px;
          "></div>
        ` : nothing}

        ${pins.map(pin => html`
          <div class="pin ${this.comments.find(c => c.id === pin.commentId)?.status === 'resolved' ? 'resolved' : ''}"
            style="top:${pin.top - 12}px;right:${pin.right - 12}px"
            @click=${(e: Event) => this.onPinClick(e, pin.commentId!)}
          >${pin.count}</div>
        `)}
      </div>
    `;
  }
}
