/**
 * Animatrónico: modelo + máquina de estados + detección + navegación.
 * Estados: dormant, patrol, investigate, chase, search, checkMask,
 * stunned, attack, retreat, crawl(vent), hunt (marioneta).
 */
import * as THREE from 'three';
import type { AnimatronicDef, NoiseEvent } from '../core/types';
import { buildAnimatronic, type CharacterRig } from '../characters/models';
import type { NavGraph } from './navgraph';
import { GRID_W, GRID_H } from './navgraph';
import type { WorldBuilder } from '../world/worldbuilder';

export type AIState =
  | 'dormant' | 'patrol' | 'investigate' | 'chase' | 'search'
  | 'checkMask' | 'stunned' | 'attack' | 'retreat' | 'hunt';

export interface PlayerLike {
  pos: THREE.Vector3;
  crouching: boolean;
  running: boolean;
  flashlightOn: boolean;
  masked: boolean;
  hidden: boolean;
  hiddenSpotId: string | null;
  /** dirección de la vista */
  lookDir: THREE.Vector3;
  roomLightLevel(): number;
  emitNoise(): void;
}

export interface AIHost {
  time: number;
  hour: number;
  night: number;
  aggression: number;
  nav: NavGraph;
  world: WorldBuilder;
  noises: NoiseEvent[];
  musicBoxLevel: number;
  onDeath(ai: Animatronic): void;
  sfx: {
    footstep(pos: THREE.Vector3, kind: string, running: boolean, heavy: boolean): void;
    servo(pos: THREE.Vector3, voice: string): void;
    roar(pos: THREE.Vector3, voice: string): void;
    doorCreak(pos: THREE.Vector3): void;
    ventBang(pos: THREE.Vector3): void;
    stinger(): void;
    vocal(pos: THREE.Vector3, voice: string): void;
  };
}

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();

export class Animatronic {
  def: AnimatronicDef;
  rig: CharacterRig;
  host: AIHost;
  state: AIState = 'dormant';
  active = false;
  pos = new THREE.Vector3();
  yaw = 0;
  path: THREE.Vector3[] = [];
  pathIdx = 0;
  patrolTarget: THREE.Vector3 | null = null;
  investigatePoint: THREE.Vector3 | null = null;
  lastKnown: THREE.Vector3 | null = null;
  lastSeenAt = -99;
  stateTimer = 0;
  thinkTimer = 0;
  vocalTimer = 8;
  footTimer = 0;
  walkPhase = 0;
  currentSpeed = 0;
  lungeDir = new THREE.Vector3();
  litTime = 0;
  fooledTime = 0;
  maskLocked = false;
  twitchTimer = 0;
  twitch = 0;
  crawling = false;
  stuckTimer = 0;
  stagePose = false;

  constructor(def: AnimatronicDef, host: AIHost) {
    this.def = def;
    this.host = host;
    this.rig = buildAnimatronic(def.kind, def.eyeColor);
    const room = host.world.rooms.get(def.startRoom);
    const [ox, oz] = def.startOffset ?? [0, 0];
    const cx = room ? room.center.x : 0;
    const cz = room ? room.center.z : 0;
    this.pos.set(cx + ox, 0, cz + oz);
    this.rig.root.position.copy(this.pos);
    this.rig.root.rotation.y = 0; // el frente del modelo es +Z: miran al sur (al público)
    host.world.scene.add(this.rig.root);
  }

  get eyeColor(): number {
    return this.def.eyeColor;
  }

  reset() {
    this.state = 'dormant';
    this.active = false;
    const room = this.host.world.rooms.get(this.def.startRoom);
    const [ox, oz] = this.def.startOffset ?? [0, 0];
    this.pos.set((room ? room.center.x : 0) + ox, 0, (room ? room.center.z : 0) + oz);
    this.rig.root.position.copy(this.pos);
    this.rig.root.rotation.set(0, 0, 0);
    this.rig.root.visible = true;
    this.path = [];
    this.yaw = 0;
    this.stateTimer = 0;
    this.thinkTimer = 0;
    this.crawling = false;
    this.litTime = 0;
    this.fooledTime = 0;
    this.maskLocked = false;
    this.currentSpeed = 0;
  }

  wake() {
    if (this.active) return;
    this.active = true;
    this.state = 'patrol';
    this.stateTimer = 0;
    this.host.sfx.vocal(this.pos, this.def.voice);
  }

  /* ================== ACTUALIZACIÓN PRINCIPAL ================== */

  update(dt: number, player: PlayerLike) {
    this.stateTimer += dt;
    this.thinkTimer -= dt;
    this.vocalTimer -= dt;

    // marioneta: despierta y caza si la caja musical está vacía (independiente de wakeHour)
    if (this.def.persistent && this.host.musicBoxLevel <= 0.02) {
      this.active = true;
      if (this.state !== 'hunt' && this.state !== 'attack') {
        this.state = 'hunt';
        this.stateTimer = 0;
        this.host.sfx.stinger();
        this.host.sfx.roar(this.pos, 'chime');
      }
    } else if (this.def.persistent && this.host.musicBoxLevel > 0.5 && this.state === 'hunt') {
      this.state = 'patrol';
      this.stateTimer = 0;
    }

    if (!this.active) {
      if (this.host.hour >= this.wakeHourForNight()) {
        this.wake();
      } else {
        this.animateIdle(dt, player);
        return;
      }
    }

    // vocalizaciones aleatorias
    if (this.vocalTimer <= 0) {
      this.vocalTimer = 14 + Math.random() * 22;
      if (this.pos.distanceTo(player.pos) < 18) {
        this.host.sfx.vocal(this.pos, this.def.voice);
      }
    }

    // detección
    if (this.thinkTimer <= 0) {
      this.thinkTimer = 0.12 + Math.random() * 0.08;
      this.think(player);
    }

    // linterna
    this.flashlightCheck(dt, player);

    // máquina de estados
    switch (this.state) {
      case 'patrol': this.updatePatrol(dt, player); break;
      case 'investigate': this.updateInvestigate(dt, player); break;
      case 'chase': this.updateChase(dt, player); break;
      case 'hunt': this.updateHunt(dt, player); break;
      case 'search': this.updateSearch(dt, player); break;
      case 'checkMask': this.updateCheckMask(dt, player); break;
      case 'stunned': this.updateStunned(dt); break;
      case 'attack': this.updateAttack(dt, player); break;
      case 'retreat': this.updateRetreat(dt, player); break;
      default: this.animateIdle(dt, player); break;
    }

    // física mínima: y del suelo
    const fy = this.host.world.floorHeightAt(this.pos.x, this.pos.z);
    this.pos.y += (fy - this.pos.y) * Math.min(1, dt * 10);
    this.rig.root.position.copy(this.pos);
    if (!this.crawling) this.rig.root.rotation.set(0, this.yaw, 0);
    else this.rig.root.rotation.set(0.95, this.yaw, 0);

    // animación procedural
    this.animate(dt, player);
  }

  private wakeHourForNight(): number {
    const n = Math.min(Math.max(this.host.night, 1), 5);
    return this.def.wakeHour[n - 1] ?? 0;
  }

  /* ================== DETECCIÓN ================== */

  private think(player: PlayerLike) {
    const d = this.pos.distanceTo(player.pos);
    // ruido
    if (this.state === 'patrol' || this.state === 'search' || this.state === 'retreat' || this.state === 'investigate') {
      for (const n of this.host.noises) {
        const age = this.host.time - n.worldTime;
        if (age > 0 && age < 1.2) {
          const dn = Math.hypot(this.pos.x - n.x, this.pos.z - n.z);
          const radius = n.radius * this.def.hearing * (0.8 + this.host.aggression * 0.3);
          if (dn < radius) {
            this.investigatePoint = new THREE.Vector3(n.x, 0, n.z);
            if (this.state !== 'investigate') {
              this.state = 'investigate';
              this.stateTimer = 0;
              this.host.sfx.vocal(this.pos, this.def.voice);
            }
            return;
          }
        }
      }
    }

    // visión
    if (this.canSee(player)) {
      this.lastKnown = player.pos.clone();
      this.lastSeenAt = this.host.time;
      if (this.state === 'hunt' || this.state === 'chase' || this.state === 'attack' || this.state === 'checkMask') {
        // ya está sobre el jugador
      } else {
        const dist = this.pos.distanceTo(player.pos);
        // máscara puesta antes de contacto → posible engaño
        if (player.masked && this.def.maskFoolable && dist < 4.2 && dist > 1.2 && !this.maskLocked) {
          this.state = 'checkMask';
          this.stateTimer = 0;
          this.fooledTime = 0;
          this.host.sfx.servo(this.pos, this.def.voice);
          return;
        }
        if (player.masked && !this.def.maskFoolable) {
          // no se deja engañar: ataque directo
          this.host.sfx.roar(this.pos, this.def.voice);
        }
        this.startChase();
      }
    } else if (this.state === 'chase' && this.host.time - this.lastSeenAt > 2.6) {
      this.state = 'search';
      this.stateTimer = 0;
    } else if (this.state === 'hunt' && this.host.musicBoxLevel > 0.02) {
      // la marioneta pierde el rastro si la caja suena
      this.state = 'search';
      this.stateTimer = 0;
    }
  }

  canSee(player: PlayerLike): boolean {
    if (player.hidden) {
      // solo si está muy cerca y ya lo vio entrar
      return false;
    }
    const d = this.pos.distanceTo(player.pos);
    let maxDist = this.def.visionDist * (0.75 + this.host.aggression * 0.35);
    // oscuridad: reduce visión
    const light = player.roomLightLevel();
    if (!player.flashlightOn && light < 0.25) maxDist *= 0.45;
    if (player.crouching) maxDist *= 0.8;
    if (player.flashlightOn) maxDist *= 1.25; // la linterna delata
    if (d > maxDist) return false;
    // cono de visión (la marioneta ve a 360)
    if (this.def.visionFov < 360) {
      _v1.subVectors(player.pos, this.pos);
      _v1.y = 0;
      _v1.normalize();
      const facing = _v2.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
      const dot = _v1.dot(facing);
      const cosHalf = Math.cos((this.def.visionFov * Math.PI) / 360);
      if (dot < cosHalf && d > 2.2) return false;
    }
    // línea de visión por rejilla
    return this.host.nav.los(this.pos, player.pos, this.def.ventAccess);
  }

  /* ================== LINTERNA ================== */

  private flashlightCheck(dt: number, player: PlayerLike) {
    if (!player.flashlightOn) {
      this.litTime = Math.max(0, this.litTime - dt);
      return;
    }
    if (this.def.flashlight === 'none' || this.state === 'attack' || this.state === 'hunt') return;
    const d = this.pos.distanceTo(player.pos);
    if (d > 13) return;
    // ¿el jugador lo está iluminando?
    _v1.subVectors(this.pos, player.pos).normalize();
    if (_v1.dot(player.lookDir) < 0.965) return;
    if (!this.host.nav.los(player.pos, this.pos, this.def.ventAccess)) return;
    this.litTime += dt;
    if (this.def.flashlight === 'freeze' && this.litTime > 0.1) {
      // congelada mientras se ilumina
      if (this.state !== 'stunned' && this.state !== 'checkMask') {
        this.state = 'stunned';
        this.stateTimer = 0;
        this.host.sfx.servo(this.pos, this.def.voice);
      }
    }
    if (this.litTime > 2.4) {
      this.litTime = 0;
      this.retreat();
      this.host.sfx.vocal(this.pos, this.def.voice);
    }
  }

  /* ================== ESTADOS ================== */

  private startChase() {
    if (this.state !== 'chase' && this.state !== 'attack' && this.state !== 'checkMask') {
      this.host.sfx.stinger();
      this.host.sfx.roar(this.pos, this.def.voice);
    }
    this.state = 'chase';
    this.stateTimer = 0;
    this.repathToPlayer();
  }

  private updatePatrol(dt: number, player: PlayerLike) {
    // elegir destino de patrulla
    if (!this.patrolTarget || this.arrived(1.2) || this.stateTimer > 40) {
      const rooms = this.def.patrolRooms;
      const room = rooms[(Math.random() * rooms.length) | 0];
      const r = this.host.world.rooms.get(room);
      if (r) {
        const [x1, z1, x2, z2] = r.def.rect;
        // con agresividad: a veces elige la sala del jugador (interceptación)
        let tx = x1 + 1 + Math.random() * (x2 - x1 - 2);
        let tz = z1 + 1 + Math.random() * (z2 - z1 - 2);
        if (Math.random() < 0.28 * this.host.aggression) {
          const pr = this.host.world.roomAt(player.pos.x, player.pos.z);
          if (pr && (rooms.includes(pr.def.id) || Math.random() < 0.3)) {
            tx = player.pos.x + (Math.random() - 0.5) * 3;
            tz = player.pos.z + (Math.random() - 0.5) * 3;
          }
        }
        this.patrolTarget = new THREE.Vector3(tx, 0, tz);
        this.setPath(this.patrolTarget);
        this.stateTimer = 0;
      }
    }
    this.followPath(dt, this.def.speedWalk * (0.85 + this.host.aggression * 0.25), player);
  }

  private updateInvestigate(dt: number, player: PlayerLike) {
    if (this.investigatePoint) {
      if (!this.path.length || this.arrived(1.4) || this.thinkTimer > 0.5) {
        if (this.pos.distanceTo(this.investigatePoint) > 1.6 && this.stateTimer < 20) {
          this.setPath(this.investigatePoint);
        } else {
          // mirar alrededor
          this.yaw += Math.sin(this.stateTimer * 2.2) * dt * 2.5;
          if (this.stateTimer > 6) {
            this.investigatePoint = null;
            this.state = 'patrol';
            this.stateTimer = 0;
            this.patrolTarget = null;
          }
        }
      }
    } else {
      this.state = 'patrol';
    }
    if (this.path.length) {
      this.followPath(dt, this.def.speedWalk * 1.15, player);
    } else {
      this.animateIdle(dt, player);
    }
  }

  private repathToPlayer() {
    if (this.lastKnown) this.setPath(this.lastKnown.clone());
  }

  private updateChase(dt: number, player: PlayerLike) {
    const repath = this.stateTimer > 1.6 || !this.path.length;
    if (repath) {
      this.stateTimer = 0.01;
      if (this.canSee(player) || this.def.persistent) {
        this.lastKnown = player.pos.clone();
        this.lastSeenAt = this.host.time;
      }
      this.repathToPlayer();
    }
    const speed = this.def.speedRun * (0.9 + this.host.aggression * 0.18);
    this.followPath(dt, speed, player);
    const d = this.pos.distanceTo(player.pos);
    // intento de engaño con máscara a corta distancia
    if (d < 2.8 && d > 1.1 && player.masked && this.def.maskFoolable && !this.maskLocked) {
      if (Math.random() < 0.55) {
        this.state = 'checkMask';
        this.stateTimer = 0;
        this.fooledTime = 0;
        this.host.sfx.servo(this.pos, this.def.voice);
        return;
      }
      this.maskLocked = true;
    }
    if (d <= this.def.attackRange && !player.hidden) {
      this.beginAttack(player);
    }
    if (this.stateTimer > 26) {
      this.state = 'search';
      this.stateTimer = 0;
    }
  }

  private updateHunt(dt: number, player: PlayerLike) {
    // la marioneta nunca pierde el rastro mientras la caja esté parada
    this.lastKnown = player.pos.clone();
    if (this.stateTimer > 1.2 || !this.path.length) {
      this.stateTimer = 0.01;
      this.setPath(this.lastKnown);
    }
    const speed = this.def.speedRun * (0.85 + this.host.aggression * 0.2);
    this.followPath(dt, speed, player);
    const d = this.pos.distanceTo(player.pos);
    if (d <= this.def.attackRange && !player.hidden) {
      this.beginAttack(player);
    }
  }

  private updateSearch(dt: number, player: PlayerLike) {
    if (!this.lastKnown) {
      this.state = 'patrol';
      return;
    }
    if (!this.path.length || this.arrived(1.5)) {
      // buscar en las inmediaciones
      const angle = Math.random() * Math.PI * 2;
      const r = 2 + Math.random() * 5;
      const target = new THREE.Vector3(
        this.lastKnown.x + Math.cos(angle) * r,
        0,
        this.lastKnown.z + Math.sin(angle) * r
      );
      this.setPath(target);
      if (this.stateTimer > 14) {
        this.state = 'patrol';
        this.stateTimer = 0;
        this.patrolTarget = null;
      }
    }
    this.followPath(dt, this.def.speedWalk * 1.3, player);
  }

  private updateCheckMask(dt: number, player: PlayerLike) {
    this.currentSpeed = 0;
    // mirar al jugador de cerca
    _v1.subVectors(player.pos, this.pos);
    this.yaw = Math.atan2(_v1.x, _v1.z);
    this.fooledTime += dt;
    if (!player.masked || player.running) {
      // se la quitó delante de él → ataque
      this.maskLocked = true;
      this.startChase();
      return;
    }
    if (this.fooledTime > this.def.maskFoolTime) {
      // pierde el interés
      this.retreat();
    }
  }

  private updateStunned(dt: number) {
    this.currentSpeed = 0;
    if (this.stateTimer > 3.6) {
      this.retreat();
    }
  }

  private beginAttack(player: PlayerLike) {
    this.state = 'attack';
    this.stateTimer = 0;
    this.currentSpeed = 0;
    this.host.sfx.roar(this.pos, this.def.voice);
    _v1.subVectors(player.pos, this.pos);
    _v1.y = 0;
    _v1.normalize();
    this.lungeDir.copy(_v1);
  }

  private updateAttack(dt: number, player: PlayerLike) {
    // impulso del ataque
    const windup = this.def.attackWindup;
    if (this.stateTimer < windup) {
      _v1.subVectors(player.pos, this.pos);
      this.yaw = Math.atan2(_v1.x, _v1.z);
      // el jugador puede escapar durante la preparación
      const d = this.pos.distanceTo(player.pos);
      if (d > this.def.attackRange + 1.1) {
        this.startChase();
        return;
      }
      return;
    }
    // embestida
    const speed = 9;
    this.pos.addScaledVector(this.lungeDir, speed * dt);
    this.rig.root.position.copy(this.pos);
    const d = this.pos.distanceTo(player.pos);
    if (d < 0.85 || this.stateTimer > windup + 0.42) {
      this.host.onDeath(this);
    }
  }

  private retreat() {
    this.state = 'retreat';
    this.stateTimer = 0;
    const rooms = this.def.patrolRooms;
    const room = rooms[(Math.random() * rooms.length) | 0];
    const r = this.host.world.rooms.get(room);
    if (r) {
      this.patrolTarget = new THREE.Vector3(r.center.x, 0, r.center.z);
      this.setPath(this.patrolTarget);
    }
  }

  private updateRetreat(dt: number, player: PlayerLike) {
    if (!this.path.length || this.arrived(1.5) || this.stateTimer > 22) {
      this.state = 'patrol';
      this.stateTimer = 0;
      this.patrolTarget = null;
    } else {
      this.followPath(dt, this.def.speedRun * 0.85, player);
    }
  }

  /* ================== MOVIMIENTO ================== */

  private setPath(target: THREE.Vector3) {
    this.path = this.host.nav.findPath(this.pos, target, this.def.ventAccess);
    this.pathIdx = 0;
    this.stuckTimer = 0;
    if (!this.path.length) {
      // sin camino: objetivo más cercano alcanzable
      const rooms = this.def.patrolRooms;
      for (const roomId of rooms) {
        const r = this.host.world.rooms.get(roomId);
        if (r) {
          const alt = new THREE.Vector3(r.center.x, 0, r.center.z);
          const p = this.host.nav.findPath(this.pos, alt, this.def.ventAccess);
          if (p.length) {
            this.path = p;
            this.pathIdx = 0;
            return;
          }
        }
      }
    }
  }

  private arrived(r: number): boolean {
    if (!this.path.length) return true;
    const last = this.path[this.path.length - 1];
    return Math.hypot(this.pos.x - last.x, this.pos.z - last.z) < r;
  }

  private followPath(dt: number, speed: number, player: PlayerLike) {
    if (!this.path.length || this.pathIdx >= this.path.length) {
      this.currentSpeed = Math.max(0, this.currentSpeed - dt * 6);
      return;
    }
    const target = this.path[this.pathIdx];
    _v1.set(target.x - this.pos.x, 0, target.z - this.pos.z);
    const d = _v1.length();
    if (d < 0.35) {
      this.pathIdx++;
      return;
    }
    _v1.normalize();
    // giro suave
    const targetYaw = Math.atan2(_v1.x, _v1.z);
    let diff = targetYaw - this.yaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.yaw += Math.max(-4.5 * dt, Math.min(4.5 * dt, diff));

    // ¿celda de conducto? gatear
    const cellVent = this.isVentCell(this.pos.x, this.pos.z);
    const targetVent = this.isVentCell(target.x, target.z);
    const wantCrawl = cellVent || targetVent;
    const crawlSpeedMul = wantCrawl ? 0.55 : 1;
    if (this.crawling !== wantCrawl) this.crawling = wantCrawl;

    const v = speed * crawlSpeedMul;
    this.currentSpeed = v;
    const step = v * dt;
    this.pos.x += _v1.x * step;
    this.pos.z += _v1.z * step;

    // atasco (tapa de conducto cerrada): golpearla
    const moved = step;
    if (moved < v * dt * 0.35) {
      this.stuckTimer += dt;
    } else {
      this.stuckTimer = Math.max(0, this.stuckTimer - dt);
    }
    if (this.stuckTimer > 0.8 && this.crawling) {
      this.host.sfx.ventBang(this.pos);
      this.stuckTimer = 0;
    }

    // abrir puertas cerradas cercanas en la dirección de avance
    this.autoDoors();

    // pasos
    this.footTimer -= dt * (v > this.def.speedWalk * 1.05 ? 1.6 : 1);
    if (this.footTimer <= 0) {
      this.footTimer = 0.55 + Math.random() * 0.1;
      const surface = this.crawling ? 'metal' : this.surfaceAt();
      this.host.sfx.footstep(this.pos, surface, v > this.def.speedWalk * 1.05, this.def.kind !== 'puppet');
    }
  }

  private isVentCell(x: number, z: number): boolean {
    const nav = this.host.nav;
    const i = nav.cellX(x);
    const j = nav.cellZ(z);
    if (i < 0 || j < 0 || i >= GRID_W || j >= GRID_H) return false;
    return nav.grid[j * GRID_W + i] === 2;
  }

  private surfaceAt(): string {
    const room = this.host.world.roomAt(this.pos.x, this.pos.z);
    if (!room) return 'tile';
    switch (room.def.floor) {
      case 'wood': return 'wood';
      case 'metal': return 'metal';
      case 'carpet': return 'carpet';
      case 'concrete': return 'concrete';
      default: return 'tile';
    }
  }

  private autoDoors() {
    for (const d of this.host.world.doors.values()) {
      if (d.open || d.locked) continue;
      const dd = Math.hypot(d.def.x - this.pos.x, d.def.z - this.pos.z);
      if (dd < 1.6) {
        d.open = true;
        d.targetAngle = d.group.rotation.y + (Math.random() > 0.5 ? 1.9 : -1.9);
        d.opening = true;
        this.host.sfx.doorCreak(this.pos);
      }
    }
  }

  /* ================== ANIMACIÓN PROCEDURAL ================== */

  private animateIdle(dt: number, player: PlayerLike) {
    this.currentSpeed = Math.max(0, this.currentSpeed - dt * 4);
    const t = this.host.time;
    // balanceo sutil + cabeza que sigue al jugador si está cerca (¡miedo!)
    const b = this.rig.bones;
    b.torso.rotation.z = Math.sin(t * 0.5 + this.def.eyeColor) * 0.015;
    if (this.def.kind === 'puppet') {
      this.rig.root.position.y = 0.04 + Math.sin(t * 1.8) * 0.05;
      b.armL.rotation.x = Math.sin(t * 1.2) * 0.08;
      b.armR.rotation.x = -Math.sin(t * 1.2) * 0.08;
      b.head.rotation.y = Math.sin(t * 0.4) * 0.5;
    }
    const d = this.pos.distanceTo(player.pos);
    if (d < 9 && this.active) {
      _v1.subVectors(player.pos, this.pos);
      const wantYaw = Math.atan2(_v1.x, _v1.z);
      let diff = wantYaw - this.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      // giran la cabeza (no el cuerpo) hacia el jugador — inquietante
      b.head.rotation.y = Math.max(-1.1, Math.min(1.1, diff));
    } else {
      b.head.rotation.y *= Math.max(0, 1 - dt * 2);
    }
    this.stepJaw(t);
  }

  private stepJaw(t: number) {
    const b = this.rig.bones;
    const open = this.state === 'attack' ? 0.65 : Math.max(0, Math.sin(t * 0.7 + this.def.eyeColor * 0.001)) * 0.06;
    b.jaw.rotation.x = open;
  }

  private animate(dt: number, player: PlayerLike) {
    const b = this.rig.bones;
    const t = this.host.time;

    if (this.crawling) {
      this.walkPhase += dt * this.currentSpeed * 3.2;
      const s = Math.sin(this.walkPhase);
      b.armL.rotation.x = -1.4 + s * 0.5;
      b.armR.rotation.x = -1.4 - s * 0.5;
      b.legL.rotation.x = 0.6 + -s * 0.35;
      b.legR.rotation.x = 0.6 + s * 0.35;
      b.torso.rotation.x = 0.2;
      b.head.rotation.x = -0.5;
      return;
    }

    const moving = this.currentSpeed > 0.15;
    if (moving) {
      const freq = this.currentSpeed * 2.4;
      this.walkPhase += dt * freq;
      const s = Math.sin(this.walkPhase);
      const c = Math.cos(this.walkPhase);
      const amp = Math.min(1, this.currentSpeed / this.def.speedWalk) * (this.currentSpeed > this.def.speedWalk * 1.05 ? 0.85 : 0.55);
      b.legL.rotation.x = s * 0.62 * amp;
      b.legR.rotation.x = -s * 0.62 * amp;
      b.shinL.rotation.x = Math.max(0, -s) * 0.75 * amp;
      b.shinR.rotation.x = Math.max(0, s) * 0.75 * amp;
      b.armL.rotation.x = -s * 0.5 * amp;
      b.armR.rotation.x = s * 0.5 * amp;
      b.forearmL.rotation.x = -0.35 - Math.max(0, s) * 0.4;
      b.forearmR.rotation.x = -0.35 - Math.max(0, -s) * 0.4;
      b.pelvis.position.y = (this.def.kind === 'puppet' ? 1.06 : 0.98) + Math.abs(c) * 0.035 * amp;
      b.torso.rotation.x = this.currentSpeed > this.def.speedWalk * 1.05 ? 0.22 : 0.06;
      b.torso.rotation.z = s * 0.04 * amp;
      if (this.def.kind === 'puppet') {
        this.rig.root.position.y = 0.05 + Math.sin(t * 2.2) * 0.05;
        b.armL.rotation.x = -0.9 + s * 0.25;
        b.armR.rotation.x = -0.9 - s * 0.25;
      }
    } else {
      this.walkPhase = 0;
      b.torso.rotation.z = Math.sin(t * 0.5) * 0.015;
      if (this.def.kind === 'puppet') {
        this.rig.root.position.y = 0.04 + Math.sin(t * 1.8) * 0.05;
        b.armL.rotation.x = Math.sin(t * 1.2) * 0.08;
        b.armR.rotation.x = -Math.sin(t * 1.2) * 0.08;
      } else {
        b.legL.rotation.x *= Math.max(0, 1 - dt * 5);
        b.legR.rotation.x *= Math.max(0, 1 - dt * 5);
        b.armL.rotation.x = -0.08 + Math.sin(t * 0.8) * 0.03;
        b.armR.rotation.x = -0.08 - Math.sin(t * 0.8) * 0.03;
      }
    }

    // attack: brazos arriba y mandíbula abierta
    if (this.state === 'attack') {
      b.armL.rotation.x = -2.4;
      b.armR.rotation.x = -2.4;
      b.forearmL.rotation.x = -0.5;
      b.forearmR.rotation.x = -0.5;
      b.jaw.rotation.x = 0.7;
      b.torso.rotation.x = 0.35;
    } else if (this.state === 'checkMask') {
      // cabeza ladeada, escrutando
      b.head.rotation.z = 0.28;
      b.jaw.rotation.x = 0.03;
    } else if (this.state === 'stunned') {
      b.head.rotation.z = -0.2;
      b.jaw.rotation.x = 0.12;
    } else {
      this.stepJaw(t);
      b.head.rotation.z *= Math.max(0, 1 - dt * 3);
    }

    // mirar al jugador si está cerca y es interés actual
    const d = this.pos.distanceTo(player.pos);
    if (d < 12 && (this.state === 'chase' || this.state === 'hunt' || this.state === 'checkMask' || this.state === 'stunned')) {
      _v1.subVectors(player.pos, this.pos);
      const wantYaw = Math.atan2(_v1.x, _v1.z);
      let diff = wantYaw - this.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      b.head.rotation.y = Math.max(-1.2, Math.min(1.2, diff));
    } else if (d < 9 && !moving) {
      _v1.subVectors(player.pos, this.pos);
      const wantYaw = Math.atan2(_v1.x, _v1.z);
      let diff = wantYaw - this.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      b.head.rotation.y = Math.max(-1.1, Math.min(1.1, diff));
    } else {
      b.head.rotation.y *= Math.max(0, 1 - dt * 2);
    }

    // espasmo aleatorio (terror)
    this.twitchTimer -= dt;
    if (this.twitchTimer <= 0) {
      this.twitchTimer = 6 + Math.random() * 18;
      this.twitch = 0.22;
    }
    if (this.twitch > 0) {
      this.twitch -= dt;
      b.head.rotation.z += (Math.random() - 0.5) * 0.14;
    }

    // pupilas más brillantes al cazar
    const glow = this.state === 'chase' || this.state === 'hunt' || this.state === 'attack' ? 2.6 : 1.4;
    for (const e of this.rig.eyes) {
      const m = e.material as THREE.MeshStandardMaterial;
      m.emissiveIntensity = glow;
    }
    if (this.rig.eyeGlow) this.rig.eyeGlow.intensity = this.state === 'dormant' ? 1.5 : glow * 4;
  }

  dispose() {
    this.rig.root.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
      }
    });
    this.host.world.scene.remove(this.rig.root);
  }
}
