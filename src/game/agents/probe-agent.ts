import { hatchet } from "@/hatchet.client";
import { z } from "zod";
import { gameState } from "@/game/core/game-state";
import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { Context } from "@hatchet-dev/typescript-sdk/v1/client/worker/context";

// Helper function to extract task result from Hatchet's wrapped response
function getTaskResult(result: any, taskName: string): any {
  // Hatchet wraps results in an object with the task name as key
  return result[taskName] || result;
}

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
  const resultSummary = result
    ? ` → ${getTaskResult(result, taskName)?.success ? "✅" : "❌"}`
    : "";
  console.log(
    `[${timestamp}] 🔧 ${taskName} | ${probeName}(${probeId.slice(0, 8)})${params}${resultSummary}`,
  );
  if (ctx) {
    ctx.logger.info(
      `[${timestamp}] 🔧 ${taskName} | ${probeName}(${probeId.slice(0, 8)})${params}${resultSummary}`,
    );
  }
}

// Task: Run probe agent
export const runProbeAgentInput = z.object({
  probeId: z.string(),
  maxActions: z.number().min(1).max(10).default(3), // Maximum actions to take in this run
});

const ProbeActionSchema = z.object({
  action: z.enum([
    "scan_resources",
    "travel_to_body",
    "harvest_resources",
    "manufacture_probe",
    "explore_system",
    "wait",
  ]),
  parameters: z.record(z.any()).optional(),
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

export const runProbeAgent = hatchet.task({
  name: "run-probe-agent",
  executionTimeout: "300s",
  fn: async (input: z.infer<typeof runProbeAgentInput>, ctx) => {
    const probe = gameState.getProbe(input.probeId);

    if (!probe) {
      ctx.logger.error(`Probe ${input.probeId} not found`);
      throw new Error(`Probe ${input.probeId} not found`);
    }

    console.log(
      `🤖 [AI AGENT] Analyzing situation for probe ${probe.name} (${probe.id.slice(0, 8)}...)...`,
    );

    try {
      // Get current state information
      logTask("get-probe-state", input.probeId, probe.name, {});
      const probeStateResult = await ctx.runChild("get-probe-state", {
        probeId: input.probeId,
      });

      logTask("get-environment-state", input.probeId, probe.name, {});
      const environmentResult = await ctx.runChild("get-environment-state", {
        probeId: input.probeId,
      });

      // Extract probe data from result with correct path
      const probeData = (probeStateResult as any)["get-probe-state"]?.probe;
      const environmentData = (environmentResult as any)[
        "get-environment-state"
      ];

      if (!probeData) {
        console.error(
          `❌ [AI AGENT] No probe data returned from get-probe-state for probe ${input.probeId}`,
        );
        throw new Error(
          `Failed to get probe state data for probe ${input.probeId}`,
        );
      }

      if (!environmentData) {
        console.error(
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

      console.log(`🧠 [AI AGENT] ${probe.name} memory: ${memoryContext}`);

      // Use AI to decide what actions to take
      const { object: decision } = await generateObject({
        model: openai("gpt-4o-mini"),
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
        - Current System: ${environmentData.currentSystem.name}
        - Nearest Body: ${environmentData.closestBody.name} (${environmentData.distanceToClosest.toFixed(1)} AU)
        - Available Bodies: ${environmentData.nearbyBodies.map((b: any) => `${b.body.name} (ID: ${b.body.id}, ${b.distance.toFixed(1)} AU, Type: ${b.body.type})`).join(", ")}
        
        Memory & Recent Actions:
        - ${memoryContext}
        - Visited Systems: ${probeData.memory.visitedSystems.length}
        - Known Probes: ${probeData.memory.knownProbes.length}
        
        Game State:
        - Total Probes in Game: ${Object.keys(gameState.getState().probes).length}
        - Total Systems Discovered: ${Object.keys(gameState.getState().solarSystems).length}
        
        Energy System:
        - Your probe has solar panels that automatically generate +20 energy per simulation tick
        - This provides steady passive income even without active harvesting
        - Energy harvesting from celestial bodies provides much larger amounts (50+ per action)
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
              "parameters": {"bodyId": "${environmentData.nearbyBodies[0]?.body?.id || "example-id"}", "duration": 5},
              "reasoning": "Harvest resources from the scanned body"
            }
          ],
          "overallStrategy": "Harvest resources then manufacture offspring",
          "priority": "resource_gathering"
        }`,
      });

      console.log(
        `🎯 [AI AGENT] ${probe.name} strategy: ${decision.overallStrategy}`,
      );
      console.log(`📊 [AI AGENT] ${probe.name} priority: ${decision.priority}`);

      const executedActions = [];

      // Execute the planned actions
      for (
        let i = 0;
        i < Math.min(decision.actions.length, input.maxActions);
        i++
      ) {
        const action = decision.actions[i];
        console.log(
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
                result = await ctx.runChild("scan-for-resources", {
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

                // Add scan experience to memory
                gameState.updateProbe(input.probeId, {
                  memory: {
                    ...probeData.memory,
                    experiences: [
                      ...probeData.memory.experiences,
                      {
                        timestamp: Date.now(),
                        event: "scanned_body",
                        data: {
                          bodyId: params.bodyId,
                          result: (result as any)?.["scan-for-resources"],
                        },
                      },
                    ],
                  },
                });
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
                  result = await ctx.runChild("travel-to-position", {
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

                  // Add travel experience to memory
                  gameState.updateProbe(input.probeId, {
                    memory: {
                      ...probeData.memory,
                      experiences: [
                        ...probeData.memory.experiences,
                        {
                          timestamp: Date.now(),
                          event: "traveled_to_body",
                          data: {
                            targetBodyId: params.bodyId,
                            targetBodyName: targetBody.name,
                            result: result,
                          },
                        },
                      ],
                    },
                  });
                }
              }
              break;

            case "harvest_resources":
              if (params.bodyId && params.duration) {
                logTask("harvest-resources", input.probeId, probe.name, params);
                result = await ctx.runChild("harvest-resources", {
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
                );

                // Add harvest experience to memory
                gameState.updateProbe(input.probeId, {
                  memory: {
                    ...probeData.memory,
                    experiences: [
                      ...probeData.memory.experiences,
                      {
                        timestamp: Date.now(),
                        event: "harvested_resources",
                        data: {
                          bodyId: params.bodyId,
                          duration: params.duration,
                          result: result,
                        },
                      },
                    ],
                  },
                });
              }
              break;

            case "manufacture_probe":
              if (params.newProbeName) {
                logTask("manufacture-probe", input.probeId, probe.name, params);
                result = await ctx.runChild("manufacture-probe", {
                  probeId: input.probeId,
                  newProbeName: params.newProbeName,
                });
                logTask(
                  "manufacture-probe",
                  input.probeId,
                  probe.name,
                  params,
                  result,
                );

                // Add manufacturing experience to memory
                gameState.updateProbe(input.probeId, {
                  memory: {
                    ...probeData.memory,
                    experiences: [
                      ...probeData.memory.experiences,
                      {
                        timestamp: Date.now(),
                        event: "manufactured_probe",
                        data: {
                          newProbeName: params.newProbeName,
                          result: result,
                        },
                      },
                    ],
                  },
                });
              }
              break;

            case "wait":
              result = { success: true, action: action.action };
              console.log(`⏸️  [PROBE ${probe.name}] Waiting...`);

              // Add wait experience to memory
              gameState.updateProbe(input.probeId, {
                memory: {
                  ...probeData.memory,
                  experiences: [
                    ...probeData.memory.experiences,
                    {
                      timestamp: Date.now(),
                      event: "waited",
                      data: { reasoning: action.reasoning },
                    },
                  ],
                },
              });
              break;

            case "explore_system":
              result = { success: true, action: action.action };
              console.log(`🔭 [PROBE ${probe.name}] Exploring system...`);

              // Add exploration experience to memory
              gameState.updateProbe(input.probeId, {
                memory: {
                  ...probeData.memory,
                  experiences: [
                    ...probeData.memory.experiences,
                    {
                      timestamp: Date.now(),
                      event: "explored_system",
                      data: {
                        systemId: probe.currentSystemId,
                        reasoning: action.reasoning,
                      },
                    },
                  ],
                },
              });
              break;

            default:
              console.log(`❓ [AI AGENT] Unknown action: ${action.action}`);
              continue;
          }

          executedActions.push({
            action: action.action,
            parameters: params,
            reasoning: action.reasoning,
            result,
          });
        } catch (error) {
          console.error(
            `❌ [AI AGENT] Error executing ${action.action}:`,
            error,
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
          );

          executedActions.push({
            action: action.action,
            parameters: action.parameters,
            reasoning: action.reasoning,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      const updatedProbe = gameState.getProbe(input.probeId);
      console.log(
        `✅ [AI AGENT] ${probe.name} completed ${executedActions.length} actions. Energy: ${updatedProbe?.resources.energy || "unknown"}`,
      );

      return {
        probeId: input.probeId,
        probeName: probe.name,
        overallStrategy: decision.overallStrategy,
        priority: decision.priority,
        executedActions,
        totalActions: executedActions.length,
      };
    } catch (error) {
      console.error(
        `❌ [AI AGENT] Error in probe agent for ${probe.name}:`,
        error,
      );
      throw error;
    }
  },
});
