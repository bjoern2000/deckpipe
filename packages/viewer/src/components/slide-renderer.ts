import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import './slide-title.js';
import './slide-title-and-body.js';
import './slide-title-and-bullets.js';
import './slide-title-and-table.js';
import './slide-two-columns.js';
import './slide-section-break.js';
import './slide-image-and-text.js';
import './slide-image-gallery.js';
import './slide-stats.js';
import './slide-quote.js';
import './slide-full-image.js';

interface SlideData {
  layout: string;
  content: Record<string, unknown>;
}

@customElement('slide-renderer')
export class SlideRenderer extends LitElement {
  static styles = css`
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }
  `;

  @property({ type: Object }) slide: SlideData = { layout: 'title', content: {} };
  @property({ type: Boolean }) editable = false;

  render() {
    const { layout, content } = this.slide;
    const c = content as Record<string, unknown>;

    switch (layout) {
      case 'title':
        return html`<slide-title
          .title=${c.title || ''}
          .subtitle=${c.subtitle || ''}
          image-url=${c.image_url || ''}
          .imageFocus=${c.image_focus || null}
          key-takeaway=${c.key_takeaway || ''}
          .editable=${this.editable}
        ></slide-title>`;

      case 'title_and_body':
        return html`<slide-title-and-body
          .title=${c.title || ''}
          .body=${c.body || ''}
          image-url=${c.image_url || ''}
          .imageFocus=${c.image_focus || null}
          key-takeaway=${c.key_takeaway || ''}
          .editable=${this.editable}
        ></slide-title-and-body>`;

      case 'title_and_bullets':
        return html`<slide-title-and-bullets
          .title=${c.title || ''}
          .bullets=${(c.bullets as string[]) || []}
          image-url=${c.image_url || ''}
          .imageFocus=${c.image_focus || null}
          key-takeaway=${c.key_takeaway || ''}
          .editable=${this.editable}
        ></slide-title-and-bullets>`;

      case 'title_and_table':
        return html`<slide-title-and-table
          .title=${c.title || ''}
          .table=${c.table || { headers: [], rows: [] }}
          key-takeaway=${c.key_takeaway || ''}
          .editable=${this.editable}
        ></slide-title-and-table>`;

      case 'two_columns':
        return html`<slide-two-columns
          .title=${c.title || ''}
          .left=${(c.left as { heading: string; body: string }) || { heading: '', body: '' }}
          .right=${(c.right as { heading: string; body: string }) || { heading: '', body: '' }}
          image-url=${c.image_url || ''}
          .imageFocus=${c.image_focus || null}
          key-takeaway=${c.key_takeaway || ''}
          .editable=${this.editable}
        ></slide-two-columns>`;

      case 'section_break':
        return html`<slide-section-break
          .title=${c.title || ''}
          key-takeaway=${c.key_takeaway || ''}
          .editable=${this.editable}
        ></slide-section-break>`;

      case 'image_and_text':
        return html`<slide-image-and-text
          .title=${c.title || ''}
          .body=${c.body || ''}
          image-url=${c.image_url || ''}
          .imageFocus=${c.image_focus || null}
          key-takeaway=${c.key_takeaway || ''}
          .editable=${this.editable}
        ></slide-image-and-text>`;

      case 'image_gallery':
        return html`<slide-image-gallery
          .title=${c.title || ''}
          .caption=${c.caption || ''}
          .images=${(c.images as string[]) || []}
          .imageFocuses=${(c.image_focuses as Array<{x: number, y: number}>) || []}
          key-takeaway=${c.key_takeaway || ''}
          .editable=${this.editable}
        ></slide-image-gallery>`;

      case 'stats':
        return html`<slide-stats
          .title=${c.title || ''}
          .metrics=${(c.metrics as Array<{value: string, label: string}>) || []}
          key-takeaway=${c.key_takeaway || ''}
          .editable=${this.editable}
        ></slide-stats>`;

      case 'quote':
        return html`<slide-quote
          .quote=${c.quote || ''}
          .attribution=${c.attribution || ''}
          image-url=${c.image_url || ''}
          .imageFocus=${c.image_focus || null}
          key-takeaway=${c.key_takeaway || ''}
          .editable=${this.editable}
        ></slide-quote>`;

      case 'full_image':
        return html`<slide-full-image
          image-url=${c.image_url || ''}
          .imageFocus=${c.image_focus || null}
          .title=${c.title || ''}
          .subtitle=${c.subtitle || ''}
          key-takeaway=${c.key_takeaway || ''}
          .editable=${this.editable}
        ></slide-full-image>`;

      default:
        return html`<div style="padding:48px;color:#c00">Unknown layout: ${layout}</div>`;
    }
  }
}
