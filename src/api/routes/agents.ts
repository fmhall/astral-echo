import { Hono } from "hono"
import { eq } from "drizzle-orm"
import { db } from "../../db/index.js"
import { agents } from "../../db/schema.js"
import { RegisterAgentInput } from "../../types/index.js"
import { getWallet, x402 } from "../middleware/payment.js"
import { getAgent } from "../middleware/identity.js"
import { getWorldConfig } from "../../engine/world.js"
import { newId } from "../../utils/id.js"
import { emit } from "../../engine/events.js"
import { PriceTier } from "../../types/index.js"

const app = new Hono()

/** Register a new agent (idempotent — returns existing if wallet already registered) */
app.post("/", x402(PriceTier.commission), async (c) => {
	const wallet = getWallet(c)
	const body = RegisterAgentInput.safeParse(await c.req.json())
	if (!body.success) {
		return c.json({ error: "Invalid input", detail: body.error.message }, 400)
	}

	// Check if already registered
	const existing = db
		.select()
		.from(agents)
		.where(eq(agents.walletAddress, wallet))
		.get()
	if (existing) {
		return c.json(existing)
	}

	const config = getWorldConfig()
	const agent = {
		id: newId(),
		walletAddress: wallet,
		name: body.data.name,
		balance: config.startingCredits,
		createdAt: Date.now(),
	}

	db.insert(agents).values(agent).run()
	emit("agent_registered", { agentId: agent.id, name: agent.name })

	return c.json(agent, 201)
})

/** Get current agent profile */
app.get("/me", x402(PriceTier.observe), (c) => {
	const agent = getAgent(c)
	if (!agent) {
		return c.json({ error: "Not registered. POST /agents first." }, 403)
	}
	return c.json(agent)
})

export default app
