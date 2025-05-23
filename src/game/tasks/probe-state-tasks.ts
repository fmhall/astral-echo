import { hatchet } from "@/hatchet.client";
import { z } from "zod";
import { gameState } from "@/game/core/game-state";
import {
  ProbeSchema,
  SolarSystemSchema,
  CelestialBodySchema,
} from "@/game/core/types";

// Task: Get probe state
export const getProbeStateInput = z.object({
  probeId: z.string(),
});

export const getProbeState = hatchet.task({
  name: "get-probe-state",
  executionTimeout: "10s",
  fn: async (input: z.infer<typeof getProbeStateInput>) => {
    const probe = gameState.getProbe(input.probeId);

    if (!probe) {
      throw new Error(`Probe ${input.probeId} not found`);
    }

    console.log(
      `[PROBE ${probe.name}] Status: ${probe.status}, Energy: ${probe.resources.energy}`,
    );

    return {
      probe: ProbeSchema.parse(probe),
    };
  },
});

// Task: Get environment state
export const getEnvironmentStateInput = z.object({
  probeId: z.string(),
});

export const getEnvironmentState = hatchet.task({
  name: "get-environment-state",
  executionTimeout: "10s",
  fn: async (input: z.infer<typeof getEnvironmentStateInput>) => {
    const probe = gameState.getProbe(input.probeId);

    if (!probe) {
      throw new Error(`Probe ${input.probeId} not found`);
    }

    const currentSystem = gameState.getSolarSystem(probe.currentSystemId);

    if (!currentSystem) {
      throw new Error(`Solar system ${probe.currentSystemId} not found`);
    }

    // Calculate distances to all celestial bodies
    const nearbyBodies = currentSystem.bodies
      .map((body) => ({
        body: CelestialBodySchema.parse(body),
        distance: gameState.calculateDistance(probe.position, body.position),
      }))
      .sort((a, b) => a.distance - b.distance);

    const closestBody = nearbyBodies[0];

    console.log(
      `[PROBE ${probe.name}] Nearest body: ${closestBody.body.name} at ${closestBody.distance.toFixed(1)} AU`,
    );

    return {
      currentSystem: SolarSystemSchema.parse(currentSystem),
      nearbyBodies,
      closestBody: closestBody.body,
      distanceToClosest: closestBody.distance,
    };
  },
});

// Task: Get solar system state
export const getSolarSystemStateInput = z.object({
  systemId: z.string(),
});

export const getSolarSystemState = hatchet.task({
  name: "get-solar-system-state",
  executionTimeout: "10s",
  fn: async (input: z.infer<typeof getSolarSystemStateInput>) => {
    const system = gameState.getSolarSystem(input.systemId);

    if (!system) {
      throw new Error(`Solar system ${input.systemId} not found`);
    }

    // Calculate total available resources in the system
    const totalResources = system.bodies.reduce(
      (acc, body) => {
        return gameState.addResources(acc, body.resources);
      },
      {
        energy: system.star.resources.energy,
        metal: 0,
        silicon: 0,
        hydrogen: system.star.resources.hydrogen,
        rare_elements: 0,
      },
    );

    return {
      system: SolarSystemSchema.parse(system),
      totalResources,
      bodyCount: system.bodies.length,
    };
  },
});

// Task: Scan for resources
export const scanForResourcesInput = z.object({
  probeId: z.string(),
  targetBodyId: z.string(),
});

export const scanForResources = hatchet.task({
  name: "scan-for-resources",
  executionTimeout: "10s",
  fn: async (input: z.infer<typeof scanForResourcesInput>) => {
    const probe = gameState.getProbe(input.probeId);

    if (!probe) {
      throw new Error(`Probe ${input.probeId} not found`);
    }

    const currentSystem = gameState.getSolarSystem(probe.currentSystemId);

    if (!currentSystem) {
      throw new Error(`Solar system ${probe.currentSystemId} not found`);
    }

    const targetBody = currentSystem.bodies.find(
      (b) => b.id === input.targetBodyId,
    );

    if (!targetBody) {
      throw new Error(`Celestial body ${input.targetBodyId} not found`);
    }

    const distance = gameState.calculateDistance(
      probe.position,
      targetBody.position,
    );

    if (distance > probe.capabilities.sensorRange) {
      console.log(
        `[PROBE ${probe.name}] Target ${targetBody.name} is out of sensor range`,
      );
      return {
        success: false,
        reason: "out_of_range",
        distance,
        maxRange: probe.capabilities.sensorRange,
      };
    }

    // Update probe memory with discovered resources
    probe.memory.discoveredResources[targetBody.id] = targetBody.resources;
    probe.memory.experiences.push({
      timestamp: Date.now(),
      event: "resources_scanned",
      data: {
        bodyId: targetBody.id,
        bodyName: targetBody.name,
        resources: targetBody.resources,
      },
    });

    gameState.updateProbe(input.probeId, { memory: probe.memory });

    console.log(
      `[PROBE ${probe.name}] Scanned ${targetBody.name}: ${JSON.stringify(targetBody.resources)}`,
    );

    return {
      success: true,
      bodyName: targetBody.name,
      resources: targetBody.resources,
      distance,
    };
  },
});
