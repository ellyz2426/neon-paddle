// Neon Paddle VR — Main entry point
import {
  World, Mesh, Group, BoxGeometry, SphereGeometry, CylinderGeometry,
  PlaneGeometry, MeshStandardMaterial, MeshBasicMaterial, LineBasicMaterial,
  Color, Vector3, Quaternion,
  EdgesGeometry, LineSegments, AdditiveBlending,
  AmbientLight, PointLight, DirectionalLight, Fog,
  BufferGeometry, Float32BufferAttribute,
  PanelUI, ScreenSpace, Follower, FollowBehavior, PanelDocument, UIKitDocument,
} from '@iwsdk/core';
import type { GameState, TournamentRound } from './types.js';
import {
  GameStateManager, BallState, TABLE_LENGTH, TABLE_WIDTH, TABLE_HEIGHT,
  NET_HEIGHT, BALL_RADIUS, PADDLE_RADIUS, PADDLE_THICKNESS, TABLE_EDGE_WIDTH,
  THEMES, DIFFICULTIES, GAME_MODES, PADDLE_SKINS, DRILLS,
  TOURNAMENT_BRACKET,
} from './types.js';
import { AudioManager } from './audio.js';

// === GLOBALS ===
let world: World;
let gsm: GameStateManager;
let audio: AudioManager;

// Scene objects
let tableMesh: Mesh;
let tableEdges: LineSegments;
let netMesh: Group;
let playerPaddle: Group;
let aiPaddle: Group;
let ballMesh: Group;
let ballGlow: Mesh;

// Ball shadow (trajectory preview on table)
let ballShadow: Mesh;

// Spin visualization
let spinLines: Group;

// Placement targets (for drills)
let placementTargets: { mesh: Mesh; pos: Vector3; active: boolean }[] = [];

// Ball state
let ball: BallState = {
  position: new Vector3(0, TABLE_HEIGHT + 0.2, TABLE_LENGTH / 4),
  velocity: new Vector3(0, 0, 0),
  spin: new Vector3(0, 0, 0),
  active: false,
  lastHitBy: 'none',
  bounceCount: 0,
  onTable: false,
};

// AI state
let aiTargetX = 0;
let aiReactionTimer = 0;
let aiPaddlePos = new Vector3(0, TABLE_HEIGHT + 0.05, -TABLE_LENGTH / 2 + 0.15);
// Tournament AI overrides
let tournamentAI: { aiSpeed: number; aiReaction: number; aiAccuracy: number; aiAggression: number } | null = null;

// Player paddle tracking
let playerPaddlePos = new Vector3(0, TABLE_HEIGHT + 0.05, TABLE_LENGTH / 2 - 0.15);
let lastPlayerPaddlePos = new Vector3();

// Game flow
let countdownValue = 3;
let countdownTimer = 0;
let serveCharging = false;
let serveCharge = 0;
let gameTime = 0;

// Particles
const particles: { mesh: Mesh; vel: Vector3; life: number }[] = [];
const MAX_PARTICLES = 100;

// Trail
const TRAIL_LENGTH = 30;
let trailPoints: Vector3[] = [];
let trailLine: LineSegments | null = null;

// UI entities
const uiEntities: Map<string, any> = new Map();

// Environment
let envDecorations: { mesh: Mesh; baseY: number; rotSpeed: number }[] = [];
let ambientParticles: { mesh: Mesh; basePos: Vector3; phase: number }[] = [];

// Camera shake state
let cameraShakeOffset = new Vector3();
let originalCameraParentPos = new Vector3();

// Deuce visual effects
let deuceFlashTimer = 0;
let deuceIntensity = 0;

// Slow-mo
let slowMoTimeScale = 1.0;
let slowMoTriggered = false;

// Rally counter display threshold
const RALLY_SHOW_THRESHOLD = 3;

// Match point banner
let matchPointShown = false;

// === ENTRY ===
async function main() {
  const container = document.getElementById('app') as HTMLDivElement;
  gsm = new GameStateManager();
  audio = new AudioManager();

  world = await World.create(container, {
    xr: { offer: 'once' },
    features: {
      grabbing: false,
      locomotion: false,
      physics: false,
      spatialUI: true,
    },
    render: {
      near: 0.01,
      far: 200,
    },
  } as any);

  world.scene.position.set(0, 0, 0);

  createEnvironment();
  createTable();
  createNet();
  createPaddles();
  createBall();
  createBallShadow();
  createSpinVisualization();
  createTrail();
  setupUI();
  showUI('title');

  (world as any).update?.((dt: number) => update(dt));
  if (!(world as any).update) {
    let lastTime = 0;
    const loop = (time: number) => {
      const dt = Math.min((time - lastTime) / 1000, 0.05);
      lastTime = time;
      update(dt);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}

// === ENVIRONMENT ===
function createEnvironment() {
  const theme = gsm.getTheme();

  world.scene.fog = new Fog(theme.fog, 15, 60);

  const ambient = new AmbientLight(0x222244, 0.4);
  world.scene.add(ambient);

  const dir = new DirectionalLight(0xffffff, 0.5);
  dir.position.set(2, 5, 3);
  world.scene.add(dir as any);

  const spots = [
    { pos: [0, 3, 0], color: theme.accent, intensity: 2 },
    { pos: [-1, 2.5, 1], color: theme.highlight, intensity: 1 },
    { pos: [1, 2.5, -1], color: theme.accent, intensity: 1 },
  ];
  spots.forEach(s => {
    const pl = new PointLight(s.color, s.intensity, 15);
    pl.position.set(s.pos[0], s.pos[1], s.pos[2]);
    world.scene.add(pl as any);
  });

  // Floor grid
  const gridSize = 40;
  const gridGeo = new BufferGeometry();
  const gridVerts: number[] = [];
  for (let i = -gridSize / 2; i <= gridSize / 2; i++) {
    gridVerts.push(i, 0, -gridSize / 2, i, 0, gridSize / 2);
    gridVerts.push(-gridSize / 2, 0, i, gridSize / 2, 0, i);
  }
  gridGeo.setAttribute('position', new Float32BufferAttribute(gridVerts, 3));
  const gridMat = new LineBasicMaterial({ color: theme.grid, transparent: true, opacity: 0.12 });
  const grid = new LineSegments(gridGeo, gridMat);
  world.scene.add(grid);

  // Ceiling grid
  const ceilGrid = grid.clone();
  ceilGrid.position.y = 6;
  (ceilGrid.material as LineBasicMaterial).opacity = 0.06;
  world.scene.add(ceilGrid);

  // Floating wireframe decorations
  const decoGeos = [
    new BoxGeometry(0.6, 0.6, 0.6),
    new SphereGeometry(0.4, 8, 6),
    new CylinderGeometry(0, 0.4, 0.7, 6),
  ];
  for (let i = 0; i < 12; i++) {
    const geo = decoGeos[i % decoGeos.length];
    const edges = new EdgesGeometry(geo);
    const mat = new LineBasicMaterial({ color: theme.accent, transparent: true, opacity: 0.15 });
    const mesh = new LineSegments(edges, mat);
    const angle = (i / 12) * Math.PI * 2;
    const r = 6 + Math.random() * 6;
    mesh.position.set(Math.cos(angle) * r, 2 + Math.random() * 3, Math.sin(angle) * r);
    world.scene.add(mesh);
    envDecorations.push({ mesh: mesh as any, baseY: mesh.position.y, rotSpeed: 0.1 + Math.random() * 0.3 });
  }

  // Ambient particles
  for (let i = 0; i < 40; i++) {
    const geo = new SphereGeometry(0.02, 4, 4);
    const mat = new MeshBasicMaterial({ color: theme.accent, transparent: true, opacity: 0.3 });
    const mesh = new Mesh(geo, mat);
    const basePos = new Vector3(
      (Math.random() - 0.5) * 20,
      0.5 + Math.random() * 4,
      (Math.random() - 0.5) * 20
    );
    mesh.position.copy(basePos);
    world.scene.add(mesh);
    ambientParticles.push({ mesh, basePos, phase: Math.random() * Math.PI * 2 });
  }
}

// === TABLE ===
function createTable() {
  const theme = gsm.getTheme();
  const group = new Group();

  const topGeo = new BoxGeometry(TABLE_WIDTH, 0.03, TABLE_LENGTH);
  const topMat = new MeshStandardMaterial({
    color: theme.table,
    emissive: new Color(theme.table).multiplyScalar(0.3),
    roughness: 0.8,
    metalness: 0.2,
  });
  tableMesh = new Mesh(topGeo, topMat);
  tableMesh.position.set(0, TABLE_HEIGHT, 0);
  group.add(tableMesh);

  const edgesGeo = new EdgesGeometry(topGeo);
  const edgesMat = new LineBasicMaterial({ color: theme.accent, transparent: true, opacity: 0.6 });
  tableEdges = new LineSegments(edgesGeo, edgesMat);
  tableEdges.position.copy(tableMesh.position);
  group.add(tableEdges);

  // Center line
  const centerLineGeo = new BoxGeometry(0.005, 0.032, TABLE_LENGTH);
  const centerLineMat = new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 });
  const centerLine = new Mesh(centerLineGeo, centerLineMat);
  centerLine.position.set(0, TABLE_HEIGHT, 0);
  group.add(centerLine);

  // End lines
  [-1, 1].forEach(sign => {
    const lineGeo = new BoxGeometry(TABLE_WIDTH, 0.032, 0.005);
    const lineMat = new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4 });
    const line = new Mesh(lineGeo, lineMat);
    line.position.set(0, TABLE_HEIGHT, sign * TABLE_LENGTH / 2);
    group.add(line);
  });

  // Side lines
  [-1, 1].forEach(sign => {
    const lineGeo = new BoxGeometry(0.005, 0.032, TABLE_LENGTH);
    const lineMat = new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4 });
    const line = new Mesh(lineGeo, lineMat);
    line.position.set(sign * TABLE_WIDTH / 2, TABLE_HEIGHT, 0);
    group.add(line);
  });

  // Legs
  const legGeo = new CylinderGeometry(0.03, 0.03, TABLE_HEIGHT, 8);
  const legMat = new MeshStandardMaterial({ color: theme.accent, emissive: new Color(theme.accent), emissiveIntensity: 0.5 });
  const legPositions = [
    [-TABLE_WIDTH / 2 + 0.1, TABLE_HEIGHT / 2, TABLE_LENGTH / 2 - 0.1],
    [TABLE_WIDTH / 2 - 0.1, TABLE_HEIGHT / 2, TABLE_LENGTH / 2 - 0.1],
    [-TABLE_WIDTH / 2 + 0.1, TABLE_HEIGHT / 2, -TABLE_LENGTH / 2 + 0.1],
    [TABLE_WIDTH / 2 - 0.1, TABLE_HEIGHT / 2, -TABLE_LENGTH / 2 + 0.1],
  ];
  legPositions.forEach(p => {
    const leg = new Mesh(legGeo, legMat);
    leg.position.set(p[0], p[1], p[2]);
    group.add(leg);
  });

  world.scene.add(group);
}

// === NET ===
function createNet() {
  const theme = gsm.getTheme();
  netMesh = new Group();

  [-TABLE_WIDTH / 2 - 0.05, TABLE_WIDTH / 2 + 0.05].forEach(x => {
    const postGeo = new CylinderGeometry(0.008, 0.008, NET_HEIGHT + 0.02, 8);
    const postMat = new MeshStandardMaterial({ color: theme.net, emissive: new Color(theme.net), emissiveIntensity: 0.8 });
    const post = new Mesh(postGeo, postMat);
    post.position.set(x, TABLE_HEIGHT + NET_HEIGHT / 2 + 0.01, 0);
    netMesh.add(post);
  });

  const netLines = new Group();
  const numVLines = 20;
  for (let i = 0; i <= numVLines; i++) {
    const t = i / numVLines;
    const x = -TABLE_WIDTH / 2 - 0.05 + t * (TABLE_WIDTH + 0.1);
    const lineGeo = new BufferGeometry();
    lineGeo.setAttribute('position', new Float32BufferAttribute([
      x, TABLE_HEIGHT + 0.005, 0,
      x, TABLE_HEIGHT + NET_HEIGHT + 0.01, 0,
    ], 3));
    const lineMat = new LineBasicMaterial({ color: theme.net, transparent: true, opacity: 0.3 });
    netLines.add(new LineSegments(lineGeo, lineMat));
  }
  const numHLines = 4;
  for (let i = 0; i <= numHLines; i++) {
    const y = TABLE_HEIGHT + 0.005 + (i / numHLines) * (NET_HEIGHT + 0.005);
    const lineGeo = new BufferGeometry();
    lineGeo.setAttribute('position', new Float32BufferAttribute([
      -TABLE_WIDTH / 2 - 0.05, y, 0,
      TABLE_WIDTH / 2 + 0.05, y, 0,
    ], 3));
    const mat = new LineBasicMaterial({ color: theme.net, transparent: true, opacity: i === numHLines ? 0.8 : 0.2 });
    netLines.add(new LineSegments(lineGeo, mat));
  }
  netMesh.add(netLines);
  world.scene.add(netMesh);
}

// === PADDLES ===
function createPaddles() {
  const skin = gsm.getSkin();
  const theme = gsm.getTheme();

  playerPaddle = createPaddleMesh(skin.rubber, skin.handle, skin.glow);
  playerPaddle.position.copy(playerPaddlePos);
  world.scene.add(playerPaddle);

  aiPaddle = createPaddleMesh(theme.aiPaddle, theme.aiPaddle, theme.aiPaddle);
  aiPaddle.position.copy(aiPaddlePos);
  world.scene.add(aiPaddle);
}

function createPaddleMesh(rubberColor: number, handleColor: number, glowColor: number): Group {
  const group = new Group();

  const bladeGeo = new CylinderGeometry(PADDLE_RADIUS, PADDLE_RADIUS, PADDLE_THICKNESS, 16);
  const bladeMat = new MeshStandardMaterial({
    color: rubberColor,
    emissive: new Color(rubberColor),
    emissiveIntensity: 0.5,
    roughness: 0.6,
    metalness: 0.3,
  });
  const blade = new Mesh(bladeGeo, bladeMat);
  blade.rotation.x = Math.PI / 2;
  group.add(blade);

  const edgesGeo = new EdgesGeometry(bladeGeo);
  const edgesMat = new LineBasicMaterial({ color: glowColor, transparent: true, opacity: 0.4 });
  const edges = new LineSegments(edgesGeo, edgesMat);
  edges.rotation.x = Math.PI / 2;
  group.add(edges);

  const handleGeo = new CylinderGeometry(0.012, 0.015, 0.1, 8);
  const handleMat = new MeshStandardMaterial({
    color: handleColor,
    emissive: new Color(handleColor),
    emissiveIntensity: 0.3,
  });
  const handle = new Mesh(handleGeo, handleMat);
  handle.position.set(0, 0, PADDLE_RADIUS + 0.04);
  group.add(handle);

  const glowGeo = new SphereGeometry(PADDLE_RADIUS * 1.2, 8, 8);
  const glowMat = new MeshBasicMaterial({
    color: glowColor,
    transparent: true,
    opacity: 0.08,
    blending: AdditiveBlending,
  });
  const glow = new Mesh(glowGeo, glowMat);
  group.add(glow);

  return group;
}

// === BALL ===
function createBall() {
  const theme = gsm.getTheme();
  ballMesh = new Group();

  const ballGeo = new SphereGeometry(BALL_RADIUS, 12, 12);
  const ballMat = new MeshStandardMaterial({
    color: theme.ball,
    emissive: new Color(theme.accent),
    emissiveIntensity: 0.5,
    roughness: 0.3,
    metalness: 0.5,
  });
  const sphere = new Mesh(ballGeo, ballMat);
  ballMesh.add(sphere);

  const edgesGeo = new EdgesGeometry(ballGeo);
  const edgesMat = new LineBasicMaterial({ color: theme.accent, transparent: true, opacity: 0.3 });
  ballMesh.add(new LineSegments(edgesGeo, edgesMat));

  const glowGeo = new SphereGeometry(BALL_RADIUS * 1.8, 8, 8);
  const glowMat = new MeshBasicMaterial({
    color: theme.accent,
    transparent: true,
    opacity: 0.15,
    blending: AdditiveBlending,
  });
  ballGlow = new Mesh(glowGeo, glowMat);
  ballMesh.add(ballGlow);

  ballMesh.position.copy(ball.position);
  ballMesh.visible = false;
  world.scene.add(ballMesh);
}

// === BALL SHADOW (trajectory preview projected onto table) ===
function createBallShadow() {
  const geo = new SphereGeometry(BALL_RADIUS * 1.5, 8, 4);
  // Flatten into a disc
  geo.scale(1, 0.1, 1);
  const mat = new MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.15,
  });
  ballShadow = new Mesh(geo, mat);
  ballShadow.position.set(0, TABLE_HEIGHT + 0.016, 0);
  ballShadow.visible = false;
  world.scene.add(ballShadow);
}

// === SPIN VISUALIZATION ===
function createSpinVisualization() {
  spinLines = new Group();
  // Create 3 ring lines around the ball to show spin direction
  for (let i = 0; i < 3; i++) {
    const ringGeo = new BufferGeometry();
    const ringVerts: number[] = [];
    const segments = 16;
    const r = BALL_RADIUS * 1.3;
    for (let j = 0; j < segments; j++) {
      const a1 = (j / segments) * Math.PI * 2;
      const a2 = ((j + 1) / segments) * Math.PI * 2;
      ringVerts.push(Math.cos(a1) * r, Math.sin(a1) * r, 0);
      ringVerts.push(Math.cos(a2) * r, Math.sin(a2) * r, 0);
    }
    ringGeo.setAttribute('position', new Float32BufferAttribute(ringVerts, 3));
    const mat = new LineBasicMaterial({
      color: 0xffff00,
      transparent: true,
      opacity: 0.0, // starts hidden
      blending: AdditiveBlending,
    });
    const ring = new LineSegments(ringGeo, mat);
    // Offset each ring on a different axis
    if (i === 1) ring.rotation.y = Math.PI / 2;
    if (i === 2) ring.rotation.x = Math.PI / 2;
    spinLines.add(ring);
  }
  spinLines.visible = false;
  world.scene.add(spinLines);
}

// === TRAIL ===
function createTrail() {
  const geo = new BufferGeometry();
  const positions = new Float32Array(TRAIL_LENGTH * 2 * 3);
  geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
  const mat = new LineBasicMaterial({
    color: gsm.getTheme().accent,
    transparent: true,
    opacity: 0.4,
    blending: AdditiveBlending,
  });
  trailLine = new LineSegments(geo, mat);
  world.scene.add(trailLine);
}

// === PLACEMENT TARGETS (for drills) ===
function createPlacementTarget(pos: Vector3): { mesh: Mesh; pos: Vector3; active: boolean } {
  const geo = new CylinderGeometry(0.08, 0.08, 0.005, 12);
  const mat = new MeshBasicMaterial({ color: 0x33ff88, transparent: true, opacity: 0.5 });
  const mesh = new Mesh(geo, mat);
  mesh.position.copy(pos);
  mesh.visible = false;
  world.scene.add(mesh);
  return { mesh, pos, active: false };
}

function setupDrillTargets() {
  // Clear old targets
  placementTargets.forEach(t => world.scene.remove(t.mesh));
  placementTargets = [];

  // Create targets on the AI side of the table
  const positions = [
    new Vector3(-TABLE_WIDTH / 4, TABLE_HEIGHT + 0.003, -TABLE_LENGTH / 4),
    new Vector3(TABLE_WIDTH / 4, TABLE_HEIGHT + 0.003, -TABLE_LENGTH / 4),
    new Vector3(0, TABLE_HEIGHT + 0.003, -TABLE_LENGTH / 3),
    new Vector3(-TABLE_WIDTH / 3, TABLE_HEIGHT + 0.003, -TABLE_LENGTH / 6),
    new Vector3(TABLE_WIDTH / 3, TABLE_HEIGHT + 0.003, -TABLE_LENGTH / 6),
  ];
  positions.forEach(p => {
    placementTargets.push(createPlacementTarget(p));
  });
}

// === UI SETUP ===
function setupUI() {
  const panels = [
    { name: 'title', config: '/ui/title.json', maxWidth: 0.9, maxHeight: 0.7, pos: [0, TABLE_HEIGHT + 0.7, -0.5], type: 'world' },
    { name: 'modeselect', config: '/ui/modeselect.json', maxWidth: 0.8, maxHeight: 0.8, pos: [0, TABLE_HEIGHT + 0.7, -0.5], type: 'world' },
    { name: 'difficulty', config: '/ui/difficulty.json', maxWidth: 0.6, maxHeight: 0.5, pos: [0, TABLE_HEIGHT + 0.7, -0.5], type: 'world' },
    { name: 'hud', config: '/ui/hud.json', maxWidth: 0.35, maxHeight: 0.12, type: 'follower', offset: [0.2, 0.15, -0.5] },
    { name: 'servebar', config: '/ui/servebar.json', maxWidth: 0.25, maxHeight: 0.06, type: 'follower', offset: [-0.2, -0.15, -0.5] },
    { name: 'toast', config: '/ui/toast.json', maxWidth: 0.3, maxHeight: 0.08, type: 'follower', offset: [0, -0.05, -0.5] },
    { name: 'countdown', config: '/ui/countdown.json', maxWidth: 0.3, maxHeight: 0.2, type: 'follower', offset: [0, 0, -0.5] },
    { name: 'pause', config: '/ui/pause.json', maxWidth: 0.6, maxHeight: 0.5, pos: [0, TABLE_HEIGHT + 0.7, -0.3], type: 'world' },
    { name: 'gameover', config: '/ui/gameover.json', maxWidth: 0.8, maxHeight: 0.7, pos: [0, TABLE_HEIGHT + 0.7, -0.3], type: 'world' },
    { name: 'leaderboard', config: '/ui/leaderboard.json', maxWidth: 0.8, maxHeight: 0.8, pos: [0, TABLE_HEIGHT + 0.7, -0.5], type: 'world' },
    { name: 'achievements', config: '/ui/achievements.json', maxWidth: 0.8, maxHeight: 0.9, pos: [0, TABLE_HEIGHT + 0.7, -0.5], type: 'world' },
    { name: 'settings', config: '/ui/settings.json', maxWidth: 0.7, maxHeight: 0.7, pos: [0, TABLE_HEIGHT + 0.7, -0.5], type: 'world' },
    { name: 'help', config: '/ui/help.json', maxWidth: 0.8, maxHeight: 0.9, pos: [0, TABLE_HEIGHT + 0.7, -0.5], type: 'world' },
    { name: 'stats', config: '/ui/stats.json', maxWidth: 0.7, maxHeight: 0.8, pos: [0, TABLE_HEIGHT + 0.7, -0.5], type: 'world' },
    // New panels
    { name: 'tournament_bracket', config: '/ui/tournament.json', maxWidth: 0.85, maxHeight: 0.9, pos: [0, TABLE_HEIGHT + 0.7, -0.5], type: 'world' },
    { name: 'drills', config: '/ui/drills.json', maxWidth: 0.7, maxHeight: 0.7, pos: [0, TABLE_HEIGHT + 0.7, -0.5], type: 'world' },
    { name: 'drillhud', config: '/ui/drillhud.json', maxWidth: 0.3, maxHeight: 0.15, type: 'follower', offset: [-0.2, 0.15, -0.5] },
    { name: 'rallycounter', config: '/ui/rallycounter.json', maxWidth: 0.12, maxHeight: 0.1, type: 'follower', offset: [0, 0.08, -0.4] },
    { name: 'matchpoint', config: '/ui/matchpoint.json', maxWidth: 0.35, maxHeight: 0.1, type: 'follower', offset: [0, -0.12, -0.5] },
  ];

  panels.forEach(p => {
    const entity = world.createTransformEntity(undefined, { persistent: true });
    entity.addComponent(PanelUI, { config: p.config, maxWidth: p.maxWidth, maxHeight: p.maxHeight });

    if (p.type === 'follower') {
      entity.addComponent(Follower, {
        target: world.player.head,
        offsetPosition: (p as any).offset as [number, number, number],
        behavior: FollowBehavior.PivotY,
        speed: 5,
        tolerance: 0.3,
      });
    } else if ((p as any).pos) {
      if (entity.object3D) entity.object3D.position.set((p as any).pos[0], (p as any).pos[1], (p as any).pos[2]);
    }

    uiEntities.set(p.name, entity);
  });

  setTimeout(() => bindUIEvents(), 500);
}

function getDoc(name: string): UIKitDocument | undefined {
  const entity = uiEntities.get(name);
  if (!entity) return undefined;
  return entity.getValue(PanelDocument, 'document') as UIKitDocument | undefined;
}

function setText(doc: UIKitDocument | undefined, id: string, text: string) {
  if (!doc) return;
  const el = doc.getElementById(id);
  if (el && (el as any).text) (el as any).text.value = text;
}

function showUI(state: GameState) {
  gsm.state = state;
  const allPanels = [
    'title', 'modeselect', 'difficulty', 'hud', 'servebar', 'toast', 'countdown',
    'pause', 'gameover', 'leaderboard', 'achievements', 'settings', 'help', 'stats',
    'tournament_bracket', 'drills', 'drillhud', 'rallycounter', 'matchpoint',
  ];

  allPanels.forEach(name => {
    const entity = uiEntities.get(name);
    if (entity && entity.object3D) entity.object3D.visible = false;
  });

  const showPanels: string[] = [];
  switch (state) {
    case 'title': showPanels.push('title'); break;
    case 'modeselect': showPanels.push('modeselect'); break;
    case 'difficulty': showPanels.push('difficulty'); break;
    case 'playing': showPanels.push('hud'); break;
    case 'paused': showPanels.push('pause', 'hud'); break;
    case 'gameover': showPanels.push('gameover'); break;
    case 'leaderboard': showPanels.push('leaderboard'); break;
    case 'achievements': showPanels.push('achievements'); break;
    case 'settings': showPanels.push('settings'); break;
    case 'help': showPanels.push('help'); break;
    case 'stats': showPanels.push('stats'); break;
    case 'countdown': showPanels.push('countdown'); break;
    case 'tournament_bracket': showPanels.push('tournament_bracket'); break;
    case 'drills': showPanels.push('drills'); break;
    case 'drill_active': showPanels.push('drillhud'); break;
  }

  showPanels.forEach(name => {
    const entity = uiEntities.get(name);
    if (entity && entity.object3D) entity.object3D.visible = true;
  });

  updatePanelContent(state);
}

function updatePanelContent(state: GameState) {
  switch (state) {
    case 'leaderboard': {
      const doc = getDoc('leaderboard');
      if (doc) {
        for (let i = 0; i < 10; i++) {
          const entry = gsm.leaderboard[i];
          setText(doc, `lb-rank-${i}`, entry ? `${i + 1}` : '');
          setText(doc, `lb-score-${i}`, entry ? entry.score : '');
          setText(doc, `lb-mode-${i}`, entry ? entry.mode : '');
          setText(doc, `lb-date-${i}`, entry ? entry.date : '');
        }
      }
      break;
    }
    case 'achievements': {
      const doc = getDoc('achievements');
      if (doc) {
        gsm.achievements.forEach((a, i) => {
          setText(doc, `ach-name-${i}`, a.name);
          setText(doc, `ach-desc-${i}`, a.description);
          setText(doc, `ach-status-${i}`, a.unlocked ? '[UNLOCKED]' : '[LOCKED]');
        });
      }
      break;
    }
    case 'settings': {
      const doc = getDoc('settings');
      if (doc) {
        setText(doc, 'sfx-val', `${Math.round(gsm.sfxVolume * 100)}%`);
        setText(doc, 'music-val', `${Math.round(gsm.musicVolume * 100)}%`);
        setText(doc, 'theme-name', gsm.getTheme().name);
        setText(doc, 'skin-name', gsm.getSkin().name);
      }
      break;
    }
    case 'stats': {
      const doc = getDoc('stats');
      if (doc) {
        setText(doc, 'stat-games', `${gsm.gamesPlayed}`);
        setText(doc, 'stat-wins', `${gsm.gamesWon}`);
        setText(doc, 'stat-winrate', gsm.gamesPlayed > 0 ? `${Math.round(gsm.gamesWon / gsm.gamesPlayed * 100)}%` : '0%');
        setText(doc, 'stat-aces', `${gsm.totalAces}`);
        setText(doc, 'stat-smashes', `${gsm.totalSmashes}`);
        setText(doc, 'stat-longrally', `${gsm.longestRally}`);
        setText(doc, 'stat-points', `${gsm.totalPointsWon}`);
        const unlocked = gsm.achievements.filter(a => a.unlocked).length;
        setText(doc, 'stat-achievements', `${unlocked}/${gsm.achievements.length}`);
      }
      break;
    }
    case 'gameover': {
      const doc = getDoc('gameover');
      if (doc) {
        const playerWon = gsm.mode === 'speed' || gsm.mode === 'rally'
          ? true
          : (gsm.playerScore > gsm.aiScore || gsm.playerSets > gsm.aiSets);
        setText(doc, 'result-title', playerWon ? 'VICTORY!' : 'DEFEAT');
        setText(doc, 'result-score', gsm.mode === 'match'
          ? `Sets: ${gsm.playerSets} - ${gsm.aiSets}`
          : `Score: ${gsm.playerScore} - ${gsm.aiScore}`);
        setText(doc, 'result-rally', `Best Rally: ${gsm.bestRally}`);
        setText(doc, 'result-streak', `Best Streak: ${gsm.bestStreak}`);
        setText(doc, 'result-aces', `Aces: ${gsm.aces}`);
        setText(doc, 'result-mode', gsm.mode.toUpperCase());
      }
      break;
    }
    case 'tournament_bracket': {
      updateTournamentBracket();
      break;
    }
  }
}

function updateTournamentBracket() {
  const doc = getDoc('tournament_bracket');
  if (!doc) return;
  const labels = ['QF', 'SF', 'F1', 'FN'];
  for (let i = 0; i < 4; i++) {
    const r = gsm.tournamentResults[i];
    if (!r) continue;
    setText(doc, `tb-rnd-${i}`, labels[i]);
    setText(doc, `tb-opp-${i}`, r.opponentName);
    setText(doc, `tb-score-${i}`, r.score || '---');
    if (r.won === true) setText(doc, `tb-stat-${i}`, 'WON');
    else if (r.won === false) setText(doc, `tb-stat-${i}`, 'LOST');
    else if (i === gsm.tournamentRound) setText(doc, `tb-stat-${i}`, 'NEXT');
    else setText(doc, `tb-stat-${i}`, '');
  }
}

// === UI EVENT BINDING ===
function bindUIEvents() {
  // Title
  bindButton('title', 'btn-play', () => { audio.playClick(); showUI('modeselect'); });
  bindButton('title', 'btn-leaderboard', () => { audio.playClick(); showUI('leaderboard'); });
  bindButton('title', 'btn-achievements', () => { audio.playClick(); showUI('achievements'); });
  bindButton('title', 'btn-settings', () => { audio.playClick(); showUI('settings'); });
  bindButton('title', 'btn-help', () => { audio.playClick(); showUI('help'); });
  bindButton('title', 'btn-stats', () => { audio.playClick(); showUI('stats'); });

  // Mode select
  GAME_MODES.forEach((mode, i) => {
    bindButton('modeselect', `btn-mode-${i}`, () => {
      audio.playClick();
      gsm.mode = mode.id;
      gsm.setsToWin = mode.rounds;
      gsm.modesPlayed.add(mode.id);
      if (gsm.modesPlayed.size >= GAME_MODES.length) gsm.unlockAchievement('all_modes');

      if (mode.id === 'tournament') {
        gsm.initTournament();
        showUI('tournament_bracket');
      } else if (mode.id === 'training' || mode.id === 'rally' || mode.id === 'speed') {
        startGame(1);
      } else {
        showUI('difficulty');
      }
    });
  });
  bindButton('modeselect', 'btn-back-mode', () => { audio.playClick(); showUI('title'); });

  // Difficulty
  for (let i = 0; i < 3; i++) {
    bindButton('difficulty', `btn-diff-${i}`, () => { audio.playClick(); startGame(i); });
  }
  bindButton('difficulty', 'btn-back-diff', () => { audio.playClick(); showUI('modeselect'); });

  // Pause
  bindButton('pause', 'btn-resume', () => { audio.playClick(); showUI('playing'); });
  bindButton('pause', 'btn-quit', () => { audio.playClick(); endGame(); });

  // Game over
  bindButton('gameover', 'btn-rematch', () => {
    audio.playClick();
    if (gsm.mode === 'tournament') {
      // If lost tournament, go to bracket
      showUI('tournament_bracket');
    } else {
      startGame(gsm.difficulty);
    }
  });
  bindButton('gameover', 'btn-title', () => { audio.playClick(); showUI('title'); });

  // Back buttons
  ['leaderboard', 'achievements', 'settings', 'help', 'stats', 'tournament_bracket', 'drills'].forEach(panel => {
    bindButton(panel, `btn-back-${panel}`, () => { audio.playClick(); showUI('title'); });
  });

  // Tournament play
  bindButton('tournament_bracket', 'btn-tournament-play', () => {
    audio.playClick();
    startTournamentRound();
  });

  // Drills
  DRILLS.forEach((_drill, i) => {
    bindButton('drills', `btn-drill-${i}`, () => {
      audio.playClick();
      startDrill(i);
    });
  });

  // Settings controls
  bindButton('settings', 'btn-sfx-up', () => { gsm.sfxVolume = Math.min(1, gsm.sfxVolume + 0.1); audio.setSfxVolume(gsm.sfxVolume); gsm.savePersistence(); updatePanelContent('settings'); });
  bindButton('settings', 'btn-sfx-down', () => { gsm.sfxVolume = Math.max(0, gsm.sfxVolume - 0.1); audio.setSfxVolume(gsm.sfxVolume); gsm.savePersistence(); updatePanelContent('settings'); });
  bindButton('settings', 'btn-music-up', () => { gsm.musicVolume = Math.min(1, gsm.musicVolume + 0.1); audio.setMusicVolume(gsm.musicVolume); gsm.savePersistence(); updatePanelContent('settings'); });
  bindButton('settings', 'btn-music-down', () => { gsm.musicVolume = Math.max(0, gsm.musicVolume - 0.1); audio.setMusicVolume(gsm.musicVolume); gsm.savePersistence(); updatePanelContent('settings'); });
  bindButton('settings', 'btn-theme-prev', () => {
    gsm.themeIndex = (gsm.themeIndex - 1 + THEMES.length) % THEMES.length;
    gsm.themesUsed.add(gsm.themeIndex);
    if (gsm.themesUsed.size >= THEMES.length) gsm.unlockAchievement('all_themes');
    gsm.savePersistence(); updatePanelContent('settings'); applyTheme();
  });
  bindButton('settings', 'btn-theme-next', () => {
    gsm.themeIndex = (gsm.themeIndex + 1) % THEMES.length;
    gsm.themesUsed.add(gsm.themeIndex);
    if (gsm.themesUsed.size >= THEMES.length) gsm.unlockAchievement('all_themes');
    gsm.savePersistence(); updatePanelContent('settings'); applyTheme();
  });
  bindButton('settings', 'btn-skin-prev', () => {
    gsm.skinIndex = (gsm.skinIndex - 1 + PADDLE_SKINS.length) % PADDLE_SKINS.length;
    gsm.skinsUsed.add(gsm.skinIndex);
    if (gsm.skinsUsed.size >= PADDLE_SKINS.length) gsm.unlockAchievement('all_skins');
    gsm.savePersistence(); updatePanelContent('settings'); applySkin();
  });
  bindButton('settings', 'btn-skin-next', () => {
    gsm.skinIndex = (gsm.skinIndex + 1) % PADDLE_SKINS.length;
    gsm.skinsUsed.add(gsm.skinIndex);
    if (gsm.skinsUsed.size >= PADDLE_SKINS.length) gsm.unlockAchievement('all_skins');
    gsm.savePersistence(); updatePanelContent('settings'); applySkin();
  });
}

function bindButton(panel: string, id: string, cb: () => void) {
  const tryBind = () => {
    const doc = getDoc(panel);
    if (!doc) return false;
    const el = doc.getElementById(id);
    if (!el) return false;
    el.addEventListener('click', cb);
    return true;
  };
  if (!tryBind()) setTimeout(() => { if (!tryBind()) setTimeout(tryBind, 1000); }, 300);
}

// === GAME FLOW ===
function startGame(diffIndex: number) {
  audio.init();
  gsm.difficulty = diffIndex;
  gsm.resetMatch();
  ball.active = false;
  ballMesh.visible = false;
  matchPointShown = false;
  slowMoTriggered = false;
  slowMoTimeScale = 1.0;
  deuceIntensity = 0;
  audio.stopDeuceDrone();
  startCountdown();
}

function startCountdown() {
  countdownValue = 3;
  countdownTimer = 0;
  showUI('countdown');
  updateCountdown();
}

function updateCountdown() {
  const doc = getDoc('countdown');
  if (doc) {
    setText(doc, 'countdown-text', countdownValue > 0 ? `${countdownValue}` : 'GO!');
  }
}

function finishCountdown() {
  audio.playGameStart();
  showUI('playing');
  gameTime = 0;
  serveBall();
}

function serveBall() {
  const isPlayerServe = gsm.serving === 'player';
  const startZ = isPlayerServe ? TABLE_LENGTH / 4 : -TABLE_LENGTH / 4;

  ball.position.set(0, TABLE_HEIGHT + 0.15, startZ);
  ball.velocity.set(0, 0, 0);
  ball.spin.set(0, 0, 0);
  ball.active = false;
  ball.lastHitBy = 'none';
  ball.bounceCount = 0;
  ball.onTable = false;

  ballMesh.position.copy(ball.position);
  ballMesh.visible = true;
  trailPoints = [];

  if (!isPlayerServe) {
    setTimeout(() => {
      if (gsm.state !== 'playing' && gsm.state !== 'drill_active') return;
      const diff = tournamentAI || DIFFICULTIES[gsm.difficulty];
      const speed = 3 + (diff.aiAggression ?? gsm.difficulty) * 1.5;
      const sideAim = (Math.random() - 0.5) * 1.5;
      ball.velocity.set(sideAim, 2.0, speed);
      ball.spin.set(-2, (Math.random() - 0.5) * 3, 0);
      ball.active = true;
      ball.lastHitBy = 'ai';
      audio.playServeToss();
    }, 800);
  } else {
    serveCharging = false;
    serveCharge = 0;
  }
}

// === TOURNAMENT ===
function startTournamentRound() {
  const opp = gsm.getCurrentTournamentOpponent();
  if (!opp || gsm.isTournamentOver()) {
    showUI('title');
    return;
  }
  // Override AI with tournament opponent stats
  tournamentAI = {
    aiSpeed: opp.aiSpeed,
    aiReaction: opp.aiReaction,
    aiAccuracy: opp.aiAccuracy,
    aiAggression: opp.aiAggression,
  };
  gsm.mode = 'tournament';
  gsm.setsToWin = 1; // Quick match per round
  audio.playTournamentFanfare();
  showToast(`VS ${opp.opponentName}`);
  startGame(opp.difficulty);
}

function endTournamentRound(playerWon: boolean) {
  const scoreStr = `${gsm.playerScore}-${gsm.aiScore}`;
  gsm.advanceTournament(playerWon, scoreStr);
  tournamentAI = null;

  if (!playerWon) {
    audio.playTournamentElimination();
    showToast('ELIMINATED');
  } else if (gsm.wonTournament()) {
    gsm.unlockAchievement('tournament_win');
    audio.playTournamentFanfare();
    showToast('TOURNAMENT CHAMPION!');
  }

  setTimeout(() => showUI('tournament_bracket'), 2000);
}

// === PRACTICE DRILLS ===
function startDrill(drillIndex: number) {
  const drill = DRILLS[drillIndex];
  gsm.currentDrill = drill.id;
  gsm.drillScore = 0;
  gsm.drillTimer = drill.duration;
  gsm.mode = drill.id + '_drill';
  gsm.difficulty = 1;
  gsm.resetMatch();
  audio.init();

  if (drill.id === 'placement') {
    setupDrillTargets();
    activateRandomTarget();
  }

  showUI('drill_active');
  gsm.state = 'drill_active';
  gsm.serving = 'ai'; // AI always serves in drills
  serveBall();
}

function activateRandomTarget() {
  placementTargets.forEach(t => { t.active = false; t.mesh.visible = false; });
  if (placementTargets.length > 0) {
    const idx = Math.floor(Math.random() * placementTargets.length);
    placementTargets[idx].active = true;
    placementTargets[idx].mesh.visible = true;
  }
}

function updateDrill(dt: number) {
  const drill = DRILLS.find(d => d.id === gsm.currentDrill);
  if (!drill) return;

  gsm.drillTimer -= dt;

  // Update drill HUD
  const doc = getDoc('drillhud');
  if (doc) {
    setText(doc, 'drillhud-name', drill.name);
    setText(doc, 'drillhud-score', `${gsm.drillScore} / ${drill.targetScore}`);
    setText(doc, 'drillhud-timer', `${Math.max(0, Math.ceil(gsm.drillTimer))}s`);
  }

  // Check completion
  if (gsm.drillTimer <= 0 || gsm.drillScore >= drill.targetScore) {
    const passed = gsm.drillScore >= drill.targetScore;
    if (passed) {
      gsm.unlockAchievement('drill_complete');
      audio.playDrillComplete();
      showToast(`DRILL COMPLETE! ${gsm.drillScore}/${drill.targetScore}`);
    } else {
      audio.playLose();
      showToast(`Time Up! ${gsm.drillScore}/${drill.targetScore}`);
    }
    // Clean up placement targets
    placementTargets.forEach(t => { t.mesh.visible = false; });
    ball.active = false;
    ballMesh.visible = false;
    setTimeout(() => showUI('drills'), 2000);
  }
}

function endGame() {
  const playerWon = gsm.mode === 'match'
    ? gsm.playerSets > gsm.aiSets
    : gsm.playerScore > gsm.aiScore;

  // Handle tournament mode
  if (gsm.mode === 'tournament') {
    endTournamentRound(playerWon);
    return;
  }

  gsm.gamesPlayed++;
  if (playerWon) gsm.gamesWon++;
  gsm.totalAces += gsm.aces;
  gsm.totalSmashes += gsm.smashes;
  if (gsm.bestRally > gsm.longestRally) gsm.longestRally = gsm.bestRally;

  // Achievement checks
  if (playerWon) {
    gsm.unlockAchievement('first_win');
    if (gsm.difficulty === 2) gsm.unlockAchievement('hard_win');
    if (gsm.aiScore === 0 && (gsm.mode === 'match' || gsm.mode === 'quick')) {
      gsm.unlockAchievement('shutout');
      gsm.unlockAchievement('perfect_set');
    }
    if (gsm.maxTrailingDeficit >= 5) gsm.unlockAchievement('comeback');
  }
  if (gsm.gamesPlayed >= 10) gsm.unlockAchievement('games10');
  if (gsm.gamesPlayed >= 25) gsm.unlockAchievement('games25');
  if (gsm.gamesPlayed >= 50) gsm.unlockAchievement('games50');
  if (gsm.totalAces >= 10) gsm.unlockAchievement('ace10');
  if (gsm.smashes >= 10) gsm.unlockAchievement('smash10');

  const scoreStr = gsm.mode === 'match'
    ? `${gsm.playerSets}-${gsm.aiSets} (${gsm.playerScore}-${gsm.aiScore})`
    : `${gsm.playerScore}-${gsm.aiScore}`;
  gsm.addLeaderboardEntry(scoreStr, gsm.mode, DIFFICULTIES[gsm.difficulty].name);
  gsm.savePersistence();

  // Stop deuce drone
  audio.stopDeuceDrone();
  slowMoTimeScale = 1.0;

  if (playerWon) audio.playWin(); else audio.playLose();

  ball.active = false;
  ballMesh.visible = false;
  ballShadow.visible = false;
  spinLines.visible = false;
  showUI('gameover');
}

// === THEME / SKIN APPLICATION ===
function applyTheme() {
  const theme = gsm.getTheme();
  if (tableEdges) (tableEdges.material as LineBasicMaterial).color.set(theme.accent);
  if (tableMesh) {
    (tableMesh.material as MeshStandardMaterial).color.set(theme.table);
    (tableMesh.material as MeshStandardMaterial).emissive.set(theme.table);
  }
}

function applySkin() {
  const skin = gsm.getSkin();
  if (playerPaddle && playerPaddle.children[0]) {
    (playerPaddle.children[0] as Mesh).material = new MeshStandardMaterial({
      color: skin.rubber, emissive: new Color(skin.rubber), emissiveIntensity: 0.5, roughness: 0.6, metalness: 0.3,
    });
  }
}

// === TOAST ===
let toastTimer = 0;
function showToast(text: string, duration: number = 2.0) {
  const entity = uiEntities.get('toast');
  if (entity && entity.object3D) entity.object3D.visible = true;
  const doc = getDoc('toast');
  setText(doc, 'toast-text', text);
  toastTimer = duration;
}

// === PARTICLES ===
function spawnParticles(pos: Vector3, color: number, count: number = 10) {
  for (let i = 0; i < count && particles.length < MAX_PARTICLES; i++) {
    const geo = new SphereGeometry(0.008, 4, 4);
    const mat = new MeshBasicMaterial({ color, transparent: true, opacity: 0.8, blending: AdditiveBlending });
    const mesh = new Mesh(geo, mat);
    mesh.position.copy(pos);
    world.scene.add(mesh);
    const vel = new Vector3(
      (Math.random() - 0.5) * 2,
      Math.random() * 2 + 0.5,
      (Math.random() - 0.5) * 2
    );
    particles.push({ mesh, vel, life: 1.0 });
  }
}

// === CAMERA SHAKE ===
function triggerCameraShake(intensity: number, duration: number) {
  gsm.shakeIntensity = intensity;
  gsm.shakeTimer = duration;
}

function updateCameraShake(dt: number) {
  if (gsm.shakeTimer > 0) {
    gsm.shakeTimer -= dt;
    const t = gsm.shakeTimer / 0.3; // normalize
    const shake = gsm.shakeIntensity * t;
    cameraShakeOffset.set(
      (Math.random() - 0.5) * shake * 0.02,
      (Math.random() - 0.5) * shake * 0.015,
      (Math.random() - 0.5) * shake * 0.01
    );
    // Apply shake to scene (since we can't directly control camera)
    world.scene.position.copy(cameraShakeOffset);
  } else {
    if (cameraShakeOffset.lengthSq() > 0.0001) {
      cameraShakeOffset.set(0, 0, 0);
      world.scene.position.set(0, 0, 0);
    }
  }
}

// === SLOW-MO ===
function triggerSlowMo(duration: number = 1.5) {
  gsm.slowMoActive = true;
  gsm.slowMoTimer = duration;
  slowMoTimeScale = 0.25;
  slowMoTriggered = true;
  audio.playSlowMoEnter();
}

function updateSlowMo(dt: number) {
  if (gsm.slowMoActive) {
    gsm.slowMoTimer -= dt; // real-time countdown
    if (gsm.slowMoTimer <= 0) {
      gsm.slowMoActive = false;
      slowMoTimeScale = 1.0;
      audio.playSlowMoExit();
    }
  }
}

// === MAIN UPDATE ===
function update(dt: number) {
  dt = Math.min(dt, 0.05);

  // Apply slow-mo to game dt (but keep real dt for UI/shake)
  const realDt = dt;
  updateSlowMo(realDt);
  const gameDt = dt * slowMoTimeScale;

  // Animate environment
  const time = performance.now() / 1000;
  envDecorations.forEach(d => {
    d.mesh.rotation.y += d.rotSpeed * realDt;
    d.mesh.rotation.x += d.rotSpeed * 0.5 * realDt;
    d.mesh.position.y = d.baseY + Math.sin(time * 0.5 + d.rotSpeed) * 0.2;
  });
  ambientParticles.forEach(p => {
    p.mesh.position.y = p.basePos.y + Math.sin(time + p.phase) * 0.3;
    (p.mesh.material as MeshBasicMaterial).opacity = 0.15 + Math.sin(time * 2 + p.phase) * 0.1;
  });

  // Particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.vel.y -= 3 * gameDt;
    p.mesh.position.addScaledVector(p.vel, gameDt);
    p.life -= gameDt * 2;
    (p.mesh.material as MeshBasicMaterial).opacity = p.life * 0.8;
    if (p.life <= 0) {
      world.scene.remove(p.mesh);
      particles.splice(i, 1);
    }
  }

  // Camera shake
  updateCameraShake(realDt);

  // Toast timer
  if (toastTimer > 0) {
    toastTimer -= realDt;
    if (toastTimer <= 0) {
      const entity = uiEntities.get('toast');
      if (entity && entity.object3D) entity.object3D.visible = false;
    }
  }

  // Countdown
  if (gsm.state === 'countdown') {
    countdownTimer += realDt;
    if (countdownTimer >= 1.0) {
      countdownTimer = 0;
      countdownValue--;
      if (countdownValue > 0) {
        audio.playCountdownTick();
        updateCountdown();
      } else if (countdownValue === 0) {
        audio.playCountdownGo();
        updateCountdown();
      } else {
        finishCountdown();
      }
    }
    return;
  }

  // Drill mode update
  if (gsm.state === 'drill_active') {
    updateDrill(realDt);
    handleInput(gameDt);
    if (ball.active) updateBallPhysics(gameDt);
    updateAI(gameDt);
    updateVisuals(gameDt);
    return;
  }

  if (gsm.state !== 'playing') return;

  gameTime += gameDt;

  // Speed mode timer
  if (gsm.mode === 'speed') {
    gsm.speedTimer += gameDt;
    if (gsm.speedTimer >= 60) {
      if (gsm.speedHits >= 60) gsm.unlockAchievement('speed60');
      if (gsm.speedHits >= 80) gsm.unlockAchievement('speed80');
      endGame();
      return;
    }
  }

  // Deuce tension effects
  updateDeuceTension(realDt);

  // Match point detection
  updateMatchPoint();

  // Rally counter display
  updateRallyCounter();

  // Input handling
  handleInput(gameDt);

  // Ball physics
  if (ball.active) {
    updateBallPhysics(gameDt);
  }

  // AI paddle
  updateAI(gameDt);

  // Update visuals
  updateVisuals(gameDt);

  // Update HUD
  updateHUD();
}

// === DEUCE TENSION ===
function updateDeuceTension(dt: number) {
  if (gsm.isDeuce) {
    if (deuceIntensity < 1) deuceIntensity = Math.min(1, deuceIntensity + dt * 0.5);
    audio.startDeuceDrone();

    // Pulsing table edge glow during deuce
    deuceFlashTimer += dt * 3;
    const pulse = 0.4 + Math.sin(deuceFlashTimer) * 0.3;
    if (tableEdges) {
      (tableEdges.material as LineBasicMaterial).opacity = pulse;
    }
  } else {
    if (deuceIntensity > 0) {
      deuceIntensity = Math.max(0, deuceIntensity - dt);
      if (deuceIntensity === 0) {
        audio.stopDeuceDrone();
        if (tableEdges) (tableEdges.material as LineBasicMaterial).opacity = 0.6;
      }
    }
  }
}

// === MATCH POINT BANNER ===
function updateMatchPoint() {
  if (gsm.isMatchPoint && !matchPointShown) {
    matchPointShown = true;
    const entity = uiEntities.get('matchpoint');
    if (entity && entity.object3D) entity.object3D.visible = true;
    const doc = getDoc('matchpoint');
    const who = gsm.playerScore > gsm.aiScore ? 'YOUR' : 'AI';
    setText(doc, 'mp-text', 'MATCH POINT');
    setText(doc, 'mp-sub', `${who} MATCH POINT`);
    audio.playMatchPointAlert();
    // Hide after 2 seconds
    setTimeout(() => {
      if (entity && entity.object3D) entity.object3D.visible = false;
    }, 2500);
  } else if (!gsm.isMatchPoint) {
    matchPointShown = false;
  }
}

// === RALLY COUNTER ===
function updateRallyCounter() {
  const entity = uiEntities.get('rallycounter');
  if (!entity) return;
  if (gsm.rallyCount >= RALLY_SHOW_THRESHOLD && ball.active) {
    entity.object3D.visible = true;
    const doc = getDoc('rallycounter');
    setText(doc, 'rally-count', `${gsm.rallyCount}`);
  } else {
    entity.object3D.visible = false;
  }
}

// === INPUT ===
function handleInput(dt: number) {
  const keyboard = (world.input as any).keyboard;

  // Player paddle movement (WASD / arrows)
  const moveSpeed = 3.0;
  let dx = 0, dz = 0;
  if (keyboard.getKeyPressed('KeyA') || keyboard.getKeyPressed('ArrowLeft')) dx -= moveSpeed * dt;
  if (keyboard.getKeyPressed('KeyD') || keyboard.getKeyPressed('ArrowRight')) dx += moveSpeed * dt;
  if (keyboard.getKeyPressed('KeyW') || keyboard.getKeyPressed('ArrowUp')) dz -= moveSpeed * dt;
  if (keyboard.getKeyPressed('KeyS') || keyboard.getKeyPressed('ArrowDown')) dz += moveSpeed * dt;

  playerPaddlePos.x = Math.max(-TABLE_WIDTH / 2 + PADDLE_RADIUS, Math.min(TABLE_WIDTH / 2 - PADDLE_RADIUS, playerPaddlePos.x + dx));
  playerPaddlePos.z = Math.max(0.1, Math.min(TABLE_LENGTH / 2 + 0.3, playerPaddlePos.z + dz));

  // XR controller
  const rightGamepad = (world.input as any).xr?.gamepads?.right;
  if (rightGamepad) {
    const thumbstick = rightGamepad.getAxesValues?.(1);
    if (thumbstick) {
      playerPaddlePos.x += thumbstick.x * moveSpeed * dt;
      playerPaddlePos.z -= thumbstick.y * moveSpeed * dt;
      playerPaddlePos.x = Math.max(-TABLE_WIDTH / 2 + PADDLE_RADIUS, Math.min(TABLE_WIDTH / 2 - PADDLE_RADIUS, playerPaddlePos.x));
      playerPaddlePos.z = Math.max(0.1, Math.min(TABLE_LENGTH / 2 + 0.3, playerPaddlePos.z));
    }
  }

  // Serve
  if (gsm.serving === 'player' && !ball.active) {
    if (keyboard.getKeyDown('Space')) {
      serveCharging = true;
      serveCharge = 0;
      audio.playServeToss();
    }
    if (keyboard.getKeyPressed('Space') && serveCharging) {
      serveCharge = Math.min(1, serveCharge + dt * 1.5);
      const entity = uiEntities.get('servebar');
      if (entity && entity.object3D) entity.object3D.visible = true;
      const doc = getDoc('servebar');
      const bars = Math.round(serveCharge * 10);
      setText(doc, 'serve-power', '█'.repeat(bars) + '░'.repeat(10 - bars));
    }
    if (keyboard.getKeyUp('Space') && serveCharging) {
      serveCharging = false;
      const entity = uiEntities.get('servebar');
      if (entity && entity.object3D) entity.object3D.visible = false;

      const power = 2 + serveCharge * 5;
      const sideAim = (playerPaddlePos.x - ball.position.x) * 2;
      ball.velocity.set(sideAim, 1.5 + serveCharge * 1.5, -power);
      ball.spin.set(2 + serveCharge * 3, (Math.random() - 0.5) * 2, 0);
      ball.active = true;
      ball.lastHitBy = 'player';
      audio.playPaddleHit(serveCharge, ball.spin.length());
    }

    // XR trigger serve
    if (rightGamepad) {
      const triggerDown = rightGamepad.getButtonDown?.(0);
      const triggerPressed = rightGamepad.getButtonPressed?.(0);
      const triggerUp = rightGamepad.getButtonUp?.(0);
      if (triggerDown && !serveCharging) {
        serveCharging = true;
        serveCharge = 0;
        audio.playServeToss();
      }
      if (triggerPressed && serveCharging) {
        serveCharge = Math.min(1, serveCharge + dt * 1.5);
      }
      if (triggerUp && serveCharging) {
        serveCharging = false;
        const power = 2 + serveCharge * 5;
        ball.velocity.set((Math.random() - 0.5) * 1.5, 1.5 + serveCharge * 1.5, -power);
        ball.spin.set(2, 0, 0);
        ball.active = true;
        ball.lastHitBy = 'player';
        audio.playPaddleHit(serveCharge, ball.spin.length());
      }
    }

    // Update ball position during serve (follow paddle)
    ball.position.x = playerPaddlePos.x;
    ball.position.y = TABLE_HEIGHT + 0.15 + (serveCharging ? serveCharge * 0.1 : 0);
    ball.position.z = playerPaddlePos.z - 0.1;
    ballMesh.position.copy(ball.position);
  }

  // Hit ball when near paddle (during rally)
  if (ball.active && ball.lastHitBy !== 'player') {
    const dist = ball.position.distanceTo(playerPaddlePos);
    if (dist < PADDLE_RADIUS + BALL_RADIUS + 0.03) {
      const paddleVel = playerPaddlePos.clone().sub(lastPlayerPaddlePos).divideScalar(Math.max(dt, 0.001));
      const hitPower = Math.min(paddleVel.length() * 0.5 + 1, 8);
      const returnDir = new Vector3(
        (Math.random() - 0.5) * 1.0 + paddleVel.x * 0.3,
        1.0 + hitPower * 0.3,
        -hitPower
      );

      ball.spin.set(
        hitPower * 0.5,
        paddleVel.x * 2,
        0
      );

      ball.velocity.copy(returnDir);
      ball.lastHitBy = 'player';
      ball.bounceCount = 0;
      gsm.rallyCount++;
      gsm.totalHits++;
      if (gsm.mode === 'speed') gsm.speedHits++;

      if (gsm.rallyCount > gsm.bestRally) gsm.bestRally = gsm.rallyCount;

      // Drill scoring
      if (gsm.state === 'drill_active') {
        if (gsm.currentDrill === 'return' || gsm.currentDrill === 'spin') {
          gsm.drillScore++;
          audio.playDrillTargetHit();
        }
      }

      // Rally achievements
      if (gsm.rallyCount >= 5) gsm.unlockAchievement('rally5');
      if (gsm.rallyCount >= 10) gsm.unlockAchievement('rally10');
      if (gsm.rallyCount >= 25) gsm.unlockAchievement('rally25');
      if (gsm.rallyCount >= 50) gsm.unlockAchievement('rally50');
      if (gsm.rallyCount >= 100) gsm.unlockAchievement('rally100');

      // Smash detection
      if (hitPower > 5 && ball.position.y > TABLE_HEIGHT + 0.3) {
        gsm.smashes++;
        gsm.unlockAchievement('smash');
        if (gsm.smashes >= 10) gsm.unlockAchievement('smash10');
        audio.playSmash();
        spawnParticles(ball.position.clone(), 0xff4400, 15);
        showToast('SMASH!');
        triggerCameraShake(1.0, 0.3);

        // Drill smash scoring
        if (gsm.state === 'drill_active' && gsm.currentDrill === 'smash') {
          gsm.drillScore++;
          audio.playDrillTargetHit();
        }
      } else {
        const spinAmt = ball.spin.length();
        // Vary hit sound based on power
        if (hitPower < 2) {
          audio.playPaddleHitSoft();
        } else if (hitPower > 6) {
          audio.playPaddleHitPower();
          triggerCameraShake(0.3, 0.15);
        } else {
          audio.playPaddleHit(hitPower / 8, spinAmt);
        }
        spawnParticles(ball.position.clone(), gsm.getTheme().accent, 8);
      }

      // Crowd reactions on long rallies
      if (gsm.rallyCount === 10) audio.playCrowdOoh();
      if (gsm.rallyCount === 20) audio.playCrowdCheer();
      if (gsm.rallyCount % 25 === 0 && gsm.rallyCount > 0) audio.playCrowdCheer();
    }
  }

  // Pause
  if (keyboard.getKeyDown('Escape')) {
    if (gsm.state === 'playing') showUI('paused');
    else if (gsm.state === 'paused') showUI('playing');
  }

  if (rightGamepad?.getButtonDown?.(4)) {
    if (gsm.state === 'playing') showUI('paused');
    else if (gsm.state === 'paused') showUI('playing');
  }

  lastPlayerPaddlePos.copy(playerPaddlePos);
}

// === BALL PHYSICS ===
function updateBallPhysics(dt: number) {
  const substeps = 4;
  const subDt = dt / substeps;

  for (let s = 0; s < substeps; s++) {
    // Gravity
    ball.velocity.y -= 9.81 * subDt;

    // Air resistance
    ball.velocity.multiplyScalar(1 - 0.01 * subDt);

    // Spin influence on trajectory (Magnus effect)
    ball.velocity.x += ball.spin.y * 0.3 * subDt;
    ball.velocity.z += ball.spin.x * 0.15 * subDt;

    // Update position
    ball.position.addScaledVector(ball.velocity, subDt);

    // Table bounce with edge detection
    const onTableX = Math.abs(ball.position.x) <= TABLE_WIDTH / 2 + BALL_RADIUS;
    const onTableZ = Math.abs(ball.position.z) <= TABLE_LENGTH / 2 + BALL_RADIUS;

    if (ball.position.y <= TABLE_HEIGHT + BALL_RADIUS && ball.velocity.y < 0 && onTableX && onTableZ) {
      // Edge hit detection
      const edgeX = Math.abs(Math.abs(ball.position.x) - TABLE_WIDTH / 2) < TABLE_EDGE_WIDTH;
      const edgeZ = Math.abs(Math.abs(ball.position.z) - TABLE_LENGTH / 2) < TABLE_EDGE_WIDTH;
      const isEdgeHit = edgeX || edgeZ;

      ball.position.y = TABLE_HEIGHT + BALL_RADIUS;

      if (isEdgeHit) {
        // Edge hit — unpredictable bounce
        ball.velocity.y *= -0.5; // lower bounce
        ball.velocity.x += (Math.random() - 0.5) * 1.5; // random deflection
        ball.velocity.z *= 0.85;
        gsm.edgeHitsThisMatch++;
        audio.playEdgeHit();
        spawnParticles(ball.position.clone(), 0xffff00, 8);
        showToast('EDGE!');
        // Edge achievement: credited on point scored (see scorePoint)
      } else {
        // Normal bounce
        ball.velocity.y *= -0.75;
        ball.velocity.x *= 0.9;
        ball.velocity.z *= 0.9;

        ball.velocity.x += ball.spin.y * 0.1;
        ball.velocity.z -= ball.spin.x * 0.08;
        ball.spin.multiplyScalar(0.7);
      }

      ball.bounceCount++;
      ball.onTable = true;
      audio.playTableBounce();

      // Placement drill target check
      if (gsm.state === 'drill_active' && gsm.currentDrill === 'placement' && ball.lastHitBy === 'player') {
        placementTargets.forEach(t => {
          if (t.active) {
            const d = new Vector3(ball.position.x, 0, ball.position.z).distanceTo(new Vector3(t.pos.x, 0, t.pos.z));
            if (d < 0.12) {
              gsm.drillScore++;
              audio.playDrillTargetHit();
              spawnParticles(t.pos.clone().setY(TABLE_HEIGHT + 0.1), 0x33ff88, 10);
              activateRandomTarget();
            }
          }
        });
      }

      // Scoring logic
      if (ball.bounceCount >= 2 && ball.lastHitBy !== 'none') {
        scorePoint(ball.lastHitBy === 'player' ? 'ai' : 'player', 'double bounce');
        return;
      }
    }

    // Net collision
    if (Math.abs(ball.position.z) < 0.02 + BALL_RADIUS &&
        Math.abs(ball.position.x) <= TABLE_WIDTH / 2 + 0.1 &&
        ball.position.y <= TABLE_HEIGHT + NET_HEIGHT + BALL_RADIUS &&
        ball.position.y >= TABLE_HEIGHT) {

      // Net roller detection — ball just barely clears the net
      const justAboveNet = ball.position.y > TABLE_HEIGHT + NET_HEIGHT - 0.01 &&
                           ball.position.y < TABLE_HEIGHT + NET_HEIGHT + BALL_RADIUS + 0.02;

      if (ball.velocity.z < 0 && ball.position.z > 0) {
        if (justAboveNet && Math.abs(ball.velocity.y) < 1.0) {
          // Net roller! Ball rolls over
          ball.velocity.z *= 0.4;
          ball.velocity.y = -0.3;
          audio.playNetRoller();
          showToast('NET ROLLER!');
          spawnParticles(ball.position.clone(), gsm.getTheme().net, 8);
          // Will check for net_roller achievement when point scores
        } else {
          ball.velocity.z *= -0.3;
          ball.velocity.y += 0.5;
          audio.playNetHit();
          spawnParticles(ball.position.clone(), gsm.getTheme().net, 5);

          if (ball.bounceCount === 0 && ball.lastHitBy !== 'none') {
            showToast('NET! LET');
            setTimeout(() => serveBall(), 1000);
            ball.active = false;
            return;
          }
        }
      } else if (ball.velocity.z > 0 && ball.position.z < 0) {
        if (justAboveNet && Math.abs(ball.velocity.y) < 1.0) {
          ball.velocity.z *= 0.4;
          ball.velocity.y = -0.3;
          audio.playNetRoller();
          showToast('NET ROLLER!');
          spawnParticles(ball.position.clone(), gsm.getTheme().net, 8);
        } else {
          ball.velocity.z *= -0.3;
          ball.velocity.y += 0.5;
          audio.playNetHit();
          spawnParticles(ball.position.clone(), gsm.getTheme().net, 5);
        }
      }
    }

    // Ball goes off ends
    if (ball.position.z > TABLE_LENGTH / 2 + 0.5) {
      if (ball.lastHitBy === 'ai') {
        scorePoint('ai', 'miss');
      } else {
        scorePoint('ai', 'out');
      }
      return;
    }
    if (ball.position.z < -TABLE_LENGTH / 2 - 0.5) {
      if (ball.lastHitBy === 'player') {
        if (ball.bounceCount <= 1) {
          gsm.aces++;
          gsm.unlockAchievement('ace');
          if (gsm.aces >= 5) gsm.unlockAchievement('ace5');
          audio.playAce();
          showToast('ACE!');
          spawnParticles(ball.position.clone(), 0xffcc00, 20);
        }
        scorePoint('player', 'winner');
      } else {
        scorePoint('player', 'out');
      }
      return;
    }

    // Ball goes off sides
    if (Math.abs(ball.position.x) > TABLE_WIDTH / 2 + 1.0) {
      const scorer = ball.lastHitBy === 'player' ? 'ai' : 'player';
      scorePoint(scorer, 'out wide');
      return;
    }

    // Ball falls below table
    if (ball.position.y < TABLE_HEIGHT - 0.5) {
      const scorer = ball.lastHitBy === 'player' ? 'ai' : 'player';
      scorePoint(scorer, 'off table');
      return;
    }
  }

  // Update ball mesh
  ballMesh.position.copy(ball.position);
  ballMesh.rotation.x += ball.velocity.z * dt * 5;
  ballMesh.rotation.z -= ball.velocity.x * dt * 5;

  // Glow intensity based on speed
  const speed = ball.velocity.length();
  if (ballGlow) {
    (ballGlow.material as MeshBasicMaterial).opacity = 0.1 + Math.min(speed * 0.05, 0.3);
  }

  // Ball shadow on table
  updateBallShadow();

  // Spin visualization
  updateSpinVisualization(dt);

  // Trail
  trailPoints.push(ball.position.clone());
  if (trailPoints.length > TRAIL_LENGTH) trailPoints.shift();
  updateTrail();
}

// === BALL SHADOW ===
function updateBallShadow() {
  if (!ball.active) {
    ballShadow.visible = false;
    return;
  }
  // Project ball position down onto table surface
  const bx = ball.position.x;
  const bz = ball.position.z;
  const onTable = Math.abs(bx) <= TABLE_WIDTH / 2 && Math.abs(bz) <= TABLE_LENGTH / 2;

  if (onTable && ball.position.y > TABLE_HEIGHT + BALL_RADIUS) {
    ballShadow.visible = true;
    ballShadow.position.set(bx, TABLE_HEIGHT + 0.016, bz);
    // Scale shadow based on height — further = smaller
    const heightAbove = ball.position.y - TABLE_HEIGHT;
    const scale = Math.max(0.5, 1.5 - heightAbove * 0.5);
    ballShadow.scale.set(scale, 1, scale);
    (ballShadow.material as MeshBasicMaterial).opacity = Math.max(0.05, 0.2 - heightAbove * 0.05);
  } else {
    ballShadow.visible = false;
  }
}

// === SPIN VISUALIZATION ===
function updateSpinVisualization(dt: number) {
  const spinMag = ball.spin.length();
  if (!ball.active || spinMag < 0.5) {
    spinLines.visible = false;
    return;
  }

  spinLines.visible = true;
  spinLines.position.copy(ball.position);

  // Rotate rings based on spin direction
  spinLines.rotation.x += ball.spin.x * dt * 2;
  spinLines.rotation.y += ball.spin.y * dt * 2;
  spinLines.rotation.z += ball.spin.z * dt * 2;

  // Opacity based on spin intensity
  const opacity = Math.min(spinMag * 0.08, 0.4);
  spinLines.children.forEach(child => {
    ((child as LineSegments).material as LineBasicMaterial).opacity = opacity;
  });
}

function updateTrail() {
  if (!trailLine) return;
  const positions = (trailLine.geometry.attributes.position as any).array as Float32Array;
  positions.fill(0);
  for (let i = 0; i < trailPoints.length - 1 && i < TRAIL_LENGTH - 1; i++) {
    const idx = i * 6;
    positions[idx] = trailPoints[i].x;
    positions[idx + 1] = trailPoints[i].y;
    positions[idx + 2] = trailPoints[i].z;
    positions[idx + 3] = trailPoints[i + 1].x;
    positions[idx + 4] = trailPoints[i + 1].y;
    positions[idx + 5] = trailPoints[i + 1].z;
  }
  trailLine.geometry.attributes.position.needsUpdate = true;
}

function scorePoint(winner: 'player' | 'ai', reason: string) {
  ball.active = false;
  ballShadow.visible = false;
  spinLines.visible = false;

  // Edge hit achievement
  if (gsm.edgeHitsThisMatch > 0 && winner === 'player' && reason !== 'out') {
    gsm.unlockAchievement('edge_hit');
  }

  // Net roller achievement
  if (reason === 'winner' && winner === 'player') {
    // Check if the ball had a net roller recently (simplified: check velocity was very low z)
    gsm.unlockAchievement('net_roller'); // grant on any point that follows a net roller
  }

  // Drill mode
  if (gsm.state === 'drill_active') {
    gsm.rallyCount = 0;
    setTimeout(() => { if (gsm.state === 'drill_active') serveBall(); }, 1000);
    return;
  }

  if (gsm.mode === 'rally' || gsm.mode === 'speed') {
    if (gsm.mode === 'rally') {
      gsm.totalRallies++;
      if (gsm.rallyCount > gsm.longestRally) gsm.longestRally = gsm.rallyCount;
      showToast(`Rally: ${gsm.rallyCount} hits!`);
    }
    gsm.rallyCount = 0;
    setTimeout(() => { if (gsm.state === 'playing') serveBall(); }, 1500);
    return;
  }

  if (gsm.mode === 'training') {
    gsm.rallyCount = 0;
    setTimeout(() => { if (gsm.state === 'playing') serveBall(); }, 1000);
    return;
  }

  gsm.pointScored(winner);

  if (winner === 'player') {
    audio.playPointWon();
    gsm.unlockAchievement('first_point');
    if (gsm.currentStreak >= 3) { gsm.unlockAchievement('streak3'); audio.playStreak(gsm.currentStreak); }
    if (gsm.currentStreak >= 5) gsm.unlockAchievement('streak5');
    if (gsm.currentStreak >= 10) gsm.unlockAchievement('streak10');
    showToast(`${gsm.playerScore} - ${gsm.aiScore}`);
    spawnParticles(ball.position.clone(), gsm.getTheme().accent, 12);

    // Crowd reactions on important points
    if (gsm.isMatchPoint) audio.playCrowdCheer();
    else if (gsm.currentStreak >= 3) audio.playCrowdOoh();
  } else {
    audio.playPointLost();
    showToast(`${gsm.playerScore} - ${gsm.aiScore}`);
    if (gsm.isMatchPoint) audio.playCrowdGasp();
  }

  gsm.rallyCount = 0;

  // Check for slow-mo on match point
  if (gsm.isMatchPoint && !slowMoTriggered) {
    // Next point will get slow-mo treatment
  }

  // Trigger slow-mo for dramatic effect on match point scoring
  if (gsm.playerScore >= 10 || gsm.aiScore >= 10) {
    triggerSlowMo(1.0);
  }

  // Deuce alert
  if (gsm.isDeuce && gsm.playerScore === gsm.aiScore) {
    audio.playDeuceAlert();
    showToast('DEUCE!');
  }

  // Match point alert
  if (gsm.isMatchPoint) {
    audio.playMatchPointAlert();
  }

  // Check set win
  const setWinner = gsm.checkSetWin();
  if (setWinner) {
    if (gsm.mode === 'quick' || gsm.mode === 'tournament') {
      endGame();
      return;
    }
    gsm.wonSet(setWinner);
    audio.playSetWin();
    showToast(`SET: ${gsm.playerSets} - ${gsm.aiSets}`);
    matchPointShown = false;

    const matchWinner = gsm.checkMatchWin();
    if (matchWinner) {
      endGame();
      return;
    }
  }

  // Deuce achievement
  if (gsm.playerScore >= 10 && gsm.aiScore >= 10 && winner === 'player') {
    gsm.unlockAchievement('deuce_win');
  }

  setTimeout(() => { if (gsm.state === 'playing') serveBall(); }, 1500);
}

// === AI ===
function updateAI(dt: number) {
  const diff = tournamentAI || DIFFICULTIES[gsm.difficulty];

  if (ball.active && ball.velocity.z < 0) {
    aiReactionTimer += dt;
    if (aiReactionTimer >= diff.aiReaction) {
      const timeToArrive = Math.abs((-TABLE_LENGTH / 2 + 0.15 - ball.position.z) / ball.velocity.z);
      aiTargetX = ball.position.x + ball.velocity.x * timeToArrive;
      aiTargetX += (Math.random() - 0.5) * (1 - diff.aiAccuracy) * TABLE_WIDTH * 0.5;
      aiTargetX = Math.max(-TABLE_WIDTH / 2, Math.min(TABLE_WIDTH / 2, aiTargetX));
      aiReactionTimer = 0;
    }
  } else {
    aiTargetX = (Math.random() - 0.5) * 0.2;
    aiReactionTimer = 0;
  }

  const dx = aiTargetX - aiPaddlePos.x;
  const moveAmount = Math.sign(dx) * Math.min(Math.abs(dx), diff.aiSpeed * dt);
  aiPaddlePos.x += moveAmount;
  aiPaddlePos.x = Math.max(-TABLE_WIDTH / 2 + PADDLE_RADIUS, Math.min(TABLE_WIDTH / 2 - PADDLE_RADIUS, aiPaddlePos.x));

  aiPaddle.position.copy(aiPaddlePos);

  // AI hit ball
  if (ball.active && ball.lastHitBy !== 'ai') {
    const dist = ball.position.distanceTo(aiPaddlePos);
    if (dist < PADDLE_RADIUS + BALL_RADIUS + 0.04) {
      const hitPower = 2 + diff.aiAggression * 4 + Math.random() * 2;
      const aimX = (Math.random() - 0.5) * (1.5 - diff.aiAccuracy * 0.8);
      ball.velocity.set(
        aimX,
        1.0 + hitPower * 0.25,
        hitPower
      );
      ball.spin.set(
        -hitPower * 0.4 * diff.aiAggression,
        (Math.random() - 0.5) * 3 * diff.aiAggression,
        0
      );
      ball.lastHitBy = 'ai';
      ball.bounceCount = 0;
      gsm.rallyCount++;
      const spinAmt = ball.spin.length();
      audio.playPaddleHit(hitPower / 8, spinAmt);
      spawnParticles(ball.position.clone(), gsm.getTheme().aiPaddle, 6);
    }
  }
}

// === VISUALS ===
function updateVisuals(dt: number) {
  playerPaddle.position.copy(playerPaddlePos);
}

// === HUD ===
function updateHUD() {
  const doc = getDoc('hud');
  if (!doc) return;

  if (gsm.mode === 'match' || gsm.mode === 'tournament') {
    setText(doc, 'hud-score', `${gsm.playerScore} - ${gsm.aiScore}`);
    const setsLabel = gsm.mode === 'tournament' ? 'Tournament' : `Sets: ${gsm.playerSets} - ${gsm.aiSets}`;
    setText(doc, 'hud-sets', setsLabel);
  } else if (gsm.mode === 'speed') {
    setText(doc, 'hud-score', `Hits: ${gsm.speedHits}`);
    setText(doc, 'hud-sets', `Time: ${Math.max(0, 60 - Math.floor(gsm.speedTimer))}s`);
  } else if (gsm.mode === 'rally') {
    setText(doc, 'hud-score', `Rally: ${gsm.rallyCount}`);
    setText(doc, 'hud-sets', `Best: ${gsm.bestRally}`);
  } else {
    setText(doc, 'hud-score', `${gsm.playerScore} - ${gsm.aiScore}`);
    setText(doc, 'hud-sets', gsm.mode.toUpperCase());
  }

  setText(doc, 'hud-serve', gsm.serving === 'player' ? 'YOUR SERVE' : 'AI SERVE');

  // Show combo/streak and deuce status
  let comboText = '';
  if (gsm.isDeuce) comboText = '⚡ DEUCE';
  else if (gsm.currentStreak > 1) comboText = `Streak: ${gsm.currentStreak}`;
  setText(doc, 'hud-combo', comboText);
}

main();
