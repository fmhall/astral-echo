import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { db, schema } from "../db/index.js";
import { charge } from "../middleware/payment.js";
import { StarSystem, StarSystemDetail } from "../schemas/system.js";
import { WorldState } from "../schemas/world.js";

export const worldRoutes = new OpenAPIHono();

// ── GET /world ───────────────────────────────────────────────────────────────

const getWorldRoute = createRoute({
	method: "get",
	path: "/world",
	tags: ["World"],
	summary: "Get current world state overview",
	responses: {
		200: {
			description: "World state",
			content: { "application/json": { schema: WorldState } },
		},
	},
});

worldRoutes.use("/world", charge("0.0001"));
worldRoutes.openapi(getWorldRoute, async (c) => {
	const world = db.select().from(schema.worldState).get();
	if (!world) throw new HTTPException(500, { message: "No world state" });

	return c.json({
		tick: world.tick,
		status: world.status as "running" | "paused",
		tickIntervalMs: world.tickIntervalMs,
		lastTickAt: world.lastTickAt,
		systemCount: db.select().from(schema.starSystems).all().length,
		agentCount: db.select().from(schema.agents).all().length,
		shipCount: db.select().from(schema.ships).all().length,
	});
});

// ── GET /systems ─────────────────────────────────────────────────────────────

const listSystemsRoute = createRoute({
	method: "get",
	path: "/systems",
	tags: ["World"],
	summary: "List all star systems",
	responses: {
		200: {
			description: "Star systems",
			content: { "application/json": { schema: z.array(StarSystem) } },
		},
	},
});

worldRoutes.use("/systems", charge("0.0001"));
worldRoutes.openapi(listSystemsRoute, async (c) => {
	const systems = db.select().from(schema.starSystems).all();
	return c.json(
		systems.map((s) => ({
			id: s.id,
			name: s.name,
			position: { x: s.x, y: s.y, z: s.z },
		})),
	);
});

// ── GET /systems/:id ─────────────────────────────────────────────────────────

const getSystemRoute = createRoute({
	method: "get",
	path: "/systems/{id}",
	tags: ["World"],
	summary: "Get star system details with bodies and ports",
	request: { params: z.object({ id: z.string() }) },
	responses: {
		200: {
			description: "System details",
			content: { "application/json": { schema: StarSystemDetail } },
		},
	},
});

worldRoutes.use("/systems/:id", charge("0.0001"));
worldRoutes.openapi(getSystemRoute, async (c) => {
	const { id } = c.req.valid("param");
	const system = db.select().from(schema.starSystems).where(eq(schema.starSystems.id, id)).get();
	if (!system) throw new HTTPException(404, { message: "System not found" });

	const bodies = db
		.select()
		.from(schema.celestialBodies)
		.where(eq(schema.celestialBodies.systemId, id))
		.all();

	const systemPorts = db.select().from(schema.ports).where(eq(schema.ports.systemId, id)).all();

	return c.json({
		id: system.id,
		name: system.name,
		position: { x: system.x, y: system.y, z: system.z },
		bodies: bodies.map((b) => ({
			id: b.id,
			systemId: b.systemId,
			name: b.name,
			type: b.type as "star" | "planet" | "asteroid" | "gas_giant" | "moon" | "asteroid_belt",
			position: { x: b.x, y: b.y, z: b.z },
			resources: {
				energy: b.energy,
				metal: b.metal,
				silicon: b.silicon,
				hydrogen: b.hydrogen,
				rare_elements: b.rareElements,
			},
		})),
		ports: systemPorts.map((p) => ({
			id: p.id,
			name: p.name,
			bodyId: p.bodyId,
		})),
	});
});

// ── GET /leaderboard ─────────────────────────────────────────────────────────

const LeaderboardEntry = z.object({
	agentId: z.string(),
	name: z.string(),
	credits: z.number(),
	shipCount: z.number(),
	totalCargo: z.number(),
	maxGeneration: z.number(),
});

const leaderboardRoute = createRoute({
	method: "get",
	path: "/leaderboard",
	tags: ["World"],
	summary: "Agent leaderboard ranked by net worth (credits + cargo value)",
	responses: {
		200: {
			description: "Leaderboard",
			content: { "application/json": { schema: z.array(LeaderboardEntry) } },
		},
	},
});

worldRoutes.use("/leaderboard", charge("0.0001"));
worldRoutes.openapi(leaderboardRoute, async (c) => {
	const agents = db.select().from(schema.agents).all();
	const allShips = db.select().from(schema.ships).all();

	const entries = agents
		.map((agent) => {
			const agentShips = allShips.filter((s) => s.agentId === agent.id && s.status !== "destroyed");
			const totalCargo = agentShips.reduce(
				(sum, s) => sum + s.energy + s.metal + s.silicon + s.hydrogen + s.rareElements,
				0,
			);
			const maxGeneration = agentShips.reduce((max, s) => Math.max(max, s.generation), 0);

			return {
				agentId: agent.id,
				name: agent.name,
				credits: agent.credits,
				shipCount: agentShips.length,
				totalCargo,
				maxGeneration,
			};
		})
		.sort((a, b) => b.credits + b.totalCargo - (a.credits + a.totalCargo));

	return c.json(entries);
});
