/**
 * Motor de audio con Web Audio API: 100% síntesis procedural.
 * Audio posicional 3D (HRTF), ambient, caja musical, persecución,
 * jumpscare, latidos y voz telefónica.
 */
import * as THREE from 'three';

/** v14 — base de rutas para GitHub Pages (subcarpeta del repo) */
export const ASSET_BASE = (process.env.NEXT_PUBLIC_BASE_PATH ?? '').replace(/\/+$/, '');


type Vec = { x: number; y: number; z: number };

type SfxFileName =
  | 'static_loop' | 'fan_ambience' | 'cam_blip' | 'toreador' | 'kitchen_clatter'
  // v11: SFX nuevos del repo FNAW del usuario
  | 'flashlight_click_on' | 'flashlight_click_off'
  | 'foxy_run'
  | 'step_player_1' | 'step_player_2' | 'step_player_3' | 'step_player_4'
  | 'step_anim_1' | 'step_anim_2' | 'step_anim_3' | 'step_anim_4'
  | 'freddy_laugh';

interface CallManifestEntry { file: string; dur: number }

const MELODY = [
  659.25, 523.25, 587.33, 493.88, 523.25, 440.0, 392.0, 440.0,
  659.25, 523.25, 587.33, 493.88, 523.25, 659.25, 440.0, 440.0,
];

export class AudioEngine {
  ctx: AudioContext | null = null;
  master!: GainNode;
  musicBus!: GainNode;
  sfxBus!: GainNode;
  ambientBus!: GainNode;
  private noiseBuf!: AudioBuffer;
  private ready = false;
  private volumes = { master: 0.9, music: 0.7, sfx: 0.9 };

  // estado dinámico
  danger = 0;
  private heartbeatT = 0;
  private chaseOn = false;
  private chaseT = 0;
  private musicLevel = 0;
  private musicPos: Vec = { x: -2, y: 1.2, z: -14.5 };
  private musicNoteT = 0;
  private musicIdx = 0;
  private staticLevel = 0;
  private staticTarget = 0;
  private staticGain: GainNode | null = null;
  private breathGain: GainNode | null = null;
  private breathT = 0;
  private phoneVoice: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
  private lastFootstepAt = 0;

  // ===== audio de archivo (assets reales del repo FNAW + FN1) =====
  private jumpscareBuf: AudioBuffer | null = null;
  private themeBuf: AudioBuffer | null = null;
  private themeSrc: AudioBufferSourceNode | null = null;
  private themeGain: GainNode | null = null;
  private themeOn = false;
  // SFX originales de FNAF 1 (repo FN1)
  private sfxBufs: Map<SfxFileName, AudioBuffer> = new Map();
  private fanSrc: AudioBufferSourceNode | null = null;
  private fanGain: GainNode | null = null;
  private staticFileSrc: AudioBufferSourceNode | null = null;
  private staticFileGain: GainNode | null = null;
  // llamada de radio con voz real (TTS)
  private callManifest: Record<string, CallManifestEntry[]> | null = null;
  private callBufs: Map<string, AudioBuffer> = new Map();
  private callFiles: string[] = [];
  private callChapter: string | null = null;
  private activeCallLine: AudioBufferSourceNode | null = null;
  // v7 — Mega Guardería en llamas: canción del repo + crepitar del fuego
  private daycareBuf: AudioBuffer | null = null;
  private daycareSrc: AudioBufferSourceNode | null = null;
  private daycareGain: GainNode | null = null;
  private daycareSongOn = false;
  private daycareRetries = 0;
  private fireGain: GainNode | null = null;
  private firePopT = 0;

  init(): boolean {
    if (this.ready) return true;
    try {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctor();
      const ctx = this.ctx;
      this.master = ctx.createGain();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.knee.value = 22;
      comp.ratio.value = 8;
      this.master.connect(comp);
      comp.connect(ctx.destination);
      this.musicBus = ctx.createGain();
      this.sfxBus = ctx.createGain();
      this.ambientBus = ctx.createGain();
      this.musicBus.connect(this.master);
      this.sfxBus.connect(this.master);
      this.ambientBus.connect(this.master);
      // buffer de ruido blanco compartido
      const len = ctx.sampleRate * 2;
      this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.ready = true;
      this.applyVolumes();
      this.preloadFileAudio();
      return true;
    } catch {
      return false;
    }
  }

  /** Carga en segundo plano los archivos de audio reales:
   *  - /audio/jumpscare.mp3 y /audio/theme_music.mp3 (repo FNAW)
   *  - /audio/{static_loop,fan_ambience,cam_blip,toreador,kitchen_clatter}.mp3 (repo FN1)
   *  Si fallan (sin red, formato...), el juego sigue con síntesis. */
  private preloadFileAudio() {
    const ctx = this.ctx;
    if (!ctx) return;
    const load = async (url: string): Promise<AudioBuffer | null> => {
      try {
        const res = await fetch(url);
        if (!res.ok) return null;
        const buf = await res.arrayBuffer();
        return await ctx.decodeAudioData(buf);
      } catch {
        return null;
      }
    };
    load(`${ASSET_BASE}/audio/jumpscare.mp3`).then((b) => { if (b) this.jumpscareBuf = b; });
    load(`${ASSET_BASE}/audio/theme_music.mp3`).then((b) => { if (b) this.themeBuf = b; });
    load(`${ASSET_BASE}/audio/daycare_song.mp3`).then((b) => { if (b) this.daycareBuf = b; });
    const sfxFiles: SfxFileName[] = [
      'static_loop', 'fan_ambience', 'cam_blip', 'toreador', 'kitchen_clatter',
      // v11: sonidos nuevos del repo del usuario
      'flashlight_click_on', 'flashlight_click_off', 'foxy_run',
      'step_player_1', 'step_player_2', 'step_player_3', 'step_player_4',
      'step_anim_1', 'step_anim_2', 'step_anim_3', 'step_anim_4',
      'freddy_laugh',
    ];
    for (const name of sfxFiles) {
      load(`${ASSET_BASE}/audio/${name}.mp3`).then((b) => { if (b) this.sfxBufs.set(name, b); });
    }
  }

  get themeAvailable(): boolean {
    return this.themeBuf !== null;
  }

  get available(): boolean {
    return this.ready && this.ctx !== null;
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  suspend() {
    if (this.ctx && this.ctx.state === 'running') this.ctx.suspend();
  }

  setVolumes(master: number, music: number, sfx: number) {
    this.volumes = { master, music, sfx };
    this.applyVolumes();
  }

  private applyVolumes() {
    if (!this.ctx) return;
    this.master.gain.value = this.volumes.master;
    this.musicBus.gain.value = this.volumes.music;
    this.sfxBus.gain.value = this.volumes.sfx;
    this.ambientBus.gain.value = this.volumes.music * 0.8;
  }

  updateListener(pos: THREE.Vector3, quat: THREE.Quaternion) {
    if (!this.ctx) return;
    const l = this.ctx.listener;
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(quat);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(quat);
    if (l.positionX) {
      const t = this.ctx.currentTime;
      l.positionX.setTargetAtTime(pos.x, t, 0.05);
      l.positionY.setTargetAtTime(pos.y, t, 0.05);
      l.positionZ.setTargetAtTime(pos.z, t, 0.05);
      l.forwardX.setTargetAtTime(fwd.x, t, 0.05);
      l.forwardY.setTargetAtTime(fwd.y, t, 0.05);
      l.forwardZ.setTargetAtTime(fwd.z, t, 0.05);
      l.upX.setTargetAtTime(up.x, t, 0.05);
      l.upY.setTargetAtTime(up.y, t, 0.05);
      l.upZ.setTargetAtTime(up.z, t, 0.05);
    } else if ((l as unknown as { setPosition?: (x: number, y: number, z: number) => void }).setPosition) {
      (l as unknown as { setPosition: (x: number, y: number, z: number) => void }).setPosition(pos.x, pos.y, pos.z);
      (l as unknown as { setOrientation: (fx: number, fy: number, fz: number, ux: number, uy: number, uz: number) => void })
        .setOrientation(fwd.x, fwd.y, fwd.z, up.x, up.y, up.z);
    }
  }

  /* ============ utilidades de síntesis ============ */

  private panner(pos: Vec): PannerNode {
    const p = this.ctx!.createPanner();
    p.panningModel = 'HRTF';
    p.distanceModel = 'exponential';
    p.refDistance = 1.2;
    p.rolloffFactor = 1.35;
    p.maxDistance = 34;
    p.positionX.value = pos.x;
    p.positionY.value = pos.y;
    p.positionZ.value = pos.z;
    return p;
  }

  private noiseSrc(dur: number): AudioBufferSourceNode {
    const s = this.ctx!.createBufferSource();
    s.buffer = this.noiseBuf;
    s.loop = true;
    s.playbackRate.value = 0.8 + Math.random() * 0.4;
    s.start(this.ctx!.currentTime, Math.random() * 1.5, dur + 0.1);
    return s;
  }

  private env(gain: GainNode, t0: number, attack: number, peak: number, dur: number) {
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  }

  private osc(type: OscillatorType, f0: number, f1: number, dur: number, gain: number, dest: AudioNode, detune = 0): OscillatorNode {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    o.detune.value = detune;
    const g = ctx.createGain();
    this.env(g, t, 0.01, gain, dur);
    o.connect(g);
    g.connect(dest);
    o.start(t);
    o.stop(t + dur + 0.05);
    return o;
  }

  /* ============ SFX ============ */

  footstep(pos: Vec, surface: string, running: boolean, heavy = false) {
    if (!this.ready || !this.ctx) return;
    const now = performance.now();
    if (now - this.lastFootstepAt < 40) return;
    this.lastFootstepAt = now;

    // v11: PASOS REALES del repo del usuario.
    // - Jugador (heavy=false): Pasos_jugador.mp3 troceado en 4 variantes,
    //   con pitch aleatorio para que cada paso suene distinto.
    // - Animatrónico (heavy=true): Pasosanimatronico.mp3, pasos pesados.
    // v13: SIN capa sintética encima — el usuario oyó el doble paso.
    // La síntesis solo corre como respaldo sin archivo.
    const stepFiles = heavy
      ? (['step_anim_1', 'step_anim_2', 'step_anim_3', 'step_anim_4'] as SfxFileName[])
      : (['step_player_1', 'step_player_2', 'step_player_3', 'step_player_4'] as SfxFileName[]);
    const stepFile = stepFiles[Math.floor(Math.random() * stepFiles.length)];
    const realBuf = this.sfxBufs.get(stepFile);
    if (realBuf && surface !== 'balls') {
      // v13: SOLO el paso real del repo (el usuario reportó el doble sonido
      // de la capa sintética encima). La síntesis queda únicamente como
      // respaldo si el archivo no está decodificado.
      const ctx = this.ctx;
      const t = ctx.currentTime;
      const src = ctx.createBufferSource();
      src.buffer = realBuf;
      src.playbackRate.value = 0.92 + Math.random() * 0.16; // variación natural
      const g = ctx.createGain();
      const realVol = heavy ? 1.0 * (running ? 1.15 : 1) : 0.5 * (running ? 1.3 : 1);
      g.gain.value = realVol;
      const pan = this.panner(pos);
      pan.connect(this.sfxBus);
      src.connect(g);
      g.connect(pan);
      src.start(t);
      return;
    }

    const ctx = this.ctx;
    const t = ctx.currentTime;
    const pan = this.panner(pos);
    pan.connect(this.sfxBus);
    const vol = (heavy ? 0.5 : 0.16) * (running ? 1.35 : 1); // capa sintética de apoyo
    const jitter = 0.86 + Math.random() * 0.28; // cada paso suena distinto

    // firma por superficie: frecuencia de cuerpo y carácter
    const prof: Record<string, { f: number; q: number; thump: number; bright: number }> = {
      wood: { f: 310, q: 2.6, thump: 92, bright: 1.4 },
      carpet: { f: 380, q: 1.2, thump: 78, bright: 0.5 },
      concrete: { f: 660, q: 2.0, thump: 68, bright: 1.8 },
      stone: { f: 540, q: 2.2, thump: 64, bright: 1.6 },
      metal: { f: 1350, q: 3.4, thump: 110, bright: 2.4 },
      tile: { f: 900, q: 2.8, thump: 96, bright: 2.0 },
      balls: { f: 1500, q: 0.8, thump: 140, bright: 1.2 },
      default: { f: 800, q: 2.0, thump: 84, bright: 1.5 },
    };
    const p = prof[surface] ?? prof.default;

    if (surface === 'balls') {
      // CHAPOTEO PLÁSTICO: susurro + chasquidos escalonados de pelotas
      const g = ctx.createGain();
      this.env(g, t, 0.014, vol * 0.5, 0.30);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = (1100 + Math.random() * 700) * jitter;
      bp.Q.value = 0.7;
      const n = this.noiseSrc(0.34);
      n.connect(bp); bp.connect(g); g.connect(pan);
      n.stop(t + 0.36);
      for (let b = 0; b < 6; b++) {
        const dt = b * 0.032 + Math.random() * 0.022;
        const f = 1400 + Math.random() * 1800;
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(f, t + dt);
        o.frequency.exponentialRampToValueAtTime(f * 0.68, t + dt + 0.03);
        const cg = ctx.createGain();
        cg.gain.setValueAtTime(0.0001, t + dt);
        cg.gain.exponentialRampToValueAtTime(0.055 * vol * jitter, t + dt + 0.006);
        cg.gain.exponentialRampToValueAtTime(0.0001, t + dt + 0.04);
        o.connect(cg); cg.connect(pan);
        o.start(t + dt); o.stop(t + dt + 0.06);
      }
      if (heavy) {
        // pelotas desplazándose bajo algo pesado (Luna vadeando)
        const sub = ctx.createOscillator();
        sub.type = 'sine';
        sub.frequency.setValueAtTime(120, t);
        sub.frequency.exponentialRampToValueAtTime(58, t + 0.2);
        const sg = ctx.createGain();
        this.env(sg, t, 0.02, vol * 0.5, 0.22);
        sub.connect(sg); sg.connect(pan);
        sub.start(t); sub.stop(t + 0.25);
      }
      return;
    }

    // 1) GOLPE DE TALÓN: grave breve con caída de tono
    const thump = ctx.createOscillator();
    thump.type = 'sine';
    thump.frequency.setValueAtTime(p.thump * jitter, t);
    thump.frequency.exponentialRampToValueAtTime(Math.max(30, p.thump * 0.5), t + 0.09);
    const tg = ctx.createGain();
    this.env(tg, t, 0.002, vol * 0.55 * (surface === 'carpet' ? 0.5 : 1), 0.11);
    thump.connect(tg); tg.connect(pan);
    thump.start(t); thump.stop(t + 0.13);

    // 2) CUERPO: ruido filtrado resonante (el "carácter" de la superficie)
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = p.f * jitter;
    bp.Q.value = p.q;
    const g = ctx.createGain();
    this.env(g, t, 0.003, vol * 0.8 * (surface === 'carpet' ? 0.55 : 1), 0.12);
    const n = this.noiseSrc(0.15);
    n.connect(bp); bp.connect(g); g.connect(pan);
    n.stop(t + 0.17);

    // 3) BRILLO: agudos breves al rozar la suela (no en moqueta)
    if (p.bright > 0.8) {
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 2600;
      const hg = ctx.createGain();
      this.env(hg, t, 0.002, vol * 0.2 * p.bright, 0.05);
      const hn = this.noiseSrc(0.07);
      hn.connect(hp); hp.connect(hg); hg.connect(pan);
      hn.stop(t + 0.09);
    }

    // 4) DESLIZAMIENTO del pie (solo caminando): suave, 55 ms después
    if (!running) {
      const sc = ctx.createBiquadFilter();
      sc.type = 'highpass';
      sc.frequency.value = 700;
      const scg = ctx.createGain();
      this.env(scg, t + 0.055, 0.02, vol * 0.14, 0.13);
      const sn = this.noiseSrc(0.15);
      sn.connect(sc); sc.connect(scg); scg.connect(pan);
      sn.stop(t + 0.2);
    }

    // 5) metal: parciales inarmónicos que "cantan" (rejillas, placas)
    if (surface === 'metal') {
      for (const pf of [1730, 2570, 3610]) {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = pf * (0.97 + Math.random() * 0.06);
        const og = ctx.createGain();
        this.env(og, t, 0.002, vol * 0.07, 0.16 + Math.random() * 0.08);
        o.connect(og); og.connect(pan);
        o.start(t); o.stop(t + 0.28);
      }
    }

    // 6) animatrónico: peso brutal + retumbo de sala
    if (heavy) {
      const boom = ctx.createOscillator();
      boom.type = 'sine';
      boom.frequency.setValueAtTime(64, t);
      boom.frequency.exponentialRampToValueAtTime(34, t + 0.24);
      const bg = ctx.createGain();
      this.env(bg, t, 0.004, vol * 0.85, 0.26);
      boom.connect(bg); bg.connect(pan);
      boom.start(t); boom.stop(t + 0.3);
      if (surface === 'metal' || surface === 'tile') {
        this.osc('triangle', 240, 165, 0.1, vol * 0.2, pan);
      }
    }
  }

  servo(pos: Vec, voice: string) {
    if (!this.ready) return;
    const pan = this.panner(pos);
    pan.connect(this.sfxBus);
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(voice === 'deep' ? 150 : 260, t);
    o.frequency.exponentialRampToValueAtTime(voice === 'deep' ? 80 : 140, t + 0.32);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    lp.Q.value = 6;
    const g = ctx.createGain();
    this.env(g, t, 0.03, 0.22, 0.34);
    o.connect(lp);
    lp.connect(g);
    g.connect(pan);
    o.start(t);
    o.stop(t + 0.4);
    // chispazo metálico
    const n = this.noiseSrc(0.1);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 2400;
    const g2 = ctx.createGain();
    this.env(g2, t, 0.005, 0.06, 0.09);
    n.connect(hp);
    hp.connect(g2);
    g2.connect(pan);
    n.stop(t + 0.12);
  }

  vocal(pos: Vec, voice: string) {
    if (!this.ready) return;
    const pan = this.panner(pos);
    pan.connect(this.sfxBus);
    switch (voice) {
      case 'deep': {
        // gemido grave distorsionado
        const ctx = this.ctx!;
        const t = ctx.currentTime;
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(95, t);
        o.frequency.linearRampToValueAtTime(70, t + 1.1);
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 5.5;
        const lfoG = ctx.createGain();
        lfoG.gain.value = 14;
        lfo.connect(lfoG);
        lfoG.connect(o.frequency);
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 380;
        const g = ctx.createGain();
        this.env(g, t, 0.2, 0.3, 1.2);
        o.connect(lp);
        lp.connect(g);
        g.connect(pan);
        o.start(t); o.stop(t + 1.25);
        lfo.start(t); lfo.stop(t + 1.25);
        break;
      }
      case 'screech': {
        for (let i = 0; i < 2; i++) {
          setTimeout(() => this.osc('square', 1500 - i * 250, 650, 0.16, 0.14, pan), i * 220);
        }
        break;
      }
      case 'clank': {
        const ctx = this.ctx!;
        const t = ctx.currentTime;
        for (let i = 0; i < 2; i++) {
          const o = ctx.createOscillator();
          o.type = 'sine';
          o.frequency.value = 320 + i * 47;
          const g = ctx.createGain();
          this.env(g, t + i * 0.16, 0.005, 0.16, 0.3);
          o.connect(g);
          g.connect(pan);
          o.start(t + i * 0.16);
          o.stop(t + i * 0.16 + 0.35);
        }
        this.noiseBurst(pan, 0.1, 1800, 0.1);
        break;
      }
      case 'rusty': {
        // risa metálica rajada
        for (let i = 0; i < 4; i++) {
          setTimeout(() => {
            this.osc('sawtooth', 210 - i * 12, 150, 0.12, 0.1, pan);
            this.noiseBurst(pan, 0.08, 900, 0.05);
          }, i * 130);
        }
        break;
      }
      case 'chime': {
        const ctx = this.ctx!;
        const t = ctx.currentTime;
        for (let i = 0; i < 3; i++) {
          const o = ctx.createOscillator();
          o.type = 'triangle';
          o.frequency.value = [1568, 1245, 933][i];
          const g = ctx.createGain();
          this.env(g, t + i * 0.18, 0.005, 0.12, 0.5);
          o.connect(g);
          g.connect(pan);
          o.start(t + i * 0.18);
          o.stop(t + i * 0.18 + 0.55);
        }
        break;
      }
    }
  }

  private noiseBurst(dest: AudioNode, dur: number, freq: number, vol: number, type: BiquadFilterType = 'bandpass') {
    if (!this.ready) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const n = this.noiseSrc(dur);
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = 1.5;
    const g = ctx.createGain();
    this.env(g, t, 0.003, vol, dur);
    n.connect(f);
    f.connect(g);
    g.connect(dest);
    n.stop(t + dur + 0.05);
  }

  roar(pos: Vec, voice: string) {
    if (!this.ready) return;
    const pan = this.panner(pos);
    pan.connect(this.sfxBus);
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const base = voice === 'deep' ? 110 : voice === 'rusty' ? 170 : 140;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(base * 2, t);
    o.frequency.exponentialRampToValueAtTime(base * 0.6, t + 0.75);
    const o2 = ctx.createOscillator();
    o2.type = 'square';
    o2.frequency.setValueAtTime(base * 0.51, t);
    const shaper = ctx.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const x = (i / 128) - 1;
      curve[i] = Math.tanh(x * 3.5);
    }
    shaper.curve = curve;
    const g = ctx.createGain();
    this.env(g, t, 0.04, 0.55, 0.85);
    o.connect(shaper);
    o2.connect(shaper);
    shaper.connect(g);
    g.connect(pan);
    o.start(t); o.stop(t + 0.9);
    o2.start(t); o2.stop(t + 0.9);
    this.noiseBurst(pan, 0.7, 500, 0.3, 'lowpass');
  }

  knock(pos: Vec, count = 3) {
    if (!this.ready) return;
    const pan = this.panner(pos);
    pan.connect(this.sfxBus);
    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        this.osc('sine', 130, 70, 0.09, 0.4, pan);
        this.noiseBurst(pan, 0.05, 240, 0.25, 'lowpass');
      }, i * 260 + Math.random() * 60);
    }
  }

  doorCreak(pos: Vec) {
    if (!this.ready) return;
    const pan = this.panner(pos);
    pan.connect(this.sfxBus);
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    // FRICCIÓN de bisagra: ruido de banda estrecha modulado (chirrido seco)
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(700, t);
    bp.frequency.linearRampToValueAtTime(1300, t + 0.85);
    bp.Q.value = 14;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 11 + Math.random() * 5;
    const lg = ctx.createGain();
    lg.gain.value = 220;
    lfo.connect(lg);
    lg.connect(bp.frequency);
    const g = ctx.createGain();
    this.env(g, t, 0.1, 0.16, 0.9);
    const n = this.noiseSrc(1.0);
    n.connect(bp); bp.connect(g); g.connect(pan);
    n.stop(t + 1.05);
    lfo.start(t); lfo.stop(t + 1.0);
    // peso de la puerta: grave arrastrándose
    const w = ctx.createOscillator();
    w.type = 'sawtooth';
    w.frequency.setValueAtTime(120, t);
    w.frequency.linearRampToValueAtTime(240, t + 0.9);
    const wlp = ctx.createBiquadFilter();
    wlp.type = 'lowpass'; wlp.frequency.value = 480;
    const wg = ctx.createGain();
    this.env(wg, t, 0.14, 0.07, 0.95);
    w.connect(wlp); wlp.connect(wg); wg.connect(pan);
    w.start(t); w.stop(t + 1.0);
    // CERROJO: doble clack metálico al final
    const clack = (dt: number, f: number, v: number) => {
      const o = ctx.createOscillator();
      o.type = 'square';
      o.frequency.setValueAtTime(f, t + dt);
      o.frequency.exponentialRampToValueAtTime(f * 0.55, t + dt + 0.05);
      const cg = ctx.createGain();
      cg.gain.setValueAtTime(0.0001, t + dt);
      cg.gain.exponentialRampToValueAtTime(v, t + dt + 0.004);
      cg.gain.exponentialRampToValueAtTime(0.0001, t + dt + 0.09);
      o.connect(cg); cg.connect(pan);
      o.start(t + dt); o.stop(t + dt + 0.12);
    };
    clack(0.88, 950, 0.22);
    clack(0.97, 640, 0.16);
    this.noiseBurst(pan, 0.08, 2000, 0.14, 'highpass');
  }

  doorSlam(pos: Vec) {
    if (!this.ready) return;
    const pan = this.panner(pos);
    pan.connect(this.sfxBus);
    this.osc('sine', 95, 40, 0.25, 0.7, pan);
    this.noiseBurst(pan, 0.2, 300, 0.5, 'lowpass');
  }

  ventBang(pos: Vec) {
    if (!this.ready) return;
    const pan = this.panner(pos);
    pan.connect(this.sfxBus);
    this.osc('square', 130, 60, 0.14, 0.5, pan);
    this.noiseBurst(pan, 0.12, 2200, 0.3, 'highpass');
    this.osc('triangle', 2600, 1900, 0.2, 0.12, pan);
  }

  camSwitch() {
    if (!this.ready) return;
    // blip REAL de cámara de FNAF 1; síntesis de respaldo
    if (this.playSfxFile('cam_blip', 0.9)) return;
    this.noiseBurst(this.sfxBus, 0.08, 3000, 0.12, 'highpass');
    this.osc('square', 1100, 900, 0.06, 0.05, this.sfxBus);
  }

  keypadBeep(ok: boolean) {
    if (!this.ready) return;
    if (ok) {
      this.osc('sine', 880, 880, 0.1, 0.15, this.sfxBus);
      setTimeout(() => this.osc('sine', 1320, 1320, 0.16, 0.15, this.sfxBus), 130);
    } else {
      this.osc('square', 220, 180, 0.22, 0.12, this.sfxBus);
    }
  }

  pickup() {
    if (!this.ready) return;
    this.noiseBurst(this.sfxBus, 0.06, 2000, 0.08, 'highpass');
    this.osc('sine', 700, 950, 0.09, 0.09, this.sfxBus);
  }

  repairClick() {
    if (!this.ready) return;
    for (let i = 0; i < 3; i++) {
      setTimeout(() => this.noiseBurst(this.sfxBus, 0.03, 2500, 0.1, 'highpass'), i * 70 + Math.random() * 30);
    }
  }

  switchClick() {
    if (!this.ready) return;
    this.noiseBurst(this.sfxBus, 0.04, 1800, 0.16, 'highpass');
    this.osc('square', 500, 300, 0.05, 0.1, this.sfxBus);
  }

  alertBeep() {
    if (!this.ready) return;
    this.osc('sine', 990, 990, 0.12, 0.1, this.sfxBus);
    setTimeout(() => this.osc('sine', 990, 990, 0.12, 0.1, this.sfxBus), 200);
  }

  locker(pos: Vec) {
    if (!this.ready) return;
    const pan = this.panner(pos);
    pan.connect(this.sfxBus);
    this.noiseBurst(pan, 0.15, 1400, 0.2);
    this.osc('sine', 400, 250, 0.1, 0.15, pan);
  }

  whisper(pos: Vec) {
    if (!this.ready) return;
    const pan = this.panner(pos);
    pan.connect(this.sfxBus);
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const n = this.noiseSrc(1.6);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1400;
    bp.Q.value = 5;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 3.2;
    const lg = ctx.createGain();
    lg.gain.value = 500;
    lfo.connect(lg);
    lg.connect(bp.frequency);
    const g = ctx.createGain();
    this.env(g, t, 0.5, 0.1, 1.5);
    n.connect(bp);
    bp.connect(g);
    g.connect(pan);
    n.stop(t + 1.7);
    lfo.start(t); lfo.stop(t + 1.7);
  }

  childLaugh(pos: Vec) {
    if (!this.ready) return;
    const pan = this.panner(pos);
    pan.connect(this.sfxBus);
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        const o = this.osc('sine', 800 + i * 90, 1050 + i * 90, 0.14, 0.07, pan);
        o.detune.value = Math.random() * 30;
      }, i * 190);
    }
  }

  /** CHILLIDO LUNAR: aullido mecánico con vibrato de pánico (Luna al cazar) */
  moonScream(pos: Vec) {
    if (!this.ready || !this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const pan = this.panner(pos);
    pan.connect(this.sfxBus);
    // par de sierras desafinadas con barrido 500→1600 Hz
    for (const det of [-18, 14]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(500, t);
      o.frequency.exponentialRampToValueAtTime(1600, t + 0.5);
      o.frequency.exponentialRampToValueAtTime(900, t + 1.15);
      o.detune.value = det;
      // vibrato de pánico 9 Hz
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 9;
      const lfoG = ctx.createGain();
      lfoG.gain.value = 42;
      lfo.connect(lfoG);
      lfoG.connect(o.frequency);
      lfo.start(t);
      lfo.stop(t + 1.3);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.5, t + 0.06);
      g.gain.setValueAtTime(0.5, t + 0.85);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.25);
      o.connect(g);
      g.connect(pan);
      o.start(t);
      o.stop(t + 1.3);
    }
    // sub-caída 120→38
    this.osc('sine', 120, 38, 1.1, 0.5, pan);
    // estática rasposa
    this.noiseBurst(pan, 1.0, 2100, 0.12, 'bandpass');
  }

  /** NANA rota: cajita musical desafinada desde el techo de la guardería */
  lullaby(pos: Vec) {
    if (!this.ready) return;
    const pan = this.panner(pos);
    pan.connect(this.sfxBus);
    // melodía menor lenta y dulce... equivocada
    const notes = [659, 587, 523, 587, 659, 880, 659, 523, 440, 0, 523, 440, 392, 330];
    notes.forEach((nf, i) => {
      setTimeout(() => {
        if (nf === 0) return;
        const det = -35 + Math.random() * 70;
        this.osc('sine', nf, nf, 0.5, 0.11, pan, det);
        this.osc('triangle', nf * 2, nf * 2, 0.32, 0.035, pan, det);
        this.osc('sine', nf / 2, nf / 2, 0.55, 0.05, pan, det);
      }, i * 430);
    });
  }

  radioBurst(pos: Vec) {
    if (!this.ready) return;
    const pan = this.panner(pos);
    pan.connect(this.sfxBus);
    for (let i = 0; i < 6; i++) {
      setTimeout(() => {
        this.noiseBurst(pan, 0.06, 1800 + Math.random() * 800, 0.08, 'bandpass');
        if (Math.random() > 0.5) this.osc('square', 900 + Math.random() * 400, 800, 0.05, 0.04, pan);
      }, i * 140);
    }
  }

  powerDown() {
    if (!this.ready) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(180, t);
    o.frequency.exponentialRampToValueAtTime(28, t + 0.7);
    const g = ctx.createGain();
    this.env(g, t, 0.03, 0.3, 0.75);
    o.connect(g);
    g.connect(this.sfxBus);
    o.start(t); o.stop(t + 0.8);
  }

  powerUp() {
    if (!this.ready) return;
    this.osc('sawtooth', 40, 200, 0.5, 0.22, this.sfxBus);
    setTimeout(() => this.switchClick(), 480);
    setTimeout(() => this.switchClick(), 600);
  }

  stinger() {
    if (!this.ready) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    for (const f of [130.8, 138.6, 261.6]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      const g = ctx.createGain();
      this.env(g, t, 0.01, 0.14, 1.4);
      o.connect(g);
      g.connect(this.musicBus);
      o.start(t); o.stop(t + 1.5);
    }
    this.noiseBurst(this.sfxBus, 0.5, 260, 0.2, 'lowpass');
  }

  jumpscare(voice: string) {
    if (!this.ready) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const out = ctx.createGain();
    out.gain.value = 1.0;
    out.connect(this.sfxBus);
    // grito: ruido + sierra descendente + ring mod
    const shaper = ctx.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) curve[i] = Math.tanh(((i / 128) - 1) * 5);
    shaper.curve = curve;
    shaper.connect(out);
    const o1 = ctx.createOscillator();
    o1.type = 'sawtooth';
    o1.frequency.setValueAtTime(1050, t);
    o1.frequency.exponentialRampToValueAtTime(320, t + 1.0);
    const o2 = ctx.createOscillator();
    o2.type = 'square';
    o2.frequency.setValueAtTime(voice === 'deep' ? 68 : 96, t);
    o2.frequency.linearRampToValueAtTime(44, t + 1.0);
    const ring = ctx.createOscillator();
    ring.type = 'sine';
    ring.frequency.value = 67;
    const ringG = ctx.createGain();
    ringG.gain.value = 600;
    ring.connect(ringG);
    ringG.connect(o1.frequency);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.exponentialRampToValueAtTime(0.95, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.15);
    o1.connect(g);
    o2.connect(g);
    g.connect(shaper);
    o1.start(t); o1.stop(t + 1.2);
    o2.start(t); o2.stop(t + 1.2);
    ring.start(t); ring.stop(t + 1.2);
    this.noiseBurst(out, 1.0, 900, 0.5, 'bandpass');
  }

  /* ============ GRITO FNAF MULTICAPA (super jumpscare) ============ */

  /** Grito brutal estilo FNAF: clúster desafinado + chillido con formantes +
   *  sub-caída + ruido saturado + retroalimentación. Duración ~1.4 s. */
  superScream(voice: string) {
    if (!this.ready) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const base = voice === 'deep' ? 92 : voice === 'screech' ? 150 : voice === 'clank' ? 118 : voice === 'rusty' ? 132 : 96;

    // bus maestro con limitador suave
    const out = ctx.createGain();
    out.gain.value = 1.0;
    out.connect(this.sfxBus);

    // 1) GRITO: 4 osciladores desafinados con barrido de formantes (a-e-a)
    const shaper = ctx.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) {
      const x = (i / 512) - 1;
      curve[i] = Math.tanh(x * 6.5);
    }
    shaper.curve = curve;
    shaper.connect(out);
    const screamGain = ctx.createGain();
    screamGain.gain.setValueAtTime(0.0001, t);
    screamGain.gain.exponentialRampToValueAtTime(1.05, t + 0.018);
    screamGain.gain.setValueAtTime(1.05, t + 0.7);
    screamGain.gain.exponentialRampToValueAtTime(0.0001, t + 1.38);
    screamGain.connect(shaper);
    const detunes = [1, 1.019, 0.983, 1.41];
    for (let i = 0; i < 4; i++) {
      const o = ctx.createOscillator();
      o.type = i === 3 ? 'square' : 'sawtooth';
      const f0 = base * detunes[i] * 7.2;
      o.frequency.setValueAtTime(f0 * 1.35, t);
      o.frequency.exponentialRampToValueAtTime(f0, t + 0.12);
      o.frequency.exponentialRampToValueAtTime(f0 * 0.62, t + 1.25);
      // vibrato de pánico (15 Hz)
      const vib = ctx.createOscillator();
      vib.frequency.value = 13 + i * 2;
      const vibG = ctx.createGain();
      vibG.gain.value = f0 * 0.06;
      vib.connect(vibG);
      vibG.connect(o.frequency);
      vib.start(t); vib.stop(t + 1.4);
      o.connect(screamGain);
      o.start(t); o.stop(t + 1.4);
    }

    // 2) CHILLIDO agudo con ring-mod (diente de sierra 2-4 kHz)
    const squeal = ctx.createOscillator();
    squeal.type = 'sawtooth';
    squeal.frequency.setValueAtTime(2600 + Math.random() * 900, t);
    squeal.frequency.exponentialRampToValueAtTime(1500, t + 1.1);
    const sqRing = ctx.createOscillator();
    sqRing.frequency.value = 90 + Math.random() * 60;
    const sqRingG = ctx.createGain();
    sqRingG.gain.value = 1400;
    sqRing.connect(sqRingG);
    sqRingG.connect(squeal.frequency);
    const sqGain = ctx.createGain();
    sqGain.gain.setValueAtTime(0.0001, t);
    sqGain.gain.exponentialRampToValueAtTime(0.4, t + 0.02);
    sqGain.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
    squeal.connect(sqGain);
    sqGain.connect(out);
    squeal.start(t); squeal.stop(t + 1.25);
    sqRing.start(t); sqRing.stop(t + 1.25);

    // 3) SUB-CAÍDA: golpe grave 90→28 Hz (impacto físico)
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(96, t);
    sub.frequency.exponentialRampToValueAtTime(27, t + 0.55);
    const subG = ctx.createGain();
    subG.gain.setValueAtTime(0.0001, t);
    subG.gain.exponentialRampToValueAtTime(0.95, t + 0.015);
    subG.gain.exponentialRampToValueAtTime(0.0001, t + 0.85);
    sub.connect(subG);
    subG.connect(out);
    sub.start(t); sub.stop(t + 0.9);

    // 4) RUIDO saturado en banda media (aliento metálico)
    this.noiseBurst(out, 1.35, 1600 + Math.random() * 600, 0.85, 'bandpass');
    this.noiseBurst(out, 0.18, 3500, 0.6, 'highpass');

    // 5) COLA: delay con retroalimentación (eco del grito por el complejo)
    const delay = ctx.createDelay(0.5);
    delay.delayTime.value = 0.14;
    const fb = ctx.createGain();
    fb.gain.value = 0.42;
    const fbFilter = ctx.createBiquadFilter();
    fbFilter.type = 'lowpass';
    fbFilter.frequency.value = 2200;
    delay.connect(fb);
    fb.connect(fbFilter);
    fbFilter.connect(delay);
    delay.connect(out);
    screamGain.connect(delay);

    // 6) metralla de estática justo después
    window.setTimeout(() => {
      if (this.ready) this.setStatic(0.85);
    }, 700);
    window.setTimeout(() => {
      if (this.ready) this.setStatic(0.45);
    }, 1050);
  }

  /** reaparición: latido + tono ascendente amortiguado */
  respawn() {
    if (!this.ready) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = 52 - i * 4;
      const g = ctx.createGain();
      this.env(g, t + i * 0.32, 0.02, 0.5, 0.24);
      o.connect(g);
      g.connect(this.sfxBus);
      o.start(t + i * 0.32);
      o.stop(t + i * 0.32 + 0.3);
    }
    const rise = ctx.createOscillator();
    rise.type = 'triangle';
    rise.frequency.setValueAtTime(110, t + 0.9);
    rise.frequency.exponentialRampToValueAtTime(440, t + 1.6);
    const rg = ctx.createGain();
    rg.gain.setValueAtTime(0.0001, t + 0.9);
    rg.gain.exponentialRampToValueAtTime(0.16, t + 1.05);
    rg.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
    rise.connect(rg);
    rg.connect(this.musicBus);
    rise.start(t + 0.9);
    rise.stop(t + 1.85);
  }

  victory() {
    if (!this.ready) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = f;
      const g = ctx.createGain();
      this.env(g, t + i * 0.22, 0.02, 0.2, 0.9);
      o.connect(g);
      g.connect(this.musicBus);
      o.start(t + i * 0.22);
      o.stop(t + i * 0.22 + 1);
    });
  }

  /* ============ AUDIO DE ARCHIVO (assets reales del repo FNAW) ============ */

  /** Música del tema (menú): loop de theme_music.mp3 por el bus de música
   *  con fundido de entrada. Reintentará cada 1 s si aún está descargando. */
  startThemeMusic() {
    if (!this.ready || !this.ctx) return;
    if (this.themeOn) return;
    this.themeOn = true;
    const tryStart = (attempt = 0) => {
      if (!this.themeOn || this.themeSrc) return;
      if (this.themeBuf) {
        const ctx = this.ctx!;
        const src = ctx.createBufferSource();
        src.buffer = this.themeBuf;
        src.loop = true;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.5, ctx.currentTime + 1.4);
        src.connect(g);
        g.connect(this.musicBus);
        src.start();
        this.themeSrc = src;
        this.themeGain = g;
      } else if (attempt < 8 && this.themeOn) {
        setTimeout(() => tryStart(attempt + 1), 1000);
      }
    };
    tryStart();
  }

  /** Detiene la música del tema con fundido de salida corto. */
  stopThemeMusic() {
    this.themeOn = false;
    if (!this.ctx || !this.themeSrc || !this.themeGain) return;
    const src = this.themeSrc;
    const g = this.themeGain;
    this.themeSrc = null;
    this.themeGain = null;
    const t = this.ctx.currentTime;
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    try { src.stop(t + 0.7); } catch { /* noop */ }
  }

  /** Grito REAL de jumpscare (jumpscare.mp3 del repo) por el bus SFX.
   *  Devuelve false si el archivo no está cargado (el llamador debe
   *  caer al grito sintético). */
  playJumpscareFile(): boolean {
    if (!this.ready || !this.ctx || !this.jumpscareBuf) return false;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.jumpscareBuf;
    const g = ctx.createGain();
    g.gain.value = 1.0;
    src.connect(g);
    g.connect(this.sfxBus);
    src.start();
    return true;
  }

  /* ============ SFX DE ARCHIVO (FN1 — sonidos originales de FNAF 1) ============ */

  /** dispara un SFX de archivo; pos opcional para audio 3D */
  playSfxFile(name: SfxFileName, volume = 1.0, pos?: Vec): boolean {
    if (!this.ready || !this.ctx) return false;
    const buf = this.sfxBufs.get(name);
    if (!buf) return false;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = volume;
    src.connect(g);
    if (pos) {
      const pan = this.panner(pos);
      g.connect(pan);
      pan.connect(this.sfxBus);
    } else {
      g.connect(this.sfxBus);
    }
    src.start();
    return true;
  }

  /** Marcha Toreador REAL del apagón de FNAF 1 (22 s). */
  playToreador(): boolean {
    return this.playSfxFile('toreador', 0.85);
  }

  /** v11: CLICK REAL de la linterna del repo (encender / apagar) */
  flashlightClick(on: boolean): boolean {
    return this.playSfxFile(on ? 'flashlight_click_on' : 'flashlight_click_off', 0.8);
  }

  /** v11: CARRERA DE FOXY REAL del repo ("Dumdum") — un disparo de 9.3 s
   *  posicional; se usa cuando un animatrónico entra en persecución. */
  playHunterRun(pos: Vec): boolean {
    return this.playSfxFile('foxy_run', 0.8, pos);
  }

  /** ruido de cocina (ollas y sartenes) posicional */
  kitchenClatter(pos: Vec): boolean {
    return this.playSfxFile('kitchen_clatter', 0.9, pos);
  }

  /** v9 — bucle posicional para el puzzle auditivo (fan / cocina real de FNAF 1).
   *  Devuelve un manejador con stop() para cortarlo al cambiar de ronda. */
  playLoopSfx(name: SfxFileName, pos: Vec, volume = 0.75): { stop: (fade?: number) => void } | null {
    if (!this.ready || !this.ctx) return null;
    const buf = this.sfxBufs.get(name);
    if (!buf) return null;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const g = ctx.createGain();
    g.gain.value = 0;
    g.gain.setTargetAtTime(volume, ctx.currentTime, 0.4);
    src.connect(g);
    const pan = this.panner(pos);
    g.connect(pan);
    pan.connect(this.sfxBus);
    src.start();
    let stopped = false;
    return {
      stop: (fade = 0.5) => {
        if (stopped || !this.ctx) return;
        stopped = true;
        const t = this.ctx.currentTime;
        g.gain.cancelScheduledValues(t);
        g.gain.setTargetAtTime(0, t, Math.max(0.03, fade / 3));
        try { src.stop(t + fade + 0.1); } catch { /* noop */ }
      },
    };
  }

  /** v9 — RISA DE FREDDY: "ho-ho-ho" grave y metálico (puzzle auditivo).
   *  Cada carcajada baja de tono y trastabilla como cinta vieja. */
  freddyLaugh(pos: Vec) {
    // v11: RISA REAL de Freddy del repo del usuario (con fallback sintético)
    if (this.playSfxFile('freddy_laugh', 0.95, pos)) return;
    if (!this.ready || !this.ctx) return;
    const pan = this.panner(pos);
    const ctx = this.ctx;
    const t0 = ctx.currentTime;
    const base = 96; // Hz — muy grave
    for (let i = 0; i < 4; i++) {
      const t = t0 + i * 0.34;
      const f = base * (1 - i * 0.06);
      // fundamental + parciales metálicos
      for (const [mult, vol] of [[1, 0.34], [2.02, 0.12], [3.1, 0.05]] as Array<[number, number]>) {
        const o = ctx.createOscillator();
        o.type = i % 2 ? 'sawtooth' : 'triangle';
        o.frequency.setValueAtTime(f * mult, t);
        o.frequency.exponentialRampToValueAtTime(f * mult * 0.82, t + 0.26);
        const g = ctx.createGain();
        this.env(g, t, 0.02, 0.22, vol);
        o.connect(g);
        g.connect(pan);
        o.start(t);
        o.stop(t + 0.4);
      }
      // traqueteo de cinta tras cada sílaba
      this.noiseBurst(pan, 0.06, 700 + i * 90, 0.045, 'bandpass');
    }
  }

  /* ============ LLAMADA DE RADIO CON VOZ REAL (TTS español) ============ */

  /** carga el manifiesto y los búferes de las líneas del capítulo.
   *  devuelve las duraciones reales por línea, o null si no hay voz. */
  async loadCall(chapter: number): Promise<number[] | null> {
    if (!this.ctx) return null;
    try {
      if (!this.callManifest) {
        const res = await fetch(`${ASSET_BASE}/audio/calls/manifest.json`);
        if (!res.ok) return null;
        this.callManifest = await res.json() as Record<string, Array<{ file: string; dur: number }>>;
      }
      const key = `cap${chapter}`;
      const lines = this.callManifest[key];
      if (!lines || !lines.length) return null;
      const durs: number[] = [];
      for (const l of lines) {
        if (!this.callBufs.has(l.file)) {
          const res = await fetch(`${ASSET_BASE}/audio/calls/${l.file}`);
          if (!res.ok) return null;
          const buf = await this.ctx.decodeAudioData(await res.arrayBuffer());
          this.callBufs.set(l.file, buf);
        }
        durs.push(l.dur);
      }
      this.callChapter = key;
      this.callFiles = lines.map((l) => l.file);
      return durs;
    } catch {
      return null;
    }
  }

  /** reproduce la línea i de la llamada del capítulo cargado.
   *  v11: la voz TTS es INGLESA y masculina natural (sin pitch-down —
   *  el usuario pidió menos grave). Los MP3 ya vienen filtrados de radio;
   *  aquí solo una pizca de saturación de válvula y límite de banda. */
  playCallLine(idx: number): boolean {
    if (!this.ready || !this.ctx) return false;
    const file = this.callFiles[idx];
    const buf = file ? this.callBufs.get(file) : undefined;
    if (!buf) return false;
    this.stopCallVoice();
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    // cadena de radio suave (la voz ya viene equalizada)
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 140; hp.Q.value = 0.4;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 3600; lp.Q.value = 0.5;
    const sat = ctx.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) curve[i] = Math.tanh(((i / 128) - 1) * 0.85);
    sat.curve = curve;
    const g = ctx.createGain();
    g.gain.value = 1.2;
    src.connect(hp); hp.connect(lp); lp.connect(sat); sat.connect(g);
    g.connect(this.sfxBus);
    src.start();
    this.activeCallLine = src;
    return true;
  }

  stopCallVoice() {
    if (this.activeCallLine) {
      try { this.activeCallLine.stop(); } catch { /* noop */ }
      this.activeCallLine = null;
    }
  }

  /* ============ AMBIENTE ============ */

  startAmbient() {
    if (!this.ready || !this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    // VENTILADOR REAL de FNAF 1 (fan_ambience.mp3) en loop por el bus ambiental
    const fanBuf = this.sfxBufs.get('fan_ambience');
    if (fanBuf && !this.fanSrc) {
      const src = ctx.createBufferSource();
      src.buffer = fanBuf;
      src.loop = true;
      const g = ctx.createGain();
      g.gain.value = 0.0;
      g.gain.setTargetAtTime(0.55, t, 1.5);
      src.connect(g);
      g.connect(this.ambientBus);
      src.start();
      this.fanSrc = src;
      this.fanGain = g;
    }
    // colchón de ruido pardo
    const n = this.noiseSrc(9999);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 320;
    const g = ctx.createGain();
    g.gain.value = 0.05;
    n.connect(lp);
    lp.connect(g);
    g.connect(this.ambientBus);
    // zumbido eléctrico
    const hum = ctx.createOscillator();
    hum.type = 'sine';
    hum.frequency.value = 55;
    const hg = ctx.createGain();
    hg.gain.value = 0.028;
    hum.connect(hg);
    hg.connect(this.ambientBus);
    hum.start(t);
  }

  setStatic(level: number) {
    this.staticTarget = level;
    // estática REAL de FNAF 1 (static_loop.mp3) si está cargada
    if (this.ready && this.ctx && !this.staticFileSrc && this.sfxBufs.get('static_loop')) {
      const ctx = this.ctx;
      const src = ctx.createBufferSource();
      src.buffer = this.sfxBufs.get('static_loop')!;
      src.loop = true;
      const g = ctx.createGain();
      g.gain.value = 0;
      src.connect(g);
      g.connect(this.sfxBus);
      src.start();
      this.staticFileSrc = src;
      this.staticFileGain = g;
    }
    if (this.staticFileGain && this.ctx) {
      this.staticFileGain.gain.setTargetAtTime(level * 0.5, this.ctx.currentTime, 0.12);
    }
  }

  private ensureStatic() {
    if (!this.ready || this.staticGain || !this.ctx) return;
    const ctx = this.ctx;
    const n = this.noiseSrc(9999);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2400;
    bp.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.value = 0;
    n.connect(bp);
    bp.connect(g);
    g.connect(this.sfxBus);
    this.staticGain = g;
  }

  setBreathing(on: boolean) {
    if (!this.ready) return;
    if (on && !this.breathGain) {
      const ctx = this.ctx!;
      const n = this.noiseSrc(9999);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 700;
      bp.Q.value = 2.4;
      const g = ctx.createGain();
      g.gain.value = 0;
      n.connect(bp);
      bp.connect(g);
      g.connect(this.sfxBus);
      this.breathGain = g;
    } else if (!on && this.breathGain) {
      try { this.breathGain.disconnect(); } catch { /* noop */ }
      this.breathGain = null;
    }
  }

  startPhoneVoice(seconds: number) {
    if (!this.ready) return;
    this.stopPhoneVoice();
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const n = this.noiseSrc(seconds + 1);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 500;
    bp.Q.value = 3;
    // modulación tipo voz apagada
    const lfo = ctx.createOscillator();
    lfo.type = 'square';
    lfo.frequency.value = 3.7;
    const lfoG = ctx.createGain();
    lfoG.gain.value = 320;
    lfo.connect(lfoG);
    lfoG.connect(bp.frequency);
    const trem = ctx.createOscillator();
    trem.frequency.value = 2.3;
    const tremG = ctx.createGain();
    tremG.gain.value = 0.014;
    trem.connect(tremG);
    const g = ctx.createGain();
    g.gain.value = 0.016;
    tremG.connect(g.gain);
    n.connect(bp);
    bp.connect(g);
    g.connect(this.sfxBus);
    n.stop(t + seconds + 0.5);
    lfo.start(t); lfo.stop(t + seconds + 0.5);
    trem.start(t); trem.stop(t + seconds + 0.5);
    this.phoneVoice = { src: n, gain: g };
  }

  stopPhoneVoice() {
    if (this.phoneVoice) {
      try {
        this.phoneVoice.src.stop();
        this.phoneVoice.gain.disconnect();
      } catch { /* noop */ }
      this.phoneVoice = null;
    }
  }

  phoneBeep() {
    if (!this.ready) return;
    this.osc('sine', 880, 880, 0.3, 0.1, this.sfxBus);
    setTimeout(() => this.osc('sine', 880, 880, 0.3, 0.1, this.sfxBus), 450);
  }

  /* ============ CAJA MUSICAL ============ */

  setMusicBox(level: number, pos: Vec) {
    this.musicLevel = level;
    this.musicPos = pos;
  }

  private tickMusicBox(dt: number) {
    if (this.musicLevel <= 0.02) return;
    const interval = 0.42 + (1 - this.musicLevel) * 0.35;
    this.musicNoteT -= dt;
    if (this.musicNoteT <= 0) {
      this.musicNoteT = interval;
      const f = MELODY[this.musicIdx % MELODY.length];
      this.musicIdx++;
      this.playMusicNote(f);
      if (this.musicIdx % 8 === 0) this.musicIdx += 0;
    }
  }

  private playMusicNote(f: number) {
    if (!this.ready || !this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const pan = this.panner(this.musicPos);
    pan.connect(this.musicBus);
    const detune = (1 - this.musicLevel) * -160 * (Math.random() - 0.3);
    const vol = 0.1 + this.musicLevel * 0.06;
    for (const [mul, v] of [[1, 1], [2.01, 0.35], [3.02, 0.12]] as Array<[number, number]>) {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = f * mul + detune * 0.01;
      const g = ctx.createGain();
      this.env(g, t, 0.004, vol * v, 0.5);
      o.connect(g);
      g.connect(pan);
      o.start(t);
      o.stop(t + 0.55);
    }
  }

  /* ============ BUCLE DE PERSECUCIÓN Y LATIDO ============ */

  setChase(on: boolean) {
    if (this.chaseOn === on) return;
    this.chaseOn = on;
    if (on) this.chaseT = 0;
  }

  private tickChase(dt: number) {
    if (!this.chaseOn || !this.ready || !this.ctx) return;
    this.chaseT -= dt;
    if (this.chaseT <= 0) {
      this.chaseT = 0.30;
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(58, t);
      o.frequency.exponentialRampToValueAtTime(46, t + 0.24);
      const g = this.ctx.createGain();
      this.env(g, t, 0.01, 0.2, 0.26);
      o.connect(g);
      g.connect(this.musicBus);
      o.start(t);
      o.stop(t + 0.3);
      // capa de tensión
      const o2 = this.ctx.createOscillator();
      o2.type = 'sawtooth';
      o2.frequency.value = 466 + Math.random() * 8;
      o2.detune.value = (Math.random() - 0.5) * 40;
      const g2 = this.ctx.createGain();
      this.env(g2, t, 0.03, 0.045, 0.28);
      o2.connect(g2);
      g2.connect(this.musicBus);
      o2.start(t);
      o2.stop(t + 0.32);
    }
  }

  private tickHeartbeat(dt: number) {
    if (this.danger <= 0.05 || !this.ready) return;
    const bpm = 58 + this.danger * 76;
    const period = 60 / bpm;
    this.heartbeatT -= dt;
    if (this.heartbeatT <= 0) {
      this.heartbeatT = period;
      const beat = (delay: number, vol: number) => {
        if (!this.ctx) return;
        const t = this.ctx.currentTime + delay;
        const o = this.ctx.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(58, t);
        o.frequency.exponentialRampToValueAtTime(38, t + 0.12);
        const g = this.ctx.createGain();
        this.env(g, t, 0.01, vol, 0.14);
        o.connect(g);
        g.connect(this.sfxBus);
        o.start(t);
        o.stop(t + 0.16);
      };
      const v = 0.12 + this.danger * 0.3;
      beat(0, v);
      beat(0.18, v * 0.6);
    }
  }

  private tickBreathing(dt: number) {
    if (!this.breathGain || !this.ctx) return;
    this.breathT += dt;
    const cycle = 0.9 + Math.sin(this.breathT * 0.2) * 0.1;
    const phase = (this.breathT % cycle) / cycle;
    const envelope = Math.sin(phase * Math.PI);
    this.breathGain.gain.setTargetAtTime(envelope * 0.05, this.ctx.currentTime, 0.05);
  }

  /* ============ ACTUALIZACIÓN POR FOTOGRAMA ============ */

  /* ============ V7 — MEGA GUARDERÍA EN LLAMAS ============ */

  /** nana/canción REAL del repo (daycare_song.mp3) en loop, tenue, por el bus musical.
   *  La canción infantil sonando entre las llamas: puro Security Breach. */
  setDaycareSong(on: boolean) {
    if (!this.ready || !this.ctx) return;
    if (on === this.daycareSongOn) return;
    this.daycareSongOn = on;
    const ctx = this.ctx;
    if (!on) {
      if (this.daycareSrc && this.daycareGain) {
        const t = ctx.currentTime;
        this.daycareGain.gain.cancelScheduledValues(t);
        this.daycareGain.gain.setValueAtTime(Math.max(0.0001, this.daycareGain.gain.value), t);
        this.daycareGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
        try { this.daycareSrc.stop(t + 0.9); } catch { /* noop */ }
        this.daycareSrc = null;
        this.daycareGain = null;
      }
      return;
    }
    const tryStart = () => {
      if (!this.daycareSongOn || !this.ctx || this.daycareSrc || !this.daycareBuf) return;
      const c = this.ctx;
      const src = c.createBufferSource();
      src.buffer = this.daycareBuf;
      src.loop = true;
      const g = c.createGain();
      g.gain.value = 0.0001;
      const t = c.currentTime;
      g.gain.setTargetAtTime(0.34, t, 1.8);
      src.connect(g);
      g.connect(this.musicBus);
      src.start();
      this.daycareSrc = src;
      this.daycareGain = g;
    };
    tryStart();
    // si el mp3 aún no decodificó, reintentar (máx 8)
    if (!this.daycareSrc && this.daycareRetries < 8) {
      this.daycareRetries++;
      window.setTimeout(() => { if (this.daycareSongOn) this.setDaycareSong(true); }, 700);
    }
  }

  /** crepitar del fuego: colchón de ruido filtrado + chasquidos aleatorios (pops) */
  setFireAmbience(on: boolean) {
    if (!this.ready || !this.ctx) return;
    const ctx = this.ctx;
    if (on && !this.fireGain) {
      // base: ruido con bandpass ancho y LFO de amplitud
      const n = this.noiseSrc(9999);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1400;
      bp.Q.value = 0.35;
      const g = ctx.createGain();
      g.gain.value = 0.0001;
      g.gain.setTargetAtTime(0.3, ctx.currentTime, 1.2);
      // LFO: vaivén del rugido
      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.23;
      const lfoG = ctx.createGain();
      lfoG.gain.value = 0.11;
      lfo.connect(lfoG);
      lfoG.connect(g.gain);
      lfo.start();
      // retumbo grave
      const n2 = this.noiseSrc(9999);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 95;
      const g2 = ctx.createGain();
      g2.gain.value = 0.32;
      n2.connect(lp); lp.connect(g2);
      n.connect(bp); bp.connect(g);
      g.connect(this.ambientBus);
      g2.connect(this.ambientBus);
      this.fireGain = g;
      this.firePopT = 0.2;
    } else if (!on && this.fireGain) {
      const g = this.fireGain;
      g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.6);
      window.setTimeout(() => { try { g.disconnect(); } catch { /* noop */ } }, 1600);
      this.fireGain = null;
    }
  }

  /** chasquidos aleatorios del fuego (llamado desde update) */
  private tickFire(dt: number) {
    if (!this.fireGain || !this.ctx) return;
    this.firePopT -= dt;
    if (this.firePopT > 0) return;
    this.firePopT = 0.06 + Math.random() * 0.34;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.playbackRate.value = 0.7 + Math.random() * 1.1;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 700 + Math.random() * 2600;
    bp.Q.value = 1.2 + Math.random() * 4;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    const vol = 0.14 + Math.random() * 0.5;
    const dur = 0.02 + Math.random() * 0.07;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bp); bp.connect(g);
    g.connect(this.ambientBus);
    src.start(t, Math.random() * 1.5, dur + 0.02);
  }

  /** descarga del extintor: CO2 a presión (ruido agudo con ataque violento) */
  extinguisherSpray() {
    if (!this.ready || !this.ctx) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    src.playbackRate.value = 1.35;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1400;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 7200;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    // pssshh: ataque brusco, cuerpo de 2.6 s y caída
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.05);
    g.gain.setValueAtTime(0.5, t + 2.0);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.9);
    src.connect(hp); hp.connect(lp); lp.connect(g);
    g.connect(this.sfxBus);
    src.start(t);
    src.stop(t + 3.0);
  }

  update(dt: number) {
    if (!this.ready || !this.ctx) return;
    this.tickMusicBox(dt);
    this.tickChase(dt);
    this.tickHeartbeat(dt);
    this.tickBreathing(dt);
    this.tickFire(dt);
    // estática: si el archivo REAL de FNAF 1 está activo, se usa; si no, síntesis
    if (!this.staticFileGain) this.ensureStatic();
    if (this.staticFileGain) {
      this.staticFileGain.gain.setTargetAtTime(this.staticTarget * 0.5, this.ctx.currentTime, 0.12);
    } else if (this.staticGain) {
      this.staticGain.gain.setTargetAtTime(this.staticTarget * 0.16, this.ctx.currentTime, 0.1);
    }
  }
}
