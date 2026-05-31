// Neon Paddle VR — Audio manager with procedural Web Audio SFX
export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private musicOsc: OscillatorNode | null = null;
  private musicPad: OscillatorNode | null = null;
  private musicLFO: OscillatorNode | null = null;

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
    const bufSize = ctx.sampleRate * dur;
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

  // Ball hits paddle
  playPaddleHit(intensity: number = 0.5) {
    const vol = 0.15 + intensity * 0.35;
    this.playTone(800 + intensity * 1200, 'square', 0.06, vol);
    this.playNoise(0.04, vol * 0.5, 4000 + intensity * 3000);
  }

  // Ball hits table
  playTableBounce() {
    this.playTone(1200, 'sine', 0.05, 0.2);
    this.playNoise(0.03, 0.08, 5000);
  }

  // Ball hits net
  playNetHit() {
    this.playTone(300, 'triangle', 0.15, 0.15);
    this.playNoise(0.1, 0.12, 2000);
  }

  // Point scored
  playPointWon() {
    this.ensureCtx();
    const ctx = this.ctx!;
    const notes = [523, 659, 784, 1047]; // C5 E5 G5 C6
    notes.forEach((f, i) => {
      setTimeout(() => this.playTone(f, 'sine', 0.2, 0.25), i * 80);
    });
  }

  // Point lost
  playPointLost() {
    this.playTone(400, 'sawtooth', 0.3, 0.15);
    setTimeout(() => this.playTone(300, 'sawtooth', 0.4, 0.12), 100);
  }

  // Ace serve
  playAce() {
    const notes = [880, 1047, 1319, 1568, 2093];
    notes.forEach((f, i) => {
      setTimeout(() => this.playTone(f, 'sine', 0.15, 0.2), i * 60);
    });
    this.playNoise(0.2, 0.1, 8000);
  }

  // Smash hit
  playSmash() {
    this.playTone(200, 'sawtooth', 0.15, 0.3);
    this.playNoise(0.08, 0.25, 6000);
    this.playTone(100, 'sine', 0.2, 0.2);
  }

  // Game start
  playGameStart() {
    const notes = [440, 554, 659, 880];
    notes.forEach((f, i) => {
      setTimeout(() => this.playTone(f, 'sine', 0.15, 0.2), i * 100);
    });
  }

  // Game over - win
  playWin() {
    const notes = [523, 659, 784, 880, 1047, 1319];
    notes.forEach((f, i) => {
      setTimeout(() => this.playTone(f, 'sine', 0.25, 0.2), i * 100);
    });
  }

  // Game over - lose
  playLose() {
    const notes = [400, 350, 300, 250];
    notes.forEach((f, i) => {
      setTimeout(() => this.playTone(f, 'sawtooth', 0.3, 0.12), i * 150);
    });
  }

  // Countdown tick
  playCountdownTick() {
    this.playTone(880, 'sine', 0.1, 0.2);
  }

  // Countdown GO
  playCountdownGo() {
    this.playTone(1320, 'sine', 0.2, 0.3);
    this.playTone(1760, 'sine', 0.15, 0.25);
  }

  // Achievement
  playAchievement() {
    const notes = [659, 784, 988, 1319, 1568];
    notes.forEach((f, i) => {
      setTimeout(() => this.playTone(f, 'sine', 0.2, 0.18), i * 80);
    });
  }

  // Button click
  playClick() {
    this.playTone(1000, 'sine', 0.03, 0.1);
  }

  // Serve toss
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

  // Set win
  playSetWin() {
    const notes = [523, 659, 784, 1047, 523, 659];
    notes.forEach((f, i) => {
      setTimeout(() => this.playTone(f, 'sine', 0.2, 0.18), i * 120);
    });
  }

  // Combo/streak sound
  playStreak(count: number) {
    const baseFreq = 600 + count * 100;
    this.playTone(baseFreq, 'sine', 0.12, 0.15);
    this.playTone(baseFreq * 1.5, 'triangle', 0.1, 0.1);
  }
}
