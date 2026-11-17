/**
 * Procedural Web Audio synthesizer for Paper Drift:
 * - Warm analog synth drone (detuned triangle/sawtooth pad + LFO lowpass breathing)
 * - Speed- and wind-reactive filtered pink-noise air current
 * - Soft tactile origami chimes, thermal swells, boost whooshes, and gentle bounce rustles
 */

export class PaperDriftAudio {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private droneGain: GainNode | null = null;
  private droneFilter: BiquadFilterNode | null = null;
  private windGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private oscVoices: OscillatorNode[] = [];
  private lfoNode: OscillatorNode | null = null;
  private windSource: AudioBufferSourceNode | null = null;

  private initialized = false;
  private muted = false;
  private volume = 0.65;
  private chordStep = 0;
  private lastChordSwitch = 0;

  // Warm suspended/major-9th harmonic voicings (Hz) for calm atmosphere
  private readonly chords: number[][] = [
    [130.81, 196.0, 246.94, 293.66], // Cmaj9
    [110.0, 164.81, 220.0, 293.66], // Am11
    [174.61, 220.0, 261.63, 329.63], // Fmaj7
    [146.83, 220.0, 261.63, 329.63], // Dm9
  ];

  public init(): void {
    if (this.initialized) {
      if (this.ctx && this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      return;
    }

    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    this.ctx = ctx;

    const masterGain = ctx.createGain();
    masterGain.gain.value = this.muted ? 0 : this.volume;
    masterGain.connect(ctx.destination);
    this.masterGain = masterGain;

    // 1. Warm Analog Synth Drone Bus
    const droneFilter = ctx.createBiquadFilter();
    droneFilter.type = 'lowpass';
    droneFilter.frequency.value = 420;
    droneFilter.Q.value = 1.4;

    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.22;

    droneFilter.connect(droneGain);
    droneGain.connect(masterGain);

    this.droneFilter = droneFilter;
    this.droneGain = droneGain;

    // Subtle slow breathing LFO on drone filter cutoff
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.085;
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 140;
    lfo.connect(lfoDepth);
    lfoDepth.connect(droneFilter.frequency);
    lfo.start();
    this.lfoNode = lfo;

    // 4-voice warm analog pad (paired triangle + slightly detuned soft saw)
    const initialChord = this.chords[0];
    initialChord.forEach((freq, idx) => {
      const oscA = ctx.createOscillator();
      oscA.type = idx === 0 ? 'triangle' : 'sine';
      oscA.frequency.value = freq;
      oscA.detune.value = idx % 2 === 0 ? -4 : 4;

      const oscB = ctx.createOscillator();
      oscB.type = 'sawtooth';
      oscB.frequency.value = freq;
      oscB.detune.value = idx % 2 === 0 ? 6 : -6;

      const voiceMixA = ctx.createGain();
      voiceMixA.gain.value = idx === 0 ? 0.28 : 0.16;
      const voiceMixB = ctx.createGain();
      voiceMixB.gain.value = 0.055; // Subtle warm analog harmonic edge

      oscA.connect(voiceMixA);
      oscB.connect(voiceMixB);
      voiceMixA.connect(droneFilter);
      voiceMixB.connect(droneFilter);

      oscA.start();
      oscB.start();
      this.oscVoices.push(oscA, oscB);
    });

    // 2. Procedural Pink-Noise Air Current Bus
    const noiseLen = ctx.sampleRate * 4;
    const noiseBuffer = ctx.createBuffer(1, noiseLen, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    let b3 = 0;
    let b4 = 0;
    let b5 = 0;
    let b6 = 0;
    for (let i = 0; i < noiseLen; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.045;
      b6 = white * 0.115926;
    }

    const windSource = ctx.createBufferSource();
    windSource.buffer = noiseBuffer;
    windSource.loop = true;

    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 340;
    windFilter.Q.value = 1.2;

    const windGain = ctx.createGain();
    windGain.gain.value = 0.08;

    windSource.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(masterGain);
    windSource.start();

    this.windSource = windSource;
    this.windFilter = windFilter;
    this.windGain = windGain;
    this.lastChordSwitch = ctx.currentTime;
    this.initialized = true;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (!this.ctx || !this.masterGain) return;
    const target = muted ? 0 : this.volume;
    this.masterGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.08);
  }

  public setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
    if (!this.ctx || !this.masterGain || this.muted) return;
    this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.06);
  }

  public updateFlightDynamics(
    speedRatio: number,
    windMagnitude: number,
    boostActive: boolean,
    dayProgress: number,
    isFlying: boolean,
  ): void {
    if (!this.initialized || !this.ctx) return;
    if (this.ctx.state === 'suspended') return;

    const now = this.ctx.currentTime;

    // Gently shift warm analog chord every ~14 seconds
    if (now - this.lastChordSwitch > 14) {
      this.lastChordSwitch = now;
      this.chordStep = (this.chordStep + 1) % this.chords.length;
      const nextChord = this.chords[this.chordStep];
      for (let i = 0; i < nextChord.length; i++) {
        const oscA = this.oscVoices[i * 2];
        const oscB = this.oscVoices[i * 2 + 1];
        if (oscA) oscA.frequency.setTargetAtTime(nextChord[i], now, 1.8);
        if (oscB) oscB.frequency.setTargetAtTime(nextChord[i], now, 1.8);
      }
    }

    // Warm dusk softens the synth filter slightly; morning opens brightness
    const duskFactor = Math.sin(dayProgress * Math.PI);
    if (this.droneFilter) {
      const targetCutoff = 480 - duskFactor * 120 + (boostActive ? 160 : 0);
      this.droneFilter.frequency.setTargetAtTime(targetCutoff, now, 0.35);
    }
    if (this.droneGain) {
      this.droneGain.gain.setTargetAtTime(isFlying ? 0.24 : 0.16, now, 0.4);
    }

    // Velocity- & crosswind-reactive air current
    if (this.windFilter && this.windGain) {
      const baseFreq = 260 + speedRatio * 340 + windMagnitude * 110 + (boostActive ? 280 : 0);
      const baseGain = isFlying
        ? 0.06 + speedRatio * 0.09 + windMagnitude * 0.04 + (boostActive ? 0.09 : 0)
        : 0.045;
      this.windFilter.frequency.setTargetAtTime(baseFreq, now, 0.18);
      this.windGain.gain.setTargetAtTime(baseGain, now, 0.18);
    }
  }

  public playUpgradeChime(stageOrKind: 'airframe' | 'propeller' | 'booster' | 'tailwind'): void {
    if (!this.initialized || !this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const notes =
      stageOrKind === 'propeller'
        ? [523.25, 659.25, 783.99, 1046.5]
        : stageOrKind === 'airframe'
          ? [440, 554.37, 659.25, 880]
          : stageOrKind === 'booster'
            ? [392, 523.25, 659.25]
            : [493.88, 659.25, 783.99];

    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.07);

      gain.gain.setValueAtTime(0.0001, now + idx * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.11, now + idx * 0.07 + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.07 + 0.65);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now + idx * 0.07);
      osc.stop(now + idx * 0.07 + 0.7);
    });
  }

  public playThermalSwell(): void {
    if (!this.initialized || !this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(329.63, now);
    osc.frequency.exponentialRampToValueAtTime(493.88, now + 0.45);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.085, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.65);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.7);
  }

  public playBoostWhoosh(): void {
    if (!this.initialized || !this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;

    // Gentle airy pitch sweep + warm harmonic chime
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(440, now + 0.25);
    osc.frequency.exponentialRampToValueAtTime(293.66, now + 0.75);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.1, now + 0.06);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.85);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.9);
  }

  public playSoftBounce(): void {
    if (!this.initialized || !this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(165, now);
    osc.frequency.exponentialRampToValueAtTime(88, now + 0.18);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.11, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.26);
  }

  public dispose(): void {
    this.oscVoices.forEach((osc) => {
      try {
        osc.stop();
        osc.disconnect();
      } catch {
        // Ignore already stopped oscillators
      }
    });
    this.oscVoices = [];
    if (this.lfoNode) {
      try {
        this.lfoNode.stop();
        this.lfoNode.disconnect();
      } catch {
        // Ignore
      }
      this.lfoNode = null;
    }
    if (this.windSource) {
      try {
        this.windSource.stop();
        this.windSource.disconnect();
      } catch {
        // Ignore
      }
      this.windSource = null;
    }
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
    this.initialized = false;
  }
}
