/// <reference types="chrome" />

/**
 * Type declarations for the cross-browser WebExtension API.
 * Firefox uses `browser`, Chrome uses `chrome` - we polyfill `browser` to `chrome` at runtime.
 */

declare namespace browser {
  const runtime: typeof chrome.runtime;
  const tabs: typeof chrome.tabs;
  const scripting: typeof chrome.scripting;
  const devtools: typeof chrome.devtools;
}
