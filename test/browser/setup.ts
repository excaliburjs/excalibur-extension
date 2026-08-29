// Browser-test stand-in for src/excalibur-panel.html: the extension page
// loads Shoelace, its dark theme, and the vendored flame-chart global via
// script tags — here they load through the bundler instead.
// (Vite resolves only the dist/ exports; the extension's script tags use the
// cdn/ build. The load-bearing SlRange patch must cover BOTH chunk copies.)
import '@shoelace-style/shoelace';
import '@shoelace-style/shoelace/dist/themes/dark.css';
import * as flameChartJs from '../../lib/flame-chart-js.js';

document.documentElement.classList.add('sl-theme-dark');

// flame-chart.ts reads the `flameChartJs` UMD global installed by the
// vendored script tag; under the bundler the module namespace is equivalent
(globalThis as Record<string, unknown>).flameChartJs = (globalThis as Record<string, unknown>).flameChartJs ?? flameChartJs;
