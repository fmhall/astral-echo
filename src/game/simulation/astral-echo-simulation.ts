import { hatchet } from "@/hatchet.client";
import { z } from "zod";
import { gameState } from "@/game/core/game-state";
import {
  ExecutedActionSchema,
  ProbeActionSchema,
  ProbeAgentOutputSchema,
  runProbeAgent,
} from "../agents/probe-agent";
import { BaseTaskOutputSchema } from "@/game/core/types";

// Main simulation task
export const runSimulationInput = z.object({
  maxTicks: z.number().min(1).max(1000).default(100),
  tickDuration: z.number().min(1000).max(60000).default(5000), // milliseconds between ticks
});

// Probe execution result schema
const ProbeExecutionResultSchema = z.object({
  probeId: z.string(),
  probeName: z.string(),
  success: z.boolean(),
  error: z.string().optional(),
  result: ProbeAgentOutputSchema.optional(),
});

// Tick data schema
const TickDataSchema = z.object({
  tick: z.number(),
  timestamp: z.number(),
  probeCount: z.number(),
  successfulProbes: z.number(),
  failedProbes: z.number(),
  probeResults: z.array(ProbeExecutionResultSchema),
  tickDuration: z.number(),
});

// Simulation output schema
export const runSimulationOutput = BaseTaskOutputSchema(
  z.object({
    totalTicks: z.number(),
    simulationDuration: z.number(),
    finalProbeCount: z.number(),
    finalSystemCount: z.number(),
    generations: z.number(),
    executionLog: z.array(TickDataSchema),
  })
);

// Simulation status output schema
export const getSimulationStatusOutput = BaseTaskOutputSchema(
  z.object({
    timestamp: z.number(),
    totalProbes: z.number(),
    totalSystems: z.number(),
    generationStats: z.record(z.number()),
    statusStats: z.record(z.number()),
    totalResources: z.object({
      energy: z.number(),
      metal: z.number(),
      silicon: z.number(),
      hydrogen: z.number(),
      rare_elements: z.number(),
    }),
    gameStartedAt: z.number(),
    uptime: z.number(),
  })
);

// Type exports for better inference
export type RunSimulationInput = z.infer<typeof runSimulationInput>;
export type RunSimulationOutput = z.infer<typeof runSimulationOutput>;
export type ProbeExecutionResult = z.infer<typeof ProbeExecutionResultSchema>;
export type TickData = z.infer<typeof TickDataSchema>;
export type GetSimulationStatusOutput = z.infer<
  typeof getSimulationStatusOutput
>;

// Passive solar energy generation for all probes
function applySolarCharging(ctx: any) {
  const allProbes = gameState.getAllProbes();
  const activeProbes = allProbes.filter(p => p.status === "active");

  if (activeProbes.length === 0) return;

  ctx.logger.info(
    `☀️  Applying solar panel charging to ${activeProbes.length} active probes...`
  );

  activeProbes.forEach(probe => {
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

    ctx.logger.info(
      `  ☀️  ${probe.name}: +${solarEnergyGain} energy → ${updatedResources.energy} total`
    );
  });
}

export const runSimulation = hatchet.task({
  name: "run-astral-echo-simulation",
  executionTimeout: "3600s", // 1 hour max
  fn: async (input: z.infer<typeof runSimulationInput>, ctx) => {
    ctx.logger.info("🌌 Starting Astral Echo Simulation...");
    ctx.logger.info(
      `⚙️  Configuration: ${input.maxTicks} ticks, ${input.tickDuration}ms between ticks`
    );
    ctx.logger.info(
      `☀️  Solar panels provide +20 energy per tick to all active probes`
    );

    const simulationStartTime = Date.now();
    let tick = 0;
    const executionLog: TickData[] = [];

    while (tick < input.maxTicks) {
      tick++;
      const tickStartTime = Date.now();

      ctx.logger.info(`\n⏱️  === SIMULATION TICK ${tick} ===`);

      // Apply passive solar charging at the start of each tick
      applySolarCharging(ctx);

      // Get fresh probe data each tick to avoid stale IDs
      const allProbes = gameState.getAllProbes();
      const activeProbes = allProbes.filter(p => p.status !== "destroyed");

      ctx.logger.info(
        `🛸 Active Probes: ${activeProbes.length} | 🌟 Solar Systems: ${gameState.getAllSystems().length}`
      );

      // Show probe status summary
      if (activeProbes.length > 0) {
        ctx.logger.info(`📊 Probe Status Summary:`);
        activeProbes.forEach(probe => {
          const recentAction =
            probe.memory.experiences.length > 0
              ? probe.memory.experiences[probe.memory.experiences.length - 1]
                  .event
              : "none";
          ctx.logger.info(
            `  • ${probe.name} (Gen ${probe.generation}): E:${probe.resources.energy} M:${probe.resources.metal} S:${probe.resources.silicon} H:${probe.resources.hydrogen} R:${probe.resources.rare_elements} | Last: ${recentAction}`
          );
        });
      }

      // Run each probe's AI agent in parallel
      const probePromises = activeProbes.map(
        async (probe): Promise<ProbeExecutionResult> => {
          try {
            ctx.logger.info(
              `🤖 Starting AI agent for ${probe.name} (${probe.id.slice(0, 8)}...)`
            );

            // Double-check probe still exists before running agent
            const currentProbe = gameState.getProbe(probe.id);
            if (!currentProbe) {
              ctx.logger.error(
                `❌ Probe ${probe.name} (${probe.id}) disappeared before agent run!`
              );
              return {
                probeId: probe.id,
                probeName: probe.name,
                success: false,
                error: `Probe disappeared before agent execution`,
              };
            }

            const result = await ctx.runChild(runProbeAgent, {
              probeId: probe.id,
              maxActions: 3,
            });

            ctx.logger.info(`✅ AI agent completed for ${probe.name}`);

            return {
              probeId: probe.id,
              probeName: probe.name,
              success: true,
              result,
            };
          } catch (error) {
            ctx.logger.error(
              `❌ Error running probe ${probe.name} (${probe.id.slice(0, 8)}...): ${error}`
            );
            return {
              probeId: probe.id,
              probeName: probe.name,
              success: false,
              error: error instanceof Error ? error.message : String(error),
            };
          }
        }
      );

      // Wait for all probe actions to complete
      const probeResults = await Promise.all(probePromises);

      // Log tick results
      const successfulProbes = probeResults.filter(r => r.success);
      const failedProbes = probeResults.filter(r => !r.success);

      ctx.logger.info(`\n📈 === TICK ${tick} RESULTS ===`);
      ctx.logger.info(
        `✅ Successful: ${successfulProbes.length} probes | ❌ Failed: ${failedProbes.length} probes`
      );

      // Show detailed probe results
      if (successfulProbes.length > 0) {
        ctx.logger.info(`\n🎯 Successful Probe Actions:`);
        successfulProbes.forEach(agentResult => {
          if (agentResult.result) {
            ctx.logger.info(
              `  • ${agentResult.probeName}: ${agentResult.result.overallStrategy}`
            );
            ctx.logger.info(
              `    Priority: ${agentResult.result.priority} | Actions: ${agentResult.result.totalActions}`
            );
            agentResult.result.executedActions.forEach(
              (action: z.infer<typeof ExecutedActionSchema>, idx: number) => {
                // Check actual task result for success/failure
                const taskResult = action.result;
                let status = taskResult?.success ? "✅" : "❌"; // Default to failed

                ctx.logger.info(
                  `    ${idx + 1}. ${status} ${action.action} - ${action.reasoning}`
                );

                if (taskResult?.error?.reason) {
                  ctx.logger.info(`        Reason: ${taskResult.error.reason}`);
                }
              }
            );
          }
        });
      }

      // Show failed probe details
      if (failedProbes.length > 0) {
        ctx.logger.warn(`\n💥 Failed Probes:`);
        failedProbes.forEach(fp => {
          ctx.logger.warn(
            `  • ${fp.probeName} (${fp.probeId.slice(0, 8)}...): ${fp.error}`
          );
        });
      }

      // Show updated probe states after actions
      const updatedProbes = gameState
        .getAllProbes()
        .filter(p => p.status !== "destroyed");
      if (updatedProbes.length > 0) {
        ctx.logger.info(`\n🔄 Post-Tick Probe States:`);
        updatedProbes.forEach(probe => {
          ctx.logger.info(
            `  • ${probe.name}: E:${probe.resources.energy} M:${probe.resources.metal} S:${probe.resources.silicon} H:${probe.resources.hydrogen} R:${probe.resources.rare_elements}`
          );
        });
      }

      const tickData: TickData = {
        tick,
        timestamp: Date.now(),
        probeCount: activeProbes.length,
        successfulProbes: successfulProbes.length,
        failedProbes: failedProbes.length,
        probeResults,
        tickDuration: Date.now() - tickStartTime,
      };

      executionLog.push(tickData);

      ctx.logger.info(
        `\n⏱️  Tick ${tick} completed in ${tickData.tickDuration}ms`
      );

      // Check if we should continue (all probes destroyed)
      if (activeProbes.length === 0) {
        ctx.logger.warn("🔚 All probes destroyed. Simulation ending.");
        break;
      }

      // Add a delay between ticks if configured
      if (input.tickDuration > 0 && tick < input.maxTicks) {
        ctx.logger.info(
          `⏳ Waiting ${input.tickDuration}ms until next tick...\n`
        );
        await new Promise(resolve => setTimeout(resolve, input.tickDuration));
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
        ...Object.values(finalState.probes).map(p => p.generation)
      ),
      executionLog,
    };

    ctx.logger.info("\n🎯 === SIMULATION COMPLETE ===");
    ctx.logger.info(
      `🕐 Total time: ${(totalSimulationTime / 1000).toFixed(1)}s`
    );
    ctx.logger.info(`⚡ Total ticks: ${tick}`);
    ctx.logger.info(`🛸 Final probe count: ${finalReport.finalProbeCount}`);
    ctx.logger.info(`🌟 Systems discovered: ${finalReport.finalSystemCount}`);
    ctx.logger.info(`🧬 Maximum generation: ${finalReport.generations}`);

    return runSimulationOutput.parse({
      success: true,
      data: finalReport,
      error: null,
    });
  },
});

// Utility task to get simulation status
export const getSimulationStatusInput = z.object({});

export const getSimulationStatus = hatchet.task({
  name: "get-simulation-status",
  executionTimeout: "10s",
  fn: async (input: z.infer<typeof getSimulationStatusInput>, ctx) => {
    const state = gameState.getState();
    const allProbes = gameState.getAllProbes();
    const allSystems = gameState.getAllSystems();

    // Calculate statistics
    const generationStats = allProbes.reduce(
      (acc, probe) => {
        acc[probe.generation] = (acc[probe.generation] || 0) + 1;
        return acc;
      },
      {} as Record<number, number>
    );

    const statusStats = allProbes.reduce(
      (acc, probe) => {
        acc[probe.status] = (acc[probe.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
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
      }
    );

    ctx.logger.info("\n📊 === SIMULATION STATUS ===");
    ctx.logger.info(`🛸 Total Probes: ${allProbes.length}`);
    ctx.logger.info(`🌟 Solar Systems: ${allSystems.length}`);
    ctx.logger.info(`🧬 Generation Distribution:`, generationStats);
    ctx.logger.info(`⚙️ Status Distribution:`, statusStats);
    ctx.logger.info(`💎 Total Resources:`, totalResources);

    const statusData = {
      timestamp: Date.now(),
      totalProbes: allProbes.length,
      totalSystems: allSystems.length,
      generationStats,
      statusStats,
      totalResources,
      gameStartedAt: state.gameStartedAt,
      uptime: Date.now() - state.gameStartedAt,
    };

    return getSimulationStatusOutput.parse({
      success: true,
      data: statusData,
      error: null,
    });
  },
});
