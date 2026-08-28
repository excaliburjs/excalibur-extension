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

// Two-pass shader pipeline material (0.33+): pass sources are glsl-tag
// processed (no #version/precision, straight alpha, u_image = previous pass)
const pipelined = game.graphicsContext.createMaterial({
  name: 'pipelined',
  passes: [
    `in vec2 v_uv;
uniform sampler2D u_image;
uniform float u_strength;
out vec4 fragColor;
void main() {
  vec4 color = texture(u_image, v_uv);
  fragColor = vec4(color.r * u_strength, color.gba);
}`,
    `in vec2 v_uv;
uniform sampler2D u_image;
out vec4 fragColor;
void main() {
  vec4 color = texture(u_image, v_uv);
  fragColor = vec4(color.b, color.g, color.r, color.a);
}`
  ]
});
(pipelined.pipeline as ex.ShaderPipeline).passes[0].uniforms.u_strength = 1;

const piped = new ex.Actor({ name: 'piped', x: 350, y: 360, width: 60, height: 60, color: ex.Color.Green });
piped.graphics.material = pipelined;
game.add(piped);

// Multipass postprocessors over the screen: a built-in Bloom effect and a
// named single-pass pipeline
game.graphicsContext.addPostProcessor(new ex.BloomEffect({ graphicsContext: game.graphicsContext as ex.ExcaliburGraphicsContextWebGL }));
game.graphicsContext.addPostProcessor(
  new ex.ShaderPipelinePostProcessor({
    name: 'vignette',
    passes: [
      `in vec2 v_uv;
uniform sampler2D u_image;
uniform float u_darkness;
out vec4 fragColor;
void main() {
  vec4 color = texture(u_image, v_uv);
  float d = distance(v_uv, vec2(0.5));
  fragColor = vec4(color.rgb * (1.0 - clamp(d * u_darkness, 0.0, 0.8)), color.a);
}`
    ]
  })
);

game.addScene('level2', new ex.Scene());

void game.start();
