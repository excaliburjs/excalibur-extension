# Excalibur Dev Tools Plugin

⚠️ Currently a work in progress! ⚠️

This excalibur game developers to easily inspect their games while making them!

Debug
* Performance issues
* Actor graphics
* Actor geometry
* Colliders
* Scenes

![Example Extension Running](./extension.gif)


## Todos
* [ ] Make sure lite mode looks okay
* [ ] List active event listeners on stuff for debugging!
* [ ] Remember debug settings across refreshes
* [ ] Figure out TS/lit html
* [ ] Screen settings
  * resolution
  * displaymode
  * antialiasing
  * content area
  * color blind testing tools
* [ ] Physics settings
  * Max fps
  * Fixed step fps
  * Interpolation
  * Gravity
  * Iterations
* [ ] Frame stepping! for debugging physics
* [ ] Show loaded resources
* [x] Show world/screen/page coordinates under pointer
* [x] Toggle debug values
* [x] Style cooler than the current
* [ ] Entity inspector side panel
  - When you hover in the dev tool it highlights in the game!
  - When you hover in the game it highlights in the dev tools!
* [x] Cool ass charts with d3
  - [x] FPS over time https://gist.github.com/ralphbean/1271115/de23af71ba74876775aa3569abc8968072696aff
  - [x] Frame budget over time
     - https://d3-graph-gallery.com/graph/interactivity_zoom.html
  - [ ] Actors over time
  - [ ] System time breakdown
  - [ ] Query maintenance and size

* [ ] System JS info?
  - Possible permissions https://developer.chrome.com/docs/extensions/mv3/declare_permissions/#permissions
  - Are getting GCs possible? https://developer.chrome.com/docs/extensions/reference/debugger/
  - https://github.com/MicrosoftEdge/Demos/blob/main/devtools-performance-activitytabs/index.html

## Resources 
https://developer.chrome.com/docs/extensions/mv3/devtools/