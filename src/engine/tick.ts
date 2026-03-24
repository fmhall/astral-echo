import { eq } from "drizzle-orm"
import { db } from "../db/index.js"
import { portDemands, portListings, ships } from "../db/schema.js"
import { emit } from "./events.js"
import { resolveArrival } from "./navigation.js"
import { getWorldConfig } from "./world.js"

/**
 * World tick: restocks ports, resolves ship arrivals, emits events.
 * Called periodically by the server.
 */
export function worldTick(): void {
	const config = getWorldConfig()

	// 1. Resolve all sailing ships that may have arrived
	const sailingShips = db
		.select()
		.from(ships)
		.where(eq(ships.status, "sailing"))
		.all()

	for (const ship of sailingShips) {
		resolveArrival(ship)
	}

	// 2. Restock port listings (supply regeneration)
	const listings = db.select().from(portListings).all()
	for (const listing of listings) {
		if (listing.restockRate > 0 && listing.quantity < listing.maxQuantity) {
			const newQty = Math.min(
				listing.quantity + listing.restockRate,
				listing.maxQuantity,
			)
			db.update(portListings)
				.set({ quantity: newQty })
				.where(
					eq(portListings.portId, listing.portId),
				)
				.run()
		}
	}

	// 3. Regenerate port demand (consumption resets)
	const demands = db.select().from(portDemands).all()
	for (const demand of demands) {
		if (demand.consumeRate > 0 && demand.quantityWanted < demand.maxQuantity) {
			const newQty = Math.min(
				demand.quantityWanted + demand.consumeRate,
				demand.maxQuantity,
			)
			db.update(portDemands)
				.set({ quantityWanted: newQty })
				.where(
					eq(portDemands.portId, demand.portId),
				)
				.run()
		}
	}

	emit("world_tick", {
		tickIntervalMs: config.tickIntervalMs,
		sailingShipsResolved: sailingShips.length,
	})
}

let tickInterval: ReturnType<typeof setInterval> | null = null

export function startWorldTicker(): void {
	const config = getWorldConfig()
	if (tickInterval) clearInterval(tickInterval)
	tickInterval = setInterval(worldTick, config.tickIntervalMs)
	console.log(`World ticker started (interval: ${config.tickIntervalMs}ms)`)
}

export function stopWorldTicker(): void {
	if (tickInterval) {
		clearInterval(tickInterval)
		tickInterval = null
	}
}
