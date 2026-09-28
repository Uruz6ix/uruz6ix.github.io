const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const mix = (a, b, t) => a + (b - a) * t;

// Clip an exiting stroke to the paper edge without connecting an outside gap.
export function paperExit(from, to, width, height) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  let t = 1;
  if (to.x < 0) t = Math.min(t, -from.x / dx);
  if (to.x > width) t = Math.min(t, (width - from.x) / dx);
  if (to.y < 0) t = Math.min(t, -from.y / dy);
  if (to.y > height) t = Math.min(t, (height - from.y) / dy);
  return { x: mix(from.x, to.x, t), y: mix(from.y, to.y, t), pressure: mix(from.pressure ?? 1, to.pressure ?? 1, t) };
}

export function hexToRgb(hex) {
  const value = Number.parseInt(hex.slice(1), 16);
  return { r: (value >> 16 & 255) / 255, g: (value >> 8 & 255) / 255, b: (value & 255) / 255 };
}

// Arc-length sampling keeps the same pigment load at any pointer event rate.
// The unconsumed distance carries across events, so fast strokes have no gaps.
export class BrushStroke {
  constructor(simulation, options, point) {
    this.simulation = simulation;
    this.options = options;
    this.previous = point;
    this.spacing = Math.max(0.2, options.radius / 2.2 * 0.5);
    this.untilNext = this.spacing;
    this.pendingDistance = 0;
    this.stamp(point, 1);
  }

  stamp(point, share) {
    const pressure = clamp(point.pressure ?? 1, 0.15, 1);
    const sigma = Math.max(0.4, this.options.radius / 2.2 * (0.4 + pressure * 0.6));
    const dose = this.spacing / (sigma * Math.sqrt(2 * Math.PI)) * share;
    this.simulation.injectGaussian(
      point.x, point.y, sigma, 2.2, this.options.color,
      this.options.water * dose,
      this.options.pigment * dose * (0.45 + pressure * 0.55)
    );
  }

  move(point) {
    const from = this.previous;
    const dx = point.x - from.x;
    const dy = point.y - from.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 0.0001) return;
    let walked = this.untilNext;
    while (walked <= distance) {
      const t = walked / distance;
      this.stamp({
        x: mix(from.x, point.x, t), y: mix(from.y, point.y, t),
        pressure: mix(from.pressure ?? 1, point.pressure ?? 1, t),
      }, 1);
      walked += this.spacing;
    }
    this.untilNext = walked - distance;
    this.pendingDistance = this.spacing - this.untilNext;
    this.previous = point;
  }

  finish() {
    if (this.pendingDistance > 0.0001) {
      this.stamp(this.previous, this.pendingDistance / this.spacing);
    }
    this.pendingDistance = 0;
  }
}
