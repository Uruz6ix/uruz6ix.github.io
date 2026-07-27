import { CONFIG } from "./config.js";
import { loadDefaultMask } from "./mask.js";
import { WatercolorSimulation } from "./simulation.js";

const canvas =
  document.querySelector("#art-canvas");

if (!canvas) {
  throw new Error(
    "Missing #art-canvas element."
  );
}

const context = canvas.getContext(
  "2d",
  {
    alpha: false,
  }
);

const HUMIDITY = 70;

const PALETTE =
  CONFIG.interaction.palette.map(
    hexToRgb
  );

const state = {
  mask: null,
  simulation: null,

  simulationCanvas:
    document.createElement("canvas"),

  simulationContext: null,
  simulationImageData: null,

  stage: {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  },

  pointer: {
    down: false,
    previousX: 0,
    previousY: 0,
    previousTime: performance.now(),
  },
};

function hexToRgb(hex) {
  const value = Number.parseInt(
    hex.slice(1),
    16
  );

  return {
    r: ((value >> 16) & 255) / 255,
    g: ((value >> 8) & 255) / 255,
    b: (value & 255) / 255,
  };
}

function randomPaletteColor() {
  return PALETTE[
    Math.floor(
      Math.random() * PALETTE.length
    )
  ];
}

function updateStageRect() {
  state.stage.x = 0;
  state.stage.y = 0;
  state.stage.width =
    window.innerWidth;
  state.stage.height =
    window.innerHeight;
}

function resizeCanvas() {
  const dpr = Math.min(
    window.devicePixelRatio || 1,
    CONFIG.performance.maxDevicePixelRatio
  );

  const width = window.innerWidth;
  const height = window.innerHeight;

  canvas.width = Math.round(
    width * dpr
  );

  canvas.height = Math.round(
    height * dpr
  );

  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  context.setTransform(
    dpr,
    0,
    0,
    dpr,
    0,
    0
  );

  updateStageRect();
}

function configureSimulation(mask) {
  state.mask = mask;

  state.simulation =
    new WatercolorSimulation(
      mask.width,
      mask.height,
      mask.initialWetness,
      mask.retention
    );

  state.simulationCanvas.width =
    mask.width;

  state.simulationCanvas.height =
    mask.height;

  state.simulationContext =
    state.simulationCanvas.getContext(
      "2d"
    );

  state.simulationImageData =
    state.simulationContext.createImageData(
      mask.width,
      mask.height
    );
    applyMemorialText(
  state.simulation,
  mask.width,
  mask.height
);

  updateStageRect();
}

function canvasPointFromEvent(event) {
  const rect =
    canvas.getBoundingClientRect();

  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

function pointToSimulation(point) {
  if (!state.mask) {
    return null;
  }

  const { width, height } =
    state.stage;

  if (
    point.x < 0 ||
    point.y < 0 ||
    point.x > width ||
    point.y > height
  ) {
    return null;
  }

  return {
    x:
      point.x /
      width *
      state.mask.width,

    y:
      point.y /
      height *
      state.mask.height,
  };
}

function displayLengthToSimulation(
  length
) {
  const scaleX =
    state.mask.width /
    state.stage.width;

  const scaleY =
    state.mask.height /
    state.stage.height;

  return (
    length *
    (scaleX + scaleY) *
    0.5
  );
}

function dropPigment(point) {
  if (
    !point ||
    !state.simulation
  ) {
    return;
  }

  state.simulation.injectGaussian(
    point.x,
    point.y,
    displayLengthToSimulation(
      CONFIG.interaction.dropSigma
    ),
    CONFIG.interaction.dropSupport,
    randomPaletteColor(),
    CONFIG.interaction.dropWater,
    CONFIG.interaction.dropPigment
  );
}

function steerAlongPath(
  from,
  to,
  elapsedMilliseconds
) {
  if (!state.simulation) {
    return;
  }

  const dx = to.x - from.x;
  const dy = to.y - from.y;

  const distance = Math.hypot(
    dx,
    dy
  );

  if (distance < 0.001) {
    return;
  }

  const directionX =
    dx / distance;

  const directionY =
    dy / distance;

  const speed =
    distance /
    Math.max(
      1,
      elapsedMilliseconds
    );

  const speedFactor = Math.min(
    1,
    speed /
      CONFIG.interaction.maxPointerSpeed
  );

  const radius =
    displayLengthToSimulation(
      CONFIG.interaction.steerRadius
    );

  const spacing = Math.max(
    1,
    radius *
      CONFIG.interaction
        .steerSpacingFactor
  );

  const steps = Math.max(
    1,
    Math.ceil(
      distance / spacing
    )
  );

  const strength =
    CONFIG.interaction
      .steerStrength *
    speedFactor;

  for (
    let step = 1;
    step <= steps;
    step += 1
  ) {
    const t = step / steps;

    state.simulation.addFlow(
      from.x + dx * t,
      from.y + dy * t,
      radius,
      directionX,
      directionY,
      strength
    );
  }
}

function drawBackground() {
  context.fillStyle =
    CONFIG.render.paperColor;

  context.fillRect(
    0,
    0,
    window.innerWidth,
    window.innerHeight
  );
}

function drawWatercolor() {
  if (
    !state.simulation ||
    !state.simulationContext
  ) {
    return;
  }

  state.simulation.renderToImageData(
    state.simulationImageData
  );

  state.simulationContext.putImageData(
    state.simulationImageData,
    0,
    0
  );

  context.save();

  context.globalAlpha =
    CONFIG.render.watercolorOpacity;

  context.imageSmoothingEnabled =
    true;

  context.imageSmoothingQuality =
    "high";

  context.drawImage(
    state.simulationCanvas,
    0,
    0,
    window.innerWidth,
    window.innerHeight
  );

  context.restore();
}

function drawFrame() {
  drawBackground();
  drawWatercolor();
}

let previousFrameTime =
  performance.now();

let accumulatedTime = 0;
let frameCounter = 0;

function animate(now) {
  const elapsed = Math.min(
    80,
    now - previousFrameTime
  );

  previousFrameTime = now;
  accumulatedTime += elapsed;
  frameCounter += 1;

  if (
    state.simulation &&
    frameCounter %
      CONFIG.performance
        .updateEveryFrames ===
      0
  ) {
    state.simulation.step(
      accumulatedTime / 16.667 *6,
      HUMIDITY
    );

    accumulatedTime = 0;
  }

  drawFrame();
  requestAnimationFrame(
    animate
  );
}

canvas.addEventListener(
  "pointerdown",
  (event) => {
    const point =
      pointToSimulation(
        canvasPointFromEvent(event)
      );

    if (!point) {
      return;
    }

    canvas.setPointerCapture(
      event.pointerId
    );

    state.pointer.down = true;
    state.pointer.previousX =
      point.x;
    state.pointer.previousY =
      point.y;
    state.pointer.previousTime =
      performance.now();

    dropPigment(point);
  }
);

canvas.addEventListener(
  "pointermove",
  (event) => {
    if (!state.pointer.down) {
      return;
    }

    const point =
      pointToSimulation(
        canvasPointFromEvent(event)
      );

    if (!point) {
      return;
    }

    const now =
      performance.now();

    steerAlongPath(
      {
        x:
          state.pointer.previousX,
        y:
          state.pointer.previousY,
      },
      point,
      now -
        state.pointer.previousTime
    );

    state.pointer.previousX =
      point.x;

    state.pointer.previousY =
      point.y;

    state.pointer.previousTime =
      now;
  }
);
function hexToTextRgb(hex) {
  const value = Number.parseInt(
    hex.slice(1),
    16
  );

  return {
    r: ((value >> 16) & 255) / 255,
    g: ((value >> 8) & 255) / 255,
    b: (value & 255) / 255,
  };
}

function applyMemorialText(
  simulation,
  width,
  height
) {
  const textCanvas =
    document.createElement("canvas");

  textCanvas.width = width;
  textCanvas.height = height;

  const textContext =
    textCanvas.getContext("2d");

  textContext.clearRect(
    0,
    0,
    width,
    height
  );

  textContext.fillStyle = "#000000";
  textContext.textAlign = "center";
  textContext.textBaseline = "middle";

  const fontSize = Math.max(
    9,
    Math.round(
      Math.min(width, height) * 0.035
    )
  );

  textContext.font =
    `${fontSize}px serif`;

  const lines = [
    "Как говорят, инцидент исперчен.",
    "Любовная лодка разбилась о быт.",
    "С тобой мы в расчете.",
    "И ни к чему перечень",
    "взаимных болей, бед и обид."
  ];

  const lineHeight =
    fontSize * 1.65;

  const startY =
    height * 0.5 -
    (
      lines.length - 1
    ) *
      lineHeight *
      0.5;

  lines.forEach((line, index) => {
    textContext.fillText(
      line,
      width * 0.5,
      startY +
        index * lineHeight
    );
  });

  const imageData =
    textContext.getImageData(
      0,
      0,
      width,
      height
    );

  simulation.setTextLayer(
    imageData,
    hexToTextRgb(
      CONFIG.text?.color ??
        "#727784"
    ),
    CONFIG.text?.opacity ??
      0.24
  );
}
function endPointer(event) {
  state.pointer.down = false;

  if (
    canvas.hasPointerCapture(
      event.pointerId
    )
  ) {
    canvas.releasePointerCapture(
      event.pointerId
    );
  }
}

canvas.addEventListener(
  "pointerup",
  endPointer
);

canvas.addEventListener(
  "pointercancel",
  endPointer
);

window.addEventListener(
  "resize",
  resizeCanvas
);

async function start() {
  resizeCanvas();

  try {
    const mask =
      await loadDefaultMask(
        window.innerWidth,
        window.innerHeight
      );

    configureSimulation(mask);

    requestAnimationFrame(
      animate
    );
  } catch (error) {
    console.error(
      "Mayakovsky initialization failed:",
      error
    );
  }
}

start();
