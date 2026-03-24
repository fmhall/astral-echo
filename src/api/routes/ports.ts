import { Hono } from "hono"
import { eq } from "drizzle-orm"
import { db } from "../../db/index.js"
import { ports } from "../../db/schema.js"
import { PriceTier } from "../../types/index.js"
import { getMarket } from "../../engine/market.js"
import { getWorldConfig } from "../../engine/world.js"
import { x402 } from "../middleware/payment.js"

const app = new Hono()

/** List all ports */
app.get("/", x402(PriceTier.observe), (c) => {
	const allPorts = db.select().from(ports).all()
	return c.json(
		allPorts.map((p) => ({
			id: p.id,
			name: p.name,
			position: { x: p.x, y: p.y },
			ownerId: p.ownerId,
			dockingFee: p.dockingFee,
		})),
	)
})

/** Get port details */
app.get("/:id", x402(PriceTier.observe), (c) => {
	const port = db
		.select()
		.from(ports)
		.where(eq(ports.id, c.req.param("id")))
		.get()
	if (!port) return c.json({ error: "Port not found" }, 404)

	return c.json({
		id: port.id,
		name: port.name,
		position: { x: port.x, y: port.y },
		ownerId: port.ownerId,
		dockingFee: port.dockingFee,
	})
})

/** Get market data for a port */
app.get("/:id/market", x402(PriceTier.observe), (c) => {
	const portId = c.req.param("id")
	const port = db.select().from(ports).where(eq(ports.id, portId)).get()
	if (!port) return c.json({ error: "Port not found" }, 404)

	const config = getWorldConfig()
	const market = getMarket(portId, config.priceVolatility)

	return c.json({ portId, portName: port.name, entries: market })
})

export default app
