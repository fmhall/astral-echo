import { eq } from "drizzle-orm";
import type { DB } from "../db/index.js";
import { actionQueue, celestialBodies, ships, worldState } from "../db/schema.js";
import type { ResourceType } from "../schemas/common.js";
import { tickPrices } from "./economy.js";

/** Advance the world by one tick. Returns the new tick number. */
export function processTick(db: DB): number {
	const world = db.select().from(worldState).get();
	if (!world) throw new Error("No world state found. Run seed first.");

	const newTick = world.tick + 1;

	// 1. Process completed actions
	processCompletedActions(db, newTick);

	// 2. Solar charging: all non-destroyed ships gain energy
	solarCharge(db);

	// 3. Drift market prices
	tickPrices(db);

	// 4. Update world tick
	db.update(worldState)
		.set({ tick: newTick, lastTickAt: Date.now() })
		.where(eq(worldState.id, world.id))
		.run();

	return newTick;
}

/** Complete actions whose endTick <= currentTick. */
function processCompletedActions(db: DB, tick: number) {
	const completed = db.select().from(actionQueue).where(eq(actionQueue.endTick, tick)).all();

	for (const action of completed) {
		switch (action.action) {
			case "travel":
				completeTravelAction(db, action);
				break;
			case "harvest":
				completeHarvestAction(db, action);
				break;
			case "manufacture":
				completeManufactureAction(db, action);
				break;
		}
	}

	// Also clean up any actions at or before current tick
	const allDone = db
		.select()
		.from(actionQueue)
		.all()
		.filter((a) => a.endTick <= tick);
	for (const a of allDone) {
		db.delete(actionQueue).where(eq(actionQueue.id, a.id)).run();
	}
}

function completeTravelAction(db: DB, action: typeof actionQueue.$inferSelect) {
	const updates: Record<string, unknown> = {
		status: "idle",
	};
	if (action.destX != null) updates.x = action.destX;
	if (action.destY != null) updates.y = action.destY;
	if (action.destZ != null) updates.z = action.destZ;
	if (action.destSystemId) updates.systemId = action.destSystemId;

	db.update(ships).set(updates).where(eq(ships.id, action.shipId)).run();
}

function completeHarvestAction(db: DB, action: typeof actionQueue.$inferSelect) {
	if (!action.targetBodyId || !action.harvestResource) return;

	const ship = db.select().from(ships).where(eq(ships.id, action.shipId)).get();
	const body = db
		.select()
		.from(celestialBodies)
		.where(eq(celestialBodies.id, action.targetBodyId))
		.get();
	if (!ship || !body) return;

	const resource = action.harvestResource as ResourceType;
	const ticks = action.endTick - action.startTick;
	const amount = Math.min(ship.harvestRate * ticks, bodyResource(body, resource));

	if (amount <= 0) {
		db.update(ships).set({ status: "idle" }).where(eq(ships.id, ship.id)).run();
		return;
	}

	// Transfer resources from body to ship
	const bodyUpdate: Record<string, number> = {};
	const shipUpdate: Record<string, unknown> = { status: "idle" };

	bodyUpdate[resourceColumn(resource)] = bodyResource(body, resource) - amount;
	shipUpdate[resourceColumn(resource)] = shipResource(ship, resource) + amount;

	db.update(celestialBodies).set(bodyUpdate).where(eq(celestialBodies.id, body.id)).run();
	db.update(ships).set(shipUpdate).where(eq(ships.id, ship.id)).run();
}

function completeManufactureAction(db: DB, action: typeof actionQueue.$inferSelect) {
	// Manufacturing completion: ship is already debited, just set status
	db.update(ships).set({ status: "idle" }).where(eq(ships.id, action.shipId)).run();
}

function solarCharge(db: DB) {
	const allShips = db.select().from(ships).all();
	for (const ship of allShips) {
		if (ship.status === "destroyed") continue;
		db.update(ships)
			.set({ energy: ship.energy + 10 })
			.where(eq(ships.id, ship.id))
			.run();
	}
}

// ── Resource helpers ─────────────────────────────────────────────────────────

function resourceColumn(r: ResourceType): string {
	return r === "rare_elements" ? "rareElements" : r;
}

function bodyResource(body: typeof celestialBodies.$inferSelect, r: ResourceType): number {
	switch (r) {
		case "energy":
			return body.energy;
		case "metal":
			return body.metal;
		case "silicon":
			return body.silicon;
		case "hydrogen":
			return body.hydrogen;
		case "rare_elements":
			return body.rareElements;
	}
}

function shipResource(ship: typeof ships.$inferSelect, r: ResourceType): number {
	switch (r) {
		case "energy":
			return ship.energy;
		case "metal":
			return ship.metal;
		case "silicon":
			return ship.silicon;
		case "hydrogen":
			return ship.hydrogen;
		case "rare_elements":
			return ship.rareElements;
	}
}
