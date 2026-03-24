import { Hono } from "hono"
import { eq } from "drizzle-orm"
import { db } from "../../db/index.js"
import {
	agents,
	goods,
	portDemands,
	portListings,
	ports,
} from "../../db/schema.js"
import { adminAuth } from "../middleware/admin.js"
import { updateWorldConfig } from "../../engine/world.js"
import { newId } from "../../utils/id.js"
import { z } from "zod"

const app = new Hono()

// All admin routes require bearer token
app.use("/*", adminAuth())

/** Create a port */
app.post("/ports", async (c) => {
	const body = z
		.object({
			name: z.string(),
			x: z.number(),
			y: z.number(),
			dockingFee: z.number().nonnegative().default(0),
			ownerId: z.string().nullable().default(null),
		})
		.safeParse(await c.req.json())

	if (!body.success) {
		return c.json({ error: "Invalid input", detail: body.error.message }, 400)
	}

	const port = { id: newId(), ...body.data }
	db.insert(ports).values(port).run()
	return c.json(port, 201)
})

/** Update a port */
app.patch("/ports/:id", async (c) => {
	const portId = c.req.param("id")
	const existing = db.select().from(ports).where(eq(ports.id, portId)).get()
	if (!existing) return c.json({ error: "Port not found" }, 404)

	const body = z
		.object({
			name: z.string().optional(),
			dockingFee: z.number().nonnegative().optional(),
			ownerId: z.string().nullable().optional(),
		})
		.safeParse(await c.req.json())

	if (!body.success) {
		return c.json({ error: "Invalid input", detail: body.error.message }, 400)
	}

	db.update(ports).set(body.data).where(eq(ports.id, portId)).run()
	return c.json({ ...existing, ...body.data })
})

/** Create a good */
app.post("/goods", async (c) => {
	const body = z
		.object({
			id: z.string(),
			name: z.string(),
			category: z.enum(["raw_material", "manufactured", "fuel", "luxury"]),
			basePrice: z.number().positive(),
			weight: z.number().positive(),
		})
		.safeParse(await c.req.json())

	if (!body.success) {
		return c.json({ error: "Invalid input", detail: body.error.message }, 400)
	}

	db.insert(goods)
		.values(body.data)
		.onConflictDoUpdate({ target: goods.id, set: body.data })
		.run()
	return c.json(body.data, 201)
})

/** Add/update a port listing (what the port sells) */
app.post("/ports/:id/listings", async (c) => {
	const portId = c.req.param("id")
	const body = z
		.object({
			goodId: z.string(),
			quantity: z.number().nonnegative(),
			maxQuantity: z.number().positive(),
			sellPrice: z.number().positive(),
			restockRate: z.number().nonnegative().default(0),
		})
		.safeParse(await c.req.json())

	if (!body.success) {
		return c.json({ error: "Invalid input", detail: body.error.message }, 400)
	}

	const values = { portId, ...body.data }
	db.insert(portListings)
		.values(values)
		.onConflictDoUpdate({
			target: [portListings.portId, portListings.goodId],
			set: body.data,
		})
		.run()
	return c.json(values, 201)
})

/** Add/update a port demand (what the port buys) */
app.post("/ports/:id/demands", async (c) => {
	const portId = c.req.param("id")
	const body = z
		.object({
			goodId: z.string(),
			buyPrice: z.number().positive(),
			quantityWanted: z.number().nonnegative(),
			maxQuantity: z.number().positive(),
			consumeRate: z.number().nonnegative().default(0),
		})
		.safeParse(await c.req.json())

	if (!body.success) {
		return c.json({ error: "Invalid input", detail: body.error.message }, 400)
	}

	const values = { portId, ...body.data }
	db.insert(portDemands)
		.values(values)
		.onConflictDoUpdate({
			target: [portDemands.portId, portDemands.goodId],
			set: body.data,
		})
		.run()
	return c.json(values, 201)
})

/** Update world config */
app.patch("/world", async (c) => {
	const body = await c.req.json()
	try {
		const config = updateWorldConfig(body as Record<string, unknown>)
		return c.json(config)
	} catch (e) {
		return c.json(
			{ error: e instanceof Error ? e.message : "Invalid config" },
			400,
		)
	}
})

/** Grant credits to an agent */
app.post("/grant", async (c) => {
	const body = z
		.object({
			agentId: z.string(),
			amount: z.number(),
		})
		.safeParse(await c.req.json())

	if (!body.success) {
		return c.json({ error: "Invalid input", detail: body.error.message }, 400)
	}

	const agent = db
		.select()
		.from(agents)
		.where(eq(agents.id, body.data.agentId))
		.get()
	if (!agent) return c.json({ error: "Agent not found" }, 404)

	db.update(agents)
		.set({ balance: agent.balance + body.data.amount })
		.where(eq(agents.id, body.data.agentId))
		.run()

	return c.json({ agentId: agent.id, newBalance: agent.balance + body.data.amount })
})

/** Seed the world (runs the seed script inline) */
app.post("/seed", async (c) => {
	const { seedWorld } = await import("../../db/seed.js")
	seedWorld()
	return c.json({ status: "seeded" })
})

export default app
