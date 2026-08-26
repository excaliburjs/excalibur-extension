# Excalibur Dev Tools Plugin

This [excalibur game](https://excaliburjs.com) developers to easily inspect their games while making them!

Now live in browsers!

- [Install in Chrome](https://chromewebstore.google.com/detail/excalibur-dev-tools/dinddaeielhddflijbbcmpefamfffekc)
- [Install in Firefox](https://addons.mozilla.org/en-US/firefox/addon/excalibur-dev-tools/)

Debug

- Performance issues
- Actor graphics
- Actor geometry
- Colliders
- Scenes
- Toggle Debug Draw

![Example Extension Running](./extension.gif)

## Chrome: Running Locally & Side Loading

If you want to develop locally

- Install node.js
- Run `npm install` in the root directory
- Run `npm run start:chrome` this will start a parcel dev server, or run `npm run build:chrome` to produce a prod bundle
- Open `chrome://extensions/` and click "Load unpacked"
  ![chrome extensions tab](chrome-extensions.png)
- Select the `dist-chrome` directory in the `excalibur-extension` project
  ![excalibur-extension dist directory](dist-dir.png)

## Firefox: Running Locally & Side Loading

If you want to develop locally

- Install node.js
- Run `npm install` in the root directory
- Run `npm run start:firefox` this will start a parcel dev server, or run `npm run build:firefox` to produce a prod bundle
- Open `about:debugging#/runtime/this-firefox` and click "Load Temporary Add-on..."
  ![firefox extensions tab](firefox-extensions.png)
- Select the manifest.json file inside the `dist-firefox` directory.

## Building a release artifact for Chrome or Firefox

- Install node.js
- Run `npm install` in the root directory
- Run `npm build:chrome` to produce the final build artifact in `dist-chrome`
  - Zip the files in the directory, not the `dist-chrome` directory
  - Upload the zip to chrome
- Run `npm build:firefox` to product the final build artifact in `dist-firefox` which can be zipped and uploaded
  - Zip the files in the directory, not the `dist-firefox` directory
  - Upload the zip to mozilla

## How it works

The message protocol (`src/protocol.ts`) is the fixed seam. Three layers carry it,
and each seam has two interchangeable implementations — one for the browser
extension, one for the embedded build:

```mermaid
flowchart LR
    APP["<b>&lt;app-main&gt;</b><br/>Lit panel UI<br/><i>src/components/</i>"]
    CONN["<b>createConnection()</b><br/>command switch · 200ms heartbeat poll<br/>frame reconcile · pickerOpSeq · 3-strike tolerance<br/><i>src/driver/connection.ts</i>"]
    FNS["<b>page functions</b> (closure-free, serializable)<br/>detect · inject · clock · picker<br/>entities · scene · materials<br/><i>src/page/</i>"]
    ENGINE[("window.___EXCALIBUR_DEVTOOL<br/>Excalibur Engine")]

    APP <-- "PanelTransport" --> CONN
    CONN <-- "PageExecutor" --> FNS
    FNS <--> ENGINE
```

| Seam               | Extension build                                                      | Embedded build                                        |
| ------------------ | -------------------------------------------------------------------- | ----------------------------------------------------- |
| `PanelTransport`   | chrome runtime Port (`src/panel-transport/extension.ts`)             | in-memory pair (`src/embedded/local-driver.ts`)       |
| `PageExecutor`     | `chrome.scripting.executeScript`, world `MAIN` (`src/background.ts`) | direct function call (`src/embedded/local-driver.ts`) |
| Panel UI lives in  | the devtools panel page                                              | a same-origin dock iframe (`src/embedded/host.ts`)    |
| Connection runs in | the background service worker                                        | the game page itself                                  |

The runtime flow is identical in both builds — only the plugs differ:

```mermaid
sequenceDiagram
    participant Panel as app-main (panel)
    participant Conn as createConnection (driver)
    participant Exec as PageExecutor
    participant Game as Excalibur Engine

    Panel->>Conn: ex-debug:hello (tabId stamped by the transport)
    Conn-->>Panel: ex-debug:init
    Panel->>Conn: ex-debug:update-debug (settings push)

    loop every 200ms
        Conn->>Exec: execAll(detectExcalibur)
        Exec->>Game: find window.___EXCALIBUR_DEVTOOL (all frames)
        Conn->>Exec: exec(inject, settings)
        Exec->>Game: apply debug settings, serialize game state
        Conn-->>Panel: ex-debug:heartbeat (instances, selectedFrameId, data)
    end

    Panel->>Conn: ex-debug:command (dispatch: ex-debug:kill, actorId)
    Conn->>Exec: exec(kill, [actorId])
    Exec->>Game: actor.kill()
    Note over Panel,Conn: on-demand replies (material-detail,<br/>entity-graphics) post back the same way
```

## Embedded devtools (no extension needed)

The panel can also run directly inside a game page, firebug-style — no browser
extension, no devtools window. Build it with:

- `npm run build:embedded` → `dist-embedded/ex-devtools.js` (self-contained)

Drop it into any page running an Excalibur game (the engine already exposes
itself to the devtools — no game-side code needed):

```html
<script type="module" src="ex-devtools.js"></script>
```

A floating **Ex** button appears bottom-right and opens a resizable dock with
the full panel (inspector, debug draw, materials, graphs, entity picker).
`window.ExDevtools` exposes `open()`, `close()`, `toggle()`, and `destroy()`;
appending `?ex-devtools=open` to the URL opens the dock on load.

For development, `npm run start:embedded` serves a harness page with a demo
game and the embedded devtools on top.

## Testing

- `npm run test:unit` — node-level Vitest specs (settings schema/store/utils,
  formatters, GLSL tokenizer, and a serialization tripwire that proves every
  `src/page/` function is still self-contained).
- `npm run test:browser` — Vitest browser mode (headless Chromium via
  Playwright; run `npx playwright install chromium` once): boots a real
  Excalibur game and drives the embedded panel against it end to end.
- `npm run test` — both.

## Features That We Want!

PR's welcome

- [ ] Global audio settings
  - [ ] List sounds that are playing
  - [ ] Mute sounds
- [ ] Excalibur Action Window Pop-up
- [x] Support firefox with manifest v3 https://extensionworkshop.com/documentation/develop/porting-a-google-chrome-extension/
- [ ] Show "no excalibur detected" if something isn't in the extension
- [ ] Make sure lite mode looks okay
- [ ] List active event listeners on stuff for debugging!
- [x] Remember debug settings across refreshes/closing
- [ ] Show entities as a tree view so child/parent relationships are clear
- [ ] Screen settings
  - [ ] Override camera with a click an drag
  - [ ] Zoom the camera!
  - [ ] Change Resolution
  - [ ] Change DisplayMode
  - [ ] Adjust antialiasing settings
  - [ ] Display Content Area
  - [ ] Expose Color Blind Testing Tools
- [x] Physics settings
  - [x] Switch between solvers Arcade/Realistic
  - [x] Max fps
  - [x] Fixed step fps
  - [x] Interpolation
  - [x] Gravity
  - [x] Iterations
- [ ] Show loaded resources
- [ ] Entity inspector side panel with component value detials

  - When you hover over an actor/entity in the game it highlights in the dev tools!

- [ ] System JS info?
  - Possible permissions https://developer.chrome.com/docs/extensions/mv3/declare_permissions/#permissions
  - Are getting GCs possible? https://developer.chrome.com/docs/extensions/reference/debugger/
  - https://github.com/MicrosoftEdge/Demos/blob/main/devtools-performance-activitytabs/index.html

## Resources

https://developer.chrome.com/docs/extensions/mv3/devtools/
