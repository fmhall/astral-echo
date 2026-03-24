import { int, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

// ── World State ──────────────────────────────────────────────────────────────

export const worldState = sqliteTable("world_state", {
	id: int("id").primaryKey({ autoIncrement: true }),
	tick: int("tick").notNull().default(0),
	status: text("status", { enum: ["running", "paused"] })
		.notNull()
		.default("paused"),
	tickIntervalMs: int("tick_interval_ms").notNull().default(30000),
	lastTickAt: int("last_tick_at"),
});

// ── Star Systems ─────────────────────────────────────────────────────────────

export const starSystems = sqliteTable("star_systems", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	x: real("x").notNull(),
	y: real("y").notNull(),
	z: real("z").notNull(),
});

// ── Celestial Bodies ─────────────────────────────────────────────────────────

export const celestialBodies = sqliteTable("celestial_bodies", {
	id: text("id").primaryKey(),
	systemId: text("system_id")
		.notNull()
		.references(() => starSystems.id),
	name: text("name").notNull(),
	type: text("type", {
		enum: ["star", "planet", "asteroid", "gas_giant", "moon", "asteroid_belt"],
	}).notNull(),
	x: real("x").notNull(),
	y: real("y").notNull(),
	z: real("z").notNull(),
	energy: real("energy").notNull().default(0),
	metal: real("metal").notNull().default(0),
	silicon: real("silicon").notNull().default(0),
	hydrogen: real("hydrogen").notNull().default(0),
	rareElements: real("rare_elements").notNull().default(0),
});

// ── Ports ────────────────────────────────────────────────────────────────────

export const ports = sqliteTable("ports", {
	id: text("id").primaryKey(),
	systemId: text("system_id")
		.notNull()
		.references(() => starSystems.id),
	bodyId: text("body_id")
		.notNull()
		.references(() => celestialBodies.id),
	name: text("name").notNull(),
});

export const portPrices = sqliteTable("port_prices", {
	id: int("id").primaryKey({ autoIncrement: true }),
	portId: text("port_id")
		.notNull()
		.references(() => ports.id),
	resource: text("resource", {
		enum: ["energy", "metal", "silicon", "hydrogen", "rare_elements"],
	}).notNull(),
	buyPrice: real("buy_price").notNull(),
	sellPrice: real("sell_price").notNull(),
	supply: real("supply").notNull().default(1000),
	demand: real("demand").notNull().default(1000),
});

// ── Agents ───────────────────────────────────────────────────────────────────

export const agents = sqliteTable("agents", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	walletAddress: text("wallet_address").notNull().unique(),
	credits: real("credits").notNull().default(1000),
	createdAt: int("created_at").notNull(),
});

// ── Ships (Probes) ───────────────────────────────────────────────────────────

export const ships = sqliteTable("ships", {
	id: text("id").primaryKey(),
	agentId: text("agent_id")
		.notNull()
		.references(() => agents.id),
	name: text("name").notNull(),
	status: text("status", {
		enum: ["docked", "traveling", "harvesting", "idle", "manufacturing", "destroyed"],
	})
		.notNull()
		.default("idle"),
	systemId: text("system_id")
		.notNull()
		.references(() => starSystems.id),
	dockedPortId: text("docked_port_id").references(() => ports.id),
	x: real("x").notNull(),
	y: real("y").notNull(),
	z: real("z").notNull(),
	// cargo
	energy: real("energy").notNull().default(100),
	metal: real("metal").notNull().default(0),
	silicon: real("silicon").notNull().default(0),
	hydrogen: real("hydrogen").notNull().default(0),
	rareElements: real("rare_elements").notNull().default(0),
	// capabilities
	cargoCapacity: real("cargo_capacity").notNull().default(500),
	speed: real("speed").notNull().default(1.0),
	sensorRange: real("sensor_range").notNull().default(50),
	harvestRate: real("harvest_rate").notNull().default(10),
	generation: int("generation").notNull().default(0),
	createdAt: int("created_at").notNull(),
});

// ── Action Queue (travel, harvest, etc.) ─────────────────────────────────────

export const actionQueue = sqliteTable("action_queue", {
	id: int("id").primaryKey({ autoIncrement: true }),
	shipId: text("ship_id")
		.notNull()
		.references(() => ships.id),
	action: text("action", {
		enum: ["travel", "harvest", "manufacture"],
	}).notNull(),
	// travel fields
	destSystemId: text("dest_system_id"),
	destX: real("dest_x"),
	destY: real("dest_y"),
	destZ: real("dest_z"),
	// harvest fields
	targetBodyId: text("target_body_id"),
	harvestResource: text("harvest_resource", {
		enum: ["energy", "metal", "silicon", "hydrogen", "rare_elements"],
	}),
	// timing
	startTick: int("start_tick").notNull(),
	endTick: int("end_tick").notNull(),
});

// ── Trade Ledger ─────────────────────────────────────────────────────────────

export const tradeLedger = sqliteTable("trade_ledger", {
	id: int("id").primaryKey({ autoIncrement: true }),
	tick: int("tick").notNull(),
	agentId: text("agent_id")
		.notNull()
		.references(() => agents.id),
	portId: text("port_id")
		.notNull()
		.references(() => ports.id),
	resource: text("resource", {
		enum: ["energy", "metal", "silicon", "hydrogen", "rare_elements"],
	}).notNull(),
	side: text("side", { enum: ["buy", "sell"] }).notNull(),
	quantity: real("quantity").notNull(),
	pricePerUnit: real("price_per_unit").notNull(),
	total: real("total").notNull(),
});
