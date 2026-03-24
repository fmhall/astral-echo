import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core"

// ── Agents ──────────────────────────────────────────────────────────────────

export const agents = sqliteTable("agents", {
	id: text("id").primaryKey(),
	walletAddress: text("wallet_address").notNull().unique(),
	name: text("name").notNull(),
	balance: real("balance").notNull().default(0),
	createdAt: integer("created_at", { mode: "number" }).notNull(),
})

// ── Goods ───────────────────────────────────────────────────────────────────

export const goods = sqliteTable("goods", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	category: text("category").notNull(), // raw_material | manufactured | fuel | luxury
	basePrice: real("base_price").notNull(),
	weight: real("weight").notNull(),
})

// ── Ports ───────────────────────────────────────────────────────────────────

export const ports = sqliteTable("ports", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	x: real("x").notNull(),
	y: real("y").notNull(),
	ownerId: text("owner_id").references(() => agents.id),
	dockingFee: real("docking_fee").notNull().default(0),
})

// ── Port listings (what ports sell) ─────────────────────────────────────────

export const portListings = sqliteTable("port_listings", {
	portId: text("port_id")
		.notNull()
		.references(() => ports.id),
	goodId: text("good_id")
		.notNull()
		.references(() => goods.id),
	quantity: real("quantity").notNull().default(0),
	maxQuantity: real("max_quantity").notNull(),
	sellPrice: real("sell_price").notNull(),
	restockRate: real("restock_rate").notNull().default(0),
})

// ── Port demands (what ports buy) ───────────────────────────────────────────

export const portDemands = sqliteTable("port_demands", {
	portId: text("port_id")
		.notNull()
		.references(() => ports.id),
	goodId: text("good_id")
		.notNull()
		.references(() => goods.id),
	buyPrice: real("buy_price").notNull(),
	quantityWanted: real("quantity_wanted").notNull().default(0),
	maxQuantity: real("max_quantity").notNull(),
	consumeRate: real("consume_rate").notNull().default(0),
})

// ── Ships ───────────────────────────────────────────────────────────────────

export const ships = sqliteTable("ships", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	ownerId: text("owner_id")
		.notNull()
		.references(() => agents.id),
	shipClass: text("ship_class").notNull(), // scout | clipper | freighter
	x: real("x").notNull(),
	y: real("y").notNull(),
	destinationX: real("destination_x"),
	destinationY: real("destination_y"),
	departedAt: integer("departed_at", { mode: "number" }),
	speed: real("speed").notNull(),
	fuel: real("fuel").notNull(),
	fuelCapacity: real("fuel_capacity").notNull(),
	cargoCapacity: real("cargo_capacity").notNull(),
	status: text("status").notNull().default("docked"), // docked | sailing | idle
	dockedAtPortId: text("docked_at_port_id").references(() => ports.id),
})

// ── Ship cargo ──────────────────────────────────────────────────────────────

export const shipCargo = sqliteTable("ship_cargo", {
	shipId: text("ship_id")
		.notNull()
		.references(() => ships.id),
	goodId: text("good_id")
		.notNull()
		.references(() => goods.id),
	quantity: real("quantity").notNull(),
})

// ── Trades (immutable log) ──────────────────────────────────────────────────

export const trades = sqliteTable("trades", {
	id: text("id").primaryKey(),
	agentId: text("agent_id")
		.notNull()
		.references(() => agents.id),
	shipId: text("ship_id")
		.notNull()
		.references(() => ships.id),
	portId: text("port_id")
		.notNull()
		.references(() => ports.id),
	goodId: text("good_id")
		.notNull()
		.references(() => goods.id),
	direction: text("direction").notNull(), // buy | sell
	quantity: real("quantity").notNull(),
	pricePerUnit: real("price_per_unit").notNull(),
	total: real("total").notNull(),
	timestamp: integer("timestamp", { mode: "number" }).notNull(),
})

// ── World events (SSE log) ──────────────────────────────────────────────────

export const worldEvents = sqliteTable("world_events", {
	id: text("id").primaryKey(),
	kind: text("kind").notNull(),
	data: text("data", { mode: "json" }).notNull(),
	timestamp: integer("timestamp", { mode: "number" }).notNull(),
})

// ── World config (single-row) ───────────────────────────────────────────────

export const worldConfig = sqliteTable("world_config", {
	key: text("key").primaryKey(),
	value: text("value", { mode: "json" }).notNull(),
})
