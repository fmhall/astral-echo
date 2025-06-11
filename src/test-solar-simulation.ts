import { hatchet } from "@/hatchet.client";
import { gameState } from "@/game/core/game-state";
import { logger } from "@/utils/logger";

async function testSolarSimulation() {
  logger.info("🌌 Testing Solar Panel Simulation...");

  // Show initial probe state
  const allProbes = gameState.getAllProbes();
  if (allProbes.length > 0) {
    const probe = allProbes[0];
    logger.info(`\n🛸 Initial Probe State:`);
    logger.info(`  Name: ${probe.name}`);
    logger.info(`  Energy: ${probe.resources.energy}`);
    logger.info(`  Metal: ${probe.resources.metal}`);
    logger.info(`  Silicon: ${probe.resources.silicon}`);
    logger.info(`  Hydrogen: ${probe.resources.hydrogen}`);
    logger.info(`  Rare Elements: ${probe.resources.rare_elements}`);
  }

  try {
    logger.info(`\n🚀 Starting simulation with solar charging...`);

    const result = await hatchet.admin.runWorkflow(
      "run-astral-echo-simulation",
      {
        maxTicks: 8,
        tickDuration: 2000, // 2 seconds between ticks
      }
    );

    const output = await result.output;
    logger.info({ output }, "\n✅ Simulation completed!");
  } catch (error) {
    logger.error({ error }, "❌ Simulation failed");
  }

  // Show final probe state
  const finalProbes = gameState.getAllProbes();
  if (finalProbes.length > 0) {
    logger.info(`\n🎯 Final Probe States:`);
    finalProbes.forEach(probe => {
      logger.info(
        `  • ${probe.name} (Gen ${probe.generation}): E:${probe.resources.energy} M:${probe.resources.metal} S:${probe.resources.silicon} H:${probe.resources.hydrogen} R:${probe.resources.rare_elements}`
      );

      // Show recent solar charging events
      const solarEvents = probe.memory.experiences
        .filter(e => e.event === "solar_charging")
        .slice(-3);
      if (solarEvents.length > 0) {
        logger.info(
          `    Recent solar charging: ${solarEvents.map(e => `+${e.data.energyGained}E`).join(", ")}`
        );
      }
    });
  }
}

testSolarSimulation().catch(console.error);
