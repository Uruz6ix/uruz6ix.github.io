import { WatercolorSimulation } from "../../shared/watercolor-simulation.js";
import { DEFAULTS, createConfig, applyParameters } from "./config.js";
import { BrushStroke, hexToRgb, paperExit } from "./stroke.js";
import { normalizeSettings, sameSettings } from "./presets.js";

export const SWATCH = { width: 600, height: 120, gridWidth: 300, gridHeight: 60 };

export class SwatchModel {
  constructor(settings = DEFAULTS) {
    this.config = createConfig();
    const size = SWATCH.gridWidth * SWATCH.gridHeight;
    this.simulation = new WatercolorSimulation(SWATCH.gridWidth, SWATCH.gridHeight, new Float32Array(size).fill(0.06), new Float32Array(size), this.config);
    this.stroke = null;
    this.dirty = true;
    this.evolving = false;
    this.applySettings(settings);
  }

  applySettings(settings) {
    const next = normalizeSettings(settings);
    const changed = !!this.settings && !sameSettings(this.settings, next);
    if (changed) this.clear();
    this.settings = next;
    applyParameters(this.config, this.settings);
    return changed;
  }

  begin(point) {
    const { size, color, pigment, water, tool } = this.settings;
    this.stroke = new BrushStroke(this.simulation, {
      radius: size / 2 * SWATCH.gridWidth / SWATCH.width,
      color: hexToRgb(color),
      pigment: tool === "water" ? 0 : pigment / 100 * 1.6,
      water: tool === "water" ? Math.max(0.2, water / 100 * 1.8) : water / 100 * 1.8,
    }, point);
    this.dirty = true;
    this.evolving = true;
  }

  move(point) {
    if (!this.stroke) this.begin(point);
    else this.stroke.move(point);
    this.dirty = true;
    this.evolving = true;
  }

  finish() { this.stroke?.finish(); this.stroke = null; this.dirty = true; }

  complete() {
    this.finish();
    this.simulation.dry();
    this.evolving = false;
  }

  clear() {
    this.finish();
    this.simulation.reset();
    this.evolving = false;
    this.dirty = true;
  }

  step(elapsed) {
    if (this.evolving) {
      this.simulation.step(elapsed, this.settings.humidity);
      this.dirty = true;
    }
  }
}

export class SwatchSurface {
  constructor(canvas, cursor, getSettings, drawingChanged, sampleCompleted) {
    this.canvas = canvas;
    this.cursor = cursor;
    this.getSettings = getSettings;
    this.drawingChanged = drawingChanged;
    this.sampleCompleted = sampleCompleted;
    this.pointerId = null;
    this.model = new SwatchModel(getSettings());
    this.buffer = document.createElement("canvas");
    this.buffer.width = SWATCH.gridWidth;
    this.buffer.height = SWATCH.gridHeight;
    this.bufferContext = this.buffer.getContext("2d");
    this.pixels = this.bufferContext.createImageData(SWATCH.gridWidth, SWATCH.gridHeight);
    this.context = canvas.getContext("2d", { alpha: false });

    canvas.addEventListener("pointerdown", (event) => {
      if (!event.isPrimary || event.button !== 0 || this.pointerId !== null) return;
      const point = this.point(event);
      if (!point) return;
      event.preventDefault();
      this.updateSettings();
      canvas.focus({ preventScroll: true });
      canvas.setPointerCapture(event.pointerId);
      this.pointerId = event.pointerId;
      this.model.begin(point);
      this.updateCursor(event);
      drawingChanged();
    });
    canvas.addEventListener("pointermove", (event) => {
      this.updateCursor(event);
      if (event.pointerId !== this.pointerId) return;
      const samples = event.getCoalescedEvents?.() || [];
      for (const sample of samples.length ? samples : [event]) this.paint(sample);
    });
    canvas.addEventListener("pointerup", (event) => this.end(event, true));
    for (const name of ["pointercancel", "lostpointercapture"]) canvas.addEventListener(name, (event) => this.end(event));
    canvas.addEventListener("pointerleave", () => { cursor.hidden = true; });
    window.addEventListener("blur", () => {
      if (this.pointerId !== null) this.end({ pointerId: this.pointerId, pointerType: "mouse" });
      cursor.hidden = true;
    });
    new ResizeObserver(() => this.updateCursorSize()).observe(canvas);
    this.draw();
  }

  point(event, outside = false) {
    const rect = this.canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width * SWATCH.gridWidth;
    const y = (event.clientY - rect.top) / rect.height * SWATCH.gridHeight;
    if (!outside && (x < 0 || y < 0 || x > SWATCH.gridWidth || y > SWATCH.gridHeight)) return null;
    return { x, y, pressure: event.pointerType === "pen" ? (event.pressure || this.model.stroke?.previous.pressure || 0.5) : 1 };
  }

  paint(event) {
    const point = this.point(event);
    if (point) this.model.move(point);
    else if (this.model.stroke) {
      this.model.move(paperExit(this.model.stroke.previous, this.point(event, true), SWATCH.gridWidth, SWATCH.gridHeight));
      this.model.finish();
    }
  }

  end(event, endpoint = false) {
    if (this.pointerId === null || event.pointerId !== this.pointerId) return;
    if (endpoint) this.paint(event);
    this.model.complete();
    this.pointerId = null;
    if (this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId);
    this.cursor.hidden = event.pointerType === "touch";
    this.draw();
    this.drawingChanged();
    this.sampleCompleted({ settings: this.model.settings, thumbnail: this.canvas.toDataURL("image/webp", 0.8) });
  }

  updateSettings() {
    if (this.model.applySettings(this.getSettings())) {
      this.cancelPointer();
      this.draw();
    }
    this.updateCursorSize();
  }

  cancelPointer() {
    const pointerId = this.pointerId;
    if (pointerId === null) return;
    this.pointerId = null;
    if (this.canvas.hasPointerCapture(pointerId)) this.canvas.releasePointerCapture(pointerId);
    this.drawingChanged();
  }

  updateCursorSize() {
    const size = this.model.settings.size * this.canvas.getBoundingClientRect().width / SWATCH.width;
    this.cursor.style.width = `${size}px`;
    this.cursor.style.height = `${size}px`;
    this.cursor.classList.toggle("is-water", this.model.settings.tool === "water");
  }

  updateCursor(event) {
    const rect = this.canvas.getBoundingClientRect();
    this.cursor.hidden = event.pointerType === "touch" || !this.point(event);
    this.cursor.style.left = `${event.clientX - rect.left}px`;
    this.cursor.style.top = `${event.clientY - rect.top}px`;
  }

  draw() {
    this.context.fillStyle = this.model.config.render.paperColor;
    this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.model.simulation.renderToImageData(this.pixels);
    this.bufferContext.putImageData(this.pixels, 0, 0);
    this.context.imageSmoothingEnabled = true;
    this.context.drawImage(this.buffer, 0, 0, this.canvas.width, this.canvas.height);
    this.model.dirty = false;
  }

  tick(elapsed, paused) {
    if (!paused) this.model.step(elapsed);
    if (this.model.dirty) this.draw();
  }

  clear() { this.model.clear(); this.cancelPointer(); this.draw(); }
}
