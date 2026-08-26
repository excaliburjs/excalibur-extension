/**
 * The shippable embedded-devtools entry ("firebug for Excalibur").
 *
 * Drop the built file into any page running an Excalibur game:
 *
 *   <script type="module" src="ex-devtools.js"></script>
 *
 * A floating "Ex" button appears; `window.ExDevtools` exposes
 * open/close/toggle/destroy. Append `?ex-devtools=open` to the page URL to
 * open the dock automatically. No game-side registration is needed — the
 * Engine constructor already exposes window.___EXCALIBUR_DEVTOOL.
 *
 * Packaging: the panel bundle and stylesheet are compiled by Parcel and
 * inlined as strings, so the artifact is self-contained.
 */
import panelJs from 'bundle-text:./panel-boot.ts';
import panelCss from 'bundle-text:./panel-styles.css';
import { createExDevtools, type ExDevtoolsApi } from './host';

declare global {
  interface Window {
    ExDevtools?: ExDevtoolsApi;
  }
}

const api = createExDevtools({ panelJs, panelCss });
window.ExDevtools = api;

try {
  if (new URLSearchParams(location.search).get('ex-devtools') === 'open') {
    api.open();
  }
} catch {
  // no location in exotic embedding contexts; button-only
}
