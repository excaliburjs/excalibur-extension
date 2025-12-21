import { css, html, LitElement } from 'lit';
import { colors } from '../colors';
import * as d3 from 'd3';
import { customElement, property } from 'lit/decorators';

const totalHeight = 350; //px
const totalWidth = 900; //px
const tickWidth = 1; // px

const nTicks = Math.floor(totalWidth / tickWidth);
const zeroes = () => 0;

function slugify(str: string) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove non-word chars (except spaces and hyphens)
    .replace(/[\s_]+/g, '-')   // Replace spaces and underscores with hyphens
    .replace(/^-+|-+$/g, '')   // Remove leading/trailing hyphens
    .replace(/^(\d)/, '_$1');  // Prefix with underscore if starts with digit
}

@customElement('system-time-graph')
export class SystemTimeGraph extends LitElement {
  static styles = [
    colors,
    css`
      #system-time-graph {
        background-color: var(--panel-color);
        margin-bottom: 10px;
      }
    `
  ];

  line!: d3.Line<number>;
  systemTimeRoot!: HTMLElement;
  svg!: SVGSVGElement;
  d3Svg!: d3.Selection<SVGSVGElement, undefined, null, undefined>;


  @property() legend: string[] = [];

  timeData: Record<string, number[]> = {};

  override firstUpdated(): void {
    this.systemTimeRoot = this.renderRoot.querySelector('#system-time-graph') as HTMLElement;

    const marginLeft = 10;
    const marginRight = 0;
    const marginTop = 10;
    const marginBottom = -15;

    const x = d3.scaleLinear([0, nTicks], [marginLeft, totalWidth - marginRight]);

    const y = d3.scaleLinear([0, 16], [totalHeight - marginBottom, marginTop]);

    this.d3Svg = d3
      .create('svg')
      .attr('width', tickWidth * nTicks)
      .attr('height', totalHeight)
      .attr('viewBox', [0, 0, totalWidth, totalHeight + 20]) // -10,-10,310,140
      .attr('style', 'max-width: 100%; height: auto; height: intrinsic;');


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
      .text('ECS System Time (ms)');

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

    this.systemTimeRoot.appendChild(this.d3Svg.node()!);
  }

  
  initLegend = false;
  draw(systemDuration: Record<string, number>) {
    const legend = Object.keys(systemDuration);

    const color = d3.scaleOrdinal<string>().domain(legend).range([...d3.schemeDark2, ...d3.schemeAccent]);

    // TODO don't append every draw
    if (!this.initLegend && legend.length) {
      this.initLegend = true;
      this.d3Svg
        .selectAll('mydots')
        .data(legend)
        .enter()
        .append('circle')
        .attr('cx', totalWidth - 270)
        .attr('cy', function (_, i) {
          return 20 + i * 25;
        }) // 100 is where the first dot appears. 25 is the distance between dots
        .attr('r', 7)
        .style('fill', (d) => color(d));

      // Add one dot in the legend for each name.
      this.d3Svg
        .selectAll('mylabels')
        .data(legend)
        .enter()
        .append('text')
        .attr('x', totalWidth - 250)
        .attr('y', function (_, i) {
          return 20 + i * 25;
        }) // 100 is where the first dot appears. 25 is the distance between dots
        .style('fill', function (d) {
          return color(d);
        })
        .text(function (d) {
          return d;
        })
        .attr('text-anchor', 'left')
        .style('alignment-baseline', 'middle');
    }

    for (let key in systemDuration) {
      if(!this.timeData[key]) {
        this.timeData[key] = d3.range(nTicks).map(zeroes);
        this.d3Svg
          .append('path')
          .attr('id', slugify(key))
          .attr('fill', 'none')
          .attr('stroke', color(key))
          .attr('stroke-width', 1.5)
          .attr('d', this.line(this.timeData[key]));
      }
      this.timeData[key].push(systemDuration[key]);
      this.timeData[key].shift();

      // Append a path for the line.
      this.d3Svg.select('path#' + slugify(key)).attr('d', this.line(this.timeData[key]));
    }

    this.requestUpdate();
  }

  override render() {
    return html` <div id="system-time-graph"></div> `;
  }
}
