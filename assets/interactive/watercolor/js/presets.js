import { DEFAULTS } from "./config.js";

export const PRESET_LIMIT = 12;
const LIMITS = { size: [6, 120], pigment: [5, 100], water: [0, 100], diffusion: [0, 200], sediment: [0, 300], edges: [0, 200], drying: [0, 300], humidity: [0, 95] };

export function normalizeSettings(value = {}) {
  const settings = { color: /^#[\da-f]{6}$/i.test(value.color) ? value.color.toLowerCase() : DEFAULTS.color };
  for (const [key, [min, max]] of Object.entries(LIMITS)) {
    settings[key] = Math.max(min, Math.min(max, Math.round(Number.isFinite(value[key]) ? value[key] : DEFAULTS[key])));
  }
  settings.tool = value.tool === "water" ? "water" : "paint";
  return settings;
}

export function sameSettings(a, b) {
  const left = normalizeSettings(a);
  const right = normalizeSettings(b);
  return Object.keys(left).every((key) => left[key] === right[key]);
}

// Keep only the most recent tested combinations for this page's lifetime.
export class PresetStore {
  constructor() {
    this.presets = [];
    this.nextId = 0;
  }

  record({ settings, thumbnail }) {
    const normalized = normalizeSettings(settings);
    const previous = this.presets.find((item) => sameSettings(item.settings, normalized));
    const preset = { id: previous?.id ?? `swatch-${++this.nextId}`, settings: normalized, thumbnail };
    this.presets = [preset, ...this.presets.filter((item) => item.id !== preset.id)].slice(0, PRESET_LIMIT);
    return preset;
  }

  remove(id) {
    this.presets = this.presets.filter((item) => item.id !== id);
  }
}
