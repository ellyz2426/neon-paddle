// Neon Paddle VR — Audio manager with procedural Web Audio SFX
export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private musicOsc: OscillatorNode | null = null;
  private musicPad: OscillatorNode | null = null;
  private musicLFO: OscillatorNode | null = null;
  private deuceDrone: OscillatorNode | null = null;
  private deuceDroneGain: GainNode | null = null;

  init() {
    if (this.ctx) return;
    this.ctx = new AudioContext();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.7;
    this.masterGain.connect(this.ctx.destination);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.8;
    this.sfxGain.connect(this.masterGain);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.15;
    this.musicGain.connect(this.masterGain);

    this.startAmbientMusic();
  }

  private ensureCtx() {
    if (!this.ctx) this.init();
    if (this.ctx!.state === 'suspended') this.ctx!.resume();
  }

  setMasterVolume(v: number) { if (this.masterGain) this.masterGain.gain.value = v; }
  setSfxVolume(v: number) { if (this.sfxGain) this.sfxGain.gain.value = v; }
  setMusicVolume(v: number) { if (this.musicGain) this.musicGain.gain.value = v * 0.2; }

  private startAmbientMusic() {
    if (!this.ctx || !this.musicGain) return;
    const t = this.ctx.currentTime;

    // Bass drone
    this.musicOsc = this.ctx.createOscillator();
    this.musicOsc.type = 'sine';
    this.musicOsc.frequency.value = 55;
    const bassGain = this.ctx.createGain();
    bassGain.gain.value = 0.3;
    this.musicOsc.connect(bassGain);
    bassGain.connect(this.musicGain);
    this.musicOsc.start(t);

    // Triangle pad
    this.musicPad = this.ctx.createOscillator();
    this.musicPad.type = 'triangle';
    this.musicPad.frequency.value = 82.5;
    const padGain = this.ctx.createGain();
    padGain.gain.value = 0.15;
    this.musicPad.connect(padGain);
    padGain.connect(this.musicGain);
    this.musicPad.start(t);

    // LFO
    this.musicLFO = this.ctx.createOscillator();
    this.musicLFO.type = 'sine';
    this.musicLFO.frequency.value = 0.15;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 10;
    this.musicLFO.connect(lfoGain);
    lfoGain.connect(this.musicOsc.frequency);
    this.musicLFO.start(t);
  }

  private playTone(freq: number, type: OscillatorType, dur: number, vol: number = 0.3) {
    this.ensureCtx();
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(gain);
    gain.connect(this.sfxGain!);
    osc.start();
    osc.stop(ctx.currentTime + dur);
  }

  private playNoise(dur: number, vol: number = 0.2, filterFreq: number = 3000) {
    this.ensureCtx();
    const ctx = this.ctx!;
    const bufSize = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain!);
    src.start();
  }

  // === HIT SOUNDS ===
  // Ball hits paddle — varies with power and spin
  playPaddleHit(intensity: number = 0.5, spinAmount: number = 0) {
    const vol = 0.15 + intensity * 0.35;
    const baseFreq = 600 + intensity * 1400;
    // Higher spin = more buzzy (square wave), less spin = cleaner (sine)
    const type: OscillatorType = spinAmount > 3 ? 'square' : spinAmount > 1.5 ? 'triangle' : 'sine';
    this.playTone(baseFreq, type, 0.06 + spinAmount * 0.01, vol);
    this.playNoise(0.04, vol * 0.5, 4000 + intensity * 3000);
    // Add a pitch bend for heavy topspin
    if (spinAmount > 2) {
      this.ensureCtx();
      const ctx = this.ctx!;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseFreq * 1.5, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.5, ctx.currentTime + 0.08);
      const g = ctx.createGain();
      g.gain.setValueAtTime(vol * 0.3, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.connect(g);
      g.connect(this.sfxGain!);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    }
  }

  // Soft paddle hit (low power)
  playPaddleHitSoft() {
    this.playTone(400, 'sine', 0.04, 0.1);
    this.playNoise(0.02, 0.05, 2000);
  }

  // Power paddle hit (high power)
  playPaddleHitPower() {
    this.playTone(1600, 'square', 0.05, 0.35);
    this.playTone(800, 'sawtooth', 0.06, 0.2);
    this.playNoise(0.06, 0.25, 7000);
  }

  // Ball hits table
  playTableBounce() {
    this.playTone(1200, 'sine', 0.05, 0.2);
    this.playNoise(0.03, 0.08, 5000);
  }

  // Ball hits table edge
  playEdgeHit() {
    this.playTone(2000, 'square', 0.03, 0.25);
    this.playTone(1000, 'sine', 0.08, 0.15);
    this.playNoise(0.04, 0.15, 8000);
  }

  // Ball hits net
  playNetHit() {
    this.playTone(300, 'triangle', 0.15, 0.15);
    this.playNoise(0.1, 0.12, 2000);
  }

  // Net roller (ball barely clears net)
  playNetRoller() {
    this.ensureCtx();
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(250, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(400, ctx.currentTime + 0.3);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.12, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.connect(g);
    g.connect(this.sfxGain!);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
    this.playNoise(0.3, 0.08, 1500);
  }

  // === CROWD REACTIONS ===
  playCrowdCheer() {
    // Simulated crowd roar with layered noise
    this.playNoise(0.8, 0.08, 1200);
    setTimeout(() => this.playNoise(0.6, 0.06, 800), 100);
    setTimeout(() => this.playNoise(0.5, 0.04, 1000), 250);
  }

  playCrowdGasp() {
    this.playNoise(0.3, 0.06, 600);
    this.playTone(250, 'sine', 0.2, 0.04);
  }

  playCrowdOoh() {
    // Rising tone + noise for "ooh" reaction
    this.ensureCtx();
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(350, ctx.currentTime + 0.25);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.06, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.connect(g);
    g.connect(this.sfxGain!);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
    this.playNoise(0.25, 0.04, 500);
  }

  // === GAME FLOW SOUNDS ===
  playPointWon() {
    this.ensureCtx();
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => {
      setTimeout(() => this.playTone(f, 'sine', 0.2, 0.25), i * 80);
    });
  }

  playPointLost() {
    this.playTone(400, 'sawtooth', 0.3, 0.15);
    setTimeout(() => this.playTone(300, 'sawtooth', 0.4, 0.12), 100);
  }

  playAce() {
    const notes = [880, 1047, 1319, 1568, 2093];
    notes.forEach((f, i) => {
      setTimeout(() => this.playTone(f, 'sine', 0.15, 0.2), i * 60);
    });
    this.playNoise(0.2, 0.1, 8000);
    setTimeout(() => this.playCrowdCheer(), 200);
  }

  playSmash() {
    this.playTone(200, 'sawtooth', 0.15, 0.3);
    this.playNoise(0.08, 0.25, 6000);
    this.playTone(100, 'sine', 0.2, 0.2);
    setTimeout(() => this.playCrowdOoh(), 100);
  }

  playGameStart() {
    const notes = [440, 554, 659, 880];
    notes.forEach((f, i) => {
      setTimeout(() => this.playTone(f, 'sine', 0.15, 0.2), i * 100);
    });
  }

  playWin() {
    const notes = [523, 659, 784, 880, 1047, 1319];
    notes.forEach((f, i) => {
      setTimeout(() => this.playTone(f, 'sine', 0.25, 0.2), i * 100);
    });
    setTimeout(() => this.playCrowdCheer(), 300);
  }

  playLose() {
    const notes = [400, 350, 300, 250];
    notes.forEach((f, i) => {
      setTimeout(() => this.playTone(f, 'sawtooth', 0.3, 0.12), i * 150);
    });
  }

  playCountdownTick() {
    this.playTone(880, 'sine', 0.1, 0.2);
  }

  playCountdownGo() {
    this.playTone(1320, 'sine', 0.2, 0.3);
    this.playTone(1760, 'sine', 0.15, 0.25);
  }

  playAchievement() {
    const notes = [659, 784, 988, 1319, 1568];
    notes.forEach((f, i) => {
      setTimeout(() => this.playTone(f, 'sine', 0.2, 0.18), i * 80);
    });
  }

  playClick() {
    this.playTone(1000, 'sine', 0.03, 0.1);
  }

  playServeToss() {
    this.ensureCtx();
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(800, ctx.currentTime + 0.15);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    osc.connect(gain);
    gain.connect(this.sfxGain!);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  }

  playSetWin() {
    const notes = [523, 659, 784, 1047, 523, 659];
    notes.forEach((f, i) => {
      setTimeout(() => this.playTone(f, 'sine', 0.2, 0.18), i * 120);
    });
  }

  playStreak(count: number) {
    const baseFreq = 600 + count * 100;
    this.playTone(baseFreq, 'sine', 0.12, 0.15);
    this.playTone(baseFreq * 1.5, 'triangle', 0.1, 0.1);
  }

  // === MATCH POINT / DEUCE ===
  playMatchPointAlert() {
    // Dramatic two-tone alert
    this.playTone(660, 'triangle', 0.2, 0.2);
    setTimeout(() => this.playTone(880, 'triangle', 0.3, 0.25), 200);
    setTimeout(() => this.playCrowdGasp(), 300);
  }

  playDeuceAlert() {
    this.playTone(550, 'sine', 0.15, 0.15);
    setTimeout(() => this.playTone(550, 'sine', 0.15, 0.15), 200);
    setTimeout(() => this.playTone(733, 'sine', 0.3, 0.2), 400);
  }

  // Deuce tension drone — low rumble that fades in during deuce
  startDeuceDrone() {
    this.ensureCtx();
    if (this.deuceDrone) return;
    const ctx = this.ctx!;
    this.deuceDrone = ctx.createOscillator();
    this.deuceDrone.type = 'sine';
    this.deuceDrone.frequency.value = 40;
    this.deuceDroneGain = ctx.createGain();
    this.deuceDroneGain.gain.setValueAtTime(0, ctx.currentTime);
    this.deuceDroneGain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 2);
    this.deuceDrone.connect(this.deuceDroneGain);
    this.deuceDroneGain.connect(this.musicGain!);
    this.deuceDrone.start();
  }

  stopDeuceDrone() {
    if (this.deuceDrone && this.deuceDroneGain && this.ctx) {
      this.deuceDroneGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.5);
      const drone = this.deuceDrone;
      setTimeout(() => { try { drone.stop(); } catch { /* ignore */ } }, 600);
      this.deuceDrone = null;
      this.deuceDroneGain = null;
    }
  }

  // === TOURNAMENT ===
  playTournamentFanfare() {
    const notes = [392, 523, 659, 784, 1047]; // G4 C5 E5 G5 C6
    notes.forEach((f, i) => {
      setTimeout(() => this.playTone(f, 'sine', 0.3, 0.22), i * 120);
    });
    setTimeout(() => this.playCrowdCheer(), 400);
  }

  playTournamentElimination() {
    const notes = [523, 440, 349, 262];
    notes.forEach((f, i) => {
      setTimeout(() => this.playTone(f, 'sawtooth', 0.4, 0.15), i * 200);
    });
  }

  // === DRILL SOUNDS ===
  playDrillTargetHit() {
    this.playTone(1047, 'sine', 0.1, 0.2);
    this.playTone(1319, 'sine', 0.08, 0.15);
  }

  playDrillComplete() {
    const notes = [523, 659, 784, 1047, 1319];
    notes.forEach((f, i) => {
      setTimeout(() => this.playTone(f, 'sine', 0.2, 0.2), i * 100);
    });
  }

  // === SLOW-MO ===
  playSlowMoEnter() {
    this.ensureCtx();
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.5);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.15, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.connect(g);
    g.connect(this.sfxGain!);
    osc.start();
    osc.stop(ctx.currentTime + 0.6);
  }

  playSlowMoExit() {
    this.ensureCtx();
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(50, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.3);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.12, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.connect(g);
    g.connect(this.sfxGain!);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  }
}
