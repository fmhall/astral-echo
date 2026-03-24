import { z } from "zod";
import { CelestialBodyType, Position, Resources } from "./common.js";

export const CelestialBody = z.object({
	id: z.string(),
	systemId: z.string(),
	name: z.string(),
	type: CelestialBodyType,
	position: Position,
	resources: Resources,
});
export type CelestialBody = z.infer<typeof CelestialBody>;

export const StarSystem = z.object({
	id: z.string(),
	name: z.string(),
	position: Position,
});
export type StarSystem = z.infer<typeof StarSystem>;

export const StarSystemDetail = StarSystem.extend({
	bodies: z.array(CelestialBody),
	ports: z.array(
		z.object({
			id: z.string(),
			name: z.string(),
			bodyId: z.string(),
		}),
	),
});
