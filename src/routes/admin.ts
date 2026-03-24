import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { db, schema } from "../db/index.js";
import { processTick } from "../engine/tick.js";
import {
	AdminSetStatusRequest,
	AdminSetTickIntervalRequest,
	AdminTickRequest,
	WorldState,
} from "../schemas/world.js";

export const adminRoutes = new OpenAPIHono();

function getWorld() {
	const world = db.select().from(schema.worldState).get();
	if (!world) throw new HTTPException(500, { message: "No world state. Run seed." });
	return world;
}

// ── POST /admin/tick ─────────────────────────────────────────────────────────

const tickRoute = createRoute({
	method: "post",
	path: "/admin/tick",
	tags: ["Admin"],
	summary: "Manually advance the world by N ticks",
	request: {
		body: { content: { "application/json": { schema: AdminTickRequest } } },
	},
	responses: {
		200: {
			description: "Ticks processed",
			content: {
				"application/json": {
					schema: z.object({ ticksProcessed: z.number(), currentTick: z.number() }),
				},
			},
		},
	},
});

adminRoutes.openapi(tickRoute, async (c) => {
	const { ticks } = c.req.valid("json");
	let currentTick = 0;
	for (let i = 0; i < ticks; i++) {
		currentTick = processTick(db);
	}
	return c.json({ ticksProcessed: ticks, currentTick });
});

// ── POST /admin/status ───────────────────────────────────────────────────────

const setStatusRoute = createRoute({
	method: "post",
	path: "/admin/status",
	tags: ["Admin"],
	summary: "Set world status (running/paused)",
	request: {
		body: { content: { "application/json": { schema: AdminSetStatusRequest } } },
	},
	responses: {
		200: {
			description: "Status updated",
			content: { "application/json": { schema: WorldState } },
		},
	},
});

adminRoutes.openapi(setStatusRoute, async (c) => {
	const { status } = c.req.valid("json");
	const world = getWorld();

	db.update(schema.worldState).set({ status }).where(eq(schema.worldState.id, world.id)).run();

	return c.json({
		tick: world.tick,
		status,
		tickIntervalMs: world.tickIntervalMs,
		lastTickAt: world.lastTickAt,
		systemCount: db.select().from(schema.starSystems).all().length,
		agentCount: db.select().from(schema.agents).all().length,
		shipCount: db.select().from(schema.ships).all().length,
	});
});

// ── POST /admin/tick-interval ────────────────────────────────────────────────

const setTickIntervalRoute = createRoute({
	method: "post",
	path: "/admin/tick-interval",
	tags: ["Admin"],
	summary: "Set the auto-tick interval in milliseconds",
	request: {
		body: {
			content: { "application/json": { schema: AdminSetTickIntervalRequest } },
		},
	},
	responses: {
		200: {
			description: "Interval updated",
			content: {
				"application/json": {
					schema: z.object({ tickIntervalMs: z.number() }),
				},
			},
		},
	},
});

adminRoutes.openapi(setTickIntervalRoute, async (c) => {
	const { tickIntervalMs } = c.req.valid("json");
	const world = getWorld();

	db.update(schema.worldState)
		.set({ tickIntervalMs })
		.where(eq(schema.worldState.id, world.id))
		.run();

	return c.json({ tickIntervalMs });
});
