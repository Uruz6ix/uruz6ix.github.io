import { WatercolorSimulation } from "../../shared/watercolor-simulation.js";
import { createConfig, applyParameters, DEFAULTS, PAPER } from "./config.js";
import { ColorPicker, hexToChannels, rgbToHex } from "./color-picker.js";
import { BrushStroke, hexToRgb, paperExit } from "./stroke.js";
import { t } from "./i18n.js";

const $ = (id) => document.getElementById(id);
const app = $("watercolor-app");
const canvas = $("paint-canvas");
const paper = $("paper");
const cursor = $("brush-cursor");
const controls = { ...DEFAULTS };
const config = createConfig();
const context = canvas.getContext("2d", { alpha: false });
const simulationCanvas = document.createElement("canvas");
simulationCanvas.width = PAPER.gridWidth;
simulationCanvas.height = PAPER.gridHeight;
const simulationContext = simulationCanvas.getContext("2d");
const imageData = simulationContext.createImageData(PAPER.gridWidth, PAPER.gridHeight);

let simulation;
let tool = "paint";
let pointerId = null;
let stroke = null;
let paused = false;
let evolving = false;
let dirty = true;
let lastFrame = 0;
let exportURL = null;
const colorPicker = new ColorPicker($("color-plane"), $("hue"), controls.color, selectColor);

function reportError(key) {
  $("error").dataset.i18n = key;
  $("error").textContent = t(key);
  $("error").hidden = false;
}

function selectColor(color) {
  controls.color = color;
  setTool("paint");
  refreshControls();
}

function refreshColor() {
  $("color").value = controls.color.toUpperCase();
  $("color-preview").style.background = controls.color;
  const rgb = hexToChannels(controls.color);
  for (const [index, channel] of ["red", "green", "blue"].entries()) {
    const value = Math.round(rgb[index] * 255);
    $(channel).value = value;
    $(`${channel}-value`).value = value;
    const low = [...rgb]; low[index] = 0;
    const high = [...rgb]; high[index] = 1;
    $(channel).style.background = `linear-gradient(to right, ${rgbToHex(low)}, ${rgbToHex(high)})`;
  }
  colorPicker.setColor(controls.color);
}

function refreshControls() {
  refreshColor();
  for (const [id, value] of Object.entries(controls)) {
    if (id === "color") continue;
    const input = $(id);
    input.value = value;
    input.style.setProperty("--progress", `${(value - input.min) / (input.max - input.min) * 100}%`);
    $(`${id}-value`).value = `${value}${id === "size" ? " px" : "%"}`;
  }
  applyParameters(config, controls);
  refreshCursorSize();
}

function refreshCursorSize() {
  const size = controls.size * paper.getBoundingClientRect().width / PAPER.width;
  cursor.style.width = `${size}px`;
  cursor.style.height = `${size}px`;
}

function setTool(value) {
  tool = value;
  $("paint-tool").setAttribute("aria-pressed", String(tool === "paint"));
  $("water-tool").setAttribute("aria-pressed", String(tool === "water"));
  $("pigment").disabled = tool === "water";
  app.classList.toggle("is-water", tool === "water");
}

function updateActionButtons() {
  const drawing = pointerId !== null;
  for (const id of ["dry", "discard", "save", "pause"]) $(id).disabled = drawing || !simulation;
}

function fitPaper() {
  const area = $("paper-area");
  const style = getComputedStyle(area);
  const width = area.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
  const height = area.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
  const scale = Math.max(0.01, Math.min(width / PAPER.width, height / PAPER.height));
  paper.style.width = `${PAPER.width * scale}px`;
  paper.style.height = `${PAPER.height * scale}px`;
  refreshCursorSize();
}

function draw() {
  context.fillStyle = config.render.paperColor;
  context.fillRect(0, 0, canvas.width, canvas.height);
  simulation.renderToImageData(imageData);
  simulationContext.putImageData(imageData, 0, 0);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(simulationCanvas, 0, 0, canvas.width, canvas.height);
  dirty = false;
}

function eventPoint(event, allowOutside = false) {
  const rect = canvas.getBoundingClientRect();
  const x = (event.clientX - rect.left) / rect.width * PAPER.gridWidth;
  const y = (event.clientY - rect.top) / rect.height * PAPER.gridHeight;
  if (!allowOutside && (x < 0 || x > PAPER.gridWidth || y < 0 || y > PAPER.gridHeight)) return null;
  return {
    x, y,
    pressure: event.pointerType === "pen"
      ? (event.pressure || stroke?.previous.pressure || 0.5) : 1,
  };
}

function updateCursor(event) {
  const rect = canvas.getBoundingClientRect();
  cursor.hidden = event.pointerType === "touch" || !eventPoint(event);
  cursor.style.left = `${event.clientX - rect.left}px`;
  cursor.style.top = `${event.clientY - rect.top}px`;
}

function beginStroke(point) {
  return new BrushStroke(simulation, {
    radius: controls.size / 2 * PAPER.gridWidth / PAPER.width,
    color: hexToRgb(controls.color),
    pigment: tool === "water" ? 0 : controls.pigment / 100 * 1.6,
    water: tool === "water" ? Math.max(0.2, controls.water / 100 * 1.8) : controls.water / 100 * 1.8,
  }, point);
}

function paintEvent(event) {
  const point = eventPoint(event);
  if (!point) {
    if (stroke) stroke.move(paperExit(stroke.previous, eventPoint(event, true), PAPER.gridWidth, PAPER.gridHeight));
    stroke?.finish();
    stroke = null;
  } else if (stroke) {
    stroke.move(point);
  } else {
    // Re-entering the paper starts a new segment, never a line across the gap.
    stroke = beginStroke(point);
  }
  dirty = true;
  evolving = true;
}

canvas.addEventListener("pointerdown", (event) => {
  if (!simulation || pointerId !== null || !event.isPrimary || event.button !== 0) return;
  const point = eventPoint(event);
  if (!point) return;
  event.preventDefault();
  canvas.focus({ preventScroll: true });
  canvas.setPointerCapture(event.pointerId);
  pointerId = event.pointerId;
  stroke = beginStroke(point);
  dirty = true;
  evolving = true;
  updateCursor(event);
  updateActionButtons();
});

canvas.addEventListener("pointermove", (event) => {
  updateCursor(event);
  if (event.pointerId !== pointerId) return;
  const samples = event.getCoalescedEvents?.() || [];
  for (const sample of samples.length ? samples : [event]) paintEvent(sample);
});

function endPointer(event, includeEndpoint = false) {
  if (event.pointerId !== pointerId) return;
  if (includeEndpoint) paintEvent(event);
  stroke?.finish();
  stroke = null;
  pointerId = null;
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  cursor.hidden = event.pointerType === "touch";
  dirty = true;
  updateActionButtons();
}

canvas.addEventListener("pointerup", (event) => endPointer(event, true));
canvas.addEventListener("pointercancel", (event) => endPointer(event));
canvas.addEventListener("lostpointercapture", (event) => endPointer(event));
canvas.addEventListener("pointerleave", () => { cursor.hidden = true; });
window.addEventListener("blur", () => {
  if (pointerId !== null) endPointer({ pointerId, pointerType: "mouse" });
  cursor.hidden = true;
});

function togglePause() {
  paused = !paused;
  lastFrame = performance.now();
  $("pause").textContent = t(paused ? "resume" : "pause");
  $("pause").setAttribute("aria-pressed", String(paused));
  app.classList.toggle("is-paused", paused);
}

document.addEventListener("watercolor-languagechange", () => {
  $("pause").textContent = t(paused ? "resume" : "pause");
  colorPicker.paint();
});
$("pause").addEventListener("click", togglePause);
$("dry").addEventListener("click", () => {
  simulation.dry();
  evolving = false;
  dirty = true;
  updateActionButtons();
});
$("discard").addEventListener("click", () => {
  simulation.reset();
  evolving = false;
  dirty = true;
  updateActionButtons();
});

$("save").addEventListener("click", () => {
  draw();
  canvas.toBlob((blob) => {
    if (!blob) { reportError("exportError"); return; }
    if (exportURL) URL.revokeObjectURL(exportURL);
    exportURL = URL.createObjectURL(blob);
    const link = $("export-link");
    link.href = exportURL;
    link.download = `watercolor-${new Date().toISOString().replace(/[:.]/g, "-")}.png`;
    link.hidden = false;
    link.click();
  }, "image/png");
});

for (const [index, channel] of ["red", "green", "blue"].entries()) {
  for (const id of [channel, `${channel}-value`]) {
    $(id).addEventListener("input", (event) => {
      if (event.target.value === "") return;
      const rgb = hexToChannels(controls.color);
      rgb[index] = Math.max(0, Math.min(255, Math.round(Number(event.target.value)))) / 255;
      selectColor(rgbToHex(rgb));
    });
    $(id).addEventListener("blur", refreshColor);
  }
}
$("color").addEventListener("input", (event) => {
  if (/^#?[\da-f]{6}$/i.test(event.target.value)) selectColor("#" + event.target.value.replace("#", "").toLowerCase());
});
$("color").addEventListener("blur", refreshColor);
$("color").addEventListener("keydown", (event) => { if (event.key === "Enter") event.target.blur(); });
for (const id of Object.keys(controls)) {
  if (id === "color") continue;
  $(id).addEventListener("input", (event) => {
    controls[id] = Number(event.target.value);
    refreshControls();
  });
}
$("paint-tool").addEventListener("click", () => setTool("paint"));
$("water-tool").addEventListener("click", () => setTool("water"));
$("reset-settings").addEventListener("click", () => {
  Object.assign(controls, DEFAULTS);
  refreshControls();
  setTool("paint");
});

document.addEventListener("keydown", (event) => {
  if (event.target.closest("input, textarea, select, summary") || pointerId !== null || !simulation) return;
  const modifier = event.ctrlKey || event.metaKey;
  const key = event.key.toLowerCase();
  if (modifier && key === "s") {
    event.preventDefault(); $("save").click();
  } else if (event.code === "Space" && !event.target.closest("button")) {
    event.preventDefault(); if (!event.repeat) togglePause();
  } else if (!modifier && !event.altKey) {
    if (key === "b") setTool("paint");
    if (key === "w") setTool("water");
    if (key === "[" || key === "]") {
      event.preventDefault();
      controls.size = Math.max(6, Math.min(120, controls.size + (key === "[" ? -4 : 4)));
      refreshControls();
    }
  }
});

function animate(now) {
  if (!document.hidden && now - lastFrame >= 1000 / 30) {
    const elapsed = Math.min(66.667, now - lastFrame);
    lastFrame = now;
    if (evolving && !paused) {
      simulation.step(elapsed / 16.667, controls.humidity);
      dirty = true;
    }
    if (dirty) draw();
  }
  requestAnimationFrame(animate);
}

try {
  // Blank, gently humid paper: no portrait mask or memorial text.
  const wetness = new Float32Array(PAPER.gridWidth * PAPER.gridHeight).fill(0.06);
  const retention = new Float32Array(wetness.length);
  simulation = new WatercolorSimulation(PAPER.gridWidth, PAPER.gridHeight, wetness, retention, config);
  refreshControls();
  fitPaper();
  new ResizeObserver(fitPaper).observe($("paper-area"));
  document.addEventListener("visibilitychange", () => { lastFrame = performance.now(); });
  draw();
  updateActionButtons();
  app.classList.add("is-ready");
  requestAnimationFrame(animate);
} catch (error) {
  console.error("Watercolor initialization failed:", error);
  reportError("initError");
}
