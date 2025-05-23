import { hatchet } from "@/hatchet.client";

async function startSimulation() {
  console.log("🌌 Astral Echo - Self-Replicating Probe Simulation");
  console.log("===================================================");

  try {
    // Get initial status
    console.log("📊 Getting initial simulation status...");
    const statusRef = await hatchet.admin.runWorkflow(
      "get-simulation-status",
      {},
    );
    const status = await statusRef.output;
    console.log("Initial status:", status);

    // Start the simulation
    console.log("\n🚀 Starting simulation with 5 ticks...");
    const resultRef = await hatchet.admin.runWorkflow(
      "run-astral-echo-simulation",
      {
        maxTicks: 5,
        tickDuration: 10000, // 2 seconds between ticks
      },
    );

    const result = await resultRef.output;
    console.log("\n🎯 Simulation Results:", result);
  } catch (error) {
    console.error("❌ Error running simulation:", error);
  }
}

async function getStatus() {
  try {
    const statusRef = await hatchet.admin.runWorkflow(
      "get-simulation-status",
      {},
    );
    const status = await statusRef.output;
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
