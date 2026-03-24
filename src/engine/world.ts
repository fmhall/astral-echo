import { eq } from "drizzle-orm"
import { db } from "../db/index.js"
import { worldConfig } from "../db/schema.js"
import type { WorldConfig } from "../types/index.js"
import { WorldConfigSchema } from "../types/index.js"

const CONFIG_KEY = "world"

/** Get world config, falling back to defaults */
export function getWorldConfig(): WorldConfig {
	const row = db.select().from(worldConfig).where(eq(worldConfig.key, CONFIG_KEY)).get()
	if (!row) return WorldConfigSchema.parse({})
	return WorldConfigSchema.parse(row.value)
}

/** Update world config (partial merge) */
export function updateWorldConfig(partial: Partial<WorldConfig>): WorldConfig {
	const current = getWorldConfig()
	const merged = { ...current, ...partial }
	const validated = WorldConfigSchema.parse(merged)

	db.insert(worldConfig)
		.values({ key: CONFIG_KEY, value: validated as unknown as Record<string, unknown> })
		.onConflictDoUpdate({
			target: worldConfig.key,
			set: { value: validated as unknown as Record<string, unknown> },
		})
		.run()

	return validated
}
