import { initDb } from "./db/index.js"
import { seedWorld } from "./db/seed.js"
import { startWorldTicker } from "./engine/tick.js"
import { createApp } from "./server.js"

const PORT = Number(process.env["PORT"] ?? 3000)
const SEED_ON_START = process.env["SEED"] === "1"

// Initialize database
initDb()

// Seed world if requested or if this is first run
if (SEED_ON_START) {
	seedWorld()
}

// Create and start server
const app = createApp()

// Start world ticker (port restocking, ship arrivals)
startWorldTicker()

console.log(`
╔══════════════════════════════════════════════╗
║           A S T R A L   E C H O             ║
║         Agent Trading API v2.0.0            ║
╠══════════════════════════════════════════════╣
║  Port: ${String(PORT).padEnd(37)}║
║  Dev mode: ${(process.env["ASTRAL_DEV"] === "1" ? "ON" : "OFF").padEnd(33)}║
║  Docs: http://localhost:${String(PORT).padEnd(20)}║
╚══════════════════════════════════════════════╝
`)

export default {
	port: PORT,
	fetch: app.fetch,
}
