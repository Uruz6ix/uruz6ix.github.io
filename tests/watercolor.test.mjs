import test from "node:test";
import assert from "node:assert/strict";
import { WatercolorSimulation } from "../assets/interactive/shared/watercolor-simulation.js";
import { WatercolorSimulation as ArtworkSimulation } from "../assets/interactive/mayakovsky/js/simulation.js";
import { CONFIG as ART_CONFIG } from "../assets/interactive/mayakovsky/js/config.js";
import { createConfig, applyParameters, DEFAULTS } from "../assets/interactive/watercolor/js/config.js";
import { BrushStroke, hexToRgb, paperExit } from "../assets/interactive/watercolor/js/stroke.js";

function make(config = createConfig(), wetness = 0.3) {
  return new WatercolorSimulation(160, 100, new Float32Array(16000).fill(wetness), new Float32Array(16000), config);
}
const options = { radius: 6, color: hexToRgb("#3577aa"), pigment: 1, water: 1 };
const sum = (array) => array.reduce((a, b) => a + b, 0);
const pigmentMass = (sim) => sum(sim.mobileA) + sum(sim.fixedA) + sum(sim.rimA) + sum(sim.sedimentA);

test("a fast pointer jump paints every part of the path and its endpoint", () => {
  const sim = make();
  const stroke = new BrushStroke(sim, options, { x: 10, y: 40 });
  stroke.move({ x: 150, y: 40 });
  stroke.finish();
  for (let x = 13; x < 149; x++) assert.ok(sim.mobileA[40 * 160 + x] > 0.1, `gap at ${x}`);
});

test("a stroke leaving the paper reaches its first intersected boundary", () => {
  const point = paperExit({ x: 80, y: 50, pressure: 1 }, { x: 240, y: 150, pressure: 0.5 }, 160, 100);
  assert.equal(point.x, 160);
  assert.equal(point.y, 100);
  assert.equal(point.pressure, 0.75);
  const sim = make();
  const stroke = new BrushStroke(sim, options, { x: 80, y: 50 });
  stroke.move(point); stroke.finish();
  assert.ok(sim.mobileA[99 * 160 + 159] > 0.01);
});

test("the smallest brush at light pen pressure stays continuous between grid rows", () => {
  const sim = make();
  const stroke = new BrushStroke(sim, { ...options, radius: 1.2 }, { x: 15, y: 50.5, pressure: 0.15 });
  stroke.move({ x: 145, y: 50.5, pressure: 0.15 }); stroke.finish();
  for (let x = 16; x < 145; x++) assert.ok(sim.mobileA[50 * 160 + x] > 0.001);
});

test("pigment deposition does not depend on pointer event frequency", () => {
  const sparse = make();
  const dense = make();
  const a = new BrushStroke(sparse, options, { x: 15, y: 25 });
  const b = new BrushStroke(dense, options, { x: 15, y: 25 });
  a.move({ x: 140, y: 75 });
  for (let i = 1; i <= 100; i++) b.move({ x: 15 + 125 * i / 100, y: 25 + 50 * i / 100 });
  a.finish(); b.finish();
  for (const field of ["water", "mobileA", "mobileR", "mobileG", "mobileB"]) {
    for (let i = 0; i < sparse.size; i++) assert.ok(Math.abs(sparse[field][i] - dense[field][i]) < 0.000001);
  }
});

test("pen pressure changes coverage and a water brush injects no pigment", () => {
  const light = make();
  const firm = make();
  const water = make();
  for (const [sim, pressure] of [[light, 0.2], [firm, 1]]) {
    const stroke = new BrushStroke(sim, options, { x: 20, y: 50, pressure });
    stroke.move({ x: 140, y: 50, pressure }); stroke.finish();
  }
  assert.ok(pigmentMass(firm) > pigmentMass(light) * 2);
  const initialWater = sum(water.water);
  const stroke = new BrushStroke(water, { ...options, pigment: 0 }, { x: 20, y: 50 });
  stroke.move({ x: 140, y: 50 }); stroke.finish();
  assert.equal(pigmentMass(water), 0);
  assert.ok(sum(water.water) > initialWater);
});

test("diffusion and sediment controls change physical fields, including the zero setting", () => {
  const fixedConfig = createConfig();
  applyParameters(fixedConfig, { ...DEFAULTS, diffusion: 0, sediment: 0, edges: 0 });
  const mobile = make(fixedConfig);
  mobile.injectGaussian(80, 50, 4, 2.2, options.color, 0, 0.3);
  const before = mobile.mobileA.slice();
  for (let i = 0; i < 12; i++) mobile.step(1, 60);
  assert.deepEqual(mobile.mobileA, before);
  assert.equal(sum(mobile.fixedA) + sum(mobile.sedimentA) + sum(mobile.rimA), 0);

  const movingConfig = createConfig();
  applyParameters(movingConfig, { ...DEFAULTS, diffusion: 200, sediment: 300 });
  const moving = make(movingConfig);
  moving.injectGaussian(80, 50, 4, 2.2, options.color, 0, 0.3);
  for (let i = 0; i < 12; i++) moving.step(1, 60);
  assert.ok(moving.mobileA[50 * 160 + 92] > mobile.mobileA[50 * 160 + 92]);
  assert.ok(sum(moving.fixedA) + sum(moving.sedimentA) > 0);
  assert.equal(ART_CONFIG.simulation.pigmentDiffusion, 0.29);
});

test("drying conserves pigment and discarding returns to fresh paper", () => {
  const sim = make();
  sim.injectGaussian(80, 50, 4, 2.2, options.color, 0.8, 0.5);
  const mass = pigmentMass(sim);
  sim.dry();
  assert.ok(Math.abs(pigmentMass(sim) - mass) < 0.00001);
  assert.equal(sum(sim.water), 0);
  assert.equal(sum(sim.mobileA), 0);
  sim.reset();
  assert.equal(pigmentMass(sim), 0);
  assert.deepEqual(sim.captureState(), make().captureState());
});

test("repeated painting caps premultiplied RGB together with pigment alpha", () => {
  const sim = make();
  for (let i = 0; i < 30; i++) sim.injectGaussian(80, 50, 4, 2.2, options.color, 1, 1);
  const index = 50 * 160 + 80;
  assert.equal(sim.mobileA[index], sim.config.simulation.maxPigment);
  for (const [field, component] of [["mobileR", "r"], ["mobileG", "g"], ["mobileB", "b"]]) {
    assert.ok(Math.abs(sim[field][index] / sim.mobileA[index] - options.color[component]) < 0.000001);
  }
});

test("Mayakovsky keeps the original constructor and owns its configuration", () => {
  const art = new ArtworkSimulation(160, 100, new Float32Array(16000).fill(0.4), new Float32Array(16000).fill(0.2));
  const core = new WatercolorSimulation(160, 100, art.initialWetness, art.retention, ART_CONFIG);
  for (const sim of [art, core]) {
    sim.injectGaussian(80, 50, 5, 2.2, options.color, 0, 0.92);
    sim.addFlow(80, 50, 20, 1, 0.3, 0.7);
    for (let i = 0; i < 4; i++) sim.step(2, 70);
  }
  assert.deepEqual(art.captureState(), core.captureState());
  const image = { data: new Uint8ClampedArray(16000 * 4) };
  assert.equal(art.renderToImageData(image), image);
  assert.ok(image.data.some((value) => value > 0));
});
