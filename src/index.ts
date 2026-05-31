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
import type { GameState } from './types.js';
import {
  GameStateManager, BallState, TABLE_LENGTH, TABLE_WIDTH, TABLE_HEIGHT,
  NET_HEIGHT, BALL_RADIUS, PADDLE_RADIUS, PADDLE_THICKNESS,
  THEMES, DIFFICULTIES, GAME_MODES, PADDLE_SKINS,
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
let aiTargetZ = 0;
let aiReactionTimer = 0;
let aiPaddlePos = new Vector3(0, TABLE_HEIGHT + 0.05, -TABLE_LENGTH / 2 + 0.15);

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
const MAX_PARTICLES = 80;

// Trail
const TRAIL_LENGTH = 30;
let trailPoints: Vector3[] = [];
let trailLine: LineSegments | null = null;

// UI entities
const uiEntities: Map<string, any> = new Map();

// Environment
let envDecorations: { mesh: Mesh; baseY: number; rotSpeed: number }[] = [];
let ambientParticles: { mesh: Mesh; basePos: Vector3; phase: number }[] = [];

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

  // Position camera
  const cam = (world as any).scene?.userData?.camera || (world as any).renderer?.camera;
  // Set initial camera via scene
  world.scene.position.set(0, 0, 0);

  createEnvironment();
  createTable();
  createNet();
  createPaddles();
  createBall();
  createTrail();
  setupUI();
  showUI('title');

  (world as any).update?.((dt: number) => update(dt));
  if (!(world as any).update) {
    // Fallback: use requestAnimationFrame
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

  // Fog
  world.scene.fog = new Fog(theme.fog, 15, 60);

  // Ambient light
  const ambient = new AmbientLight(0x222244, 0.4);
  world.scene.add(ambient);

  // Directional
  const dir = new DirectionalLight(0xffffff, 0.5);
  dir.position.set(2, 5, 3);
  world.scene.add(dir as any);

  // Table spotlights
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

  // Table top surface
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

  // Edges glow
  const edgesGeo = new EdgesGeometry(topGeo);
  const edgesMat = new LineBasicMaterial({ color: theme.accent, transparent: true, opacity: 0.6 });
  tableEdges = new LineSegments(edgesGeo, edgesMat);
  tableEdges.position.copy(tableMesh.position);
  group.add(tableEdges);

  // Center line (white)
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

  // Net posts
  [-TABLE_WIDTH / 2 - 0.05, TABLE_WIDTH / 2 + 0.05].forEach(x => {
    const postGeo = new CylinderGeometry(0.008, 0.008, NET_HEIGHT + 0.02, 8);
    const postMat = new MeshStandardMaterial({ color: theme.net, emissive: new Color(theme.net), emissiveIntensity: 0.8 });
    const post = new Mesh(postGeo, postMat);
    post.position.set(x, TABLE_HEIGHT + NET_HEIGHT / 2 + 0.01, 0);
    netMesh.add(post);
  });

  // Net surface — vertical lines
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
  // Horizontal lines
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

  // Player paddle
  playerPaddle = createPaddleMesh(skin.rubber, skin.handle, skin.glow);
  playerPaddle.position.copy(playerPaddlePos);
  world.scene.add(playerPaddle);

  // AI paddle
  aiPaddle = createPaddleMesh(theme.aiPaddle, theme.aiPaddle, theme.aiPaddle);
  aiPaddle.position.copy(aiPaddlePos);
  world.scene.add(aiPaddle);
}

function createPaddleMesh(rubberColor: number, handleColor: number, glowColor: number): Group {
  const group = new Group();

  // Paddle blade (circular)
  const bladeGeo = new CylinderGeometry(PADDLE_RADIUS, PADDLE_RADIUS, PADDLE_THICKNESS, 16);
  const bladeMat = new MeshStandardMaterial({
    color: rubberColor,
    emissive: new Color(rubberColor),
    emissiveIntensity: 0.5,
    roughness: 0.6,
    metalness: 0.3,
  });
  const blade = new Mesh(bladeGeo, bladeMat);
  blade.rotation.x = Math.PI / 2; // flat horizontal
  group.add(blade);

  // Wireframe overlay
  const edgesGeo = new EdgesGeometry(bladeGeo);
  const edgesMat = new LineBasicMaterial({ color: glowColor, transparent: true, opacity: 0.4 });
  const edges = new LineSegments(edgesGeo, edgesMat);
  edges.rotation.x = Math.PI / 2;
  group.add(edges);

  // Handle
  const handleGeo = new CylinderGeometry(0.012, 0.015, 0.1, 8);
  const handleMat = new MeshStandardMaterial({
    color: handleColor,
    emissive: new Color(handleColor),
    emissiveIntensity: 0.3,
  });
  const handle = new Mesh(handleGeo, handleMat);
  handle.position.set(0, 0, PADDLE_RADIUS + 0.04);
  group.add(handle);

  // Glow sphere
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

  // Wireframe
  const edgesGeo = new EdgesGeometry(ballGeo);
  const edgesMat = new LineBasicMaterial({ color: theme.accent, transparent: true, opacity: 0.3 });
  ballMesh.add(new LineSegments(edgesGeo, edgesMat));

  // Glow
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
  ];

  panels.forEach(p => {
    const entity = world.createTransformEntity(undefined, { persistent: true });
    entity.addComponent(PanelUI, { config: p.config, maxWidth: p.maxWidth, maxHeight: p.maxHeight });

    if (p.type === 'follower') {
      entity.addComponent(Follower, {
        target: world.player.head,
        offsetPosition: p.offset as [number, number, number],
        behavior: FollowBehavior.PivotY,
        speed: 5,
        tolerance: 0.3,
      });
    } else if (p.pos) {
      if (entity.object3D) entity.object3D.position.set(p.pos[0], p.pos[1], p.pos[2]);
    }

    uiEntities.set(p.name, entity);
  });

  // Wait for panels to load then bind events
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
  const allPanels = ['title', 'modeselect', 'difficulty', 'hud', 'servebar', 'toast', 'countdown', 'pause', 'gameover', 'leaderboard', 'achievements', 'settings', 'help', 'stats'];

  allPanels.forEach(name => {
    const entity = uiEntities.get(name);
    if (entity && entity.object3D) entity.object3D.visible = false;
  });

  // Show relevant panels
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
        const playerWon = gsm.mode === 'speed'
          ? true // speed mode just shows results
          : (gsm.mode === 'rally' ? true : gsm.playerScore > gsm.aiScore || gsm.playerSets > gsm.aiSets);
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
      if (mode.id === 'training' || mode.id === 'rally' || mode.id === 'speed') {
        startGame(1); // easy for training
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
  bindButton('gameover', 'btn-rematch', () => { audio.playClick(); startGame(gsm.difficulty); });
  bindButton('gameover', 'btn-title', () => { audio.playClick(); showUI('title'); });

  // Back buttons
  ['leaderboard', 'achievements', 'settings', 'help', 'stats'].forEach(panel => {
    bindButton(panel, `btn-back-${panel}`, () => { audio.playClick(); showUI('title'); });
  });

  // Settings controls
  bindButton('settings', 'btn-sfx-up', () => { gsm.sfxVolume = Math.min(1, gsm.sfxVolume + 0.1); audio.setSfxVolume(gsm.sfxVolume); gsm.savePersistence(); updatePanelContent('settings'); });
  bindButton('settings', 'btn-sfx-down', () => { gsm.sfxVolume = Math.max(0, gsm.sfxVolume - 0.1); audio.setSfxVolume(gsm.sfxVolume); gsm.savePersistence(); updatePanelContent('settings'); });
  bindButton('settings', 'btn-music-up', () => { gsm.musicVolume = Math.min(1, gsm.musicVolume + 0.1); audio.setMusicVolume(gsm.musicVolume); gsm.savePersistence(); updatePanelContent('settings'); });
  bindButton('settings', 'btn-music-down', () => { gsm.musicVolume = Math.max(0, gsm.musicVolume - 0.1); audio.setMusicVolume(gsm.musicVolume); gsm.savePersistence(); updatePanelContent('settings'); });
  bindButton('settings', 'btn-theme-prev', () => { gsm.themeIndex = (gsm.themeIndex - 1 + THEMES.length) % THEMES.length; gsm.savePersistence(); updatePanelContent('settings'); applyTheme(); });
  bindButton('settings', 'btn-theme-next', () => { gsm.themeIndex = (gsm.themeIndex + 1) % THEMES.length; gsm.savePersistence(); updatePanelContent('settings'); applyTheme(); });
  bindButton('settings', 'btn-skin-prev', () => { gsm.skinIndex = (gsm.skinIndex - 1 + PADDLE_SKINS.length) % PADDLE_SKINS.length; gsm.savePersistence(); updatePanelContent('settings'); applySkin(); });
  bindButton('settings', 'btn-skin-next', () => { gsm.skinIndex = (gsm.skinIndex + 1) % PADDLE_SKINS.length; gsm.savePersistence(); updatePanelContent('settings'); applySkin(); });
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
    // AI serves after delay
    setTimeout(() => {
      if (gsm.state !== 'playing') return;
      const speed = 3 + gsm.difficulty * 1.5;
      const sideAim = (Math.random() - 0.5) * 1.5;
      ball.velocity.set(sideAim, 2.0, speed);
      ball.spin.set(-2, (Math.random() - 0.5) * 3, 0); // topspin
      ball.active = true;
      ball.lastHitBy = 'ai';
      audio.playServeToss();
    }, 800);
  } else {
    serveCharging = false;
    serveCharge = 0;
  }
}

function endGame() {
  const playerWon = gsm.mode === 'match'
    ? gsm.playerSets > gsm.aiSets
    : gsm.playerScore > gsm.aiScore;

  gsm.gamesPlayed++;
  if (playerWon) gsm.gamesWon++;
  gsm.totalAces += gsm.aces;
  gsm.totalSmashes += gsm.smashes;
  if (gsm.bestRally > gsm.longestRally) gsm.longestRally = gsm.bestRally;

  // Achievements
  if (playerWon) {
    gsm.unlockAchievement('first_win');
    if (gsm.difficulty === 2) gsm.unlockAchievement('hard_win');
    if (gsm.aiScore === 0 && (gsm.mode === 'match' || gsm.mode === 'quick')) gsm.unlockAchievement('shutout');
  }
  if (gsm.gamesPlayed >= 10) gsm.unlockAchievement('games10');

  const scoreStr = gsm.mode === 'match'
    ? `${gsm.playerSets}-${gsm.aiSets} (${gsm.playerScore}-${gsm.aiScore})`
    : `${gsm.playerScore}-${gsm.aiScore}`;
  gsm.addLeaderboardEntry(scoreStr, gsm.mode, DIFFICULTIES[gsm.difficulty].name);
  gsm.savePersistence();

  if (playerWon) audio.playWin(); else audio.playLose();

  ball.active = false;
  ballMesh.visible = false;
  showUI('gameover');
}

// === THEME / SKIN APPLICATION ===
function applyTheme() {
  // Would need to recreate scene elements - simplified to just update accent colors
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

// === MAIN UPDATE ===
function update(dt: number) {
  dt = Math.min(dt, 0.05); // clamp delta

  // Animate environment
  const time = performance.now() / 1000;
  envDecorations.forEach(d => {
    d.mesh.rotation.y += d.rotSpeed * dt;
    d.mesh.rotation.x += d.rotSpeed * 0.5 * dt;
    d.mesh.position.y = d.baseY + Math.sin(time * 0.5 + d.rotSpeed) * 0.2;
  });
  ambientParticles.forEach(p => {
    p.mesh.position.y = p.basePos.y + Math.sin(time + p.phase) * 0.3;
    (p.mesh.material as MeshBasicMaterial).opacity = 0.15 + Math.sin(time * 2 + p.phase) * 0.1;
  });

  // Particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.vel.y -= 3 * dt;
    p.mesh.position.addScaledVector(p.vel, dt);
    p.life -= dt * 2;
    (p.mesh.material as MeshBasicMaterial).opacity = p.life * 0.8;
    if (p.life <= 0) {
      world.scene.remove(p.mesh);
      particles.splice(i, 1);
    }
  }

  // Toast timer
  if (toastTimer > 0) {
    toastTimer -= dt;
    if (toastTimer <= 0) {
      const entity = uiEntities.get('toast');
      if (entity && entity.object3D) entity.object3D.visible = false;
    }
  }

  // Countdown
  if (gsm.state === 'countdown') {
    countdownTimer += dt;
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

  if (gsm.state !== 'playing') return;

  gameTime += dt;

  // Speed mode timer
  if (gsm.mode === 'speed') {
    gsm.speedTimer += dt;
    if (gsm.speedTimer >= 60) {
      if (gsm.speedHits >= 60) gsm.unlockAchievement('speed60');
      endGame();
      return;
    }
  }

  // Input handling
  handleInput(dt);

  // Ball physics
  if (ball.active) {
    updateBallPhysics(dt);
  }

  // AI paddle
  updateAI(dt);

  // Update visuals
  updateVisuals(dt);

  // Update HUD
  updateHUD();
}

// === INPUT ===
function handleInput(dt: number) {
  // Mouse for paddle control
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
    const thumbstick = rightGamepad.getAxesValues?.(1); // Thumbstick
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
      // Show serve bar
      const entity = uiEntities.get('servebar');
      if (entity && entity.object3D) entity.object3D.visible = true;
      const doc = getDoc('servebar');
      const bars = Math.round(serveCharge * 10);
      setText(doc, 'serve-power', 'I'.repeat(bars) + '.'.repeat(10 - bars));
    }
    if (keyboard.getKeyUp('Space') && serveCharging) {
      serveCharging = false;
      const entity = uiEntities.get('servebar');
      if (entity && entity.object3D) entity.object3D.visible = false;

      // Launch ball
      const power = 2 + serveCharge * 5;
      const sideAim = (playerPaddlePos.x - ball.position.x) * 2;
      ball.velocity.set(sideAim, 1.5 + serveCharge * 1.5, -power);
      ball.spin.set(2 + serveCharge * 3, (Math.random() - 0.5) * 2, 0);
      ball.active = true;
      ball.lastHitBy = 'player';
      audio.playPaddleHit(serveCharge);
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
        audio.playPaddleHit(serveCharge);
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
      // Player hits!
      const paddleVel = playerPaddlePos.clone().sub(lastPlayerPaddlePos).divideScalar(Math.max(dt, 0.001));
      const hitPower = Math.min(paddleVel.length() * 0.5 + 1, 8);
      const returnDir = new Vector3(
        (Math.random() - 0.5) * 1.0 + paddleVel.x * 0.3,
        1.0 + hitPower * 0.3,
        -hitPower
      );

      // Add spin based on paddle movement
      ball.spin.set(
        hitPower * 0.5, // topspin proportional to power
        paddleVel.x * 2, // sidespin from lateral movement
        0
      );

      ball.velocity.copy(returnDir);
      ball.lastHitBy = 'player';
      ball.bounceCount = 0;
      gsm.rallyCount++;
      gsm.totalHits++;
      if (gsm.mode === 'speed') gsm.speedHits++;

      if (gsm.rallyCount > gsm.bestRally) gsm.bestRally = gsm.rallyCount;

      // Check achievements
      if (gsm.rallyCount >= 5) gsm.unlockAchievement('rally5');
      if (gsm.rallyCount >= 10) gsm.unlockAchievement('rally10');
      if (gsm.rallyCount >= 25) gsm.unlockAchievement('rally25');
      if (gsm.rallyCount >= 50) gsm.unlockAchievement('rally50');

      // Smash detection (high power + ball was high)
      if (hitPower > 5 && ball.position.y > TABLE_HEIGHT + 0.3) {
        gsm.smashes++;
        gsm.unlockAchievement('smash');
        audio.playSmash();
        spawnParticles(ball.position.clone(), 0xff4400, 15);
        showToast('SMASH!');
      } else {
        audio.playPaddleHit(hitPower / 8);
        spawnParticles(ball.position.clone(), gsm.getTheme().accent, 8);
      }
    }
  }

  // Pause
  if (keyboard.getKeyDown('Escape')) {
    if (gsm.state === 'playing') showUI('paused');
    else if (gsm.state === 'paused') showUI('playing');
  }

  // XR B button pause
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

    // Table bounce
    const onTableX = Math.abs(ball.position.x) <= TABLE_WIDTH / 2 + BALL_RADIUS;
    const onTableZ = Math.abs(ball.position.z) <= TABLE_LENGTH / 2 + BALL_RADIUS;

    if (ball.position.y <= TABLE_HEIGHT + BALL_RADIUS && ball.velocity.y < 0 && onTableX && onTableZ) {
      ball.position.y = TABLE_HEIGHT + BALL_RADIUS;
      ball.velocity.y *= -0.75; // bounce
      ball.velocity.x *= 0.9; // friction
      ball.velocity.z *= 0.9;

      // Spin effect on bounce
      ball.velocity.x += ball.spin.y * 0.1;
      ball.velocity.z -= ball.spin.x * 0.08;
      ball.spin.multiplyScalar(0.7);

      ball.bounceCount++;
      ball.onTable = true;
      audio.playTableBounce();

      // Scoring logic
      if (ball.bounceCount >= 2 && ball.lastHitBy !== 'none') {
        // Double bounce = point for hitter
        scorePoint(ball.lastHitBy === 'player' ? 'ai' : 'player', 'double bounce');
        return;
      }
    }

    // Net collision
    if (Math.abs(ball.position.z) < 0.02 + BALL_RADIUS &&
        Math.abs(ball.position.x) <= TABLE_WIDTH / 2 + 0.1 &&
        ball.position.y <= TABLE_HEIGHT + NET_HEIGHT + BALL_RADIUS &&
        ball.position.y >= TABLE_HEIGHT) {
      // Hit the net
      if (ball.velocity.z < 0 && ball.position.z > 0) {
        // Ball going toward AI side, hits net
        ball.velocity.z *= -0.3;
        ball.velocity.y += 0.5;
        audio.playNetHit();
        spawnParticles(ball.position.clone(), gsm.getTheme().net, 5);

        // Net fault on serve
        if (ball.bounceCount === 0 && ball.lastHitBy !== 'none') {
          // Let - replay serve
          showToast('NET! LET');
          setTimeout(() => serveBall(), 1000);
          ball.active = false;
          return;
        }
      } else if (ball.velocity.z > 0 && ball.position.z < 0) {
        ball.velocity.z *= -0.3;
        ball.velocity.y += 0.5;
        audio.playNetHit();
        spawnParticles(ball.position.clone(), gsm.getTheme().net, 5);
      }
    }

    // Ball goes off the end of table — point scored
    if (ball.position.z > TABLE_LENGTH / 2 + 0.5) {
      // Ball went past player
      if (ball.lastHitBy === 'ai') {
        // Ace check
        if (ball.bounceCount <= 1 && ball.lastHitBy === 'ai') {
          // Not really an ace for the AI
        }
        scorePoint('ai', 'miss');
      } else {
        scorePoint('ai', 'out');
      }
      return;
    }
    if (ball.position.z < -TABLE_LENGTH / 2 - 0.5) {
      // Ball went past AI
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
      // Out of play
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
  const speed = ball.velocity.length();
  ballMesh.rotation.x += ball.velocity.z * dt * 5;
  ballMesh.rotation.z -= ball.velocity.x * dt * 5;

  // Glow intensity based on speed
  if (ballGlow) {
    (ballGlow.material as MeshBasicMaterial).opacity = 0.1 + Math.min(speed * 0.05, 0.3);
  }

  // Trail
  trailPoints.push(ball.position.clone());
  if (trailPoints.length > TRAIL_LENGTH) trailPoints.shift();
  updateTrail();
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

  if (gsm.mode === 'rally' || gsm.mode === 'speed') {
    // Rally/speed modes — just reset
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
  } else {
    audio.playPointLost();
    showToast(`${gsm.playerScore} - ${gsm.aiScore}`);
  }

  gsm.rallyCount = 0;

  // Check set win
  const setWinner = gsm.checkSetWin();
  if (setWinner) {
    if (gsm.mode === 'quick') {
      endGame();
      return;
    }
    gsm.wonSet(setWinner);
    audio.playSetWin();
    showToast(`SET: ${gsm.playerSets} - ${gsm.aiSets}`);

    // Check match win
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

  // Comeback
  if (winner === 'player' && gsm.aiScore - gsm.playerScore >= 5) {
    // Player was down 5+, still fighting
  }

  setTimeout(() => { if (gsm.state === 'playing') serveBall(); }, 1500);
}

// === AI ===
function updateAI(dt: number) {
  const diff = DIFFICULTIES[gsm.difficulty];

  if (ball.active && ball.velocity.z < 0) {
    // Ball coming toward AI
    aiReactionTimer += dt;
    if (aiReactionTimer >= diff.aiReaction) {
      // Predict landing
      const timeToArrive = Math.abs((-TABLE_LENGTH / 2 + 0.15 - ball.position.z) / ball.velocity.z);
      aiTargetX = ball.position.x + ball.velocity.x * timeToArrive;
      aiTargetX += (Math.random() - 0.5) * (1 - diff.aiAccuracy) * TABLE_WIDTH * 0.5;
      aiTargetX = Math.max(-TABLE_WIDTH / 2, Math.min(TABLE_WIDTH / 2, aiTargetX));
      aiReactionTimer = 0;
    }
  } else {
    // Return to center
    aiTargetX = (Math.random() - 0.5) * 0.2;
    aiReactionTimer = 0;
  }

  // Move toward target
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
      audio.playPaddleHit(hitPower / 8);
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

  if (gsm.mode === 'match') {
    setText(doc, 'hud-score', `${gsm.playerScore} - ${gsm.aiScore}`);
    setText(doc, 'hud-sets', `Sets: ${gsm.playerSets} - ${gsm.aiSets}`);
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
  setText(doc, 'hud-combo', gsm.currentStreak > 1 ? `Streak: ${gsm.currentStreak}` : '');
}

main();
