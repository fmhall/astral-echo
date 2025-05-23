import { hatchet } from "@/hatchet.client";
import { gameState } from "@/game/core/game-state";

async function testSolarSimulation() {
  console.log("🌌 Testing Solar Panel Simulation...");

  // Show initial probe state
  const allProbes = gameState.getAllProbes();
  if (allProbes.length > 0) {
    const probe = allProbes[0];
    console.log(`\n🛸 Initial Probe State:`);
    console.log(`  Name: ${probe.name}`);
    console.log(`  Energy: ${probe.resources.energy}`);
    console.log(`  Metal: ${probe.resources.metal}`);
    console.log(`  Silicon: ${probe.resources.silicon}`);
    console.log(`  Hydrogen: ${probe.resources.hydrogen}`);
    console.log(`  Rare Elements: ${probe.resources.rare_elements}`);
  }

  try {
    console.log(`\n🚀 Starting simulation with solar charging...`);

    const result = await hatchet.admin.runWorkflow(
      "run-astral-echo-simulation",
      {
        maxTicks: 8,
        tickDuration: 2000, // 2 seconds between ticks
      },
    );

    const output = await result.output;
    console.log("\n✅ Simulation completed!", output);
  } catch (error) {
    console.error("❌ Simulation failed:", error);
  }

  // Show final probe state
  const finalProbes = gameState.getAllProbes();
  if (finalProbes.length > 0) {
    console.log(`\n🎯 Final Probe States:`);
    finalProbes.forEach((probe) => {
      console.log(
        `  • ${probe.name} (Gen ${probe.generation}): E:${probe.resources.energy} M:${probe.resources.metal} S:${probe.resources.silicon} H:${probe.resources.hydrogen} R:${probe.resources.rare_elements}`,
      );

      // Show recent solar charging events
      const solarEvents = probe.memory.experiences
        .filter((e) => e.event === "solar_charging")
        .slice(-3);
      if (solarEvents.length > 0) {
        console.log(
          `    Recent solar charging: ${solarEvents.map((e) => `+${e.data.energyGained}E`).join(", ")}`,
        );
      }
    });
  }
}

testSolarSimulation().catch(console.error);
