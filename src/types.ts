// Neon Paddle VR — Types, constants, themes, achievements, state management
import { Vector3 } from '@iwsdk/core';

// === GAME STATES ===
export type GameState = 'title' | 'modeselect' | 'difficulty' | 'playing' | 'paused' | 'gameover' | 'leaderboard' | 'achievements' | 'settings' | 'help' | 'stats' | 'countdown' | 'serve_practice' | 'rally_practice';

// === BALL PHYSICS ===
export interface BallState {
  position: Vector3;
  velocity: Vector3;
  spin: Vector3; // topspin/backspin (x), sidespin (y), gyrospin (z)
  active: boolean;
  lastHitBy: 'player' | 'ai' | 'none';
  bounceCount: number;
  onTable: boolean;
}

// === TABLE CONSTANTS ===
export const TABLE_LENGTH = 2.74; // m (standard table tennis)
export const TABLE_WIDTH = 1.525;
export const TABLE_HEIGHT = 0.76;
export const NET_HEIGHT = 0.1525;
export const NET_OVERHANG = 0.1525; // net extends past table on each side
export const BALL_RADIUS = 0.02; // 40mm diameter
export const PADDLE_RADIUS = 0.08;
export const PADDLE_THICKNESS = 0.012;

// === SCORING ===
export const WIN_SCORE = 11;
export const DEUCE_MARGIN = 2;

// === GAME MODES ===
export interface GameMode {
  id: string;
  name: string;
  description: string;
  rounds: number; // sets to win
}

export const GAME_MODES: GameMode[] = [
  { id: 'match', name: 'MATCH', description: 'Best of 5 sets to 11', rounds: 3 },
  { id: 'quick', name: 'QUICK MATCH', description: 'Single set to 11', rounds: 1 },
  { id: 'rally', name: 'RALLY MODE', description: 'Keep the rally going', rounds: 0 },
  { id: 'speed', name: 'SPEED RALLY', description: '60 seconds, max hits', rounds: 0 },
  { id: 'serve', name: 'SERVE PRACTICE', description: 'Perfect your serve', rounds: 0 },
  { id: 'training', name: 'TRAINING', description: 'AI returns everything', rounds: 0 },
];

// === DIFFICULTY ===
export interface DifficultyConfig {
  name: string;
  aiSpeed: number;
  aiReaction: number;
  aiAccuracy: number;
  aiSpinRead: number; // 0-1 how well AI reads spin
  aiAggression: number;
}

export const DIFFICULTIES: DifficultyConfig[] = [
  { name: 'EASY', aiSpeed: 2.0, aiReaction: 0.4, aiAccuracy: 0.5, aiSpinRead: 0.2, aiAggression: 0.2 },
  { name: 'MEDIUM', aiSpeed: 3.5, aiReaction: 0.25, aiAccuracy: 0.72, aiSpinRead: 0.5, aiAggression: 0.5 },
  { name: 'HARD', aiSpeed: 5.5, aiReaction: 0.12, aiAccuracy: 0.92, aiSpinRead: 0.85, aiAggression: 0.8 },
];

// === THEMES ===
export interface Theme {
  name: string;
  table: number;
  net: number;
  accent: number;
  highlight: number;
  floor: number;
  grid: number;
  paddle: number;
  ball: number;
  aiPaddle: number;
  fog: number;
}

export const THEMES: Theme[] = [
  { name: 'Holodeck', table: 0x0a1628, net: 0x00ffff, accent: 0x00ffff, highlight: 0xff00ff, floor: 0x001122, grid: 0x00ffff, paddle: 0x00ffff, ball: 0xffffff, aiPaddle: 0xff00ff, fog: 0x000811 },
  { name: 'Crimson', table: 0x1a0808, net: 0xff3333, accent: 0xff3333, highlight: 0xff8800, floor: 0x110000, grid: 0xff3333, paddle: 0xff3333, ball: 0xffffff, aiPaddle: 0xff8800, fog: 0x080000 },
  { name: 'Neon Green', table: 0x081a08, net: 0x33ff33, accent: 0x33ff33, highlight: 0xffff00, floor: 0x001100, grid: 0x33ff33, paddle: 0x33ff33, ball: 0xffffff, aiPaddle: 0xffff00, fog: 0x000800 },
  { name: 'Ultraviolet', table: 0x0d0828, net: 0x9933ff, accent: 0x9933ff, highlight: 0xff33cc, floor: 0x080022, grid: 0x9933ff, paddle: 0x9933ff, ball: 0xffffff, aiPaddle: 0xff33cc, fog: 0x040011 },
  { name: 'Solar Blaze', table: 0x1a1408, net: 0xffaa00, accent: 0xffaa00, highlight: 0xff4400, floor: 0x111000, grid: 0xffaa00, paddle: 0xffaa00, ball: 0xffffff, aiPaddle: 0xff4400, fog: 0x080800 },
];

// === ACHIEVEMENTS ===
export interface Achievement {
  id: string;
  name: string;
  description: string;
  unlocked: boolean;
}

export function getDefaultAchievements(): Achievement[] {
  return [
    { id: 'first_point', name: 'First Rally', description: 'Win your first point', unlocked: false },
    { id: 'first_win', name: 'Victor', description: 'Win your first match', unlocked: false },
    { id: 'ace', name: 'Ace!', description: 'Score an ace serve', unlocked: false },
    { id: 'ace5', name: 'Ace Machine', description: 'Score 5 aces in one match', unlocked: false },
    { id: 'smash', name: 'Smash Hit', description: 'Hit a smash shot', unlocked: false },
    { id: 'spin_master', name: 'Spin Master', description: 'Win a point with a heavy spin shot', unlocked: false },
    { id: 'rally5', name: 'Rally Starter', description: 'Keep a 5-hit rally', unlocked: false },
    { id: 'rally10', name: 'Rally King', description: 'Keep a 10-hit rally', unlocked: false },
    { id: 'rally25', name: 'Rally Legend', description: 'Keep a 25-hit rally', unlocked: false },
    { id: 'rally50', name: 'Endurance', description: 'Keep a 50-hit rally', unlocked: false },
    { id: 'shutout', name: 'Shutout', description: 'Win 11-0', unlocked: false },
    { id: 'comeback', name: 'Comeback King', description: 'Win after being down 5+', unlocked: false },
    { id: 'streak3', name: 'Hot Streak', description: '3 consecutive points', unlocked: false },
    { id: 'streak5', name: 'On Fire', description: '5 consecutive points', unlocked: false },
    { id: 'streak10', name: 'Unstoppable', description: '10 consecutive points', unlocked: false },
    { id: 'deuce_win', name: 'Clutch', description: 'Win from deuce', unlocked: false },
    { id: 'hard_win', name: 'Master', description: 'Win on Hard difficulty', unlocked: false },
    { id: 'speed60', name: 'Speed Demon', description: '60+ hits in Speed Rally', unlocked: false },
    { id: 'games10', name: 'Veteran', description: 'Play 10 matches', unlocked: false },
    { id: 'daily', name: 'Daily Grind', description: 'Complete a Daily Challenge', unlocked: false },
  ];
}

// === PADDLE SKINS ===
export interface PaddleSkin {
  id: string;
  name: string;
  rubber: number;
  handle: number;
  glow: number;
}

export const PADDLE_SKINS: PaddleSkin[] = [
  { id: 'neon', name: 'Neon Cyan', rubber: 0x00ffff, handle: 0x004444, glow: 0x00ffff },
  { id: 'inferno', name: 'Inferno', rubber: 0xff4400, handle: 0x441100, glow: 0xff4400 },
  { id: 'glacier', name: 'Glacier', rubber: 0x44aaff, handle: 0x112244, glow: 0x44aaff },
  { id: 'plasma', name: 'Plasma', rubber: 0xaa33ff, handle: 0x220044, glow: 0xaa33ff },
  { id: 'gold', name: 'Champion', rubber: 0xffcc00, handle: 0x443300, glow: 0xffcc00 },
  { id: 'emerald', name: 'Emerald', rubber: 0x33ff88, handle: 0x003322, glow: 0x33ff88 },
];

// === GAME STATE MANAGER ===
export class GameStateManager {
  state: GameState = 'title';
  mode: string = 'match';
  difficulty: number = 1;
  playerScore: number = 0;
  aiScore: number = 0;
  playerSets: number = 0;
  aiSets: number = 0;
  setsToWin: number = 3;
  serving: 'player' | 'ai' = 'player';
  serveCount: number = 0;
  rallyCount: number = 0;
  bestRally: number = 0;
  currentStreak: number = 0;
  bestStreak: number = 0;
  aces: number = 0;
  smashes: number = 0;
  totalHits: number = 0;
  speedTimer: number = 0;
  speedHits: number = 0;
  themeIndex: number = 0;
  skinIndex: number = 0;
  masterVolume: number = 0.7;
  sfxVolume: number = 0.8;
  musicVolume: number = 0.5;

  // Career stats
  gamesPlayed: number = 0;
  gamesWon: number = 0;
  totalAces: number = 0;
  totalSmashes: number = 0;
  totalRallies: number = 0;
  longestRally: number = 0;
  totalPointsWon: number = 0;

  achievements: Achievement[] = getDefaultAchievements();

  leaderboard: { score: string; mode: string; difficulty: string; date: string }[] = [];

  constructor() {
    this.loadPersistence();
  }

  loadPersistence() {
    try {
      const saved = localStorage.getItem('neon-paddle-state');
      if (saved) {
        const data = JSON.parse(saved);
        this.themeIndex = data.themeIndex ?? 0;
        this.skinIndex = data.skinIndex ?? 0;
        this.masterVolume = data.masterVolume ?? 0.7;
        this.sfxVolume = data.sfxVolume ?? 0.8;
        this.musicVolume = data.musicVolume ?? 0.5;
        this.gamesPlayed = data.gamesPlayed ?? 0;
        this.gamesWon = data.gamesWon ?? 0;
        this.totalAces = data.totalAces ?? 0;
        this.totalSmashes = data.totalSmashes ?? 0;
        this.totalRallies = data.totalRallies ?? 0;
        this.longestRally = data.longestRally ?? 0;
        this.totalPointsWon = data.totalPointsWon ?? 0;
        if (data.achievements) {
          for (const a of data.achievements) {
            const found = this.achievements.find(x => x.id === a.id);
            if (found) found.unlocked = a.unlocked;
          }
        }
        if (data.leaderboard) this.leaderboard = data.leaderboard;
      }
    } catch {}
  }

  savePersistence() {
    try {
      localStorage.setItem('neon-paddle-state', JSON.stringify({
        themeIndex: this.themeIndex,
        skinIndex: this.skinIndex,
        masterVolume: this.masterVolume,
        sfxVolume: this.sfxVolume,
        musicVolume: this.musicVolume,
        gamesPlayed: this.gamesPlayed,
        gamesWon: this.gamesWon,
        totalAces: this.totalAces,
        totalSmashes: this.totalSmashes,
        totalRallies: this.totalRallies,
        longestRally: this.longestRally,
        totalPointsWon: this.totalPointsWon,
        achievements: this.achievements.map(a => ({ id: a.id, unlocked: a.unlocked })),
        leaderboard: this.leaderboard.slice(0, 20),
      }));
    } catch {}
  }

  resetMatch() {
    this.playerScore = 0;
    this.aiScore = 0;
    this.playerSets = 0;
    this.aiSets = 0;
    this.serving = 'player';
    this.serveCount = 0;
    this.rallyCount = 0;
    this.bestRally = 0;
    this.currentStreak = 0;
    this.bestStreak = 0;
    this.aces = 0;
    this.smashes = 0;
    this.totalHits = 0;
    this.speedTimer = 0;
    this.speedHits = 0;
  }

  getTheme(): Theme {
    return THEMES[this.themeIndex % THEMES.length];
  }

  getSkin(): PaddleSkin {
    return PADDLE_SKINS[this.skinIndex % PADDLE_SKINS.length];
  }

  unlockAchievement(id: string): boolean {
    const a = this.achievements.find(x => x.id === id);
    if (a && !a.unlocked) {
      a.unlocked = true;
      this.savePersistence();
      return true;
    }
    return false;
  }

  addLeaderboardEntry(score: string, mode: string, difficulty: string) {
    const entry = { score, mode, difficulty, date: new Date().toLocaleDateString() };
    this.leaderboard.unshift(entry);
    this.leaderboard = this.leaderboard.slice(0, 20);
    this.savePersistence();
  }

  pointScored(winner: 'player' | 'ai') {
    if (winner === 'player') {
      this.playerScore++;
      this.currentStreak++;
      this.totalPointsWon++;
      if (this.currentStreak > this.bestStreak) this.bestStreak = this.currentStreak;
    } else {
      this.aiScore++;
      this.currentStreak = 0;
    }
    this.serveCount++;
    // Alternate serve every 2 points (or every point in deuce)
    const totalPoints = this.playerScore + this.aiScore;
    if (this.playerScore >= 10 && this.aiScore >= 10) {
      // Deuce: alternate every serve
      this.serving = totalPoints % 2 === 0 ? 'player' : 'ai';
    } else {
      this.serving = Math.floor(totalPoints / 2) % 2 === 0 ? 'player' : 'ai';
    }
    this.rallyCount = 0;
  }

  checkSetWin(): 'player' | 'ai' | null {
    const p = this.playerScore;
    const a = this.aiScore;
    if (p >= WIN_SCORE && p - a >= DEUCE_MARGIN) return 'player';
    if (a >= WIN_SCORE && a - p >= DEUCE_MARGIN) return 'ai';
    return null;
  }

  wonSet(winner: 'player' | 'ai') {
    if (winner === 'player') this.playerSets++;
    else this.aiSets++;
    this.playerScore = 0;
    this.aiScore = 0;
    this.serveCount = 0;
  }

  checkMatchWin(): 'player' | 'ai' | null {
    if (this.mode === 'quick') {
      return this.checkSetWin();
    }
    if (this.playerSets >= this.setsToWin) return 'player';
    if (this.aiSets >= this.setsToWin) return 'ai';
    return null;
  }
}
