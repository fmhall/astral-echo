import {
  GameState,
  Probe,
  SolarSystem,
  Position,
  Resources,
} from "@/game/core/types";
import { v4 as uuidv4 } from "uuid";
import * as fs from "fs";
import * as path from "path";

const GAME_STATE_FILE = path.join(process.cwd(), "game-state.json");

// Singleton game state manager with persistent storage
class GameStateManager {
  private static instance: GameStateManager;
  private state: GameState;
  private instanceId: string;

  private constructor() {
    this.instanceId = `GS-${Date.now()}`;
    console.log(
      `🎮 [DEBUG] Creating GameStateManager instance: ${this.instanceId}`,
    );
    this.state = this.loadOrInitializeGameState();
  }

  static getInstance(): GameStateManager {
    if (!GameStateManager.instance) {
      GameStateManager.instance = new GameStateManager();
    }
    return GameStateManager.instance;
  }

  private loadOrInitializeGameState(): GameState {
    // Try to load existing state from file
    if (fs.existsSync(GAME_STATE_FILE)) {
      try {
        console.log(`📁 Loading existing game state from ${GAME_STATE_FILE}`);
        const savedState = JSON.parse(fs.readFileSync(GAME_STATE_FILE, "utf8"));
        console.log(
          `✅ Loaded game state with ${Object.keys(savedState.probes).length} probes`,
        );
        Object.values(savedState.probes).forEach((probe: any) => {
          console.log(
            `  - ${probe.name} (${probe.id.slice(0, 8)}...) Gen ${probe.generation}`,
          );
        });
        return savedState;
      } catch (error) {
        console.error(`❌ Failed to load game state:`, error);
        console.log(`🆕 Creating new game state...`);
      }
    } else {
      console.log(`🆕 No existing game state found, creating new one...`);
    }

    return this.initializeGameState();
  }

  private saveGameState(): void {
    try {
      fs.writeFileSync(GAME_STATE_FILE, JSON.stringify(this.state, null, 2));
      console.log(
        `💾 [DEBUG] Game state saved to ${GAME_STATE_FILE} (Instance: ${this.instanceId})`,
      );
    } catch (error) {
      console.error(`❌ Failed to save game state:`, error);
    }
  }

  private initializeGameState(): GameState {
    const firstSystemId = uuidv4();
    const firstProbeId = uuidv4();

    console.log(
      `🚀 Initializing new game with probe ${firstProbeId.slice(0, 8)}...`,
    );

    // Create the first solar system
    const firstSystem: SolarSystem = {
      id: firstSystemId,
      name: "Sol Prime",
      position: { x: 0, y: 0, z: 0 },
      star: {
        id: uuidv4(),
        name: "Sol Prime A",
        type: "star",
        position: { x: 0, y: 0, z: 0 },
        resources: {
          energy: 999999,
          metal: 0,
          silicon: 0,
          hydrogen: 999999,
          rare_elements: 0,
        },
        mass: 1.989e30,
        radius: 695700,
      },
      bodies: [
        {
          id: uuidv4(),
          name: "Sol Prime I",
          type: "planet",
          position: { x: 150, y: 0, z: 0 }, // 1 AU = 150 million km
          resources: {
            energy: 0,
            metal: 5000,
            silicon: 3000,
            hydrogen: 100,
            rare_elements: 200,
          },
          mass: 5.972e24,
          radius: 6371,
        },
        {
          id: uuidv4(),
          name: "Sol Prime II",
          type: "planet",
          position: { x: 230, y: 0, z: 0 },
          resources: {
            energy: 0,
            metal: 3000,
            silicon: 6000,
            hydrogen: 50,
            rare_elements: 100,
          },
          mass: 6.39e23,
          radius: 3389,
        },
        {
          id: uuidv4(),
          name: "Sol Prime Asteroid Belt",
          type: "asteroid_belt",
          position: { x: 400, y: 0, z: 0 },
          resources: {
            energy: 0,
            metal: 20000,
            silicon: 15000,
            hydrogen: 0,
            rare_elements: 1000,
          },
          mass: 2.39e21,
          radius: 50000,
        },
      ],
      discoveredBy: firstProbeId,
      discoveredAt: Date.now(),
    };

    // Create the first probe
    const firstProbe: Probe = {
      id: firstProbeId,
      name: "Genesis",
      status: "active",
      position: { x: 150, y: 0, z: 0 }, // Starting on first planet
      currentSystemId: firstSystemId,
      resources: {
        energy: 1000,
        metal: 100,
        silicon: 100,
        hydrogen: 100,
        rare_elements: 10,
      },
      memory: {
        visitedSystems: [firstSystemId],
        discoveredResources: {
          [firstSystemId]: firstSystem.bodies[0].resources,
        },
        knownProbes: [],
        experiences: [
          {
            timestamp: Date.now(),
            event: "probe_awakened",
            data: { location: "Sol Prime I" },
          },
        ],
      },
      capabilities: {
        maxSpeed: 0.1,
        harvestRate: 10,
        sensorRange: 50,
        communicationRange: 100,
        storageCapacity: 5000,
      },
      generation: 0,
      createdAt: Date.now(),
    };

    const newState = {
      currentTime: Date.now(),
      probes: { [firstProbeId]: firstProbe },
      solarSystems: { [firstSystemId]: firstSystem },
      gameStartedAt: Date.now(),
    };

    // Save the initial state
    this.state = newState;
    this.saveGameState();

    return newState;
  }

  getState(): GameState {
    return this.state;
  }

  getProbe(probeId: string): Probe | undefined {
    const probe = this.state.probes[probeId];
    console.log(
      `🔍 [DEBUG] Getting probe ${probeId.slice(0, 8)}... - ${probe ? "FOUND" : "NOT FOUND"} (Instance: ${this.instanceId})`,
    );
    if (!probe) {
      console.log(
        `🔍 [DEBUG] Available probe IDs: ${Object.keys(this.state.probes)
          .map((id) => id.slice(0, 8) + "...")
          .join(", ")}`,
      );
    }
    return probe;
  }

  updateProbe(probeId: string, updates: Partial<Probe>): void {
    const probe = this.state.probes[probeId];
    if (probe) {
      this.state.probes[probeId] = { ...probe, ...updates };
      this.saveGameState();
      console.log(
        `🔄 [DEBUG] Updated probe ${probeId.slice(0, 8)}... (Instance: ${this.instanceId})`,
      );
    } else {
      console.error(
        `❌ [DEBUG] Cannot update probe ${probeId.slice(0, 8)}... - not found (Instance: ${this.instanceId})`,
      );
    }
  }

  addProbe(probe: Probe): void {
    this.state.probes[probe.id] = probe;
    this.saveGameState();
    console.log(
      `➕ [DEBUG] Added probe ${probe.name} (${probe.id.slice(0, 8)}...) (Instance: ${this.instanceId})`,
    );
  }

  getSolarSystem(systemId: string): SolarSystem | undefined {
    return this.state.solarSystems[systemId];
  }

  addSolarSystem(system: SolarSystem): void {
    this.state.solarSystems[system.id] = system;
    this.saveGameState();
  }

  updateTime(newTime: number): void {
    this.state.currentTime = newTime;
    this.saveGameState();
  }

  getAllProbes(): Probe[] {
    const probes = Object.values(this.state.probes);
    console.log(
      `📊 [DEBUG] Getting all probes: ${probes.length} found (Instance: ${this.instanceId})`,
    );
    probes.forEach((p) =>
      console.log(`  - ${p.name} (${p.id.slice(0, 8)}...)`),
    );
    return probes;
  }

  getAllSystems(): SolarSystem[] {
    return Object.values(this.state.solarSystems);
  }

  // Utility method to reset game state (for testing)
  resetGameState(): void {
    if (fs.existsSync(GAME_STATE_FILE)) {
      fs.unlinkSync(GAME_STATE_FILE);
      console.log(`🗑️  Deleted game state file`);
    }
    this.state = this.initializeGameState();
  }

  // Utility methods
  calculateDistance(pos1: Position, pos2: Position): number {
    return Math.sqrt(
      Math.pow(pos2.x - pos1.x, 2) +
        Math.pow(pos2.y - pos1.y, 2) +
        Math.pow(pos2.z - pos1.z, 2),
    );
  }

  canAffordResources(available: Resources, cost: Resources): boolean {
    return Object.entries(cost).every(
      ([resource, amount]) => available[resource as keyof Resources] >= amount,
    );
  }

  subtractResources(from: Resources, cost: Resources): Resources {
    const result = { ...from };
    Object.entries(cost).forEach(([resource, amount]) => {
      result[resource as keyof Resources] -= amount;
    });
    return result;
  }

  addResources(to: Resources, amount: Resources): Resources {
    const result = { ...to };
    Object.entries(amount).forEach(([resource, value]) => {
      result[resource as keyof Resources] += value;
    });
    return result;
  }

  getTotalResourceAmount(resources: Resources): number {
    return Object.values(resources).reduce((sum, amount) => sum + amount, 0);
  }
}

export const gameState = GameStateManager.getInstance();
