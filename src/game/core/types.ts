import { z } from "zod";

// Core game state types
export const ResourceType = z.enum([
  "energy",
  "metal",
  "silicon",
  "hydrogen",
  "rare_elements",
]);

export const ProbeStatus = z.enum([
  "active",
  "traveling",
  "harvesting",
  "manufacturing",
  "replicating",
  "damaged",
  "destroyed",
]);

export const CelestialBodyType = z.enum([
  "star",
  "planet",
  "asteroid",
  "gas_giant",
  "moon",
  "asteroid_belt",
]);

// Base task output schema
export const BaseTaskOutputSchema = <TData extends z.ZodTypeAny>(
  dataSchema: TData
) =>
  z.object({
    success: z.boolean(),
    data: dataSchema.nullable(),
    error: z
      .object({
        reason: z.string(),
      })
      .nullable()
      .default(null),
  });

// Schemas for game entities
export const ResourcesSchema = z.object({
  energy: z.number().min(0),
  metal: z.number().min(0),
  silicon: z.number().min(0),
  hydrogen: z.number().min(0),
  rare_elements: z.number().min(0),
});

export const PositionSchema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
});

export const ProbeMemorySchema = z.object({
  visitedSystems: z.array(z.string()),
  discoveredResources: z.record(z.string(), ResourcesSchema),
  knownProbes: z.array(z.string()),
  experiences: z.array(
    z.object({
      timestamp: z.number(),
      event: z.string(),
      data: z.record(z.any()),
    })
  ),
});

export const ProbeCapabilitiesSchema = z.object({
  maxSpeed: z.number(),
  harvestRate: z.number(),
  sensorRange: z.number(),
  communicationRange: z.number(),
  storageCapacity: z.number(),
});

export const ProbeSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: ProbeStatus,
  position: PositionSchema,
  currentSystemId: z.string(),
  resources: ResourcesSchema,
  memory: ProbeMemorySchema,
  capabilities: ProbeCapabilitiesSchema,
  parentProbeId: z.string().optional(),
  generation: z.number(),
  createdAt: z.number(),
});

export const CelestialBodySchema = z.object({
  id: z.string(),
  name: z.string(),
  type: CelestialBodyType,
  position: PositionSchema,
  resources: ResourcesSchema,
  mass: z.number(),
  radius: z.number(),
});

export const SolarSystemSchema = z.object({
  id: z.string(),
  name: z.string(),
  position: PositionSchema,
  star: CelestialBodySchema,
  bodies: z.array(CelestialBodySchema),
  discoveredBy: z.string().optional(),
  discoveredAt: z.number().optional(),
});

export const GameStateSchema = z.object({
  currentTime: z.number(),
  probes: z.record(z.string(), ProbeSchema),
  solarSystems: z.record(z.string(), SolarSystemSchema),
  gameStartedAt: z.number(),
});

// Type exports
export type Resources = z.infer<typeof ResourcesSchema>;
export type Position = z.infer<typeof PositionSchema>;
export type ProbeMemory = z.infer<typeof ProbeMemorySchema>;
export type ProbeCapabilities = z.infer<typeof ProbeCapabilitiesSchema>;
export type Probe = z.infer<typeof ProbeSchema>;
export type CelestialBody = z.infer<typeof CelestialBodySchema>;
export type SolarSystem = z.infer<typeof SolarSystemSchema>;
export type GameState = z.infer<typeof GameStateSchema>;

// Constants
export const PROBE_REPLICATION_COST: Resources = {
  energy: 1000,
  metal: 500,
  silicon: 300,
  hydrogen: 200,
  rare_elements: 50,
};

export const BASE_PROBE_CAPABILITIES: ProbeCapabilities = {
  maxSpeed: 0.1, // 10% speed of light
  harvestRate: 10, // units per time tick
  sensorRange: 50, // AU
  communicationRange: 100, // AU
  storageCapacity: 5000,
};
