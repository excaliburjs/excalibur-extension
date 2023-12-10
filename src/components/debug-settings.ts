

import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js'
import { colors } from '../colors';
import { common } from '../common';

interface Color {
    r: number;
    g: number;
    b: number;
}

const hexToColor = (hex: string) => {
    hex = hex.substring(1);
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return { r, g, b, a: 1.0 };
}

const colorToHex = (color: Color ) => {
    const r = color.r.toString(16).padStart(2, '0');
    const g = color.g.toString(16).padStart(2, '0');
    const b = color.b.toString(16).padStart(2, '0');
    return `#${r}${g}${b}`
}

export interface Settings {
    showNames: boolean;
    showIds: boolean;
    showPos: boolean;
    showPosLabel: boolean;
    posColor: Color;
    showGraphicsBounds: boolean;
    graphicsBoundsColor: Color;
    showColliderBounds: boolean;
    colldierBoundsColor: Color;
    showGeometryBounds: boolean;
    geometryBoundsColor: Color;
}

@customElement('debug-settings')
export class DebugSettings extends LitElement {
    static styles = [
        colors,
        common,
        css`
            :host {
                display: block;
            }

            sl-button {
                padding-bottom: 10px;
            }

            sl-switch {
                padding-bottom: 10px;
            }
        `
    ];

    @state({type: Object})
    settings: Settings = {
        showNames: false,
        showIds: false,
        showPos: false,
        showPosLabel: false,
        posColor: {r: 0, g: 0, b: 0},
        showGraphicsBounds: false,
        graphicsBoundsColor: {r: 0, g: 0, b: 0},
        showColliderBounds: false,
        colldierBoundsColor: {r: 0, g: 0, b: 0},
        showGeometryBounds: false,
        geometryBoundsColor: {r: 0, g: 0, b: 0},

    };

    updateSettings(settings: Settings) {
        this.settings = settings;
        this.requestUpdate();
    }



    render() {
        return html`
        <div class="debug-settings section">
            <div>
                <sl-button id="toggle-debug">Toggle Debug Draw</sl-button>
            </div>

            <div>
                <sl-switch id="show-names" .checked=${this.settings.showNames}></sl-switch>
                <label for="show-names">Show Names</label>
            </div>
            <div>
                <sl-switch id="show-ids" .checked=${this.settings.showIds}></sl-switch>
                <label for="show-ids">Show Ids</label>
            </div>
            <div class="form-row">
                <div>
                    <sl-switch id="show-pos" .checked=${this.settings.showPos}></sl-switch>
                    <label for="show-pos">Show Position</label>
                </div>
                <div>
                    <sl-switch id="show-pos-label" .checked=${this.settings.showPosLabel}></sl-switch>
                    <label for="show-pos-label">Show Label</label>
                </div>
                <div>
                    <sl-color-picker id="show-pos-color" .value=${colorToHex(this.settings.posColor)}>Color</sl-color-picker>
                </div>
            </div>

            <div class="form-row">
                <div>
                    <sl-switch id="show-graphics-bounds" .checked=${this.settings.showGraphicsBounds}></sl-switch>
                    <label for="show-graphics-bounds">Show Graphics Bounds</label>
                </div>

                <div>
                    <sl-color-picker id="graphics-bounds-colors" .value=${colorToHex(this.settings.graphicsBoundsColor)}>Color</sl-color-picker>
                </div>
            </div>

            <div class="form-row">
                <div>
                    <sl-switch id="show-collider-bounds" .checked=${this.settings.showColliderBounds}></sl-switch>
                    <label for="show-collider-bounds">Show Collider Bounds</label>
                </div>

                <div>
                    <sl-color-picker id="collider-bounds-colors" .value=${colorToHex(this.settings.colldierBoundsColor)}>Color</sl-color-picker>
                </div>
            </div>

            <div class="form-row">
                <div>
                    <sl-switch id="show-geometry-bounds" .checked=${this.settings.showGeometryBounds}></sl-switch>
                    <label for="show-geometry-bounds">Show Geometry</label>
                </div>

                <div>
                    <sl-color-picker id="collider-geometry-colors" .value=${colorToHex(this.settings.geometryBoundsColor)}>Color</sl-color-picker>
                </div>
            </div>
        </div>
        
        `;
    }
}
