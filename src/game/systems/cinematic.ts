/**
 * Reproductor de cinemáticas: tomas de cámara con dolly, textos,
 * colocación de actores y letterbox. Estilo Security Breach.
 */
import * as THREE from 'three';
import cineData from '@/data/cinematics.json';
import type { WorldBuilder } from '../world/worldbuilder';
import { Assets } from '../world/assets';
import { useHud } from '../core/state';

interface ShotDef {
  pos: [number, number, number];
  look: [number, number, number];
  dur: number;
  text?: string;
}

interface ActorDef {
  id: string;
  pos: [number, number, number];
  yaw?: number;
}

interface CineDef {
  letterbox: boolean;
  actors?: ActorDef[];
  shots: ShotDef[];
}

type CineMap = Record<string, CineDef>;

export class CinematicPlayer {
  camera: THREE.PerspectiveCamera;
  world: WorldBuilder;
  active = false;
  private def: CineDef | null = null;
  private shots: ShotDef[] = [];
  private idx = 0;
  private t = 0;
  private onEnd: (() => void) | null = null;
  private placedActors: THREE.Object3D[] = [];
  private savedPositions: Array<{ obj: THREE.Object3D; pos: THREE.Vector3; yaw: number; visible: boolean }> = [];
  private cinePos = new THREE.Vector3();
  private cineLook = new THREE.Vector3();

  constructor(camera: THREE.PerspectiveCamera, world: WorldBuilder) {
    this.camera = camera;
    this.world = world;
  }

  get currentText(): string | null {
    if (!this.active || !this.shots[this.idx]) return null;
    return this.shots[this.idx].text ?? null;
  }

  play(id: string, onEnd: () => void): boolean {
    const def = (cineData as unknown as CineMap)[id];
    if (!def || !def.shots?.length) return false;
    this.def = def;
    this.shots = def.shots;
    this.idx = 0;
    this.t = 0;
    this.onEnd = onEnd;
    this.active = true;
    // colocar actores (modelos GLTF)
    for (const a of def.actors ?? []) {
      const obj = this.placeActor(a);
      if (obj) this.placedActors.push(obj);
    }
    this.applyShot();
    useHud.getState().syncHud({ cinematic: true, cinematicText: this.currentText, cinematicSkip: false });
    return true;
  }

  private placeActor(a: ActorDef): THREE.Object3D | null {
    // animatrónico activo en juego: moverlo (se restaura al terminar)
    if (['freddy', 'bonnie', 'chica', 'foxy', 'golden'].includes(a.id)) {
      for (const child of this.world.scene.children) {
        const meta = (child as unknown as { userData?: { animatronicId?: string } }).userData;
        if (meta?.animatronicId === a.id) {
          this.savedPositions.push({
            obj: child,
            pos: child.position.clone(),
            yaw: child.rotation.y,
            visible: child.visible,
          });
          child.position.set(a.pos[0], a.pos[1], a.pos[2]);
          child.rotation.y = a.yaw ?? 0;
          child.visible = true;
          return null;
        }
      }
    }
    // Jeremy u otros: clon del asset
    const rig = Assets.rigs.get(a.id);
    if (rig) {
      const clone = rig.root.clone(true);
      clone.position.set(a.pos[0], a.pos[1], a.pos[2]);
      clone.rotation.y = a.yaw ?? 0;
      this.world.scene.add(clone);
      return clone;
    }
    return null;
  }

  private applyShot() {
    const shot = this.shots[this.idx];
    if (!shot) return;
    this.cinePos.set(shot.pos[0], shot.pos[1], shot.pos[2]);
    this.cineLook.set(shot.look[0], shot.look[1], shot.look[2]);
    this.camera.position.copy(this.cinePos);
    this.camera.lookAt(this.cineLook);
    useHud.getState().syncHud({ cinematicText: this.currentText });
  }

  /** saltar toma actual */
  skip() {
    if (!this.active) return;
    this.nextShot();
  }

  private nextShot() {
    this.idx++;
    if (this.idx >= this.shots.length) {
      this.stop(true);
      return;
    }
    this.t = 0;
    this.applyShot();
  }

  stop(fireEnd: boolean) {
    if (!this.active) return;
    this.active = false;
    // restaurar animatrónicos movidos y quitar clones
    for (const s of this.savedPositions) {
      s.obj.position.copy(s.pos);
      s.obj.rotation.y = s.yaw;
      s.obj.visible = s.visible;
    }
    this.savedPositions = [];
    for (const a of this.placedActors) {
      this.world.scene.remove(a);
    }
    this.placedActors = [];
    useHud.getState().syncHud({ cinematic: false, cinematicText: null });
    const cb = this.onEnd;
    this.onEnd = null;
    if (fireEnd && cb) cb();
  }

  update(dt: number) {
    if (!this.active) return;
    this.t += dt;
    const shot = this.shots[this.idx];
    if (!shot) return;
    // travelling suave: empuje lento hacia el punto de interés (dolly in)
    const k = Math.min(1, this.t / shot.dur);
    const ease = k * k * (3 - 2 * k);
    const dir = this.cineLook.clone().sub(this.cinePos);
    dir.y = 0;
    if (dir.lengthSq() > 0.0001) {
      dir.normalize().multiplyScalar(ease * 0.55);
    }
    this.camera.position.copy(this.cinePos).add(dir);
    // pequeña respiración de cámara
    this.camera.position.y += Math.sin(this.t * 1.2) * 0.01;
    this.camera.lookAt(this.cineLook);
    if (this.t >= shot.dur) {
      this.nextShot();
    }
  }

  get progress(): number {
    if (!this.active || !this.shots.length) return 0;
    return (this.idx + Math.min(1, this.t / (this.shots[this.idx]?.dur ?? 1))) / this.shots.length;
  }
}
