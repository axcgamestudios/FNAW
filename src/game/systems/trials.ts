/**
 * Sistema de PRUEBAS (trials): salas de misión con sustos guionizados,
 * tareas ordenadas y RESPAWN al ser atrapado (jumpscare + reintento).
 * Estilo Security Breach: entrar, superar, sobrevivir.
 */
import * as THREE from 'three';
import trialsData from '@/data/trials.json';
import type { TrialDef, TrialScare, Interactable } from '../core/types';
import type { WorldBuilder } from '../world/worldbuilder';
import type { Animatronic } from '../ai/animatronic';
import type { Player } from '../player/player';
import { MEGA_FIRE } from '../world/fire';

export interface TrialHudData {
  name: string | null;
  attempts: number;
  tasksDone: number;
  tasksTotal: number;
  nextTask: string | null;
}

export interface TrialHost {
  world: WorldBuilder;
  player: Player;
  animatronics: Animatronic[];
  notify(msg: string): void;
  setTrialHud(data: TrialHudData): void;
  completeObjective(id: string): void;
  objectiveDone(id: string): boolean;
  registerInteractable(inter: Interactable): void;
  clearTrialInteractables(): void;
  addNoise(x: number, z: number, r: number): void;
  onTrialSuccess(trial: TrialDef): void;
  /** desbloquear y abrir una puerta/reja (maneja nav + colliders) */
  unlockDoor(id: string): void;
  sfx: {
    stinger(): void;
    roar(pos: THREE.Vector3, voice: string): void;
    ventBang(pos: THREE.Vector3): void;
    childLaugh(pos: THREE.Vector3): void;
    footstep(pos: THREE.Vector3, surface: string, running: boolean, heavy: boolean): void;
    powerDown(): void;
    powerUp(): void;
    switchClick(): void;
    respawn(): void;
    moonScream(pos: THREE.Vector3): void;
    lullaby(pos: THREE.Vector3): void;
    /** v7 — Mega Guardería en llamas */
    extinguisherSpray(): void;
    setFireAmbience(on: boolean): void;
    setDaycareSong(on: boolean): void;
  };
}

type TrialsFile = { trials: TrialDef[] };
const ALL_TRIALS = (trialsData as unknown as TrialsFile).trials;

export class TrialSystem {
  host: TrialHost;
  chapter = 1;
  active: TrialDef | null = null;
  attempts = 0;
  tasksDone: string[] = [];
  armed = false; // se activó al menos una vez (evita re-notify)
  private lightsOutT = 0;
  private fakeStepsT = 0;
  private fakeStepsCount = 0;

  constructor(host: TrialHost) {
    this.host = host;
  }

  trialForChapter(n: number): TrialDef | null {
    return ALL_TRIALS.find((t) => t.chapter === n) ?? null;
  }

  get hunter(): Animatronic | null {
    if (!this.active) return null;
    return this.host.animatronics.find((a) => a.def.id === this.active!.hunter) ?? null;
  }

  /** ¿el objetivo de prueba del capítulo ya está completado? (activa o no) */
  objectiveComplete(): boolean {
    const t = this.active ?? this.trialForChapter(this.chapter);
    if (!t) return false;
    return this.host.objectiveDone(`c${t.chapter}_trial`);
  }

  syncHud() {
    if (!this.active) {
      this.host.setTrialHud({ name: null, attempts: 0, tasksDone: 0, tasksTotal: 0, nextTask: null });
      return;
    }
    const next = this.nextTask();
    this.host.setTrialHud({
      name: this.active.name,
      attempts: this.attempts,
      tasksDone: this.tasksDone.length,
      tasksTotal: this.active.tasks.length,
      nextTask: next ? next.label : null,
    });
  }

  /* ============ ACTIVACIÓN ============ */

  update(dt: number, roomId: string) {
    if (!this.active) {
      // ¿entrar en la sala de la prueba del capítulo?
      const t = this.trialForChapter(this.chapter);
      if (t && roomId === t.room && !this.objectiveComplete()) {
        // gate de objetivos previos (p. ej. sigilo + linterna antes de Sol y Luna)
        const reqs = (t as TrialDef & { requiresObjectives?: string[] }).requiresObjectives;
        const gated = reqs?.some((r) => !this.host.objectiveDone(r)) ?? false;
        if (!gated) this.begin(t);
      }
      return;
    }
    // apagón temporizado de la prueba
    if (this.lightsOutT > 0) {
      this.lightsOutT -= dt;
      if (this.lightsOutT <= 0) {
        this.host.world.setRoomLight(this.active.room, true);
        this.host.sfx.powerUp();
      }
    }
    // pasos falsos en cadena
    if (this.fakeStepsT > 0) {
      this.fakeStepsT -= dt;
      if (this.fakeStepsT <= 0 && this.fakeStepsCount > 0) {
        this.fakeStepsCount--;
        const p = this.host.player.pos;
        const ang = Math.random() * Math.PI * 2;
        this.host.sfx.footstep(new THREE.Vector3(p.x + Math.cos(ang) * 3.5, 0, p.z + Math.sin(ang) * 3.5), 'tile', false, true);
        this.fakeStepsT = 0.33 + Math.random() * 0.2;
      }
    }
  }

  begin(t: TrialDef) {
    this.active = t;
    this.attempts = 0;
    this.tasksDone = [];
    this.armed = true;
    this.registerTasks();
    this.host.notify(t.introMsg);
    this.host.sfx.stinger();
    this.host.player.setShake(0.5);
    // luces de la sala: encendidas al empezar... salvo pruebas que nacen a oscuras (Sol y Luna)
    const dark = !!(t as TrialDef & { darkFromStart?: boolean }).darkFromStart;
    this.host.world.setRoomLight(t.room, !dark);
    if (dark) this.host.sfx.powerDown();
    this.resetGeneratorLights(t);
    // v7 — el infierno: reencender todos los fuegos + ambiente
    if (t.room === 'megadaycare') {
      MEGA_FIRE?.begin();
      this.host.sfx.setFireAmbience(true);
      this.host.sfx.setDaycareSong(true);
    }
    this.fireScares('start');
    this.syncHud();
  }

  /** luces de estado de los generadores de la guardería: todas a rojo */
  private resetGeneratorLights(t: TrialDef) {
    for (const task of t.tasks) {
      const a = this.host.world.anchors.get(`dcgen_${task.id}`);
      if (a?.mesh) {
        const m = (a.mesh as THREE.Mesh).material as THREE.MeshStandardMaterial;
        m.emissive.setHex(0xff2020);
        m.color.setHex(0x5a0808);
        m.emissiveIntensity = 2.2;
      }
    }
  }

  /** generador arrancado: luz a verde fija */
  private setGeneratorDone(taskId: string) {
    const a = this.host.world.anchors.get(`dcgen_${taskId}`);
    if (a?.mesh) {
      const m = (a.mesh as THREE.Mesh).material as THREE.MeshStandardMaterial;
      m.emissive.setHex(0x2aff5a);
      m.color.setHex(0x0a3a18);
      m.emissiveIntensity = 2.6;
    }
  }

  private registerTasks() {
    if (!this.active) return;
    this.host.clearTrialInteractables();
    const t = this.active;
    const isFire = t.room === 'megadaycare';
    t.tasks.forEach((task, i) => {
      this.host.registerInteractable({
        id: `trial_${t.id}_${task.id}`,
        label: task.label,
        pos: { x: task.at[0], y: 1.1, z: task.at[1] },
        radius: isFire ? 2.3 : 1.6,
        holdTime: task.hold,
        holdLabel: isFire ? 'APAGANDO EL FUEGO' : 'TRABAJANDO',
        enabled: () => this.active === t && !this.tasksDone.includes(task.id) && this.isNextTask(task.id),
        action: () => {
          this.completeTask(task.id);
        },
      });
    });
  }

  private isNextTask(taskId: string): boolean {
    if (!this.active) return false;
    const remaining = this.active.tasks.filter((x) => !this.tasksDone.includes(x.id));
    return remaining.length > 0 && remaining[0].id === taskId;
  }

  private nextTask() {
    if (!this.active) return null;
    return this.active.tasks.find((x) => !this.tasksDone.includes(x.id)) ?? null;
  }

  completeTask(taskId: string) {
    if (!this.active || this.tasksDone.includes(taskId)) return;
    this.tasksDone.push(taskId);
    // v7 — extintor: chorro de CO2 + el fuego de esa zona muere
    if (this.active.room === 'megadaycare') {
      MEGA_FIRE?.extinguish(taskId);
      this.host.sfx.extinguisherSpray();
      this.host.addNoise(this.host.player.pos.x, this.host.player.pos.z, 9); // Luna lo oye
    } else {
      this.host.sfx.switchClick();
    }
    this.setGeneratorDone(taskId);
    const idx = this.tasksDone.length;
    if (this.active.tasks.length > 1) {
      this.host.notify(`TAREA ${idx}/${this.active.tasks.length} — ${this.nextTask()?.label ?? ''}`);
    }
    // disparar susto por número de tarea (hasta task7)
    const key = `task${Math.min(idx, 7)}` as 'task1' | 'task2' | 'task3' | 'task4' | 'task5' | 'task6' | 'task7';
    this.fireScares(key);
    if (this.tasksDone.length >= this.active.tasks.length) {
      this.succeed();
    } else {
      this.syncHud();
    }
  }

  private succeed() {
    if (!this.active) return;
    const t = this.active;
    const sunny = !!(t as TrialDef & { sunnyTransform?: boolean }).sunnyTransform;
    this.host.sfx.powerUp();
    const hunter = this.hunter;
    if (sunny && hunter) {
      // SOL Y LUNA: la luz lo cambia — se vuelve amable y se retira para siempre
      hunter.setDayNight('sun');
      hunter.retire();
      if (t.room === 'megadaycare') {
        hunter.teleportTo(0, -46, 0.4); // junto a la alberca gigante, sonriendo
      } else {
        hunter.teleportTo(-20.5, 3.0, 0); // junto al borde norte de la alberca, sonriendo
      }
      // rejas de la guardería abiertas de nuevo
      for (const gid of ['gate_daycare_n', 'gate_daycare_e', 'gate_daycare_s', 'gate_daycare_w']) {
        this.host.unlockDoor(gid);
      }
    } else {
      // el cazador se retira
      if (hunter) {
        const resetRoom = this.host.world.rooms.get(t.hunterResetRoom);
        if (resetRoom) hunter.teleportTo(resetRoom.center.x, resetRoom.center.z);
        hunter.calmDown();
      }
    }
    this.host.world.setRoomLight(t.room, true);
    // v7 — apagar el infierno restante y callar la nana
    if (t.room === 'megadaycare') {
      MEGA_FIRE?.extinguishAll();
      this.host.sfx.setFireAmbience(false);
      this.host.sfx.setDaycareSong(false);
    }
    this.host.completeObjective(`c${t.chapter}_trial`);
    this.host.notify(t.successMsg);
    this.host.onTrialSuccess(t);
    this.active = null;
    this.host.clearTrialInteractables();
    this.syncHud();
  }

  /* ============ MUERTE / RESPAWN ============ */

  /** ¿el jugador murió dentro de la prueba? → true = respawn en el punto de control */
  onPlayerCaught(): { trial: TrialDef; attempts: number } | null {
    if (!this.active) return null;
    // solo si murió dentro de la sala de la prueba (o cerca)
    const p = this.host.player.pos;
    const r = this.host.world.roomAt(p.x, p.z);
    if (r && r.def.id !== this.active.room) return null;
    this.attempts++;
    const t = this.active;
    this.tasksDone = []; // la prueba se reinicia de cero (puro estilo prueba)
    // v7 — el infierno vuelve a arder entero
    if (t.room === 'megadaycare') {
      MEGA_FIRE?.begin();
    }
    // el cazador se recoloca lejos
    const hunter = this.hunter;
    if (hunter) {
      const resetPos = (t as TrialDef & { hunterResetPos?: [number, number] }).hunterResetPos;
      if (resetPos) {
        hunter.teleportTo(resetPos[0], resetPos[1]);
      } else {
        const resetRoom = this.host.world.rooms.get(t.hunterResetRoom);
        if (resetRoom) hunter.teleportTo(resetRoom.center.x, resetRoom.center.z);
      }
      hunter.calmDown();
    }
    this.registerTasks();
    this.resetGeneratorLights(t);
    this.syncHud();
    return { trial: t, attempts: this.attempts };
  }

  /** reaparcer al jugador en el punto de control tras el jumpscare */
  respawnPlayer() {
    if (!this.active) return;
    const t = this.active;
    const dark = !!(t as TrialDef & { darkFromStart?: boolean }).darkFromStart;
    this.host.player.pos.set(t.respawnPos[0], 0, t.respawnPos[1]);
    this.host.player.vel.set(0, 0, 0);
    this.host.player.yaw = t.respawnYaw;
    this.host.player.pitch = 0;
    this.host.player.stamina = 100;
    this.host.player.staminaLock = false;
    this.host.player.hidden = false;
    this.host.player.hiddenSpotId = null;
    if (dark) {
      // la prueba nació a oscuras: SIGUE a oscuras tras el respawn
      this.host.world.setAllLights(false);
    } else {
      this.host.world.setAllLights(false, [t.room]);
      this.host.world.setRoomLight(t.room, true);
    }
    this.host.sfx.respawn();
    this.syncHud();
  }

  /* ============ SUSTOS ============ */

  private fireScares(at: 'start' | 'task1' | 'task2' | 'task3' | 'task4' | 'task5' | 'task6' | 'task7' | 'end') {
    if (!this.active) return;
    for (const s of this.active.scares as TrialScare[]) {
      if (s.at !== at) continue;
      this.runScare(s);
    }
  }

  private runScare(s: TrialScare) {
    const player = this.host.player;
    const hunter = this.hunter;
    switch (s.type) {
      case 'stingerClose': {
        this.host.sfx.stinger();
        player.setShake(0.75);
        // el cazador se acerca AL MENOS a la sala
        if (hunter && this.active) {
          const room = this.host.world.rooms.get(this.active.room);
          if (room) {
            const dx = room.center.x + (Math.random() - 0.5) * (room.def.rect[2] - room.def.rect[0]) * 0.4;
            const dz = room.center.z + (Math.random() - 0.5) * (room.def.rect[3] - room.def.rect[1]) * 0.4;
            hunter.teleportTo(dx, dz, Math.atan2(player.pos.x - dx, player.pos.z - dz));
            hunter.calmDown();
            this.host.sfx.roar(hunter.pos, hunter.def.voice);
          }
        }
        break;
      }
      case 'hunterAppear': {
        if (hunter) {
          hunter.teleportTo(s.pos[0], s.pos[1], Math.atan2(player.pos.x - s.pos[0], player.pos.z - s.pos[1]));
          this.host.sfx.roar(hunter.pos, hunter.def.voice);
          player.setShake(0.55);
          // se queda mirando (investigate hacia el jugador) sin perseguir aún
          hunter.calmDown();
        }
        break;
      }
      case 'lightsOut': {
        if (this.active) {
          this.host.world.setAllLights(false);
          this.host.sfx.powerDown();
          this.lightsOutT = s.dur;
        }
        break;
      }
      case 'fakeSteps': {
        this.fakeStepsCount = 6 + (Math.random() * 3 | 0);
        this.fakeStepsT = 0.15;
        break;
      }
      case 'childLaugh': {
        const room = this.active ? this.host.world.rooms.get(this.active.room) : null;
        const c = room ? room.center : player.pos;
        this.host.sfx.childLaugh(c);
        player.setShake(0.35);
        break;
      }
      case 'hunterChase': {
        if (hunter) {
          hunter.forceChase(player.pos);
          this.host.sfx.stinger();
          player.setShake(0.9);
        }
        break;
      }
      case 'ventBang': {
        this.host.sfx.ventBang(player.pos);
        player.setShake(0.3);
        break;
      }
      case 'moonScream': {
        const room = this.active ? this.host.world.rooms.get(this.active.room) : null;
        const c = room ? room.center : player.pos;
        this.host.sfx.moonScream(c);
        player.setShake(1.0);
        // acude a mirar dónde estabas (sin perseguir aún)
        if (hunter) hunter.investigateAt(new THREE.Vector3(player.pos.x, 0, player.pos.z));
        break;
      }
      case 'moonDescend': {
        // LUNA cae del techo de la Mega Guardería y despierta
        if (hunter) {
          hunter.hanging = false;
          hunter.teleportTo(s.pos[0], s.pos[1], Math.atan2(player.pos.x - s.pos[0], player.pos.z - s.pos[1]));
          hunter.wake();
          hunter.calmDown();
        }
        this.host.sfx.moonScream(player.pos);
        this.host.sfx.stinger();
        player.setShake(1.2);
        break;
      }
      case 'lullaby': {
        const room = this.active ? this.host.world.rooms.get(this.active.room) : null;
        const c = room ? room.center : player.pos;
        this.host.sfx.lullaby(c);
        player.setShake(0.25);
        break;
      }
    }
    if (s.msg) this.host.notify(s.msg);
  }

  reset(chapter: number) {
    this.chapter = chapter;
    this.active = null;
    this.attempts = 0;
    this.tasksDone = [];
    this.armed = false;
    this.lightsOutT = 0;
    this.fakeStepsT = 0;
    this.fakeStepsCount = 0;
    this.host.clearTrialInteractables();
    this.syncHud();
  }
}
