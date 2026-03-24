import type { Context } from "hono"
import { eq } from "drizzle-orm"
import { db } from "../../db/index.js"
import { agents } from "../../db/schema.js"

/**
 * Resolve an agent from the wallet address set by the payment middleware.
 * Returns null if the agent hasn't registered yet.
 */
export function getAgent(c: Context): { id: string; walletAddress: string; name: string; balance: number } | null {
	const wallet = c.get("walletAddress") as string | undefined
	if (!wallet) return null

	const agent = db
		.select()
		.from(agents)
		.where(eq(agents.walletAddress, wallet))
		.get()

	return agent ?? null
}

/**
 * Require an agent to be registered. Returns 403 if not found.
 */
export function requireAgent(c: Context): { id: string; walletAddress: string; name: string; balance: number } {
	const agent = getAgent(c)
	if (!agent) {
		throw new Error("Agent not registered. POST /agents first.")
	}
	return agent
}
