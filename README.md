# 🏓 Neon Paddle VR

A holodeck-style table tennis game built with IWSDK (Immersive Web SDK). Play in VR or in your browser — neon-lit regulation table, AI opponents, tournament brackets, and procedural audio.

**[Play Now →](https://ellyz2426.github.io/neon-paddle/)**

## Features

### Core Gameplay
- **Regulation table tennis** — 2.74m × 1.525m table with proper net height (15.25cm)
- **Real ball physics** — gravity, air resistance, Magnus effect spin influence, 4-substep integration
- **Spin mechanics** — topspin, backspin, sidespin affecting trajectory and bounce behavior
- **Serve system** — hold-to-charge power bar, release to launch with power + spin
- **Table edge hits** — unpredictable bounce deflections with special effects
- **Net rollers** — ball barely clearing the net with dramatic sound
- **Scoring** — first to 11, win by 2, with proper deuce and alternating serve rules

### Game Modes (7)
| Mode | Description |
|------|-------------|
| **Match** | Best of 5 sets to 11 points |
| **Quick Match** | Single set to 11 |
| **Rally Mode** | Keep the rally going as long as possible |
| **Speed Rally** | 60 seconds — score as many hits as possible |
| **Serve Practice** | Perfect your serve technique |
| **Training** | AI returns everything for practice |
| **Tournament** | 4-round bracket: beat SPARK → PULSE → VORTEX → CIPHER |

### AI Opponent
- 3 difficulty levels: Easy, Medium, Hard
- AI predicts ball landing with accuracy noise
- Adjustable reaction time, speed, spin reading, and aggression
- Tournament mode features 4 unique opponents with escalating difficulty

### Practice Drills
- **Return Drill** — Return 20 serves within 60 seconds
- **Placement** — Hit target zones on the opponent's side
- **Spin Training** — Apply spin to returns
- **Smash Drill** — Practice smash shots on high balls

### Visual Effects
- **Holodeck environment** — neon grid floor/ceiling, floating wireframe decorations, 40 ambient particles
- **Ball shadow** — trajectory preview projected onto the table surface
- **Spin visualization** — rotating ring lines showing spin direction and intensity
- **Ball trail** — additive blending trail following the ball
- **Particle effects** — on hits, aces, smashes, edge hits, net rollers
- **Camera shake** — on smash shots and power hits
- **Slow-motion** — dramatic slow-mo on match point scoring
- **Deuce tension** — pulsing table edges and tension drone during deuce

### Audio
- **Procedural Web Audio** — all sounds generated in real-time, no audio files needed
- **Hit variety** — sound changes with power level (soft/normal/power) and spin amount
- **Crowd reactions** — cheers on aces, gasps on match point, "ooh" on long rallies
- **Deuce drone** — low-frequency tension rumble during deuce
- **Slow-mo audio** — pitch drop entering slow-mo, rise on exit
- **Tournament fanfare** — special sounds for bracket progression
- **Ambient music** — bass drone + triangle pad with LFO modulation

### Achievements (35)
Track your progress across core gameplay, rallies, winning, streaks, special modes, career milestones, table tricks, and customization. Examples:
- 🏆 **Champion** — Win the tournament
- ⚡ **Unstoppable** — 10 consecutive points
- 🏃 **Marathon** — 100-hit rally
- 🎯 **Edge Lord** — Score on a table edge hit
- 🔄 **Net Roller** — Ball rolls over the net

### Customization
- **5 themes** — Holodeck, Crimson, Neon Green, Ultraviolet, Solar Blaze
- **6 paddle skins** — Neon Cyan, Inferno, Glacier, Plasma, Champion, Emerald
- Volume controls for SFX and music

### Persistence
- Career stats: games, wins, win rate, aces, smashes, longest rally, total points
- Top 20 leaderboard with scores, modes, and dates
- Achievement progress saved to localStorage

## Controls

### Browser (Keyboard)
| Key | Action |
|-----|--------|
| **W/A/S/D** or **Arrow Keys** | Move paddle |
| **Space** (hold + release) | Serve — hold to charge, release to launch |
| **Escape** | Pause/Resume |

### VR (XR Controllers)
| Input | Action |
|-------|--------|
| **Right Thumbstick** | Move paddle |
| **Right Trigger** (hold + release) | Serve — hold to charge, release to launch |
| **B Button** | Pause/Resume |
| **Laser Pointer** | Navigate menus |

## Tech Stack
- **[IWSDK](https://iwsdk.dev)** 0.4.1 — Immersive Web SDK for WebXR
- **PanelUI** — All game UI via spatial `.uikitml` panels (zero HTML DOM overlays)
- **Web Audio API** — Procedural sound synthesis
- **TypeScript** — Strict mode, no runtime errors

## Project Structure
```
neon-paddle/
├── src/
│   ├── index.ts      # Main game loop, rendering, input, physics
│   ├── types.ts       # Types, constants, themes, achievements, state management
│   └── audio.ts       # Procedural audio manager
├── ui/                # 19 .uikitml spatial UI templates
│   ├── title.uikitml
│   ├── hud.uikitml
│   ├── tournament.uikitml
│   ├── drills.uikitml
│   ├── rallycounter.uikitml
│   ├── matchpoint.uikitml
│   └── ... (13 more)
├── vite.config.ts
└── tsconfig.json
```

## Development

```bash
npm install
npm run dev         # Start dev server with hot reload
npm run build       # Production build to dist/
```

## License
MIT
