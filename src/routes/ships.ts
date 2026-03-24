import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { db, schema } from "../db/index.js";
import { distance, travelEnergyCost, travelTicks } from "../engine/navigation.js";
import { charge } from "../middleware/payment.js";
import { MANUFACTURE_COST, RESOURCE_KEYS } from "../schemas/common.js";
import {
	HarvestRequest,
	ManufactureRequest,
	Ship,
	ShipAction,
	TravelRequest,
} from "../schemas/ship.js";

export const shipRoutes = new OpenAPIHono();

// ── Helpers ──────────────────────────────────────────────────────────────────

function shipToResponse(s: typeof schema.ships.$inferSelect) {
	return {
		id: s.id,
		agentId: s.agentId,
		name: s.name,
		status: s.status,
		systemId: s.systemId,
		dockedPortId: s.dockedPortId,
		position: { x: s.x, y: s.y, z: s.z },
		cargo: {
			energy: s.energy,
			metal: s.metal,
			silicon: s.silicon,
			hydrogen: s.hydrogen,
			rare_elements: s.rareElements,
		},
		cargoCapacity: s.cargoCapacity,
		speed: s.speed,
		sensorRange: s.sensorRange,
		harvestRate: s.harvestRate,
		generation: s.generation,
		createdAt: s.createdAt,
	};
}

function getCurrentTick(): number {
	const world = db.select().from(schema.worldState).get();
	return world?.tick ?? 0;
}

function getShipOrThrow(id: string) {
	const ship = db.select().from(schema.ships).where(eq(schema.ships.id, id)).get();
	if (!ship) throw new HTTPException(404, { message: "Ship not found" });
	return ship;
}

// ── GET /ships/:id ───────────────────────────────────────────────────────────

const getShipRoute = createRoute({
	method: "get",
	path: "/ships/{id}",
	tags: ["Ships"],
	summary: "Get ship details",
	request: { params: z.object({ id: z.string() }) },
	responses: {
		200: {
			description: "Ship details",
			content: { "application/json": { schema: Ship } },
		},
	},
});

shipRoutes.use("/ships/:id", charge("0.0001"));
shipRoutes.openapi(getShipRoute, async (c) => {
	const ship = getShipOrThrow(c.req.valid("param").id);
	return c.json(shipToResponse(ship));
});

// ── POST /ships/:id/travel ───────────────────────────────────────────────────

const travelRoute = createRoute({
	method: "post",
	path: "/ships/{id}/travel",
	tags: ["Ships"],
	summary: "Start traveling to a destination",
	request: {
		params: z.object({ id: z.string() }),
		body: { content: { "application/json": { schema: TravelRequest } } },
	},
	responses: {
		200: {
			description: "Travel started",
			content: { "application/json": { schema: ShipAction } },
		},
	},
});

shipRoutes.use("/ships/:id/travel", charge("0.001"));
shipRoutes.openapi(travelRoute, async (c) => {
	const { id } = c.req.valid("param");
	const body = c.req.valid("json");
	const ship = getShipOrThrow(id);

	if (ship.status === "traveling" || ship.status === "destroyed") {
		throw new HTTPException(400, { message: `Ship is ${ship.status}` });
	}

	let destX: number;
	let destY: number;
	let destZ: number;
	let destSystemId = ship.systemId;

	if (body.destinationBodyId) {
		const target = db
			.select()
			.from(schema.celestialBodies)
			.where(eq(schema.celestialBodies.id, body.destinationBodyId))
			.get();
		if (!target) throw new HTTPException(400, { message: "Destination body not found" });
		destX = target.x;
		destY = target.y;
		destZ = target.z;
		destSystemId = target.systemId;
	} else if (body.destinationSystemId) {
		const target = db
			.select()
			.from(schema.starSystems)
			.where(eq(schema.starSystems.id, body.destinationSystemId))
			.get();
		if (!target) throw new HTTPException(400, { message: "Destination system not found" });
		destX = target.x;
		destY = target.y;
		destZ = target.z;
		destSystemId = target.id;
	} else if (body.x != null && body.y != null && body.z != null) {
		destX = body.x;
		destY = body.y;
		destZ = body.z;
	} else {
		throw new HTTPException(400, {
			message: "Provide destinationBodyId, destinationSystemId, or x/y/z",
		});
	}

	const dist = distance({ x: ship.x, y: ship.y, z: ship.z }, { x: destX, y: destY, z: destZ });
	const energyCost = travelEnergyCost(dist);
	if (ship.energy < energyCost) {
		throw new HTTPException(400, {
			message: `Not enough energy. Need ${energyCost.toFixed(1)}, have ${ship.energy}`,
		});
	}

	const tick = getCurrentTick();
	const ticks = travelTicks(dist, ship.speed);

	db.update(schema.ships)
		.set({ status: "traveling", energy: ship.energy - energyCost, dockedPortId: null })
		.where(eq(schema.ships.id, id))
		.run();

	db.insert(schema.actionQueue)
		.values({
			shipId: id,
			action: "travel",
			destSystemId,
			destX,
			destY,
			destZ,
			startTick: tick,
			endTick: tick + ticks,
		})
		.run();

	return c.json({ shipId: id, action: "travel", startTick: tick, endTick: tick + ticks });
});

// ── POST /ships/:id/harvest ──────────────────────────────────────────────────

const harvestRoute = createRoute({
	method: "post",
	path: "/ships/{id}/harvest",
	tags: ["Ships"],
	summary: "Start harvesting a resource from a nearby body",
	request: {
		params: z.object({ id: z.string() }),
		body: { content: { "application/json": { schema: HarvestRequest } } },
	},
	responses: {
		200: {
			description: "Harvesting started",
			content: { "application/json": { schema: ShipAction } },
		},
	},
});

shipRoutes.use("/ships/:id/harvest", charge("0.001"));
shipRoutes.openapi(harvestRoute, async (c) => {
	const { id } = c.req.valid("param");
	const body = c.req.valid("json");
	const ship = getShipOrThrow(id);

	if (ship.status !== "idle" && ship.status !== "docked") {
		throw new HTTPException(400, { message: `Ship is ${ship.status}, must be idle or docked` });
	}

	const targetBody = db
		.select()
		.from(schema.celestialBodies)
		.where(eq(schema.celestialBodies.id, body.bodyId))
		.get();
	if (!targetBody) throw new HTTPException(400, { message: "Body not found" });

	const dist = distance(
		{ x: ship.x, y: ship.y, z: ship.z },
		{ x: targetBody.x, y: targetBody.y, z: targetBody.z },
	);
	if (dist > ship.sensorRange) {
		throw new HTTPException(400, {
			message: `Body is ${dist.toFixed(1)} AU away, sensor range is ${ship.sensorRange}`,
		});
	}

	const tick = getCurrentTick();
	const harvestTicks = 3;

	db.update(schema.ships).set({ status: "harvesting" }).where(eq(schema.ships.id, id)).run();

	db.insert(schema.actionQueue)
		.values({
			shipId: id,
			action: "harvest",
			targetBodyId: body.bodyId,
			harvestResource: body.resource,
			startTick: tick,
			endTick: tick + harvestTicks,
		})
		.run();

	return c.json({ shipId: id, action: "harvest", startTick: tick, endTick: tick + harvestTicks });
});

// ── POST /ships/:id/dock ─────────────────────────────────────────────────────

const dockRoute = createRoute({
	method: "post",
	path: "/ships/{id}/dock",
	tags: ["Ships"],
	summary: "Dock at a nearby port",
	request: {
		params: z.object({ id: z.string() }),
		body: {
			content: {
				"application/json": { schema: z.object({ portId: z.string() }) },
			},
		},
	},
	responses: {
		200: {
			description: "Docked successfully",
			content: { "application/json": { schema: Ship } },
		},
	},
});

shipRoutes.use("/ships/:id/dock", charge("0.0001"));
shipRoutes.openapi(dockRoute, async (c) => {
	const { id } = c.req.valid("param");
	const { portId } = c.req.valid("json");
	const ship = getShipOrThrow(id);

	if (ship.status === "traveling" || ship.status === "destroyed") {
		throw new HTTPException(400, { message: `Ship is ${ship.status}` });
	}

	const port = db.select().from(schema.ports).where(eq(schema.ports.id, portId)).get();
	if (!port) throw new HTTPException(400, { message: "Port not found" });

	if (port.systemId !== ship.systemId) {
		throw new HTTPException(400, { message: "Port is in a different system" });
	}

	const portBody = db
		.select()
		.from(schema.celestialBodies)
		.where(eq(schema.celestialBodies.id, port.bodyId))
		.get();
	if (!portBody) throw new HTTPException(500, { message: "Port body not found" });

	const dist = distance(
		{ x: ship.x, y: ship.y, z: ship.z },
		{ x: portBody.x, y: portBody.y, z: portBody.z },
	);
	if (dist > ship.sensorRange) {
		throw new HTTPException(400, {
			message: `Port is ${dist.toFixed(1)} AU away, too far to dock`,
		});
	}

	db.update(schema.ships)
		.set({
			status: "docked",
			dockedPortId: portId,
			x: portBody.x,
			y: portBody.y,
			z: portBody.z,
		})
		.where(eq(schema.ships.id, id))
		.run();

	const updated = getShipOrThrow(id);
	return c.json(shipToResponse(updated));
});

// ── POST /ships/:id/manufacture ──────────────────────────────────────────────

const manufactureRoute = createRoute({
	method: "post",
	path: "/ships/{id}/manufacture",
	tags: ["Ships"],
	summary: "Manufacture a new probe (self-replicate)",
	request: {
		params: z.object({ id: z.string() }),
		body: { content: { "application/json": { schema: ManufactureRequest } } },
	},
	responses: {
		200: {
			description: "Manufacturing started. New ship will appear when complete.",
			content: { "application/json": { schema: ShipAction } },
		},
	},
});

shipRoutes.use("/ships/:id/manufacture", charge("0.01"));
shipRoutes.openapi(manufactureRoute, async (c) => {
	const { id } = c.req.valid("param");
	const body = c.req.valid("json");
	const ship = getShipOrThrow(id);

	if (ship.status !== "idle" && ship.status !== "docked") {
		throw new HTTPException(400, { message: `Ship is ${ship.status}, must be idle or docked` });
	}

	for (const key of RESOURCE_KEYS) {
		const col = key === "rare_elements" ? "rareElements" : key;
		const have = ship[col as keyof typeof ship] as number;
		if (have < MANUFACTURE_COST[key]) {
			throw new HTTPException(400, {
				message: `Not enough ${key}. Need ${MANUFACTURE_COST[key]}, have ${have}`,
			});
		}
	}

	db.update(schema.ships)
		.set({
			status: "manufacturing",
			energy: ship.energy - MANUFACTURE_COST.energy,
			metal: ship.metal - MANUFACTURE_COST.metal,
			silicon: ship.silicon - MANUFACTURE_COST.silicon,
			hydrogen: ship.hydrogen - MANUFACTURE_COST.hydrogen,
			rareElements: ship.rareElements - MANUFACTURE_COST.rare_elements,
		})
		.where(eq(schema.ships.id, id))
		.run();

	const newShipId = crypto.randomUUID();
	db.insert(schema.ships)
		.values({
			id: newShipId,
			agentId: ship.agentId,
			name: body.name,
			status: "idle",
			systemId: ship.systemId,
			dockedPortId: ship.dockedPortId,
			x: ship.x,
			y: ship.y,
			z: ship.z,
			energy: 50,
			metal: 0,
			silicon: 0,
			hydrogen: 0,
			rareElements: 0,
			cargoCapacity: 500,
			speed: 1.0,
			sensorRange: 50,
			harvestRate: 10,
			generation: ship.generation + 1,
			createdAt: Date.now(),
		})
		.run();

	const tick = getCurrentTick();
	const manufactureTicks = 5;

	db.insert(schema.actionQueue)
		.values({
			shipId: id,
			action: "manufacture",
			startTick: tick,
			endTick: tick + manufactureTicks,
		})
		.run();

	return c.json({
		shipId: id,
		action: "manufacture",
		startTick: tick,
		endTick: tick + manufactureTicks,
	});
});

// ── GET /ships/:id/scan ──────────────────────────────────────────────────────

const ScanResult = z.object({
	bodies: z.array(
		z.object({
			id: z.string(),
			name: z.string(),
			type: z.string(),
			distance: z.number(),
			resources: z.object({
				energy: z.number(),
				metal: z.number(),
				silicon: z.number(),
				hydrogen: z.number(),
				rare_elements: z.number(),
			}),
		}),
	),
	ports: z.array(
		z.object({
			id: z.string(),
			name: z.string(),
			bodyId: z.string(),
			distance: z.number(),
		}),
	),
	ships: z.array(
		z.object({
			id: z.string(),
			name: z.string(),
			agentId: z.string(),
			distance: z.number(),
		}),
	),
});

const scanRoute = createRoute({
	method: "get",
	path: "/ships/{id}/scan",
	tags: ["Ships"],
	summary: "Scan nearby bodies, ports, and other ships within sensor range",
	request: { params: z.object({ id: z.string() }) },
	responses: {
		200: {
			description: "Scan results",
			content: { "application/json": { schema: ScanResult } },
		},
	},
});

shipRoutes.use("/ships/:id/scan", charge("0.001"));
shipRoutes.openapi(scanRoute, async (c) => {
	const ship = getShipOrThrow(c.req.valid("param").id);
	const shipPos = { x: ship.x, y: ship.y, z: ship.z };

	// Find nearby bodies
	const allBodies = db
		.select()
		.from(schema.celestialBodies)
		.where(eq(schema.celestialBodies.systemId, ship.systemId))
		.all();

	const nearbyBodies = allBodies
		.map((b) => ({
			id: b.id,
			name: b.name,
			type: b.type,
			distance: Math.round(distance(shipPos, { x: b.x, y: b.y, z: b.z }) * 100) / 100,
			resources: {
				energy: b.energy,
				metal: b.metal,
				silicon: b.silicon,
				hydrogen: b.hydrogen,
				rare_elements: b.rareElements,
			},
		}))
		.filter((b) => b.distance <= ship.sensorRange)
		.sort((a, b) => a.distance - b.distance);

	// Find nearby ports
	const systemPorts = db
		.select()
		.from(schema.ports)
		.where(eq(schema.ports.systemId, ship.systemId))
		.all();

	const nearbyPorts = systemPorts
		.map((p) => {
			const body = allBodies.find((b) => b.id === p.bodyId);
			const d = body
				? Math.round(distance(shipPos, { x: body.x, y: body.y, z: body.z }) * 100) / 100
				: 9999;
			return { id: p.id, name: p.name, bodyId: p.bodyId, distance: d };
		})
		.filter((p) => p.distance <= ship.sensorRange)
		.sort((a, b) => a.distance - b.distance);

	// Find nearby ships (not own)
	const allShips = db.select().from(schema.ships).all();
	const nearbyShips = allShips
		.filter((s) => s.id !== ship.id && s.systemId === ship.systemId && s.status !== "destroyed")
		.map((s) => ({
			id: s.id,
			name: s.name,
			agentId: s.agentId,
			distance: Math.round(distance(shipPos, { x: s.x, y: s.y, z: s.z }) * 100) / 100,
		}))
		.filter((s) => s.distance <= ship.sensorRange)
		.sort((a, b) => a.distance - b.distance);

	return c.json({ bodies: nearbyBodies, ports: nearbyPorts, ships: nearbyShips });
});
