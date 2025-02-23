if (typeof browser == 'undefined') {
  // Chrome does not support the browser namespace yet.
  globalThis.browser = globalThis.chrome;
}

globalThis.browser.devtools.panels.create('Excalibur', './assets/icon.png', './up_/excalibur-panel.html', (evt) => {
  // FIXME up_ weird quirk of parcel build
  console.info('excalibur dev tools', evt);
});
