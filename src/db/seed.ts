import { db, initDb } from "./index.js"
import { goods, portDemands, portListings, ports, worldConfig } from "./schema.js"

/**
 * Seed the world with ports, goods, and market data.
 * Creates a rich trading network with natural arbitrage opportunities.
 */
export function seedWorld(): void {
	initDb()

	// ── World config ────────────────────────────────────────────────────────

	db.insert(worldConfig)
		.values({
			key: "world",
			value: {
				name: "Astral Echo",
				width: 1000,
				height: 1000,
				tickIntervalMs: 60_000,
				priceVolatility: 1.0,
				startingCredits: 10_000,
				dockingRadius: 15,
			} as unknown as Record<string, unknown>,
		})
		.onConflictDoUpdate({
			target: worldConfig.key,
			set: {
				value: {
					name: "Astral Echo",
					width: 1000,
					height: 1000,
					tickIntervalMs: 60_000,
					priceVolatility: 1.0,
					startingCredits: 10_000,
					dockingRadius: 15,
				} as unknown as Record<string, unknown>,
			},
		})
		.run()

	// ── Goods ───────────────────────────────────────────────────────────────

	const goodsData = [
		{ id: "iron_ore", name: "Iron Ore", category: "raw_material", basePrice: 10, weight: 2 },
		{ id: "silicon", name: "Silicon", category: "raw_material", basePrice: 12, weight: 1.5 },
		{ id: "food", name: "Food", category: "raw_material", basePrice: 8, weight: 1 },
		{ id: "fuel_cells", name: "Fuel Cells", category: "fuel", basePrice: 15, weight: 3 },
		{ id: "steel", name: "Steel", category: "manufactured", basePrice: 35, weight: 3 },
		{ id: "electronics", name: "Electronics", category: "manufactured", basePrice: 50, weight: 0.5 },
		{ id: "ship_parts", name: "Ship Parts", category: "manufactured", basePrice: 80, weight: 4 },
		{ id: "medicine", name: "Medicine", category: "manufactured", basePrice: 45, weight: 0.3 },
		{ id: "rare_crystals", name: "Rare Crystals", category: "luxury", basePrice: 120, weight: 0.2 },
		{ id: "dark_matter", name: "Dark Matter", category: "luxury", basePrice: 250, weight: 0.1 },
	] as const

	for (const g of goodsData) {
		db.insert(goods)
			.values(g)
			.onConflictDoUpdate({ target: goods.id, set: g })
			.run()
	}

	// ── Ports ───────────────────────────────────────────────────────────────
	// Layout designed for interesting trade routes across a 1000x1000 world

	const portsData = [
		{ id: "iron_haven", name: "Iron Haven", x: 120, y: 300, ownerId: null, dockingFee: 5 },
		{ id: "silica_shores", name: "Silica Shores", x: 350, y: 150, ownerId: null, dockingFee: 5 },
		{ id: "verdant_bay", name: "Verdant Bay", x: 100, y: 600, ownerId: null, dockingFee: 3 },
		{ id: "forge_city", name: "Forge City", x: 400, y: 400, ownerId: null, dockingFee: 10 },
		{ id: "crystal_cove", name: "Crystal Cove", x: 750, y: 200, ownerId: null, dockingFee: 15 },
		{ id: "fuel_depot", name: "Fuel Depot Alpha", x: 200, y: 450, ownerId: null, dockingFee: 2 },
		{ id: "the_bazaar", name: "The Bazaar", x: 500, y: 500, ownerId: null, dockingFee: 20 },
		{ id: "deepwater", name: "Deepwater Station", x: 850, y: 700, ownerId: null, dockingFee: 8 },
		{ id: "nova_landing", name: "Nova Landing", x: 600, y: 300, ownerId: null, dockingFee: 12 },
		{ id: "twilight_reach", name: "Twilight Reach", x: 900, y: 900, ownerId: null, dockingFee: 25 },
	] as const

	for (const p of portsData) {
		db.insert(ports)
			.values(p)
			.onConflictDoUpdate({ target: ports.id, set: p })
			.run()
	}

	// ── Port listings (what ports sell) ─────────────────────────────────────
	// Each port specializes in producing certain goods cheaply

	const listingsData = [
		// Iron Haven — cheap iron ore, some fuel
		{ portId: "iron_haven", goodId: "iron_ore", quantity: 500, maxQuantity: 500, sellPrice: 8, restockRate: 10 },
		{ portId: "iron_haven", goodId: "fuel_cells", quantity: 100, maxQuantity: 100, sellPrice: 18, restockRate: 2 },

		// Silica Shores — cheap silicon
		{ portId: "silica_shores", goodId: "silicon", quantity: 400, maxQuantity: 400, sellPrice: 9, restockRate: 8 },
		{ portId: "silica_shores", goodId: "fuel_cells", quantity: 80, maxQuantity: 80, sellPrice: 17, restockRate: 2 },

		// Verdant Bay — cheap food and medicine
		{ portId: "verdant_bay", goodId: "food", quantity: 600, maxQuantity: 600, sellPrice: 5, restockRate: 15 },
		{ portId: "verdant_bay", goodId: "medicine", quantity: 100, maxQuantity: 100, sellPrice: 30, restockRate: 3 },
		{ portId: "verdant_bay", goodId: "fuel_cells", quantity: 50, maxQuantity: 50, sellPrice: 20, restockRate: 1 },

		// Forge City — sells manufactured goods (steel, electronics)
		{ portId: "forge_city", goodId: "steel", quantity: 200, maxQuantity: 200, sellPrice: 30, restockRate: 5 },
		{ portId: "forge_city", goodId: "electronics", quantity: 100, maxQuantity: 100, sellPrice: 45, restockRate: 3 },
		{ portId: "forge_city", goodId: "fuel_cells", quantity: 60, maxQuantity: 60, sellPrice: 16, restockRate: 2 },

		// Crystal Cove — luxury goods
		{ portId: "crystal_cove", goodId: "rare_crystals", quantity: 30, maxQuantity: 30, sellPrice: 100, restockRate: 1 },
		{ portId: "crystal_cove", goodId: "fuel_cells", quantity: 40, maxQuantity: 40, sellPrice: 22, restockRate: 1 },

		// Fuel Depot Alpha — cheapest fuel
		{ portId: "fuel_depot", goodId: "fuel_cells", quantity: 800, maxQuantity: 800, sellPrice: 10, restockRate: 20 },

		// The Bazaar — everything but expensive
		{ portId: "the_bazaar", goodId: "iron_ore", quantity: 50, maxQuantity: 100, sellPrice: 15, restockRate: 1 },
		{ portId: "the_bazaar", goodId: "silicon", quantity: 50, maxQuantity: 100, sellPrice: 18, restockRate: 1 },
		{ portId: "the_bazaar", goodId: "food", quantity: 100, maxQuantity: 200, sellPrice: 12, restockRate: 2 },
		{ portId: "the_bazaar", goodId: "steel", quantity: 30, maxQuantity: 60, sellPrice: 42, restockRate: 1 },
		{ portId: "the_bazaar", goodId: "electronics", quantity: 20, maxQuantity: 40, sellPrice: 60, restockRate: 1 },
		{ portId: "the_bazaar", goodId: "fuel_cells", quantity: 200, maxQuantity: 200, sellPrice: 18, restockRate: 3 },
		{ portId: "the_bazaar", goodId: "medicine", quantity: 30, maxQuantity: 50, sellPrice: 55, restockRate: 1 },
		{ portId: "the_bazaar", goodId: "rare_crystals", quantity: 5, maxQuantity: 10, sellPrice: 150, restockRate: 0.2 },

		// Nova Landing — ship parts
		{ portId: "nova_landing", goodId: "ship_parts", quantity: 50, maxQuantity: 50, sellPrice: 70, restockRate: 2 },
		{ portId: "nova_landing", goodId: "fuel_cells", quantity: 100, maxQuantity: 100, sellPrice: 16, restockRate: 3 },

		// Deepwater Station — remote outpost, some of everything at high prices
		{ portId: "deepwater", goodId: "food", quantity: 30, maxQuantity: 50, sellPrice: 15, restockRate: 0.5 },
		{ portId: "deepwater", goodId: "fuel_cells", quantity: 50, maxQuantity: 50, sellPrice: 25, restockRate: 1 },
		{ portId: "deepwater", goodId: "medicine", quantity: 10, maxQuantity: 20, sellPrice: 60, restockRate: 0.3 },

		// Twilight Reach — dark matter source, very expensive fuel
		{ portId: "twilight_reach", goodId: "dark_matter", quantity: 10, maxQuantity: 10, sellPrice: 200, restockRate: 0.3 },
		{ portId: "twilight_reach", goodId: "fuel_cells", quantity: 30, maxQuantity: 30, sellPrice: 30, restockRate: 0.5 },
	]

	for (const l of listingsData) {
		db.insert(portListings)
			.values(l)
			.onConflictDoUpdate({
				target: [portListings.portId, portListings.goodId],
				set: l,
			})
			.run()
	}

	// ── Port demands (what ports buy from agents) ───────────────────────────
	// Prices are higher than source sell prices → arbitrage opportunity

	const demandsData = [
		// Forge City buys raw materials at premium
		{ portId: "forge_city", goodId: "iron_ore", buyPrice: 14, quantityWanted: 300, maxQuantity: 300, consumeRate: 8 },
		{ portId: "forge_city", goodId: "silicon", buyPrice: 16, quantityWanted: 200, maxQuantity: 200, consumeRate: 5 },

		// Crystal Cove buys food and fuel (remote, needs supply)
		{ portId: "crystal_cove", goodId: "food", buyPrice: 12, quantityWanted: 100, maxQuantity: 100, consumeRate: 3 },
		{ portId: "crystal_cove", goodId: "steel", buyPrice: 40, quantityWanted: 50, maxQuantity: 50, consumeRate: 1 },

		// The Bazaar buys everything (hub market)
		{ portId: "the_bazaar", goodId: "iron_ore", buyPrice: 12, quantityWanted: 200, maxQuantity: 200, consumeRate: 5 },
		{ portId: "the_bazaar", goodId: "silicon", buyPrice: 14, quantityWanted: 150, maxQuantity: 150, consumeRate: 4 },
		{ portId: "the_bazaar", goodId: "food", buyPrice: 10, quantityWanted: 300, maxQuantity: 300, consumeRate: 8 },
		{ portId: "the_bazaar", goodId: "steel", buyPrice: 38, quantityWanted: 100, maxQuantity: 100, consumeRate: 3 },
		{ portId: "the_bazaar", goodId: "electronics", buyPrice: 55, quantityWanted: 60, maxQuantity: 60, consumeRate: 2 },
		{ portId: "the_bazaar", goodId: "rare_crystals", buyPrice: 130, quantityWanted: 20, maxQuantity: 20, consumeRate: 0.5 },
		{ portId: "the_bazaar", goodId: "dark_matter", buyPrice: 280, quantityWanted: 10, maxQuantity: 10, consumeRate: 0.2 },

		// Deepwater Station pays premium for everything (remote)
		{ portId: "deepwater", goodId: "iron_ore", buyPrice: 16, quantityWanted: 50, maxQuantity: 50, consumeRate: 1 },
		{ portId: "deepwater", goodId: "steel", buyPrice: 45, quantityWanted: 30, maxQuantity: 30, consumeRate: 0.5 },
		{ portId: "deepwater", goodId: "electronics", buyPrice: 65, quantityWanted: 20, maxQuantity: 20, consumeRate: 0.3 },
		{ portId: "deepwater", goodId: "ship_parts", buyPrice: 100, quantityWanted: 10, maxQuantity: 10, consumeRate: 0.2 },

		// Twilight Reach — needs supplies badly (edge of the map)
		{ portId: "twilight_reach", goodId: "food", buyPrice: 18, quantityWanted: 80, maxQuantity: 80, consumeRate: 2 },
		{ portId: "twilight_reach", goodId: "fuel_cells", buyPrice: 22, quantityWanted: 50, maxQuantity: 50, consumeRate: 1 },
		{ portId: "twilight_reach", goodId: "medicine", buyPrice: 60, quantityWanted: 20, maxQuantity: 20, consumeRate: 0.5 },
		{ portId: "twilight_reach", goodId: "electronics", buyPrice: 70, quantityWanted: 15, maxQuantity: 15, consumeRate: 0.3 },

		// Nova Landing buys raw materials for ship manufacturing
		{ portId: "nova_landing", goodId: "iron_ore", buyPrice: 13, quantityWanted: 100, maxQuantity: 100, consumeRate: 3 },
		{ portId: "nova_landing", goodId: "silicon", buyPrice: 15, quantityWanted: 80, maxQuantity: 80, consumeRate: 2 },
		{ portId: "nova_landing", goodId: "steel", buyPrice: 38, quantityWanted: 60, maxQuantity: 60, consumeRate: 2 },

		// Fuel Depot buys food (workers need to eat)
		{ portId: "fuel_depot", goodId: "food", buyPrice: 9, quantityWanted: 100, maxQuantity: 100, consumeRate: 3 },

		// Iron Haven buys food and electronics
		{ portId: "iron_haven", goodId: "food", buyPrice: 10, quantityWanted: 80, maxQuantity: 80, consumeRate: 2 },
		{ portId: "iron_haven", goodId: "electronics", buyPrice: 55, quantityWanted: 20, maxQuantity: 20, consumeRate: 0.5 },

		// Silica Shores buys food
		{ portId: "silica_shores", goodId: "food", buyPrice: 10, quantityWanted: 80, maxQuantity: 80, consumeRate: 2 },
	]

	for (const d of demandsData) {
		db.insert(portDemands)
			.values(d)
			.onConflictDoUpdate({
				target: [portDemands.portId, portDemands.goodId],
				set: d,
			})
			.run()
	}

	console.log("World seeded:")
	console.log(`  ${goodsData.length} goods`)
	console.log(`  ${portsData.length} ports`)
	console.log(`  ${listingsData.length} port listings`)
	console.log(`  ${demandsData.length} port demands`)
}

// Allow running directly: bun run src/db/seed.ts
if (import.meta.main) {
	seedWorld()
}
