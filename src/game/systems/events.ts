/**
 * Director de eventos de terror: eventos aleatorios ponderados
 * desde JSON + eventos guionizados (llamadas, ruido de cocina).
 */
import * as THREE from 'three';
import eventsData from '@/data/events.json';
import type { WorldBuilder } from '../world/worldbuilder';
import type { Player } from '../player/player';
import type { Animatronic } from '../ai/animatronic';

export interface EventHost {
  world: WorldBuilder;
  player: Player;
  animatronics: Animatronic[];
  time: number;
  night: number;
  eventRate: number;
  audio: {
    knock(pos: { x: number; y: number; z: number }, count?: number): void;
    whisper(pos: { x: number; y: number; z: number }): void;
    childLaugh(pos: { x: number; y: number; z: number }): void;
    radioBurst(pos: { x: number; y: number; z: number }): void;
    ventBang(pos: { x: number; y: number; z: number }): void;
    doorCreak(pos: { x: number; y: number; z: number }): void;
    footstep(pos: { x: number; y: number; z: number }, surface: string, running: boolean, heavy: boolean): void;
    setStatic(l: number): void;
    powerDown(): void;
    kitchenClatter(pos: { x: number; y: number; z: number }): boolean;
  };
  addPowerDrain(v: number): void;
  onCallStart(lines: string[]): void;
  onKitchenNoise(): void;
}

interface ShadowFigure {
  mesh: THREE.Group;
  life: number;
}

export class EventDirector {
  host: EventHost;
  private timer = 22;
  private lastEvents: string[] = [];
  private shadows: ShadowFigure[] = [];
  private fakeWalkers: Array<{ pos: THREE.Vector3; target: THREE.Vector3; timer: number }> = [];
  callDone = false;
  kitchenNoiseDone = false;
  kitchenNoiseAt = 4.2; // minuto
  private elapsed = 0;

  constructor(host: EventHost) {
    this.host = host;
    this.timer = 14 + Math.random() * 10;
  }

  update(dt: number) {
    this.elapsed += dt / 60;
    this.timer -= dt * this.host.eventRate;
    if (this.timer <= 0) {
      this.timer = 20 + Math.random() * 26;
      this.rollEvent();
    }
    // figuras sombra
    for (const s of this.shadows) {
      s.life -= dt;
      // desaparece si la linterna la ilumina directamente
      const p = this.host.player;
      if (p.flashlightOn) {
        const to = s.mesh.position.clone().sub(p.pos).normalize();
        if (to.dot(p.lookDir) > 0.94) {
          s.life = Math.min(s.life, 0.25);
        }
      }
      if (s.life <= 0) {
        this.host.world.root.remove(s.mesh);
      }
    }
    this.shadows = this.shadows.filter((s) => {
      if (s.life <= 0) {
        s.mesh.traverse((o) => {
          if (o instanceof THREE.Mesh) o.geometry.dispose();
        });
        return false;
      }
      return true;
    });
    // pasos falsos que se acercan
    for (const w of this.fakeWalkers) {
      w.timer -= dt;
      if (w.timer <= 0) {
        w.timer = 0.42;
        const dir = w.target.clone().sub(w.pos);
        if (dir.length() > 1.2) {
          dir.normalize();
          w.pos.addScaledVector(dir, 1.1);
          this.host.audio.footstep(w.pos, 'tile', false, true);
        }
      }
    }
    this.fakeWalkers = this.fakeWalkers.filter((w) => w.target.distanceTo(w.pos) > 1.0);
  }

  private rollEvent() {
    const list = (eventsData.events as Array<{ id: string; weight: number; minNight?: number }>)
      .filter((e) => (e.minNight ?? 1) <= this.host.night)
      .filter((e) => !this.lastEvents.slice(-3).includes(e.id));
    const total = list.reduce((s, e) => s + e.weight, 0);
    if (total <= 0) return;
    let r = Math.random() * total;
    let pick = list[0];
    for (const e of list) {
      r -= e.weight;
      if (r <= 0) { pick = e; break; }
    }
    this.lastEvents.push(pick.id);
    if (this.lastEvents.length > 6) this.lastEvents.shift();
    this.execute(pick.id);
  }

  private nearPlayerPos(minD: number, maxD: number): THREE.Vector3 {
    const p = this.host.player.pos;
    const ang = Math.random() * Math.PI * 2;
    const d = minD + Math.random() * (maxD - minD);
    return new THREE.Vector3(p.x + Math.cos(ang) * d, 1, p.z + Math.sin(ang) * d);
  }

  private execute(id: string) {
    const a = this.host.audio;
    const p = this.host.player;
    switch (id) {
      case 'knock_wall': {
        a.knock(this.nearPlayerPos(4, 9), 2 + ((Math.random() * 2) | 0));
        break;
      }
      case 'knock_door': {
        let best: THREE.Vector3 | null = null;
        let bestD = 99;
        for (const d of this.host.world.doors.values()) {
          const dd = Math.hypot(d.def.x - p.pos.x, d.def.z - p.pos.z);
          if (dd > 4 && dd < 14 && dd < bestD) {
            bestD = dd;
            best = new THREE.Vector3(d.def.x, 1, d.def.z);
          }
        }
        if (best) a.knock(best, 3);
        break;
      }
      case 'footsteps_fake': {
        const from = this.nearPlayerPos(13, 17);
        this.fakeWalkers.push({ pos: from, target: p.pos.clone(), timer: 0.1 });
        break;
      }
      case 'whisper': {
        // detrás del jugador
        const behind = p.pos.clone().sub(p.lookDir.clone().multiplyScalar(1.6));
        a.whisper(behind);
        break;
      }
      case 'light_flicker': {
        const room = this.host.world.roomAt(p.pos.x, p.pos.z);
        if (room) room.blackoutTimer = 1.5 + Math.random() * 2.5;
        break;
      }
      case 'cam_glitch': {
        a.setStatic(0.85);
        setTimeout(() => a.setStatic(0.12), 900);
        break;
      }
      case 'shadow_figure': {
        this.spawnShadow();
        break;
      }
      case 'vent_bang': {
        const vents = Array.from(this.host.world.vents.values());
        const v = vents[(Math.random() * vents.length) | 0];
        a.ventBang(new THREE.Vector3(v.def.a[0], 0.6, v.def.a[1]));
        break;
      }
      case 'child_laugh': {
        a.childLaugh(this.nearPlayerPos(8, 14));
        break;
      }
      case 'power_dip': {
        this.host.addPowerDrain(6);
        a.powerDown();
        break;
      }
      case 'door_creak': {
        for (const d of this.host.world.doors.values()) {
          const dd = Math.hypot(d.def.x - p.pos.x, d.def.z - p.pos.z);
          if (dd > 6 && dd < 16) {
            a.doorCreak(new THREE.Vector3(d.def.x, 1, d.def.z));
            break;
          }
        }
        break;
      }
      case 'radio_burst': {
        const ph = this.host.world.anchors.get('payphone');
        if (ph && ph.pos.distanceTo(p.pos) < 26) a.radioBurst(ph.pos);
        else a.radioBurst(this.nearPlayerPos(10, 15));
        break;
      }
      case 'stairs_thump': {
        a.knock(this.nearPlayerPos(10, 14), 4);
        break;
      }
    }
  }

  private spawnShadow() {
    const p = this.host.player;
    // colocar en un pasillo en la línea de visión
    const dir = p.lookDir.clone().setY(0).normalize();
    const dist = 9 + Math.random() * 6;
    const pos = p.pos.clone().addScaledVector(dir, dist);
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.93 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 1.1, 4, 8), mat);
    body.position.y = 0.95;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 10), mat);
    head.position.y = 1.78;
    g.add(body, head);
    g.position.set(pos.x, 0, pos.z);
    g.lookAt(p.pos.x, 1.6, p.pos.z);
    this.host.world.root.add(g);
    this.shadows.push({ mesh: g, life: 5 + Math.random() * 2 });
    // susurro simultáneo
    this.host.audio.whisper(pos);
  }

  /** llamada telefónica de inicio de noche */
  triggerCall(lines: string[]) {
    if (this.callDone) return;
    this.callDone = true;
    this.host.onCallStart(lines);
  }

  /** ruido de cocina (noche 2) — CLATTER real de FNAF 1 */
  checkKitchenNoise(minute: number) {
    if (!this.kitchenNoiseDone && this.host.night === 2 && minute >= this.kitchenNoiseAt) {
      this.kitchenNoiseDone = true;
      const pos = new THREE.Vector3(-18, 1.2, -13);
      if (!this.host.audio.kitchenClatter(pos)) {
        this.host.audio.knock(pos, 5);
        this.host.audio.ventBang(pos);
      }
      this.host.onKitchenNoise();
    }
  }

  reset() {
    for (const s of this.shadows) {
      this.host.world.root.remove(s.mesh);
    }
    this.shadows = [];
    this.fakeWalkers = [];
    this.callDone = false;
    this.kitchenNoiseDone = false;
    this.elapsed = 0;
    this.timer = 14 + Math.random() * 10;
  }
}
