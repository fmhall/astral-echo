import { Database } from "bun:sqlite"
import { drizzle } from "drizzle-orm/bun-sqlite"
import * as schema from "./schema.js"

const DB_PATH = process.env["DB_PATH"] ?? "astral-echo.db"

const sqlite = new Database(DB_PATH)
sqlite.exec("PRAGMA journal_mode = WAL")
sqlite.exec("PRAGMA foreign_keys = ON")

export const db = drizzle(sqlite, { schema })

/** Run all CREATE TABLE IF NOT EXISTS statements */
export function initDb(): void {
	sqlite.exec(`
		CREATE TABLE IF NOT EXISTS agents (
			id TEXT PRIMARY KEY,
			wallet_address TEXT NOT NULL UNIQUE,
			name TEXT NOT NULL,
			balance REAL NOT NULL DEFAULT 0,
			created_at INTEGER NOT NULL
		);

		CREATE TABLE IF NOT EXISTS goods (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			category TEXT NOT NULL,
			base_price REAL NOT NULL,
			weight REAL NOT NULL
		);

		CREATE TABLE IF NOT EXISTS ports (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			x REAL NOT NULL,
			y REAL NOT NULL,
			owner_id TEXT REFERENCES agents(id),
			docking_fee REAL NOT NULL DEFAULT 0
		);

		CREATE TABLE IF NOT EXISTS port_listings (
			port_id TEXT NOT NULL REFERENCES ports(id),
			good_id TEXT NOT NULL REFERENCES goods(id),
			quantity REAL NOT NULL DEFAULT 0,
			max_quantity REAL NOT NULL,
			sell_price REAL NOT NULL,
			restock_rate REAL NOT NULL DEFAULT 0,
			PRIMARY KEY (port_id, good_id)
		);

		CREATE TABLE IF NOT EXISTS port_demands (
			port_id TEXT NOT NULL REFERENCES ports(id),
			good_id TEXT NOT NULL REFERENCES goods(id),
			buy_price REAL NOT NULL,
			quantity_wanted REAL NOT NULL DEFAULT 0,
			max_quantity REAL NOT NULL,
			consume_rate REAL NOT NULL DEFAULT 0,
			PRIMARY KEY (port_id, good_id)
		);

		CREATE TABLE IF NOT EXISTS ships (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			owner_id TEXT NOT NULL REFERENCES agents(id),
			ship_class TEXT NOT NULL,
			x REAL NOT NULL,
			y REAL NOT NULL,
			destination_x REAL,
			destination_y REAL,
			departed_at INTEGER,
			speed REAL NOT NULL,
			fuel REAL NOT NULL,
			fuel_capacity REAL NOT NULL,
			cargo_capacity REAL NOT NULL,
			status TEXT NOT NULL DEFAULT 'docked',
			docked_at_port_id TEXT REFERENCES ports(id)
		);

		CREATE TABLE IF NOT EXISTS ship_cargo (
			ship_id TEXT NOT NULL REFERENCES ships(id),
			good_id TEXT NOT NULL REFERENCES goods(id),
			quantity REAL NOT NULL,
			PRIMARY KEY (ship_id, good_id)
		);

		CREATE TABLE IF NOT EXISTS trades (
			id TEXT PRIMARY KEY,
			agent_id TEXT NOT NULL REFERENCES agents(id),
			ship_id TEXT NOT NULL REFERENCES ships(id),
			port_id TEXT NOT NULL REFERENCES ports(id),
			good_id TEXT NOT NULL REFERENCES goods(id),
			direction TEXT NOT NULL,
			quantity REAL NOT NULL,
			price_per_unit REAL NOT NULL,
			total REAL NOT NULL,
			timestamp INTEGER NOT NULL
		);

		CREATE TABLE IF NOT EXISTS world_events (
			id TEXT PRIMARY KEY,
			kind TEXT NOT NULL,
			data TEXT NOT NULL,
			timestamp INTEGER NOT NULL
		);

		CREATE TABLE IF NOT EXISTS world_config (
			key TEXT PRIMARY KEY,
			value TEXT NOT NULL
		);
	`)
}
