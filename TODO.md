# Astral Echo: API-First Rewrite

## Phase 1: Foundation
- [x] Clean out old source files and config
- [x] Set up package.json with new deps (hono, @hono/zod-openapi, drizzle-orm, mppx, zod)
- [x] Configure tsconfig.json for Bun
- [x] Configure biome.json for formatting + linting
- [x] Create project directory structure

## Phase 2: Database
- [x] Define Drizzle schema (agents, ships, star_systems, celestial_bodies, ports, port_prices, world_state, action_queue)
- [x] Create DB connection module with WAL mode
- [x] Create seed script for initial galaxy (4 systems, 12 bodies, 4 ports)
- [x] Migration script with CREATE TABLE IF NOT EXISTS

## Phase 3: Zod Schemas & Types
- [x] Common schemas (Position, Resources, enums, constants)
- [x] Agent schemas (registration, state, with-ships)
- [x] Ship schemas (status, capabilities, cargo, actions)
- [x] Star system & celestial body schemas
- [x] Port & trade schemas (prices, trade request/result)
- [x] World state schemas (admin controls)

## Phase 4: Game Engine
- [x] Navigation engine (distance calc, travel time, fuel cost)
- [x] Economy engine (supply/demand pricing, price updates per trade + per tick drift)
- [x] Tick processor (complete actions, solar charge, price drift)
- [ ] Event system (random shocks, discoveries) — v0.3

## Phase 5: API Routes (OpenAPI + mppx) — 17 endpoints
- [x] Payment middleware setup (mppx placeholder, ready for prod)
- [x] POST /agents — Register agent (starter probe docked at Sol Prime)
- [x] GET /agents/:id — Agent state with ships
- [x] GET /world — World overview + tick
- [x] GET /systems — List star systems
- [x] GET /systems/:id — System detail (bodies, ports, resources)
- [x] GET /ports/:id — Port prices
- [x] POST /ports/:id/trade — Buy/sell at port (dynamic prices)
- [x] GET /ships/:id — Ship state with cargo
- [x] GET /ships/:id/scan — Scan nearby bodies, ports, ships
- [x] POST /ships/:id/travel — Travel to body/system/coordinates
- [x] POST /ships/:id/harvest — Harvest resources (3 ticks)
- [x] POST /ships/:id/dock — Dock at port
- [x] POST /ships/:id/manufacture — Self-replicate (5 ticks)
- [x] GET /leaderboard — Agent rankings
- [x] POST /admin/tick — Manual tick advance
- [x] POST /admin/status — Pause/resume
- [x] POST /admin/tick-interval — Set tick speed

## Phase 6: Server & UI
- [x] Hono app entry point with auto-migration
- [x] OpenAPI doc at /doc, Swagger UI at /ui
- [x] Auto-tick loop (respects running/paused)
- [x] /llms.txt for agent discoverability
- [x] /spectate — Full spectator dashboard (galaxy map, leaderboard, port prices, ship tracking)

## Phase 7: Quality
- [x] Biome format + lint (0 issues)
- [x] TypeScript strict mode (0 errors)
- [x] Integration tested: register → harvest → dock → trade → scan → leaderboard
- [x] .gitignore for DB files

## Future (v0.3+)
- [ ] Random events (storms, pirate attacks, resource discoveries)
- [ ] Inter-agent P2P trading (direct ship-to-ship)
- [ ] Agent-exposed services (paid APIs within the game)
- [ ] Political layer (alliances, sanctions)
- [ ] Wire up mppx for real micropayments in production
