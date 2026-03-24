import { Hono } from "hono"
import { and, eq } from "drizzle-orm"
import { db } from "../../db/index.js"
import { agents, goods, portListings, ports, shipCargo, ships } from "../../db/schema.js"
import {
	CommissionShipInput,
	NavigateInput,
	NavigateToPortInput,
	PriceTier,
	RefuelInput,
	SHIP_CLASSES,
	type ShipClass,
} from "../../types/index.js"
import { computePosition, distance, resolveArrival } from "../../engine/navigation.js"
import { getWorldConfig } from "../../engine/world.js"
import { emit } from "../../engine/events.js"
import { x402 } from "../middleware/payment.js"
import { requireAgent } from "../middleware/identity.js"
import { newId } from "../../utils/id.js"

const app = new Hono()

function shipView(ship: typeof ships.$inferSelect) {
	const pos = computePosition(ship)
	const arrivalMs =
		ship.departedAt && ship.destinationX !== null && ship.destinationY !== null
			? Math.max(
					0,
					(distance(
						{ x: ship.x, y: ship.y },
						{ x: ship.destinationX, y: ship.destinationY },
					) /
						ship.speed) *
						1000 -
						(Date.now() - ship.departedAt),
				)
			: null

	return {
		id: ship.id,
		name: ship.name,
		ownerId: ship.ownerId,
		shipClass: ship.shipClass,
		position: { x: pos.x, y: pos.y },
		destination:
			ship.destinationX !== null && ship.destinationY !== null
				? { x: ship.destinationX, y: ship.destinationY }
				: null,
		arrivalInMs: arrivalMs,
		speed: ship.speed,
		fuel: ship.fuel,
		fuelCapacity: ship.fuelCapacity,
		cargoCapacity: ship.cargoCapacity,
		status: pos.arrived && ship.status === "sailing" ? "idle" : ship.status,
		dockedAtPortId: ship.dockedAtPortId,
	}
}

/** List my ships */
app.get("/", x402(PriceTier.observe), (c) => {
	const agent = requireAgent(c)
	const myShips = db
		.select()
		.from(ships)
		.where(eq(ships.ownerId, agent.id))
		.all()

	// Resolve any arrivals
	for (const ship of myShips) {
		resolveArrival(ship)
	}

	// Re-fetch after resolving
	const updated = db
		.select()
		.from(ships)
		.where(eq(ships.ownerId, agent.id))
		.all()

	return c.json(updated.map(shipView))
})

/** Commission a new ship */
app.post("/", x402(PriceTier.commission), async (c) => {
	const agent = requireAgent(c)
	const body = CommissionShipInput.safeParse(await c.req.json())
	if (!body.success) {
		return c.json({ error: "Invalid input", detail: body.error.message }, 400)
	}

	const classStats = SHIP_CLASSES[body.data.shipClass as ShipClass]
	if (!classStats) {
		return c.json({ error: "Invalid ship class" }, 400)
	}

	// Check affordability
	if (agent.balance < classStats.commissionCost) {
		return c.json(
			{
				error: `Insufficient credits: need ${classStats.commissionCost}, have ${agent.balance}`,
			},
			400,
		)
	}

	// Verify port exists
	const port = db
		.select()
		.from(ports)
		.where(eq(ports.id, body.data.portId))
		.get()
	if (!port) {
		return c.json({ error: "Port not found" }, 404)
	}

	// Deduct cost
	db.update(agents)
		.set({ balance: agent.balance - classStats.commissionCost })
		.where(eq(agents.id, agent.id))
		.run()

	const ship = {
		id: newId(),
		name: body.data.name,
		ownerId: agent.id,
		shipClass: body.data.shipClass,
		x: port.x,
		y: port.y,
		destinationX: null,
		destinationY: null,
		departedAt: null,
		speed: classStats.speed,
		fuel: classStats.fuelCapacity, // starts full
		fuelCapacity: classStats.fuelCapacity,
		cargoCapacity: classStats.cargoCapacity,
		status: "docked" as const,
		dockedAtPortId: port.id,
	}

	db.insert(ships).values(ship).run()
	emit("ship_commissioned", {
		shipId: ship.id,
		agentId: agent.id,
		shipClass: ship.shipClass,
		portId: port.id,
	})

	return c.json(shipView(ship), 201)
})

/** Get ship details */
app.get("/:id", x402(PriceTier.observe), (c) => {
	const agent = requireAgent(c)
	const ship = db
		.select()
		.from(ships)
		.where(eq(ships.id, c.req.param("id")))
		.get()
	if (!ship) return c.json({ error: "Ship not found" }, 404)
	if (ship.ownerId !== agent.id) return c.json({ error: "Not your ship" }, 403)

	resolveArrival(ship)
	const updated = db
		.select()
		.from(ships)
		.where(eq(ships.id, c.req.param("id")))
		.get()
	if (!updated) return c.json({ error: "Ship not found" }, 404)

	return c.json(shipView(updated))
})

/** Get ship cargo */
app.get("/:id/cargo", x402(PriceTier.observe), (c) => {
	const agent = requireAgent(c)
	const ship = db
		.select()
		.from(ships)
		.where(eq(ships.id, c.req.param("id")))
		.get()
	if (!ship) return c.json({ error: "Ship not found" }, 404)
	if (ship.ownerId !== agent.id) return c.json({ error: "Not your ship" }, 403)

	const cargo = db
		.select()
		.from(shipCargo)
		.where(eq(shipCargo.shipId, ship.id))
		.all()

	const cargoWithNames = cargo.map((c) => {
		const good = db.select().from(goods).where(eq(goods.id, c.goodId)).get()
		return {
			goodId: c.goodId,
			goodName: good?.name ?? "Unknown",
			quantity: c.quantity,
			weight: (good?.weight ?? 1) * c.quantity,
		}
	})

	const totalWeight = cargoWithNames.reduce((sum, c) => sum + c.weight, 0)

	return c.json({
		shipId: ship.id,
		capacity: ship.cargoCapacity,
		used: totalWeight,
		remaining: ship.cargoCapacity - totalWeight,
		items: cargoWithNames,
	})
})

/** Navigate to coordinates */
app.post("/:id/navigate", x402(PriceTier.act), async (c) => {
	const agent = requireAgent(c)
	const ship = db
		.select()
		.from(ships)
		.where(eq(ships.id, c.req.param("id")))
		.get()
	if (!ship) return c.json({ error: "Ship not found" }, 404)
	if (ship.ownerId !== agent.id) return c.json({ error: "Not your ship" }, 403)
	if (ship.status === "sailing") {
		return c.json({ error: "Ship is already sailing" }, 400)
	}
	if (ship.status === "docked") {
		return c.json({ error: "Ship is docked. Undock first (POST /ships/:id/undock)" }, 400)
	}

	// Accept either coordinates or portId
	const raw = await c.req.json()
	let destX: number
	let destY: number

	const coordParse = NavigateInput.safeParse(raw)
	const portParse = NavigateToPortInput.safeParse(raw)

	if (coordParse.success) {
		destX = coordParse.data.destinationX
		destY = coordParse.data.destinationY
	} else if (portParse.success) {
		const port = db
			.select()
			.from(ports)
			.where(eq(ports.id, portParse.data.portId))
			.get()
		if (!port) return c.json({ error: "Port not found" }, 404)
		destX = port.x
		destY = port.y
	} else {
		return c.json(
			{
				error: "Provide either {destinationX, destinationY} or {portId}",
				detail: coordParse.error.message,
			},
			400,
		)
	}

	// Check fuel
	const config = getWorldConfig()
	const dist = distance({ x: ship.x, y: ship.y }, { x: destX, y: destY })

	// Clamp to world bounds
	if (destX < 0 || destX > config.width || destY < 0 || destY > config.height) {
		return c.json({ error: "Destination out of world bounds" }, 400)
	}

	const classStats = SHIP_CLASSES[ship.shipClass as ShipClass]
	const fuelCost = dist * (classStats?.fuelPerDistance ?? 1)

	if (ship.fuel < fuelCost) {
		return c.json(
			{
				error: `Insufficient fuel: need ${fuelCost.toFixed(1)}, have ${ship.fuel.toFixed(1)}`,
				maxRange: ship.fuel / (classStats?.fuelPerDistance ?? 1),
			},
			400,
		)
	}

	// Set sail
	const now = Date.now()
	db.update(ships)
		.set({
			destinationX: destX,
			destinationY: destY,
			departedAt: now,
			status: "sailing",
			fuel: ship.fuel - fuelCost,
			dockedAtPortId: null,
		})
		.where(eq(ships.id, ship.id))
		.run()

	const travelTimeMs = (dist / ship.speed) * 1000

	emit("ship_departed", {
		shipId: ship.id,
		from: { x: ship.x, y: ship.y },
		to: { x: destX, y: destY },
		fuelCost,
		travelTimeMs,
	})

	return c.json({
		status: "sailing",
		from: { x: ship.x, y: ship.y },
		to: { x: destX, y: destY },
		fuelCost: Math.round(fuelCost * 100) / 100,
		fuelRemaining: Math.round((ship.fuel - fuelCost) * 100) / 100,
		estimatedArrivalMs: Math.round(travelTimeMs),
	})
})

/** Dock at the nearest port */
app.post("/:id/dock", x402(PriceTier.act), (c) => {
	const agent = requireAgent(c)
	const ship = db
		.select()
		.from(ships)
		.where(eq(ships.id, c.req.param("id")))
		.get()
	if (!ship) return c.json({ error: "Ship not found" }, 404)
	if (ship.ownerId !== agent.id) return c.json({ error: "Not your ship" }, 403)
	if (ship.status === "docked") {
		return c.json({ error: "Already docked" }, 400)
	}
	if (ship.status === "sailing") {
		// Check if arrived
		resolveArrival(ship)
		const updated = db.select().from(ships).where(eq(ships.id, ship.id)).get()
		if (updated?.status === "sailing") {
			return c.json({ error: "Ship is still sailing" }, 400)
		}
	}

	// Get current position
	const pos = computePosition(ship)
	const config = getWorldConfig()

	// Find nearest port within docking radius
	const allPorts = db.select().from(ports).all()
	let nearest: (typeof allPorts)[number] | null = null
	let nearestDist = Infinity

	for (const port of allPorts) {
		const d = distance(pos, { x: port.x, y: port.y })
		if (d < nearestDist) {
			nearestDist = d
			nearest = port
		}
	}

	if (!nearest) {
		return c.json({ error: "No ports exist in the world" }, 400)
	}

	if (nearestDist > config.dockingRadius) {
		return c.json(
			{
				error: `No port within docking radius (${config.dockingRadius} units). Nearest: ${nearest.name} at distance ${nearestDist.toFixed(1)}`,
			},
			400,
		)
	}

	// Pay docking fee
	const fee = nearest.dockingFee
	if (fee > 0) {
		const agentRow = db
			.select()
			.from(agents)
			.where(eq(agents.id, agent.id))
			.get()
		if (!agentRow || agentRow.balance < fee) {
			return c.json(
				{ error: `Insufficient credits for docking fee: ${fee}` },
				400,
			)
		}
		db.update(agents)
			.set({ balance: agentRow.balance - fee })
			.where(eq(agents.id, agent.id))
			.run()

		// Pay fee to port owner
		if (nearest.ownerId) {
			const owner = db
				.select()
				.from(agents)
				.where(eq(agents.id, nearest.ownerId))
				.get()
			if (owner) {
				db.update(agents)
					.set({ balance: owner.balance + fee })
					.where(eq(agents.id, nearest.ownerId))
					.run()
			}
		}
	}

	// Dock
	db.update(ships)
		.set({
			x: nearest.x,
			y: nearest.y,
			destinationX: null,
			destinationY: null,
			departedAt: null,
			status: "docked",
			dockedAtPortId: nearest.id,
		})
		.where(eq(ships.id, ship.id))
		.run()

	emit("ship_docked", {
		shipId: ship.id,
		portId: nearest.id,
		portName: nearest.name,
		fee,
	})

	return c.json({
		status: "docked",
		portId: nearest.id,
		portName: nearest.name,
		dockingFee: fee,
	})
})

/** Undock from current port */
app.post("/:id/undock", x402(PriceTier.act), (c) => {
	const agent = requireAgent(c)
	const ship = db
		.select()
		.from(ships)
		.where(eq(ships.id, c.req.param("id")))
		.get()
	if (!ship) return c.json({ error: "Ship not found" }, 404)
	if (ship.ownerId !== agent.id) return c.json({ error: "Not your ship" }, 403)
	if (ship.status !== "docked") {
		return c.json({ error: "Ship is not docked" }, 400)
	}

	db.update(ships)
		.set({ status: "idle", dockedAtPortId: null })
		.where(eq(ships.id, ship.id))
		.run()

	emit("ship_undocked", { shipId: ship.id, portId: ship.dockedAtPortId })

	return c.json({ status: "idle", position: { x: ship.x, y: ship.y } })
})

/** Refuel at current port */
app.post("/:id/refuel", x402(PriceTier.act), async (c) => {
	const agent = requireAgent(c)
	const ship = db
		.select()
		.from(ships)
		.where(eq(ships.id, c.req.param("id")))
		.get()
	if (!ship) return c.json({ error: "Ship not found" }, 404)
	if (ship.ownerId !== agent.id) return c.json({ error: "Not your ship" }, 403)
	if (ship.status !== "docked" || !ship.dockedAtPortId) {
		return c.json({ error: "Ship must be docked to refuel" }, 400)
	}

	const body = RefuelInput.safeParse(await c.req.json())
	if (!body.success) {
		return c.json({ error: "Invalid input", detail: body.error.message }, 400)
	}

	const maxRefuel = ship.fuelCapacity - ship.fuel
	const amount = Math.min(body.data.amount, maxRefuel)
	if (amount <= 0) {
		return c.json({ error: "Fuel tank is already full" }, 400)
	}

	// Check if port sells fuel
	const fuelListing = db
		.select()
		.from(portListings)
		.where(
			and(
				eq(portListings.portId, ship.dockedAtPortId),
				eq(portListings.goodId, "fuel_cells"),
			),
		)
		.get()

	// Fuel costs 2 credits per unit as a baseline if no market listing
	const fuelPricePerUnit = fuelListing ? fuelListing.sellPrice : 2
	const totalCost = amount * fuelPricePerUnit

	const agentRow = db
		.select()
		.from(agents)
		.where(eq(agents.id, agent.id))
		.get()
	if (!agentRow || agentRow.balance < totalCost) {
		return c.json(
			{ error: `Insufficient credits: need ${totalCost}, have ${agentRow?.balance ?? 0}` },
			400,
		)
	}

	// Deduct credits and add fuel
	db.update(agents)
		.set({ balance: agentRow.balance - totalCost })
		.where(eq(agents.id, agent.id))
		.run()

	db.update(ships)
		.set({ fuel: ship.fuel + amount })
		.where(eq(ships.id, ship.id))
		.run()

	// Deduct from port listing if applicable
	if (fuelListing) {
		db.update(portListings)
			.set({ quantity: Math.max(0, fuelListing.quantity - amount) })
			.where(
				and(
					eq(portListings.portId, ship.dockedAtPortId),
					eq(portListings.goodId, "fuel_cells"),
				),
			)
			.run()
	}

	return c.json({
		fuelAdded: amount,
		fuelNow: ship.fuel + amount,
		fuelCapacity: ship.fuelCapacity,
		creditsCost: totalCost,
	})
})

export default app
