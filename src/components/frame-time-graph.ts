import { LitElement, css, html } from "lit";
import { colors } from "../colors";
import * as d3 from "d3";
import { customElement } from "lit/decorators";


@customElement('frame-time-graph')
export class FrameTimeGraph extends LitElement {
    static styles = [
        colors,
        css`
            #frame-time-graph {
                background-color: var(--panel-color);
                margin-bottom: 10px;
            }
        `
    ]

    line!: d3.Line<number>;
    frameTimeRoot!: HTMLElement;
    svg!: SVGSVGElement;
    d3Svg!: d3.Selection<SVGSVGElement, undefined, null, undefined>;

    frameTimeData: number[] = [];
    updateTimeData: number[] = [];
    drawTimeData: number[] = [];

    override firstUpdated(): void {
        this.frameTimeRoot = this.renderRoot.querySelector('#frame-time-graph') as HTMLElement;

        const legendKeys = ['Total', 'Update', 'Draw'] as const;
        const color = d3.scaleOrdinal<string>().domain(legendKeys).range(d3.schemeDark2);

        const totalHeight = 100;//px
        const totalWidth = 300;//px
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

        this.d3Svg = d3.create('svg')
            .attr('width', tickWidth * this.frameTimeData.length)
            .attr('height', totalHeight)
            .attr("viewBox", [0, 0, totalWidth, totalHeight + 20]) // -10,-10,310,140
            .attr("style", "max-width: 100%; height: auto; height: intrinsic;");

        this.d3Svg.selectAll("mydots")
            .data(legendKeys)
            .enter()
            .append("circle")
            .attr("cx", 250)
            .attr("cy", function (d, i) { return 20 + i * 25 }) // 100 is where the first dot appears. 25 is the distance between dots
            .attr("r", 7)
            .style("fill", (d) => color(d))

        // Add one dot in the legend for each name.
        this.d3Svg.selectAll("mylabels")
            .data(legendKeys)
            .enter()
            .append("text")
            .attr("x", 270)
            .attr("y", function (d, i) { return 20 + i * 25 }) // 100 is where the first dot appears. 25 is the distance between dots
            .style("fill", function (d) { return color(d) })
            .text(function (d) { return d })
            .attr("text-anchor", "left")
            .style("alignment-baseline", "middle")

        this.d3Svg.append("g")
            .attr('id', 'yAxis')
            .attr("transform", `translate(${0},0)`)
            .call(d3.axisLeft(y).tickArguments([5]));

        this.d3Svg.append("text")
            .style('fill', 'currentColor')
            .attr("class", "y label")
            .attr("text-anchor", "start")
            .attr("y", marginTop)
            .attr("x", 20)
            .attr("dy", ".75em")
            // .attr("transform", "rotate(-90)")
            .text("Frame Time (ms)");

        this.line = d3.line<number>()
            .x((_, index) => x(index))
            .y(d => y(d));

        // draw max line
        this.d3Svg.append("line")
            .style("stroke-dasharray", "3, 3")
            .attr("stroke", "currentColor")
            .attr("x1", x(0))
            .attr("x2", x(nTicks * .75))
            .attr("y1", y(16.6))
            .attr("y2", y(16.6))


        this.d3Svg.append("path")
            .attr('id', 'line')
            .attr("fill", "none")
            .attr("stroke", color(legendKeys[0]))
            .attr("stroke-width", 1.5)
            .attr("d", this.line(this.frameTimeData));

        this.d3Svg.append("path")
            .attr('id', 'line-update')
            .attr("fill", "none")
            .attr("stroke", color(legendKeys[1]))
            .attr("stroke-width", 1.5)
            .attr("d", this.line(this.updateTimeData));

        this.d3Svg.append("path")
            .attr('id', 'line-draw')
            .attr("fill", "none")
            .attr("stroke", color(legendKeys[2]))
            .attr("stroke-width", 1.5)
            .attr("d", this.line(this.drawTimeData));


        this.frameTimeRoot.appendChild(this.d3Svg.node()!);
    }

    draw(frameTime: number, updateTime: number, drawTime: number, max: number) {
        this.frameTimeData.push(frameTime);
        this.frameTimeData.shift();
        this.updateTimeData.push(updateTime);
        this.updateTimeData.shift();
        this.drawTimeData.push(drawTime);
        this.drawTimeData.shift();

        // Append a path for the line.
        this.d3Svg.select("path#line")
            .attr("d", this.line(this.frameTimeData));

        this.d3Svg.select("path#line-update")
            .attr("d", this.line(this.updateTimeData));
    
            this.d3Svg.select("path#line-draw")
            .attr("d", this.line(this.drawTimeData));

        this.requestUpdate();
    }

    override render() {
        return html`
            <div id="frame-time-graph"></div>
        `
    }
}