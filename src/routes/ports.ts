import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { db, schema } from "../db/index.js";
import { updatePortPrice } from "../engine/economy.js";
import { charge } from "../middleware/payment.js";
import { Port, TradeRequest, TradeResult } from "../schemas/port.js";

export const portRoutes = new OpenAPIHono();

// ── GET /ports/:id ───────────────────────────────────────────────────────────

const getPortRoute = createRoute({
	method: "get",
	path: "/ports/{id}",
	tags: ["Ports"],
	summary: "Get port details with current prices",
	request: { params: z.object({ id: z.string() }) },
	responses: {
		200: {
			description: "Port details",
			content: { "application/json": { schema: Port } },
		},
	},
});

portRoutes.use("/ports/:id", charge("0.0001"));
portRoutes.openapi(getPortRoute, async (c) => {
	const { id } = c.req.valid("param");
	const port = db.select().from(schema.ports).where(eq(schema.ports.id, id)).get();
	if (!port) throw new HTTPException(404, { message: "Port not found" });

	const prices = db.select().from(schema.portPrices).where(eq(schema.portPrices.portId, id)).all();

	return c.json({
		...port,
		prices: prices.map((p) => ({
			resource: p.resource,
			buyPrice: p.buyPrice,
			sellPrice: p.sellPrice,
			supply: p.supply,
			demand: p.demand,
		})),
	});
});

// ── POST /ports/:id/trade ────────────────────────────────────────────────────

const tradeRoute = createRoute({
	method: "post",
	path: "/ports/{id}/trade",
	tags: ["Ports"],
	summary: "Buy or sell resources at a port",
	request: {
		params: z.object({ id: z.string() }),
		body: { content: { "application/json": { schema: TradeRequest } } },
	},
	responses: {
		200: {
			description: "Trade executed",
			content: { "application/json": { schema: TradeResult } },
		},
	},
});

portRoutes.use("/ports/:id/trade", charge("0.001"));
portRoutes.openapi(tradeRoute, async (c) => {
	const { id: portId } = c.req.valid("param");
	const trade = c.req.valid("json");

	const port = db.select().from(schema.ports).where(eq(schema.ports.id, portId)).get();
	if (!port) throw new HTTPException(404, { message: "Port not found" });

	const ship = db.select().from(schema.ships).where(eq(schema.ships.id, trade.shipId)).get();
	if (!ship) throw new HTTPException(400, { message: "Ship not found" });
	if (ship.dockedPortId !== portId) {
		throw new HTTPException(400, { message: "Ship is not docked at this port" });
	}
	if (ship.agentId !== trade.agentId) {
		throw new HTTPException(400, { message: "Ship does not belong to this agent" });
	}

	const priceRow = db
		.select()
		.from(schema.portPrices)
		.where(
			and(eq(schema.portPrices.portId, portId), eq(schema.portPrices.resource, trade.resource)),
		)
		.get();
	if (!priceRow) throw new HTTPException(400, { message: "Resource not traded at this port" });

	const agent = db.select().from(schema.agents).where(eq(schema.agents.id, trade.agentId)).get();
	if (!agent) throw new HTTPException(400, { message: "Agent not found" });

	const resourceCol = trade.resource === "rare_elements" ? "rareElements" : trade.resource;

	if (trade.side === "buy") {
		const pricePerUnit = priceRow.buyPrice;
		const total = pricePerUnit * trade.quantity;

		if (agent.credits < total) {
			throw new HTTPException(400, {
				message: `Not enough credits. Need ${total.toFixed(2)}, have ${agent.credits.toFixed(2)}`,
			});
		}
		if (priceRow.supply < trade.quantity) {
			throw new HTTPException(400, {
				message: `Not enough supply. Available: ${priceRow.supply}`,
			});
		}

		db.update(schema.agents)
			.set({ credits: agent.credits - total })
			.where(eq(schema.agents.id, agent.id))
			.run();

		const currentCargo = ship[resourceCol as keyof typeof ship] as number;
		db.update(schema.ships)
			.set({ [resourceCol]: currentCargo + trade.quantity })
			.where(eq(schema.ships.id, ship.id))
			.run();

		const world = db.select().from(schema.worldState).get();
		db.insert(schema.tradeLedger)
			.values({
				tick: world?.tick ?? 0,
				agentId: agent.id,
				portId,
				resource: trade.resource,
				side: "buy",
				quantity: trade.quantity,
				pricePerUnit,
				total,
			})
			.run();

		updatePortPrice(db, priceRow.id, trade.quantity, "buy");

		return c.json({
			ok: true as const,
			resource: trade.resource,
			side: "buy" as const,
			quantity: trade.quantity,
			pricePerUnit,
			total,
			agentCreditsAfter: agent.credits - total,
		});
	}

	// SELL
	const pricePerUnit = priceRow.sellPrice;
	const total = pricePerUnit * trade.quantity;
	const currentCargo = ship[resourceCol as keyof typeof ship] as number;

	if (currentCargo < trade.quantity) {
		throw new HTTPException(400, {
			message: `Not enough ${trade.resource}. Have ${currentCargo}`,
		});
	}

	db.update(schema.agents)
		.set({ credits: agent.credits + total })
		.where(eq(schema.agents.id, agent.id))
		.run();

	db.update(schema.ships)
		.set({ [resourceCol]: currentCargo - trade.quantity })
		.where(eq(schema.ships.id, ship.id))
		.run();

	const world = db.select().from(schema.worldState).get();
	db.insert(schema.tradeLedger)
		.values({
			tick: world?.tick ?? 0,
			agentId: agent.id,
			portId,
			resource: trade.resource,
			side: "sell",
			quantity: trade.quantity,
			pricePerUnit,
			total,
		})
		.run();

	updatePortPrice(db, priceRow.id, trade.quantity, "sell");

	return c.json({
		ok: true as const,
		resource: trade.resource,
		side: "sell" as const,
		quantity: trade.quantity,
		pricePerUnit,
		total,
		agentCreditsAfter: agent.credits + total,
	});
});
