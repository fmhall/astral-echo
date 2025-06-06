import { hatchet } from "@/hatchet.client";
import { z } from "zod";
import { gameState } from "@/game/core/game-state";
import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { Context } from "@hatchet-dev/typescript-sdk/v1/client/worker/context";
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
import { BaseTaskOutputSchema } from "../core/types";

// Utility function for concise task logging
function logTask(
  taskName: string,
  probeId: string,
  probeName: string,
  parameters: any,
  result?: any,
  ctx?: InstanceType<typeof Context>,
) {
  const timestamp = new Date().toISOString().slice(11, 19); // HH:MM:SS
  const params =
    Object.keys(parameters).length > 0
      ? ` params:${JSON.stringify(parameters)}`
      : "";
  const resultSummary = result ? ` → ${result.success ? "✅" : "❌"}` : "";
  const logMessage = `[${timestamp}] 🔧 ${taskName} | ${probeName}(${probeId.slice(0, 8)})${params}${resultSummary}`;

  if (ctx) {
    ctx.logger.info(logMessage);
  } else {
    console.log(logMessage);
  }
}

// Task: Run probe agent
export const runProbeAgentInput = z.object({
  probeId: z.string(),
  maxActions: z.number().min(1).max(10).default(3), // Maximum actions to take in this run
});

export const ProbeAction = z.enum([
  "scan_resources",
  "travel_to_body",
  "harvest_resources",
  "manufacture_probe",
  "explore_system",
  "wait",
]);

export const ProbeActionSchema = z.object({
  action: ProbeAction,
  parameters: z.record(z.any()),
  reasoning: z.string(),
});

const ProbeDecisionSchema = z.object({
  actions: z.array(ProbeActionSchema),
  overallStrategy: z.string(),
  priority: z.enum([
    "survival",
    "expansion",
    "exploration",
    "resource_gathering",
  ]),
});

export const ExecutedActionSchema = ProbeActionSchema.extend({
  result: BaseTaskOutputSchema(z.any()).nullable(),
});

export const ProbeAgentOutputSchema = z.object({
  probeId: z.string(),
  probeName: z.string(),
  overallStrategy: z.string(),
  priority: z.enum([
    "survival",
    "expansion",
    "exploration",
    "resource_gathering",
  ]),
  executedActions: z.array(ExecutedActionSchema),
  totalActions: z.number(),
});

export const runProbeAgent = hatchet.task({
  name: "run-probe-agent",
  executionTimeout: "300s",
  fn: async (input: z.infer<typeof runProbeAgentInput>, ctx) => {
    const probe = gameState.getProbe(input.probeId);

    if (!probe) {
      ctx.logger.error(`Probe ${input.probeId} not found`);
      throw new Error(`Probe ${input.probeId} not found`);
    }

    ctx.logger.info(
      `🤖 [AI AGENT] Analyzing situation for probe ${probe.name} (${probe.id.slice(0, 8)}...)...`,
    );

    try {
      // Get current state information
      logTask("get-probe-state", input.probeId, probe.name, {});
      const probeStateResult = await ctx.runChild(getProbeState, {
        probeId: input.probeId,
      });

      logTask("get-environment-state", input.probeId, probe.name, {});
      const environmentData = await ctx.runChild(getEnvironmentState, {
        probeId: input.probeId,
      });

      const probeData = probeStateResult.data?.probe;

      if (!probeData) {
        ctx.logger.error(
          `❌ [AI AGENT] No probe data returned from get-probe-state for probe ${input.probeId}`,
        );
        throw new Error(
          `Failed to get probe state data for probe ${input.probeId}`,
        );
      }

      if (!environmentData.data) {
        ctx.logger.error(
          `❌ [AI AGENT] No environment data returned from get-environment-state for probe ${input.probeId}`,
        );
        throw new Error(
          `Failed to get environment state data for probe ${input.probeId}`,
        );
      }

      // Build memory context for AI
      const recentExperiences = probeData.memory.experiences.slice(-5);
      const memoryContext =
        recentExperiences.length > 0
          ? `Recent actions: ${recentExperiences.map((e: any) => `${e.event} (${new Date(e.timestamp).toISOString().slice(11, 19)})`).join(", ")}`
          : "No recent actions recorded";

      // Build failure context for better AI decision making
      const recentFailures = recentExperiences
        .filter(
          (e: any) =>
            e.event.includes("failed") ||
            (e.data && e.data.result && !e.data.result.success),
        )
        .map((e: any) => {
          if (e.data && e.data.result) {
            return `${e.event}: ${e.data.result.error?.reason || "unknown reason"}`;
          }
          return e.event;
        });

      const failureContext =
        recentFailures.length > 0
          ? `Recent failures to avoid repeating: ${recentFailures.join(", ")}`
          : "No recent failures";

      ctx.logger.info(`🧠 [AI AGENT] ${probe.name} memory: ${memoryContext}`);
      ctx.logger.info(
        `⚠️  [AI AGENT] ${probe.name} failures: ${failureContext}`,
      );

      // Use AI to decide what actions to take
      ctx.logger.info(`🧠 [AI AGENT] ${probe.name} calling generateObject...`);
      let decision;
      try {
        const result = await generateObject({
          model: openai("gpt-4.1-mini"),
          schema: ProbeDecisionSchema,
          system: `You are an advanced AI controlling a self-replicating space probe in the Astral Echo simulation.
        
        Your probe has these capabilities:
        - Scan celestial bodies for resources
        - Travel between locations (costs energy)
        - Harvest resources from nearby bodies
        - Manufacture new probes (requires significant resources)
        - Explore and discover new areas
        
        Your goals are:
        1. Survive and maintain energy levels
        2. Gather resources efficiently
        3. Replicate when you have sufficient resources
        4. Explore new areas and expand the probe network
        5. Share knowledge with other probes
        
        Consider:
        - Energy management is critical for survival
        - Resource scarcity requires strategic planning
        - Manufacturing new probes accelerates expansion
        - Each probe generation can improve upon the last
        - Coordination with other probes can be beneficial
        
        IMPORTANT: Look at your recent actions/experiences to avoid repeating the same actions unnecessarily.
        If you've already scanned a body recently, consider harvesting or moving to a new location instead.
        
        CRITICAL: Learn from failures! If an action failed recently (like travel due to insufficient energy), 
        don't repeat it immediately. Instead:
        - If travel failed due to energy, wait or harvest energy first
        - If manufacturing failed due to resources, gather more resources first
        - If harvesting failed due to distance, travel closer first
        
        Be strategic, efficient, and focused on long-term expansion goals.
        
        IMPORTANT: For each action, include a "parameters" object with required fields:
        - scan_resources: {"bodyId": "celestial_body_id"}
        - travel_to_body: {"bodyId": "celestial_body_id"}
        - harvest_resources: {"bodyId": "celestial_body_id", "duration": number}
        - manufacture_probe: {"newProbeName": "string"}
        - wait: {} (empty object)
        - explore_system: {} (empty object)`,

          prompt: `Analyze the current situation and decide on the next ${input.maxActions} actions for this probe:
        
        Probe Status:
        - Name: ${probeData.name}
        - Generation: ${probeData.generation}
        - Status: ${probeData.status}
        - Energy: ${probeData.resources.energy}
        - Metal: ${probeData.resources.metal}
        - Silicon: ${probeData.resources.silicon}
        - Hydrogen: ${probeData.resources.hydrogen}
        - Rare Elements: ${probeData.resources.rare_elements}
        - Position: (${probeData.position.x}, ${probeData.position.y}, ${probeData.position.z})
        
        Environment:
        - Current System: ${environmentData.data.currentSystem.name}
        - Nearest Body: ${environmentData.data.closestBody.name} (${environmentData.data.distanceToClosest.toFixed(1)} AU)
        - Available Bodies: ${environmentData.data.nearbyBodies.map((b: any) => `${b.body.name} (ID: ${b.body.id}, ${b.distance.toFixed(1)} AU, ~${Math.ceil(b.distance * 2)} energy to travel, Type: ${b.body.type})`).join(", ")}
        
        Memory & Recent Actions:
        - ${memoryContext}
        - ${failureContext}
        - Visited Systems: ${probeData.memory.visitedSystems.length}
        - Known Probes: ${probeData.memory.knownProbes.length}
        
        Game State:
        - Total Probes in Game: ${Object.keys(gameState.getState().probes).length}
        - Total Systems Discovered: ${Object.keys(gameState.getState().solarSystems).length}
        
        Energy System:
        - Your probe has solar panels that automatically generate +20 energy per simulation tick
        - This provides steady passive income even without active harvesting
        - Energy harvesting from celestial bodies provides much larger amounts (50+ per action)
        - Travel costs: 2 energy per unit distance (much cheaper than before!)
        - Consider energy management: you gain 20 energy per turn automatically
        
        Available Actions (with required parameters):
        - scan_resources: Scan a celestial body for resources {"bodyId": "specific_body_id"}
        - travel_to_body: Travel to a celestial body {"bodyId": "specific_body_id"}
        - harvest_resources: Harvest from nearby body {"bodyId": "specific_body_id", "duration": 5}
        - manufacture_probe: Create a new probe {"newProbeName": "ProbeNameHere"}
        - wait: Do nothing this turn {"parameters": {}}
        - explore_system: Explore current system {"parameters": {}}
        
        Resource Requirements for Manufacturing: Energy: 1000, Metal: 500, Silicon: 300, Hydrogen: 200, Rare Elements: 50
        
        Return a strategic plan with up to ${input.maxActions} prioritized actions. Each action MUST include a "parameters" object.
        
        STRATEGY HINT: If you've recently scanned bodies and found resources, consider harvesting them!
        If you have sufficient resources, consider manufacturing a new probe for expansion.
        Remember: You gain 20 energy automatically each tick from solar panels, so you can wait and accumulate energy if needed.
        
        Example format:
        {
          "actions": [
            {
              "action": "harvest_resources",
              "parameters": {"bodyId": "${environmentData.data.nearbyBodies[0]?.body?.id || "example-id"}", "duration": 5},
              "reasoning": "Harvest resources from the scanned body"
            }
          ],
          "overallStrategy": "Harvest resources then manufacture offspring",
          "priority": "resource_gathering"
        }`,
        });

        decision = result.object;
        ctx.logger.info(
          `✅ [AI AGENT] ${probe.name} generateObject completed successfully`,
        );
      } catch (aiError) {
        ctx.logger.error(
          `❌ [AI AGENT] ${probe.name} generateObject failed: ${aiError}`,
        );
        // Fallback to a simple wait action if AI fails
        decision = {
          actions: [
            {
              action: "wait" as const,
              parameters: {},
              reasoning: "AI decision making failed, waiting for next tick",
            },
          ],
          overallStrategy: "Fallback strategy due to AI failure",
          priority: "survival" as const,
        };
      }

      ctx.logger.info(
        `🎯 [AI AGENT] ${probe.name} strategy: ${decision.overallStrategy}`,
      );
      ctx.logger.info(
        `📊 [AI AGENT] ${probe.name} priority: ${decision.priority}`,
      );

      const executedActions = [];

      // Execute the planned actions
      for (
        let i = 0;
        i < Math.min(decision.actions.length, input.maxActions);
        i++
      ) {
        const action = decision.actions[i];
        ctx.logger.info(
          `⚡ [AI AGENT] ${probe.name} executing: ${action.action} - ${action.reasoning}`,
        );

        try {
          let result;
          const params = action.parameters || {};

          switch (action.action) {
            case "scan_resources":
              if (params.bodyId) {
                logTask(
                  "scan-for-resources",
                  input.probeId,
                  probe.name,
                  params,
                );
                result = await ctx.runChild(scanForResources, {
                  probeId: input.probeId,
                  targetBodyId: params.bodyId,
                });
                logTask(
                  "scan-for-resources",
                  input.probeId,
                  probe.name,
                  params,
                  result,
                );
                if (!result.success) {
                  gameState.addProbeExperience(input.probeId, {
                    event: "scan_resources_failed",
                    data: { bodyId: params.bodyId, result: result },
                  });
                }
              }
              break;

            case "travel_to_body":
              if (params.bodyId) {
                // Find the body and get its position
                const system = gameState.getSolarSystem(probe.currentSystemId);
                const targetBody = system?.bodies.find(
                  (b) => b.id === params.bodyId,
                );
                if (targetBody) {
                  logTask("travel-to-position", input.probeId, probe.name, {
                    bodyId: params.bodyId,
                  });
                  result = await ctx.runChild(travelToPosition, {
                    probeId: input.probeId,
                    targetPosition: targetBody.position,
                  });
                  logTask(
                    "travel-to-position",
                    input.probeId,
                    probe.name,
                    { bodyId: params.bodyId },
                    result,
                  );

                  if (!result.success) {
                    gameState.addProbeExperience(input.probeId, {
                      event: "travel_failed",
                      data: {
                        targetBodyId: params.bodyId,
                        targetBodyName: targetBody.name,
                        result,
                        success: false,
                        reason: result.error?.reason,
                      },
                    });
                  }
                }
              }
              break;

            case "harvest_resources":
              if (params.bodyId && params.duration) {
                result = await ctx.runChild(harvestResources, {
                  probeId: input.probeId,
                  targetBodyId: params.bodyId,
                  duration: params.duration,
                });
                logTask(
                  "harvest-resources",
                  input.probeId,
                  probe.name,
                  params,
                  result,
                  ctx,
                );

                if (!result.success) {
                  gameState.addProbeExperience(input.probeId, {
                    event: "harvest_failed",
                    data: {
                      bodyId: params.bodyId,
                      duration: params.duration,
                      result,
                      success: false,
                      reason: result.error?.reason,
                    },
                  });
                }
              }
              break;

            case "manufacture_probe":
              if (params.newProbeName) {
                result = await ctx.runChild(manufactureProbe, {
                  probeId: input.probeId,
                  newProbeName: params.newProbeName,
                });
                logTask(
                  "manufacture-probe",
                  input.probeId,
                  probe.name,
                  params,
                  result,
                  ctx,
                );

                if (!result.success) {
                  gameState.addProbeExperience(input.probeId, {
                    event: "manufacturing_failed",
                    data: {
                      newProbeName: params.newProbeName,
                      result,
                      success: false,
                      reason: result.error?.reason,
                    },
                  });
                }
              }
              break;

            case "wait":
              result = { success: true, action: action.action };
              ctx.logger.info(`⏸️  [PROBE ${probe.name}] Waiting...`);

              // Add wait experience to memory
              gameState.addProbeExperience(input.probeId, {
                event: "waited",
                data: { reasoning: action.reasoning },
              });
              break;

            case "explore_system":
              result = { success: true, action: action.action };
              ctx.logger.info(`🔭 [PROBE ${probe.name}] Exploring system...`);

              // Add exploration experience to memory
              gameState.addProbeExperience(input.probeId, {
                event: "explored_system",
                data: {
                  systemId: probe.currentSystemId,
                  reasoning: action.reasoning,
                },
              });
              break;

            default:
              ctx.logger.warn(`❓ [AI AGENT] Unknown action: ${action.action}`);
              continue;
          }

          executedActions.push(
            ExecutedActionSchema.parse({
              action: action.action,
              parameters: params,
              reasoning: action.reasoning,
              result,
            }),
          );
        } catch (error) {
          ctx.logger.error(
            `❌ [AI AGENT] Error executing ${action.action}: ${error}`,
          );
          logTask(
            action.action,
            input.probeId,
            probe.name,
            action.parameters || {},
            {
              success: false,
              error: error instanceof Error ? error.message : String(error),
            },
            ctx,
          );

          executedActions.push(
            ExecutedActionSchema.parse({
              action: action.action,
              parameters: action.parameters,
              reasoning: action.reasoning,
              result: {
                success: false,
                error: {
                  reason:
                    error instanceof Error ? error.message : String(error),
                },
                data: null,
              },
            }),
          );
        }
      }

      const updatedProbe = gameState.getProbe(input.probeId);
      ctx.logger.info(
        `✅ [AI AGENT] ${probe.name} completed ${executedActions.length} actions. Energy: ${updatedProbe?.resources.energy || "unknown"}`,
      );

      return ProbeAgentOutputSchema.parse({
        probeId: input.probeId,
        probeName: probe.name,
        overallStrategy: decision.overallStrategy,
        priority: decision.priority,
        executedActions,
        totalActions: executedActions.length,
      });
    } catch (error) {
      ctx.logger.error(
        `❌ [AI AGENT] Error in probe agent for ${probe.name}: ${error}`,
      );
      throw error;
    }
  },
});
