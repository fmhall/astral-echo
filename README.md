# 🌌 Astral Echo - Self-Replicating Probe Simulation

An intelligent, self-replicating space probe simulator built with Hatchet task orchestration and AI SDK for autonomous decision-making.

## 🎮 Game Overview

Astral Echo simulates autonomous space probes that can:

- **Explore** solar systems and celestial bodies
- **Harvest** resources from planets and asteroids
- **Manufacture** new probes using collected resources
- **Replicate** their intelligence and memory to offspring
- **Expand** across the galaxy through strategic decision-making

Each probe is controlled by an AI agent that makes strategic decisions based on:

- Current resource levels and storage capacity
- Environmental scanning and celestial body analysis
- Memory of past experiences and discoveries
- Knowledge of other probes in the network
- Long-term survival and expansion goals

## 🏗️ Architecture

The game follows **12-factor agent principles** and uses:

### Core Systems

- **Game State Manager**: Singleton managing the entire simulation state
- **Deterministic Tasks**: Core actions like movement, scanning, harvesting
- **AI Agent Tasks**: Intelligent decision-making using OpenAI GPT-4o
- **Simulation Orchestrator**: Coordinates all probes across simulation ticks

### Task Architecture (Hatchet)

```
📁 State Tasks (Deterministic)
├── get-probe-state
├── get-environment-state
├── get-solar-system-state
└── scan-for-resources

📁 Action Tasks (Deterministic)
├── travel-to-position
├── harvest-resources
└── manufacture-probe

📁 AI Agent Tasks (Intelligent)
└── run-probe-agent

📁 Simulation Tasks (Orchestrator)
├── run-astral-echo-simulation
└── get-simulation-status
```

### Technology Stack

- **Hatchet**: Task orchestration and workflow management
- **AI SDK + OpenAI**: Intelligent agent decision-making
- **TypeScript**: Type-safe game logic
- **Zod**: Schema validation and type safety
- **UUID**: Unique entity identification

## 🚀 Setup & Installation

### Prerequisites

1. **Hatchet Account**: Sign up at [hatchet.run](https://hatchet.run)
2. **OpenAI API Key**: Get one from [OpenAI](https://openai.com)

### Installation

```bash
# Install dependencies
bun install

# Set up environment variables
cp .env.example .env
# Edit .env with your API keys:
# HATCHET_CLIENT_TOKEN=your_hatchet_token
# OPENAI_API_KEY=your_openai_api_key
```

### Environment Variables

Create a `.env` file with:

```env
HATCHET_CLIENT_TOKEN=your_hatchet_token_here
OPENAI_API_KEY=your_openai_api_key_here
```

## 🎯 Running the Simulation

### Start the Worker

```bash
# Start the Hatchet worker (supports hot reloading)
bun dev
# or
bun run src/main.ts
```

### Run Simulation Commands

```bash
# Get current status
bun run src/game/runner.ts status

# Start a simulation (20 ticks, 2s between ticks)
bun run src/game/runner.ts start
```

## 🛸 Game Mechanics

### Probes

Each probe has:

- **Resources**: Energy, Metal, Silicon, Hydrogen, Rare Elements
- **Capabilities**: Speed, harvest rate, sensor/communication range, storage
- **Memory**: Visited systems, discovered resources, known probes, experiences
- **Status**: Active, traveling, harvesting, manufacturing, etc.

### Resource Management

- **Energy**: Required for movement and basic operations
- **Materials**: Metal, Silicon, Hydrogen, Rare Elements for manufacturing
- **Storage Limits**: Probes have finite storage capacity
- **Harvesting**: Extract resources from celestial bodies

### Probe Replication

Manufacturing cost:

- Energy: 1000
- Metal: 500
- Silicon: 300
- Hydrogen: 200
- Rare Elements: 50

New probes inherit parent's memory and start with basic resources.

### AI Decision Making

Each probe's AI agent considers:

- **Survival**: Maintain energy levels and avoid destruction
- **Resource Gathering**: Efficiently harvest materials
- **Expansion**: Replicate when resources allow
- **Exploration**: Discover new systems and opportunities
- **Coordination**: Leverage knowledge from other probes

## 🌟 Game Features

### Deterministic Tasks

- **State Queries**: Get probe/environment/system information
- **Movement**: Travel between celestial bodies with energy costs
- **Resource Operations**: Scan and harvest from planets/asteroids
- **Manufacturing**: Create new probes with inherited intelligence

### Intelligent Behaviors

- **Strategic Planning**: AI analyzes situation and plans actions
- **Priority Management**: Balance survival vs expansion vs exploration
- **Resource Optimization**: Efficient harvesting and storage management
- **Risk Assessment**: Evaluate energy costs vs potential gains

### Simulation Features

- **Parallel Processing**: All probes act simultaneously each tick
- **Generational Evolution**: Track probe generations and lineages
- **Real-time Logging**: Detailed console output of all actions
- **Statistics Tracking**: Monitor population, resources, exploration

## 🔧 Architecture Highlights

### 12-Factor Agent Principles

1. **Modular Design**: Separate deterministic and AI-powered tasks
2. **State Management**: Centralized, consistent game state
3. **Error Handling**: Graceful failure and recovery
4. **Observability**: Comprehensive logging and monitoring
5. **Scalability**: Parallel probe execution

### Orchestrator-Worker Pattern

- **Orchestrator**: Simulation manager coordinates probe actions
- **Workers**: Individual probe AI agents make decisions
- **Deterministic Tools**: Core game mechanics as reusable tasks

### AI Integration

- **Structured Output**: Zod schemas ensure valid AI decisions
- **Context Awareness**: Rich environmental and state information
- **Strategic Reasoning**: Long-term planning with immediate actions

## 📊 Monitoring & Debugging

The simulation provides extensive logging:

- **🌌 Simulation Events**: Tick progress and timing
- **🛸 Probe Actions**: Individual probe decisions and results
- **🤖 AI Reasoning**: Strategic plans and action explanations
- **📊 Statistics**: Population, resources, generations
- **⚡ Performance**: Execution times and error tracking

## 🚧 Future Enhancements

Potential improvements:

- **Multi-System Exploration**: Generate new solar systems dynamically
- **Advanced AI Models**: Experiment with different LLMs
- **Probe Specialization**: Different probe types with unique capabilities
- **Communication Networks**: Probe-to-probe information sharing
- **Environmental Challenges**: Hazards, resource depletion, competition
- **Real-time Visualization**: Web UI for watching the simulation
- **Evolutionary Mechanics**: Probe improvements across generations

## 🏆 Success Metrics

Measure simulation success by:

- **Population Growth**: Number of active probes over time
- **Generational Depth**: How many generations are achieved
- **Resource Efficiency**: Resource gathering vs consumption ratios
- **Exploration Coverage**: Number of systems and bodies discovered
- **Survival Duration**: How long the probe network persists

## 🎉 Getting Started

1. Set up environment variables
2. Start the worker with `bun dev`
3. Run `bun run src/game/runner.ts start` to begin simulation
4. Watch as Genesis probe begins exploring and replicating!

The simulation starts with a single probe named "Genesis" in the Sol Prime system. Watch as it scans for resources, harvests materials, and eventually manufactures its first offspring to begin the expansion across the stars! 🌟
