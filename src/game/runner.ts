import { hatchet } from "@/hatchet.client";
import {
  runSimulation,
  getSimulationStatus,
} from "./simulation/astral-echo-simulation";
import { logger } from "@/utils/logger";

async function startSimulation() {
  logger.info("🌌 Astral Echo - Self-Replicating Probe Simulation");
  logger.info("===================================================");

  try {
    // Get initial status
    logger.info("📊 Getting initial simulation status...");
    const status = await hatchet.run(getSimulationStatus, {});
    logger.info({ status }, "Initial status");

    // Start the simulation
    logger.info("\n🚀 Starting simulation with 5 ticks...");
    const result = await hatchet.run(runSimulation, {
      maxTicks: 5,
      tickDuration: 10000, // 10 seconds between ticks
    });

    logger.info({ result }, "\n🎯 Simulation Results");
  } catch (error) {
    logger.error({ error }, "❌ Error running simulation");
  }
}

async function getStatus() {
  try {
    const status = await hatchet.run(getSimulationStatus, {});
    logger.info({ status }, "📊 Current Status");
  } catch (error) {
    logger.error({ error }, "❌ Error getting status");
  }
}

// Simple CLI
const command = process.argv[2];

switch (command) {
  case "start":
    startSimulation();
    break;
  case "status":
    getStatus();
    break;
  default:
    logger.info("Usage:");
    logger.info("  bun run src/game/runner.ts start   - Start simulation");
    logger.info("  bun run src/game/runner.ts status  - Get current status");
}
