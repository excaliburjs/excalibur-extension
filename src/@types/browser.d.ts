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
  const action: typeof chrome.action;
  const commands: typeof chrome.commands;
}

// @types/chrome 0.0.277 declares only getAll/onCommand; commands.update has
// been in the API since Chrome 88 / Firefox 60 (used by the popup's remap
// UI). Declared here so the ambient `browser.commands` carries it.
declare namespace chrome.commands {
  export function update(details: { name: string; shortcut?: string }): Promise<void>;
}
