import { eq } from "drizzle-orm"
import { db } from "../db/index.js"
import { ships } from "../db/schema.js"
import type { Position } from "../types/index.js"
import { emit } from "./events.js"

/** Euclidean distance between two points */
export function distance(a: Position, b: Position): number {
	return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)
}

/** Compute a ship's current position from its sailing state (lazy physics) */
export function computePosition(ship: {
	x: number
	y: number
	destinationX: number | null
	destinationY: number | null
	departedAt: number | null
	speed: number
}): Position & { arrived: boolean } {
	if (
		ship.destinationX === null ||
		ship.destinationY === null ||
		ship.departedAt === null
	) {
		return { x: ship.x, y: ship.y, arrived: false }
	}

	const elapsed = (Date.now() - ship.departedAt) / 1000 // seconds
	const totalDist = distance(
		{ x: ship.x, y: ship.y },
		{ x: ship.destinationX, y: ship.destinationY },
	)

	if (totalDist === 0) {
		return { x: ship.x, y: ship.y, arrived: true }
	}

	const travelTime = totalDist / ship.speed
	const progress = Math.min(elapsed / travelTime, 1.0)
	const arrived = progress >= 1.0

	const currentX = ship.x + (ship.destinationX - ship.x) * progress
	const currentY = ship.y + (ship.destinationY - ship.y) * progress

	return { x: currentX, y: currentY, arrived }
}

/**
 * If a sailing ship has arrived, finalize its position in DB and emit event.
 * Returns the updated position. This is called lazily on any ship query.
 */
export function resolveArrival(ship: {
	id: string
	x: number
	y: number
	destinationX: number | null
	destinationY: number | null
	departedAt: number | null
	speed: number
	status: string
}): Position & { arrived: boolean } {
	const pos = computePosition(ship)

	if (pos.arrived && ship.status === "sailing") {
		// Finalize arrival in DB
		db.update(ships)
			.set({
				x: pos.x,
				y: pos.y,
				destinationX: null,
				destinationY: null,
				departedAt: null,
				status: "idle",
			})
			.where(eq(ships.id, ship.id))
			.run()

		emit("ship_arrived", { shipId: ship.id, x: pos.x, y: pos.y })
	}

	return pos
}
