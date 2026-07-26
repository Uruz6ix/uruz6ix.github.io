import { CONFIG } from "./config.js";

const clamp = (value, minimum, maximum) =>
  Math.min(maximum, Math.max(minimum, value));

function bilinear(field, width, height, x, y) {
  const clampedX = clamp(x, 0, width - 1.001);
  const clampedY = clamp(y, 0, height - 1.001);

  const x0 = Math.floor(clampedX);
  const y0 = Math.floor(clampedY);
  const x1 = Math.min(width - 1, x0 + 1);
  const y1 = Math.min(height - 1, y0 + 1);

  const tx = clampedX - x0;
  const ty = clampedY - y0;

  const i00 = y0 * width + x0;
  const i10 = y0 * width + x1;
  const i01 = y1 * width + x0;
  const i11 = y1 * width + x1;

  const top =
    field[i00] +
    (field[i10] - field[i00]) * tx;

  const bottom =
    field[i01] +
    (field[i11] - field[i01]) * tx;

  return top + (bottom - top) * ty;
}

function rgbToHsl(red, green, blue) {
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  const lightness = (maximum + minimum) * 0.5;

  if (maximum === minimum) {
    return {
      hue: 0,
      saturation: 0,
      lightness,
    };
  }

  const difference = maximum - minimum;

  const saturation =
    lightness > 0.5
      ? difference / (2 - maximum - minimum)
      : difference / (maximum + minimum);

  let hue;

  if (maximum === red) {
    hue =
      (green - blue) / difference +
      (green < blue ? 6 : 0);
  } else if (maximum === green) {
    hue =
      (blue - red) / difference + 2;
  } else {
    hue =
      (red - green) / difference + 4;
  }

  return {
    hue: hue / 6,
    saturation,
    lightness,
  };
}

function hueToRgb(p, q, value) {
  let t = value;

  if (t < 0) {
    t += 1;
  }

  if (t > 1) {
    t -= 1;
  }

  if (t < 1 / 6) {
    return p + (q - p) * 6 * t;
  }

  if (t < 1 / 2) {
    return q;
  }

  if (t < 2 / 3) {
    return p + (q - p) * (2 / 3 - t) * 6;
  }

  return p;
}

function hslToRgb(hue, saturation, lightness) {
  if (saturation <= 0) {
    return {
      red: lightness,
      green: lightness,
      blue: lightness,
    };
  }

  const q =
    lightness < 0.5
      ? lightness * (1 + saturation)
      : lightness +
        saturation -
        lightness * saturation;

  const p = 2 * lightness - q;

  return {
    red: hueToRgb(p, q, hue + 1 / 3),
    green: hueToRgb(p, q, hue),
    blue: hueToRgb(p, q, hue - 1 / 3),
  };
}

function smoothstep(edge0, edge1, value) {
  const t = clamp(
    (value - edge0) / Math.max(edge1 - edge0, 0.000001),
    0,
    1
  );

  return t * t * (3 - 2 * t);
}

function tonePigment(
  red,
  green,
  blue,
  density,
  depositStrength
) {
  const hsl = rgbToHsl(red, green, blue);

  const diluteLightness =
    CONFIG.render.diluteLightness ?? 0.80;

  const denseLightness =
    CONFIG.render.denseLightness ?? 0.28;

  const denseStrength = clamp(
    Math.pow(density, 0.82) +
      Math.pow(depositStrength, 1.08) * 0.42,
    0,
    1
  );

  const lightness =
    diluteLightness +
    (
      denseLightness -
      diluteLightness
    ) *
    denseStrength;

  const chromaticGate = smoothstep(
    0.08,
    0.26,
    hsl.saturation
  );

  const diluteFloor =
    0.42 * chromaticGate;

  const denseFloor =
    0.58 * chromaticGate;

  const saturationFloor =
    diluteFloor +
    (
      denseFloor -
      diluteFloor
    ) *
    denseStrength;

  const saturation = clamp(
    Math.max(
      hsl.saturation *
        (
          0.98 +
          denseStrength * 0.08
        ),
      saturationFloor
    ) +
      depositStrength * 0.035,
    0,
    1
  );

  return hslToRgb(
    hsl.hue,
    saturation,
    lightness
  );
}

export class WatercolorSimulation {
  constructor(
    width,
    height,
    initialWetness,
    retention
  ) {
    this.textDisplayOpacity = 1;
    this.width = width;
    this.height = height;
    this.size = width * height;

    this.initialWetness = initialWetness;
    this.retention = retention;

    this.water = new Float32Array(this.size);
    this.nextWater = new Float32Array(this.size);
    this.blurWater = new Float32Array(this.size);

    this.mobileA = new Float32Array(this.size);
    this.mobileR = new Float32Array(this.size);
    this.mobileG = new Float32Array(this.size);
    this.mobileB = new Float32Array(this.size);

    this.nextA = new Float32Array(this.size);
    this.nextR = new Float32Array(this.size);
    this.nextG = new Float32Array(this.size);
    this.nextB = new Float32Array(this.size);

    this.blurA = new Float32Array(this.size);
    this.blurR = new Float32Array(this.size);
    this.blurG = new Float32Array(this.size);
    this.blurB = new Float32Array(this.size);

    this.fixedA = new Float32Array(this.size);
    this.fixedR = new Float32Array(this.size);
    this.fixedG = new Float32Array(this.size);
    this.fixedB = new Float32Array(this.size);

    this.rimA = new Float32Array(this.size);
    this.rimR = new Float32Array(this.size);
    this.rimG = new Float32Array(this.size);
    this.rimB = new Float32Array(this.size);

    this.textA = new Float32Array(this.size);
    this.textR = new Float32Array(this.size);
    this.textG = new Float32Array(this.size);
    this.textB = new Float32Array(this.size);

    this.sedimentA = new Float32Array(this.size);
    this.sedimentR = new Float32Array(this.size);
    this.sedimentG = new Float32Array(this.size);
    this.sedimentB = new Float32Array(this.size);

    this.flowX = new Float32Array(this.size);
    this.flowY = new Float32Array(this.size);

    this.paper = new Float32Array(this.size);
    this.capillaryX = new Float32Array(this.size);
    this.capillaryY = new Float32Array(this.size);
    this.capillaryStrength = new Float32Array(this.size);

    this.frayDeltaA = new Float32Array(this.size);
    this.frayDeltaR = new Float32Array(this.size);
    this.frayDeltaG = new Float32Array(this.size);
    this.frayDeltaB = new Float32Array(this.size);

    this.blurTemporary = new Float32Array(this.size);

    this.#buildPaperTexture();
    this.#initializeWater();
  }

  #hashNoise(x, y) {
    const value = Math.sin(
      x * 127.1 +
      y * 311.7
    ) * 43758.5453123;

    return value - Math.floor(value);
  }


#smoothNoise(
  x,
  y,
  scale,
  offsetX,
  offsetY
) {
  const gridX =
    x / scale + offsetX;

  const gridY =
    y / scale + offsetY;

  const x0 = Math.floor(gridX);
  const y0 = Math.floor(gridY);
  const x1 = x0 + 1;
  const y1 = y0 + 1;

  const tx = gridX - x0;
  const ty = gridY - y0;

  const smoothX =
    tx * tx * (3 - 2 * tx);

  const smoothY =
    ty * ty * (3 - 2 * ty);

  const n00 = this.#hashNoise(x0, y0);
  const n10 = this.#hashNoise(x1, y0);
  const n01 = this.#hashNoise(x0, y1);
  const n11 = this.#hashNoise(x1, y1);

  const top =
    n00 +
    (n10 - n00) * smoothX;

  const bottom =
    n01 +
    (n11 - n01) * smoothX;

  return (
    top +
    (bottom - top) * smoothY
  );
}


#buildPaperTexture() {
  for (let index = 0; index < this.size; index += 1) {
    const x = index % this.width;
    const y = Math.floor(index / this.width);

    const fine = this.#smoothNoise(
      x,
      y,
      4.5,
      17,
      31
    );

    const medium = this.#smoothNoise(
      x,
      y,
      12,
      -23,
      11
    );

    const broad = this.#smoothNoise(
      x,
      y,
      34,
      7,
      -19
    );

    this.paper[index] = clamp(
      0.28 * fine +
      0.42 * medium +
      0.30 * broad,
      0,
      1
    );

    const fiberAngleNoise =
      this.#smoothNoise(
        x,
        y,
        18,
        43,
        -29
      );

    const fiberTurn =
      this.#smoothNoise(
        x,
        y,
        48,
        -13,
        37
      );

    const angle =
      fiberAngleNoise *
        Math.PI *
        2 +
      (
        fiberTurn -
        0.5
      ) *
        1.1;

    this.capillaryX[index] =
      Math.cos(angle);

    this.capillaryY[index] =
      Math.sin(angle);

    this.capillaryStrength[index] =
      clamp(
        0.18 +
        medium * 0.36 +
        broad * 0.30 +
        fine * 0.16,
        0,
        1
      );
  }
}

  #initializeWater() {
    for (let index = 0; index < this.size; index += 1) {
      this.water[index] = clamp(
        CONFIG.simulation.initialWater *
          this.initialWetness[index],
        0,
        CONFIG.simulation.maxWater
      );
    }
  }

  reset() {
    this.textA.fill(0);
    this.textR.fill(0);
    this.textG.fill(0);
    this.textB.fill(0);

    this.water.fill(0);
    this.nextWater.fill(0);

    this.mobileA.fill(0);
    this.mobileR.fill(0);
    this.mobileG.fill(0);
    this.mobileB.fill(0);

    this.nextA.fill(0);
    this.nextR.fill(0);
    this.nextG.fill(0);
    this.nextB.fill(0);

    this.fixedA.fill(0);
    this.fixedR.fill(0);
    this.fixedG.fill(0);
    this.fixedB.fill(0);

    this.rimA.fill(0);
    this.rimR.fill(0);
    this.rimG.fill(0);
    this.rimB.fill(0);

    this.sedimentA.fill(0);
    this.sedimentR.fill(0);
    this.sedimentG.fill(0);
    this.sedimentB.fill(0);

    this.flowX.fill(0);
    this.flowY.fill(0);

    this.frayDeltaA.fill(0);
    this.frayDeltaR.fill(0);
    this.frayDeltaG.fill(0);
    this.frayDeltaB.fill(0);

    this.#initializeWater();
  }

  injectGaussian(
    centerX,
    centerY,
    sigma,
    supportMultiplier,
    color,
    waterAmount,
    pigmentAmount
  ) {
    const supportRadius = sigma * supportMultiplier;
    const supportRadiusSquared =
      supportRadius * supportRadius;

    const minimumX = Math.max(
      0,
      Math.floor(centerX - supportRadius)
    );

    const maximumX = Math.min(
      this.width - 1,
      Math.ceil(centerX + supportRadius)
    );

    const minimumY = Math.max(
      0,
      Math.floor(centerY - supportRadius)
    );

    const maximumY = Math.min(
      this.height - 1,
      Math.ceil(centerY + supportRadius)
    );

    const denominator = 2 * sigma * sigma;

    for (let y = minimumY; y <= maximumY; y += 1) {
      for (let x = minimumX; x <= maximumX; x += 1) {
        const dx = x - centerX;
        const dy = y - centerY;
        const distanceSquared = dx * dx + dy * dy;

        if (distanceSquared > supportRadiusSquared) {
          continue;
        }

        const index = y * this.width + x;

        const gaussian = Math.exp(
          -distanceSquared / denominator
        );

        const texture =
          1 +
          CONFIG.interaction.dropTextureStrength *
            (this.paper[index] - 0.5);

        const falloff = Math.max(
          0,
          gaussian * texture
        );

        const addedWater =
          waterAmount * falloff;

        const addedPigment =
          pigmentAmount * falloff;

        this.water[index] = clamp(
          this.water[index] + addedWater,
          0,
          CONFIG.simulation.maxWater
        );

        this.mobileA[index] = clamp(
          this.mobileA[index] + addedPigment,
          0,
          CONFIG.simulation.maxPigment
        );

        this.mobileR[index] +=
          addedPigment * color.r;

        this.mobileG[index] +=
          addedPigment * color.g;

        this.mobileB[index] +=
          addedPigment * color.b;
      }
    }
  }

  addFlow(
    centerX,
    centerY,
    radius,
    directionX,
    directionY,
    strength
  ) {
    const minimumX = Math.max(
      0,
      Math.floor(centerX - radius)
    );

    const maximumX = Math.min(
      this.width - 1,
      Math.ceil(centerX + radius)
    );

    const minimumY = Math.max(
      0,
      Math.floor(centerY - radius)
    );

    const maximumY = Math.min(
      this.height - 1,
      Math.ceil(centerY + radius)
    );

    const radiusSquared = radius * radius;

    for (let y = minimumY; y <= maximumY; y += 1) {
      for (let x = minimumX; x <= maximumX; x += 1) {
        const dx = x - centerX;
        const dy = y - centerY;
        const distanceSquared = dx * dx + dy * dy;

        if (distanceSquared > radiusSquared) {
          continue;
        }

        const index = y * this.width + x;

        const falloff = Math.pow(
          1 - Math.sqrt(distanceSquared) / radius,
          2
        );

        const localStrength =
          strength * falloff;

        this.flowX[index] +=
          directionX * localStrength;

        this.flowY[index] +=
          directionY * localStrength;

        const magnitude = Math.hypot(
          this.flowX[index],
          this.flowY[index]
        );

        if (magnitude > CONFIG.simulation.maxFlow) {
          const scale =
            CONFIG.simulation.maxFlow /
            magnitude;

          this.flowX[index] *= scale;
          this.flowY[index] *= scale;
        }
      }
    }
  }

  step(frameScale, humidityPercent) {
    const dt = clamp(frameScale, 0.25, 4);
    const humidity = clamp(
      humidityPercent / 100,
      0,
      1
    );
this.#updateWater(dt, humidity);
this.#diffusePigment(dt, humidity);
this.#dissolveText(dt);
this.#frayEdges(dt, humidity);
this.#settlePigment(dt, humidity);
this.#capturePigment(dt, humidity);
this.#decayFlow(dt);

    [this.water, this.nextWater] = [
      this.nextWater,
      this.water,
    ];

    [this.mobileA, this.nextA] = [
      this.nextA,
      this.mobileA,
    ];

    [this.mobileR, this.nextR] = [
      this.nextR,
      this.mobileR,
    ];

    [this.mobileG, this.nextG] = [
      this.nextG,
      this.mobileG,
    ];

    [this.mobileB, this.nextB] = [
      this.nextB,
      this.mobileB,
    ];
  }
setTextLayer(imageData, color, opacity = 0.24) {
  const pixels = imageData.data;

  this.textDisplayOpacity = opacity;

  for (
    let index = 0, pixelIndex = 0;
    index < this.size;
    index += 1, pixelIndex += 4
  ) {
    const sourceAlpha =
      pixels[pixelIndex + 3] / 255;

    // Store physical ink mass independently
    // from its initial visual opacity.
    const alpha = sourceAlpha;

    this.textA[index] = alpha;
    this.textR[index] =
      alpha * color.r;
    this.textG[index] =
      alpha * color.g;
    this.textB[index] =
      alpha * color.b;
  }
}
  #boxBlur(source, destination, radius) {
    if (radius <= 0) {
      destination.set(source);
      return;
    }

    const width = this.width;
    const height = this.height;
    const temporary = this.blurTemporary;

    for (let y = 0; y < height; y += 1) {
      const row = y * width;
      let sum = 0;
      let count = 0;

      for (
        let x = 0;
        x <= Math.min(width - 1, radius);
        x += 1
      ) {
        sum += source[row + x];
        count += 1;
      }

      for (let x = 0; x < width; x += 1) {
        temporary[row + x] = sum / count;

        const removeX = x - radius;
        const addX = x + radius + 1;

        if (removeX >= 0) {
          sum -= source[row + removeX];
          count -= 1;
        }

        if (addX < width) {
          sum += source[row + addX];
          count += 1;
        }
      }
    }

    for (let x = 0; x < width; x += 1) {
      let sum = 0;
      let count = 0;

      for (
        let y = 0;
        y <= Math.min(height - 1, radius);
        y += 1
      ) {
        sum += temporary[y * width + x];
        count += 1;
      }

      for (let y = 0; y < height; y += 1) {
        destination[y * width + x] = sum / count;

        const removeY = y - radius;
        const addY = y + radius + 1;

        if (removeY >= 0) {
          sum -= temporary[removeY * width + x];
          count -= 1;
        }

        if (addY < height) {
          sum += temporary[addY * width + x];
          count += 1;
        }
      }
    }
  }
#dissolveText(dt) {

  const influenceRadius =
    CONFIG.text?.influenceRadius ?? 4;

  const contactThreshold =
    CONFIG.text?.contactThreshold ?? 0.008;

  const dissolveRate =
    CONFIG.text?.dissolveRate ?? 0.075;

  const carryStrength =
    CONFIG.text?.carryStrength ?? 0.45;

  this.#boxBlur(
    this.nextA,
    this.blurA,
    influenceRadius
  );

  for (
    let index = 0;
    index < this.size;
    index += 1
  ) {
    const textAlpha =
      this.textA[index];

    if (textAlpha <= 0.00001) {
      continue;
    }

    const directContact =
      this.nextA[index];

    const nearbyContact =
      this.blurA[index];

    const contact = clamp(
      directContact +
        nearbyContact * 0.9,
      0,
      1
    );

    if (contact <= contactThreshold) {
      continue;
    }

    const activation = smoothstep(
      contactThreshold,
      contactThreshold + 0.12,
      contact
    );

    const movedAlpha = Math.min(
      textAlpha,
      textAlpha *
        dissolveRate *
        activation *
        dt
    );

    if (movedAlpha <= 0.000001) {
      continue;
    }

    const inverseTextAlpha =
      1 / textAlpha;

    const colorRed =
      this.textR[index] *
      inverseTextAlpha;

    const colorGreen =
      this.textG[index] *
      inverseTextAlpha;

    const colorBlue =
      this.textB[index] *
      inverseTextAlpha;

    this.textA[index] -= movedAlpha;
    this.textR[index] -=
      movedAlpha * colorRed;
    this.textG[index] -=
      movedAlpha * colorGreen;
    this.textB[index] -=
      movedAlpha * colorBlue;

    const carriedAlpha =
      movedAlpha * carryStrength;
const grainShare =
  this.paper[index] > 0.58
    ? 0.22
    : 0.05;

const grainAlpha =
  carriedAlpha * grainShare;

const fluidAlpha =
  carriedAlpha - grainAlpha;
    this.nextA[index] = clamp(
      this.nextA[index] +
        fluidAlpha,
      0,
      CONFIG.simulation.maxPigment
    );

    this.nextR[index] +=
      fluidAlpha * colorRed;

    this.nextG[index] +=
      fluidAlpha * colorGreen;

    this.nextB[index] +=
      fluidAlpha * colorBlue;
      this.sedimentA[index] = clamp(
  this.sedimentA[index] +
    grainAlpha,
  0,
  CONFIG.simulation.settleCapacity
);

this.sedimentR[index] +=
  grainAlpha * colorRed;

this.sedimentG[index] +=
  grainAlpha * colorGreen;

this.sedimentB[index] +=
  grainAlpha * colorBlue;
  }
}
  #updateWater(dt, humidity) {
    this.#boxBlur(
      this.water,
      this.blurWater,
      CONFIG.simulation.waterBlurRadius
    );

    const diffusion =
      CONFIG.simulation.waterDiffusion *
      dt;

    const evaporation =
      CONFIG.simulation.evaporation *
      (1 - humidity * 0.82) *
      dt;

    const absorption =
      CONFIG.simulation.absorption *
      dt;

    for (let index = 0; index < this.size; index += 1) {
      const localAbsorption =
        absorption *
        (0.72 + this.paper[index] * 0.56);

      this.nextWater[index] = clamp(
        this.water[index] +
          (
            this.blurWater[index] -
            this.water[index]
          ) *
          diffusion -
          this.water[index] *
          (
            evaporation +
            localAbsorption
          ),
        0,
        CONFIG.simulation.maxWater
      );
    }
  }

  #diffusePigment(dt, humidity) {
    const radius = Math.round(
      CONFIG.simulation.pigmentBlurRadiusLow +
      (
        CONFIG.simulation.pigmentBlurRadiusHigh -
        CONFIG.simulation.pigmentBlurRadiusLow
      ) *
      humidity
    );

    this.#boxBlur(this.mobileA, this.blurA, radius);
    this.#boxBlur(this.mobileR, this.blurR, radius);
    this.#boxBlur(this.mobileG, this.blurG, radius);
    this.#boxBlur(this.mobileB, this.blurB, radius);

    const width = this.width;
    const height = this.height;

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const index = y * width + x;

        const wetness = clamp(
          this.water[index] /
            CONFIG.simulation.wetnessReference,
          0,
          1
        );

        const paperMobility = clamp(
          0.58 +
            this.paper[index] * 0.36 +
            this.capillaryStrength[index] * 0.44,
          0.52,
          1.34
        );

        const diffusionMix = clamp(
          CONFIG.simulation.pigmentDiffusion *
          (0.72 + humidity * 0.5) *
          wetness *
          paperMobility *
          dt,
          0,
          0.72
        );

        let alpha =
          this.mobileA[index] +
          (
            this.blurA[index] -
            this.mobileA[index]
          ) *
          diffusionMix;

        let red =
          this.mobileR[index] +
          (
            this.blurR[index] -
            this.mobileR[index]
          ) *
          diffusionMix;

        let green =
          this.mobileG[index] +
          (
            this.blurG[index] -
            this.mobileG[index]
          ) *
          diffusionMix;

        let blue =
          this.mobileB[index] +
          (
            this.blurB[index] -
            this.mobileB[index]
          ) *
          diffusionMix;


const capillaryStrength =
  this.capillaryStrength[index];

if (
  capillaryStrength > 0.18 &&
  wetness > 0.08
) {
  const fiberDistance =
    0.9 +
    capillaryStrength * 2.2;

  const fiberX =
    this.capillaryX[index] *
    fiberDistance;

  const fiberY =
    this.capillaryY[index] *
    fiberDistance;

  const positiveAlpha = bilinear(
    this.mobileA,
    width,
    height,
    x + fiberX,
    y + fiberY
  );

  const negativeAlpha = bilinear(
    this.mobileA,
    width,
    height,
    x - fiberX,
    y - fiberY
  );

  const usePositive =
    positiveAlpha >= negativeAlpha;

  const sampledAlpha =
    usePositive
      ? positiveAlpha
      : negativeAlpha;

  if (sampledAlpha > alpha) {
    const sourceX =
      usePositive
        ? x + fiberX
        : x - fiberX;

    const sourceY =
      usePositive
        ? y + fiberY
        : y - fiberY;

    const capillaryGain = Math.min(
      (
        sampledAlpha -
        alpha
      ) *
        (
          CONFIG.simulation.capillaryDiffusion ??
          0.075
        ) *
        capillaryStrength *
        wetness *
        dt,
      sampledAlpha * 0.065
    );

    if (capillaryGain > 0.000001) {
      const sampledRed = bilinear(
        this.mobileR,
        width,
        height,
        sourceX,
        sourceY
      );

      const sampledGreen = bilinear(
        this.mobileG,
        width,
        height,
        sourceX,
        sourceY
      );

      const sampledBlue = bilinear(
        this.mobileB,
        width,
        height,
        sourceX,
        sourceY
      );

      const inverseSampledAlpha =
        1 /
        Math.max(
          sampledAlpha,
          0.000001
        );

      alpha += capillaryGain;

      red +=
        capillaryGain *
        sampledRed *
        inverseSampledAlpha;

      green +=
        capillaryGain *
        sampledGreen *
        inverseSampledAlpha;

      blue +=
        capillaryGain *
        sampledBlue *
        inverseSampledAlpha;
    }
  }
}

        const flowX = this.flowX[index];
        const flowY = this.flowY[index];
        const flowMagnitude = Math.hypot(flowX, flowY);

        if (flowMagnitude > 0.001) {
          const sampleDistance =
            CONFIG.simulation.flowSampleDistance;

          const sourceX =
            x - flowX * sampleDistance;

          const sourceY =
            y - flowY * sampleDistance;

          const sampledAlpha = bilinear(
            this.blurA,
            width,
            height,
            sourceX,
            sourceY
          );

          if (sampledAlpha > this.blurA[index]) {
            const gain = clamp(
              (
                sampledAlpha -
                this.blurA[index]
              ) *
              CONFIG.simulation.flowSpread *
              flowMagnitude *
              dt,
              0,
              sampledAlpha * 0.18
            );

            if (gain > 0.000001) {
              const sampledRed = bilinear(
                this.blurR,
                width,
                height,
                sourceX,
                sourceY
              );

              const sampledGreen = bilinear(
                this.blurG,
                width,
                height,
                sourceX,
                sourceY
              );

              const sampledBlue = bilinear(
                this.blurB,
                width,
                height,
                sourceX,
                sourceY
              );

              const inverseAlpha =
                1 /
                Math.max(sampledAlpha, 0.000001);

              alpha += gain;
              red += gain * sampledRed * inverseAlpha;
              green += gain * sampledGreen * inverseAlpha;
              blue += gain * sampledBlue * inverseAlpha;
            }
          }
        }

        this.nextA[index] = clamp(
          alpha,
          0,
          CONFIG.simulation.maxPigment
        );

        this.nextR[index] = Math.max(0, red);
        this.nextG[index] = Math.max(0, green);
        this.nextB[index] = Math.max(0, blue);
      }
    }
  }


#depositFrayBilinear(
  x,
  y,
  alpha,
  red,
  green,
  blue
) {
  const clampedX = clamp(
    x,
    0,
    this.width - 1.001
  );

  const clampedY = clamp(
    y,
    0,
    this.height - 1.001
  );

  const x0 = Math.floor(clampedX);
  const y0 = Math.floor(clampedY);
  const x1 = Math.min(this.width - 1, x0 + 1);
  const y1 = Math.min(this.height - 1, y0 + 1);

  const tx = clampedX - x0;
  const ty = clampedY - y0;

  const weights = [
    [(1 - tx) * (1 - ty), y0 * this.width + x0],
    [tx * (1 - ty), y0 * this.width + x1],
    [(1 - tx) * ty, y1 * this.width + x0],
    [tx * ty, y1 * this.width + x1],
  ];

  for (const [weight, index] of weights) {
    if (weight <= 0) {
      continue;
    }

    const weightedAlpha = alpha * weight;

    this.frayDeltaA[index] += weightedAlpha;
    this.frayDeltaR[index] += red * weight;
    this.frayDeltaG[index] += green * weight;
    this.frayDeltaB[index] += blue * weight;
  }
}

#frayEdges(dt, humidity) {
  this.#boxBlur(
    this.nextA,
    this.blurA,
    1
  );

  this.frayDeltaA.fill(0);
  this.frayDeltaR.fill(0);
  this.frayDeltaG.fill(0);
  this.frayDeltaB.fill(0);

  const minimumAlpha =
    CONFIG.simulation.frayMinimumAlpha ?? 0.003;

  const maximumAlpha =
    CONFIG.simulation.frayMaximumAlpha ?? 0.20;

  const transferRate =
    CONFIG.simulation.frayTransferRate ?? 0.052;

  const minimumReach =
    CONFIG.simulation.frayMinimumReach ?? 0.9;

  const maximumReach =
    CONFIG.simulation.frayMaximumReach ?? 4.8;

  const humidityFactor =
    0.52 + humidity * 0.78;

  for (let y = 2; y < this.height - 2; y += 1) {
    for (let x = 2; x < this.width - 2; x += 1) {
      const index = y * this.width + x;
      const alpha = this.nextA[index];

      if (
        alpha <= minimumAlpha ||
        alpha >= maximumAlpha
      ) {
        continue;
      }

      const gradientX =
        this.blurA[index + 1] -
        this.blurA[index - 1];

      const gradientY =
        this.blurA[index + this.width] -
        this.blurA[index - this.width];

      const gradientLength = Math.hypot(
        gradientX,
        gradientY
      );

      if (gradientLength < 0.0003) {
        continue;
      }

      const capillary =
        this.capillaryStrength[index];

      const paperGate = clamp(
        capillary *
          (
            0.62 +
            this.paper[index] * 0.58
          ),
        0,
        1
      );

      if (paperGate < 0.25) {
        continue;
      }

      const outwardX =
        -gradientX / gradientLength;

      const outwardY =
        -gradientY / gradientLength;

      let fiberX =
        this.capillaryX[index];

      let fiberY =
        this.capillaryY[index];

      if (
        fiberX * outwardX +
        fiberY * outwardY <
        0
      ) {
        fiberX *= -1;
        fiberY *= -1;
      }

      const tangentX = -outwardY;
      const tangentY = outwardX;

      const tangentNoise =
        (
          this.paper[index] -
          0.5
        ) *
        0.82;

      let directionX =
        outwardX * 0.72 +
        fiberX * 0.74 +
        tangentX * tangentNoise;

      let directionY =
        outwardY * 0.72 +
        fiberY * 0.74 +
        tangentY * tangentNoise;

      const directionLength = Math.hypot(
        directionX,
        directionY
      );

      if (directionLength < 0.0001) {
        continue;
      }

      directionX /= directionLength;
      directionY /= directionLength;

      const reach =
        (
          minimumReach +
          (
            maximumReach -
            minimumReach
          ) *
          Math.pow(paperGate, 1.25)
        ) *
        humidityFactor;

      const targetX =
        x + directionX * reach;

      const targetY =
        y + directionY * reach;

      const targetAlpha = bilinear(
        this.nextA,
        this.width,
        this.height,
        targetX,
        targetY
      );

      if (targetAlpha > alpha * 0.78) {
        continue;
      }

      const bandPosition = clamp(
        (
          alpha -
          minimumAlpha
        ) /
        (
          maximumAlpha -
          minimumAlpha
        ),
        0,
        1
      );

      const frontStrength =
        Math.sin(
          Math.PI *
          Math.pow(bandPosition, 0.68)
        );

      const movedAlpha = Math.min(
        alpha * 0.10,
        alpha *
          transferRate *
          frontStrength *
          (
            0.58 +
            paperGate * 1.02
          ) *
          humidityFactor *
          dt
      );

      if (movedAlpha <= 0.000001) {
        continue;
      }

      const inverseAlpha =
        1 / alpha;

      const colorRed =
        this.nextR[index] *
        inverseAlpha;

      const colorGreen =
        this.nextG[index] *
        inverseAlpha;

      const colorBlue =
        this.nextB[index] *
        inverseAlpha;

      this.frayDeltaA[index] -= movedAlpha;
      this.frayDeltaR[index] -=
        movedAlpha * colorRed;
      this.frayDeltaG[index] -=
        movedAlpha * colorGreen;
      this.frayDeltaB[index] -=
        movedAlpha * colorBlue;

      const trail = [
        [0.34, 0.20],
        [0.62, 0.25],
        [0.88, 0.28],
        [1.00, 0.17],
      ];

      for (const [position, weight] of trail) {
        const depositedAlpha =
          movedAlpha * weight;

        this.#depositFrayBilinear(
          x + directionX * reach * position,
          y + directionY * reach * position,
          depositedAlpha,
          depositedAlpha * colorRed,
          depositedAlpha * colorGreen,
          depositedAlpha * colorBlue
        );
      }

      const branchSign =
        this.paper[index] >= 0.5
          ? 1
          : -1;

      const branchTurn =
        (
          0.42 +
          paperGate * 0.45
        ) *
        branchSign;

      let branchDirectionX =
        directionX +
        tangentX * branchTurn;

      let branchDirectionY =
        directionY +
        tangentY * branchTurn;

      const branchLength = Math.hypot(
        branchDirectionX,
        branchDirectionY
      );

      branchDirectionX /= branchLength;
      branchDirectionY /= branchLength;

      const branchAlpha =
        movedAlpha * 0.10;

      this.#depositFrayBilinear(
        x +
          branchDirectionX *
            reach *
            0.86,
        y +
          branchDirectionY *
            reach *
            0.86,
        branchAlpha,
        branchAlpha * colorRed,
        branchAlpha * colorGreen,
        branchAlpha * colorBlue
      );
    }
  }

  for (let index = 0; index < this.size; index += 1) {
    this.nextA[index] = clamp(
      this.nextA[index] +
        this.frayDeltaA[index],
      0,
      CONFIG.simulation.maxPigment
    );

    this.nextR[index] = Math.max(
      0,
      this.nextR[index] +
        this.frayDeltaR[index]
    );

    this.nextG[index] = Math.max(
      0,
      this.nextG[index] +
        this.frayDeltaG[index]
    );

    this.nextB[index] = Math.max(
      0,
      this.nextB[index] +
        this.frayDeltaB[index]
    );
  }
}


  #settlePigment(dt, humidity) {
    this.#boxBlur(
      this.nextA,
      this.blurA,
      1
    );

    const minimumAlpha =
      CONFIG.simulation.settleMinimumAlpha ?? 0.0025;

    const peakAlpha =
      CONFIG.simulation.settlePeakAlpha ?? 0.035;

    const maximumAlpha =
      CONFIG.simulation.settleMaximumAlpha ?? 0.16;

    const baseRate =
      CONFIG.simulation.settleBaseRate ?? 0.0045;

    const paperRate =
      CONFIG.simulation.settlePaperRate ?? 0.018;

    const edgeRate =
      CONFIG.simulation.settleEdgeRate ?? 0.026;

    const maximumShare =
      CONFIG.simulation.settleMaximumShare ?? 0.032;

    const localCapacity =
      CONFIG.simulation.settleCapacity ?? 0.26;

    for (let index = 0; index < this.size; index += 1) {
      const mobileAlpha = this.nextA[index];

      if (
        mobileAlpha <= minimumAlpha ||
        mobileAlpha >= maximumAlpha
      ) {
        continue;
      }

      const risingBand = smoothstep(
        minimumAlpha,
        peakAlpha,
        mobileAlpha
      );

      const fallingBand =
        1 -
        smoothstep(
          peakAlpha,
          maximumAlpha,
          mobileAlpha
        );

      const dispersedBand =
        risingBand * fallingBand;

      if (dispersedBand <= 0.0001) {
        continue;
      }

      const localAverage =
        this.blurA[index];

      const particleContrast = clamp(
        (
          mobileAlpha -
          localAverage * 0.72
        ) /
        Math.max(
          mobileAlpha,
          0.000001
        ),
        0,
        1
      );

      const paperTrap = clamp(
        this.paper[index] * 0.58 +
          this.capillaryStrength[index] * 0.42,
        0,
        1
      );

      const sparseGate = smoothstep(
        0.48,
        0.82,
        paperTrap
      );

      if (sparseGate <= 0.0001) {
        continue;
      }

      const wetness = clamp(
        this.nextWater[index] /
          CONFIG.simulation.wetnessReference,
        0,
        1
      );

      const wetnessWindow =
        smoothstep(0.12, 0.42, wetness) *
        (
          1 -
          smoothstep(0.78, 1.0, wetness)
        );

      const humidityFactor =
        1 - humidity * 0.28;

      const availableCapacity = Math.max(
        0,
        localCapacity -
          this.sedimentA[index]
      );

      if (availableCapacity <= 0.000001) {
        continue;
      }

      const settleRate =
        (
          baseRate +
          paperRate * paperTrap +
          edgeRate * particleContrast
        ) *
        dispersedBand *
        sparseGate *
        wetnessWindow *
        humidityFactor;

      const movedAlpha = Math.min(
        mobileAlpha *
          settleRate *
          dt,
        mobileAlpha *
          maximumShare,
        availableCapacity
      );

      if (movedAlpha <= 0.000001) {
        continue;
      }

      const inverseAlpha =
        1 / mobileAlpha;

      const colorRed =
        this.nextR[index] *
        inverseAlpha;

      const colorGreen =
        this.nextG[index] *
        inverseAlpha;

      const colorBlue =
        this.nextB[index] *
        inverseAlpha;

      this.nextA[index] -= movedAlpha;
      this.nextR[index] -=
        movedAlpha * colorRed;
      this.nextG[index] -=
        movedAlpha * colorGreen;
      this.nextB[index] -=
        movedAlpha * colorBlue;

      this.sedimentA[index] += movedAlpha;
      this.sedimentR[index] +=
        movedAlpha * colorRed;
      this.sedimentG[index] +=
        movedAlpha * colorGreen;
      this.sedimentB[index] +=
        movedAlpha * colorBlue;
    }
  }


  #capturePigment(dt, humidity) {
    const dryThreshold =
      CONFIG.simulation.dryCaptureWaterThreshold;

    const rimCapacity =
      CONFIG.simulation.edgeDepositCapacity ?? 0.42;

    for (let index = 0; index < this.size; index += 1) {
      const mobileAlpha = this.nextA[index];

      if (mobileAlpha <= 0.000001) {
        continue;
      }

      const retention = this.retention[index];
      const paper = this.paper[index];

      const stainCapacity =
        CONFIG.simulation.backgroundRetentionCapacity +
        CONFIG.simulation.maskRetentionCapacity *
          retention;

      const availableStain = Math.max(
        0,
        stainCapacity - this.fixedA[index]
      );

      const availableRim = Math.max(
        0,
        rimCapacity - this.rimA[index]
      );

      const edge = Math.max(
        0,
        this.nextA[index] -
          this.blurA[index]
      );

      const edgeRequested =
        edge *
        CONFIG.simulation.edgeDepositRate *
        (
          1 -
          humidity * 0.35
        ) *
        (
          1 +
          retention *
            CONFIG.simulation.edgeDepositMaskWeight
        ) *
        dt;

      const stainRequested =
        mobileAlpha *
        (
          CONFIG.simulation.backgroundCaptureRate +
          CONFIG.simulation.maskCaptureRate *
            retention +
          CONFIG.simulation.granulationCaptureRate *
            paper
        ) *
        dt;

      const dryProgress = clamp(
        (
          dryThreshold -
          this.nextWater[index]
        ) /
        dryThreshold,
        0,
        1
      );

      const dryRequested =
        mobileAlpha *
        CONFIG.simulation.dryCaptureRate *
        Math.pow(
          dryProgress,
          CONFIG.simulation.dryCaptureExponent
        ) *
        dt;

      const rimMoved = Math.min(
        mobileAlpha,
        availableRim,
        edgeRequested
      );

      const remainingAlpha =
        mobileAlpha - rimMoved;

      const stainMoved = Math.min(
        remainingAlpha,
        availableStain,
        stainRequested + dryRequested
      );

      const movedAlpha =
        rimMoved + stainMoved;

      if (movedAlpha <= 0.000001) {
        continue;
      }

      const inverseAlpha =
        1 / mobileAlpha;

      const colorRed =
        this.nextR[index] * inverseAlpha;

      const colorGreen =
        this.nextG[index] * inverseAlpha;

      const colorBlue =
        this.nextB[index] * inverseAlpha;

      this.nextA[index] -= movedAlpha;
      this.nextR[index] -=
        movedAlpha * colorRed;
      this.nextG[index] -=
        movedAlpha * colorGreen;
      this.nextB[index] -=
        movedAlpha * colorBlue;

      if (stainMoved > 0) {
        this.fixedA[index] += stainMoved;
        this.fixedR[index] +=
          stainMoved * colorRed;
        this.fixedG[index] +=
          stainMoved * colorGreen;
        this.fixedB[index] +=
          stainMoved * colorBlue;
      }

      if (rimMoved > 0) {
        this.rimA[index] += rimMoved;
        this.rimR[index] +=
          rimMoved * colorRed;
        this.rimG[index] +=
          rimMoved * colorGreen;
        this.rimB[index] +=
          rimMoved * colorBlue;
      }
    }
  }

  #decayFlow(dt) {
    const decay = Math.pow(
      CONFIG.simulation.flowDecay,
      dt
    );

    for (let index = 0; index < this.size; index += 1) {
      this.flowX[index] *= decay;
      this.flowY[index] *= decay;
    }
  }


renderToImageData(imageData) {
    const pixels = imageData.data;

    const mobileWeight =
      CONFIG.render.mobilePigmentWeight;

    const fixedWeight =
      CONFIG.render.fixedPigmentWeight;

    const rimWeight =
      CONFIG.render.rimPigmentWeight ?? 1.18;

    const sedimentWeight =
      CONFIG.render.sedimentPigmentWeight ?? 0.78;

    const densityScale =
      CONFIG.render.pigmentDensity;

    for (
      let index = 0, pixelIndex = 0;
      index < this.size;
      index += 1, pixelIndex += 4
    ) {
      const rawMobileAlpha =
        this.mobileA[index];
      const rawTextAlpha =
        this.textA[index];
      const rawFixedAlpha =
        this.fixedA[index];

      const rawRimAlpha =
        this.rimA[index];

      const rawSedimentAlpha =
        this.sedimentA[index];

      const mobileMass =
        rawMobileAlpha * mobileWeight;

      const fixedMass =
        rawFixedAlpha * fixedWeight;

      const rimMass =
        rawRimAlpha * rimWeight;

      const sedimentMass =
        rawSedimentAlpha * sedimentWeight;
if (
  rawTextAlpha +
    mobileMass +
    fixedMass +
    rimMass +
    sedimentMass <=
  0.0001
) {
        pixels[pixelIndex] = 0;
        pixels[pixelIndex + 1] = 0;
        pixels[pixelIndex + 2] = 0;
        pixels[pixelIndex + 3] = 0;
        continue;
      }
      const readColor = (
        alpha,
        red,
        green,
        blue
      ) => {
        if (alpha <= 0.000001) {
          return {
            red: 0,
            green: 0,
            blue: 0,
          };
        }

        const inverseAlpha = 1 / alpha;

        return {
          red: clamp(red * inverseAlpha, 0, 1),
          green: clamp(green * inverseAlpha, 0, 1),
          blue: clamp(blue * inverseAlpha, 0, 1),
        };
      };

      const textColor = readColor(
        rawTextAlpha,
        this.textR[index],
        this.textG[index],
        this.textB[index]
      );

      const mobileColor = readColor(
        rawMobileAlpha,
        this.mobileR[index],
        this.mobileG[index],
        this.mobileB[index]
      );

      const fixedColor = readColor(
        rawFixedAlpha,
        this.fixedR[index],
        this.fixedG[index],
        this.fixedB[index]
      );

      const rimColor = readColor(
        rawRimAlpha,
        this.rimR[index],
        this.rimG[index],
        this.rimB[index]
      );

      const sedimentColor = readColor(
        rawSedimentAlpha,
        this.sedimentR[index],
        this.sedimentG[index],
        this.sedimentB[index]
      );

      const mobileDensity =
        1 -
        Math.exp(
          -mobileMass *
            densityScale *
            2.9
        );

      const portraitStrength =
        smoothstep(
          0.015,
          CONFIG.mask.retentionMax ?? 0.58,
          this.retention[index]
        );

      const fixedDensity = Math.min(
        CONFIG.render.maskDensityCap ?? 0.46,
        1 -
          Math.exp(
            -fixedMass *
              densityScale *
              1.18
          )
      );

      const sedimentDensity =
        (
          1 -
          Math.exp(
            -sedimentMass *
              densityScale *
              1.35
          )
        ) *
        0.62;

      const rimDensity = clamp(
        0.46 +
          (
            1 -
            Math.exp(
              -rimMass *
                densityScale *
                3.0
            )
          ) *
          0.54,
        0,
        1
      );

      const tonedMobile = tonePigment(
        mobileColor.red,
        mobileColor.green,
        mobileColor.blue,
        mobileDensity,
        0
      );

      const fixedBase = tonePigment(
        fixedColor.red,
        fixedColor.green,
        fixedColor.blue,
        fixedDensity,
        0.02
      );

      const fixedBaseHsl = rgbToHsl(
        fixedBase.red,
        fixedBase.green,
        fixedBase.blue
      );

      const fixedSourceHsl = rgbToHsl(
        fixedColor.red,
        fixedColor.green,
        fixedColor.blue
      );

      const tonedFixed = hslToRgb(
        fixedBaseHsl.hue,
        clamp(
          Math.max(
            fixedBaseHsl.saturation,
            fixedSourceHsl.saturation *
              (
                CONFIG.render.maskSaturationFloor ??
                0.90
              )
          ),
          0,
          1
        ),
        clamp(
          fixedBaseHsl.lightness +
            portraitStrength *
              (
                CONFIG.render.maskLightnessLift ??
                0.10
              ),
          0.18,
          0.90
        )
      );

      const sedimentBase = tonePigment(
        sedimentColor.red,
        sedimentColor.green,
        sedimentColor.blue,
        sedimentDensity,
        0.03
      );

      const sedimentBaseHsl = rgbToHsl(
        sedimentBase.red,
        sedimentBase.green,
        sedimentBase.blue
      );

      const sedimentSourceHsl = rgbToHsl(
        sedimentColor.red,
        sedimentColor.green,
        sedimentColor.blue
      );

      const tonedSediment = hslToRgb(
        sedimentBaseHsl.hue,
        clamp(
          Math.max(
            sedimentBaseHsl.saturation,
            sedimentSourceHsl.saturation * 0.98
          ),
          0,
          1
        ),
        clamp(
          sedimentBaseHsl.lightness +
            (
              CONFIG.render.sedimentLightnessLift ??
              0.09
            ),
          0.16,
          0.92
        )
      );

      const rimBase = tonePigment(
        rimColor.red,
        rimColor.green,
        rimColor.blue,
        rimDensity,
        0.78
      );

      const rimHsl = rgbToHsl(
        rimBase.red,
        rimBase.green,
        rimBase.blue
      );

      const tonedRim = hslToRgb(
        rimHsl.hue,
        clamp(
          rimHsl.saturation +
            (
              CONFIG.render.edgeSaturationBoost ??
              0.10
            ),
          0,
          1
        ),
        clamp(
          rimHsl.lightness -
            (
              CONFIG.render.edgeLightnessDrop ??
              0.12
            ),
          0.08,
          1
        )
      );

      const mobileOpacity =
        rawMobileAlpha > 0.000001
          ? 1 -
            Math.exp(
              -mobileMass *
                densityScale *
                0.86
            )
          : 0;

      const fixedOpacity =
        rawFixedAlpha > 0.000001
          ? 1 -
            Math.exp(
              -fixedMass *
                densityScale *
                (
                  0.72 +
                  portraitStrength *
                    (
                      CONFIG.render.maskOpacityBoost ??
                      1.55
                    )
                )
            )
          : 0;

      const sedimentOpacity =
        rawSedimentAlpha > 0.000001
          ? 1 -
            Math.exp(
              -sedimentMass *
                densityScale *
                0.68
            )
          : 0;

      const rimOpacity =
        rawRimAlpha > 0.000001
          ? 1 -
            Math.exp(
              -rimMass *
                densityScale *
                1.16
            )
          : 0;

      let underAlpha = 0;
      let underPremultipliedRed = 0;
      let underPremultipliedGreen = 0;
      let underPremultipliedBlue = 0;

      const addLayer = (
        color,
        opacity
      ) => {
        underPremultipliedRed =
          color.red * opacity +
          underPremultipliedRed *
            (1 - opacity);

        underPremultipliedGreen =
          color.green * opacity +
          underPremultipliedGreen *
            (1 - opacity);

        underPremultipliedBlue =
          color.blue * opacity +
          underPremultipliedBlue *
            (1 - opacity);

        underAlpha =
          opacity +
          underAlpha *
            (1 - opacity);
      };
addLayer(
  textColor,
  clamp(
    rawTextAlpha *
      this.textDisplayOpacity,
    0,
    1
  )
);
      addLayer(
        tonedFixed,
        fixedOpacity
      );

      addLayer(
        tonedSediment,
        sedimentOpacity
      );

      addLayer(
        tonedRim,
        rimOpacity
      );

      const underColor =
        underAlpha > 0.000001
          ? {
              red:
                underPremultipliedRed /
                underAlpha,
              green:
                underPremultipliedGreen /
                underAlpha,
              blue:
                underPremultipliedBlue /
                underAlpha,
            }
          : {
              red: 0,
              green: 0,
              blue: 0,
            };

      const outputOpacity =
        mobileOpacity +
        underAlpha *
          (1 - mobileOpacity);

      let coverageRed = 0;
      let coverageGreen = 0;
      let coverageBlue = 0;

      if (outputOpacity > 0.000001) {
        coverageRed =
          (
            tonedMobile.red *
              mobileOpacity +
            underPremultipliedRed *
              (1 - mobileOpacity)
          ) /
          outputOpacity;

        coverageGreen =
          (
            tonedMobile.green *
              mobileOpacity +
            underPremultipliedGreen *
              (1 - mobileOpacity)
          ) /
          outputOpacity;

        coverageBlue =
          (
            tonedMobile.blue *
              mobileOpacity +
            underPremultipliedBlue *
              (1 - mobileOpacity)
          ) /
          outputOpacity;
      }

      const localWetness = clamp(
        this.water[index] /
          CONFIG.simulation.wetnessReference,
        0,
        1
      );

      const wetMix = clamp(
        mobileOpacity *
          underAlpha *
          localWetness *
          (
            CONFIG.render.wetMixStrength ??
            0.08
          ),
        0,
        CONFIG.render.wetMixMaximum ??
          0.08
      );

      let finalRed = coverageRed;
      let finalGreen = coverageGreen;
      let finalBlue = coverageBlue;

      if (
        wetMix > 0.000001 &&
        mobileOpacity > 0.000001 &&
        underAlpha > 0.000001
      ) {
        const mixedRed =
          (
            tonedMobile.red *
              mobileOpacity +
            underColor.red *
              underAlpha
          ) /
          (
            mobileOpacity +
            underAlpha
          );

        const mixedGreen =
          (
            tonedMobile.green *
              mobileOpacity +
            underColor.green *
              underAlpha
          ) /
          (
            mobileOpacity +
            underAlpha
          );

        const mixedBlue =
          (
            tonedMobile.blue *
              mobileOpacity +
            underColor.blue *
              underAlpha
          ) /
          (
            mobileOpacity +
            underAlpha
          );

        const mixedHsl = rgbToHsl(
          mixedRed,
          mixedGreen,
          mixedBlue
        );

        const mobileHsl = rgbToHsl(
          tonedMobile.red,
          tonedMobile.green,
          tonedMobile.blue
        );

        const underHsl = rgbToHsl(
          underColor.red,
          underColor.green,
          underColor.blue
        );

        const restoredMix = hslToRgb(
          mixedHsl.hue,
          clamp(
            Math.max(
              mixedHsl.saturation,
              mobileHsl.saturation * 0.96,
              underHsl.saturation * 0.96
            ),
            0,
            1
          ),
          mixedHsl.lightness
        );

        finalRed =
          coverageRed +
          (
            restoredMix.red -
            coverageRed
          ) *
          wetMix;

        finalGreen =
          coverageGreen +
          (
            restoredMix.green -
            coverageGreen
          ) *
          wetMix;

        finalBlue =
          coverageBlue +
          (
            restoredMix.blue -
            coverageBlue
          ) *
          wetMix;
      }

      const granulation =
        1 +
        CONFIG.render.granulationStrength *
          (this.paper[index] - 0.5);

      pixels[pixelIndex] = clamp(
        finalRed * 255,
        0,
        255
      );

      pixels[pixelIndex + 1] = clamp(
        finalGreen * 255,
        0,
        255
      );

      pixels[pixelIndex + 2] = clamp(
        finalBlue * 255,
        0,
        255
      );

      pixels[pixelIndex + 3] = clamp(
        outputOpacity *
          granulation *
          255,
        0,
        255
      );
    }

    return imageData;
  }
}
