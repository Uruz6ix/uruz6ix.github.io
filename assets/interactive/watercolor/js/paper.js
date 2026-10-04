import { WatercolorSimulation } from "../../shared/watercolor-simulation.js";
import { createConfig, PAPER } from "./config.js";

export const PAPER_SIZE_LIMITS = { min: 64, max: 4096 };
const PIGMENT_FIELDS = ["mobileA", "fixedA", "rimA", "sedimentA", "textA"];

export function paperDimensions(width, height) {
  if (![width, height].every((value) => Number.isInteger(value) && value >= PAPER_SIZE_LIMITS.min && value <= PAPER_SIZE_LIMITS.max)) return null;
  // Match the original sampling density, while keeping large papers affordable.
  const scale = Math.min(PAPER.gridWidth / PAPER.width, Math.sqrt(PAPER.gridWidth * PAPER.gridHeight / (width * height)), PAPER.gridWidth / Math.max(width, height));
  return { width, height, gridWidth: Math.round(width * scale), gridHeight: Math.round(height * scale) };
}

export class PaperModel {
  constructor(config = createConfig()) {
    this.config = config;
    this.dimensions = { ...PAPER };
    this.simulation = this.createSimulation(this.dimensions);
  }

  createSimulation({ gridWidth, gridHeight }) {
    const size = gridWidth * gridHeight;
    return new WatercolorSimulation(gridWidth, gridHeight, new Float32Array(size).fill(0.06), new Float32Array(size), this.config);
  }

  get isBlank() {
    return PIGMENT_FIELDS.every((key) => this.simulation[key].every((value) => value === 0));
  }

  resize(width, height) {
    const dimensions = paperDimensions(width, height);
    if (!dimensions || !this.isBlank) return false;
    const simulation = this.createSimulation(dimensions);
    this.dimensions = dimensions;
    this.simulation = simulation;
    return true;
  }
}
