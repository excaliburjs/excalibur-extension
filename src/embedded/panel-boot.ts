/**
 * Entry for the devtools panel INSIDE the embedded iframe. This is the
 * embedded stand-in for src/excalibur-panel.html: it registers Shoelace (the
 * whole cdn bundle — the patched build), installs the flame-chart UMD global,
 * inlines the icon set, and mounts <app-main> wired to the transport bridge
 * the host placed on this iframe's window.
 *
 * Bundled to a string via `bundle-text:` in ex-devtools.ts and injected as a
 * <script type="module"> into the iframe document.
 */
import '@shoelace-style/shoelace/cdn/shoelace.js';
import { registerIconLibrary } from '@shoelace-style/shoelace/cdn/utilities/icon-library.js';
import * as flameChartJs from '../../lib/flame-chart-js.js';

import crosshair from 'bundle-text:../../static/assets/icons/crosshair.svg';
import search from 'bundle-text:../../static/assets/icons/search.svg';
import trash from 'bundle-text:../../static/assets/icons/trash.svg';
import trashFill from 'bundle-text:../../static/assets/icons/trash-fill.svg';
import trash2 from 'bundle-text:../../static/assets/icons/trash2.svg';
import trash2Fill from 'bundle-text:../../static/assets/icons/trash2-fill.svg';
import trash3 from 'bundle-text:../../static/assets/icons/trash3.svg';
import trash3Fill from 'bundle-text:../../static/assets/icons/trash3-fill.svg';
import x from 'bundle-text:../../static/assets/icons/x.svg';
import zoomIn from 'bundle-text:../../static/assets/icons/zoom-in.svg';

// app-main and every panel component register themselves on import (sl-*
// upgrades are retroactive, so ordering vs the Shoelace import is safe)
import '../components/app-main';
import type { App } from '../components/app-main';
import type { TransportFactory } from '../panel-transport/types';

// flame-chart.ts reads the UMD global normally installed by a script tag
(globalThis as Record<string, unknown>).flameChartJs = (globalThis as Record<string, unknown>).flameChartJs ?? flameChartJs;

// The extension resolves icons from the static copy next to the panel page;
// the embedded bundle carries the same 10 SVGs inline so it works offline on
// any origin
const icons: Record<string, string> = {
  crosshair,
  search,
  trash,
  'trash-fill': trashFill,
  trash2,
  'trash2-fill': trash2Fill,
  trash3,
  'trash3-fill': trash3Fill,
  x,
  'zoom-in': zoomIn
};
registerIconLibrary('default', {
  resolver: (name) => (icons[name] ? `data:image/svg+xml,${encodeURIComponent(icons[name])}` : '')
});

const bridge = (window as { __EX_DEVTOOLS_BRIDGE__?: { transportFactory: TransportFactory } }).__EX_DEVTOOLS_BRIDGE__;
const app = document.createElement('app-main') as App;
if (bridge) {
  app.transportFactory = bridge.transportFactory;
}
document.body.appendChild(app);
