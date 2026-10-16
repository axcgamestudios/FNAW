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

  /** ¿el objetivo de prueba del capítulo ya está completado? */
  objectiveComplete(): boolean {
    if (!this.active) return false;
    return this.host.objectiveDone(`c${this.active.chapter}_trial`);
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
        this.begin(t);
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
    // luces de la sala de la prueba encendidas (para empezar)
    this.host.world.setRoomLight(t.room, true);
    this.fireScares('start');
    this.syncHud();
  }

  private registerTasks() {
    if (!this.active) return;
    this.host.clearTrialInteractables();
    const t = this.active;
    t.tasks.forEach((task, i) => {
      this.host.registerInteractable({
        id: `trial_${t.id}_${task.id}`,
        label: `${task.label}${i > 0 && !this.tasksDone.includes(t.tasks[i - 1].id) ? '' : ''}`,
        pos: { x: task.at[0], y: 1.2, z: task.at[1] },
        radius: 1.6,
        holdTime: task.hold,
        holdLabel: 'TRABAJANDO',
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
    this.host.sfx.switchClick();
    const idx = this.tasksDone.length;
    if (this.active.tasks.length > 1) {
      this.host.notify(`TAREA ${idx}/${this.active.tasks.length} — ${this.nextTask()?.label ?? ''}`);
    }
    // disparar susto por número de tarea
    const key = `task${Math.min(idx, 4)}` as 'task1' | 'task2' | 'task3' | 'task4';
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
    this.host.sfx.powerUp();
    // el cazador se retira
    const hunter = this.hunter;
    if (hunter) {
      const resetRoom = this.host.world.rooms.get(t.hunterResetRoom);
      if (resetRoom) hunter.teleportTo(resetRoom.center.x, resetRoom.center.z);
      hunter.calmDown();
    }
    this.host.world.setRoomLight(t.room, true);
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
    // el cazador se recoloca lejos
    const hunter = this.hunter;
    if (hunter) {
      const resetRoom = this.host.world.rooms.get(t.hunterResetRoom);
      if (resetRoom) hunter.teleportTo(resetRoom.center.x, resetRoom.center.z);
      hunter.calmDown();
    }
    this.registerTasks();
    this.syncHud();
    return { trial: t, attempts: this.attempts };
  }

  /** reaparcer al jugador en el punto de control tras el jumpscare */
  respawnPlayer() {
    if (!this.active) return;
    const t = this.active;
    this.host.player.pos.set(t.respawnPos[0], 0, t.respawnPos[1]);
    this.host.player.vel.set(0, 0, 0);
    this.host.player.yaw = t.respawnYaw;
    this.host.player.pitch = 0;
    this.host.player.stamina = 100;
    this.host.player.staminaLock = false;
    this.host.player.hidden = false;
    this.host.player.hiddenSpotId = null;
    this.host.world.setAllLights(false, [t.room]);
    this.host.world.setRoomLight(t.room, true);
    this.host.sfx.respawn();
    this.syncHud();
  }

  /* ============ SUSTOS ============ */

  private fireScares(at: 'start' | 'task1' | 'task2' | 'task3' | 'task4' | 'end') {
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
