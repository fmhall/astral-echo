import { Hono } from "hono"
import { db } from "../../db/index.js"
import { agents, ports, ships } from "../../db/schema.js"
import { PriceTier } from "../../types/index.js"
import { getWorldConfig } from "../../engine/world.js"
import { x402 } from "../middleware/payment.js"

const app = new Hono()

/** World overview */
app.get("/", x402(PriceTier.observe), (c) => {
	const config = getWorldConfig()
	const portCount = db.select().from(ports).all().length
	const shipCount = db.select().from(ships).all().length
	const agentCount = db.select().from(agents).all().length

	return c.json({
		name: config.name,
		dimensions: { width: config.width, height: config.height },
		tickIntervalMs: config.tickIntervalMs,
		portCount,
		shipCount,
		agentCount,
		time: Date.now(),
	})
})

/** World map — all port positions (for route planning) */
app.get("/map", x402(PriceTier.observe), (c) => {
	const allPorts = db.select().from(ports).all()
	return c.json({
		ports: allPorts.map((p) => ({
			id: p.id,
			name: p.name,
			position: { x: p.x, y: p.y },
			dockingFee: p.dockingFee,
		})),
	})
})

export default app
