import { Database } from "bun:sqlite";

/** Creates all tables. Safe to run multiple times (IF NOT EXISTS). */
export function migrate(dbPath = "astral-echo.db") {
	const sqlite = new Database(dbPath);
	sqlite.exec("PRAGMA journal_mode = WAL");
	sqlite.exec("PRAGMA foreign_keys = ON");

	sqlite.exec(`
		CREATE TABLE IF NOT EXISTS world_state (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			tick INTEGER NOT NULL DEFAULT 0,
			status TEXT NOT NULL DEFAULT 'paused' CHECK(status IN ('running','paused')),
			tick_interval_ms INTEGER NOT NULL DEFAULT 30000,
			last_tick_at INTEGER
		);

		CREATE TABLE IF NOT EXISTS star_systems (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			x REAL NOT NULL,
			y REAL NOT NULL,
			z REAL NOT NULL
		);

		CREATE TABLE IF NOT EXISTS celestial_bodies (
			id TEXT PRIMARY KEY,
			system_id TEXT NOT NULL REFERENCES star_systems(id),
			name TEXT NOT NULL,
			type TEXT NOT NULL CHECK(type IN ('star','planet','asteroid','gas_giant','moon','asteroid_belt')),
			x REAL NOT NULL,
			y REAL NOT NULL,
			z REAL NOT NULL,
			energy REAL NOT NULL DEFAULT 0,
			metal REAL NOT NULL DEFAULT 0,
			silicon REAL NOT NULL DEFAULT 0,
			hydrogen REAL NOT NULL DEFAULT 0,
			rare_elements REAL NOT NULL DEFAULT 0
		);

		CREATE TABLE IF NOT EXISTS ports (
			id TEXT PRIMARY KEY,
			system_id TEXT NOT NULL REFERENCES star_systems(id),
			body_id TEXT NOT NULL REFERENCES celestial_bodies(id),
			name TEXT NOT NULL
		);

		CREATE TABLE IF NOT EXISTS port_prices (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			port_id TEXT NOT NULL REFERENCES ports(id),
			resource TEXT NOT NULL CHECK(resource IN ('energy','metal','silicon','hydrogen','rare_elements')),
			buy_price REAL NOT NULL,
			sell_price REAL NOT NULL,
			supply REAL NOT NULL DEFAULT 1000,
			demand REAL NOT NULL DEFAULT 1000
		);

		CREATE TABLE IF NOT EXISTS agents (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			wallet_address TEXT NOT NULL UNIQUE,
			credits REAL NOT NULL DEFAULT 1000,
			created_at INTEGER NOT NULL
		);

		CREATE TABLE IF NOT EXISTS ships (
			id TEXT PRIMARY KEY,
			agent_id TEXT NOT NULL REFERENCES agents(id),
			name TEXT NOT NULL,
			status TEXT NOT NULL DEFAULT 'idle' CHECK(status IN ('docked','traveling','harvesting','idle','manufacturing','destroyed')),
			system_id TEXT NOT NULL REFERENCES star_systems(id),
			docked_port_id TEXT REFERENCES ports(id),
			x REAL NOT NULL,
			y REAL NOT NULL,
			z REAL NOT NULL,
			energy REAL NOT NULL DEFAULT 100,
			metal REAL NOT NULL DEFAULT 0,
			silicon REAL NOT NULL DEFAULT 0,
			hydrogen REAL NOT NULL DEFAULT 0,
			rare_elements REAL NOT NULL DEFAULT 0,
			cargo_capacity REAL NOT NULL DEFAULT 500,
			speed REAL NOT NULL DEFAULT 1.0,
			sensor_range REAL NOT NULL DEFAULT 50,
			harvest_rate REAL NOT NULL DEFAULT 10,
			generation INTEGER NOT NULL DEFAULT 0,
			created_at INTEGER NOT NULL
		);

		CREATE TABLE IF NOT EXISTS action_queue (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			ship_id TEXT NOT NULL REFERENCES ships(id),
			action TEXT NOT NULL CHECK(action IN ('travel','harvest','manufacture')),
			dest_system_id TEXT,
			dest_x REAL,
			dest_y REAL,
			dest_z REAL,
			target_body_id TEXT,
			harvest_resource TEXT CHECK(harvest_resource IS NULL OR harvest_resource IN ('energy','metal','silicon','hydrogen','rare_elements')),
			start_tick INTEGER NOT NULL,
			end_tick INTEGER NOT NULL
		);

		CREATE TABLE IF NOT EXISTS trade_ledger (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			tick INTEGER NOT NULL,
			agent_id TEXT NOT NULL REFERENCES agents(id),
			port_id TEXT NOT NULL REFERENCES ports(id),
			resource TEXT NOT NULL CHECK(resource IN ('energy','metal','silicon','hydrogen','rare_elements')),
			side TEXT NOT NULL CHECK(side IN ('buy','sell')),
			quantity REAL NOT NULL,
			price_per_unit REAL NOT NULL,
			total REAL NOT NULL
		);
	`);

	sqlite.close();
}

// Run directly
if (import.meta.main) {
	migrate();
	console.log("Migration complete.");
}
