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

/** v9 — ronda del puzzle auditivo */
interface SoundDoorDef {
  door: string;
  sound: 'fan' | 'kitchen' | 'steps' | 'laugh' | 'none';
  label: string;
}
interface SoundsRound {
  hint: string;
  doors: SoundDoorDef[];
  safe: string;
}
type LoopHandle = { stop: (fade?: number) => void };

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
  /** v14 — ¿la tableta está abierta y mirando la cámara de la CAJA MUSICAL? */
  tabletMusicBox(): boolean;
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
    /** v9 — puzzle auditivo */
    playLoopSfx(name: 'fan_ambience' | 'kitchen_clatter', pos: { x: number; y: number; z: number }, vol?: number): LoopHandle | null;
    freddyLaugh(pos: THREE.Vector3): void;
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
  /* v9 — puzzle auditivo */
  private soundLoops: LoopHandle[] = [];
  private soundTimers: Array<{ door: string; kind: 'steps' | 'laugh'; t: number; pos: [number, number] }> = [];
  private soundsRound = 0;

  constructor(host: TrialHost) {
    this.host = host;
  }

  trialForChapter(n: number): TrialDef | null {
    return ALL_TRIALS.find((t) => t.chapter === n) ?? null;
  }

  /** v14 — una misma misión puede tener VARIAS pruebas: se activa la de la sala actual */
  trialForRoom(n: number, roomId: string): TrialDef | null {
    return ALL_TRIALS.find((t) => {
      if (t.chapter !== n || t.room !== roomId) return false;
      return !this.host.objectiveDone(t.objective ?? `c${t.chapter}_trial`);
    }) ?? null;
  }

  get hunter(): Animatronic | null {
    if (!this.active) return null;
    return this.host.animatronics.find((a) => a.def.id === this.active!.hunter) ?? null;
  }

  /** ¿el objetivo de la prueba (activa o de la sala) ya está completado? */
  objectiveComplete(): boolean {
    const t = this.active;
    if (!t) return false;
    return this.host.objectiveDone(t.objective ?? `c${t.chapter}_trial`);
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
      // v14 — MULTI-PRUEBA: se arma la prueba de la sala actual de la misión
      const t = this.trialForRoom(this.chapter, roomId);
      if (t) {
        // gate de objetivos previos (p. ej. tokens antes de la bolera)
        const reqs = (t as TrialDef & { requiresObjectives?: string[] }).requiresObjectives;
        const gated = reqs?.some((r) => !this.host.objectiveDone(r)) ?? false;
        if (!gated) this.begin(t);
      }
      return;
    }
    // v14 — prueba de LA OFICINA (FNAF4): asaltos por las puertas + caja musical
    if ((this.active as TrialDef & { type?: string }).type === 'office') {
      this.updateOffice(dt);
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
    // v9 — relojes del puzzle auditivo (pasos y risas tras las puertas)
    if (this.soundTimers.length) {
      for (const st of this.soundTimers) {
        st.t -= dt;
        if (st.t <= 0) {
          const [x, z] = st.pos;
          if (st.kind === 'steps') {
            this.host.sfx.footstep(new THREE.Vector3(x, 0, z - 1.2), 'metal', false, true);
            st.t = 0.72 + Math.random() * 0.3;
          } else {
            this.host.sfx.freddyLaugh(new THREE.Vector3(x, 1.4, z));
            st.t = 3.2 + Math.random() * 1.6;
          }
        }
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
    // v9 — puzzle auditivo: primera ronda
    if ((t as TrialDef & { type?: string }).type === 'sounds') {
      this.beginSounds(t);
    }
    // v14 — noche de la OFICINA: arranque del asedio FNAF4
    if ((t as TrialDef & { type?: string }).type === 'office') {
      this.beginOffice(t);
      this.fireScares('start');
      this.syncHud();
      return;
    }
    this.fireScares('start');
    this.syncHud();
  }

  /* ============ v14 — LA NOCHE DE LA OFICINA (FNAF4 adaptado) ============ */

  private officeSurviveLeft = 0;
  private musicBox = 100;
  private puppetOut = false;
  private officeAssaultT = 10;   // cuenta atrás para el próximo asalto
  private assault: { door: string; fake: boolean; t: number; step: number; arrived: boolean } | null = null;
  private officeLullabyT = 0;

  private beginOffice(t: TrialDef) {
    const mins = (t as TrialDef & { surviveMinutes?: number }).surviveMinutes ?? 1.6;
    this.officeSurviveLeft = mins * 60;
    this.musicBox = 100;
    this.puppetOut = false;
    this.officeAssaultT = 11;
    this.assault = null;
    // las puertas de la oficina empiezan CERRADAS (que el jugador decida cuándo mirar)
    for (const id of ['door_office', 'door_techS']) {
      const d = this.host.world.doors.get(id);
      if (d) {
        d.open = false;
        d.targetAngle = d.baseAngle;
      }
    }
    // el cazador duerme lejos de la oficina
    const hunter = this.hunter;
    if (hunter) {
      hunter.retire();
      const resetRoom = this.host.world.rooms.get(t.hunterResetRoom);
      if (resetRoom) hunter.teleportTo(resetRoom.center.x, resetRoom.center.z);
    }
    this.host.setTrialHud({
      name: t.name, attempts: 0, tasksDone: 0,
      tasksTotal: Math.ceil(this.officeSurviveLeft), nextTask: 'WIND THE MUSIC BOX — WATCH BOTH DOORS',
    });
  }

  private officeDoorPos(id: string): THREE.Vector3 {
    const d = this.host.world.doors.get(id);
    return d ? new THREE.Vector3(d.def.x, 1.1, d.def.z) : this.host.player.pos.clone();
  }

  private updateOffice(dt: number) {
    const t = this.active;
    if (!t) return;
    this.officeSurviveLeft -= dt;

    /* ---- CAJA MUSICAL del Puppet: se descarga sola; mirar la CAM de la caja la rebobina ---- */
    const watching = this.host.tabletMusicBox();
    this.musicBox = Math.max(0, Math.min(100, this.musicBox + (watching ? 9 : -1.55) * dt));
    this.officeLullabyT -= dt;
    if (this.musicBox < 32 && this.officeLullabyT <= 0) {
      this.host.sfx.lullaby(this.officeDoorPos('door_office'));
      this.officeLullabyT = 5.5;
      if (this.musicBox < 14 && Math.random() < 0.5) {
        this.host.notify('THE MUSIC BOX IS DYING — WIND IT FROM THE CAMS (CAM 17)!');
      }
    }
    if (this.musicBox <= 0 && !this.puppetOut) {
      this.puppetOut = true;
      const hunter = this.hunter;
      if (hunter) {
        const d = this.officeDoorPos('door_office');
        hunter.teleportTo(d.x, d.z, Math.atan2(this.host.player.pos.x - d.x, this.host.player.pos.z - d.z));
        hunter.wake();
        hunter.forceChase(this.host.player.pos);
      }
      this.host.sfx.stinger();
      this.host.sfx.moonScream(this.host.player.pos);
      this.host.notify("PUPPET'S BOX OPENED — IT'S COMING. WIND THE BOX TO SEND IT BACK!");
      this.host.player.setShake(1.0);
    }
    if (this.puppetOut && this.musicBox > 62) {
      this.puppetOut = false;
      const hunter = this.hunter;
      if (hunter) {
        hunter.calmDown();
        hunter.retire();
        const resetRoom = this.host.world.rooms.get(t.hunterResetRoom);
        if (resetRoom) hunter.teleportTo(resetRoom.center.x, resetRoom.center.z);
      }
      this.host.notify('THE BOX SINGS AGAIN — PUPPET WITHDRAWS INTO THE DARK');
    }

    /* ---- ASALTOS POR LAS PUERTAS: reales (4 pasos que se acercan) vs falsos (golpes sueltos) ---- */
    if (!this.assault) {
      this.officeAssaultT -= dt;
      if (this.officeAssaultT <= 0) {
        const doorId = Math.random() < 0.5 ? 'door_office' : 'door_techS';
        const fake = Math.random() < 0.35 && !this.puppetOut;
        this.assault = { door: doorId, fake, t: 0, step: 0, arrived: false };
        this.officeAssaultT = 13 + Math.random() * 8;
        const dp = this.officeDoorPos(doorId);
        this.host.sfx.ventBang(dp);
        if (fake) {
          this.host.notify('A SINGLE KNOCK... NOTHING FOLLOWS. (Real steps come in fours — and they STOP)');
        } else {
          this.host.notify('HEAVY STEPS APPROACH A DOOR — CHECK BOTH SIDES, SEAL THE RIGHT ONE!');
        }
      }
    } else {
      const a = this.assault;
      a.t += dt;
      if (!a.fake) {
        // pasos pesados que SE ACERCAN a la puerta (4, espaciados)
        const stepGap = 1.15;
        if (a.step < 4 && a.t > a.step * stepGap) {
          const dp = this.officeDoorPos(a.door);
          const srcRoom = a.door === 'door_office' ? this.host.world.rooms.get('promW') : this.host.world.rooms.get('techS');
          const sx = srcRoom ? srcRoom.center.x : dp.x;
          const sz = srcRoom ? srcRoom.center.z : dp.z;
          const k = (a.step + 1) / 4;
          this.host.sfx.footstep(
            new THREE.Vector3(sx + (dp.x - sx) * k, 0, sz + (dp.z - sz) * k),
            'metal', false, true
          );
          a.step++;
        }
        // llegada a la puerta (~5 s): ¿está cerrada?
        if (!a.arrived && a.t > 5.2) {
          a.arrived = true;
          const door = this.host.world.doors.get(a.door);
          const dp = this.officeDoorPos(a.door);
          const closed = door && !door.open;
          if (closed) {
            this.host.sfx.ventBang(dp);
            this.host.player.setShake(0.5);
            this.host.notify('IT SLAMS AGAINST THE DOOR — THE LOCK HOLDS. IT WALKS AWAY...');
          } else {
            // puerta abierta: entra y caza
            const hunter = this.hunter;
            if (hunter) {
              hunter.wake();
              hunter.teleportTo(dp.x, dp.z, Math.atan2(this.host.player.pos.x - dp.x, this.host.player.pos.z - dp.z));
              hunter.forceChase(this.host.player.pos);
            }
            this.host.sfx.stinger();
            this.host.notify('THE DOOR WAS OPEN — IT IS INSIDE!!');
            this.host.player.setShake(1.0);
          }
        }
        if (a.t > 8.5) this.assault = null;
      } else if (a.t > 2.4) {
        this.assault = null;
      }
    }

    /* ---- ¿ha sobrevivido la noche? ---- */
    this.host.setTrialHud({
      name: t.name, attempts: this.attempts,
      tasksDone: 0, tasksTotal: Math.max(1, Math.ceil(this.officeSurviveLeft)),
      nextTask: this.puppetOut ? 'WIND THE MUSIC BOX!! (CAM 17)' : `SURVIVE — ${Math.ceil(this.officeSurviveLeft)}s — BOX ${Math.round(this.musicBox)}%`,
    });
    if (this.officeSurviveLeft <= 0 && !this.puppetOut) {
      this.succeed();
    }
  }

  /* ============ v9 — EL PASILLO DE LOS SONIDOS ============ */

  private soundsRounds(): SoundsRound[] {
    if (!this.active) return [];
    return (this.active as TrialDef & { rounds?: SoundsRound[] }).rounds ?? [];
  }

  private beginSounds(t: TrialDef) {
    this.soundsRound = 0;
    this.setupSoundsRound();
  }

  /** monta los sonidos y las tarjetas de puerta de la ronda actual */
  private setupSoundsRound() {
    this.stopSoundLoops(0.6);
    const t = this.active;
    if (!t) return;
    const rounds = this.soundsRounds();
    const round = rounds[this.soundsRound];
    if (!round) return;
    this.host.notify(round.hint);
    this.host.setTrialHud({
      name: t.name,
      attempts: this.attempts,
      tasksDone: this.soundsRound,
      tasksTotal: rounds.length,
      nextTask: round.hint,
    });
    // puertas de la ronda: sonido posicional + tarjeta de interacción
    for (const d of round.doors) {
      const door = this.host.world.doors.get(d.door);
      if (!door) continue;
      const { x, z } = door.def;
      if (d.sound === 'fan') {
        const l = this.host.sfx.playLoopSfx('fan_ambience', { x, y: 1.3, z: z - 1.6 }, 0.5);
        if (l) this.soundLoops.push(l);
      } else if (d.sound === 'kitchen') {
        const l = this.host.sfx.playLoopSfx('kitchen_clatter', { x, y: 1.3, z: z - 1.6 }, 0.85);
        if (l) this.soundLoops.push(l);
      } else if (d.sound === 'steps') {
        this.soundTimers.push({ door: d.door, kind: 'steps', t: 0.4 + Math.random() * 0.6, pos: [x, z] });
      } else if (d.sound === 'laugh') {
        this.soundTimers.push({ door: d.door, kind: 'laugh', t: 1 + Math.random() * 1.6, pos: [x, z] });
      }
      this.host.registerInteractable({
        id: `sounds_${d.door}`,
        label: `LISTEN AND OPEN — ${d.label}`,
        pos: { x, y: 1.1, z },
        radius: 2.0,
        enabled: () => this.active === t,
        action: () => this.chooseSoundDoor(d.door),
      });
    }
  }

  private stopSoundLoops(fade = 0.6) {
    for (const l of this.soundLoops) l.stop(fade);
    this.soundLoops = [];
    this.soundTimers = [];
  }

  /** el jugador abre una puerta de la ronda */
  private chooseSoundDoor(doorId: string) {
    const t = this.active;
    if (!t) return;
    const rounds = this.soundsRounds();
    const round = rounds[this.soundsRound];
    if (!round) return;
    const door = this.host.world.doors.get(doorId);
    if (doorId === round.safe) {
      // puerta correcta: se abre, sonido de éxito, siguiente ronda
      this.host.unlockDoor(doorId);
      this.host.sfx.switchClick();
      this.host.notify("CORRECT DOOR — follow Rulo's voice...");
      this.soundsRound++;
      this.host.clearTrialInteractables();
      if (this.soundsRound >= rounds.length) {
        this.stopSoundLoops(1.2);
        this.succeed();
      } else {
        this.setupSoundsRound();
      }
    } else {
      // puerta EQUIVOCADA: la puerta revienta y Freddy sale a por ti
      this.host.sfx.freddyLaugh(door ? new THREE.Vector3(door.def.x, 1.4, door.def.z) : this.host.player.pos.clone());
      this.host.player.setShake(1.0);
      const hunter = this.hunter;
      if (hunter && door) {
        hunter.teleportTo(door.def.x, door.def.z - 1.2, Math.atan2(this.host.player.pos.x - door.def.x, this.host.player.pos.z - door.def.z + 1.2));
        hunter.scriptWake();
        this.host.notify('YOU OPENED THE WRONG DOOR!');
      }
    }
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
      this.host.notify(`TASK ${idx}/${this.active.tasks.length} — ${this.nextTask()?.label ?? ''}`);
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
    // v9 — cortar cualquier bucle del puzzle auditivo
    this.stopSoundLoops(1.2);
    this.soundsRound = 0;
    this.host.sfx.powerUp();
    const hunter = this.hunter;
    if (sunny && hunter) {
      // SOL Y LUNA: la luz lo cambia — se vuelve amable y se retira para siempre
      hunter.setDayNight('sun');
      hunter.retire();
      if (t.room === 'megadaycare') {
        hunter.teleportTo(0, -46, 0.4); // junto al viejo escenario, sonriendo
      } else {
        hunter.teleportTo(-20.5, 3.0, 0); // junto al borde norte, sonriendo
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
    this.host.completeObjective(t.objective ?? `c${t.chapter}_trial`);
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
    // v14 — noche de la oficina: la caja vuelve a estar cuerda y el asedio se reinicia
    if ((t as TrialDef & { type?: string }).type === 'office') {
      this.musicBox = 100;
      this.puppetOut = false;
      this.assault = null;
      this.officeAssaultT = 12;
      const mins = (t as TrialDef & { surviveMinutes?: number }).surviveMinutes ?? 1.6;
      this.officeSurviveLeft = mins * 60;
      for (const id of ['door_office', 'door_techS']) {
        const d = this.host.world.doors.get(id);
        if (d) { d.open = false; d.targetAngle = d.baseAngle; }
      }
    }
    // v9 — puzzle auditivo: la ronda actual se vuelve a montar
    if ((t as TrialDef & { type?: string }).type === 'sounds') {
      this.host.clearTrialInteractables();
      this.setupSoundsRound();
    }
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
    this.resetGeneratorLights(t);
    // v9 — el puzzle auditivo ya montó sus tarjetas arriba
    if ((t as TrialDef & { type?: string }).type !== 'sounds') {
      this.registerTasks();
    }
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
    // v9 — cortar los bucles del puzzle auditivo al cambiar de capítulo
    this.stopSoundLoops(0.8);
    this.soundsRound = 0;
    this.host.clearTrialInteractables();
    this.syncHud();
  }
}
