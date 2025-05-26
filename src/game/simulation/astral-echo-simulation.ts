import { hatchet } from "@/hatchet.client";
import { z } from "zod";
import { gameState } from "@/game/core/game-state";

// Main simulation task
export const runSimulationInput = z.object({
  maxTicks: z.number().min(1).max(1000).default(100),
  tickDuration: z.number().min(1000).max(60000).default(5000), // milliseconds between ticks
});

// Passive solar energy generation for all probes
function applySolarCharging() {
  const allProbes = gameState.getAllProbes();
  const activeProbes = allProbes.filter((p) => p.status === "active");

  if (activeProbes.length === 0) return;

  console.log(
    `☀️  Applying solar panel charging to ${activeProbes.length} active probes...`,
  );

  activeProbes.forEach((probe) => {
    // Base solar charging rate: 20 energy per tick
    // This is much slower than active energy harvesting but provides steady income
    const solarEnergyGain = 20;

    const updatedResources = {
      ...probe.resources,
      energy: probe.resources.energy + solarEnergyGain,
    };

    // Add solar charging experience to memory
    gameState.addProbeExperience(probe.id, {
      event: "solar_charging",
      data: {
        energyGained: solarEnergyGain,
        newEnergyLevel: updatedResources.energy,
      },
    });

    gameState.updateProbe(probe.id, {
      resources: updatedResources,
    });

    console.log(
      `  ☀️  ${probe.name}: +${solarEnergyGain} energy → ${updatedResources.energy} total`,
    );
  });
}

export const runSimulation = hatchet.task({
  name: "run-astral-echo-simulation",
  executionTimeout: "3600s", // 1 hour max
  fn: async (input: z.infer<typeof runSimulationInput>, ctx) => {
    console.log("🌌 Starting Astral Echo Simulation...");
    console.log(
      `⚙️  Configuration: ${input.maxTicks} ticks, ${input.tickDuration}ms between ticks`,
    );
    console.log(
      `☀️  Solar panels provide +20 energy per tick to all active probes`,
    );

    const simulationStartTime = Date.now();
    let tick = 0;
    const executionLog = [];

    while (tick < input.maxTicks) {
      tick++;
      const tickStartTime = Date.now();

      console.log(`\n⏱️  === SIMULATION TICK ${tick} ===`);

      // Apply passive solar charging at the start of each tick
      applySolarCharging();

      // Get fresh probe data each tick to avoid stale IDs
      const allProbes = gameState.getAllProbes();
      const activeProbes = allProbes.filter((p) => p.status !== "destroyed");

      console.log(
        `🛸 Active Probes: ${activeProbes.length} | 🌟 Solar Systems: ${gameState.getAllSystems().length}`,
      );

      // Show probe status summary
      if (activeProbes.length > 0) {
        console.log(`📊 Probe Status Summary:`);
        activeProbes.forEach((probe) => {
          const recentAction =
            probe.memory.experiences.length > 0
              ? probe.memory.experiences[probe.memory.experiences.length - 1]
                  .event
              : "none";
          console.log(
            `  • ${probe.name} (Gen ${probe.generation}): E:${probe.resources.energy} M:${probe.resources.metal} S:${probe.resources.silicon} H:${probe.resources.hydrogen} R:${probe.resources.rare_elements} | Last: ${recentAction}`,
          );
        });
      }

      // Run each probe's AI agent in parallel
      const probePromises = activeProbes.map(async (probe) => {
        try {
          console.log(
            `🤖 Starting AI agent for ${probe.name} (${probe.id.slice(0, 8)}...)`,
          );

          // Double-check probe still exists before running agent
          const currentProbe = gameState.getProbe(probe.id);
          if (!currentProbe) {
            console.error(
              `❌ Probe ${probe.name} (${probe.id}) disappeared before agent run!`,
            );
            return {
              probeId: probe.id,
              probeName: probe.name,
              success: false,
              error: `Probe disappeared before agent execution`,
            };
          }

          const result = await ctx.runChild("run-probe-agent", {
            probeId: probe.id,
            maxActions: 3,
          });

          console.log(`✅ AI agent completed for ${probe.name}`);

          return {
            probeId: probe.id,
            probeName: probe.name,
            success: true,
            result,
          };
        } catch (error) {
          console.error(
            `❌ Error running probe ${probe.name} (${probe.id.slice(0, 8)}...):`,
            error,
          );
          return {
            probeId: probe.id,
            probeName: probe.name,
            success: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      });

      // Wait for all probe actions to complete
      const probeResults = await Promise.all(probePromises);

      // Log tick results
      const successfulProbes = probeResults.filter((r) => r.success);
      const failedProbes = probeResults.filter((r) => !r.success);

      console.log(`\n📈 === TICK ${tick} RESULTS ===`);
      console.log(
        `✅ Successful: ${successfulProbes.length} probes | ❌ Failed: ${failedProbes.length} probes`,
      );

      // Show detailed probe results
      if (successfulProbes.length > 0) {
        console.log(`\n🎯 Successful Probe Actions:`);
        successfulProbes.forEach((result) => {
          const agentResult = (result.result as any)?.["run-probe-agent"];
          if (agentResult) {
            console.log(
              `  • ${result.probeName}: ${agentResult.overallStrategy}`,
            );
            console.log(
              `    Priority: ${agentResult.priority} | Actions: ${agentResult.totalActions}`,
            );
            agentResult.executedActions?.forEach((action: any, idx: number) => {
              // Check actual task result for success/failure
              const taskResult = action.result;
              let status = "❌"; // Default to failed

              if (taskResult) {
                // Handle different result structures
                if (typeof taskResult === "object") {
                  // Check if it's a wrapped Hatchet result
                  const unwrappedResult =
                    taskResult[action.action] || taskResult;

                  // Debug logging to understand the structure (removed for cleaner output)

                  // Check for success in various formats
                  if (unwrappedResult?.success === true) {
                    status = "✅";
                  } else if (unwrappedResult?.success === false) {
                    status = "❌";
                  } else {
                    // If no explicit success field, assume success if no error
                    status = action.error ? "❌" : "✅";
                  }
                } else {
                  status = "❌";
                }
              }

              // If there's an explicit error, it's definitely failed
              if (action.error) {
                status = "❌";
              }

              console.log(
                `    ${idx + 1}. ${status} ${action.action} - ${action.reasoning}`,
              );

              // Show failure reason if available
              if (status === "❌" && taskResult) {
                const unwrappedResult = taskResult[action.action] || taskResult;
                if (unwrappedResult?.reason) {
                  console.log(`        Reason: ${unwrappedResult.reason}`);
                }
                if (action.error) {
                  console.log(`        Error: ${action.error}`);
                }
              }
            });
          }
        });
      }

      // Show failed probe details
      if (failedProbes.length > 0) {
        console.log(`\n💥 Failed Probes:`);
        failedProbes.forEach((fp) => {
          console.log(
            `  • ${fp.probeName} (${fp.probeId.slice(0, 8)}...): ${fp.error}`,
          );
        });
      }

      // Show updated probe states after actions
      const updatedProbes = gameState
        .getAllProbes()
        .filter((p) => p.status !== "destroyed");
      if (updatedProbes.length > 0) {
        console.log(`\n🔄 Post-Tick Probe States:`);
        updatedProbes.forEach((probe) => {
          console.log(
            `  • ${probe.name}: E:${probe.resources.energy} M:${probe.resources.metal} S:${probe.resources.silicon} H:${probe.resources.hydrogen} R:${probe.resources.rare_elements}`,
          );
        });
      }

      const tickData = {
        tick,
        timestamp: Date.now(),
        probeCount: activeProbes.length,
        successfulProbes: successfulProbes.length,
        failedProbes: failedProbes.length,
        probeResults,
        tickDuration: Date.now() - tickStartTime,
      };

      executionLog.push(tickData);

      console.log(`\n⏱️  Tick ${tick} completed in ${tickData.tickDuration}ms`);

      // Check if we should continue (all probes destroyed)
      if (activeProbes.length === 0) {
        console.log("🔚 All probes destroyed. Simulation ending.");
        break;
      }

      // Add a delay between ticks if configured
      if (input.tickDuration > 0 && tick < input.maxTicks) {
        console.log(`⏳ Waiting ${input.tickDuration}ms until next tick...\n`);
        await new Promise((resolve) => setTimeout(resolve, input.tickDuration));
      }
    }

    // Generate final report
    const finalState = gameState.getState();
    const totalSimulationTime = Date.now() - simulationStartTime;

    const finalReport = {
      totalTicks: tick,
      simulationDuration: totalSimulationTime,
      finalProbeCount: Object.keys(finalState.probes).length,
      finalSystemCount: Object.keys(finalState.solarSystems).length,
      generations: Math.max(
        ...Object.values(finalState.probes).map((p) => p.generation),
      ),
      executionLog,
    };

    console.log("\n🎯 === SIMULATION COMPLETE ===");
    console.log(`🕐 Total time: ${(totalSimulationTime / 1000).toFixed(1)}s`);
    console.log(`⚡ Total ticks: ${tick}`);
    console.log(`🛸 Final probe count: ${finalReport.finalProbeCount}`);
    console.log(`🌟 Systems discovered: ${finalReport.finalSystemCount}`);
    console.log(`🧬 Maximum generation: ${finalReport.generations}`);

    return finalReport;
  },
});

// Utility task to get simulation status
export const getSimulationStatusInput = z.object({});

export const getSimulationStatus = hatchet.task({
  name: "get-simulation-status",
  executionTimeout: "10s",
  fn: async (input: z.infer<typeof getSimulationStatusInput>) => {
    const state = gameState.getState();
    const allProbes = gameState.getAllProbes();
    const allSystems = gameState.getAllSystems();

    // Calculate statistics
    const generationStats = allProbes.reduce(
      (acc, probe) => {
        acc[probe.generation] = (acc[probe.generation] || 0) + 1;
        return acc;
      },
      {} as Record<number, number>,
    );

    const statusStats = allProbes.reduce(
      (acc, probe) => {
        acc[probe.status] = (acc[probe.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const totalResources = allProbes.reduce(
      (acc, probe) => {
        return gameState.addResources(acc, probe.resources);
      },
      {
        energy: 0,
        metal: 0,
        silicon: 0,
        hydrogen: 0,
        rare_elements: 0,
      },
    );

    console.log("\n📊 === SIMULATION STATUS ===");
    console.log(`🛸 Total Probes: ${allProbes.length}`);
    console.log(`🌟 Solar Systems: ${allSystems.length}`);
    console.log(`🧬 Generation Distribution:`, generationStats);
    console.log(`⚙️ Status Distribution:`, statusStats);
    console.log(`💎 Total Resources:`, totalResources);

    return {
      timestamp: Date.now(),
      totalProbes: allProbes.length,
      totalSystems: allSystems.length,
      generationStats,
      statusStats,
      totalResources,
      gameStartedAt: state.gameStartedAt,
      uptime: Date.now() - state.gameStartedAt,
    };
  },
});
