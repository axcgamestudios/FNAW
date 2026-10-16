/**
 * Jugador en primera persona: movimiento, colisiones, estamina,
 * agacharse, linterna con batería, escondites y pasos con sonido.
 */
import * as THREE from 'three';
import type { WorldBuilder } from '../world/worldbuilder';
import { mapData } from '../ai/mapdata';

export interface PlayerHost {
  world: WorldBuilder;
  addNoise(x: number, z: number, radius: number): void;
  sfx: {
    footstep(pos: THREE.Vector3, surface: string, running: boolean, heavy: boolean): void;
    locker(pos: THREE.Vector3): void;
  };
  power: number;
}

const STAND_EYE = 1.62;
const CROUCH_EYE = 0.95;
const PLAYER_R = 0.3;

export class Player {
  pos = new THREE.Vector3(3.0, 0, 12.3);
  vel = new THREE.Vector3();
  yaw = Math.PI;
  pitch = 0;
  camera: THREE.PerspectiveCamera;
  host: PlayerHost;

  crouching = false;
  running = false;
  stamina = 100;
  staminaLock = false;
  flashlightOn = false;
  flashlightBattery = 100;
  masked = false;
  maskEquip = 0; // 0..1 animación de equipar
  hidden = false;
  hiddenSpotId: string | null = null;
  hiddenLookYaw = 0;
  lookDir = new THREE.Vector3(0, 0, 1);
  inVent = false;

  keys: Record<string, boolean> = {};
  private eyeH = STAND_EYE;
  private bobT = 0;
  private footT = 0;
  private shake = 0;
  private lightSway = new THREE.Quaternion();
  private lightGroup = new THREE.Group();
  flashlight: THREE.SpotLight;
  private flashTargetObj = new THREE.Object3D();
  private ventFlash = 0;

  constructor(camera: THREE.PerspectiveCamera, host: PlayerHost) {
    this.camera = camera;
    this.host = host;
    // linterna
    this.flashlight = new THREE.SpotLight(0xfff2d8, 0, 22, 0.46, 0.42, 1.25);
    this.flashlight.castShadow = true;
    this.flashlight.shadow.mapSize.set(1024, 1024);
    this.flashlight.shadow.camera.near = 0.2;
    this.flashlight.shadow.camera.far = 22;
    this.flashlight.shadow.bias = -0.003;
    this.lightGroup.add(this.flashlight);
    this.lightGroup.add(this.flashTargetObj);
    this.flashlight.target = this.flashTargetObj;
    this.flashTargetObj.position.set(0, 0, -6);
    camera.add(this.lightGroup);
    this.lightGroup.position.set(0.18, -0.22, 0.05);
  }

  get speedMax(): number {
    if (this.hidden) return 0;
    if (this.inVent) return 1.35;
    if (this.masked) return 2.1;
    if (this.crouching) return 1.55;
    if (this.running && !this.staminaLock) return 5.35;
    return 3.15;
  }

  onMouseMove(dx: number, dy: number, sensitivity: number, invertY: boolean) {
    if (this.hidden) return;
    const s = sensitivity * 0.0021;
    this.yaw -= dx * s;
    this.pitch += (invertY ? dy : -dy) * s;
    this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch));
  }

  setShake(v: number) {
    this.shake = Math.max(this.shake, v);
  }

  reset() {
    this.pos.set(3.0, 0, 12.3);
    this.vel.set(0, 0, 0);
    this.yaw = 0;
    this.pitch = 0;
    this.crouching = false;
    this.stamina = 100;
    this.staminaLock = false;
    this.flashlightOn = false;
    this.flashlightBattery = 100;
    this.masked = false;
    this.maskEquip = 0;
    this.hidden = false;
    this.hiddenSpotId = null;
    this.inVent = false;
    this.eyeH = STAND_EYE;
  }

  /* ============ ACTUALIZACIÓN ============ */

  update(dt: number) {
    const world = this.host.world;

    if (this.hidden) {
      this.vel.set(0, 0, 0);
      this.updateCamera(dt, 0);
      return;
    }

    // dirección de vista (coincide con la cámara: forward = (-sin, -cos))
    this.lookDir.set(
      -Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      -Math.cos(this.yaw) * Math.cos(this.pitch)
    );

    // entrada de movimiento
    const fwd = (this.keys['KeyW'] ? 1 : 0) - (this.keys['KeyS'] ? 1 : 0);
    const strafe = (this.keys['KeyD'] ? 1 : 0) - (this.keys['KeyA'] ? 1 : 0);
    const moving = fwd !== 0 || strafe !== 0;
    this.running = !!(this.keys['ShiftLeft'] || this.keys['ShiftRight']) && moving && !this.crouching && !this.masked && !this.inVent;

    // estamina
    if (this.running) {
      this.stamina -= dt * 19;
      if (this.stamina <= 0) {
        this.stamina = 0;
        this.staminaLock = true;
      }
    } else {
      this.stamina += dt * (moving ? 5.5 : 11);
    }
    if (this.stamina > 32) this.staminaLock = false;
    this.stamina = Math.max(0, Math.min(100, this.stamina));

    // velocidad objetivo (forward + strafe según la convención de cámara)
    const target = new THREE.Vector3();
    if (moving) {
      const sy = Math.sin(this.yaw);
      const cy = Math.cos(this.yaw);
      // forward = (-sin, -cos); right = (cos, -sin)
      target.set(
        -sy * fwd + cy * strafe,
        0,
        -cy * fwd - sy * strafe
      );
      target.normalize().multiplyScalar(this.speedMax);
    }
    // aceleración suave
    const accel = moving ? 11 : 13;
    this.vel.x += (target.x - this.vel.x) * Math.min(1, dt * accel);
    this.vel.z += (target.z - this.vel.z) * Math.min(1, dt * accel);

    // detectar zona de conducto (obligación de gatear)
    this.inVent = false;
    for (const v of mapData.vents) {
      const [ax, az] = v.a;
      const [bx, bz] = v.b;
      const dx = bx - ax;
      const dz = bz - az;
      const len2 = dx * dx + dz * dz;
      const t = len2 > 0 ? Math.max(0, Math.min(1, ((this.pos.x - ax) * dx + (this.pos.z - az) * dz) / len2)) : 0;
      const px = ax + dx * t;
      const pz = az + dz * t;
      if (Math.hypot(this.pos.x - px, this.pos.z - pz) < 0.42 && t > -0.05 && t < 1.05) {
        this.inVent = true;
        break;
      }
    }

    // movimiento con colisión
    this.moveWithCollisions(dt);

    // altura del ojo
    const targetEye = this.crouching || this.inVent ? CROUCH_EYE : STAND_EYE;
    this.eyeH += (targetEye - this.eyeH) * Math.min(1, dt * 9);

    // batería de la linterna
    if (this.flashlightOn) {
      this.flashlightBattery -= dt * 1.05;
      if (this.flashlightBattery <= 0) {
        this.flashlightBattery = 0;
        this.flashlightOn = false;
        this.host.sfx.footstep(this.pos, 'metal', false, false);
      }
    }

    // ruido de pasos
    const speed = Math.hypot(this.vel.x, this.vel.z);
    if (speed > 0.4) {
      this.footT -= dt * (this.running ? 1.55 : 1);
      if (this.footT <= 0) {
        this.footT = this.crouching ? 0.72 : 0.52;
        const surface = this.inVent ? 'metal' : this.surfaceAt();
        this.host.sfx.footstep(this.pos, surface, this.running, false);
        const noiseR = this.crouching ? 1.2 : this.running ? 9.5 : 3.6;
        this.host.addNoise(this.pos.x, this.pos.z, noiseR);
      }
    }

    // máscara: animación de equipar
    const targetMask = this.masked ? 1 : 0;
    this.maskEquip += (targetMask - this.maskEquip) * Math.min(1, dt * 4);

    this.updateCamera(dt, speed);
    this.updateFlashlight(dt);
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

  private moveWithCollisions(dt: number) {
    const world = this.host.world;
    const nx = this.pos.x + this.vel.x * dt;
    const nz = this.pos.z + this.vel.z * dt;
    // resolver eje X (solo si NO estaba ya solapado en X: evita lanzamientos al nacer dentro)
    let resolvedX = nx;
    for (const c of world.colliders) {
      if (!c.active) continue;
      const b = c.box;
      const wasOutsideX = this.pos.x + PLAYER_R <= b.min.x || this.pos.x - PLAYER_R >= b.max.x;
      if (
        wasOutsideX &&
        resolvedX + PLAYER_R > b.min.x && resolvedX - PLAYER_R < b.max.x &&
        this.pos.z + PLAYER_R > b.min.z && this.pos.z - PLAYER_R < b.max.z &&
        this.pos.y < b.max.y - 0.05 && b.max.y > 0.3
      ) {
        if (this.vel.x > 0) resolvedX = b.min.x - PLAYER_R - 0.001;
        else if (this.vel.x < 0) resolvedX = b.max.x + PLAYER_R + 0.001;
      }
    }
    this.pos.x = Math.max(-23.7, Math.min(23.7, resolvedX));
    // resolver eje Z
    let resolvedZ = nz;
    for (const c of world.colliders) {
      if (!c.active) continue;
      const b = c.box;
      const wasOutsideZ = this.pos.z + PLAYER_R <= b.min.z || this.pos.z - PLAYER_R >= b.max.z;
      if (
        wasOutsideZ &&
        this.pos.x + PLAYER_R > b.min.x && this.pos.x - PLAYER_R < b.max.x &&
        resolvedZ + PLAYER_R > b.min.z && resolvedZ - PLAYER_R < b.max.z &&
        this.pos.y < b.max.y - 0.05 && b.max.y > 0.3
      ) {
        if (this.vel.z > 0) resolvedZ = b.min.z - PLAYER_R - 0.001;
        else if (this.vel.z < 0) resolvedZ = b.max.z + PLAYER_R + 0.001;
      }
    }
    this.pos.z = Math.max(-16.7, Math.min(16.7, resolvedZ));
    // gravedad simple: seguir la altura del suelo
    const fy = world.floorHeightAt(this.pos.x, this.pos.z);
    this.pos.y += (fy - this.pos.y) * Math.min(1, dt * 12);
  }

  private updateCamera(dt: number, speed: number) {
    // balanceo de cabeza
    if (speed > 0.4) {
      this.bobT += dt * speed * 2.3;
    }
    const bob = Math.sin(this.bobT) * Math.min(0.045, speed * 0.012);
    const bobX = Math.cos(this.bobT * 0.5) * Math.min(0.03, speed * 0.008);
    // sacudida
    this.shake = Math.max(0, this.shake - dt * 1.8);
    const sh = this.shake;
    const t = performance.now() / 1000;
    this.camera.position.set(
      this.pos.x + bobX + (Math.random() - 0.5) * sh * 0.2,
      this.pos.y + this.eyeH + bob + Math.sin(t * 1.7) * 0.008 + (Math.random() - 0.5) * sh * 0.2,
      this.pos.z
    );
    // al estar escondido: mirar en la dirección del escondite
    const yaw = this.hidden ? this.hiddenLookYaw : this.yaw;
    this.camera.rotation.set(0, 0, 0);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = yaw + (Math.random() - 0.5) * sh * 0.05;
    this.camera.rotation.x = this.hidden ? -0.12 : this.pitch;
    // FOV según estado
    const targetFov = this.masked ? 58 : this.running ? 76 : 70;
    this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 6);
    this.camera.updateProjectionMatrix();
  }

  private updateFlashlight(dt: number) {
    // balanceo suave del haz (con inercia)
    const targetQ = this.camera.quaternion;
    this.lightSway.slerp(targetQ, Math.min(1, dt * 9));
    this.lightGroup.quaternion.copy(this.lightSway).premultiply(this.camera.quaternion.clone().invert());
    let intensity = 0;
    if (this.flashlightOn) {
      intensity = 46;
      const b = this.flashlightBattery;
      if (b < 18) {
        // parpadeo con batería baja
        if (Math.random() < 0.09) this.ventFlash = 0.09;
        this.ventFlash = Math.max(0, this.ventFlash - dt);
        if (this.ventFlash > 0) intensity = 4;
        else intensity *= 0.7 + (b / 18) * 0.35;
      }
    }
    this.flashlight.intensity = intensity;
  }

  roomLightLevel(): number {
    const room = this.host.world.roomAt(this.pos.x, this.pos.z);
    if (!room || !room.light) return 0;
    return Math.min(1, (room.light.intensity / Math.max(0.001, room.lightBase)) * 1.2);
  }

  emitNoise(): void {
    /* manejado en update */
  }

  /** Esconderse en un punto */
  hide(spotId: string, pos: THREE.Vector3, lookYaw: number) {
    this.hidden = true;
    this.hiddenSpotId = spotId;
    this.hiddenLookYaw = lookYaw;
    this.pos.set(pos.x, 0, pos.z);
    this.host.sfx.locker(pos);
  }

  unhide(exitPos: THREE.Vector3) {
    this.hidden = false;
    this.hiddenSpotId = null;
    this.pos.set(exitPos.x, 0, exitPos.z);
    this.host.sfx.locker(exitPos);
  }

  addBattery(amount: number) {
    this.flashlightBattery = Math.min(100, this.flashlightBattery + amount);
  }

  toggleFlashlight() {
    if (!this.flashlightOn && this.flashlightBattery <= 1) return false;
    this.flashlightOn = !this.flashlightOn;
    return this.flashlightOn;
  }
}
