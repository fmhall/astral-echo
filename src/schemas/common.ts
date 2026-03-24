import { z } from "zod";

export const ResourceType = z.enum(["energy", "metal", "silicon", "hydrogen", "rare_elements"]);
export type ResourceType = z.infer<typeof ResourceType>;

export const Resources = z.object({
	energy: z.number().min(0).default(0),
	metal: z.number().min(0).default(0),
	silicon: z.number().min(0).default(0),
	hydrogen: z.number().min(0).default(0),
	rare_elements: z.number().min(0).default(0),
});
export type Resources = z.infer<typeof Resources>;

export const Position = z.object({
	x: z.number(),
	y: z.number(),
	z: z.number(),
});
export type Position = z.infer<typeof Position>;

export const CelestialBodyType = z.enum([
	"star",
	"planet",
	"asteroid",
	"gas_giant",
	"moon",
	"asteroid_belt",
]);
export type CelestialBodyType = z.infer<typeof CelestialBodyType>;

export const ShipStatus = z.enum([
	"docked",
	"traveling",
	"harvesting",
	"idle",
	"manufacturing",
	"destroyed",
]);
export type ShipStatus = z.infer<typeof ShipStatus>;

export const ErrorResponse = z.object({
	error: z.string(),
});

export const SuccessResponse = z.object({
	ok: z.literal(true),
});

export const RESOURCE_KEYS = ["energy", "metal", "silicon", "hydrogen", "rare_elements"] as const;

/** Cost to manufacture a new probe */
export const MANUFACTURE_COST: Resources = {
	energy: 500,
	metal: 300,
	silicon: 200,
	hydrogen: 100,
	rare_elements: 25,
};

/** Energy cost per AU of travel */
export const TRAVEL_ENERGY_PER_AU = 2;

/** Base harvest amount per tick */
export const BASE_HARVEST_PER_TICK = 10;
