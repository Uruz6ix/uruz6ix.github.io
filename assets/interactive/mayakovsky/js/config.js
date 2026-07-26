export const CONFIG = {
  defaultMaskPath: "../assets/mayakovsky-mask.png",

  maxSimulationSide: 440,

  performance: {
    updateEveryFrames: 2,
    maxDevicePixelRatio: 1.5,
  },

  mask: {
    retentionGamma: 1.08,
    retentionBlurRadius: 1,
    retentionMax: 0.58,
    retentionCompression: 1.65,

    backgroundWetness: 0.86,
    wetnessVariation: 0.015,

    imageScale: 0.88,
  },

  simulation: {
    initialWater: 1.25,

    waterBlurRadius: 1,
    waterDiffusion: 0.1,
    evaporation: 0.001,
    absorption: 0.00035,

    pigmentBlurRadiusLow: 2,
    pigmentBlurRadiusHigh: 4,
    pigmentDiffusion: 0.29,
    capillaryDiffusion: 0.08,
    wetnessReference: 0.45,

    flowSpread: 0.22,
    flowSampleDistance: 0.9,
    flowDecay: 0.86,
    maxFlow: 2.8,

    backgroundRetentionCapacity: 0.02,
    maskRetentionCapacity: 0.76,

    backgroundCaptureRate: 0.00012,
    maskCaptureRate: 0.0021,
    granulationCaptureRate: 0.0007,

    edgeDepositRate: 0.105,
    edgeDepositMaskWeight: 0.06,
    edgeDepositCapacity: 0.42,

    dryCaptureRate: 0.012,
    dryCaptureWaterThreshold: 0.16,
    dryCaptureExponent: 2.0,

    frayMinimumAlpha: 0.003,
    frayMaximumAlpha: 0.2,
    frayTransferRate: 0.05,
    frayMinimumReach: 0.9,
    frayMaximumReach: 6.8,

    settleMinimumAlpha: 0.0025,
    settlePeakAlpha: 0.035,
    settleMaximumAlpha: 0.46,

    settleBaseRate: 0.003,
    settlePaperRate: 0.012,
    settleEdgeRate: 0.018,
    settleMaximumShare: 0.02,
    settleCapacity: 0.06,

    maxWater: 2.2,
    maxPigment: 4.0,
  },
  text: {
  color: "#222222",
  opacity: 0.6,

  influenceRadius: 4,
  contactThreshold: 0.008,
  dissolveRate: 0.075,

  carryStrength: 0.45,
},
  interaction: {
    dropSigma: 20,
    dropSupport: 2.2,
    dropWater: 0,
    dropPigment: 0.92,
    dropTextureStrength: 0.1,

    steerRadius: 70,
    steerStrength: 1.0,
    steerSpacingFactor: 0.28,
    maxPointerSpeed: 1.8,

    palette: [
      "#f4d193",
      "#3895e0",
      "#9a6ede",
      "#44e3b1",
    ],
  },

  render: {
    paperColor: "#fdf8ef",
    watercolorOpacity: 0.95,

    mobilePigmentWeight: 0.98,
    fixedPigmentWeight: 1.72,
    rimPigmentWeight: 1.18,
    sedimentPigmentWeight: 0.72,

    pigmentDensity: 0.72,
    granulationStrength: 0.035,

    diluteLightness: 0.8,
    denseLightness: 0.48,

    edgeSaturationBoost: 0.1,
    edgeLightnessDrop: 0.12,

    sedimentLightnessLift: 0.12,

    maskDensityCap: 0.46,
    maskOpacityBoost: 2.55,
    maskLightnessLift: 0.14,
    maskSaturationFloor: 0.90,

    wetMixStrength: 0.06,
    wetMixMaximum: 0.06,
  },
};
