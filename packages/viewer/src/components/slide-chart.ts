import { html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { SlideBase } from './slide-base.js';
import {
  Chart,
  BarController,
  LineController,
  PieController,
  DoughnutController,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Legend,
  Tooltip,
  Filler,
} from 'chart.js';

Chart.register(
  BarController, LineController, PieController, DoughnutController,
  CategoryScale, LinearScale,
  BarElement, LineElement, PointElement, ArcElement,
  Legend, Tooltip, Filler,
);

interface ChartDataset {
  label?: string;
  values: number[];
  color?: string;
}

interface ChartData {
  labels: string[];
  datasets: ChartDataset[];
}

@customElement('slide-chart')
export class SlideChart extends SlideBase {
  static styles = [
    SlideBase.baseStyles,
    css`
      .chart-area {
        flex: 1;
        min-height: 0;
        position: relative;
        padding: 8px 0;
      }
      canvas {
        display: block;
        width: 100%;
        height: 100%;
      }
    `,
  ];

  @property() title = '';
  @property() chartType: 'bar' | 'line' | 'pie' | 'donut' = 'bar';
  @property({ type: Object }) data: ChartData = { labels: [], datasets: [] };
  @property({ attribute: 'key-takeaway' }) keyTakeaway = '';
  @property({ type: Boolean }) editable = false;

  private chart: Chart | null = null;

  private getAccentColor(): string {
    return getComputedStyle(this).getPropertyValue('--dp-accent').trim() || '#7c3aed';
  }

  private getBodyFont(): string {
    const raw = getComputedStyle(this).getPropertyValue('--dp-font-body').trim();
    return raw ? raw.replace(/^'|'$/g, '').split(',')[0].trim() : 'DM Sans';
  }

  private hexToHsl(hex: string): { h: number; s: number; l: number } {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      else if (max === g) h = ((b - r) / d + 2) / 6;
      else h = ((r - g) / d + 4) / 6;
    }
    return { h: h * 360, s: s * 100, l: l * 100 };
  }

  private hslToHex(h: number, s: number, l: number): string {
    s /= 100; l /= 100;
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => {
      const k = (n + h / 30) % 12;
      const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  }

  private getColorPalette(count: number): string[] {
    const accent = this.getAccentColor();
    if (count === 1) return [accent];
    const { h, s, l } = this.hexToHsl(accent);
    return Array.from({ length: count }, (_, i) =>
      this.hslToHex((h + (i * 360) / count) % 360, s, l)
    );
  }

  private createChart(canvas: HTMLCanvasElement) {
    const font = this.getBodyFont();
    const type = this.chartType === 'donut' ? 'doughnut' : this.chartType;
    const isPieType = type === 'pie' || type === 'doughnut';

    const colors = isPieType
      ? this.getColorPalette(this.data.labels.length)
      : this.getColorPalette(this.data.datasets.length);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const datasets: any[] = this.data.datasets.map((ds, i) => {
      if (isPieType) {
        return {
          label: ds.label || '',
          data: ds.values,
          backgroundColor: ds.color
            ? this.data.labels.map(() => ds.color!)
            : colors,
          borderColor: '#ffffff',
          borderWidth: 2,
        };
      } else if (type === 'line') {
        const c = ds.color || colors[i];
        return {
          label: ds.label || '',
          data: ds.values,
          borderColor: c,
          backgroundColor: c + '20',
          fill: true,
          tension: 0.3,
          pointBackgroundColor: c,
          pointRadius: 4,
          borderWidth: 2.5,
        };
      } else {
        const c = ds.color || colors[i];
        return {
          label: ds.label || '',
          data: ds.values,
          backgroundColor: c,
          borderColor: c,
          borderWidth: 0,
          borderRadius: 4,
        };
      }
    });

    this.chart = new Chart(canvas, {
      type,
      data: {
        labels: this.data.labels,
        datasets,
      },
      options: {
        responsive: false,
        animation: false,
        plugins: {
          legend: {
            display: this.data.datasets.length > 1 || isPieType,
            position: isPieType ? 'right' : 'top',
            labels: {
              font: { family: font, size: 13 },
              color: '#334155',
              padding: 16,
              usePointStyle: true,
            },
          },
          tooltip: { enabled: false },
        },
        scales: isPieType ? {} : {
          x: {
            grid: { display: false },
            ticks: {
              font: { family: font, size: 12 },
              color: '#64748b',
            },
          },
          y: {
            grid: { color: '#e2e8f0' },
            ticks: {
              font: { family: font, size: 12 },
              color: '#64748b',
            },
            beginAtZero: true,
          },
        },
      },
    });
  }

  protected updated(changedProperties: Map<string, unknown>) {
    super.updated(changedProperties);
    const canvas = this.renderRoot.querySelector('canvas') as HTMLCanvasElement | null;
    const area = this.renderRoot.querySelector('.chart-area') as HTMLElement | null;
    if (!canvas || !area || this.data.labels.length === 0) return;

    // Set explicit pixel dimensions so Chart.js doesn't fight with CSS transforms
    canvas.width = area.clientWidth;
    canvas.height = area.clientHeight;

    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
    this.createChart(canvas);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.chart?.destroy();
    this.chart = null;
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
        <div class="chart-area">
          <canvas></canvas>
        </div>
      </div>
    `;
  }
}
