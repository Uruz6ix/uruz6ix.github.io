const clamp = (value) => Math.max(0, Math.min(1, value));

export function rgbToHex(rgb) {
  return "#" + rgb.map((value) => Math.round(clamp(value) * 255).toString(16).padStart(2, "0")).join("");
}

export function hexToChannels(hex) {
  return [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255);
}

export function hsvToRgb(hue, saturation, value) {
  const h = ((hue % 360) + 360) % 360 / 60;
  const s = clamp(saturation);
  const v = clamp(value);
  const chroma = v * s;
  const x = chroma * (1 - Math.abs(h % 2 - 1));
  const sector = [
    [chroma, x, 0], [x, chroma, 0], [0, chroma, x],
    [0, x, chroma], [x, 0, chroma], [chroma, 0, x],
  ][Math.floor(h)];
  return sector.map((channel) => channel + v - chroma);
}

export function rgbToHsv(rgb, previousHue = 0) {
  const [r, g, b] = rgb.map(clamp);
  const maximum = Math.max(r, g, b);
  const minimum = Math.min(r, g, b);
  const difference = maximum - minimum;
  // Preserve the hue while picking gray/black, so changing the hue still works.
  let hue = previousHue;
  if (difference > 0) {
    if (maximum === r) hue = 60 * ((g - b) / difference % 6);
    else if (maximum === g) hue = 60 * ((b - r) / difference + 2);
    else hue = 60 * ((r - g) / difference + 4);
    hue = (hue + 360) % 360;
  }
  return { hue, saturation: maximum === 0 ? 0 : difference / maximum, value: maximum };
}

export class ColorPicker {
  constructor(canvas, hueInput, color, onChange) {
    this.canvas = canvas;
    this.context = canvas.getContext("2d");
    this.hueInput = hueInput;
    this.onChange = onChange;
    this.pointer = null;
    this.hue = 0;
    this.color = "";
    this.setColor(color);

    const pick = (event) => {
      const rect = canvas.getBoundingClientRect();
      this.saturation = clamp((event.clientX - rect.left) / rect.width);
      this.value = 1 - clamp((event.clientY - rect.top) / rect.height);
      this.emit();
    };
    canvas.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || !event.isPrimary || this.pointer !== null) return;
      event.preventDefault();
      canvas.focus({ preventScroll: true });
      this.pointer = event.pointerId;
      canvas.setPointerCapture(event.pointerId);
      pick(event);
    });
    canvas.addEventListener("pointermove", (event) => {
      if (event.pointerId === this.pointer) pick(event);
    });
    const finish = (event) => {
      if (event.pointerId !== this.pointer) return;
      this.pointer = null;
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    };
    for (const event of ["pointerup", "pointercancel", "lostpointercapture"]) canvas.addEventListener(event, finish);
    canvas.addEventListener("keydown", (event) => {
      const step = event.shiftKey ? 0.1 : 0.01;
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.key === "ArrowLeft") this.saturation = clamp(this.saturation - step);
      if (event.key === "ArrowRight") this.saturation = clamp(this.saturation + step);
      if (event.key === "ArrowUp") this.value = clamp(this.value + step);
      if (event.key === "ArrowDown") this.value = clamp(this.value - step);
      this.emit();
    });
    hueInput.addEventListener("input", () => {
      this.hue = Number(hueInput.value);
      this.emit();
    });
  }

  emit() {
    this.color = rgbToHex(hsvToRgb(this.hue, this.saturation, this.value));
    this.paint();
    this.onChange(this.color);
  }

  setColor(color) {
    if (color.toLowerCase() === this.color) return;
    const hsv = rgbToHsv(hexToChannels(color), this.hue);
    this.hue = hsv.hue;
    this.saturation = hsv.saturation;
    this.value = hsv.value;
    this.color = color.toLowerCase();
    this.paint();
  }

  paint() {
    const context = this.context;
    const { width, height } = this.canvas;
    const saturation = context.createLinearGradient(0, 0, width, 0);
    saturation.addColorStop(0, "#ffffff");
    saturation.addColorStop(1, rgbToHex(hsvToRgb(this.hue, 1, 1)));
    context.fillStyle = saturation;
    context.fillRect(0, 0, width, height);
    const value = context.createLinearGradient(0, 0, 0, height);
    value.addColorStop(0, "rgba(0, 0, 0, 0)");
    value.addColorStop(1, "#000000");
    context.fillStyle = value;
    context.fillRect(0, 0, width, height);
    const x = this.saturation * width;
    const y = (1 - this.value) * height;
    context.beginPath();
    context.arc(x, y, width / 38, 0, Math.PI * 2);
    context.strokeStyle = "#ffffff";
    context.lineWidth = width / 96;
    context.stroke();
    context.beginPath();
    context.arc(x, y, width / 38 + width / 192, 0, Math.PI * 2);
    context.strokeStyle = "rgba(20, 30, 44, 0.8)";
    context.lineWidth = width / 192;
    context.stroke();
    this.hueInput.value = Math.round(this.hue) % 360;
    const label = this.canvas.ownerDocument.documentElement.lang.startsWith("en") ? "Saturation and brightness" : "饱和度与明度";
    this.canvas.setAttribute("aria-label", `${label} ${this.color.toUpperCase()}`);
  }
}
