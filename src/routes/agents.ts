import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { db, schema } from "../db/index.js";
import { charge } from "../middleware/payment.js";
import { AgentWithShips, RegisterAgentRequest } from "../schemas/agent.js";

export const agentRoutes = new OpenAPIHono();

// ── POST /agents ─────────────────────────────────────────────────────────────

const registerRoute = createRoute({
	method: "post",
	path: "/agents",
	tags: ["Agents"],
	summary: "Register a new agent and receive a starter probe",
	request: {
		body: { content: { "application/json": { schema: RegisterAgentRequest } } },
	},
	responses: {
		201: {
			description: "Agent created with starter ship",
			content: { "application/json": { schema: AgentWithShips } },
		},
	},
});

agentRoutes.openapi(registerRoute, async (c) => {
	const body = c.req.valid("json");

	const existing = db
		.select()
		.from(schema.agents)
		.where(eq(schema.agents.walletAddress, body.walletAddress))
		.get();
	if (existing) throw new HTTPException(409, { message: "Wallet already registered" });

	const startSystem = db
		.select()
		.from(schema.starSystems)
		.where(eq(schema.starSystems.id, "sol-prime"))
		.get();
	if (!startSystem) throw new HTTPException(500, { message: "No starting system. Run seed." });

	const startPort = db
		.select()
		.from(schema.ports)
		.where(eq(schema.ports.systemId, startSystem.id))
		.get();
	const portBody = startPort
		? db
				.select()
				.from(schema.celestialBodies)
				.where(eq(schema.celestialBodies.id, startPort.bodyId))
				.get()
		: null;

	const now = Date.now();
	const agentId = crypto.randomUUID();
	const shipId = crypto.randomUUID();

	db.insert(schema.agents)
		.values({
			id: agentId,
			name: body.name,
			walletAddress: body.walletAddress,
			credits: 1000,
			createdAt: now,
		})
		.run();

	db.insert(schema.ships)
		.values({
			id: shipId,
			agentId,
			name: `${body.name}'s Probe`,
			status: startPort ? "docked" : "idle",
			systemId: startSystem.id,
			dockedPortId: startPort?.id ?? null,
			x: portBody?.x ?? startSystem.x,
			y: portBody?.y ?? startSystem.y,
			z: portBody?.z ?? startSystem.z,
			energy: 100,
			metal: 0,
			silicon: 0,
			hydrogen: 0,
			rareElements: 0,
			cargoCapacity: 500,
			speed: 1.0,
			sensorRange: 50,
			harvestRate: 10,
			generation: 0,
			createdAt: now,
		})
		.run();

	return c.json(
		{
			id: agentId,
			name: body.name,
			walletAddress: body.walletAddress,
			credits: 1000,
			createdAt: now,
			ships: [
				{
					id: shipId,
					name: `${body.name}'s Probe`,
					status: startPort ? ("docked" as const) : ("idle" as const),
					systemId: startSystem.id,
				},
			],
		},
		201,
	);
});

// ── GET /agents/:id ──────────────────────────────────────────────────────────

const getAgentRoute = createRoute({
	method: "get",
	path: "/agents/{id}",
	tags: ["Agents"],
	summary: "Get agent state including ships",
	request: {
		params: z.object({ id: z.string() }),
	},
	responses: {
		200: {
			description: "Agent details",
			content: { "application/json": { schema: AgentWithShips } },
		},
	},
});

agentRoutes.use("/agents/:id", charge("0.0001"));
agentRoutes.openapi(getAgentRoute, async (c) => {
	const { id } = c.req.valid("param");
	const agent = db.select().from(schema.agents).where(eq(schema.agents.id, id)).get();
	if (!agent) throw new HTTPException(404, { message: "Agent not found" });

	const agentShips = db.select().from(schema.ships).where(eq(schema.ships.agentId, id)).all();

	return c.json({
		...agent,
		ships: agentShips.map((s) => ({
			id: s.id,
			name: s.name,
			status: s.status,
			systemId: s.systemId,
		})),
	});
});
