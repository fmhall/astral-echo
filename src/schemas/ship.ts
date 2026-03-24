import { z } from "zod";
import { Position, Resources, ShipStatus } from "./common.js";

export const Ship = z.object({
	id: z.string(),
	agentId: z.string(),
	name: z.string(),
	status: ShipStatus,
	systemId: z.string(),
	dockedPortId: z.string().nullable(),
	position: Position,
	cargo: Resources,
	cargoCapacity: z.number(),
	speed: z.number(),
	sensorRange: z.number(),
	harvestRate: z.number(),
	generation: z.number(),
	createdAt: z.number(),
});
export type Ship = z.infer<typeof Ship>;

export const TravelRequest = z.object({
	destinationSystemId: z.string().optional(),
	destinationBodyId: z.string().optional(),
	x: z.number().optional(),
	y: z.number().optional(),
	z: z.number().optional(),
});

export const HarvestRequest = z.object({
	bodyId: z.string(),
	resource: z.enum(["energy", "metal", "silicon", "hydrogen", "rare_elements"]),
});

export const ManufactureRequest = z.object({
	name: z.string().min(1).max(64),
});

export const ShipAction = z.object({
	shipId: z.string(),
	action: z.string(),
	startTick: z.number(),
	endTick: z.number(),
});
