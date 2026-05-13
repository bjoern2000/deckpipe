import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import './components/slide-renderer.js';
import './components/thumbnail-strip.js';
import './components/viewer-toolbar.js';
import './components/nav-arrows.js';
import './components/slide-counter.js';
import './components/image-drop-zone.js';
import './components/comment-layer.js';
import './components/comment-thread.js';
import { fetchComments, createComment, addReply, updateComment, type Comment } from './utils/comment-api.js';
import { SLIDE_WIDTH, SLIDE_HEIGHT } from './constants.js';

interface HeadEntry {
  tag: 'link' | 'script' | 'style';
  attrs?: Record<string, string>;
  body?: string;
}

interface Deck {
  deck_id: string;
  title: string;
  heading_font?: string | null;
  body_font?: string | null;
  agent_name?: string | null;
  stylesheet?: string | null;
  head?: HeadEntry[] | null;
  slides: Array<{ layout: string; slide_id?: string; content: Record<string, unknown> }>;
  edit_key?: string;
  created_at: string;
  updated_at: string;
}

@customElement('viewer-app')
export class ViewerApp extends LitElement {
  static styles = css`
    :host {
      display: block;
      width: 100%;
      height: 100vh;
      background: #f5f5f5;
    }

    .viewer-layout {
      display: flex;
      height: 100%;
      width: 100%;
    }

    .thumbnail-panel {
      width: 180px;
      flex-shrink: 0;
      padding: 16px;
      background: #e0e0e0;
      overflow-y: auto;
      overflow-x: hidden;
    }

    .main-area {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      position: relative;
      padding: 24px;
      overflow: hidden;
      min-height: 0;
      min-width: 0;
    }

    .top-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      width: 100%;
      max-width: 1920px;
      padding: 0 0 12px 0;
    }

    .deck-title {
      font-family: var(--dp-font-heading, 'DM Sans', sans-serif);
      font-size: 17px;
      font-weight: 700;
      color: #333;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .slide-wrapper {
      position: relative;
    }

    .slide-container {
      width: 1920px;
      height: 1080px;
      transform-origin: top left;
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
      font-size: 32px;
    }


    .screenshot-layout {
      width: 1920px;
      height: 1080px;
      margin: 0;
      padding: 0;
      background: #fff;
    }

    .screenshot-layout .slide-container {
      width: 1920px;
      height: 1080px;
      box-shadow: none;
      border-radius: 0;
      transform: none;
    }

    .slide-wrapper.print-mode {
      box-shadow: none;
      border-radius: 0;
      max-width: none;
    }

    .bottom-bar {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      width: 100%;
      max-width: 1920px;
      padding: 8px 0;
    }

    .loading, .error {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      font-size: 18px;
      color: #666;
    }

    .error { color: #c00; }

    /* Print mode: all slides stacked */
    .print-layout {
      width: 100%;
      padding: 0;
    }

    .print-layout .slide-wrapper {
      width: 100%;
      max-width: none;
      page-break-after: always;
      margin: 0;
      border-radius: 0;
      box-shadow: none;
    }

    .floating-tooltip {
      position: fixed;
      z-index: 10000;
      pointer-events: none;
      background: #1e293b;
      color: #f1f5f9;
      padding: 8px 12px;
      border-radius: 6px;
      font-family: var(--dp-font-body, 'DM Sans', sans-serif);
      font-size: 13px;
      font-weight: 400;
      line-height: 1.4;
      max-width: 280px;
      width: max-content;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      text-align: left;
    }

    .floating-tooltip::after {
      content: '';
      position: absolute;
      left: 50%;
      transform: translateX(-50%);
      border-left: 6px solid transparent;
      border-right: 6px solid transparent;
    }

    .floating-tooltip.below::after {
      bottom: 100%;
      border-bottom: 6px solid #1e293b;
    }

    .floating-tooltip.above::after {
      top: 100%;
      border-top: 6px solid #1e293b;
    }

    .floating-thread {
      position: fixed;
      z-index: 1000;
      pointer-events: auto;
    }

    @media (max-width: 768px) {
      .thumbnail-panel { display: none; }
      .main-area { padding: 8px; }
    }

    /* Mobile: stack all slides vertically */
    :host(.mobile) {
      height: auto;
      min-height: 100vh;
      overflow-y: auto;
    }

    .mobile-layout {
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding: 12px 0;
    }

    .mobile-layout .mobile-slide {
      position: relative;
      overflow: hidden;
      border-radius: 8px;
      box-shadow: 0 1px 6px rgba(0, 0, 0, 0.1);
    }

    .mobile-layout .mobile-slide .slide-container {
      width: 1920px;
      height: 1080px;
      transform-origin: top left;
      box-shadow: none;
      border-radius: 0;
    }

    /* Presenter mode */
    .presenter-layout {
      width: 100vw;
      height: 100vh;
      background: #000;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
    }

    .presenter-counter {
      position: absolute;
      bottom: 24px;
      right: 32px;
      color: rgba(255, 255, 255, 0.4);
      font-size: 14px;
      font-family: 'Inconsolata', monospace;
      transition: opacity 0.3s;
    }

    :host(.cursor-hidden) {
      cursor: none;
    }

    :host(.cursor-hidden) .presenter-counter {
      opacity: 0;
    }
  `;

  @state() private deck: Deck | null = null;
  @state() private currentIndex = 0;
  @state() private loading = true;
  @state() private error = '';
  @state() private editMode = false;
  @state() private printMode = false;
  @state() private screenshotMode = false;
  @state() private screenshotSlideIndex = 0;
  @state() private saveStatus: 'idle' | 'saving' | 'saved' = 'idle';
  @state() private slideWidth = SLIDE_WIDTH;
  @state() private slideHeight = SLIDE_HEIGHT;
  @state() private isMobile = false;
  @state() private presenterMode = false;
  @state() private commentMode = false;
  @state() private comments: Comment[] = [];
  @state() private threadComment: Comment | null = null;
  @state() private threadContentPath: string | null = null;
  @state() private threadPos: { x: number; y: number } | null = null;
  @state() private tooltipText: string | null = null;
  @state() private tooltipStyle = '';

  private saveTimeout: ReturnType<typeof setTimeout> | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private mobileQuery: MediaQueryList | null = null;
  private cursorTimeout: ReturnType<typeof setTimeout> | null = null;

  connectedCallback() {
    super.connectedCallback();
    const params = new URLSearchParams(window.location.search);
    this.printMode = params.has('print');
    this.screenshotMode = params.has('screenshot');
    if (this.screenshotMode) {
      const slideParam = parseInt(params.get('slide') ?? '1', 10);
      this.screenshotSlideIndex = Number.isFinite(slideParam) ? Math.max(0, slideParam - 1) : 0;
      this.currentIndex = this.screenshotSlideIndex;
      document.documentElement.style.background = '#fff';
      document.body.style.background = '#fff';
      document.body.style.margin = '0';
    }
    this.mobileQuery = window.matchMedia('(max-width: 768px)');
    this.isMobile = this.mobileQuery.matches;
    if (!this.screenshotMode) {
      this.classList.toggle('mobile', this.isMobile);
      this.setBodyScroll(this.isMobile);
    }
    this.mobileQuery.addEventListener('change', this.onMobileChange);
    document.addEventListener('fullscreenchange', this.onFullscreenChange);
    window.addEventListener('resize', this.onWindowResize);
    this.loadDeck();
    if (!this.printMode && !this.screenshotMode && !this.isMobile) {
      window.addEventListener('keydown', this.onKeyDown);
      window.addEventListener('hashchange', this.onHashChange);
      this.readHash();
    }
  }

  protected updated(changedProperties: Map<string, unknown>) {
    super.updated(changedProperties);

    if (this.printMode || this.screenshotMode || this.isMobile || this.resizeObserver) return;
    const sizingHost = this.shadowRoot?.querySelector('.presenter-layout, .main-area');
    if (sizingHost) {
      this.resizeObserver = new ResizeObserver((entries) => {
        const { width, height } = entries[0].contentRect;
        let availW: number;
        let availH: number;
        if (this.presenterMode) {
          availW = width;
          availH = height;
        } else {
          const pad = 48;
          availW = width - 48;
          availH = height - pad - 48;
        }
        const byWidth = { w: availW, h: availW * 9 / 16 };
        const byHeight = { w: availH * 16 / 9, h: availH };
        if (byWidth.h <= availH) {
          this.slideWidth = byWidth.w;
          this.slideHeight = byWidth.h;
        } else {
          this.slideWidth = byHeight.w;
          this.slideHeight = byHeight.h;
        }
        console.log(`[deckpipe] resize: ${this.slideWidth.toFixed(0)}x${this.slideHeight.toFixed(0)}, scale=${(this.slideWidth/SLIDE_WIDTH).toFixed(2)}`);
      });
      this.resizeObserver.observe(sizingHost);
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('hashchange', this.onHashChange);
    this.resizeObserver?.disconnect();
    this.mobileQuery?.removeEventListener('change', this.onMobileChange);
    document.removeEventListener('fullscreenchange', this.onFullscreenChange);
    window.removeEventListener('resize', this.onWindowResize);
  }

  private onWindowResize = () => {
    if (this.isMobile) this.requestUpdate();
  };

  private onMobileChange = (e: MediaQueryListEvent) => {
    this.isMobile = e.matches;
    this.classList.toggle('mobile', this.isMobile);
    this.setBodyScroll(this.isMobile);
  };

  private injectedHeadKeys = new Set<string>();
  private injectHeadEntry(entry: HeadEntry) {
    if (!entry || !entry.tag) return;
    const key = JSON.stringify({ tag: entry.tag, attrs: entry.attrs ?? {}, body: entry.body ?? '' });
    if (this.injectedHeadKeys.has(key)) return;
    this.injectedHeadKeys.add(key);

    const el = document.createElement(entry.tag);
    el.setAttribute('data-deckpipe-head', '');
    if (entry.attrs) {
      for (const [k, v] of Object.entries(entry.attrs)) {
        el.setAttribute(k, v);
      }
    }
    if (entry.body) el.textContent = entry.body;
    document.head.appendChild(el);
  }

  private setBodyScroll(mobile: boolean) {
    const overflow = mobile ? 'auto' : 'hidden';
    document.documentElement.style.overflow = overflow;
    document.body.style.overflow = overflow;
  }

  private readHash() {
    const match = window.location.hash.match(/slide=(\d+)/);
    if (match) {
      this.currentIndex = Math.max(0, parseInt(match[1], 10) - 1);
    }
  }

  private onHashChange = () => this.readHash();

  private onFullscreenChange = () => {
    if (!document.fullscreenElement && this.presenterMode) {
      this.exitPresenterMode();
    }
  };

  private enterPresenterMode() {
    this.presenterMode = true;
    this.editMode = false;
    this.commentMode = false;
    // Disconnect existing observer so it re-attaches to new .main-area
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    document.documentElement.requestFullscreen().catch(() => {});
    window.addEventListener('mousemove', this.onMouseMovePresenter);
    this.resetCursorTimeout();
  }

  private exitPresenterMode() {
    this.presenterMode = false;
    if (this.cursorTimeout) clearTimeout(this.cursorTimeout);
    this.classList.remove('cursor-hidden');
    window.removeEventListener('mousemove', this.onMouseMovePresenter);
    // Disconnect observer so it re-attaches to normal .main-area
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  }

  private onMouseMovePresenter = () => {
    this.classList.remove('cursor-hidden');
    this.resetCursorTimeout();
  };

  private resetCursorTimeout() {
    if (this.cursorTimeout) clearTimeout(this.cursorTimeout);
    this.cursorTimeout = setTimeout(() => {
      if (this.presenterMode) this.classList.add('cursor-hidden');
    }, 3000);
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      this.nextSlide();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      this.prevSlide();
    } else if (e.key === ' ' && this.presenterMode) {
      e.preventDefault();
      this.nextSlide();
    } else if (e.key === 'Escape' && this.presenterMode) {
      this.exitPresenterMode();
    } else if (e.key === 'c' && !this.presenterMode && !this.isInputFocused()) {
      this.onToggleComments();
    }
  };

  private isInputFocused(): boolean {
    let el = document.activeElement;
    while (el?.shadowRoot?.activeElement) {
      el = el.shadowRoot.activeElement;
    }
    return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || (el as HTMLElement)?.isContentEditable === true;
  }

  private getDeckId(): string | null {
    const previewMatch = window.location.pathname.match(/\/preview\/([^/]+)/);
    if (previewMatch) return previewMatch[1];
    const match = window.location.pathname.match(/\/d\/([^/]+)/);
    return match?.[1] ?? null;
  }

  private isPreviewRoute(): boolean {
    return window.location.pathname.startsWith('/preview/');
  }

  private getEditKey(): string | null {
    return new URLSearchParams(window.location.search).get('key');
  }

  private get canEdit(): boolean {
    if (!this.deck?.edit_key) return false;
    return this.getEditKey() === this.deck.edit_key;
  }

  private getShareUrl(): string {
    const deckId = this.deck?.deck_id ?? '';
    const title = this.deck?.title ?? '';
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
    return `${window.location.origin}/d/${deckId}/${slug}`;
  }

  private async loadDeck() {
    const deckId = this.getDeckId();
    if (!deckId) {
      this.error = 'No deck ID in URL';
      this.loading = false;
      return;
    }

    try {
      const apiPath = this.isPreviewRoute() ? `/v1/preview/${deckId}` : `/v1/decks/${deckId}`;
      const res = await fetch(apiPath);
      if (!res.ok) {
        const body = await res.json();
        this.error = body.error?.message || 'Failed to load deck';
        this.loading = false;
        return;
      }
      this.deck = await res.json();
      this.loading = false;

      // Set page title
      document.title = `${this.deck.title} — deckpipe`;

      // Load custom Google Fonts if specified
      const fonts = [this.deck.heading_font, this.deck.body_font].filter(Boolean) as string[];
      const uniqueFonts = [...new Set(fonts)];
      for (const font of uniqueFonts) {
        const fontUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(font)}:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,500;1,600;1,700&display=swap`;
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = fontUrl;
        document.head.appendChild(link);
      }

      // Inject deck-level head entries (link/script/style) for canvas slides.
      if (Array.isArray(this.deck.head)) {
        for (const entry of this.deck.head) {
          this.injectHeadEntry(entry);
        }
      }

      // Load comments
      if (!this.printMode && !this.screenshotMode) {
        this.loadComments();
      }

      // Signal headless-render readiness (print / screenshot pipelines).
      if (this.printMode || this.screenshotMode) {
        // Wait for: shadow roots mounted, fonts loaded, images decoded — then
        // two rAFs to let any post-paint adjustment land before puppeteer captures.
        const collectImages = (root: ParentNode, acc: HTMLImageElement[] = []): HTMLImageElement[] => {
          root.querySelectorAll('img').forEach((img) => acc.push(img as HTMLImageElement));
          root.querySelectorAll('*').forEach((el) => {
            const sr = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
            if (sr) collectImages(sr, acc);
          });
          return acc;
        };
        const signal = async () => {
          // Two rAFs first so Lit has mounted the slide-canvas shadow root.
          await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
          try { await (document as Document & { fonts?: FontFaceSet }).fonts?.ready; } catch { /* ignore */ }
          const imgs = collectImages(document);
          await Promise.all(imgs.map((img) =>
            img.complete ? Promise.resolve() : new Promise<void>((r) => {
              img.addEventListener('load', () => r(), { once: true });
              img.addEventListener('error', () => r(), { once: true });
            }),
          ));
          await Promise.all(imgs.map((img) => img.decode().catch(() => {})));
          requestAnimationFrame(() => requestAnimationFrame(() => {
            document.documentElement.setAttribute('data-ready', 'true');
          }));
        };
        void signal();
      }
    } catch {
      this.error = 'Failed to connect to API';
      this.loading = false;
    }
  }

  private nextSlide() {
    if (this.deck && this.currentIndex < this.deck.slides.length - 1) {
      this.currentIndex++;
      this.closeThread();
      window.location.hash = `slide=${this.currentIndex + 1}`;
    }
  }

  private prevSlide() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.closeThread();
      window.location.hash = `slide=${this.currentIndex + 1}`;
    }
  }

  private onThumbnailClick(e: CustomEvent<number>) {
    this.currentIndex = e.detail;
    window.location.hash = `slide=${this.currentIndex + 1}`;
  }

  private onToggleEdit() {
    if (!this.canEdit) return;
    this.editMode = !this.editMode;
    if (this.editMode) this.commentMode = false;
  }

  private onShare() {
    const url = this.getShareUrl();
    navigator.clipboard.writeText(url);
  }

  private async onToggleComments() {
    this.commentMode = !this.commentMode;
    if (this.commentMode) {
      this.editMode = false;
      await this.loadComments();
    } else {
      this.closeThread();
    }
  }

  private async loadComments() {
    if (!this.deck) return;
    try {
      this.comments = await fetchComments(this.deck.deck_id);
    } catch {
      console.error('[deckpipe] Failed to load comments');
    }
  }

  private async onCommentCreated(e: CustomEvent<{ slide_id: string; content_path: string; body: string; author_name: string }>) {
    if (!this.deck) return;
    try {
      const comment = await createComment(this.deck.deck_id, {
        slide_id: e.detail.slide_id,
        content_path: e.detail.content_path,
        author_name: e.detail.author_name,
        author_type: 'human',
        body: e.detail.body,
      });
      this.comments = [...this.comments, comment];
    } catch {
      console.error('[deckpipe] Failed to create comment');
    }
  }

  private async onReplyAdded(e: CustomEvent<{ comment_id: string; body: string; author_name: string }>) {
    if (!this.deck) return;
    try {
      const updated = await addReply(this.deck.deck_id, e.detail.comment_id, {
        author_name: e.detail.author_name,
        author_type: 'human',
        body: e.detail.body,
      });
      this.comments = this.comments.map(c => c.id === updated.id ? updated : c);
    } catch {
      console.error('[deckpipe] Failed to add reply');
    }
  }

  private onCommentElementClick(e: CustomEvent<{ contentPath: string; commentId: string | null; screenRect: { top: number; left: number; width: number; height: number } | null }>) {
    const { contentPath, commentId, screenRect } = e.detail;

    if (commentId) {
      this.threadComment = this.comments.find(c => c.id === commentId) ?? null;
      this.threadContentPath = null;
    } else {
      this.threadComment = null;
      this.threadContentPath = contentPath;
    }

    if (screenRect) {
      // Position as if a pin (24px, translated 50%/-50%) were at the element's top-right
      // Pin center = (right, top), so pin bottom-right = (right + 12, top + 12) in screen px
      // Scale the 12px pin offset from native to screen space
      const scaleFactor = this.slideWidth / SLIDE_WIDTH;
      const pinOffset = 12 * scaleFactor;
      this.positionThread(screenRect.left + screenRect.width + pinOffset, screenRect.top + pinOffset);
    }
  }

  private onCommentPinClick(e: CustomEvent<{ contentPath: string; commentId: string; pinRect: { top: number; left: number; width: number; height: number } }>) {
    const { commentId, pinRect } = e.detail;
    this.threadComment = this.comments.find(c => c.id === commentId) ?? null;
    this.threadContentPath = null;
    // Top-left of thread at bottom-right of pin
    this.positionThread(pinRect.left + pinRect.width, pinRect.top + pinRect.height);
  }

  private positionThread(anchorRight: number, anchorTop: number) {
    let x = anchorRight + 4;
    let y = anchorTop;
    if (x + 320 > window.innerWidth) {
      x = anchorRight - 324;
    }
    y = Math.max(8, Math.min(y, window.innerHeight - 420));
    x = Math.max(8, x);
    this.threadPos = { x, y };
  }

  private onCommentClickEmpty() {
    this.threadComment = null;
    this.threadContentPath = null;
    this.threadPos = null;
  }

  private closeThread() {
    this.threadComment = null;
    this.threadContentPath = null;
    this.threadPos = null;
  }

  // --- Drag support for floating thread ---
  private dragOffset: { x: number; y: number } | null = null;

  private onThreadDragStart = (e: CustomEvent<{ clientX: number; clientY: number }>) => {
    if (!this.threadPos) return;
    this.dragOffset = { x: e.detail.clientX - this.threadPos.x, y: e.detail.clientY - this.threadPos.y };
    window.addEventListener('mousemove', this.onThreadDragMove);
    window.addEventListener('mouseup', this.onThreadDragEnd);
  };

  private onThreadDragMove = (e: MouseEvent) => {
    if (!this.dragOffset) return;
    this.threadPos = {
      x: e.clientX - this.dragOffset.x,
      y: e.clientY - this.dragOffset.y,
    };
  };

  private onThreadDragEnd = () => {
    this.dragOffset = null;
    window.removeEventListener('mousemove', this.onThreadDragMove);
    window.removeEventListener('mouseup', this.onThreadDragEnd);
  };

  private async onCommentStatusChanged(e: CustomEvent<{ comment_id: string; status: 'open' | 'resolved' }>) {
    if (!this.deck) return;
    try {
      const updated = await updateComment(this.deck.deck_id, e.detail.comment_id, {
        status: e.detail.status,
      });
      this.comments = this.comments.map(c => c.id === updated.id ? updated : c);
    } catch {
      console.error('[deckpipe] Failed to update comment');
    }
  }

  private onShowTooltip(e: CustomEvent<{ text: string; triggerRect: { top: number; left: number; bottom: number; width: number } }>) {
    const { text, triggerRect } = e.detail;
    this.tooltipText = text;

    // Position after render so we can measure the tooltip
    requestAnimationFrame(() => {
      const tooltipEl = this.shadowRoot?.querySelector('.floating-tooltip') as HTMLElement;
      if (!tooltipEl) return;
      const tooltipHeight = tooltipEl.offsetHeight;
      const tooltipWidth = tooltipEl.offsetWidth;
      const gap = 8;
      const centerX = triggerRect.left + triggerRect.width / 2;

      let top = triggerRect.bottom + gap;
      let direction = 'below';

      if (top + tooltipHeight > window.innerHeight - 8) {
        top = triggerRect.top - tooltipHeight - gap;
        direction = 'above';
      }

      let left = centerX - tooltipWidth / 2;
      left = Math.max(8, Math.min(left, window.innerWidth - tooltipWidth - 8));

      tooltipEl.className = `floating-tooltip ${direction}`;
      this.tooltipStyle = `top:${top}px;left:${left}px`;
    });
  }

  private onHideTooltip() {
    this.tooltipText = null;
  }

  private onSlideContentChanged(e: CustomEvent<{ field: string; value: unknown }>) {
    if (!this.deck) return;

    const slide = this.deck.slides[this.currentIndex];
    const updated = { ...slide, content: { ...slide.content, [e.detail.field]: e.detail.value } };
    const newSlides = [...this.deck.slides];
    newSlides[this.currentIndex] = updated;
    this.deck = { ...this.deck, slides: newSlides };

    this.debouncedSave();
  }

  private async onImageUploaded(e: CustomEvent<{ url: string }>) {
    if (!this.deck) return;

    const slide = this.deck.slides[this.currentIndex];
    const updated = { ...slide, content: { ...slide.content, image_url: e.detail.url } };
    const newSlides = [...this.deck.slides];
    newSlides[this.currentIndex] = updated;
    this.deck = { ...this.deck, slides: newSlides };

    await this.saveDeck();
  }

  private async onImageRemoved() {
    if (!this.deck) return;

    const slide = this.deck.slides[this.currentIndex];
    const { image_url: _, ...rest } = slide.content as Record<string, unknown>;
    const updated = { ...slide, content: rest };
    const newSlides = [...this.deck.slides];
    newSlides[this.currentIndex] = updated;
    this.deck = { ...this.deck, slides: newSlides };

    await this.saveDeck();
  }

  private debouncedSave() {
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => this.saveDeck(), 1000);
  }

  private async saveDeck() {
    if (!this.deck) return;
    this.saveStatus = 'saving';

    try {
      const slide = this.deck.slides[this.currentIndex];
      await fetch(`/v1/decks/${this.deck.deck_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slides: [{ index: this.currentIndex, content: slide.content }],
        }),
      });
      this.saveStatus = 'saved';
      setTimeout(() => { this.saveStatus = 'idle'; }, 2000);
    } catch {
      this.saveStatus = 'idle';
    }
  }

  render() {
    if (this.loading) return html`<div class="loading">Loading deck...</div>`;
    if (this.error) return html`<div class="error">${this.error}</div>`;
    if (!this.deck) return html`<div class="error">No deck data</div>`;

    if (this.screenshotMode) return this.renderScreenshotMode();
    if (this.printMode) return this.renderPrintMode();
    if (this.presenterMode) return this.renderPresenterMode();
    if (this.isMobile) return this.renderMobileMode();

    const slide = this.deck.slides[this.currentIndex];
    const customVars = this.getCustomCssVars();
    const scaleFactor = this.slideWidth / SLIDE_WIDTH;

    return html`
      <div class="viewer-layout">
        <div class="thumbnail-panel">
          <thumbnail-strip
            .slides=${this.deck.slides}
            .currentIndex=${this.currentIndex}
            .headingFont=${this.deck.heading_font ?? ''}
            .bodyFont=${this.deck.body_font ?? ''}
            .deckStylesheet=${this.deck.stylesheet ?? ''}
            @thumbnail-click=${this.onThumbnailClick}
          ></thumbnail-strip>
        </div>
        <div class="main-area">
          <nav-arrows
            .hasPrev=${this.currentIndex > 0}
            .hasNext=${this.currentIndex < this.deck.slides.length - 1}
            @nav-prev=${this.prevSlide}
            @nav-next=${this.nextSlide}
          ></nav-arrows>
          <div class="top-bar" style="max-width:${this.slideWidth}px;${customVars}">
            <span class="deck-title">${this.deck.title}</span>
            <viewer-toolbar
              .editMode=${this.editMode}
              .commentMode=${this.commentMode}
              .commentCount=${this.comments.filter(c => c.status === 'open').length}
              .canEdit=${this.canEdit}
              .saveStatus=${this.saveStatus}
              @toggle-edit=${this.onToggleEdit}
              @toggle-comments=${this.onToggleComments}
              @share-deck=${this.onShare}
              @start-presentation=${() => this.enterPresenterMode()}
            ></viewer-toolbar>
          </div>
          <div class="slide-wrapper" style="width:${this.slideWidth}px;height:${this.slideHeight}px">
            <div class="slide-container" style="transform:scale(${scaleFactor});${customVars}">
              <slide-renderer
                .slide=${slide}
                .editable=${this.editMode}
                .deckStylesheet=${this.deck.stylesheet ?? ''}
                @slide-content-changed=${this.onSlideContentChanged}
                @show-tooltip=${this.onShowTooltip}
                @hide-tooltip=${this.onHideTooltip}
              ></slide-renderer>
              ${this.editMode && slide.layout !== 'section_break' && slide.layout !== 'canvas' ? html`
                <image-drop-zone
                  .hasImage=${!!(slide.content as Record<string, unknown>).image_url}
                  @image-uploaded=${this.onImageUploaded}
                  @image-removed=${this.onImageRemoved}
                ></image-drop-zone>
              ` : ''}
              <comment-layer
                .deckId=${this.deck!.deck_id}
                .slideId=${slide.slide_id ?? ''}
                .comments=${this.comments.filter(c => c.slide_id === slide.slide_id)}
                .commentMode=${this.commentMode}
                .activeContentPath=${this.threadPos ? (this.threadComment?.content_path ?? this.threadContentPath) : null}
                @comment-element-click=${this.onCommentElementClick}
                @comment-pin-click=${this.onCommentPinClick}
                @comment-click-empty=${this.onCommentClickEmpty}
              ></comment-layer>
            </div>
          </div>
          <div class="bottom-bar" style="max-width:${this.slideWidth}px">
            <slide-counter
              .current=${this.currentIndex + 1}
              .total=${this.deck.slides.length}
            ></slide-counter>
          </div>
        </div>
      </div>
      ${this.threadPos && (this.threadComment || this.threadContentPath) ? html`
        <div class="floating-thread"
          style="left:${this.threadPos.x}px;top:${this.threadPos.y}px"
        >
          <comment-thread
            .comment=${this.threadComment}
            .contentPath=${this.threadContentPath ?? ''}
            @comment-created=${(e: CustomEvent) => {
              this.onCommentCreated(new CustomEvent('comment-created', {
                detail: { ...e.detail, slide_id: this.deck!.slides[this.currentIndex].slide_id },
              }));
              this.closeThread();
            }}
            @reply-added=${this.onReplyAdded}
            @comment-status-changed=${this.onCommentStatusChanged}
            @popover-close=${() => this.closeThread()}
            @drag-start=${this.onThreadDragStart}
          ></comment-thread>
        </div>
      ` : ''}
      ${this.tooltipText ? html`
        <div class="floating-tooltip below" style="${this.tooltipStyle}">${this.tooltipText}</div>
      ` : ''}
    `;
  }

  private getCustomCssVars(): string {
    const vars: string[] = [];
    if (this.deck?.heading_font) {
      vars.push(`--dp-font-heading:'${this.deck.heading_font}', sans-serif`);
    }
    if (this.deck?.body_font) {
      vars.push(`--dp-font-body:'${this.deck.body_font}', sans-serif`);
    }
    return vars.join(';');
  }

  private renderScreenshotMode() {
    if (!this.deck) return html``;
    const idx = Math.min(this.screenshotSlideIndex, this.deck.slides.length - 1);
    const slide = this.deck.slides[idx];
    const customVars = this.getCustomCssVars();
    return html`
      <div class="screenshot-layout">
        <div class="slide-wrapper" style="width:1920px;height:1080px">
          <div class="slide-container" style="${customVars}">
            <slide-renderer
              .slide=${slide}
              .editable=${false}
              .staticPreview=${true}
              .deckStylesheet=${this.deck?.stylesheet ?? ''}
            ></slide-renderer>
          </div>
        </div>
      </div>
    `;
  }

  private renderPresenterMode() {
    if (!this.deck) return html``;
    const slide = this.deck.slides[this.currentIndex];
    const customVars = this.getCustomCssVars();
    const scaleFactor = this.slideWidth / SLIDE_WIDTH;

    return html`
      <div class="presenter-layout">
        <div class="slide-wrapper" style="width:${this.slideWidth}px;height:${this.slideHeight}px">
          <div class="slide-container" style="transform:scale(${scaleFactor});${customVars}">
            <slide-renderer .slide=${slide} .editable=${false} .deckStylesheet=${this.deck?.stylesheet ?? ''}></slide-renderer>
          </div>
        </div>
        <div class="presenter-counter">
          ${this.currentIndex + 1} / ${this.deck.slides.length}
        </div>
      </div>
    `;
  }

  private renderMobileMode() {
    if (!this.deck) return html``;
    const customVars = this.getCustomCssVars();
    const w = window.innerWidth * 0.95;
    const scale = w / SLIDE_WIDTH;
    const h = SLIDE_HEIGHT * scale;
    return html`
      <div class="mobile-layout">
        ${this.deck.slides.map(slide => html`
          <div class="mobile-slide" style="width:${w}px;height:${h}px">
            <div class="slide-container" style="transform:scale(${scale});${customVars}">
              <slide-renderer .slide=${slide} .editable=${false} .deckStylesheet=${this.deck?.stylesheet ?? ''}></slide-renderer>
            </div>
          </div>
        `)}
      </div>
    `;
  }

  private renderPrintMode() {
    if (!this.deck) return html``;
    const customVars = this.getCustomCssVars();
    return html`
      <div class="print-layout">
        ${this.deck.slides.map(slide => html`
          <div class="slide-wrapper print-mode">
            <div class="slide-container" style="${customVars}">
              <slide-renderer .slide=${slide} .editable=${false} .deckStylesheet=${this.deck?.stylesheet ?? ''}></slide-renderer>
            </div>
          </div>
        `)}
      </div>
    `;
  }
}
