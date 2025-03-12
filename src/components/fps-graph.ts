import * as d3 from 'd3';
import { css, html, LitElement } from 'lit';
import { customElement } from 'lit/decorators';
import { colors } from '../colors';

@customElement('fps-graph')
export class FpsGraph extends LitElement {
  static styles = [
    colors,
    css`
      #fps-chart {
        background-color: var(--panel-color);
        margin-bottom: 10px;
      }
    `
  ];

  data: number[] = [];

  line!: d3.Line<number>;
  fpsChartRoot!: HTMLElement;
  svg!: SVGSVGElement;
  d3Svg!: d3.Selection<SVGSVGElement, undefined, null, undefined>;

  override firstUpdated(): void {
    this.fpsChartRoot = this.renderRoot.querySelector('#fps-chart') as HTMLElement;

    const totalHeight = 100; //px
    const totalWidth = 300; //px
    const tickWidth = 1; // px

    const nTicks = Math.floor(totalWidth / tickWidth);
    const zeroes = () => 0;
    this.data = d3.range(nTicks).map(zeroes);

    const marginLeft = 10;
    const marginRight = 0;
    const marginTop = 10;
    const marginBottom = -15;

    const x = d3.scaleLinear([0, nTicks], [marginLeft, totalWidth - marginRight]);

    const y = d3.scaleLinear([0, 120], [totalHeight - marginBottom, marginTop]);

    this.d3Svg = d3
      .create('svg')
      .attr('width', tickWidth * this.data.length)
      .attr('height', totalHeight)
      .attr('viewBox', [0, 0, totalWidth, totalHeight + 20]) // -10,-10,310,140
      .attr('style', 'max-width: 100%; height: auto; height: intrinsic;');

    this.d3Svg
      .append('g')
      .attr('id', 'yAxis')
      .attr('transform', `translate(${0},0)`)
      .call(d3.axisLeft(y).tickArguments([4]));

    this.d3Svg
      .append('text')
      .style('fill', 'currentColor')
      .attr('class', 'y label')
      .attr('text-anchor', 'start')
      .attr('y', marginTop)
      .attr('x', 20)
      .attr('dy', '.75em')
      .text('FPS');

    this.line = d3
      .line<number>()
      .x((_, index) => x(index))
      .y((d) => y(d));

    // draw first line
    this.d3Svg
      .append('path')
      .attr('id', 'line')
      .attr('fill', 'none')
      .attr('stroke', 'steelblue')
      .attr('stroke-width', 1.5)
      .attr('d', this.line(this.data));

    this.svg = this.d3Svg.node() as SVGSVGElement;

    this.fpsChartRoot.appendChild(this.svg);
  }

  draw(fps: number) {
    this.data.push(fps);
    this.data.shift();

    // Append a path for the line.
    this.d3Svg
      .select('path#line')
      .attr('fill', 'none')
      .attr('stroke', 'steelblue')
      .attr('stroke-width', 1.5)
      .attr('d', this.line(this.data));

    this.requestUpdate();
  }

  override render() {
    return html`<div id="fps-chart" class="chart"></div>`;
  }
}
