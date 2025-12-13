import { css, html, LitElement } from "lit";
import { customElement, property } from "lit/decorators";
import { colors } from "../colors";
import { common } from "../common";
import { BoundingBox, Color, DisplayMode, EngineOptions, Resolution, ViewportDimension } from "../@types/excalibur";

const colorToHex = (color: Color) => {
  const r = color.r.toString(16).padStart(2, '0');
  const g = color.g.toString(16).padStart(2, '0');
  const b = color.b.toString(16).padStart(2, '0');
  const a = Math.floor(color.a * 255).toString(16).padStart(2, '0');
  return `#${r}${g}${b}${a}`;
};

@customElement('screen-camera')
export class ScreenAndCamera extends LitElement {
  static styles = [
    colors,
    common,
    css`
      :host {
        display: block;
      }
    `
  ];


  @property({ type: Object }) screen: {
    viewport: ViewportDimension,
    resolution: Resolution,
    displayMode: DisplayMode,
    pixelRatio: number,
    unsafeArea: BoundingBox,
    contentArea: BoundingBox
  } = {} as any;

  @property({ type: Object }) config: EngineOptions = {};
  @property({ type: Object }) camera: any = {};

  render() {
    return html`

<div class="row">
  <div class="widget">
    <h2>Screen</h2>
    <div class="section">
      <div class="form-row"><label>Display Mode:</label> <span>${this.config.displayMode}</span></div>
      <div class="form-row"><label>Pixel Ratio (HiDPI > 1.0):</label> <span> ${this.screen.pixelRatio.toFixed(1)}</span></div>
      <div class="form-row"><label>Resolution (Game Pixels):</label> <span> dim[${Math.ceil(this.screen.resolution?.width)}x ${Math.ceil(this.screen.resolution?.height)}]</span> </div>
      <div class="form-row"><label>Viewport (CSS Pixels):</label> <span> dim[${Math.ceil(this.screen.viewport?.width)} x ${Math.ceil(this.screen.viewport?.height)}]</span> </div>
      <div class="form-row"><label>Unsafe Area (Screen Space):</label> <span> pos(${this.screen.unsafeArea.left.toFixed(2)}, dim[${Math.ceil(this.screen.unsafeArea.right - this.screen.unsafeArea.left)} x ${Math.ceil(this.screen.unsafeArea.bottom - this.screen.unsafeArea.top)}]</span> </div>
      <div class="form-row"><label>Content Area (Screen Space):</label> <span> pos(${this.screen.contentArea.left.toFixed(2)}, ${this.screen.contentArea.top.toFixed(2)}) dim[${Math.ceil(this.screen.contentArea.right - this.screen.contentArea.left)} x ${Math.ceil(this.screen.contentArea.bottom - this.screen.contentArea.top)}]</span> </div>
      <div class="form-row">
        <div>Background Color:</div>
        <div class="form-row">${colorToHex(this.config.backgroundColor!)}<sl-color-picker format="hexa" .value=${colorToHex(this.config.backgroundColor!)} disabled></sl-color-picker></div>
      </div>
      <div class="form-row"><label>Pixel Art:</label> <span> ${this.config.pixelArt}</span></div>
      <div class="form-row"><label>Canvas Transparency:</label> <span> ${this.config.enableCanvasTransparency}</span></div>
      <div class="form-row"><label>Canvas Context Menu Enabled:</label> <span> ${this.config.enableCanvasContextMenu}</span></div>
      <div class="form-row"><label>Snap To Pixel:</label> <span> ${this.config.snapToPixel}</span></div>
      <hr>
      <h3>Antialiasing Settings</h3>
        <div class="form-row"><label>canvasImageRendering:</label> <span> ${typeof this.config.antialiasing === 'object' ? this.config.antialiasing.canvasImageRendering : ''}</span></div>
        <div class="form-row"><label>default filtering:</label> <span> ${typeof this.config.antialiasing === 'object' ? this.config.antialiasing.filtering : ''}</span></div>
        <div class="form-row"><label>multiSampleAntialiasing:</label> <span> ${typeof this.config.antialiasing === 'object' ? this.config.antialiasing.multiSampleAntialiasing : ''}</span></div>
        <div class="form-row"><label>nativeContextAntialiasing:</label> <span> ${typeof this.config.antialiasing === 'object' ? this.config.antialiasing.nativeContextAntialiasing : ''}</span></div>
        <div class="form-row"><label>pixelArtSampler:</label> <span> ${typeof this.config.antialiasing === 'object' ? this.config.antialiasing.pixelArtSampler : ''}</span></div>
    </div>
  </div>
</div>


<div class="row">
  <div class="widget">
    <h2>Camera</h2>

    <div class="section">
      <div>Pos: ${this.camera.pos._x.toFixed(2)}, ${this.camera.pos._y.toFixed(2)}</div>
    </div>
  </div>
</div>
    `;
  }
}
