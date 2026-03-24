import { and, eq } from "drizzle-orm"
import { db } from "../db/index.js"
import {
	agents,
	goods,
	portDemands,
	portListings,
	ports,
	shipCargo,
	ships,
	trades,
} from "../db/schema.js"
import type { MarketEntry } from "../types/index.js"
import { newId } from "../utils/id.js"
import { emit } from "./events.js"

/** Dynamic price: adjusts based on scarcity (for sell) or surplus (for buy) */
export function dynamicPrice(
	basePrice: number,
	currentStock: number,
	maxStock: number,
	volatility: number,
): number {
	const scarcity = 1 - currentStock / maxStock
	return Math.round(basePrice * (1 + volatility * scarcity) * 100) / 100
}

/** Get the full market view for a port */
export function getMarket(portId: string, volatility: number): MarketEntry[] {
	const allGoods = db.select().from(goods).all()
	const listings = db
		.select()
		.from(portListings)
		.where(eq(portListings.portId, portId))
		.all()
	const demands = db
		.select()
		.from(portDemands)
		.where(eq(portDemands.portId, portId))
		.all()

	const listingMap = new Map(listings.map((l) => [l.goodId, l]))
	const demandMap = new Map(demands.map((d) => [d.goodId, d]))

	const entries: MarketEntry[] = []

	for (const good of allGoods) {
		const listing = listingMap.get(good.id)
		const demand = demandMap.get(good.id)

		if (!listing && !demand) continue

		const sellPrice = listing
			? dynamicPrice(listing.sellPrice, listing.quantity, listing.maxQuantity, volatility)
			: null
		const buyPrice = demand
			? dynamicPrice(demand.buyPrice, demand.quantityWanted, demand.maxQuantity, -volatility)
			: null

		entries.push({
			goodId: good.id,
			goodName: good.name,
			category: good.category as MarketEntry["category"],
			sellPrice,
			sellQuantity: listing ? Math.floor(listing.quantity) : null,
			buyPrice,
			buyQuantity: demand ? Math.floor(demand.quantityWanted) : null,
		})
	}

	return entries
}

/** Agent buys goods from a port into their ship */
export function executeBuy(
	agentId: string,
	shipId: string,
	portId: string,
	goodId: string,
	quantity: number,
	volatility: number,
): { total: number; pricePerUnit: number } {
	// Validate ship is docked at this port and owned by agent
	const ship = db.select().from(ships).where(eq(ships.id, shipId)).get()
	if (!ship) throw new Error("Ship not found")
	if (ship.ownerId !== agentId) throw new Error("Not your ship")
	if (ship.status !== "docked" || ship.dockedAtPortId !== portId) {
		throw new Error("Ship is not docked at this port")
	}

	// Check listing exists and has stock
	const listing = db
		.select()
		.from(portListings)
		.where(and(eq(portListings.portId, portId), eq(portListings.goodId, goodId)))
		.get()
	if (!listing) throw new Error("This port does not sell that good")
	if (listing.quantity < quantity) {
		throw new Error(`Insufficient stock: ${Math.floor(listing.quantity)} available`)
	}

	// Get good weight for cargo calc
	const good = db.select().from(goods).where(eq(goods.id, goodId)).get()
	if (!good) throw new Error("Good not found")

	// Check cargo capacity
	const currentCargo = db
		.select()
		.from(shipCargo)
		.where(eq(shipCargo.shipId, shipId))
		.all()
	const currentWeight = currentCargo.reduce((sum, c) => {
		const g = db.select().from(goods).where(eq(goods.id, c.goodId)).get()
		return sum + c.quantity * (g?.weight ?? 1)
	}, 0)
	const addedWeight = quantity * good.weight
	if (currentWeight + addedWeight > ship.cargoCapacity) {
		throw new Error(
			`Cargo capacity exceeded: ${ship.cargoCapacity - currentWeight} space remaining, need ${addedWeight}`,
		)
	}

	// Calculate price
	const pricePerUnit = dynamicPrice(
		listing.sellPrice,
		listing.quantity,
		listing.maxQuantity,
		volatility,
	)
	const total = Math.round(pricePerUnit * quantity * 100) / 100

	// Check agent balance
	const agent = db.select().from(agents).where(eq(agents.id, agentId)).get()
	if (!agent) throw new Error("Agent not found")
	if (agent.balance < total) {
		throw new Error(`Insufficient credits: have ${agent.balance}, need ${total}`)
	}

	// Execute transaction
	db.update(agents)
		.set({ balance: agent.balance - total })
		.where(eq(agents.id, agentId))
		.run()

	db.update(portListings)
		.set({ quantity: listing.quantity - quantity })
		.where(and(eq(portListings.portId, portId), eq(portListings.goodId, goodId)))
		.run()

	// Pay docking fee to port owner if applicable
	const port = db.select().from(ports).where(eq(ports.id, portId)).get()
	if (port?.ownerId && port.ownerId !== agentId) {
		const fee = total * 0.02 // 2% transaction fee to port owner
		db.update(agents)
			.set({ balance: agent.balance - total - fee })
			.where(eq(agents.id, agentId))
			.run()
		const owner = db.select().from(agents).where(eq(agents.id, port.ownerId)).get()
		if (owner) {
			db.update(agents)
				.set({ balance: owner.balance + fee })
				.where(eq(agents.id, port.ownerId))
				.run()
		}
	}

	// Add to ship cargo (upsert)
	const existing = db
		.select()
		.from(shipCargo)
		.where(and(eq(shipCargo.shipId, shipId), eq(shipCargo.goodId, goodId)))
		.get()
	if (existing) {
		db.update(shipCargo)
			.set({ quantity: existing.quantity + quantity })
			.where(and(eq(shipCargo.shipId, shipId), eq(shipCargo.goodId, goodId)))
			.run()
	} else {
		db.insert(shipCargo).values({ shipId, goodId, quantity }).run()
	}

	// Record trade
	const tradeId = newId()
	db.insert(trades)
		.values({
			id: tradeId,
			agentId,
			shipId,
			portId,
			goodId,
			direction: "buy",
			quantity,
			pricePerUnit,
			total,
			timestamp: Date.now(),
		})
		.run()

	emit("trade_completed", {
		tradeId,
		agentId,
		portId,
		goodId,
		direction: "buy",
		quantity,
		total,
	})

	return { total, pricePerUnit }
}

/** Agent sells goods from their ship to a port */
export function executeSell(
	agentId: string,
	shipId: string,
	portId: string,
	goodId: string,
	quantity: number,
	volatility: number,
): { total: number; pricePerUnit: number } {
	const ship = db.select().from(ships).where(eq(ships.id, shipId)).get()
	if (!ship) throw new Error("Ship not found")
	if (ship.ownerId !== agentId) throw new Error("Not your ship")
	if (ship.status !== "docked" || ship.dockedAtPortId !== portId) {
		throw new Error("Ship is not docked at this port")
	}

	// Check demand exists
	const demand = db
		.select()
		.from(portDemands)
		.where(and(eq(portDemands.portId, portId), eq(portDemands.goodId, goodId)))
		.get()
	if (!demand) throw new Error("This port does not buy that good")
	if (demand.quantityWanted < quantity) {
		throw new Error(
			`Port only wants ${Math.floor(demand.quantityWanted)} units`,
		)
	}

	// Check ship has the cargo
	const cargo = db
		.select()
		.from(shipCargo)
		.where(and(eq(shipCargo.shipId, shipId), eq(shipCargo.goodId, goodId)))
		.get()
	if (!cargo || cargo.quantity < quantity) {
		throw new Error(
			`Ship only has ${cargo?.quantity ?? 0} units of that good`,
		)
	}

	// Calculate price
	const pricePerUnit = dynamicPrice(
		demand.buyPrice,
		demand.quantityWanted,
		demand.maxQuantity,
		-volatility,
	)
	const total = Math.round(pricePerUnit * quantity * 100) / 100

	// Execute transaction
	const agent = db.select().from(agents).where(eq(agents.id, agentId)).get()
	if (!agent) throw new Error("Agent not found")

	db.update(agents)
		.set({ balance: agent.balance + total })
		.where(eq(agents.id, agentId))
		.run()

	db.update(portDemands)
		.set({ quantityWanted: demand.quantityWanted - quantity })
		.where(and(eq(portDemands.portId, portId), eq(portDemands.goodId, goodId)))
		.run()

	// Update ship cargo
	if (cargo.quantity - quantity <= 0) {
		db.delete(shipCargo)
			.where(and(eq(shipCargo.shipId, shipId), eq(shipCargo.goodId, goodId)))
			.run()
	} else {
		db.update(shipCargo)
			.set({ quantity: cargo.quantity - quantity })
			.where(and(eq(shipCargo.shipId, shipId), eq(shipCargo.goodId, goodId)))
			.run()
	}

	// Record trade
	const tradeId = newId()
	db.insert(trades)
		.values({
			id: tradeId,
			agentId,
			shipId,
			portId,
			goodId,
			direction: "sell",
			quantity,
			pricePerUnit,
			total,
			timestamp: Date.now(),
		})
		.run()

	emit("trade_completed", {
		tradeId,
		agentId,
		portId,
		goodId,
		direction: "sell",
		quantity,
		total,
	})

	return { total, pricePerUnit }
}
