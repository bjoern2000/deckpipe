import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import './components/slide-renderer.js';
import './components/thumbnail-strip.js';
import './components/viewer-toolbar.js';
import './components/nav-arrows.js';
import './components/slide-counter.js';
import './components/image-drop-zone.js';

interface Deck {
  deck_id: string;
  title: string;
  heading_font?: string | null;
  body_font?: string | null;
  accent_color?: string | null;
  slides: Array<{ layout: string; content: Record<string, unknown> }>;
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
      height: calc(100% - 48px);
      width: 100%;
    }

    .thumbnail-panel {
      width: 160px;
      flex-shrink: 0;
      overflow-y: auto;
      padding: 12px 14px;
      background: #eee;
      border-right: 1px solid #ddd;
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

    .slide-wrapper {
      position: relative;
    }

    .slide-container {
      width: 960px;
      height: 540px;
      transform-origin: top left;
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
      overflow: hidden;
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
      max-width: 960px;
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
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .mobile-layout .mobile-slide {
      width: 100%;
      aspect-ratio: 16 / 9;
      background: white;
      overflow: hidden;
      position: relative;
      border-radius: 8px;
      box-shadow: 0 1px 6px rgba(0, 0, 0, 0.1);
    }

    .mobile-layout .mobile-slide .slide-container {
      position: absolute;
      top: 0;
      left: 0;
      width: 960px;
      height: 540px;
      transform-origin: top left;
    }
  `;

  @state() private deck: Deck | null = null;
  @state() private currentIndex = 0;
  @state() private loading = true;
  @state() private error = '';
  @state() private editMode = false;
  @state() private printMode = false;
  @state() private saveStatus: 'idle' | 'saving' | 'saved' = 'idle';
  @state() private slideWidth = 960;
  @state() private slideHeight = 540;
  @state() private isMobile = false;
  @state() private mobileSlideWidth = 0;

  private saveTimeout: ReturnType<typeof setTimeout> | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private mobileResizeObserver: ResizeObserver | null = null;
  private mobileQuery: MediaQueryList | null = null;

  connectedCallback() {
    super.connectedCallback();
    this.printMode = new URLSearchParams(window.location.search).has('print');
    this.mobileQuery = window.matchMedia('(max-width: 768px)');
    this.isMobile = this.mobileQuery.matches;
    this.classList.toggle('mobile', this.isMobile);
    this.setBodyScroll(this.isMobile);
    this.mobileQuery.addEventListener('change', this.onMobileChange);
    this.loadDeck();
    if (!this.printMode && !this.isMobile) {
      window.addEventListener('keydown', this.onKeyDown);
      window.addEventListener('hashchange', this.onHashChange);
      this.readHash();
    }
  }

  protected updated(changedProperties: Map<string, unknown>) {
    super.updated(changedProperties);

    // Mobile: observe first slide card to get actual width for scaling
    if (this.isMobile && !this.mobileResizeObserver) {
      const firstSlide = this.shadowRoot?.querySelector('.mobile-slide');
      if (firstSlide) {
        this.mobileResizeObserver = new ResizeObserver((entries) => {
          this.mobileSlideWidth = entries[0].contentRect.width;
        });
        this.mobileResizeObserver.observe(firstSlide);
      }
      return;
    }

    if (this.printMode || this.resizeObserver) return;
    const mainArea = this.shadowRoot?.querySelector('.main-area');
    if (mainArea) {
      this.resizeObserver = new ResizeObserver((entries) => {
        const { width, height } = entries[0].contentRect;
        const pad = 48;
        const availW = width - 48;
        const availH = height - pad - 48;
        const byWidth = { w: availW, h: availW * 9 / 16 };
        const byHeight = { w: availH * 16 / 9, h: availH };
        if (byWidth.h <= availH) {
          this.slideWidth = byWidth.w;
          this.slideHeight = byWidth.h;
        } else {
          this.slideWidth = byHeight.w;
          this.slideHeight = byHeight.h;
        }
        console.log(`[deckpipe] resize: ${this.slideWidth.toFixed(0)}x${this.slideHeight.toFixed(0)}, scale=${(this.slideWidth/960).toFixed(2)}`);
      });
      this.resizeObserver.observe(mainArea);
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('hashchange', this.onHashChange);
    this.resizeObserver?.disconnect();
    this.mobileResizeObserver?.disconnect();
    this.mobileQuery?.removeEventListener('change', this.onMobileChange);
  }

  private onMobileChange = (e: MediaQueryListEvent) => {
    this.isMobile = e.matches;
    this.classList.toggle('mobile', this.isMobile);
    this.setBodyScroll(this.isMobile);
  };

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

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      this.nextSlide();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      this.prevSlide();
    }
  };

  private getDeckId(): string | null {
    const match = window.location.pathname.match(/\/d\/([^/]+)/);
    return match?.[1] ?? null;
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
      const res = await fetch(`/v1/decks/${deckId}`);
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
        const fontUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(font)}:wght@300;400;500;600;700&display=swap`;
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = fontUrl;
        document.head.appendChild(link);
      }

      // Signal print readiness
      if (this.printMode) {
        requestAnimationFrame(() => {
          document.documentElement.setAttribute('data-ready', 'true');
        });
      }
    } catch {
      this.error = 'Failed to connect to API';
      this.loading = false;
    }
  }

  private nextSlide() {
    if (this.deck && this.currentIndex < this.deck.slides.length - 1) {
      this.currentIndex++;
      window.location.hash = `slide=${this.currentIndex + 1}`;
    }
  }

  private prevSlide() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
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
  }

  private onShare() {
    const url = this.getShareUrl();
    navigator.clipboard.writeText(url);
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

    if (this.printMode) return this.renderPrintMode();
    if (this.isMobile) return this.renderMobileMode();

    const slide = this.deck.slides[this.currentIndex];
    const customVars = this.getCustomCssVars();
    const scaleFactor = this.slideWidth / 960;

    return html`
      <viewer-toolbar
        .title=${this.deck.title}
        .editMode=${this.editMode}
        .canEdit=${this.canEdit}
        .saveStatus=${this.saveStatus}
        @toggle-edit=${this.onToggleEdit}
        @share-deck=${this.onShare}
      ></viewer-toolbar>
      <div class="viewer-layout">
        <div class="thumbnail-panel">
          <thumbnail-strip
            .slides=${this.deck.slides}
            .currentIndex=${this.currentIndex}
            .headingFont=${this.deck.heading_font ?? ''}
            .bodyFont=${this.deck.body_font ?? ''}
            .accentColor=${this.deck.accent_color ?? ''}
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
          <div class="slide-wrapper" style="width:${this.slideWidth}px;height:${this.slideHeight}px">
            <div class="slide-container" style="transform:scale(${scaleFactor});${customVars}">
              <slide-renderer
                .slide=${slide}
                .editable=${this.editMode}
                @slide-content-changed=${this.onSlideContentChanged}
              ></slide-renderer>
              ${this.editMode && slide.layout !== 'section_break' ? html`
                <image-drop-zone
                  .hasImage=${!!(slide.content as Record<string, unknown>).image_url}
                  @image-uploaded=${this.onImageUploaded}
                  @image-removed=${this.onImageRemoved}
                ></image-drop-zone>
              ` : ''}
            </div>
          </div>
          <div class="bottom-bar">
            <slide-counter
              .current=${this.currentIndex + 1}
              .total=${this.deck.slides.length}
            ></slide-counter>
          </div>
        </div>
      </div>
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
    if (this.deck?.accent_color) {
      vars.push(`--dp-accent:${this.deck.accent_color}`);
    }
    return vars.join(';');
  }

  private renderMobileMode() {
    if (!this.deck) return html``;
    const customVars = this.getCustomCssVars();
    const scale = this.mobileSlideWidth ? this.mobileSlideWidth / 960 : (window.innerWidth - 24) / 960;
    return html`
      <div class="mobile-layout">
        ${this.deck.slides.map(slide => html`
          <div class="mobile-slide">
            <div class="slide-container" style="transform:scale(${scale});${customVars}">
              <slide-renderer .slide=${slide} .editable=${false}></slide-renderer>
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
              <slide-renderer .slide=${slide} .editable=${false}></slide-renderer>
            </div>
          </div>
        `)}
      </div>
    `;
  }
}
