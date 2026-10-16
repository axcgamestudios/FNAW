/**
 * Cámaras de seguridad: render de vistas fijas + interferencias.
 */
import * as THREE from 'three';
import { mapData } from '../ai/mapdata';
import type { Animatronic } from '../ai/animatronic';
import type { CamDef } from '../core/types';
import { useHud } from '../core/state';

export class SecurityCameras {
  cams: CamDef[] = mapData.cams;
  current = 1;
  camera: THREE.PerspectiveCamera;
  private t = 0;
  private glitch = 0;
  private brokenCams: number[] = [];
  private audio: { camSwitch(): void; setStatic(l: number): void };

  constructor(aspect: number, audio: { camSwitch(): void; setStatic(l: number): void }) {
    this.camera = new THREE.PerspectiveCamera(64, aspect, 0.1, 60);
    this.audio = audio;
    this.applyCurrent();
  }

  get currentDef(): CamDef {
    return this.cams.find((c) => c.index === this.current) ?? this.cams[0];
  }

  applyCurrent() {
    const def = this.currentDef;
    this.camera.position.set(def.pos[0], def.pos[1], def.pos[2]);
    this.camera.lookAt(def.look[0], def.look[1], def.look[2]);
    useHud.getState().syncHud({ tabletCam: this.current });
  }

  switchCam(delta: number) {
    const order = this.cams.map((c) => c.index);
    let idx = order.indexOf(this.current);
    for (let k = 0; k < order.length; k++) {
      idx = (idx + (delta > 0 ? 1 : -1) + order.length) % order.length;
      if (!this.brokenCams.includes(order[idx])) break;
    }
    this.current = order[idx];
    this.applyCurrent();
    this.audio.camSwitch();
  }

  setCam(index: number) {
    if (this.brokenCams.includes(index)) return;
    this.current = index;
    this.applyCurrent();
    this.audio.camSwitch();
  }

  breakCam(index: number) {
    if (!this.brokenCams.includes(index)) this.brokenCams.push(index);
  }

  repairCam(index: number) {
    this.brokenCams = this.brokenCams.filter((i) => i !== index);
  }

  reset(night: number) {
    this.brokenCams = [];
    if (night >= 2) {
      this.breakCam(9);
      this.breakCam(5);
    }
    this.current = 1;
    this.applyCurrent();
    this.glitch = 0;
  }

  update(dt: number, animatronics: Animatronic[], tabletOpen: boolean) {
    this.t += dt;
    // balanceo lento de la cámara (motor de cámara)
    const def = this.currentDef;
    const baseLook = new THREE.Vector3(def.look[0], def.look[1], def.look[2]);
    const dir = baseLook.clone().sub(this.camera.position);
    const yaw = Math.atan2(dir.x, dir.z) + Math.sin(this.t * 0.31) * 0.14;
    const pitch = Math.asin(Math.max(-1, Math.min(1, dir.y / dir.length())));
    this.camera.rotation.set(pitch, yaw, 0, 'YXZ');
    this.camera.rotateZ(Math.sin(this.t * 0.23) * 0.012);

    if (!tabletOpen) {
      this.audio.setStatic(0);
      return;
    }

    // interferencia si hay un animatrónico en la sala de esta cámara
    const room = def.room;
    let occupied = false;
    for (const a of animatronics) {
      if (!a.active) continue;
      if (a.pos.distanceTo(this.camera.position) < 16 && a.host.world.roomIdAt(a.pos.x, a.pos.z) === room) {
        occupied = true;
        break;
      }
    }
    const targetGlitch = occupied ? 1 : def.audioOnly ? 0.5 : 0.12;
    this.glitch += (targetGlitch - this.glitch) * Math.min(1, dt * 3);
    this.audio.setStatic(this.glitch);
  }

  get glitchLevel(): number {
    return this.glitch;
  }

  dispose() {
    this.camera.clear();
  }
}
