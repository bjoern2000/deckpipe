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
import './slide-timeline.js';
import './slide-comparison.js';
import './slide-code.js';
import './slide-callout.js';
import './slide-icons-and-text.js';
import './slide-team.js';
import './slide-embed.js';
import './slide-pros-and-cons.js';
import './slide-agenda.js';
import './slide-closing.js';
import './slide-swot.js';
import './slide-quadrant.js';
import './slide-venn-diagram.js';

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
          image-prompt=${c.image_prompt || ''}
          key-takeaway=${c.key_takeaway || ''}
          .editable=${this.editable}
        ></slide-title-and-body>`;

      case 'title_and_bullets':
        return html`<slide-title-and-bullets
          .title=${c.title || ''}
          .bullets=${(c.bullets as string[]) || []}
          image-url=${c.image_url || ''}
          .imageFocus=${c.image_focus || null}
          image-prompt=${c.image_prompt || ''}
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
          image-prompt=${c.image_prompt || ''}
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
          image-prompt=${c.image_prompt || ''}
          key-takeaway=${c.key_takeaway || ''}
          .editable=${this.editable}
        ></slide-image-and-text>`;

      case 'image_gallery':
        return html`<slide-image-gallery
          .title=${c.title || ''}
          .caption=${c.caption || ''}
          .images=${(c.images as string[]) || []}
          .imageDetails=${(c.image_details as Array<{title?: string, caption?: string}>) || []}
          .imageFocuses=${(c.image_focuses as Array<{x: number, y: number}>) || []}
          image-prompt=${c.image_prompt || ''}
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
          image-prompt=${c.image_prompt || ''}
          .title=${c.title || ''}
          .subtitle=${c.subtitle || ''}
          key-takeaway=${c.key_takeaway || ''}
          .editable=${this.editable}
        ></slide-full-image>`;

      case 'timeline':
        return html`<slide-timeline
          .title=${c.title || ''}
          .events=${(c.events as Array<{label: string, title: string, description?: string, position?: number}>) || []}
          key-takeaway=${c.key_takeaway || ''}
          .editable=${this.editable}
        ></slide-timeline>`;

      case 'comparison':
        return html`<slide-comparison
          .title=${c.title || ''}
          .left=${(c.left as {heading: string, bullets: string[], image_url?: string, image_focus?: {x: number, y: number}}) || {heading: '', bullets: []}}
          .right=${(c.right as {heading: string, bullets: string[], image_url?: string, image_focus?: {x: number, y: number}}) || {heading: '', bullets: []}}
          .verdict=${c.verdict || ''}
          key-takeaway=${c.key_takeaway || ''}
          .editable=${this.editable}
        ></slide-comparison>`;

      case 'code':
        return html`<slide-code
          .title=${c.title || ''}
          .code=${c.code || ''}
          .language=${c.language || ''}
          .caption=${c.caption || ''}
          key-takeaway=${c.key_takeaway || ''}
          .editable=${this.editable}
        ></slide-code>`;

      case 'callout':
        return html`<slide-callout
          .title=${c.title || ''}
          .value=${c.value || ''}
          .label=${c.label || ''}
          .body=${c.body || ''}
          key-takeaway=${c.key_takeaway || ''}
          .editable=${this.editable}
        ></slide-callout>`;

      case 'icons_and_text':
        return html`<slide-icons-and-text
          .title=${c.title || ''}
          .items=${(c.items as Array<{icon: string, heading: string, description?: string}>) || []}
          key-takeaway=${c.key_takeaway || ''}
          .editable=${this.editable}
        ></slide-icons-and-text>`;

      case 'team':
        return html`<slide-team
          .title=${c.title || ''}
          .members=${(c.members as Array<{name: string, role: string, bio?: string, image_url?: string, image_focus?: {x: number, y: number}}>) || []}
          key-takeaway=${c.key_takeaway || ''}
          .editable=${this.editable}
        ></slide-team>`;

      case 'embed':
        return html`<slide-embed
          .title=${c.title || ''}
          .url=${c.url || ''}
          .caption=${c.caption || ''}
          aspect-ratio=${c.aspect_ratio || '16:9'}
          key-takeaway=${c.key_takeaway || ''}
          .editable=${this.editable}
        ></slide-embed>`;

      case 'pros_and_cons':
        return html`<slide-pros-and-cons
          .title=${c.title || ''}
          pros-heading=${c.pros_heading || ''}
          cons-heading=${c.cons_heading || ''}
          .pros=${(c.pros as string[]) || []}
          .cons=${(c.cons as string[]) || []}
          key-takeaway=${c.key_takeaway || ''}
          .editable=${this.editable}
        ></slide-pros-and-cons>`;

      case 'agenda':
        return html`<slide-agenda
          .title=${c.title || ''}
          .items=${(c.items as Array<{topic: string, duration?: string, description?: string}>) || []}
          key-takeaway=${c.key_takeaway || ''}
          .editable=${this.editable}
        ></slide-agenda>`;

      case 'closing':
        return html`<slide-closing
          .heading=${c.heading || ''}
          .subheading=${c.subheading || ''}
          .contactLines=${(c.contact_lines as string[]) || []}
          image-url=${c.image_url || ''}
          .imageFocus=${c.image_focus || null}
          key-takeaway=${c.key_takeaway || ''}
          .editable=${this.editable}
        ></slide-closing>`;

      case 'swot':
        return html`<slide-swot
          .title=${c.title || ''}
          .strengths=${(c.strengths as string[]) || []}
          .weaknesses=${(c.weaknesses as string[]) || []}
          .opportunities=${(c.opportunities as string[]) || []}
          .threats=${(c.threats as string[]) || []}
          key-takeaway=${c.key_takeaway || ''}
          .editable=${this.editable}
        ></slide-swot>`;

      case 'quadrant':
        return html`<slide-quadrant
          .title=${c.title || ''}
          .body=${c.body || ''}
          .bullets=${(c.bullets as string[]) || []}
          x-label=${c.x_label || ''}
          y-label=${c.y_label || ''}
          .quadrantLabels=${(c.quadrant_labels as string[]) || []}
          .items=${(c.items as Array<{label: string, x: number, y: number}>) || []}
          key-takeaway=${c.key_takeaway || ''}
          .editable=${this.editable}
        ></slide-quadrant>`;

      case 'venn_diagram':
        return html`<slide-venn-diagram
          .title=${c.title || ''}
          .body=${c.body || ''}
          .circles=${(c.circles as Array<{label: string, items?: string[]}>) || []}
          .overlaps=${(c.overlaps as Array<{sets: number[], label: string}>) || []}
          key-takeaway=${c.key_takeaway || ''}
          .editable=${this.editable}
        ></slide-venn-diagram>`;

      default:
        return html`<div style="padding:48px;color:#c00">Unknown layout: ${layout}</div>`;
    }
  }
}
