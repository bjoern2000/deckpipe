import { html, svg, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { SlideBase } from './slide-base.js';
import { md, mdInline } from '../utils/markdown.js';

interface VennCircle {
  label: string;
  items?: string[];
}

interface VennOverlap {
  sets: number[];
  label: string;
}

interface CircleGeometry {
  cx: number;
  cy: number;
  r: number;
}

function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h * 360, s * 100, l * 100];
}

@customElement('slide-venn-diagram')
export class SlideVennDiagram extends SlideBase {
  static styles = [
    SlideBase.baseStyles,
    css`
      .layout {
        flex: 1;
        display: flex;
        min-height: 0;
        gap: 0;
      }
      .left-panel {
        width: 38%;
        display: flex;
        flex-direction: column;
        justify-content: flex-start;
        padding-right: 24px;
        flex-shrink: 0;
      }
      .left-panel h1 {
        margin-bottom: 16px;
      }
      .body {
        font-size: 0.9em;
        color: var(--dp-text-body, #334155);
        line-height: 1.5;
      }
      .body :first-child { margin-top: 0; }
      .body :last-child { margin-bottom: 0; }
      .diagram-wrapper {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 0;
      }
      svg {
        width: 100%;
        height: 100%;
        max-height: 100%;
      }
      svg text {
        font-family: var(--dp-font-heading, 'DM Sans', sans-serif);
        pointer-events: none;
      }
      .circle-label {
        font-size: 13px;
        font-weight: 700;
        fill: var(--dp-text-title, #0f172a);
      }
      .circle-item {
        font-size: 9px;
        font-weight: 400;
        fill: var(--dp-text-body, #334155);
      }
      .overlap-label {
        font-size: 9px;
        font-weight: 600;
        fill: var(--dp-text-body, #475569);
      }
    `,
  ];

  @property() title = '';
  @property() body = '';
  @property({ type: Array }) circles: VennCircle[] = [];
  @property({ type: Array }) overlaps: VennOverlap[] = [];
  @property({ attribute: 'key-takeaway' }) keyTakeaway = '';
  @property({ type: Boolean }) editable = false;

  @state() private accentColor = '#7c3aed';

  connectedCallback() {
    super.connectedCallback();
    requestAnimationFrame(() => {
      const accent = getComputedStyle(this).getPropertyValue('--dp-accent').trim();
      if (accent && accent.startsWith('#')) this.accentColor = accent;
    });
  }

  updated(changed: Map<string, unknown>) {
    super.updated(changed);
    const accent = getComputedStyle(this).getPropertyValue('--dp-accent').trim();
    if (accent && accent.startsWith('#') && accent !== this.accentColor) {
      this.accentColor = accent;
    }
  }

  private getCircleGeometry(): CircleGeometry[] {
    const count = this.circles.length;
    if (count === 2) {
      return [
        { cx: 150, cy: 160, r: 115 },
        { cx: 270, cy: 160, r: 115 },
      ];
    }
    // Spread circles further apart so overlap zones are distinct
    return [
      { cx: 210, cy: 120, r: 105 },
      { cx: 140, cy: 240, r: 105 },
      { cx: 280, cy: 240, r: 105 },
    ];
  }

  private getCircleColor(index: number): string {
    const [h, s, l] = hexToHsl(this.accentColor);
    const count = this.circles.length;
    const offsets = count === 2 ? [0, 180] : [0, 120, 240];
    const hue = (h + offsets[index]) % 360;
    return `hsl(${hue}, ${Math.min(s, 70)}%, ${Math.max(l, 45)}%)`;
  }

  private getExclusiveLabelPos(index: number): { x: number; y: number } {
    const geo = this.getCircleGeometry();
    const count = this.circles.length;
    // Push labels toward the outer edge of each circle (away from the center of the diagram)
    const cx = geo.reduce((s, g) => s + g.cx, 0) / geo.length;
    const cy = geo.reduce((s, g) => s + g.cy, 0) / geo.length;
    const dx = geo[index].cx - cx;
    const dy = geo[index].cy - cy;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const push = count === 2 ? 50 : 48;
    return {
      x: geo[index].cx + (dx / dist) * push,
      y: geo[index].cy + (dy / dist) * push,
    };
  }

  private getOverlapPos(sets: number[]): { x: number; y: number } {
    const geo = this.getCircleGeometry();
    const center = {
      x: geo.reduce((s, g) => s + g.cx, 0) / geo.length,
      y: geo.reduce((s, g) => s + g.cy, 0) / geo.length,
    };
    if (sets.length === 3) {
      return center;
    }
    // Place pairwise overlap labels at the midpoint of the two circles,
    // then push AWAY from the third circle (or diagram center for 2-circle)
    const [a, b] = sets;
    const mid = {
      x: (geo[a].cx + geo[b].cx) / 2,
      y: (geo[a].cy + geo[b].cy) / 2,
    };
    if (this.circles.length === 2) return mid;
    // Find the third circle index and push away from it
    const third = [0, 1, 2].find(i => i !== a && i !== b)!;
    const dx = mid.x - geo[third].cx;
    const dy = mid.y - geo[third].cy;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const push = 22;
    return {
      x: mid.x + (dx / dist) * push,
      y: mid.y + (dy / dist) * push,
    };
  }

  private getOverlapWidth(sets: number[]): number {
    const geo = this.getCircleGeometry();
    if (sets.length === 3) return 50;
    const [a, b] = sets;
    const dx = geo[b].cx - geo[a].cx;
    const dy = geo[b].cy - geo[a].cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    // Overlap lens width = 2*r - dist, use ~60% as safe text zone
    const lensWidth = (geo[a].r + geo[b].r) - dist;
    return Math.max(40, lensWidth * 0.6);
  }

  private wrapText(text: string, maxWidth: number): string[] {
    const charWidth = 4.5; // approx px per char at 9px font
    const maxChars = Math.floor(maxWidth / charWidth);
    const words = text.split(' ');
    const lines: string[] = [];
    let line = '';
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (test.length > maxChars && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  private getViewBox(): string {
    return this.circles.length === 2 ? '0 0 420 320' : '0 0 420 380';
  }

  render() {
    const hasLeft = this.title || this.body;
    const geo = this.getCircleGeometry();

    return html`
      <div class="slide">
        ${!hasLeft && this.title ? html`<h1>${this.title}</h1>` : nothing}
        ${!hasLeft ? this.renderKeyTakeaway(this.keyTakeaway, this.editable) : nothing}
        <div class="layout">
          ${hasLeft ? html`
            <div class="left-panel">
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
              ${this.body
                ? this.editable
                  ? this.wrapDeletable('body', html`
                      <div class="body" contenteditable="true"
                        @blur=${(e: FocusEvent) => this.emitChange('body', (e.target as HTMLElement).textContent)}
                      >${this.body}</div>
                    `)
                  : html`<div class="body">${md(this.body)}</div>`
                : nothing}
            </div>
          ` : nothing}
          <div class="diagram-wrapper">
            <svg viewBox="${this.getViewBox()}" xmlns="http://www.w3.org/2000/svg">
              ${geo.map((c, i) => svg`
                <circle
                  cx="${c.cx}" cy="${c.cy}" r="${c.r}"
                  fill="${this.getCircleColor(i)}"
                  fill-opacity="0.25"
                  stroke="${this.getCircleColor(i)}"
                  stroke-width="2"
                  stroke-opacity="0.6"
                  style="mix-blend-mode: multiply"
                />
              `)}
              ${this.circles.map((circle, i) => {
                const pos = this.getExclusiveLabelPos(i);
                const items = circle.items || [];
                return svg`
                  <text class="circle-label" x="${pos.x}" y="${pos.y}" text-anchor="middle" dominant-baseline="central">
                    ${circle.label}
                  </text>
                  ${items.map((item, j) => svg`
                    <text class="circle-item" x="${pos.x}" y="${pos.y + 16 + j * 13}" text-anchor="middle" dominant-baseline="central">
                      ${item}
                    </text>
                  `)}
                `;
              })}
              ${(this.overlaps || []).map(overlap => {
                const pos = this.getOverlapPos(overlap.sets);
                const maxW = this.getOverlapWidth(overlap.sets);
                const lines = this.wrapText(overlap.label, maxW);
                const lineHeight = 11;
                const startY = pos.y - ((lines.length - 1) * lineHeight) / 2;
                return svg`
                  <text class="overlap-label" x="${pos.x}" text-anchor="middle">
                    ${lines.map((line, i) => svg`
                      <tspan x="${pos.x}" y="${startY + i * lineHeight}">${line}</tspan>
                    `)}
                  </text>
                `;
              })}
            </svg>
          </div>
        </div>
      </div>
    `;
  }
}
