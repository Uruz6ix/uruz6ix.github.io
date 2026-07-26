import { CONFIG } from "./config.js";

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(
      new Error(`Failed to load image: ${source}`)
    );
    image.src = source;
  });
}

function chooseViewportGridSize(
  viewportWidth,
  viewportHeight
) {
  const safeWidth = Math.max(1, viewportWidth);
  const safeHeight = Math.max(1, viewportHeight);

  const scale =
    CONFIG.maxSimulationSide /
    Math.max(safeWidth, safeHeight);

  return {
    width: Math.max(
      48,
      Math.round(safeWidth * scale)
    ),
    height: Math.max(
      48,
      Math.round(safeHeight * scale)
    ),
  };
}

function blurField(
  source,
  width,
  height,
  radius
) {
  if (radius <= 0) {
    return source.slice();
  }

  const temporary =
    new Float32Array(source.length);

  const destination =
    new Float32Array(source.length);

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
      destination[y * width + x] =
        sum / count;

      const removeY = y - radius;
      const addY = y + radius + 1;

      if (removeY >= 0) {
        sum -= temporary[
          removeY * width + x
        ];
        count -= 1;
      }

      if (addY < height) {
        sum += temporary[
          addY * width + x
        ];
        count += 1;
      }
    }
  }

  return destination;
}

function fitImageRect(
  imageWidth,
  imageHeight,
  gridWidth,
  gridHeight
) {
  const maximumWidth =
    gridWidth * CONFIG.mask.imageScale;

  const maximumHeight =
    gridHeight * CONFIG.mask.imageScale;

  const imageAspect =
    imageWidth / imageHeight;

  let width = maximumWidth;
  let height = width / imageAspect;

  if (height > maximumHeight) {
    height = maximumHeight;
    width = height * imageAspect;
  }

  return {
    x: (gridWidth - width) * 0.5,
    y: (gridHeight - height) * 0.5,
    width,
    height,
  };
}

function compressRetention(value) {
  const compression =
    CONFIG.mask.retentionCompression;

  const normalized =
    (
      1 -
      Math.exp(-compression * value)
    ) /
    (
      1 -
      Math.exp(-compression)
    );

  return (
    CONFIG.mask.retentionMax *
    normalized
  );
}

function imageToField(
  image,
  viewportWidth,
  viewportHeight
) {
  const sourceWidth =
    image.naturalWidth || image.width;

  const sourceHeight =
    image.naturalHeight || image.height;

  const size = chooseViewportGridSize(
    viewportWidth,
    viewportHeight
  );

  const canvas =
    document.createElement("canvas");

  canvas.width = size.width;
  canvas.height = size.height;

  const context = canvas.getContext(
    "2d",
    {
      willReadFrequently: true,
    }
  );

  context.clearRect(
    0,
    0,
    size.width,
    size.height
  );

  const imageRect = fitImageRect(
    sourceWidth,
    sourceHeight,
    size.width,
    size.height
  );

  context.drawImage(
    image,
    imageRect.x,
    imageRect.y,
    imageRect.width,
    imageRect.height
  );

  const pixels = context.getImageData(
    0,
    0,
    size.width,
    size.height
  ).data;

  const rawRetention =
    new Float32Array(
      size.width * size.height
    );

  for (
    let index = 0, pixelIndex = 0;
    index < rawRetention.length;
    index += 1, pixelIndex += 4
  ) {
    const alpha =
      pixels[pixelIndex + 3] / 255;

    if (alpha <= 0) {
      rawRetention[index] = 0;
      continue;
    }

    const luminance =
      (
        0.2126 * pixels[pixelIndex] +
        0.7152 * pixels[pixelIndex + 1] +
        0.0722 * pixels[pixelIndex + 2]
      ) / 255;

    const darkness = Math.pow(
      Math.max(0, 1 - luminance),
      CONFIG.mask.retentionGamma
    );

    rawRetention[index] =
      compressRetention(
        alpha * darkness
      );
  }

  const retention = blurField(
    rawRetention,
    size.width,
    size.height,
    CONFIG.mask.retentionBlurRadius
  );

  const initialWetness =
    new Float32Array(retention.length);

  for (
    let index = 0;
    index < retention.length;
    index += 1
  ) {
    initialWetness[index] = Math.min(
      1,
      CONFIG.mask.backgroundWetness +
        CONFIG.mask.wetnessVariation *
          retention[index]
    );
  }

  return {
    image,
    width: size.width,
    height: size.height,
    initialWetness,
    retention,

    sourceWidth,
    sourceHeight,

    imageRect,
    viewportWidth,
    viewportHeight,

    source: "image",
  };
}

function makeFallbackField(
  viewportWidth,
  viewportHeight
) {
  const size = chooseViewportGridSize(
    viewportWidth,
    viewportHeight
  );

  const initialWetness =
    new Float32Array(
      size.width * size.height
    );

  const retention =
    new Float32Array(
      size.width * size.height
    );

  initialWetness.fill(
    CONFIG.mask.backgroundWetness
  );

  return {
    image: null,
    width: size.width,
    height: size.height,
    initialWetness,
    retention,

    sourceWidth: size.width,
    sourceHeight: size.height,

    imageRect: {
      x: 0,
      y: 0,
      width: size.width,
      height: size.height,
    },

    viewportWidth,
    viewportHeight,

    source: "fallback",
  };
}

export async function loadDefaultMask(
  viewportWidth = window.innerWidth,
  viewportHeight = window.innerHeight
) {
  try {
    const url = new URL(
      CONFIG.defaultMaskPath,
      import.meta.url
    );

    const image = await loadImage(
      url.href
    );

    return imageToField(
      image,
      viewportWidth,
      viewportHeight
    );
  } catch (error) {
    console.warn(error.message);

    return makeFallbackField(
      viewportWidth,
      viewportHeight
    );
  }
}
