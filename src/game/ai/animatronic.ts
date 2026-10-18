/**
 * Animatrónico: modelo GLTF del repositorio + máquina de estados +
 * detección + navegación. Animación procedural sobre los huesos del
 * esqueleto real (aditiva sobre la pose de reposo) y clips de GLB.
 */
import * as THREE from 'three';
import type { AnimatronicDef, NoiseEvent } from '../core/types';
import { buildAnimatronic, setSolLunaMode, type CharacterRig } from '../characters/models';
import { Assets, setMoonMode, type GltfRig } from '../world/assets';
import { RigAnimator, type AnimCtx } from '../characters/animation';
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
  lookDir: THREE.Vector3;
  roomLightLevel(): number;
  emitNoise(): void;
}

export interface AIHost {
  time: number;
  chapter: number;
  chapterTime: number;
  aggression: number;
  nav: NavGraph;
  world: WorldBuilder;
  noises: NoiseEvent[];
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

/** Rig unificado: GLTF o procedural con la misma interfaz para la IA */
interface ARig {
  root: THREE.Group;
  model: THREE.Object3D | null;
  bones: {
    pelvis?: THREE.Object3D;
    torso?: THREE.Object3D;
    head?: THREE.Object3D;
    jaw?: THREE.Object3D;
    armL?: THREE.Object3D;
    armR?: THREE.Object3D;
    forearmL?: THREE.Object3D;
    forearmR?: THREE.Object3D;
    legL?: THREE.Object3D;
    legR?: THREE.Object3D;
    shinL?: THREE.Object3D;
    shinR?: THREE.Object3D;
    earL?: THREE.Object3D;
    earR?: THREE.Object3D;
  };
  eyes: THREE.Mesh[];
  /** halos de ojos: mallas emisivas aditivas pegadas a los ojos REALES del
   * modelo (v8: se acabó la esfera flotante delante de la cara) */
  eyeGlows: THREE.Mesh[];
  eyeGlow: THREE.Mesh | null;
  height: number;
}

/** ajusta el brillo de los halos de ojos de un rig */
export function setEyeGlow(rig: { eyeGlow: THREE.Mesh | null; eyeGlows?: THREE.Mesh[] }, level: number) {
  const list = rig.eyeGlows && rig.eyeGlows.length ? rig.eyeGlows : rig.eyeGlow ? [rig.eyeGlow] : [];
  for (const e of list) {
    const m = e.material as THREE.MeshBasicMaterial;
    m.opacity = Math.min(1, 0.25 + level * 0.75);
    const base = (e.userData as { baseScale?: number }).baseScale ?? 1;
    e.scale.setScalar(base * (1 + level * 0.35));
  }
}

export class Animatronic {
  def: AnimatronicDef;
  rig: ARig;
  host: AIHost;
  state: AIState = 'dormant';
  active = false;
  scriptedAwake = false;
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
  animator!: RigAnimator;
  private charRig: CharacterRig | null = null;
  /** rig GLB de Luna (para el cambio de cara Sol/Luna) */
  private moonRig: GltfRig | null = null;
  /** retirado: el guardián Sol/Luna dejó de cazar para siempre */
  retired = false;
  /** LUNA colgando del techo de la Mega Guardería (dormida, boca abajo) */
  hanging = false;
  private hangY = 0;

  constructor(def: AnimatronicDef, host: AIHost) {
    this.def = def;
    this.host = host;
    this.rig = this.buildRig(def);
    const room = host.world.rooms.get(def.startRoom);
    const [ox, oz] = def.startOffset ?? [0, 0];
    const cx = room ? room.center.x : 0;
    const cz = room ? room.center.z : 0;
    this.pos.set(cx + ox, 0, cz + oz);
    this.rig.root.position.copy(this.pos);
    this.rig.root.rotation.y = 0;
    (this.rig.root as unknown as { userData: { animatronicId?: string } }).userData.animatronicId = def.id;
    host.world.scene.add(this.rig.root);
    // animador procedural en espacio de personaje (independiente del esqueleto)
    this.animator = new RigAnimator(this.rig.root, this.rig.model, this.rig.bones);
  }

  /** Construye el rig: GLTF del repo si está disponible; procedural si no */
  private buildRig(def: AnimatronicDef): ARig {
    const assetKind = def.kind; // 'freddy' | 'bonnie' | 'chica' | 'foxy' | 'golden' | 'luna'
    let gltfRig: GltfRig | null = null;
    if (assetKind === 'golden') {
      gltfRig = Assets.createVariant('golden', 0xc8a028);
    } else if (assetKind === 'luna') {
      // LUNA: modelo GLB estático del Eclipse (moon.glb) — vuela/rueda, no camina
      gltfRig = Assets.rigs.get('moon') ?? null;
    } else if (Assets.has(assetKind)) {
      gltfRig = Assets.rigs.get(assetKind) ?? null;
    }
    if (gltfRig) {
      /* v8 — halos de ojos PEGADOS a los ojos reales del GLB: una esfera
       * aditiva pequeña por ojo, posicionada según la caja del mesh del ojo
       * tras la normalización. Se acabó la esfera flotante en (0, h*0.84,
       * 0.26) que atravesaba la cara de Bonnie/Chica/Foxy/Freddy. */
      const eyeGlows: THREE.Mesh[] = [];
      const glowMat = new THREE.MeshBasicMaterial({
        color: def.eyeColor,
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      });
      const tmpBox = new THREE.Box3();
      const tmpCtr = new THREE.Vector3();
      const tmpSize = new THREE.Vector3();
      for (const eye of gltfRig.eyes) {
        tmpBox.setFromObject(eye);
        tmpBox.getCenter(tmpCtr);
        const r = Math.max(0.03, tmpBox.getSize(tmpSize).length() * 0.16);
        const glow = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), glowMat);
        // posición en el espacio del ojo (lo sigue si la cabeza gira),
        // contrarrestando la escala global del modelo
        const inv = 1 / Math.max(0.0001, eye.getWorldScale(new THREE.Vector3()).x);
        glow.position.copy(eye.worldToLocal(tmpCtr.clone()));
        glow.scale.setScalar(inv);
        (glow.userData as { baseScale?: number }).baseScale = inv;
        eye.add(glow);
        eyeGlows.push(glow);
      }
      if (!eyeGlows.length && def.kind === 'luna') {
        // Luna (GLB sin meshes de ojo): brillo tenue de la cara, pegado al frente
        const glow = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), glowMat);
        glow.position.set(0, gltfRig.height * 0.78, 0.12);
        gltfRig.root.add(glow);
        eyeGlows.push(glow);
      }
      const rig: ARig = {
        root: gltfRig.root,
        model: gltfRig.model,
        bones: gltfRig.bones,
        eyes: gltfRig.eyes,
        eyeGlows,
        eyeGlow: eyeGlows[0] ?? null,
        height: gltfRig.height,
      };
      this.moonRig = def.kind === 'luna' ? gltfRig : null;
      return rig;
    }
    // fallback procedural
    const char = buildAnimatronic(
      def.kind === 'freddy' || def.kind === 'golden' ? 'bear'
        : def.kind === 'bonnie' ? 'rabbit'
        : def.kind === 'chica' ? 'chicken'
        : def.kind === 'luna' ? 'solluna' : 'fox',
      def.eyeColor
    );
    const rig: ARig = {
      root: char.root,
      model: null,
      bones: char.bones,
      eyes: char.eyes,
      eyeGlows: char.eyeGlow ? [char.eyeGlow] : [],
      eyeGlow: char.eyeGlow ?? null,
      height: char.height,
    };
    this.charRig = char;
    return rig;
  }

  reset() {
    this.state = 'dormant';
    this.active = false;
    this.retired = false;
    this.hanging = false;
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
    // restaurar pose de reposo
    this.animator.reset();
  }

  wake() {
    if (this.active) return;
    if (this.retired) return; // Sol permanente: jamás despierta de nuevo
    this.active = true;
    this.state = 'patrol';
    this.stateTimer = 0;
    this.host.sfx.vocal(this.pos, this.def.voice);
  }

  /** activación guionizada (p. ej. Freddy Dorado al coger la cinta) */
  scriptWake() {
    if (this.retired) return;
    this.scriptedAwake = true;
    this.wake();
    this.state = this.def.persistent ? 'hunt' : 'chase';
    this.stateTimer = 0;
    this.lastKnown = null;
  }

  /** teletransporte (pruebas / sustos guionizados) */
  teleportTo(x: number, z: number, yaw?: number) {
    this.pos.set(x, 0, z);
    this.hanging = false;
    this.rig.root.position.copy(this.pos);
    if (yaw !== undefined) {
      this.yaw = yaw;
      this.rig.root.rotation.y = yaw;
    }
    this.path = [];
    this.stateTimer = 0;
  }

  /** forzar persecución directa (pruebas) */
  forceChase(target: THREE.Vector3) {
    if (!this.active) this.wake();
    this.state = 'chase';
    this.stateTimer = 0;
    this.lastKnown = target.clone();
    this.lastSeenAt = this.host.time;
  }

  /** ir a investigar un punto sin perseguir (sustos guionizados) */
  investigateAt(target: THREE.Vector3) {
    if (!this.active) this.wake();
    if (this.state === 'chase' || this.state === 'attack') return;
    this.state = 'investigate';
    this.stateTimer = 0;
    this.investigatePoint = target.clone();
    this.path = [];
  }

  /** calmar y devolver a patrulla (pruebas) */
  calmDown() {
    this.state = 'patrol';
    this.stateTimer = 0;
    this.path = [];
    this.lastKnown = null;
  }

  /** transformación Sol/Luna (guardián de la alberca) */
  setDayNight(mode: 'sun' | 'moon') {
    if (this.def.kind !== 'luna') return;
    if (this.charRig) setSolLunaMode(this.charRig, mode);
    else if (this.moonRig) {
      // GLB del Eclipse: recoloreado + rayos del Sol solo en modo día
      setMoonMode(this.moonRig, mode);
      for (const e of this.rig.eyeGlows) {
        (e.material as THREE.MeshBasicMaterial).color.setHex(mode === 'sun' ? 0xffe58a : this.def.eyeColor);
      }
    }
  }

  /** cuelga del techo de la Mega Guardería (intro del capítulo 4) */
  hangFromCeiling(y: number) {
    this.hanging = true;
    this.hangY = y;
    this.active = false;
    this.state = 'dormant';
    this.currentSpeed = 0;
    this.path = [];
  }

  /** desciende del techo y despierta (la prueba comienza) */
  descendAndWake() {
    if (!this.hanging) {
      this.wake();
      return;
    }
    this.hanging = false;
    this.wake();
  }

  /** se retira para siempre (prueba superada): ni caza ni despierta */
  retire() {
    this.retired = true;
    this.active = false;
    this.state = 'dormant';
    this.path = [];
    this.currentSpeed = 0;
    this.stateTimer = 0;
  }

  get eyeColor(): number {
    return this.def.eyeColor;
  }

  /* ================== ACTUALIZACIÓN PRINCIPAL ================== */

  update(dt: number, player: PlayerLike) {
    this.stateTimer += dt;
    this.thinkTimer -= dt;
    this.vocalTimer -= dt;

    if (!this.active) {
      // retirado: ni caza ni despierta (Sol permanente)
      if (this.retired) {
        this.currentSpeed = 0;
        this.updateAnimator(dt, player, 'dormant');
        return;
      }
      // despertar por temporizador del capítulo
      const delay = this.wakeDelayForChapter();
      if (delay < 900 && this.host.chapterTime >= delay) {
        this.wake();
      } else {
        this.currentSpeed = 0;
        this.updateAnimator(dt, player, 'dormant');
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
      default: this.currentSpeed = Math.max(0, this.currentSpeed - dt * 4); break;
    }

    // física mínima: y del suelo
    const fy = this.host.world.floorHeightAt(this.pos.x, this.pos.z);
    this.pos.y += (fy - this.pos.y) * Math.min(1, dt * 10);
    this.rig.root.position.copy(this.pos);
    if (this.hanging) this.rig.root.position.y = this.hangY;
    if (!this.crawling) this.rig.root.rotation.set(0, this.yaw, 0);
    else this.rig.root.rotation.set(0.55, this.yaw, 0.12);

    // LUNA (GLB del Eclipse): no camina — PLANEA. Flotación del RigAnimator
    // + giro de muñeco y vuelco completo cuando cuelga del techo.
    if (this.def.kind === 'luna' && this.rig.model) {
      const m = this.rig.model;
      const t = this.host.time;
      const speedT = Math.min(1, this.currentSpeed / Math.max(0.1, this.def.speedWalk));
      // vuelco: colgada boca abajo (π) ↔ de pie (0, pose del GLB ya erguido)
      const wantX = this.hanging ? Math.PI : 0;
      m.rotation.x += (wantX - m.rotation.x) * Math.min(1, dt * 2.2);
      // giro de muñeco (sacudida espasmódica al cazar)
      m.rotation.z = this.hanging
        ? Math.sin(t * 0.7) * 0.55
        : Math.sin(t * 0.85) * 0.2 + (this.state === 'chase' ? Math.sin(t * 14) * 0.06 : 0);
      // se inclina hacia delante al avanzar (planeo)
      if (!this.crawling) this.rig.root.rotation.x = this.hanging ? 0 : speedT * 0.17;
    }

    this.updateAnimator(dt, player);
  }

  /** pose manual de agarre para la secuencia de muerte */
  poseDying(dt: number) {
    this.updateAnimator(dt, null, 'dying');
  }

  private wakeDelayForChapter(): number {
    const len = this.def.wakeDelay?.length ?? 1;
    const c = Math.min(Math.max(this.host.chapter, 1), Math.max(1, len));
    return this.def.wakeDelay?.[c - 1] ?? 0;
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
        if (player.masked && this.def.maskFoolable && dist < 4.2 && dist > 1.2 && !this.maskLocked) {
          this.state = 'checkMask';
          this.stateTimer = 0;
          this.fooledTime = 0;
          this.host.sfx.servo(this.pos, this.def.voice);
          return;
        }
        if (player.masked && !this.def.maskFoolable) {
          this.host.sfx.roar(this.pos, this.def.voice);
        }
        this.startChase();
      }
    } else if (this.state === 'chase' && this.host.time - this.lastSeenAt > 2.6) {
      this.state = 'search';
      this.stateTimer = 0;
    }
  }

  canSee(player: PlayerLike): boolean {
    if (player.hidden) return false;
    const d = this.pos.distanceTo(player.pos);
    let maxDist = this.def.visionDist * (0.75 + this.host.aggression * 0.35);
    const light = player.roomLightLevel();
    if (!player.flashlightOn && light < 0.25) maxDist *= 0.45;
    if (player.crouching) maxDist *= 0.8;
    if (player.flashlightOn) maxDist *= 1.25;
    if (d > maxDist) return false;
    if (this.def.visionFov < 360) {
      _v1.subVectors(player.pos, this.pos);
      _v1.y = 0;
      _v1.normalize();
      const facing = _v2.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
      const dot = _v1.dot(facing);
      const cosHalf = Math.cos((this.def.visionFov * Math.PI) / 360);
      if (dot < cosHalf && d > 2.2) return false;
    }
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
    _v1.subVectors(this.pos, player.pos).normalize();
    if (_v1.dot(player.lookDir) < 0.955) return;
    if (!this.host.nav.los(player.pos, this.pos, this.def.ventAccess)) return;
    this.litTime += dt;
    if (this.def.flashlight === 'freeze' && this.litTime > 0.1) {
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
    if (!this.patrolTarget || this.arrived(1.2) || this.stateTimer > 40) {
      const rooms = this.def.patrolRooms;
      const room = rooms[(Math.random() * rooms.length) | 0];
      const r = this.host.world.rooms.get(room);
      if (r) {
        const [x1, z1, x2, z2] = r.def.rect;
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
      this.currentSpeed = Math.max(0, this.currentSpeed - dt * 4);
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
    _v1.subVectors(player.pos, this.pos);
    this.yaw = Math.atan2(_v1.x, _v1.z);
    this.fooledTime += dt;
    if (!player.masked || player.running) {
      this.maskLocked = true;
      this.startChase();
      return;
    }
    if (this.fooledTime > this.def.maskFoolTime) {
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
    const windup = this.def.attackWindup;
    if (this.stateTimer < windup) {
      _v1.subVectors(player.pos, this.pos);
      this.yaw = Math.atan2(_v1.x, _v1.z);
      const d = this.pos.distanceTo(player.pos);
      if (d > this.def.attackRange + 1.1) {
        this.startChase();
        return;
      }
      return;
    }
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
    const targetYaw = Math.atan2(_v1.x, _v1.z);
    let diff = targetYaw - this.yaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.yaw += Math.max(-4.5 * dt, Math.min(4.5 * dt, diff));

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

    if (step < v * dt * 0.35) {
      this.stuckTimer += dt;
    } else {
      this.stuckTimer = Math.max(0, this.stuckTimer - dt);
    }
    if (this.stuckTimer > 0.8 && this.crawling) {
      this.host.sfx.ventBang(this.pos);
      this.stuckTimer = 0;
    }

    this.autoDoors();

    this.footTimer -= dt * (v > this.def.speedWalk * 1.05 ? 1.6 : 1);
    if (this.footTimer <= 0) {
      this.footTimer = 0.55 + Math.random() * 0.1;
      const surface = this.crawling ? 'metal' : this.surfaceAt();
      this.host.sfx.footstep(this.pos, surface, v > this.def.speedWalk * 1.05, true);
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

  /* ================== ANIMACIÓN (RigAnimator en espacio de personaje) ================== */

  private updateAnimator(dt: number, player: PlayerLike | null, stateOverride?: string) {
    const t = this.host.time;
    let lookYaw = 0;
    let lookPitch = 0;
    if (player) {
      const d = this.pos.distanceTo(player.pos);
      const interested =
        stateOverride === 'dying' || this.state === 'chase' || this.state === 'hunt' ||
        this.state === 'checkMask' || this.state === 'stunned' || this.state === 'attack' ||
        (d < 9 && this.currentSpeed < 0.2);
      if (interested && d < 13) {
        _v1.subVectors(player.pos, this.pos);
        const wantYaw = Math.atan2(_v1.x, _v1.z);
        let diff = wantYaw - this.yaw;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        lookYaw = Math.max(-1.0, Math.min(1.0, diff));
        // mirar ligeramente hacia abajo: el guardia (1.6m) es más bajo
        const headY = this.rig.height * 0.88;
        const dHoriz = Math.max(0.4, Math.hypot(_v1.x, _v1.z));
        lookPitch = Math.atan2(headY - 1.62, dHoriz);
      }
    }
    const ctx: AnimCtx = {
      dt,
      time: t,
      speed: this.currentSpeed,
      walkRef: this.def.speedWalk,
      state: (stateOverride ?? this.state) as AnimCtx['state'],
      stateTime: this.stateTimer,
      yaw: this.yaw,
      crawling: this.crawling,
      lookYaw,
      lookPitch,
    };
    this.animator.update(ctx);

    // pupilas más brillantes al cazar
    const glow = this.state === 'chase' || this.state === 'hunt' || this.state === 'attack' ? 2.6 : 1.5;
    for (const e of this.rig.eyes) {
      const mats = Array.isArray(e.material) ? e.material : [e.material];
      for (const m of mats as THREE.MeshStandardMaterial[]) {
        m.emissiveIntensity = glow;
      }
    }
    setEyeGlow(this.rig, this.active ? (glow > 2 ? 1 : 0.45) : 0.15);
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
