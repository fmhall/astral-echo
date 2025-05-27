import { hatchet } from "@/hatchet.client";
import { gameState } from "@/game/core/game-state";

// Import all game tasks
import {
  getProbeState,
  getEnvironmentState,
  getSolarSystemState,
  scanForResources,
} from "@/game/tasks/probe-state-tasks";

import {
  travelToPosition,
  harvestResources,
  manufactureProbe,
} from "@/game/tasks/probe-action-tasks";

import { runProbeAgent } from "@/game/agents/probe-agent";

import {
  runSimulation,
  getSimulationStatus,
} from "@/game/simulation/astral-echo-simulation";

const main = async () => {
  console.log("🚀 Starting Astral Echo Worker...");

  // Initialize game state in the worker process
  console.log("🎮 Initializing game state in worker process...");
  const allProbes = gameState.getAllProbes();

  console.log(`🛸 Initialized with ${allProbes.length} probes:`);
  allProbes.forEach((probe) => {
    console.log(
      `  - ${probe.name} (${probe.id.slice(0, 8)}...) Gen ${probe.generation}`,
    );
  });

  const worker = await hatchet.worker("astral-echo", {
    workflows: [
      // Core probe state tasks
      getProbeState,
      getEnvironmentState,
      getSolarSystemState,
      scanForResources,

      // Probe action tasks
      travelToPosition,
      harvestResources,
      manufactureProbe,

      // AI agent
      runProbeAgent,

      // Simulation orchestrator
      runSimulation,
      getSimulationStatus,
    ],
  });

  console.log("🎮 Astral Echo Worker ready! Game systems initialized.");
  console.log(
    "🌌 Ready to simulate self-replicating probes exploring the stars...",
  );

  await worker.start();
};

main().catch(console.error);
