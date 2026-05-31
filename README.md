# 🏓 Neon Paddle VR

A holodeck-style table tennis game built with IWSDK (Immersive Web SDK). Play in VR or in your browser — neon-lit regulation table, AI opponents, tournament brackets, instant replays, and procedural audio.

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

### Game Modes (8)
| Mode | Description |
|------|-------------|
| **Match** | Best of 5 sets to 11 points |
| **Quick Match** | Single set to 11 |
| **Rally Mode** | Keep the rally going as long as possible |
| **Speed Rally** | 60 seconds — score as many hits as possible |
| **Serve Practice** | Perfect your serve technique |
| **Training** | AI returns everything for practice |
| **Tournament** | 4-round bracket: beat SPARK → PULSE → VORTEX → CIPHER |
| **Daily Challenge** | Random daily modifiers for unique gameplay |

### AI Opponent
- 3 difficulty levels: Easy, Medium, Hard
- **Advanced shot selection** — AI chooses from drives, topspin, lobs, drop shots, cross-court angles, and smashes based on situation
- Adjustable reaction time, speed, spin reading, and aggression
- Tournament mode features 4 unique opponents with escalating difficulty

### Daily Challenge System
- Deterministic daily seed generates 1-2 random modifiers per day
- **10 modifiers**: Fast Ball, Tiny Paddle, Big Ball, Wind, Power Serves, Low Gravity, Spin Madness, Sudden Death, Turbo AI, Ghost Ball
- Wind system with lateral force and visual particles
- Ghost Ball fades with speed for added difficulty
- Daily best score tracking

### Practice Drills
- **Return Drill** — Return 20 serves within 60 seconds
- **Placement** — Hit target zones on the opponent's side
- **Spin Training** — Apply spin to returns
- **Smash Drill** — Practice smash shots on high balls

### Instant Replay System
- Automatically records last 5 seconds of ball, paddle, and AI positions
- Triggers automatically on dramatic moments (match point, streaks, deuce clutch)
- Manual trigger with **R** key during gameplay
- Plays back at 0.5x speed with cinematic camera
- Replay overlay with progress indicator

### Camera System (5 modes)
| Key | Mode | Description |
|-----|------|-------------|
| **1** | Default | Standard player view |
| **2** | Overhead | Bird's-eye view of the table |
| **3** | Side View | TV broadcast angle |
| **4** | Cinematic | Slow-orbiting tracking camera |
| **5** | Ball Cam | Camera follows the ball |

### Commentary System
- Dynamic procedural text commentary on game events
- Context-sensitive lines for aces, smashes, long rallies, comebacks, deuce, match point, net rollers, edge hits, and AI shot types
- Subtle audio cue when commentary appears

### Visual Effects
- **Holodeck environment** — neon grid floor/ceiling, floating wireframe decorations, 40 ambient particles
- **Ball shadow** — trajectory preview projected onto the table surface
- **Spin visualization** — rotating ring lines showing spin direction and intensity
- **Speed-based ball trail** — blue (slow) → cyan → orange → red (fast)
- **Power paddle glow** — paddle emits glow proportional to swing speed, color shifts cyan→white
- **Screen flash VFX** — dramatic flash on aces, smashes, and crucial points
- **Particle effects** — pooled particles for hits, aces, smashes, edge hits, net rollers
- **Camera shake** — on smash shots and power hits
- **Slow-motion** — dramatic slow-mo on match point scoring
- **Deuce tension** — pulsing table edges and tension drone during deuce
- **Ghost ball** — ball opacity decreases with speed in daily challenges
- **Wind particles** — visual indicator near ball during wind challenges

### Audio
- **Procedural Web Audio** — all sounds generated in real-time, no audio files needed
- **Hit variety** — sound changes with power level (soft/normal/power) and spin amount
- **Shot-specific sounds** — unique audio for drop shots, lobs, smashes
- **Crowd reactions** — cheers on aces, gasps on match point, "ooh" on long rallies
- **Deuce drone** — low-frequency tension rumble during deuce
- **Slow-mo audio** — pitch drop entering slow-mo, rise on exit
- **Replay sounds** — rewinding tape effect and speed-up chirp
- **Commentary cue** — subtle chime before text appears
- **Dramatic point** — bass impact on crucial scores
- **Tournament fanfare** — special sounds for bracket progression
- **Ambient music** — bass drone + triangle pad with LFO modulation

### Tutorial System
- 5-step guided tutorial: Movement, Serving, Hitting, Spin & Power, Scoring
- Step-by-step navigation with skip option

### Achievements (45)
Track your progress across core gameplay, rallies, winning, streaks, special modes, career milestones, table tricks, daily challenges, and customization. Highlights:
- 🏆 **Champion** — Win the tournament
- ⚡ **Unstoppable** — 10 consecutive points
- 🏃 **Marathon** — 100-hit rally
- 🎯 **Edge Lord** — Score on a table edge hit
- 🔄 **Net Roller** — Ball rolls over the net
- 🎯 **Soft Touch** — Win point after a drop shot
- ✈️ **Sky High** — Win point on a lob return
- 💯 **Flawless** — Win a match without losing a set
- 🔥 **Triple Threat** — 3 aces in a row
- 🎓 **Scholar** — Complete all 4 drills
- 🏅 **Winning Streak** — Win 5 consecutive matches
- 💨 **Wind Master** — Win a wind challenge
- 👻 **Ghost Buster** — Win with ghost ball
- 🚀 **Sonic** — 100+ hits in Speed Rally

### Customization
- **5 themes** — Holodeck, Crimson, Neon Green, Ultraviolet, Solar Blaze
- **6 paddle skins** — Neon Cyan, Inferno, Glacier, Plasma, Champion, Emerald
- Volume controls for SFX and music

### Persistence
- Career stats: games, wins, win rate, aces, smashes, longest rally, total points, win streak
- Top 20 leaderboard with scores, modes, and dates
- Achievement progress saved to localStorage
- Drill completion tracking
- Daily challenge best scores

## Controls

### Browser (Keyboard)
| Key | Action |
|-----|--------|
| **W/A/S/D** or **Arrow Keys** | Move paddle |
| **Space** (hold + release) | Serve — hold to charge, release to launch |
| **Escape** | Pause/Resume |
| **1-5** | Switch camera mode |
| **R** | Trigger instant replay |

### VR (XR Controllers)
| Input | Action |
|-------|--------|
| **Right Thumbstick** | Move paddle |
| **Right Trigger** (hold + release) | Serve — hold to charge, release to launch |
| **B Button** | Pause/Resume |
| **Laser Pointer** | Navigate menus |

## Tech Stack
- **[IWSDK](https://iwsdk.dev)** 0.4.1 — Immersive Web SDK for WebXR
- **PanelUI** — All game UI via 25 spatial `.uikitml` panels (zero HTML DOM overlays)
- **Web Audio API** — Procedural sound synthesis
- **TypeScript** — Strict mode, no runtime errors

## Project Structure
```
neon-paddle/
├── src/
│   ├── index.ts       # Main game loop, rendering, input, physics, replay, camera
│   ├── types.ts       # Types, constants, themes, achievements, state, replay, AI shots
│   └── audio.ts       # Procedural audio manager with 25+ sound types
├── ui/                # 25 .uikitml spatial UI templates
│   ├── title.uikitml
│   ├── hud.uikitml
│   ├── tournament.uikitml
│   ├── replay.uikitml
│   ├── camera.uikitml
│   ├── commentary.uikitml
│   └── ... (19 more)
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
