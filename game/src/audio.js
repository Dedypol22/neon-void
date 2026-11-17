// WebAudio synth for all game sounds: shoot, hit, explosion, powerup, damage, wave start.
// All oscillators are designed to be short, percussive and have minimal attack.

export class AudioSystem {
  constructor() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.gain = this.ctx.createGain();
    this.gain.connect(this.ctx.destination);
    this.gain.value = 0.5;
    this.muted = false;
    this.oscillators = [];
    this.scheduled = [];
    this.source = null;
  }

  schedule(time, fn) {
    this.scheduled.push({ time, fn });
    if (this.scheduled.length === 1) this.rhythm();
  }

  rhythm() {
    if (this.muted) {
      this.scheduled = [];
      return;
    }
    const now = this.ctx.currentTime;
    const ready = [];
    for (let i = 0; i < this.scheduled.length; i++) {
      const { time, fn } = this.scheduled[i];
      if (time <= now) {
        fn();
        ready.push(i);
      }
    }
    for (let i = ready.length - 1; i >= 0; i--) {
      const index = ready[i];
      this.scheduled.splice(index, 1);
    }
    if (this.scheduled.length > 0) setTimeout(() => this.rhythm(), 10);
  }

  playShoot(time) {
    if (this.muted) return;
    const when = time ?? this.ctx.currentTime + 0.01;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(600, when);
    osc.frequency.exponentialRampToValueAtTime(400, when + 0.05);
    osc.connect(gain);
    gain.connect(this.gain);
    gain.gain.setValueAtTime(0.3, when);
    gain.gain.exponentialRampToValueAtTime(0.01, when + 0.1);
    osc.start(when);
    osc.stop(when + 0.1);
    osc.onended = () => osc.disconnect();
  }

  playHit(time) {
    if (this.muted) return;
    const when = time ?? this.ctx.currentTime + 0.01;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(200, when);
    osc.frequency.linearRampToValueAtTime(150, when + 0.05);
    osc.connect(gain);
    gain.connect(this.gain);
    gain.gain.setValueAtTime(0.2, when);
    gain.gain.exponentialRampToValueAtTime(0.01, when + 0.08);
    osc.start(when);
    osc.stop(when + 0.08);
    osc.onended = () => osc.disconnect();
  }

  playExplosion(time) {
    if (this.muted) return;
    const when = time ?? this.ctx.currentTime + 0.01;
    for (let i = 0; i < 3; i++) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = i % 2 === 0 ? 'square' : 'triangle';
      osc.frequency.setValueAtTime(300 - i * 60, when + i * 0.05);
      osc.frequency.linearRampToValueAtTime(150, when + 0.05 + i * 0.05);
      osc.connect(gain);
      gain.connect(this.gain);
      gain.gain.setValueAtTime(0.2, when);
      gain.gain.exponentialRampToValueAtTime(0.01, when + 0.1);
      osc.start(when);
      osc.stop(when + 0.1);
      osc.onended = () => osc.disconnect();
    }
  }

  playPowerup(time) {
    if (this.muted) return;
    const when = time ?? this.ctx.currentTime + 0.01;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, when);
    osc.frequency.linearRampToValueAtTime(550, when + 0.05);
    osc.frequency.linearRampToValueAtTime(440, when + 0.1);
    osc.connect(gain);
    gain.connect(this.gain);
    gain.gain.setValueAtTime(0.25, when);
    gain.gain.exponentialRampToValueAtTime(0.01, when + 0.15);
    osc.start(when);
    osc.stop(when + 0.15);
    osc.onended = () => osc.disconnect();
  }

  playDamage(time) {
    if (this.muted) return;
    const when = time ?? this.ctx.currentTime + 0.01;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(100, when);
    osc.frequency.linearRampToValueAtTime(80, when + 0.03);
    osc.connect(gain);
    gain.connect(this.gain);
    gain.gain.setValueAtTime(0.15, when);
    gain.gain.exponentialRampToValueAtTime(0.01, when + 0.05);
    osc.start(when);
    osc.stop(when + 0.05);
    osc.onended = () => osc.disconnect();
  }

  playWaveStart(time) {
    if (this.muted) return;
    const when = time ?? this.ctx.currentTime + 0.01;
    for (let i = 0; i < 5; i++) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(220 + i * 40, when + i * 0.02);
      osc.frequency.exponentialRampToValueAtTime(110, when + 0.05 + i * 0.02);
      osc.connect(gain);
      gain.connect(this.gain);
      gain.gain.setValueAtTime(0.15, when);
      gain.gain.exponentialRampToValueAtTime(0.01, when + 0.08);
      osc.start(when);
      osc.stop(when + 0.08);
      osc.onended = () => osc.disconnect();
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }

  scheduleSound(event, time) {
    switch (event) {
      case 'shoot': return this.playShoot(time);
      case 'hit': return this.playHit(time);
      case 'explosion': return this.playExplosion(time);
      case 'powerup': return this.playPowerup(time);
      case 'damage': return this.playDamage(time);
      case 'wave': return this.playWaveStart(time);
    }
  }
}