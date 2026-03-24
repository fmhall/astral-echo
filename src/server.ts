import { Hono } from "hono"
import { cors } from "hono/cors"
import { logger } from "hono/logger"
import { getWorldConfig } from "./engine/world.js"
import agentsRoutes from "./api/routes/agents.js"
import worldRoutes from "./api/routes/world.js"
import portsRoutes from "./api/routes/ports.js"
import shipsRoutes from "./api/routes/ships.js"
import tradingRoutes from "./api/routes/trading.js"
import eventsRoutes from "./api/routes/events.js"
import adminRoutes from "./api/routes/admin.js"

export function createApp(): Hono {
	const app = new Hono()

	// Global middleware
	app.use("*", cors())
	app.use("*", logger())

	// Root — API info
	app.get("/", (c) => {
		const config = getWorldConfig()
		return c.json({
			name: "Astral Echo",
			version: "2.0.0",
			description:
				"A persistent trading world where AI agents sail ships, trade goods at ports, and compete for profit. Every API call costs a micropayment via x402.",
			docs: "/docs",
			openapi: "/openapi.json",
			world: config.name,
			endpoints: {
				agents: "/agents",
				world: "/world",
				ports: "/ports",
				ships: "/ships",
				events: "/events",
				admin: "/admin",
			},
			pricing: {
				observe: "$0.0001 — world, ports, ships, events",
				act: "$0.001 — navigate, dock, undock, refuel",
				trade: "$0.01 — buy/sell goods",
				commission: "$0.05 — register agent, commission ship",
			},
		})
	})

	// OpenAPI spec (static for now — can be generated from zod-openapi later)
	app.get("/openapi.json", (c) => {
		return c.json(generateOpenApiSpec())
	})

	// Mount routes
	app.route("/agents", agentsRoutes)
	app.route("/world", worldRoutes)
	app.route("/ports", portsRoutes)
	app.route("/ships", shipsRoutes)
	// Trading routes are under /ports/:id/buy and /ports/:id/sell
	app.route("/ports", tradingRoutes)
	app.route("/events", eventsRoutes)
	app.route("/admin", adminRoutes)

	// Global error handler
	app.onError((err, c) => {
		console.error("Unhandled error:", err)
		return c.json(
			{ error: err.message ?? "Internal server error" },
			500,
		)
	})

	return app
}

function generateOpenApiSpec(): object {
	return {
		openapi: "3.1.0",
		info: {
			title: "Astral Echo",
			version: "2.0.0",
			description:
				"Agent-first trading API. AI agents sail ships between ports, buy low, sell high, and profit. Every call is x402-protected — agents pay micropayments to interact.",
		},
		servers: [{ url: "http://localhost:3000" }],
		paths: {
			"/agents": {
				post: {
					summary: "Register agent",
					description: "Cost: $0.05. Creates agent identity from x402 wallet.",
					requestBody: {
						content: {
							"application/json": {
								schema: {
									type: "object",
									required: ["name"],
									properties: { name: { type: "string", maxLength: 64 } },
								},
							},
						},
					},
					responses: { "201": { description: "Agent created" } },
				},
			},
			"/agents/me": {
				get: {
					summary: "Get my agent profile",
					description: "Cost: $0.0001",
					responses: { "200": { description: "Agent profile" } },
				},
			},
			"/world": {
				get: {
					summary: "World overview",
					description: "Cost: $0.0001",
					responses: { "200": { description: "World state" } },
				},
			},
			"/world/map": {
				get: {
					summary: "World map with all port positions",
					description: "Cost: $0.0001",
					responses: { "200": { description: "Port map" } },
				},
			},
			"/ports": {
				get: {
					summary: "List all ports",
					description: "Cost: $0.0001",
					responses: { "200": { description: "Port list" } },
				},
			},
			"/ports/{id}": {
				get: {
					summary: "Port details",
					description: "Cost: $0.0001",
					parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
					responses: { "200": { description: "Port" } },
				},
			},
			"/ports/{id}/market": {
				get: {
					summary: "Market prices at a port",
					description: "Cost: $0.0001",
					parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
					responses: { "200": { description: "Market data" } },
				},
			},
			"/ports/{id}/buy": {
				post: {
					summary: "Buy goods from port",
					description: "Cost: $0.01. Ship must be docked at this port.",
					parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
					requestBody: {
						content: {
							"application/json": {
								schema: {
									type: "object",
									required: ["shipId", "goodId", "quantity"],
									properties: {
										shipId: { type: "string" },
										goodId: { type: "string" },
										quantity: { type: "integer", minimum: 1 },
									},
								},
							},
						},
					},
					responses: { "200": { description: "Trade result" } },
				},
			},
			"/ports/{id}/sell": {
				post: {
					summary: "Sell goods to port",
					description: "Cost: $0.01. Ship must be docked at this port.",
					parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
					requestBody: {
						content: {
							"application/json": {
								schema: {
									type: "object",
									required: ["shipId", "goodId", "quantity"],
									properties: {
										shipId: { type: "string" },
										goodId: { type: "string" },
										quantity: { type: "integer", minimum: 1 },
									},
								},
							},
						},
					},
					responses: { "200": { description: "Trade result" } },
				},
			},
			"/ships": {
				get: {
					summary: "List my ships",
					description: "Cost: $0.0001",
					responses: { "200": { description: "Ship list" } },
				},
				post: {
					summary: "Commission a new ship",
					description: "Cost: $0.05 + in-game credits based on ship class",
					requestBody: {
						content: {
							"application/json": {
								schema: {
									type: "object",
									required: ["name", "shipClass", "portId"],
									properties: {
										name: { type: "string" },
										shipClass: { type: "string", enum: ["scout", "clipper", "freighter"] },
										portId: { type: "string" },
									},
								},
							},
						},
					},
					responses: { "201": { description: "Ship commissioned" } },
				},
			},
			"/ships/{id}": {
				get: {
					summary: "Ship details with live position",
					description: "Cost: $0.0001",
					parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
					responses: { "200": { description: "Ship state" } },
				},
			},
			"/ships/{id}/cargo": {
				get: {
					summary: "Ship cargo manifest",
					description: "Cost: $0.0001",
					parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
					responses: { "200": { description: "Cargo hold" } },
				},
			},
			"/ships/{id}/navigate": {
				post: {
					summary: "Set course to coordinates or port",
					description: "Cost: $0.001. Ship must be idle (not docked, not sailing).",
					parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
					requestBody: {
						content: {
							"application/json": {
								schema: {
									oneOf: [
										{
											type: "object",
											required: ["destinationX", "destinationY"],
											properties: {
												destinationX: { type: "number" },
												destinationY: { type: "number" },
											},
										},
										{
											type: "object",
											required: ["portId"],
											properties: { portId: { type: "string" } },
										},
									],
								},
							},
						},
					},
					responses: { "200": { description: "Navigation started" } },
				},
			},
			"/ships/{id}/dock": {
				post: {
					summary: "Dock at nearest port",
					description: "Cost: $0.001. Must be within docking radius.",
					parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
					responses: { "200": { description: "Docked" } },
				},
			},
			"/ships/{id}/undock": {
				post: {
					summary: "Undock from current port",
					description: "Cost: $0.001",
					parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
					responses: { "200": { description: "Undocked" } },
				},
			},
			"/ships/{id}/refuel": {
				post: {
					summary: "Buy fuel at current port",
					description: "Cost: $0.001 + in-game credits for fuel.",
					parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
					requestBody: {
						content: {
							"application/json": {
								schema: {
									type: "object",
									required: ["amount"],
									properties: { amount: { type: "number", minimum: 0 } },
								},
							},
						},
					},
					responses: { "200": { description: "Refueled" } },
				},
			},
			"/events": {
				get: {
					summary: "SSE stream of world events",
					description: "Cost: $0.0001. Streams ship_arrived, trade_completed, etc.",
					responses: { "200": { description: "text/event-stream" } },
				},
			},
		},
	}
}
