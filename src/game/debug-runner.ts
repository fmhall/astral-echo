import { hatchet } from "@/hatchet.client";
import { gameState } from "@/game/core/game-state";
import { getEnvironmentState, getProbeState } from "./tasks/probe-state-tasks";
import { runProbeAgent } from "./agents/probe-agent";
import { logger } from "@/utils/logger";

async function debugGameState() {
  logger.info("🔍 === DEBUGGING GAME STATE ===");

  // Test 1: Check initial game state
  logger.info("\n1️⃣ Testing initial game state...");
  const allProbes = gameState.getAllProbes();
  logger.info(`Found ${allProbes.length} probes`);

  if (allProbes.length > 0) {
    const firstProbe = allProbes[0];
    logger.info(`First probe: ${firstProbe.name} (${firstProbe.id})`);

    // Test 2: Try getting probe by ID
    logger.info("\n2️⃣ Testing probe retrieval...");
    const retrievedProbe = gameState.getProbe(firstProbe.id);
    logger.info(`Retrieved probe: ${retrievedProbe ? "SUCCESS" : "FAILED"}`);

    // Test 3: Try running get-probe-state task
    logger.info("\n3️⃣ Testing get-probe-state task...");
    try {
      const stateResult = await hatchet.run(getProbeState, {
        probeId: firstProbe.id,
      });
      logger.info({ result: stateResult }, "get-probe-state result");
    } catch (error) {
      logger.error({ error }, "get-probe-state failed");
    }

    // Test 4: Try running get-environment-state task
    logger.info("\n4️⃣ Testing get-environment-state task...");
    try {
      const envResult = await hatchet.run(getEnvironmentState, {
        probeId: firstProbe.id,
      });
      logger.info({ result: envResult }, "get-environment-state result");
    } catch (error) {
      logger.error({ error }, "get-environment-state failed");
    }

    // Test 5: Try running probe agent
    logger.info("\n5️⃣ Testing run-probe-agent task...");
    try {
      const agentResult = await hatchet.run(runProbeAgent, {
        probeId: firstProbe.id,
        maxActions: 1,
      });
      logger.info({ result: agentResult }, "run-probe-agent result");
    } catch (error) {
      logger.error({ error }, "run-probe-agent failed");
    }
  }
}

function resetGameState() {
  logger.info("🗑️  === RESETTING GAME STATE ===");
  gameState.resetGameState();
  logger.info("✅ Game state reset complete!");

  // Show new state
  const allProbes = gameState.getAllProbes();
  logger.info(`New game initialized with ${allProbes.length} probes.`);
}

function showGameState() {
  logger.info("📊 === CURRENT GAME STATE ===");
  const state = gameState.getState();
  const allProbes = gameState.getAllProbes();
  const allSystems = gameState.getAllSystems();

  logger.info(`\n🛸 Probes: ${allProbes.length}`);
  allProbes.forEach(probe => {
    logger.info(
      `  - ${probe.name} (${probe.id.slice(0, 8)}...) Gen ${probe.generation} [${probe.status}]`
    );
    logger.info(
      `    Resources: E:${probe.resources.energy} M:${probe.resources.metal} S:${probe.resources.silicon}`
    );
  });

  logger.info(`\n🌟 Solar Systems: ${allSystems.length}`);
  allSystems.forEach(system => {
    logger.info(`  - ${system.name} (${system.bodies.length} bodies)`);
  });

  logger.info(
    `\n⏰ Game started: ${new Date(state.gameStartedAt).toISOString()}`
  );
  logger.info(
    `⏱️  Uptime: ${((Date.now() - state.gameStartedAt) / 1000).toFixed(1)}s`
  );
}

// Simple CLI
const command = process.argv[2];

switch (command) {
  case "debug":
    debugGameState();
    break;
  case "reset":
    resetGameState();
    break;
  case "show":
    showGameState();
    break;
  default:
    logger.info("Usage:");
    logger.info(
      "  bun run src/game/debug-runner.ts debug  # Test Hatchet tasks"
    );
    logger.info("  bun run src/game/debug-runner.ts reset  # Reset game state");
    logger.info(
      "  bun run src/game/debug-runner.ts show   # Show current state"
    );
}
