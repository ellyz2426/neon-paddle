# Neon Paddle VR 🏓

A holodeck-style table tennis game built with IWSDK 0.4.1. Play in VR or browser with full physics, AI opponents, progression systems, and neon aesthetics.

## 🎮 Play

**Live:** [https://ellyz2426.github.io/neon-paddle/](https://ellyz2426.github.io/neon-paddle/)

## Controls

### Browser
| Key | Action |
|-----|--------|
| WASD / Arrows | Move paddle |
| Space (hold) | Charge serve |
| ESC | Pause |
| 1-5 | Camera modes |
| R | Instant replay |
| Q | Quick rematch |

### VR
| Input | Action |
|-------|--------|
| Right Thumbstick | Move paddle |
| Right Trigger (hold) | Charge serve |
| B Button | Pause |
| Laser Pointer | Menu interaction |

## Features

### Core Gameplay
- Regulation 2.74m × 1.525m table with neon wireframe
- 4-substep ball physics with gravity, air resistance, Magnus effect spin
- Spin mechanics: topspin, backspin, sidespin
- AI with 3 difficulty levels + advanced shot selection (6 shot types)
- Hit detection with power and spin-aware returns
- Smash, ace, edge hit, net roller, and double bounce detection
- LET rule on serve

### Game Modes (10)
1. **Match** — Best of 5 sets to 11, win by 2
2. **Quick Match** — Single set
3. **Rally Mode** — Keep the rally going
4. **Speed Rally** — 60 seconds, max hits
5. **Serve Practice** — Perfect your serve
6. **Training** — AI returns everything
7. **Tournament** — 4-round bracket (SPARK → CIPHER)
8. **Daily Challenge** — 10 random modifiers (wind, ghost ball, tiny paddle, etc.)
9. **Season** — 8 ranked opponents with personality taunts
10. **Free Play** — Casual warm-up, no scoring

### Progression
- XP system: earn XP from matches with difficulty multipliers
- 50 levels with progressive XP curve
- 14 level-gated unlocks (paddle skins, ball skins, themes)
- 76 achievements across gameplay, career, and exploration
- Career stats with win rate, aces, smashes, longest rally
- Match history (last 20 matches with full details)
- Leaderboard (top 20 scores)
- Post-match analysis with performance rating (D → S grade)

### Customization
- 5 table themes: Holodeck, Crimson, Neon Green, Ultraviolet, Solar Blaze
- 6 paddle skins with distinct colors and glow
- 8 ball skins with unique trail colors
- 4 colorblind accessibility modes
- Volume controls for SFX and music

### Visual Effects
- Holodeck environment with neon grid floor/ceiling
- 12 floating wireframe decorations
- 40 ambient particles
- Ball shadow on table surface
- Ball reflection on table
- Spin visualization with rotating rings
- Speed-based ball trail (blue → cyan → orange → red)
- Power paddle glow (scales with swing speed)
- Camera shake on smashes
- Screen flash on dramatic moments
- Slow-motion on match point scoring
- Deuce tension effects (pulsing table edges + drone)
- Ball impact ripple on bounces
- Paddle trail effect
- Victory celebration fireworks
- Particle object pooling (max 150)

### Audio
- 25+ procedural Web Audio SFX
- Ambient drone music
- Hit sounds vary with power and spin
- Crowd reactions (cheers, gasps, oohs)
- Shot-specific audio (drop, lob, smash)
- Dramatic point scoring bass impact
- Commentary cues
- AI taunt blips
- Level-up arpeggio
- Victory burst sparkles

### AI
- 3 base difficulties with tunable speed, reaction, accuracy, aggression
- 8 Season opponents with unique personalities and preferred shots
- 4 Tournament opponents with escalating difficulty
- 6 shot types: drive, topspin, lob, drop shot, cross-court, smash
- Situational taunts with 7 trigger contexts and cooldown

### Systems
- Instant replay (auto-trigger on dramatic moments + manual R key)
- 5 camera modes with smooth transitions
- Procedural commentary system
- Tutorial (5 guided steps)
- Quick restart (Q key)
- 30 PanelUI templates (zero HTML DOM)
- All UI via IWSDK spatial PanelUI — XR-compatible

## Tech Stack

- **IWSDK** 0.4.1 with dual-runtime (VR + browser)
- **TypeScript** — 3 source files, ~7,000 lines
- **PanelUI** (.uikitml) — 30 spatial UI templates
- **Web Audio API** — All procedural, no audio files
- **localStorage** — Persistence for stats, achievements, progression

## Development

```bash
npm install
npm run dev     # Dev server with hot reload
npm run build   # Production build to dist/
```

## License

Built with IWSDK (Immersive Web SDK) by Meta.
