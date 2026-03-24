import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "./migrate.js";
import * as schema from "./schema.js";

/** Seed the galaxy with initial star systems, bodies, and ports. */
function seed() {
	migrate();

	const sqlite = new Database("astral-echo.db");
	sqlite.exec("PRAGMA foreign_keys = ON");
	const db = drizzle(sqlite, { schema });

	// Check if already seeded
	const existing = db.select().from(schema.starSystems).all();
	if (existing.length > 0) {
		console.log("Already seeded. Delete astral-echo.db to re-seed.");
		sqlite.close();
		return;
	}

	// ── Insert world state ───────────────────────────────────────────────────
	db.insert(schema.worldState).values({ tick: 0, status: "paused", tickIntervalMs: 30000 }).run();

	// ── Star Systems ─────────────────────────────────────────────────────────
	const systems = [
		{ id: "sol-prime", name: "Sol Prime", x: 0, y: 0, z: 0 },
		{ id: "kepler-haven", name: "Kepler Haven", x: 120, y: 45, z: -30 },
		{ id: "proxima-drift", name: "Proxima Drift", x: -80, y: 60, z: 20 },
		{ id: "vega-terminus", name: "Vega Terminus", x: 200, y: -100, z: 50 },
	];
	db.insert(schema.starSystems).values(systems).run();

	// ── Celestial Bodies ─────────────────────────────────────────────────────
	const bodies = [
		// Sol Prime
		{
			id: "sol-star",
			systemId: "sol-prime",
			name: "Sol",
			type: "star" as const,
			x: 0,
			y: 0,
			z: 0,
			energy: 999999,
			metal: 0,
			silicon: 0,
			hydrogen: 999999,
			rareElements: 0,
		},
		{
			id: "terra-nova",
			systemId: "sol-prime",
			name: "Terra Nova",
			type: "planet" as const,
			x: 10,
			y: 0,
			z: 0,
			energy: 0,
			metal: 5000,
			silicon: 8000,
			hydrogen: 2000,
			rareElements: 500,
		},
		{
			id: "iron-belt",
			systemId: "sol-prime",
			name: "Iron Belt",
			type: "asteroid_belt" as const,
			x: 20,
			y: 5,
			z: -2,
			energy: 0,
			metal: 50000,
			silicon: 3000,
			hydrogen: 0,
			rareElements: 2000,
		},
		{
			id: "helios-giant",
			systemId: "sol-prime",
			name: "Helios Giant",
			type: "gas_giant" as const,
			x: 40,
			y: -10,
			z: 5,
			energy: 0,
			metal: 0,
			silicon: 0,
			hydrogen: 100000,
			rareElements: 800,
		},
		// Kepler Haven
		{
			id: "kepler-star",
			systemId: "kepler-haven",
			name: "Kepler",
			type: "star" as const,
			x: 120,
			y: 45,
			z: -30,
			energy: 999999,
			metal: 0,
			silicon: 0,
			hydrogen: 999999,
			rareElements: 0,
		},
		{
			id: "silicon-shores",
			systemId: "kepler-haven",
			name: "Silicon Shores",
			type: "planet" as const,
			x: 130,
			y: 48,
			z: -28,
			energy: 0,
			metal: 2000,
			silicon: 40000,
			hydrogen: 1000,
			rareElements: 300,
		},
		{
			id: "kepler-moon-alpha",
			systemId: "kepler-haven",
			name: "Kepler Moon Alpha",
			type: "moon" as const,
			x: 132,
			y: 49,
			z: -27,
			energy: 0,
			metal: 3000,
			silicon: 1000,
			hydrogen: 500,
			rareElements: 5000,
		},
		// Proxima Drift
		{
			id: "proxima-star",
			systemId: "proxima-drift",
			name: "Proxima",
			type: "star" as const,
			x: -80,
			y: 60,
			z: 20,
			energy: 999999,
			metal: 0,
			silicon: 0,
			hydrogen: 999999,
			rareElements: 0,
		},
		{
			id: "drift-rock",
			systemId: "proxima-drift",
			name: "Drift Rock",
			type: "asteroid" as const,
			x: -70,
			y: 65,
			z: 22,
			energy: 0,
			metal: 20000,
			silicon: 5000,
			hydrogen: 0,
			rareElements: 10000,
		},
		{
			id: "frost-giant",
			systemId: "proxima-drift",
			name: "Frost Giant",
			type: "gas_giant" as const,
			x: -60,
			y: 55,
			z: 18,
			energy: 0,
			metal: 0,
			silicon: 0,
			hydrogen: 80000,
			rareElements: 400,
		},
		// Vega Terminus
		{
			id: "vega-star",
			systemId: "vega-terminus",
			name: "Vega",
			type: "star" as const,
			x: 200,
			y: -100,
			z: 50,
			energy: 999999,
			metal: 0,
			silicon: 0,
			hydrogen: 999999,
			rareElements: 0,
		},
		{
			id: "terminus-prime",
			systemId: "vega-terminus",
			name: "Terminus Prime",
			type: "planet" as const,
			x: 210,
			y: -95,
			z: 52,
			energy: 0,
			metal: 10000,
			silicon: 10000,
			hydrogen: 5000,
			rareElements: 3000,
		},
	];
	db.insert(schema.celestialBodies).values(bodies).run();

	// ── Ports ────────────────────────────────────────────────────────────────
	const portsData = [
		{ id: "port-terra", systemId: "sol-prime", bodyId: "terra-nova", name: "Terra Nova Station" },
		{
			id: "port-silicon",
			systemId: "kepler-haven",
			bodyId: "silicon-shores",
			name: "Silicon Shores Dock",
		},
		{
			id: "port-drift",
			systemId: "proxima-drift",
			bodyId: "drift-rock",
			name: "Drift Rock Outpost",
		},
		{
			id: "port-terminus",
			systemId: "vega-terminus",
			bodyId: "terminus-prime",
			name: "Terminus Exchange",
		},
	];
	db.insert(schema.ports).values(portsData).run();

	// ── Port Prices (base prices with spread) ────────────────────────────────
	const baseResourcePrices: Record<string, { buy: number; sell: number }> = {
		energy: { buy: 1.0, sell: 0.8 },
		metal: { buy: 3.0, sell: 2.4 },
		silicon: { buy: 4.0, sell: 3.2 },
		hydrogen: { buy: 1.5, sell: 1.2 },
		rare_elements: { buy: 15.0, sell: 12.0 },
	};

	const priceRows = portsData.flatMap((port) =>
		Object.entries(baseResourcePrices).map(([resource, prices]) => {
			// Vary prices per port to create trade routes
			const variance = 0.7 + Math.random() * 0.6; // 0.7 - 1.3x
			return {
				portId: port.id,
				resource: resource as "energy" | "metal" | "silicon" | "hydrogen" | "rare_elements",
				buyPrice: Math.round(prices.buy * variance * 100) / 100,
				sellPrice: Math.round(prices.sell * variance * 100) / 100,
				supply: 500 + Math.floor(Math.random() * 1000),
				demand: 500 + Math.floor(Math.random() * 1000),
			};
		}),
	);
	db.insert(schema.portPrices).values(priceRows).run();

	sqlite.close();
	console.log(
		`Seeded: ${systems.length} systems, ${bodies.length} bodies, ${portsData.length} ports`,
	);
}

seed();
