export {};

declare global {
  namespace browser {
    export import runtime = chrome.runtime;
    export import tabs = chrome.tabs;
    export import devtools = chrome.devtools;
  }
}
