import { hatchet } from "@/hatchet.client";
import { z } from "zod";
import { gameState } from "@/game/core/game-state";
import {
  ProbeSchema,
  SolarSystemSchema,
  CelestialBodySchema,
  BaseTaskOutputSchema,
} from "@/game/core/types";

// Task: Get probe state
export const getProbeStateInput = z.object({
  probeId: z.string(),
});

export const getProbeStateOutput = BaseTaskOutputSchema(
  z.object({
    probe: ProbeSchema,
  }),
);

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

    return getProbeStateOutput.parse({
      success: true,
      data: {
        probe: ProbeSchema.parse(probe),
      },
      error: null,
    });
  },
});

// Task: Get environment state
export const getEnvironmentStateInput = z.object({
  probeId: z.string(),
});

export const getEnvironmentStateOutput = BaseTaskOutputSchema(
  z.object({
    currentSystem: SolarSystemSchema,
    nearbyBodies: z.array(
      z.object({
        body: CelestialBodySchema,
        distance: z.number(),
      }),
    ),
    closestBody: CelestialBodySchema,
    distanceToClosest: z.number(),
  }),
);

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

    return getEnvironmentStateOutput.parse({
      success: true,
      data: {
        currentSystem: SolarSystemSchema.parse(currentSystem),
        nearbyBodies,
        closestBody: closestBody.body,
        distanceToClosest: closestBody.distance,
      },
      error: null,
    });
  },
});

// Task: Get solar system state
export const getSolarSystemStateInput = z.object({
  systemId: z.string(),
});

export const getSolarSystemStateOutput = BaseTaskOutputSchema(
  z.object({
    system: SolarSystemSchema,
    totalResources: z.record(z.any()),
    bodyCount: z.number(),
  }),
);

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

    return getSolarSystemStateOutput.parse({
      success: true,
      data: {
        system: SolarSystemSchema.parse(system),
        totalResources,
        bodyCount: system.bodies.length,
      },
      error: null,
    });
  },
});

// Task: Scan for resources
export const scanForResourcesInput = z.object({
  probeId: z.string(),
  targetBodyId: z.string(),
});

export const scanForResourcesOutput = BaseTaskOutputSchema(
  z.object({
    bodyName: z.string(),
    resources: z.record(z.any()),
    distance: z.number(),
  }),
);

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
      return scanForResourcesOutput.parse({
        success: false,
        data: null,
        error: {
          reason: `out_of_range, max range is ${probe.capabilities.sensorRange}, distance is ${distance}`,
        },
      });
    }

    // Update probe memory with discovered resources
    probe.memory.discoveredResources[targetBody.id] = targetBody.resources;

    gameState.addProbeExperience(input.probeId, {
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

    return scanForResourcesOutput.parse({
      success: true,
      data: {
        bodyName: targetBody.name,
        resources: targetBody.resources,
        distance,
      },
      error: null,
    });
  },
});
