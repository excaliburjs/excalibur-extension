import { css, html, LitElement } from 'lit';
import { customElement, query } from 'lit/decorators.js';

@customElement('flame-chart')
export class FlameChart extends LitElement {
  static styles = [
    css`
      :host {
        display: block;
      }
    `
  ];

  @query('canvas')
  flameCanvas!: HTMLCanvasElement;

  flameChart!: flameChartJs.FlameChart;

  updateFlame(data: unknown[]): void {
    if (!this.flameChart) {
      this.flameChart = new flameChartJs.FlameChart({
        canvas: this.flameCanvas,
        data: [data],
        settings: {
          styles: {
            main: {
              backgroundColor: '#1a1a1a'
            }
          }
        }
      });
    } else {
      this.flameChart.setNodes(data);
    }
  }

  render() {
    return html`<canvas width="980" height="400"></canvas>`;
  }
}
