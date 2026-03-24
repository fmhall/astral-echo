import { eq } from "drizzle-orm";
import type { DB } from "../db/index.js";
import { portPrices } from "../db/schema.js";

/**
 * After each trade, nudge supply/demand and recompute prices.
 * Simple model: price = baseFactor * (demand / supply).
 */
export function updatePortPrice(
	db: DB,
	portPriceId: number,
	quantityTraded: number,
	side: "buy" | "sell",
) {
	const row = db.select().from(portPrices).where(eq(portPrices.id, portPriceId)).get();
	if (!row) return;

	let { supply, demand, buyPrice, sellPrice } = row;

	if (side === "buy") {
		// Agent bought → supply decreases, demand signal increases
		supply = Math.max(10, supply - quantityTraded);
		demand = demand + quantityTraded * 0.5;
	} else {
		// Agent sold → supply increases, demand signal decreases
		supply = supply + quantityTraded;
		demand = Math.max(10, demand - quantityTraded * 0.3);
	}

	// Price follows demand/supply ratio
	const ratio = demand / supply;
	const baseBuy = row.buyPrice; // keep original as anchor
	buyPrice = Math.max(0.01, Math.round(baseBuy * ratio * 100) / 100);
	sellPrice = Math.round(buyPrice * 0.8 * 100) / 100; // 20% spread

	db.update(portPrices)
		.set({ supply, demand, buyPrice, sellPrice })
		.where(eq(portPrices.id, portPriceId))
		.run();
}

/**
 * Drift prices slightly each tick to simulate organic market movement.
 * Supply regenerates slowly, demand drifts toward baseline.
 */
export function tickPrices(db: DB) {
	const rows = db.select().from(portPrices).all();
	for (const row of rows) {
		let { supply, demand } = row;

		// Supply regenerates slightly each tick
		supply = supply + 5;
		// Demand drifts toward 1000 (baseline)
		demand = demand + (1000 - demand) * 0.02;

		const ratio = demand / supply;
		const buyPrice = Math.max(0.01, Math.round(row.buyPrice * ratio * 100) / 100);
		const sellPrice = Math.round(buyPrice * 0.8 * 100) / 100;

		db.update(portPrices)
			.set({ supply, demand, buyPrice, sellPrice })
			.where(eq(portPrices.id, row.id))
			.run();
	}
}
