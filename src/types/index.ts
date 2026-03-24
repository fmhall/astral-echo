import { z } from "zod"

// ── Primitives ──────────────────────────────────────────────────────────────

export const PositionSchema = z.object({
	x: z.number().describe("X coordinate in world units"),
	y: z.number().describe("Y coordinate in world units"),
})
export type Position = z.infer<typeof PositionSchema>

export const ResourceKind = z.enum([
	"raw_material",
	"manufactured",
	"fuel",
	"luxury",
])
export type ResourceKind = z.infer<typeof ResourceKind>

export const ShipClass = z.enum(["scout", "clipper", "freighter"])
export type ShipClass = z.infer<typeof ShipClass>

export const ShipStatus = z.enum(["docked", "sailing", "idle"])
export type ShipStatus = z.infer<typeof ShipStatus>

// ── Ship class stats (immutable reference) ──────────────────────────────────

export interface ShipClassStats {
	speed: number
	cargoCapacity: number
	fuelCapacity: number
	fuelPerDistance: number
	commissionCost: number
}

export const SHIP_CLASSES: Record<ShipClass, ShipClassStats> = {
	scout: {
		speed: 10,
		cargoCapacity: 50,
		fuelCapacity: 100,
		fuelPerDistance: 0.5,
		commissionCost: 500,
	},
	clipper: {
		speed: 6,
		cargoCapacity: 200,
		fuelCapacity: 200,
		fuelPerDistance: 1.0,
		commissionCost: 2000,
	},
	freighter: {
		speed: 3,
		cargoCapacity: 500,
		fuelCapacity: 300,
		fuelPerDistance: 1.5,
		commissionCost: 5000,
	},
}

// ── x402 pricing tiers (USD) ────────────────────────────────────────────────

export const PriceTier = {
	observe: 0.0001,
	act: 0.001,
	trade: 0.01,
	commission: 0.05,
} as const

// ── Agent ───────────────────────────────────────────────────────────────────

export const AgentSchema = z.object({
	id: z.string().describe("Unique agent ID (derived from wallet address)"),
	walletAddress: z.string().describe("x402 wallet address — the agent's identity"),
	name: z.string().max(64).describe("Display name"),
	balance: z.number().describe("In-game credits"),
	createdAt: z.number().describe("Unix timestamp ms"),
})
export type Agent = z.infer<typeof AgentSchema>

export const RegisterAgentInput = z.object({
	name: z.string().min(1).max(64).describe("Display name for this agent"),
})

// ── Good ────────────────────────────────────────────────────────────────────

export const GoodSchema = z.object({
	id: z.string(),
	name: z.string(),
	category: ResourceKind,
	basePrice: z.number().positive().describe("Reference price in credits"),
	weight: z.number().positive().describe("Cargo weight per unit"),
})
export type Good = z.infer<typeof GoodSchema>

// ── Port ────────────────────────────────────────────────────────────────────

export const PortSchema = z.object({
	id: z.string(),
	name: z.string(),
	position: PositionSchema,
	ownerId: z.string().nullable().describe("Agent who owns this port, or null"),
	dockingFee: z.number().nonnegative().describe("Credits charged to dock"),
})
export type Port = z.infer<typeof PortSchema>

/** What a port sells to ships */
export const PortListingSchema = z.object({
	portId: z.string(),
	goodId: z.string(),
	quantity: z.number().nonnegative(),
	maxQuantity: z.number().positive(),
	sellPrice: z.number().positive().describe("Price the port sells at"),
	restockRate: z.number().nonnegative().describe("Units restored per tick"),
})
export type PortListing = z.infer<typeof PortListingSchema>

/** What a port buys from ships */
export const PortDemandSchema = z.object({
	portId: z.string(),
	goodId: z.string(),
	buyPrice: z.number().positive().describe("Price the port pays per unit"),
	quantityWanted: z.number().nonnegative(),
	maxQuantity: z.number().positive(),
	consumeRate: z.number().nonnegative().describe("Units consumed per tick"),
})
export type PortDemand = z.infer<typeof PortDemandSchema>

// ── Ship ────────────────────────────────────────────────────────────────────

export const ShipSchema = z.object({
	id: z.string(),
	name: z.string().max(64),
	ownerId: z.string(),
	shipClass: ShipClass,
	// current / origin position
	x: z.number(),
	y: z.number(),
	// navigation (null when not sailing)
	destinationX: z.number().nullable(),
	destinationY: z.number().nullable(),
	departedAt: z.number().nullable().describe("Unix ms when sailing started"),
	speed: z.number().positive(),
	// resources
	fuel: z.number().nonnegative(),
	fuelCapacity: z.number().positive(),
	cargoCapacity: z.number().positive(),
	// state
	status: ShipStatus,
	dockedAtPortId: z.string().nullable(),
})
export type Ship = z.infer<typeof ShipSchema>

export const ShipCargoSchema = z.object({
	shipId: z.string(),
	goodId: z.string(),
	quantity: z.number().positive(),
})
export type ShipCargo = z.infer<typeof ShipCargoSchema>

// ── Trade ───────────────────────────────────────────────────────────────────

export const TradeDirection = z.enum(["buy", "sell"])
export type TradeDirection = z.infer<typeof TradeDirection>

export const TradeSchema = z.object({
	id: z.string(),
	agentId: z.string(),
	shipId: z.string(),
	portId: z.string(),
	goodId: z.string(),
	direction: TradeDirection,
	quantity: z.number().positive(),
	pricePerUnit: z.number().positive(),
	total: z.number(),
	timestamp: z.number(),
})
export type Trade = z.infer<typeof TradeSchema>

// ── World Config ────────────────────────────────────────────────────────────

export const WorldConfigSchema = z.object({
	name: z.string().default("Astral Echo"),
	width: z.number().positive().default(1000),
	height: z.number().positive().default(1000),
	tickIntervalMs: z.number().positive().default(60_000),
	priceVolatility: z.number().min(0).max(5).default(1.0),
	startingCredits: z.number().nonnegative().default(10_000),
	dockingRadius: z.number().positive().default(15),
})
export type WorldConfig = z.infer<typeof WorldConfigSchema>

// ── World Events (SSE) ─────────────────────────────────────────────────────

export const WorldEventKind = z.enum([
	"ship_departed",
	"ship_arrived",
	"ship_docked",
	"ship_undocked",
	"trade_completed",
	"agent_registered",
	"ship_commissioned",
	"market_update",
	"world_tick",
])
export type WorldEventKind = z.infer<typeof WorldEventKind>

export const WorldEventSchema = z.object({
	id: z.string(),
	kind: WorldEventKind,
	data: z.record(z.unknown()),
	timestamp: z.number(),
})
export type WorldEvent = z.infer<typeof WorldEventSchema>

// ── API request/response shapes ─────────────────────────────────────────────

export const NavigateInput = z.object({
	destinationX: z.number().describe("Target X coordinate"),
	destinationY: z.number().describe("Target Y coordinate"),
})

export const NavigateToPortInput = z.object({
	portId: z.string().describe("Port ID to navigate to"),
})

export const TradeInput = z.object({
	shipId: z.string(),
	goodId: z.string(),
	quantity: z.number().int().positive(),
})

export const CommissionShipInput = z.object({
	name: z.string().min(1).max(64),
	shipClass: ShipClass,
	portId: z.string().describe("Port to commission the ship at (must own a docked ship there or it is your first ship)"),
})

export const RefuelInput = z.object({
	amount: z.number().positive().describe("Units of fuel to purchase"),
})

// ── API error ───────────────────────────────────────────────────────────────

export const ApiErrorSchema = z.object({
	error: z.string(),
	detail: z.string().optional(),
})
export type ApiError = z.infer<typeof ApiErrorSchema>

// ── Market view (computed, not stored) ──────────────────────────────────────

export const MarketEntrySchema = z.object({
	goodId: z.string(),
	goodName: z.string(),
	category: ResourceKind,
	sellPrice: z.number().nullable().describe("Price to buy FROM port (null = not sold here)"),
	sellQuantity: z.number().nullable(),
	buyPrice: z.number().nullable().describe("Price port pays to buy FROM you (null = not bought here)"),
	buyQuantity: z.number().nullable(),
})
export type MarketEntry = z.infer<typeof MarketEntrySchema>
