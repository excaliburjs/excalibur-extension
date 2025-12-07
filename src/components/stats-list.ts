import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { colors } from '../colors';
import { common } from '../common';

export interface Stats {
  fps: number;
  delta: number;
  frameTime: number;
  updateTime: number;
  drawTime: number;
  frameBudget: number;
  drawCalls: number;
  numActors: number;
  rendererSwaps: number;
}

@customElement('stats-list')
export class StatsList extends LitElement {
  static styles = [
    colors,
    common,
    css`
      :host {
        display: block;
        width: 300px;
      }
      .section {
        position: relative;
        /* border: solid 2px; */
        padding: 10px;
        /* border-radius: 5px; */
        background-color: var(--panel-color);
        margin-bottom: 10px;
      }
    `
  ];

  @property({ type: Object })
  stats: Stats = {
    fps: 0,
    delta: 0,
    frameTime: 0,
    updateTime: 0,
    drawTime: 0,
    frameBudget: 0,
    drawCalls: 0,
    numActors: 0,
    rendererSwaps: 0
  };

  updateStats(stats: Stats) {
    this.stats = stats;
    this.requestUpdate();
  }

  override render() {
    const { fps, frameTime, delta, frameBudget, drawTime, updateTime, drawCalls, numActors, rendererSwaps } = this.stats;
    const frameTime$ = `${frameTime.toFixed(2)}ms (${((frameTime / delta) * 100).toFixed(2)}%)`;
    const drawTime$ = drawTime.toFixed(2);
    const updateTime$ = updateTime.toFixed(2);
    const frameBudget$ = `${frameBudget.toFixed(2)}ms (${((frameBudget / delta) * 100).toFixed(2)}%)`;

    return html`
      <div class="section">
        <div>FPS: <span id="fps">${fps.toFixed(2)}</span></div>
        <div>Frame Time: <span id="frame-time">${frameTime$}</span></div>
        <div>Frame Budget: <span id="frame-budget">${frameBudget$}</span></div>
        <div>Update Time: <span id="update-time">${updateTime$}</span></div>
        <div>Draw Time: <span id="draw-time">${drawTime$}</span></div>
        <div>Draw Calls: <span id="draw-calls">${drawCalls}</span></div>
        <div>Actors: <span id="num-actors">${numActors}</span></div>
        <div>Renderer Swaps: <span id="renderer-swaps">${rendererSwaps}</span></div>
      </div>
    `;
  }
}
