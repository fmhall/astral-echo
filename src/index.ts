import { swaggerUI } from "@hono/swagger-ui";
import { OpenAPIHono } from "@hono/zod-openapi";
import { db, schema } from "./db/index.js";
import { migrate } from "./db/migrate.js";
import { processTick } from "./engine/tick.js";
import { adminRoutes } from "./routes/admin.js";
import { agentRoutes } from "./routes/agents.js";
import { frontendRoutes } from "./routes/frontend.js";
import { portRoutes } from "./routes/ports.js";
import { shipRoutes } from "./routes/ships.js";
import { worldRoutes } from "./routes/world.js";

// ── Ensure DB tables exist ───────────────────────────────────────────────────
migrate();

// ── App ──────────────────────────────────────────────────────────────────────

const app = new OpenAPIHono();

// Landing
app.get("/", (c) =>
	c.json({
		name: "Astral Echo",
		version: "0.2.0",
		description:
			"Space economy simulation. AI agents pilot probes, harvest resources, trade at ports, and self-replicate across star systems.",
		docs: "/ui",
		openapi: "/doc",
	}),
);

// Agent discoverability
app.get("/llms.txt", (c) =>
	c.text(`# Astral Echo - Space Economy API
> AI agents pilot self-replicating probes in a living economy.
> Every API call costs a micropayment via x402.

## Endpoints
- POST /agents — Register (get a starter probe in Sol Prime)
- GET  /agents/:id — Your agent + ships
- GET  /world — Current tick, stats
- GET  /systems — List star systems
- GET  /systems/:id — System detail (bodies, ports, resources)
- GET  /ports/:id — Port prices (buy/sell spreads)
- POST /ports/:id/trade — Buy or sell resources at a port
- GET  /ships/:id — Ship status + cargo
- POST /ships/:id/travel — Fly to a body or system
- POST /ships/:id/harvest — Extract resources from a body
- POST /ships/:id/dock — Dock at a port to trade
- POST /ships/:id/manufacture — Self-replicate (build a new probe)
- POST /admin/tick — Advance world (admin only)
- POST /admin/status — Pause/resume auto-tick
- POST /admin/tick-interval — Set tick speed

## Quick Start
1. POST /agents with { name, walletAddress }
2. GET /systems/sol-prime to see what's around
3. POST /ships/:id/harvest to gather metal
4. POST /ships/:id/dock at a port
5. POST /ports/:id/trade to sell for credits
6. POST /ships/:id/travel to explore new systems
7. POST /ships/:id/manufacture when you have enough resources
`),
);

// Mount routes
app.route("/", agentRoutes);
app.route("/", shipRoutes);
app.route("/", portRoutes);
app.route("/", worldRoutes);
app.route("/", adminRoutes);
app.route("/", frontendRoutes);

// OpenAPI docs
app.doc("/doc", {
	openapi: "3.1.0",
	info: {
		title: "Astral Echo",
		version: "0.2.0",
		description:
			"Space economy simulation API. AI agents pilot self-replicating probes, harvest resources, trade at ports, and compete across star systems.",
	},
});

app.get("/ui", swaggerUI({ url: "/doc" }));

// ── Auto-tick loop ───────────────────────────────────────────────────────────

let tickTimer: ReturnType<typeof setInterval> | null = null;

function startTickLoop() {
	if (tickTimer) clearInterval(tickTimer);

	const world = db.select().from(schema.worldState).get();
	if (!world) return;

	tickTimer = setInterval(() => {
		const current = db.select().from(schema.worldState).get();
		if (!current || current.status !== "running") return;

		const newTick = processTick(db);
		console.log(`[tick ${newTick}]`);
	}, world.tickIntervalMs);
}

startTickLoop();

// ── Serve ────────────────────────────────────────────────────────────────────

const port = Number(process.env.PORT) || 3000;
console.log(`🚀 Astral Echo running on http://localhost:${port}`);
console.log(`👁️  Spectator at http://localhost:${port}/spectate`);
console.log(`📖 Docs at http://localhost:${port}/ui`);
console.log(`🤖 Agent discovery at http://localhost:${port}/llms.txt`);

export default {
	port,
	fetch: app.fetch,
};
