import { css, html, LitElement } from 'lit';
import { colors } from '../colors';
import * as d3 from 'd3';
import { customElement } from 'lit/decorators';

const totalHeight = 350; //px
const totalWidth = 900; //px
const tickWidth = 1; // px

const nTicks = Math.floor(totalWidth / tickWidth);
const zeroes = () => 0;
const defaultYMax = 16; // ms

/** Slugifies a string for use as a CSS class or id. */
function slugify(str: string) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove non-word chars (except spaces and hyphens)
    .replace(/[\s_]+/g, '-') // Replace spaces and underscores with hyphens
    .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
    .replace(/^(\d)/, '_$1'); // Prefix with underscore if starts with digit
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
      .legend-item {
        cursor: pointer;
      }
    `
  ];

  override shouldUpdate() {
    return this.isConnected;
  }

  line!: d3.Line<number>;
  systemTimeRoot!: HTMLElement;
  svg!: SVGSVGElement;
  d3Svg!: d3.Selection<SVGSVGElement, undefined, null, undefined>;

  private _color = d3.scaleOrdinal<string>().range([...d3.schemeDark2, ...d3.schemeAccent]);
  private _focusedKey: string | null = null;
  private _legendKeys = ''; // joined key list; guards legend re-join
  private _y!: d3.ScaleLinear<number, number>;
  private _yMax = defaultYMax;

  timeData: Record<string, number[]> = {};

  override firstUpdated(): void {
    this.systemTimeRoot = this.renderRoot.querySelector('#system-time-graph') as HTMLElement;

    const marginLeft = 10;
    const marginRight = 0;
    const marginTop = 10;
    const marginBottom = -15;

    const x = d3.scaleLinear([0, nTicks], [marginLeft, totalWidth - marginRight]);

    const y = (this._y = d3.scaleLinear([0, defaultYMax], [totalHeight - marginBottom, marginTop]));

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
      .y((d) => this._y(d));

    // draw max line
    this.d3Svg
      .append('line')
      .attr('id', 'budget-line')
      .style('stroke-dasharray', '3, 3')
      .attr('stroke', 'currentColor')
      .attr('x1', x(0))
      .attr('x2', x(nTicks * 0.75))
      .attr('y1', y(16.6))
      .attr('y2', y(16.6));

    this.d3Svg.append('g').attr('id', 'legend');

    this.systemTimeRoot.appendChild(this.d3Svg.node()!);
  }

  draw(systemDuration: Record<string, number>) {
    if (!this.isConnected) {
      return;
    }

    // prune series that no longer exist (scene change)
    let pruned = false;
    for (const key of Object.keys(this.timeData)) {
      if (!(key in systemDuration)) {
        delete this.timeData[key];
        this.d3Svg.select('path#' + slugify(key)).remove();
        if (this._focusedKey === key) {
          this._focusedKey = null;
        }
        pruned = true;
      }
    }

    for (const key in systemDuration) {
      if (!this.timeData[key]) {
        this.timeData[key] = d3.range(nTicks).map(zeroes);
        const focused = this._focusedKey === null || this._focusedKey === key;
        this.d3Svg
          .append('path')
          .attr('id', slugify(key))
          .attr('fill', 'none')
          .attr('stroke', this._color(key))
          .attr('stroke-width', this._focusedKey === key ? 2.5 : 1.5)
          .attr('stroke-opacity', focused ? 1 : 0.15)
          .attr('d', this.line(this.timeData[key]));
      }
      this.timeData[key].push(systemDuration[key]);
      this.timeData[key].shift();
    }

    this._rescaleY();

    for (const key in systemDuration) {
      this.d3Svg.select('path#' + slugify(key)).attr('d', this.line(this.timeData[key]));
    }

    this._updateLegend(Object.keys(systemDuration));
    if (pruned) {
      this._applyFocus();
    }

    this.requestUpdate();
  }

  /**
   * Rebuilds the legend from the current series keys via a d3 data join;
   * no-op while the key set is unchanged.
   */
  private _updateLegend(keys: string[]) {
    const joined = keys.join(',');
    if (joined === this._legendKeys) {
      return;
    }
    this._legendKeys = joined;

    const items = this.d3Svg
      .select<SVGGElement>('g#legend')
      .selectAll<SVGGElement, string>('g.legend-item')
      .data(keys, (d) => d);

    const enter = items
      .enter()
      .append('g')
      .attr('class', 'legend-item')
      .on('click', (_event, d) => this._toggleFocus(d));

    enter.append('rect').attr('x', -10).attr('y', -10).attr('width', 260).attr('height', 20).attr('fill', 'transparent');

    enter
      .append('circle')
      .attr('r', 7)
      .style('fill', (d) => this._color(d));

    enter
      .append('text')
      .attr('x', 20)
      .style('fill', (d) => this._color(d))
      .text((d) => d)
      .attr('text-anchor', 'left')
      .style('alignment-baseline', 'middle');

    enter.merge(items).attr('transform', (_, i) => `translate(${totalWidth - 270}, ${20 + i * 25})`);

    items.exit().remove();

    this._applyFocus();
  }

  /** Toggles focus on a series; re-clicking the focused key clears it. */
  private _toggleFocus(key: string) {
    this._focusedKey = this._focusedKey === key ? null : key;
    this._rescaleY();
    this._applyFocus();
  }

  /**
   * Zooms the y axis to fit the focused series (nice-rounded), or restores
   * the default range when nothing is focused; redraws axis, budget line,
   * and series paths only when the domain actually changes.
   */
  private _rescaleY() {
    let max = defaultYMax;
    if (this._focusedKey !== null && this.timeData[this._focusedKey]) {
      max = Math.max(1, ...this.timeData[this._focusedKey]);
    }
    this._y.domain([0, max]);
    if (this._focusedKey !== null) {
      this._y.nice(5);
    }
    const domainMax = this._y.domain()[1];
    if (domainMax === this._yMax) {
      return;
    }
    this._yMax = domainMax;
    this.d3Svg.select<SVGGElement>('g#yAxis').call(d3.axisLeft(this._y).tickArguments([5]));
    this.d3Svg.select('line#budget-line').attr('y1', this._y(16.6)).attr('y2', this._y(16.6));
    for (const key of Object.keys(this.timeData)) {
      this.d3Svg.select('path#' + slugify(key)).attr('d', this.line(this.timeData[key]));
    }
  }

  /** Applies the focus dim/highlight state to series paths and legend items. */
  private _applyFocus() {
    for (const key of Object.keys(this.timeData)) {
      const focused = this._focusedKey === null || this._focusedKey === key;
      this.d3Svg
        .select('path#' + slugify(key))
        .attr('stroke-opacity', focused ? 1 : 0.15)
        .attr('stroke-width', this._focusedKey === key ? 2.5 : 1.5);
    }
    this.d3Svg
      .select('g#legend')
      .selectAll<SVGGElement, string>('g.legend-item')
      .attr('opacity', (d) => (this._focusedKey === null || this._focusedKey === d ? 1 : 0.35));
  }

  /** Clears all series data, paths, legend, and focus (instance/frame change). */
  reset() {
    if (!this.d3Svg) {
      return;
    }
    for (const key of Object.keys(this.timeData)) {
      this.d3Svg.select('path#' + slugify(key)).remove();
    }
    this.timeData = {};
    this.d3Svg.select('g#legend').selectAll('*').remove();
    this._focusedKey = null;
    this._legendKeys = '';
    this._rescaleY();
  }

  override render() {
    return html` <div id="system-time-graph"></div> `;
  }
}
