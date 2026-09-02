export {};

declare global {
  namespace browser {
    export import runtime = chrome.runtime;
    export import tabs = chrome.tabs;
    export import devtools = chrome.devtools;
    export import action = chrome.action;
    export import commands = chrome.commands;
  }
}
