import { css, html, LitElement } from 'lit';
import { colors } from '../colors';
import * as d3 from 'd3';
import { customElement } from 'lit/decorators';

@customElement('frame-time-graph')
export class FrameTimeGraph extends LitElement {
  static styles = [
    colors,
    css`
      #frame-time-graph {
        background-color: var(--panel-color);
        margin-bottom: 10px;
      }
      .legend-item {
        cursor: pointer;
      }
    `
  ];

  override shouldUpdate() {
    return this.isConnected;
  }

  line!: d3.Line<number>;
  frameTimeRoot!: HTMLElement;
  svg!: SVGSVGElement;
  d3Svg!: d3.Selection<SVGSVGElement, undefined, null, undefined>;

  frameTimeData: number[] = [];
  updateTimeData: number[] = [];
  drawTimeData: number[] = [];

  private static readonly _PATH_IDS: Record<string, string> = {
    Total: 'line',
    Update: 'line-update',
    Draw: 'line-draw'
  };

  private _focusedKey: string | null = null;

  override firstUpdated(): void {
    this.frameTimeRoot = this.renderRoot.querySelector('#frame-time-graph') as HTMLElement;

    const legendKeys = ['Total', 'Update', 'Draw'] as const;
    const color = d3.scaleOrdinal<string>().domain(legendKeys).range(d3.schemeDark2);

    const totalHeight = 100; //px
    const totalWidth = 300; //px
    const tickWidth = 1; // px

    const nTicks = Math.floor(totalWidth / tickWidth);
    const zeroes = () => 0;
    this.frameTimeData = d3.range(nTicks).map(zeroes);
    this.updateTimeData = d3.range(nTicks).map(zeroes);
    this.drawTimeData = d3.range(nTicks).map(zeroes);

    const marginLeft = 10;
    const marginRight = 0;
    const marginTop = 10;
    const marginBottom = -15;

    const x = d3.scaleLinear([0, nTicks], [marginLeft, totalWidth - marginRight]);

    const y = d3.scaleLinear([0, 33.333], [totalHeight - marginBottom, marginTop]);

    this.d3Svg = d3
      .create('svg')
      .attr('width', tickWidth * this.frameTimeData.length)
      .attr('height', totalHeight)
      .attr('viewBox', [0, 0, totalWidth, totalHeight + 20]) // -10,-10,310,140
      .attr('style', 'max-width: 100%; height: auto; height: intrinsic;');

    const legendItems = this.d3Svg
      .selectAll('g.legend-item')
      .data(legendKeys)
      .enter()
      .append('g')
      .attr('class', 'legend-item')
      .attr('transform', (_, i) => `translate(250, ${20 + i * 25})`) // 25 is the distance between dots
      .on('click', (_event, d) => this._toggleFocus(d));

    legendItems
      .append('rect')
      .attr('x', -10)
      .attr('y', -10)
      .attr('width', 60)
      .attr('height', 20)
      .attr('fill', 'transparent');

    legendItems
      .append('circle')
      .attr('r', 7)
      .style('fill', (d) => color(d));

    legendItems
      .append('text')
      .attr('x', 20)
      .style('fill', (d) => color(d))
      .text((d) => d)
      .attr('text-anchor', 'left')
      .style('alignment-baseline', 'middle');

    this.d3Svg
      .append('g')
      .attr('id', 'yAxis')
      .attr('transform', `translate(${0},0)`)
      .call(d3.axisLeft(y).tickArguments([5]));

    this.d3Svg
      .append('text')
      .style('fill', 'currentColor')
      .attr('class', 'y label')
      .attr('text-anchor', 'start')
      .attr('y', marginTop)
      .attr('x', 20)
      .attr('dy', '.75em')
      // .attr("transform", "rotate(-90)")
      .text('Frame Time (ms)');

    this.line = d3
      .line<number>()
      .x((_, index) => x(index))
      .y((d) => y(d));

    // draw max line
    this.d3Svg
      .append('line')
      .style('stroke-dasharray', '3, 3')
      .attr('stroke', 'currentColor')
      .attr('x1', x(0))
      .attr('x2', x(nTicks * 0.75))
      .attr('y1', y(16.6))
      .attr('y2', y(16.6));

    this.d3Svg
      .append('path')
      .attr('id', 'line')
      .attr('fill', 'none')
      .attr('stroke', color(legendKeys[0]))
      .attr('stroke-width', 1.5)
      .attr('d', this.line(this.frameTimeData));

    this.d3Svg
      .append('path')
      .attr('id', 'line-update')
      .attr('fill', 'none')
      .attr('stroke', color(legendKeys[1]))
      .attr('stroke-width', 1.5)
      .attr('d', this.line(this.updateTimeData));

    this.d3Svg
      .append('path')
      .attr('id', 'line-draw')
      .attr('fill', 'none')
      .attr('stroke', color(legendKeys[2]))
      .attr('stroke-width', 1.5)
      .attr('d', this.line(this.drawTimeData));

    this.frameTimeRoot.appendChild(this.d3Svg.node()!);
  }

  /** Toggles focus on a series; re-clicking the focused key clears it. */
  private _toggleFocus(key: string) {
    this._focusedKey = this._focusedKey === key ? null : key;
    for (const [legendKey, pathId] of Object.entries(FrameTimeGraph._PATH_IDS)) {
      const focused = this._focusedKey === null || this._focusedKey === legendKey;
      this.d3Svg
        .select('path#' + pathId)
        .attr('stroke-opacity', focused ? 1 : 0.15)
        .attr('stroke-width', this._focusedKey === legendKey ? 2.5 : 1.5);
    }
    this.d3Svg
      .selectAll<SVGGElement, string>('g.legend-item')
      .attr('opacity', (d) => (this._focusedKey === null || this._focusedKey === d ? 1 : 0.35));
  }

  draw(frameTime: number, updateTime: number, drawTime: number) {
    if (!this.isConnected) {
      return;
    }
    this.frameTimeData.push(frameTime);
    this.frameTimeData.shift();
    this.updateTimeData.push(updateTime);
    this.updateTimeData.shift();
    this.drawTimeData.push(drawTime);
    this.drawTimeData.shift();

    // Append a path for the line.
    this.d3Svg.select('path#line').attr('d', this.line(this.frameTimeData));

    this.d3Svg.select('path#line-update').attr('d', this.line(this.updateTimeData));

    this.d3Svg.select('path#line-draw').attr('d', this.line(this.drawTimeData));

    this.requestUpdate();
  }

  override render() {
    return html` <div id="frame-time-graph"></div> `;
  }
}
