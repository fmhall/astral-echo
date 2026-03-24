import { Hono } from "hono"
import { eq } from "drizzle-orm"
import { db } from "../../db/index.js"
import { ports } from "../../db/schema.js"
import { PriceTier, TradeInput } from "../../types/index.js"
import { executeBuy, executeSell } from "../../engine/market.js"
import { getWorldConfig } from "../../engine/world.js"
import { x402 } from "../middleware/payment.js"
import { requireAgent } from "../middleware/identity.js"

const app = new Hono()

/** Buy goods from a port into your ship */
app.post("/:id/buy", x402(PriceTier.trade), async (c) => {
	const agent = requireAgent(c)
	const portId = c.req.param("id")

	const port = db.select().from(ports).where(eq(ports.id, portId)).get()
	if (!port) return c.json({ error: "Port not found" }, 404)

	const body = TradeInput.safeParse(await c.req.json())
	if (!body.success) {
		return c.json({ error: "Invalid input", detail: body.error.message }, 400)
	}

	const config = getWorldConfig()

	try {
		const result = executeBuy(
			agent.id,
			body.data.shipId,
			portId,
			body.data.goodId,
			body.data.quantity,
			config.priceVolatility,
		)
		return c.json({
			direction: "buy",
			goodId: body.data.goodId,
			quantity: body.data.quantity,
			pricePerUnit: result.pricePerUnit,
			total: result.total,
		})
	} catch (e) {
		const msg = e instanceof Error ? e.message : "Trade failed"
		return c.json({ error: msg }, 400)
	}
})

/** Sell goods from your ship to a port */
app.post("/:id/sell", x402(PriceTier.trade), async (c) => {
	const agent = requireAgent(c)
	const portId = c.req.param("id")

	const port = db.select().from(ports).where(eq(ports.id, portId)).get()
	if (!port) return c.json({ error: "Port not found" }, 404)

	const body = TradeInput.safeParse(await c.req.json())
	if (!body.success) {
		return c.json({ error: "Invalid input", detail: body.error.message }, 400)
	}

	const config = getWorldConfig()

	try {
		const result = executeSell(
			agent.id,
			body.data.shipId,
			portId,
			body.data.goodId,
			body.data.quantity,
			config.priceVolatility,
		)
		return c.json({
			direction: "sell",
			goodId: body.data.goodId,
			quantity: body.data.quantity,
			pricePerUnit: result.pricePerUnit,
			total: result.total,
		})
	} catch (e) {
		const msg = e instanceof Error ? e.message : "Trade failed"
		return c.json({ error: msg }, 400)
	}
})

export default app
