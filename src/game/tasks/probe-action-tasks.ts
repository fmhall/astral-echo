import { hatchet } from "@/hatchet.client";
import { z } from "zod";
import { gameState } from "@/game/core/game-state";
import {
  PositionSchema,
  PROBE_REPLICATION_COST,
  BASE_PROBE_CAPABILITIES,
  BaseTaskOutputSchema,
} from "@/game/core/types";
import { v4 as uuidv4 } from "uuid";

// Task: Travel to position
export const travelToPositionInput = z.object({
  probeId: z.string(),
  targetPosition: PositionSchema,
});

export const travelToPositionOutput = BaseTaskOutputSchema(
  z.object({
    distance: z.number(),
    energyUsed: z.number(),
    travelTime: z.number(),
    newPosition: PositionSchema,
  }),
);

export const travelToPosition = hatchet.task({
  name: "travel-to-position",
  executionTimeout: "30s",
  fn: async (input: z.infer<typeof travelToPositionInput>) => {
    const probe = gameState.getProbe(input.probeId);

    if (!probe) {
      throw new Error(`Probe ${input.probeId} not found`);
    }

    const distance = gameState.calculateDistance(
      probe.position,
      input.targetPosition,
    );
    const travelTime = Math.ceil(distance / probe.capabilities.maxSpeed);
    const energyCost = Math.ceil(distance * 2); // Reduced from 10 to 2 energy per unit distance

    if (probe.resources.energy < energyCost) {
      console.log(`[PROBE ${probe.name}] Insufficient energy for travel`);
      return travelToPositionOutput.parse({
        success: false,
        data: null,
        error: {
          reason: `insufficient_energy, required ${energyCost} energy, available ${probe.resources.energy}`,
        },
      });
    }

    // Update probe status and position
    gameState.updateProbe(input.probeId, {
      status: "traveling",
      position: input.targetPosition,
      resources: gameState.subtractResources(probe.resources, {
        energy: energyCost,
        metal: 0,
        silicon: 0,
        hydrogen: 0,
        rare_elements: 0,
      }),
    });

    // Add experience
    gameState.addProbeExperience(input.probeId, {
      event: "travel_completed",
      data: {
        fromPosition: probe.position,
        toPosition: input.targetPosition,
        distance,
        energyUsed: energyCost,
        travelTime,
      },
    });

    gameState.updateProbe(input.probeId, {
      status: "active",
    });

    console.log(
      `[PROBE ${probe.name}] Traveled ${distance.toFixed(1)} AU to (${input.targetPosition.x}, ${input.targetPosition.y}, ${input.targetPosition.z})`,
    );

    return travelToPositionOutput.parse({
      success: true,
      data: {
        distance,
        energyUsed: energyCost,
        travelTime,
        newPosition: input.targetPosition,
      },
      error: null,
    });
  },
});

// Task: Harvest resources
export const harvestResourcesInput = z.object({
  probeId: z.string(),
  targetBodyId: z.string(),
  duration: z.number().min(1).max(100), // harvesting cycles
});

export const harvestResourcesOutput = BaseTaskOutputSchema(
  z.object({
    harvestedResources: z.record(z.any()),
    duration: z.number(),
    remainingOnBody: z.record(z.any()),
  }),
);

export const harvestResources = hatchet.task({
  name: "harvest-resources",
  executionTimeout: "60s",
  fn: async (input: z.infer<typeof harvestResourcesInput>) => {
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

    if (distance > 1.0) {
      // Must be very close to harvest
      console.log(
        `[PROBE ${probe.name}] Too far from ${targetBody.name} to harvest`,
      );
      return harvestResourcesOutput.parse({
        success: false,
        data: null,
        error: {
          reason: `too_far, max distance is 1.0, distance is ${distance}`,
        },
      });
    }

    // Calculate harvested amount
    const harvestAmount = probe.capabilities.harvestRate * input.duration;
    const actualHarvest = {
      energy: Math.min(harvestAmount, targetBody.resources.energy),
      metal: Math.min(harvestAmount, targetBody.resources.metal),
      silicon: Math.min(harvestAmount, targetBody.resources.silicon),
      hydrogen: Math.min(harvestAmount, targetBody.resources.hydrogen),
      rare_elements: Math.min(
        harvestAmount,
        targetBody.resources.rare_elements,
      ),
    };

    // Check storage capacity
    const totalHarvested = gameState.getTotalResourceAmount(actualHarvest);
    const currentTotal = gameState.getTotalResourceAmount(probe.resources);

    if (currentTotal + totalHarvested > probe.capabilities.storageCapacity) {
      console.log(`[PROBE ${probe.name}] Storage capacity exceeded`);
      return harvestResourcesOutput.parse({
        success: false,
        data: null,
        error: {
          reason: `storage_full, current storage is ${currentTotal}, max storage is ${probe.capabilities.storageCapacity}`,
        },
      });
    }

    // Update probe resources and body resources
    gameState.updateProbe(input.probeId, {
      status: "harvesting",
      resources: gameState.addResources(probe.resources, actualHarvest),
    });

    // Update the celestial body's resources (reduce them)
    const updatedBody = {
      ...targetBody,
      resources: gameState.subtractResources(
        targetBody.resources,
        actualHarvest,
      ),
    };

    // Update system with the modified body
    const updatedBodies = currentSystem.bodies.map((b) =>
      b.id === targetBody.id ? updatedBody : b,
    );

    gameState.addSolarSystem({
      ...currentSystem,
      bodies: updatedBodies,
    });

    // Add experience
    gameState.addProbeExperience(input.probeId, {
      event: "resources_harvested",
      data: {
        bodyId: targetBody.id,
        bodyName: targetBody.name,
        harvestedResources: actualHarvest,
        duration: input.duration,
      },
    });

    gameState.updateProbe(input.probeId, {
      status: "active",
    });

    console.log(
      `[PROBE ${probe.name}] Harvested from ${targetBody.name}: ${JSON.stringify(actualHarvest)}`,
    );

    return harvestResourcesOutput.parse({
      success: true,
      data: {
        harvestedResources: actualHarvest,
        duration: input.duration,
        remainingOnBody: updatedBody.resources,
      },
      error: null,
    });
  },
});

// Task: Manufacture new probe
export const manufactureProbeInput = z.object({
  probeId: z.string(),
  newProbeName: z.string(),
});

export const manufactureProbeOutput = BaseTaskOutputSchema(
  z.object({
    newProbeId: z.string(),
    newProbeName: z.string(),
    generation: z.number(),
    resourcesUsed: z.record(z.any()),
  }),
);

export const manufactureProbe = hatchet.task({
  name: "manufacture-probe",
  executionTimeout: "120s",
  fn: async (input: z.infer<typeof manufactureProbeInput>) => {
    const parentProbe = gameState.getProbe(input.probeId);

    if (!parentProbe) {
      throw new Error(`Probe ${input.probeId} not found`);
    }

    // Check if probe has enough resources
    if (
      !gameState.canAffordResources(
        parentProbe.resources,
        PROBE_REPLICATION_COST,
      )
    ) {
      console.log(
        `[PROBE ${parentProbe.name}] Insufficient resources for replication`,
      );
      return manufactureProbeOutput.parse({
        success: false,
        data: null,
        error: {
          reason: `insufficient_resources, required ${JSON.stringify(PROBE_REPLICATION_COST)}, available ${JSON.stringify(parentProbe.resources)}`,
        },
      });
    }

    // Create new probe
    const newProbeId = uuidv4();
    const newProbe = {
      id: newProbeId,
      name: input.newProbeName,
      status: "active" as const,
      position: { ...parentProbe.position },
      currentSystemId: parentProbe.currentSystemId,
      resources: {
        energy: 500, // Start with basic energy
        metal: 50,
        silicon: 50,
        hydrogen: 50,
        rare_elements: 5,
      },
      memory: {
        visitedSystems: [...parentProbe.memory.visitedSystems],
        discoveredResources: { ...parentProbe.memory.discoveredResources },
        knownProbes: [...parentProbe.memory.knownProbes, parentProbe.id],
        experiences: [
          {
            timestamp: Date.now(),
            event: "probe_manufactured",
            data: {
              parentId: parentProbe.id,
              parentName: parentProbe.name,
              location: parentProbe.currentSystemId,
            },
          },
        ],
      },
      capabilities: { ...BASE_PROBE_CAPABILITIES },
      parentProbeId: parentProbe.id,
      generation: parentProbe.generation + 1,
      createdAt: Date.now(),
    };

    // Update parent probe resources
    gameState.updateProbe(input.probeId, {
      status: "manufacturing",
      resources: gameState.subtractResources(
        parentProbe.resources,
        PROBE_REPLICATION_COST,
      ),
    });

    // Add new probe to game state
    gameState.addProbe(newProbe);

    // Update parent probe memory and status
    const updatedParentProbe = gameState.getProbe(input.probeId)!;
    updatedParentProbe.memory.knownProbes.push(newProbeId);

    gameState.addProbeExperience(input.probeId, {
      event: "probe_manufactured",
      data: {
        childId: newProbeId,
        childName: input.newProbeName,
        resourcesUsed: PROBE_REPLICATION_COST,
      },
    });

    gameState.updateProbe(input.probeId, {
      memory: updatedParentProbe.memory, // Still need to update knownProbes
      status: "active",
    });

    console.log(
      `[PROBE ${parentProbe.name}] Manufactured new probe: ${input.newProbeName} (Generation ${newProbe.generation})`,
    );

    return manufactureProbeOutput.parse({
      success: true,
      data: {
        newProbeId,
        newProbeName: input.newProbeName,
        generation: newProbe.generation,
        resourcesUsed: PROBE_REPLICATION_COST,
      },
      error: null,
    });
  },
});
