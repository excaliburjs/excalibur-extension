/**
 * Dev-harness game for `npm run start:embedded`: a small real Excalibur scene
 * exercising the panel's main features (entities, scenes, a material with a
 * custom uniform), then the embedded devtools on top.
 *
 * Dev-only — excalibur is a devDependency and is never part of the shipped
 * ex-devtools artifact.
 */
import * as ex from 'excalibur';
import './ex-devtools';

const canvas = document.getElementById('game') as HTMLCanvasElement;

const game = new ex.Engine({
  canvasElement: canvas,
  width: 800,
  height: 480,
  suppressPlayButton: true,
  suppressConsoleBootMessage: true
});

const hero = new ex.Actor({ name: 'hero', x: 200, y: 240, width: 40, height: 40, color: ex.Color.Red });
hero.actions.repeatForever((ctx) =>
  ctx.moveBy({ offset: ex.vec(300, 0), duration: 2000 }).moveBy({ offset: ex.vec(-300, 0), duration: 2000 })
);
game.add(hero);

const material = game.graphicsContext.createMaterial({
  name: 'glow',
  fragmentSource: `#version 300 es
precision mediump float;
in vec2 v_uv;
uniform sampler2D u_graphic;
uniform float u_intensity;
out vec4 fragColor;
void main() {
  vec4 color = texture(u_graphic, v_uv);
  fragColor = color * u_intensity;
}`
});
material.uniforms.u_intensity = 1;

const shaded = new ex.Actor({ name: 'shaded', x: 500, y: 240, width: 60, height: 60, color: ex.Color.Vermilion });
shaded.graphics.material = material;
game.add(shaded);

game.addScene('level2', new ex.Scene());

void game.start();
