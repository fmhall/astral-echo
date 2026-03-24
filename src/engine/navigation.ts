import type { Position } from "../schemas/common.js";
import { TRAVEL_ENERGY_PER_AU } from "../schemas/common.js";

/** Euclidean distance between two positions (in AU). */
export function distance(a: Position, b: Position): number {
	return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
}

/** Number of ticks required to travel a distance at a given speed. Min 1. */
export function travelTicks(dist: number, speed: number): number {
	return Math.max(1, Math.ceil(dist / speed));
}

/** Energy cost for traveling a distance. */
export function travelEnergyCost(dist: number): number {
	return dist * TRAVEL_ENERGY_PER_AU;
}
