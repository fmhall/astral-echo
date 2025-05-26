import { hatchet } from "@/hatchet.client";
import { gameState } from "@/game/core/game-state";

async function debugGameState() {
  console.log("🔍 === DEBUGGING GAME STATE ===");

  // Test 1: Check initial game state
  console.log("\n1️⃣ Testing initial game state...");
  const allProbes = gameState.getAllProbes();
  console.log(`Found ${allProbes.length} probes`);

  if (allProbes.length > 0) {
    const firstProbe = allProbes[0];
    console.log(`First probe: ${firstProbe.name} (${firstProbe.id})`);

    // Test 2: Try getting probe by ID
    console.log("\n2️⃣ Testing probe retrieval...");
    const retrievedProbe = gameState.getProbe(firstProbe.id);
    console.log(`Retrieved probe: ${retrievedProbe ? "SUCCESS" : "FAILED"}`);

    // Test 3: Try running get-probe-state task
    console.log("\n3️⃣ Testing get-probe-state task...");
    try {
      const stateResult = await hatchet.admin.runWorkflow("get-probe-state", {
        probeId: firstProbe.id,
      });
      const result = await stateResult.output;
      console.log("get-probe-state result:", JSON.stringify(result, null, 2));
    } catch (error) {
      console.error("get-probe-state failed:", error);
    }

    // Test 4: Try running get-environment-state task
    console.log("\n4️⃣ Testing get-environment-state task...");
    try {
      const envResult = await hatchet.admin.runWorkflow(
        "get-environment-state",
        {
          probeId: firstProbe.id,
        },
      );
      const result = await envResult.output;
      console.log(
        "get-environment-state result:",
        JSON.stringify(result, null, 2),
      );
    } catch (error) {
      console.error("get-environment-state failed:", error);
    }

    // Test 5: Try running probe agent
    console.log("\n5️⃣ Testing run-probe-agent task...");
    try {
      const agentResult = await hatchet.admin.runWorkflow("run-probe-agent", {
        probeId: firstProbe.id,
        maxActions: 1,
      });
      const result = await agentResult.output;
      console.log("run-probe-agent result:", JSON.stringify(result, null, 2));
    } catch (error) {
      console.error("run-probe-agent failed:", error);
    }
  }
}

function resetGameState() {
  console.log("🗑️  === RESETTING GAME STATE ===");
  gameState.resetGameState();
  console.log("✅ Game state reset complete!");

  // Show new state
  const allProbes = gameState.getAllProbes();
  console.log(`New game initialized with ${allProbes.length} probes.`);
}

function showGameState() {
  console.log("📊 === CURRENT GAME STATE ===");
  const state = gameState.getState();
  const allProbes = gameState.getAllProbes();
  const allSystems = gameState.getAllSystems();

  console.log(`\n🛸 Probes: ${allProbes.length}`);
  allProbes.forEach((probe) => {
    console.log(
      `  - ${probe.name} (${probe.id.slice(0, 8)}...) Gen ${probe.generation} [${probe.status}]`,
    );
    console.log(
      `    Resources: E:${probe.resources.energy} M:${probe.resources.metal} S:${probe.resources.silicon}`,
    );
  });

  console.log(`\n🌟 Solar Systems: ${allSystems.length}`);
  allSystems.forEach((system) => {
    console.log(`  - ${system.name} (${system.bodies.length} bodies)`);
  });

  console.log(
    `\n⏰ Game started: ${new Date(state.gameStartedAt).toISOString()}`,
  );
  console.log(
    `⏱️  Uptime: ${((Date.now() - state.gameStartedAt) / 1000).toFixed(1)}s`,
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
    console.log("Usage:");
    console.log(
      "  bun run src/game/debug-runner.ts debug  # Test Hatchet tasks",
    );
    console.log("  bun run src/game/debug-runner.ts reset  # Reset game state");
    console.log(
      "  bun run src/game/debug-runner.ts show   # Show current state",
    );
}
