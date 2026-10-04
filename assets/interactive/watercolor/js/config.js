// Each simulator owns its configuration; the Mayakovsky artwork keeps its own.
export function createConfig() {
  return {
    simulation: {
      initialWater: 1.25,
      waterBlurRadius: 1,
      waterDiffusion: 0.1,
      evaporation: 0.006,
      absorption: 0.0008,
      pigmentBlurRadiusLow: 1,
      pigmentBlurRadiusHigh: 2,
      pigmentDiffusion: 0.16,
      capillaryDiffusion: 0.035,
      wetnessReference: 0.45,
      flowSpread: 0.08,
      flowSampleDistance: 0.9,
      flowDecay: 0.86,
      maxFlow: 2.8,
      backgroundRetentionCapacity: 4,
      maskRetentionCapacity: 0,
      backgroundCaptureRate: 0.0012,
      maskCaptureRate: 0,
      granulationCaptureRate: 0.003,
      edgeDepositRate: 0.055,
      edgeDepositMaskWeight: 0,
      edgeDepositCapacity: 0.6,
      dryCaptureRate: 0.04,
      dryCaptureWaterThreshold: 0.16,
      dryCaptureExponent: 2,
      frayMinimumAlpha: 0.003,
      frayMaximumAlpha: 0.2,
      frayTransferRate: 0.025,
      frayMinimumReach: 0.5,
      frayMaximumReach: 2.8,
      settleMinimumAlpha: 0.0025,
      settlePeakAlpha: 0.08,
      settleMaximumAlpha: 0.16,
      settleBaseRate: 0.003,
      settlePaperRate: 0.004,
      settleEdgeRate: 0.020,
      settleMaximumShare: 0.012,
      settleCapacity: 0.3,
      maxWater: 2.2,
      maxPigment: 4,
    },
    interaction: { dropTextureStrength: 0.06 },
    mask: { retentionMax: 0.58 },
    render: {
      unifiedPigment: true,
      paperColor: "#f5f7fa",
      watercolorOpacity: 1,
      mobilePigmentWeight: 1.3,
      fixedPigmentWeight: 1.3,
      rimPigmentWeight: 1.5,
      sedimentPigmentWeight: 1.3,
      pigmentDensity: 1.15,
      granulationStrength: 0.035,
      diluteLightness: 0.8,
      denseLightness: 0.32,
      edgeSaturationBoost: 0.1,
      edgeLightnessDrop: 0.09,
      sedimentLightnessLift: 0.00,
      maskDensityCap: 1,
      maskOpacityBoost: 0,
      maskLightnessLift: 0,
      maskSaturationFloor: 0.9,
      wetMixStrength: 0.12,
      wetMixMaximum: 0.12,
    },
  };
}

export const PAPER = { width: 1200, height: 800, gridWidth: 512, gridHeight: 341 };
export const DEFAULTS = {
  color: "#3577aa", size: 36, pigment: 65, water: 65,
  diffusion: 70, sediment: 100, edges: 75, drying: 100, humidity: 60,
};

// Multipliers act on the actual transport/deposition rates, including fraying.
export function applyParameters(config, controls) {
  const base = createConfig().simulation;
  const groups = {
    diffusion: ["waterDiffusion", "pigmentDiffusion", "capillaryDiffusion", "frayTransferRate", "flowSpread"],
    sediment: ["backgroundCaptureRate", "granulationCaptureRate", "dryCaptureRate", "settleBaseRate", "settlePaperRate", "settleEdgeRate"],
    edges: ["edgeDepositRate"],
    drying: ["evaporation", "absorption"],
  };
  for (const [control, keys] of Object.entries(groups)) {
    for (const key of keys) config.simulation[key] = base[key] * controls[control] / 100;
  }
}
