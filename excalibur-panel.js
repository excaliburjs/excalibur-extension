// Current Engine representation in the extension
let engine = {
    currentScene: 'root',
    debug: {},
    scenes: [],
    entities: [],
    pointer: null
}

// graph
function createFpsGraph() {
    const fpsChart$ = document.getElementById('fps-chart');

    const totalHeight = 100;//px
    const totalWidth = 300;//px
    const tickWidth = 1; // px

    const nTicks = Math.floor(totalWidth / tickWidth);
    const zeroes = () => 0;
    let data = d3.range(nTicks).map(zeroes);

    const marginLeft = 10;
    const marginRight = 0;
    const marginTop = 10;
    const marginBottom = -15;

    const x = d3.scaleLinear([0, nTicks], [marginLeft, totalWidth - marginRight]);

    const y = d3.scaleLinear([0, 120], [totalHeight - marginBottom, marginTop]);

    const svg = d3.create('svg')
        .attr('width', tickWidth * data.length)
        .attr('height', totalHeight)
        .attr("viewBox", [0, 0, totalWidth, totalHeight + 20]) // -10,-10,310,140
        .attr("style", "max-width: 100%; height: auto; height: intrinsic;");

    svg.append("g")
        .attr('id', 'yAxis')
        .attr("transform", `translate(${0},0)`)
        .call(d3.axisLeft(y).tickArguments([4]));

    svg.append("text")
        .style('fill', 'currentColor')
        .attr("class", "y label")
        .attr("text-anchor", "start")
        .attr("y", marginTop)
        .attr("x", 20)
        .attr("dy", ".75em")
        // .attr("transform", "rotate(-90)")
        .text("FPS");

    const line = d3.line()
        .x((_, index) => x(index))
        .y(d => y(d));

    // draw first line
    svg.append("path")
        .attr('id','line')
        .attr("fill", "none")
        .attr("stroke", "steelblue")
        .attr("stroke-width", 1.5)
        .attr("d", line(data));

    fpsChart$.appendChild(svg.node());

    function draw(fps) {
        data.push(fps);
        data.shift();

        // Append a path for the line.
        svg.select("path#line")
            .attr("fill", "none")
            .attr("stroke", "steelblue")
            .attr("stroke-width", 1.5)
            .attr("d", line(data));
    }
    return draw;
}

var drawFps = createFpsGraph();


function createFrameTimeGraph() {
    const frameTimeChart = document.getElementById('frame-time-chart');
    const legendKeys = ['Total', 'Update', 'Draw']
    const color = d3.scaleOrdinal().domain(legendKeys).range(d3.schemeDark2);

    const totalHeight = 100;//px
    const totalWidth = 300;//px
    const tickWidth = 1; // px

    const nTicks = Math.floor(totalWidth / tickWidth);
    const zeroes = () => 0;
    let frameTimeData = d3.range(nTicks).map(zeroes);
    let updateTimeData = d3.range(nTicks).map(zeroes);
    let drawTimeData = d3.range(nTicks).map(zeroes);

    const marginLeft = 10;
    const marginRight = 0;
    const marginTop = 10;
    const marginBottom = -15;

    const x = d3.scaleLinear([0, nTicks], [marginLeft, totalWidth - marginRight]);

    const y = d3.scaleLinear([0, 33.333], [totalHeight - marginBottom, marginTop]);

    const svg = d3.create('svg')
        .attr('width', tickWidth * frameTimeData.length)
        .attr('height', totalHeight)
        .attr("viewBox", [0, 0, totalWidth, totalHeight + 20]) // -10,-10,310,140
        .attr("style", "max-width: 100%; height: auto; height: intrinsic;");

    svg.selectAll("mydots")
        .data(legendKeys)
        .enter()
        .append("circle")
          .attr("cx", 250)
          .attr("cy", function(d,i){ return 20 + i*25}) // 100 is where the first dot appears. 25 is the distance between dots
          .attr("r", 7)
          .style("fill", function(d){ return color(d)})
      
      // Add one dot in the legend for each name.
    svg.selectAll("mylabels")
        .data(legendKeys)
        .enter()
        .append("text")
          .attr("x", 270)
          .attr("y", function(d,i){ return 20 + i*25}) // 100 is where the first dot appears. 25 is the distance between dots
          .style("fill", function(d){ return color(d)})
          .text(function(d){ return d})
          .attr("text-anchor", "left")
          .style("alignment-baseline", "middle")

    svg.append("g")
        .attr('id', 'yAxis')
        .attr("transform", `translate(${0},0)`)
        .call(d3.axisLeft(y).tickArguments([5]));

    svg.append("text")
        .style('fill', 'currentColor')
        .attr("class", "y label")
        .attr("text-anchor", "start")
        .attr("y", marginTop)
        .attr("x", 20)
        .attr("dy", ".75em")
        // .attr("transform", "rotate(-90)")
        .text("Frame Time (ms)");

    const line = d3.line()
        .x((_, index) => x(index))
        .y(d => y(d));

    // draw max line
    svg.append("line")
        .style("stroke-dasharray", "3, 3")
        .attr("stroke", "currentColor")
        .attr("x1", x(0))
        .attr("x2", x(nTicks * .75))
        .attr("y1", y(16.6))
        .attr("y2", y(16.6))


    // draw first line
    svg.append("path")
        .attr('id','line')
        .attr("fill", "none")
        .attr("stroke", color(legendKeys[0]))
        .attr("stroke-width", 1.5)
        .attr("d", line(frameTimeData));

    svg.append("path")
        .attr('id','line-update')
        .attr("fill", "none")
        .attr("stroke", color(legendKeys[1]))
        .attr("stroke-width", 1.5)
        .attr("d", line(updateTimeData));

    svg.append("path")
        .attr('id','line-draw')
        .attr("fill", "none")
        .attr("stroke", color(legendKeys[2]))
        .attr("stroke-width", 1.5)
        .attr("d", line(drawTimeData));


    frameTimeChart.appendChild(svg.node());

    function draw(frameTime, updateTime, drawTime, max) {
        frameTimeData.push(frameTime);
        frameTimeData.shift();
        updateTimeData.push(updateTime);
        updateTimeData.shift();
        drawTimeData.push(drawTime);
        drawTimeData.shift();

        // Append a path for the line.
        svg.select("path#line")
            .attr("d", line(frameTimeData));

        svg.select("path#line-update")
            .attr("d", line(updateTimeData));
    
        svg.select("path#line-draw")
            .attr("d", line(drawTimeData));
    }
    return draw;
}

var drawFrameTime = createFrameTimeGraph();

const backgroundConnection = chrome.runtime.connect({
    name: 'panel'
});

const hexToColor = (hex) => {
    hex = hex.substring(1);
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return { r, g, b, a: 1.0 };
}

const colorToHex = (color) => {
    const r = color.r.toString(16).padStart(2, '0');
    const g = color.g.toString(16).padStart(2, '0');
    const b = color.b.toString(16).padStart(2, '0');
    return `#${r}${g}${b}`
}


const updateDebug = (debug) => {
    backgroundConnection.postMessage({
        name: 'command',
        tabId: chrome.devtools.inspectedWindow.tabId,
        dispatch: 'update-debug',
        debug
    });
}

const selectActor = (actorId) => {
    const newDebug = { ...engine.debug };
    newDebug.filter.useFilter = true;
    newDebug.filter.ids = [actorId];
    updateDebug(newDebug);
}

const killActor = (actorId) => {
    backgroundConnection.postMessage({
        name: 'command',
        tabId: chrome.devtools.inspectedWindow.tabId,
        dispatch: 'kill',
        actorId
    });
}

// version
const excaliburVersion$ = document.getElementById('excalibur-version');


// ui components
const toggleDebugButton$ = document.getElementById('toggle-debug');
const currentScene$ = document.getElementById('current-scene-name');
const scenes$ = document.getElementById('scenes');
const debugSettingsRaw$ = document.getElementById('debug-settings-raw');
const entityList$ = document.getElementById('entity-list');

// input 
const worldPos$ = document.getElementById('world-pos');
const screenPos$ = document.getElementById('screen-pos');
const pagePos$ = document.getElementById('page-pos');

// stats
const fps$ = document.getElementById('fps');
const frameTime$ = document.getElementById('frame-time');
const frameBudget$ = document.getElementById('frame-budget');
const updateTime$ = document.getElementById('update-time');
const drawTime$ = document.getElementById('draw-time');
const drawCalls$ = document.getElementById('draw-calls');
const numActors$ = document.getElementById('num-actors');

// settings
const posColor$ = document.getElementById('show-pos-color');
posColor$.addEventListener('input', evt => {
    const newDebug = { ...engine.debug };
    newDebug.transform.positionColor = hexToColor(evt.target.value);
    updateDebug(newDebug);
});

const showNames$ = document.getElementById('show-names');
showNames$.addEventListener('change', function (evt) {
    const newDebug = { ...engine.debug };
    newDebug.entity.showName = !!evt.target.checked;
    updateDebug(newDebug);
});

const showIds$ = document.getElementById('show-ids');
showIds$.addEventListener('change', function (evt) {
    const newDebug = { ...engine.debug };
    newDebug.entity.showId = !!evt.target.checked;
    updateDebug(newDebug);
});

const showPos$ = document.getElementById('show-pos');
showPos$.addEventListener('change', function (evt) {
    const newDebug = { ...engine.debug };
    newDebug.transform.showPosition = !!evt.target.checked;
    updateDebug(newDebug);
});

const showPosLabel$ = document.getElementById('show-pos-label');
showPosLabel$.addEventListener('change', function (evt) {
    const newDebug = { ...engine.debug };
    newDebug.transform.showPositionLabel = !!evt.target.checked;
    updateDebug(newDebug);
});

const showGraphicsBounds$ = document.getElementById('show-graphics-bounds');
showGraphicsBounds$.addEventListener('change', function (evt) {
    const newDebug = { ...engine.debug };
    newDebug.graphics.showBounds = !!evt.target.checked;
    updateDebug(newDebug);
});

const graphicsBoundsColor$ = document.getElementById('graphics-bounds-colors');
graphicsBoundsColor$.addEventListener('input', evt => {
    const newDebug = { ...engine.debug };
    newDebug.graphics.boundsColor = hexToColor(evt.target.value);
    updateDebug(newDebug);
});

const showColliderBounds$ = document.getElementById('show-collider-bounds');
showColliderBounds$.addEventListener('change', function (evt) {
    const newDebug = { ...engine.debug };
    newDebug.collider.showBounds = !!evt.target.checked;
    updateDebug(newDebug);
});

const colliderBoundsColor$ = document.getElementById('collider-bounds-colors');
colliderBoundsColor$.addEventListener('input', evt => {
    const newDebug = { ...engine.debug };
    newDebug.collider.boundsColor = hexToColor(evt.target.value);
    updateDebug(newDebug);
});

const showGeometryBounds$ = document.getElementById('show-geometry-bounds');
showGeometryBounds$.addEventListener('change', function (evt) {
    const newDebug = { ...engine.debug };
    newDebug.collider.showGeometry = !!evt.target.checked;
    updateDebug(newDebug);
});

const colliderGeometryColor$ = document.getElementById('collider-geometry-colors');
colliderGeometryColor$.addEventListener('input', evt => {
    const newDebug = { ...engine.debug };
    newDebug.collider.geometryColor = hexToColor(evt.target.value);
    updateDebug(newDebug);
});


const updateInput = (pointer) => {

    if (pointer?.worldPos && pointer?.screenPos && pointer?.pagePos) {
        worldPos$.innerText = `(${pointer.worldPos._x.toFixed(2)},${pointer.worldPos._y.toFixed(2)})`
        screenPos$.innerText = `(${pointer.screenPos._x.toFixed(2)},${pointer.screenPos._y.toFixed(2)})`
        pagePos$.innerText = `(${pointer.pagePos._x.toFixed(2)},${pointer.pagePos._y.toFixed(2)})`
    }
}


const updateStats = (debug) => {

    currentScene$.innerText = engine.currentScene;
    scenes$.innerText = engine.scenes.join(',');
    const fps = debug.stats.currFrame._fps;
    fps$.innerText = fps.toFixed(2);
    drawFps(fps);
    const delta = debug.stats.currFrame._delta;
    const frameBudget = (delta - debug.stats.currFrame._durationStats.total);
    const frameTime = debug.stats.currFrame._durationStats.total;
    frameTime$.innerText = `${frameTime.toFixed(2)}ms (${((frameTime / delta) * 100).toFixed(2)}%)`;
    drawTime$.innerText = debug.stats.currFrame._durationStats.draw.toFixed(2);
    updateTime$.innerText = debug.stats.currFrame._durationStats.update.toFixed(2);
    frameBudget$.innerText = `${frameBudget.toFixed(2)}ms (${((frameBudget / delta) * 100).toFixed(2)}%)`
    drawFrameTime(frameTime, debug.stats.currFrame._durationStats.update, debug.stats.currFrame._durationStats.draw, delta);
    numActors$.innerText = debug.stats.currFrame._actorStats.total;
    drawCalls$.innerText = debug.stats.currFrame._graphicsStats.drawCalls;
    // debugSettingsRaw$.innerText = JSON.stringify(debug, null, 2);
}



const updateDebugSettings = (debug) => {

    showNames$.checked = debug.entity.showName;
    showIds$.checked = debug.entity.showId;

    showPos$.checked = debug.transform.showPosition;
    showPosLabel$.checked = debug.transform.showPositionLabel;
    const positionColor = debug.transform.positionColor;
    posColor$.value = colorToHex(positionColor);

    showGraphicsBounds$.checked = debug.graphics.showBounds;
    const graphicsColor = debug.graphics.boundsColor;
    graphicsBoundsColor$.value = colorToHex(graphicsColor);

    showColliderBounds$.checked = debug.collider.showBounds;
    const colliderColor = debug.collider.boundsColor;
    colliderBoundsColor$.value = colorToHex(colliderColor);

    showGeometryBounds$.checked = debug.collider.showGeometry;
    const geometryColor = debug.collider.geometryColor;
    colliderGeometryColor$.value = colorToHex(geometryColor);
}

const updateEntityList = (entities) => {
    for (let entity of entities) {
        const entityDivId = 'entity-' + entity.id;
        const maybeDiv = document.getElementById(entityDivId);
        if (maybeDiv) {
            maybeDiv.children[0].innerText = entity.id;
            maybeDiv.children[1].innerText = entity.name;
            maybeDiv.children[2].innerText = entity.pos;

        } else {
            const div$ = document.createElement('div');
            div$.id = entityDivId;
            div$.className = 'entity';
            div$.addEventListener('mouseover', (evt) => {
                // selectActor(entity.id);
            });
            div$.addEventListener('click', (evt) => {
                selectActor(entity.id);
            });

            const id$ = document.createElement('div');
            id$.innerText = entity.id;
            id$.className = 'id';

            const name$ = document.createElement('div');
            name$.innerText = entity.name;
            name$.className = 'name';

            const pos$ = document.createElement('div');
            pos$.innerText = entity.pos;
            pos$.className = 'pos';

            const kill$ = document.createElement('button');
            kill$.setAttribute('entity-id', entity.id);
            kill$.addEventListener('click', evt => {
                const id = evt.target.getAttribute('entity-id');
                console.log('kill', id);
                killActor(+id);
                entityList$.removeChild(div$);
            })

            div$.appendChild(id$);
            div$.appendChild(name$);
            div$.appendChild(pos$);
            div$.appendChild(kill$);
            entityList$.appendChild(div$);
            // entityMap.set(entity.id, div$);
        }
    }
}

backgroundConnection.onMessage.addListener((message) => {
    switch (message.name) {
        case 'scenes': {
            engine.scenes = message.data;
            break;
        }
        case 'current-scene': {
            engine.currentScene = message.data;
            currentScene$.innerText = engine.currentScene;
            break;
        }
        case 'echo': {
            engine.currentScene = 'echo';
            currentScene$.innerText = engine.currentScene;
            break;
        }
        case 'heartbeat':
        case 'install': {
            const debug = JSON.parse(message.data.debug);
            engine = message.data;
            engine.debug = debug;

            excaliburVersion$.innerText = engine.version;
            updateInput(engine.pointer);
            updateStats(debug);
            updateEntityList(engine.entities);
            updateDebugSettings(debug);
            break;
        }
        default: {
            // console.warn('Unknown message', message);
        }
    }
});

backgroundConnection.postMessage({
    name: 'init',
    tabId: chrome.devtools.inspectedWindow.tabId
});

backgroundConnection.postMessage({
    name: 'command',
    tabId: chrome.devtools.inspectedWindow.tabId,
    dispatch: 'install-heartbeat'
})

toggleDebugButton$.addEventListener('click', () => {
    backgroundConnection.postMessage({
        name: 'command',
        tabId: chrome.devtools.inspectedWindow.tabId,
        dispatch: 'toggle-debug'
    });
});

chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
    if (changeInfo.status === 'complete') {
        backgroundConnection.postMessage({
            name: 'init',
            tabId: chrome.devtools.inspectedWindow.tabId
        });

        backgroundConnection.postMessage({
            name: 'command',
            tabId: chrome.devtools.inspectedWindow.tabId,
            dispatch: 'install-heartbeat'
        })
    }
})

