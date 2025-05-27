import { hatchet } from "@/hatchet.client";
import {
  runSimulation,
  getSimulationStatus,
} from "./simulation/astral-echo-simulation";

async function startSimulation() {
  console.log("🌌 Astral Echo - Self-Replicating Probe Simulation");
  console.log("===================================================");

  try {
    // Get initial status
    console.log("📊 Getting initial simulation status...");
    const status = await getSimulationStatus.run({});
    console.log("Initial status:", status);

    // Start the simulation
    console.log("\n🚀 Starting simulation with 5 ticks...");
    const result = await runSimulation.run({
      maxTicks: 5,
      tickDuration: 10000, // 2 seconds between ticks
    });

    console.log("\n🎯 Simulation Results:", result);
  } catch (error) {
    console.error("❌ Error running simulation:", error);
  }
}

async function getStatus() {
  try {
    const status = await getSimulationStatus.run({});
    console.log("📊 Current Status:", status);
  } catch (error) {
    console.error("❌ Error getting status:", error);
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
    console.log("Usage:");
    console.log("  bun run src/game/runner.ts start   - Start simulation");
    console.log("  bun run src/game/runner.ts status  - Get current status");
}
