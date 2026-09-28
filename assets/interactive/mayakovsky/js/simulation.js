import { CONFIG } from "./config.js";
import { WatercolorSimulation as Simulation } from "../../shared/watercolor-simulation.js";

// Keep the artwork's four-argument API and its original configuration.
export class WatercolorSimulation extends Simulation {
  constructor(width, height, initialWetness, retention) {
    super(width, height, initialWetness, retention, CONFIG);
  }
}
