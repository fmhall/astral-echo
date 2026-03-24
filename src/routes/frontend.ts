import { Hono } from "hono";
import { html } from "hono/html";

export const frontendRoutes = new Hono();

frontendRoutes.get("/spectate", (c) => {
	return c.html(html`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Astral Echo — Spectator</title>
<style>
  :root {
    --bg: #0a0e17;
    --surface: #111827;
    --surface2: #1a2235;
    --border: #1e293b;
    --text: #e2e8f0;
    --text-dim: #94a3b8;
    --accent: #38bdf8;
    --green: #4ade80;
    --red: #f87171;
    --orange: #fb923c;
    --purple: #a78bfa;
    --yellow: #fbbf24;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'SF Mono', 'Fira Code', 'JetBrains Mono', monospace;
    background: var(--bg);
    color: var(--text);
    min-height: 100vh;
    overflow-x: hidden;
  }
  .header {
    background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%);
    border-bottom: 1px solid var(--border);
    padding: 1rem 2rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .header h1 {
    font-size: 1.5rem;
    background: linear-gradient(90deg, var(--accent), var(--purple));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  .header .tick-info {
    display: flex;
    gap: 1.5rem;
    font-size: 0.85rem;
    color: var(--text-dim);
  }
  .header .tick-info .value {
    color: var(--accent);
    font-weight: bold;
  }
  .header .status-badge {
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: bold;
    text-transform: uppercase;
  }
  .status-running { background: rgba(74,222,128,0.15); color: var(--green); }
  .status-paused { background: rgba(251,191,36,0.15); color: var(--yellow); }
  .layout {
    display: grid;
    grid-template-columns: 1fr 380px;
    grid-template-rows: 1fr 320px;
    gap: 1px;
    height: calc(100vh - 60px);
    background: var(--border);
  }
  .panel {
    background: var(--surface);
    padding: 1rem;
    overflow: auto;
  }
  .panel h2 {
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--text-dim);
    margin-bottom: 0.75rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .panel h2 .count {
    background: var(--surface2);
    padding: 0.1rem 0.5rem;
    border-radius: 9999px;
    font-size: 0.7rem;
    color: var(--accent);
  }

  /* Galaxy Map Canvas */
  #galaxy-canvas {
    width: 100%;
    height: 100%;
    cursor: crosshair;
  }

  /* Leaderboard */
  .leaderboard-entry {
    display: grid;
    grid-template-columns: 2rem 1fr auto;
    gap: 0.75rem;
    align-items: center;
    padding: 0.5rem 0.75rem;
    border-radius: 0.5rem;
    margin-bottom: 0.25rem;
  }
  .leaderboard-entry:hover { background: var(--surface2); }
  .rank {
    font-weight: bold;
    font-size: 0.9rem;
    color: var(--text-dim);
  }
  .rank-1 { color: var(--yellow); }
  .rank-2 { color: #c0c0c0; }
  .rank-3 { color: #cd7f32; }
  .agent-name { font-weight: 600; }
  .agent-stats {
    font-size: 0.75rem;
    color: var(--text-dim);
    display: flex;
    gap: 0.75rem;
  }
  .agent-credits { color: var(--green); font-weight: bold; }

  /* Activity Feed */
  .feed {
    grid-column: 1 / -1;
  }
  .feed-list {
    display: flex;
    gap: 0.5rem;
    overflow-x: auto;
    padding-bottom: 0.5rem;
  }
  .feed-card {
    flex-shrink: 0;
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: 0.75rem;
    padding: 0.75rem 1rem;
    min-width: 200px;
    max-width: 280px;
  }
  .feed-card .port-name {
    font-weight: 600;
    font-size: 0.85rem;
    margin-bottom: 0.5rem;
    color: var(--accent);
  }
  .price-row {
    display: flex;
    justify-content: space-between;
    font-size: 0.75rem;
    padding: 0.15rem 0;
    border-bottom: 1px solid rgba(255,255,255,0.05);
  }
  .price-row .resource { color: var(--text-dim); }
  .price-row .buy { color: var(--red); }
  .price-row .sell { color: var(--green); }

  /* Ships list */
  .ship-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.35rem 0.5rem;
    border-radius: 0.375rem;
    font-size: 0.8rem;
    margin-bottom: 0.15rem;
  }
  .ship-item:hover { background: var(--surface2); }
  .ship-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .ship-dot.docked { background: var(--green); }
  .ship-dot.traveling { background: var(--orange); }
  .ship-dot.harvesting { background: var(--yellow); }
  .ship-dot.idle { background: var(--text-dim); }
  .ship-dot.manufacturing { background: var(--purple); }
  .ship-dot.destroyed { background: var(--red); }
  .ship-agent { color: var(--text-dim); font-size: 0.7rem; }

  /* Tooltip */
  #tooltip {
    position: fixed;
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: 0.5rem;
    padding: 0.5rem 0.75rem;
    font-size: 0.75rem;
    pointer-events: none;
    display: none;
    z-index: 999;
    max-width: 250px;
  }
  #tooltip .tt-name { font-weight: 700; color: var(--accent); }
  #tooltip .tt-type { color: var(--text-dim); font-size: 0.7rem; }

  .no-data { color: var(--text-dim); font-style: italic; font-size: 0.8rem; padding: 1rem 0; }

  @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
  .live-dot {
    display: inline-block; width:6px; height:6px;
    background: var(--green); border-radius:50%;
    animation: pulse 2s infinite;
    margin-right: 0.25rem;
  }
</style>
</head>
<body>
<div class="header">
  <h1>ASTRAL ECHO</h1>
  <div class="tick-info">
    <span>Tick <span class="value" id="tick-num">—</span></span>
    <span id="status-badge" class="status-badge status-paused">paused</span>
    <span>Systems <span class="value" id="system-count">—</span></span>
    <span>Agents <span class="value" id="agent-count">—</span></span>
    <span>Ships <span class="value" id="ship-count">—</span></span>
  </div>
</div>

<div class="layout">
  <div class="panel" id="map-panel">
    <h2>Galaxy Map</h2>
    <canvas id="galaxy-canvas"></canvas>
  </div>

  <div class="panel" id="sidebar">
    <h2>Leaderboard <span class="count" id="lb-count">0</span></h2>
    <div id="leaderboard"></div>

    <h2 style="margin-top:1rem">Ships <span class="count" id="ships-count">0</span></h2>
    <div id="ships-list"></div>
  </div>

  <div class="panel feed">
    <h2><span class="live-dot"></span> Port Markets</h2>
    <div class="feed-list" id="port-feed"></div>
  </div>
</div>

<div id="tooltip"></div>

<script>
const API = '';
let worldData = null;
let systemsData = [];
let leaderboardData = [];
let portsData = [];
let shipsData = [];
let allAgents = {};
let canvasObjects = [];

// ── Fetch helpers ────────────────────────────────────────────────────────────

async function fetchJSON(path) {
  try {
    const r = await fetch(API + path);
    if (!r.ok) return null;
    return r.json();
  } catch { return null; }
}

// ── Data loading ─────────────────────────────────────────────────────────────

async function loadWorld() {
  worldData = await fetchJSON('/world');
  if (!worldData) return;
  document.getElementById('tick-num').textContent = worldData.tick;
  document.getElementById('system-count').textContent = worldData.systemCount;
  document.getElementById('agent-count').textContent = worldData.agentCount;
  document.getElementById('ship-count').textContent = worldData.shipCount;
  const badge = document.getElementById('status-badge');
  badge.textContent = worldData.status;
  badge.className = 'status-badge status-' + worldData.status;
}

async function loadSystems() {
  systemsData = await fetchJSON('/systems') || [];
  // Load detailed system data
  const detailed = await Promise.all(
    systemsData.map(s => fetchJSON('/systems/' + s.id))
  );
  systemsData = detailed.filter(Boolean);
}

async function loadLeaderboard() {
  leaderboardData = await fetchJSON('/leaderboard') || [];
  // Cache agent names
  for (const e of leaderboardData) {
    allAgents[e.agentId] = e.name;
  }
  renderLeaderboard();
}

async function loadPorts() {
  if (!systemsData.length) return;
  const portIds = systemsData.flatMap(s => s.ports.map(p => p.id));
  portsData = (await Promise.all(portIds.map(id => fetchJSON('/ports/' + id)))).filter(Boolean);
  renderPorts();
}

async function loadShips() {
  // We get ships from leaderboard agents
  shipsData = [];
  for (const entry of leaderboardData) {
    const agent = await fetchJSON('/agents/' + entry.agentId);
    if (agent && agent.ships) {
      for (const s of agent.ships) {
        const detail = await fetchJSON('/ships/' + s.id);
        if (detail) shipsData.push(detail);
      }
    }
  }
  renderShips();
}

// ── Renderers ────────────────────────────────────────────────────────────────

function renderLeaderboard() {
  const el = document.getElementById('leaderboard');
  document.getElementById('lb-count').textContent = leaderboardData.length;
  if (!leaderboardData.length) {
    el.innerHTML = '<div class="no-data">No agents yet. Waiting for probes...</div>';
    return;
  }
  el.innerHTML = leaderboardData.map((e, i) => {
    const rankClass = i < 3 ? ' rank-' + (i+1) : '';
    return '<div class="leaderboard-entry">' +
      '<span class="rank' + rankClass + '">#' + (i+1) + '</span>' +
      '<div><div class="agent-name">' + esc(e.name) + '</div>' +
      '<div class="agent-stats">' +
      '<span>' + e.shipCount + ' ships</span>' +
      '<span>gen ' + e.maxGeneration + '</span>' +
      '</div></div>' +
      '<span class="agent-credits">' + e.credits.toFixed(0) + 'c</span>' +
      '</div>';
  }).join('');
}

function renderPorts() {
  const el = document.getElementById('port-feed');
  el.innerHTML = portsData.map(port => {
    const rows = port.prices.map(p =>
      '<div class="price-row">' +
      '<span class="resource">' + p.resource.replace('_', ' ') + '</span>' +
      '<span class="buy">B:' + p.buyPrice.toFixed(2) + '</span>' +
      '<span class="sell">S:' + p.sellPrice.toFixed(2) + '</span>' +
      '</div>'
    ).join('');
    return '<div class="feed-card">' +
      '<div class="port-name">' + esc(port.name) + '</div>' +
      rows + '</div>';
  }).join('');
}

function renderShips() {
  const el = document.getElementById('ships-list');
  document.getElementById('ships-count').textContent = shipsData.length;
  if (!shipsData.length) {
    el.innerHTML = '<div class="no-data">No ships yet.</div>';
    return;
  }
  el.innerHTML = shipsData.map(s => {
    const agentName = allAgents[s.agentId] || s.agentId.slice(0,8);
    return '<div class="ship-item">' +
      '<span class="ship-dot ' + s.status + '"></span>' +
      '<span>' + esc(s.name) + '</span>' +
      '<span class="ship-agent">' + esc(agentName) + '</span>' +
      '</div>';
  }).join('');
}

// ── Galaxy Canvas ────────────────────────────────────────────────────────────

function renderGalaxy() {
  const canvas = document.getElementById('galaxy-canvas');
  const panel = document.getElementById('map-panel');
  canvas.width = panel.clientWidth - 32;
  canvas.height = panel.clientHeight - 48;
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;

  ctx.fillStyle = '#0a0e17';
  ctx.fillRect(0, 0, W, H);

  // Draw subtle grid
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 50) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = 0; y < H; y += 50) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }

  // Draw stars in background
  for (let i = 0; i < 100; i++) {
    const sx = Math.random() * W;
    const sy = Math.random() * H;
    const brightness = 0.1 + Math.random() * 0.3;
    ctx.fillStyle = 'rgba(255,255,255,' + brightness + ')';
    ctx.beginPath();
    ctx.arc(sx, sy, Math.random() * 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  if (!systemsData.length) return;

  // Calculate bounds
  const allX = systemsData.map(s => s.position.x);
  const allY = systemsData.map(s => s.position.y);
  const minX = Math.min(...allX) - 50;
  const maxX = Math.max(...allX) + 50;
  const minY = Math.min(...allY) - 50;
  const maxY = Math.max(...allY) + 50;
  const scaleX = (W - 80) / (maxX - minX || 1);
  const scaleY = (H - 80) / (maxY - minY || 1);
  const scale = Math.min(scaleX, scaleY);

  function toScreen(x, y) {
    return [
      40 + (x - minX) * scale,
      40 + (y - minY) * scale
    ];
  }

  canvasObjects = [];

  // Draw route lines between systems
  ctx.strokeStyle = 'rgba(56,189,248,0.1)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  for (let i = 0; i < systemsData.length; i++) {
    for (let j = i+1; j < systemsData.length; j++) {
      const [x1, y1] = toScreen(systemsData[i].position.x, systemsData[i].position.y);
      const [x2, y2] = toScreen(systemsData[j].position.x, systemsData[j].position.y);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  }
  ctx.setLineDash([]);

  // Draw systems
  for (const sys of systemsData) {
    const [sx, sy] = toScreen(sys.position.x, sys.position.y);

    // Glow
    const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, 40);
    grad.addColorStop(0, 'rgba(56,189,248,0.15)');
    grad.addColorStop(1, 'rgba(56,189,248,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(sx, sy, 40, 0, Math.PI * 2);
    ctx.fill();

    // System dot
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(sx, sy, 6, 0, Math.PI * 2);
    ctx.fill();

    // Bodies as smaller dots
    if (sys.bodies) {
      for (const body of sys.bodies) {
        const [bx, by] = toScreen(body.position.x, body.position.y);
        const colors = {
          star: '#fbbf24', planet: '#4ade80', asteroid: '#94a3b8',
          gas_giant: '#fb923c', moon: '#c4b5fd', asteroid_belt: '#64748b'
        };
        ctx.fillStyle = colors[body.type] || '#94a3b8';
        const r = body.type === 'star' ? 4 : 3;
        ctx.beginPath();
        ctx.arc(bx, by, r, 0, Math.PI * 2);
        ctx.fill();

        canvasObjects.push({ x: bx, y: by, r: r + 3, name: body.name, type: body.type, data: body });
      }
    }

    // Label
    ctx.fillStyle = 'rgba(226,232,240,0.9)';
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(sys.name, sx, sy - 14);

    // Port indicator
    if (sys.ports && sys.ports.length) {
      ctx.fillStyle = 'rgba(74,222,128,0.6)';
      ctx.font = '9px monospace';
      ctx.fillText(sys.ports.length + ' port' + (sys.ports.length > 1 ? 's' : ''), sx, sy + 20);
    }

    canvasObjects.push({ x: sx, y: sy, r: 12, name: sys.name, type: 'system', data: sys });
  }

  // Draw ships
  for (const ship of shipsData) {
    const [shx, shy] = toScreen(ship.position.x, ship.position.y);
    const statusColors = {
      docked: '#4ade80', traveling: '#fb923c', harvesting: '#fbbf24',
      idle: '#94a3b8', manufacturing: '#a78bfa', destroyed: '#f87171'
    };
    ctx.fillStyle = statusColors[ship.status] || '#94a3b8';

    // Triangle ship marker
    ctx.beginPath();
    ctx.moveTo(shx, shy - 5);
    ctx.lineTo(shx - 4, shy + 4);
    ctx.lineTo(shx + 4, shy + 4);
    ctx.closePath();
    ctx.fill();

    canvasObjects.push({ x: shx, y: shy, r: 8, name: ship.name, type: 'ship (' + ship.status + ')', data: ship });
  }
}

// ── Tooltip ──────────────────────────────────────────────────────────────────

document.getElementById('galaxy-canvas').addEventListener('mousemove', (e) => {
  const rect = e.target.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const tt = document.getElementById('tooltip');

  const hit = canvasObjects.find(o =>
    Math.sqrt((o.x - mx) ** 2 + (o.y - my) ** 2) < o.r
  );

  if (hit) {
    let info = '<div class="tt-name">' + esc(hit.name) + '</div><div class="tt-type">' + hit.type + '</div>';
    if (hit.data.resources) {
      const r = hit.data.resources;
      info += '<div style="margin-top:0.25rem;font-size:0.7rem;color:#94a3b8">';
      if (r.energy > 0) info += 'E:' + r.energy + ' ';
      if (r.metal > 0) info += 'M:' + r.metal + ' ';
      if (r.silicon > 0) info += 'Si:' + r.silicon + ' ';
      if (r.hydrogen > 0) info += 'H:' + r.hydrogen + ' ';
      if (r.rare_elements > 0) info += 'RE:' + r.rare_elements;
      info += '</div>';
    }
    if (hit.data.cargo) {
      const c = hit.data.cargo;
      info += '<div style="margin-top:0.25rem;font-size:0.7rem;color:#94a3b8">';
      info += 'Cargo: E:' + c.energy + ' M:' + c.metal + ' Si:' + c.silicon + ' H:' + c.hydrogen + ' RE:' + c.rare_elements;
      info += '</div>';
    }
    tt.innerHTML = info;
    tt.style.display = 'block';
    tt.style.left = (e.clientX + 12) + 'px';
    tt.style.top = (e.clientY + 12) + 'px';
  } else {
    tt.style.display = 'none';
  }
});

// ── Escape HTML ──────────────────────────────────────────────────────────────

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

// ── Main loop ────────────────────────────────────────────────────────────────

async function refresh() {
  await loadWorld();
  await loadSystems();
  await loadLeaderboard();
  await loadPorts();
  await loadShips();
  renderGalaxy();
}

refresh();
setInterval(refresh, 5000);
window.addEventListener('resize', renderGalaxy);
</script>
</body>
</html>`);
});
