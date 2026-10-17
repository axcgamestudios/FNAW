/**
 * MEGA GUARDERÍA EN LLAMAS — sistema de efectos de fuego (v7).
 *
 * Zonas de fuego con partículas (llamas + brasas + humo), pool de luces
 * reales que persigue las zonas activas más cercanas, colisiones de
 * barrera (el jugador NO puede atravesarlas; Luna sí: son "spectral"
 * para la rejilla de navegación) y extinción con vapor al usar el
 * extintor correspondiente.
 *
 * Las posiciones de extintores y zonas son la FUENTE ÚNICA para
 * props.ts (modelos) y trials.json (tareas) — deben coincidir.
 */
import * as THREE from 'three';
import type { WorldBuilder } from './worldbuilder';

/* ============ DEFINICIÓN DE ZONAS ============ */

export interface FireZoneDef {
  id: string;
  /** centro de las llamas */
  x: number;
  z: number;
  /** radio de las llamas (visual) */
  size: number;
  /** ¿barrera física que bloquea al jugador? (las de tarea) */
  barrier?: { w: number; d: number };
  /** ¿zona decorativa (sin tarea)? */
  decor?: boolean;
}

/** Extintores de la Mega Guardería — [x, z, rotY] (mismos que trials.json v7) */
export const MEGA_EXTINTORES: Array<[number, number, number]> = [
  [-30.0, -41.2, Math.PI / 2],   // e1: base del castillo oeste
  [-38.0, -56.0, 0],             // e2: rincón noroeste
  [-16.0, -46.2, Math.PI / 2],   // e3: lado oeste de la alberca
  [2.0, -58.6, Math.PI],         // e4: fondo centro-norte (piano)
  [18.0, -43.0, -Math.PI / 2],   // e5: lado este de la alberca
  [34.0, -46.2, Math.PI / 2],    // e6: ala este (carrusel)
  [24.0, -59.2, Math.PI],        // e7: rincón noreste
];

/** Zonas de fuego: 7 de tarea (con barrera) + decorativas */
export const MEGA_FIRE_ZONES: FireZoneDef[] = [
  { id: 'e1', x: -30.0, z: -38.6, size: 2.4, barrier: { w: 6.5, d: 1.7 } },
  { id: 'e2', x: -34.2, z: -56.0, size: 2.6, barrier: { w: 1.7, d: 7.5 } },
  { id: 'e3', x: -16.0, z: -42.8, size: 2.4, barrier: { w: 7.0, d: 1.7 } },
  { id: 'e4', x: 2.0, z: -54.2, size: 2.5, barrier: { w: 7.0, d: 1.7 } },
  { id: 'e5', x: 18.0, z: -46.6, size: 2.4, barrier: { w: 7.0, d: 1.7 } },
  { id: 'e6', x: 30.2, z: -46.2, size: 2.5, barrier: { w: 1.7, d: 7.5 } },
  { id: 'e7', x: 24.0, z: -55.4, size: 2.4, barrier: { w: 7.0, d: 1.7 } },
  // decorativas: iluminan y asfixian la sala
  { id: 'd1', x: -43.2, z: -40, size: 1.8, decor: true },
  { id: 'd2', x: -6.0, z: -60.6, size: 2.2, decor: true },
  { id: 'd3', x: 14.0, z: -60.4, size: 2.0, decor: true },
  { id: 'd4', x: 40.2, z: -52, size: 2.2, decor: true },
  { id: 'd5', x: 6.0, z: -40.5, size: 1.9, decor: true },
  { id: 'd6', x: -24.0, z: -60.6, size: 2.0, decor: true },
  { id: 'd7', x: 38.0, z: -36.5, size: 1.7, decor: true },
];

/* ============ TEXTURAS CANVAS ============ */

function flameTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  grd.addColorStop(0, 'rgba(255,255,240,1)');
  grd.addColorStop(0.25, 'rgba(255,220,120,0.95)');
  grd.addColorStop(0.55, 'rgba(255,120,30,0.6)');
  grd.addColorStop(1, 'rgba(120,20,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function smokeTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  for (const [cx, cy, r, a] of [[64, 70, 46, 0.16], [46, 60, 30, 0.18], [84, 58, 32, 0.15], [64, 46, 24, 0.12]] as Array<[number, number, number, number]>) {
    const grd = g.createRadialGradient(cx, cy, 2, cx, cy, r);
    grd.addColorStop(0, `rgba(200,200,205,${a})`);
    grd.addColorStop(1, 'rgba(200,200,205,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

let _flameTex: THREE.Texture | null = null;
let _smokeTex: THREE.Texture | null = null;
function getFlameTex() { return (_flameTex ??= flameTexture()); }
function getSmokeTex() { return (_smokeTex ??= smokeTexture()); }
/** textura de humo compartida para props (capa flotante de la sala) */
export function sharedSmokeTexture(): THREE.Texture { return getSmokeTex(); }

/* ============ SISTEMA ============ */

type ZoneState = 'off' | 'lit' | 'dying';

interface FireZone {
  def: FireZoneDef;
  group: THREE.Group;
  state: ZoneState;
  fade: number;          // 1 vivo → 0 apagado
  steamT: number;        // >0: chorro de vapor tras extinguir
  phase: number;
  // partículas
  flames: THREE.Points;
  flameVel: Float32Array;
  flameLife: Float32Array;
  embers: THREE.Points;
  emberVel: Float32Array;
  smokes: THREE.Sprite[];
  glow: THREE.Mesh;
  colliderId?: string;
}

export class FireSystem {
  world: WorldBuilder;
  zones: FireZone[] = [];
  /** ¿sistema habilitado? (solo capítulo 4 con prueba pendiente) */
  enabled = false;
  /** luces reales: pool de N persiguiendo las zonas más cercanas */
  private lightPool: THREE.PointLight[] = [];
  private lightHolder: THREE.Group;
  private root: THREE.Group;
  private t = 0;

  constructor(world: WorldBuilder) {
    this.world = world;
    this.root = new THREE.Group();
    world.root.add(this.root);
    for (const def of MEGA_FIRE_ZONES) this.buildZone(def);
    // pool de luces NO añadidas a la escena hasta activarse: cada luz extra
    // en el grafo recompila todos los shaders — en el arranque costaría caro
    this.lightHolder = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const l = new THREE.PointLight(0xff7726, 0, 17, 2.0);
      l.castShadow = false;
      this.lightHolder.add(l);
      this.lightPool.push(l);
    }
    this.setEnabled(false);
  }

  private buildZone(def: FireZoneDef) {
    const group = new THREE.Group();
    group.position.set(def.x, 0, def.z);
    const N = def.decor ? 26 : 42;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(N * 3);
    const col = new Float32Array(N * 3);
    const vel = new Float32Array(N * 2);
    const life = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      life[i] = Math.random();
      this.seedParticle(pos, vel, life, i, def.size);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({
      size: def.decor ? 1.0 : 1.25,
      map: getFlameTex(),
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });
    const flames = new THREE.Points(geo, mat);
    flames.frustumCulled = false;
    group.add(flames);

    // brasas
    const EN = def.decor ? 10 : 16;
    const eGeo = new THREE.BufferGeometry();
    const ePos = new Float32Array(EN * 3);
    const eCol = new Float32Array(EN * 3);
    const eVel = new Float32Array(EN * 2);
    for (let i = 0; i < EN; i++) {
      ePos[i * 3] = (Math.random() - 0.5) * def.size;
      ePos[i * 3 + 1] = Math.random() * 2;
      ePos[i * 3 + 2] = (Math.random() - 0.5) * def.size;
      eVel[i * 2] = (Math.random() - 0.5) * 0.5;
      eVel[i * 2 + 1] = 2.2 + Math.random() * 1.8;
      eCol[i * 3] = 1; eCol[i * 3 + 1] = 0.55 + Math.random() * 0.3; eCol[i * 3 + 2] = 0.15;
    }
    eGeo.setAttribute('position', new THREE.BufferAttribute(ePos, 3));
    eGeo.setAttribute('color', new THREE.BufferAttribute(eCol, 3));
    const embers = new THREE.Points(eGeo, new THREE.PointsMaterial({
      size: 0.09, vertexColors: true, transparent: true, opacity: 0.95,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
    }));
    embers.frustumCulled = false;
    group.add(embers);

    // humo (sprites)
    const smokes: THREE.Sprite[] = [];
    for (let i = 0; i < (def.decor ? 2 : 3); i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: getSmokeTex(), color: 0x2a2523, transparent: true, opacity: 0.32,
        depthWrite: false, rotation: Math.random() * Math.PI,
      }));
      s.position.set((Math.random() - 0.5) * def.size, 1.6 + Math.random() * 1.5, (Math.random() - 0.5) * def.size);
      s.scale.setScalar(2.2 + Math.random() * 1.6);
      s.userData.baseY = s.position.y;
      group.add(s);
      smokes.push(s);
    }

    // charco de luz en el suelo (aditivo, coste 0)
    const glow = new THREE.Mesh(
      new THREE.CircleGeometry(def.size * 2.1, 20),
      new THREE.MeshBasicMaterial({
        color: 0xff5a18, transparent: true, opacity: 0.22,
        blending: THREE.AdditiveBlending, depthWrite: false,
      })
    );
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.05;
    group.add(glow);

    // barrera física SOLO para el jugador (la rejilla de nav la ignora:
    // prefijo vent_cover_ → Luna atraviesa el fuego sin quemarse)
    let colliderId: string | undefined;
    if (def.barrier) {
      const b = def.barrier;
      const box = new THREE.Box3(
        new THREE.Vector3(def.x - b.w / 2, 0, def.z - b.d / 2),
        new THREE.Vector3(def.x + b.w / 2, 3.2, def.z + b.d / 2)
      );
      colliderId = `vent_cover_fire_${def.id}`;
      this.world.addCollider(box, colliderId, true);
    }

    this.root.add(group);
    this.zones.push({
      def, group, state: 'lit', fade: 1, steamT: 0,
      phase: Math.random() * Math.PI * 2,
      flames, flameVel: vel, flameLife: life,
      embers, emberVel: eVel, smokes, glow, colliderId,
    });
  }

  private seedParticle(pos: Float32Array, vel: Float32Array, life: Float32Array, i: number, size: number) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * size * 0.7;
    pos[i * 3] = Math.cos(a) * r;
    pos[i * 3 + 1] = Math.random() * 0.5;
    pos[i * 3 + 2] = Math.sin(a) * r;
    vel[i * 2] = (Math.random() - 0.5) * 0.4;
    vel[i * 2 + 1] = 1.5 + Math.random() * 1.9;
    life[i] = 0.5 + Math.random() * 0.7;
  }

  /* ---- control de estado ---- */

  setEnabled(on: boolean) {
    this.enabled = on;
    this.root.visible = on;
    // las luces solo viven en el grafo de escena mientras arde
    if (on) {
      if (!this.lightHolder.parent) this.world.root.add(this.lightHolder);
    } else {
      if (this.lightHolder.parent) this.lightHolder.parent.remove(this.lightHolder);
      for (const l of this.lightPool) l.intensity = 0;
    }
    for (const z of this.zones) {
      if (!on) {
        z.state = 'off';
        z.fade = 0;
        this.setCollider(z, false);
      }
    }
    if (!on) for (const l of this.lightPool) l.intensity = 0;
  }

  begin() {
    this.setEnabled(true);
    for (const z of this.zones) {
      z.state = 'lit';
      z.fade = 1;
      z.steamT = 0;
      z.group.visible = true;
      this.setCollider(z, !!z.def.barrier);
    }
  }

  extinguish(id: string) {
    const z = this.zones.find((q) => q.def.id === id);
    if (!z || z.state !== 'lit') return;
    z.state = 'dying';
    z.steamT = 1.4;
    this.setCollider(z, false);
    // el vapor pinta el humo de blanco un instante
    this.turnSteam(z);
  }

  /** apaga TODAS las zonas (victoria: el infierno se apaga) */
  extinguishAll() {
    for (const z of this.zones) {
      if (z.state !== 'lit') continue;
      z.state = 'dying';
      z.steamT = 1.6;
      this.setCollider(z, false);
      this.turnSteam(z);
    }
  }

  private turnSteam(z: FireZone) {
    for (const s of z.smokes) {
      (s.material as THREE.SpriteMaterial).color.setHex(0xd8dde2);
      (s.material as THREE.SpriteMaterial).opacity = 0.55;
    }
  }

  /** ¿ardiendo? (para música/ambiente/daño) */
  get burning(): boolean {
    return this.zones.some((z) => z.state === 'lit');
  }

  /** calor del núcleo en un punto (0..1) — para daño al jugador */
  hazardAt(x: number, z: number): number {
    let h = 0;
    for (const q of this.zones) {
      if (q.state !== 'lit') continue;
      const core = q.def.size * 0.62;
      const d = Math.hypot(x - q.def.x, z - q.def.z);
      if (d < core) h = Math.max(h, 1 - d / core);
    }
    return h;
  }

  private setCollider(z: FireZone, active: boolean) {
    if (!z.colliderId) return;
    const c = this.world.colliders.find((q) => q.id === z.colliderId);
    if (c) c.active = active;
  }

  /* ---- animación ---- */

  update(dt: number, focus: THREE.Vector3) {
    if (!this.enabled) return;
    this.t += dt;
    const t = this.t;
    for (const z of this.zones) {
      if (z.state === 'off') continue;
      if (z.state === 'dying') {
        z.fade = Math.max(0, z.fade - dt * 0.55);
        if (z.fade <= 0 && z.steamT <= 0) {
          z.state = 'off';
          z.group.visible = false;
          continue;
        }
      }
      const f = z.state === 'lit' ? 1 : z.fade;
      // llamas
      const posAttr = z.flames.geometry.getAttribute('position') as THREE.BufferAttribute;
      const colAttr = z.flames.geometry.getAttribute('color') as THREE.BufferAttribute;
      const pos = posAttr.array as Float32Array;
      const col = colAttr.array as Float32Array;
      const N = pos.length / 3;
      for (let i = 0; i < N; i++) {
        z.flameLife[i] -= dt;
        pos[i * 3] += z.flameVel[i * 2] * dt + Math.sin(t * 7 + i * 2.3 + z.phase) * 0.14 * dt;
        pos[i * 3 + 1] += z.flameVel[i * 2 + 1] * dt;
        pos[i * 3 + 2] += z.flameVel[i * 2 + 1] * 0 + Math.cos(t * 6 + i * 1.7 + z.phase) * 0.14 * dt;
        const lifeT = z.flameLife[i];
        if (lifeT <= 0 || pos[i * 3 + 1] > 3.4) {
          this.seedParticle(pos, z.flameVel, z.flameLife, i, z.def.size);
        }
        // color: blanco-amarillo al nacer → rojo oscuro al morir
        const k = Math.max(0, Math.min(1, lifeT));
        col[i * 3] = 0.55 + k * 0.45 * f;
        col[i * 3 + 1] = (0.08 + k * 0.62) * f;
        col[i * 3 + 2] = 0.02 * f;
      }
      posAttr.needsUpdate = true;
      colAttr.needsUpdate = true;
      (z.flames.material as THREE.PointsMaterial).opacity = 0.95 * f;
      // brasas
      const ePosAttr = z.embers.geometry.getAttribute('position') as THREE.BufferAttribute;
      const ePos = ePosAttr.array as Float32Array;
      const EN = ePos.length / 3;
      for (let i = 0; i < EN; i++) {
        ePos[i * 3] += z.emberVel[i * 2] * dt + Math.sin(t * 5 + i) * 0.2 * dt;
        ePos[i * 3 + 1] += z.emberVel[i * 2 + 1] * dt;
        if (ePos[i * 3 + 1] > 6.5) {
          ePos[i * 3] = (Math.random() - 0.5) * z.def.size;
          ePos[i * 3 + 1] = 0.2;
          ePos[i * 3 + 2] = (Math.random() - 0.5) * z.def.size;
        }
      }
      ePosAttr.needsUpdate = true;
      (z.embers.material as THREE.PointsMaterial).opacity = 0.95 * f;
      // humo
      for (const s of z.smokes) {
        const baseY = (s.userData.baseY as number) ?? 2;
        s.position.y += dt * 0.32;
        if (s.position.y > baseY + 2.6) s.position.y = baseY - 0.8;
        const m = s.material as THREE.SpriteMaterial;
        m.rotation += dt * 0.22;
        if (z.steamT > 0) {
          z.steamT -= dt;
          s.scale.setScalar(Math.min(7.5, s.scale.x + dt * 3.2));
          if (z.steamT <= 0) {
            m.color.setHex(0x2a2523);
            m.opacity = 0.3;
          } else {
            m.opacity = Math.max(0, 0.5 * (z.steamT / 1.4));
          }
        } else if (z.state === 'lit') {
          s.scale.setScalar(Math.min(5.5, 2.4 + (s.position.y - baseY + 0.8) * 1.1));
          m.opacity = 0.3 * f;
        }
      }
      // charco de luz pulsante
      const gm = z.glow.material as THREE.MeshBasicMaterial;
      gm.opacity = (0.16 + Math.sin(t * 9 + z.phase) * 0.07) * f;
    }

    // pool de luces: 4 luces → zonas LIT más cercanas al foco
    const lit = this.zones.filter((z) => z.state === 'lit' || (z.state === 'dying' && z.fade > 0.15));
    lit.sort((a, b) => {
      const da = (a.def.x - focus.x) ** 2 + (a.def.z - focus.z) ** 2;
      const db = (b.def.x - focus.x) ** 2 + (b.def.z - focus.z) ** 2;
      return da - db;
    });
    for (let i = 0; i < this.lightPool.length; i++) {
      const l = this.lightPool[i];
      const z = lit[i];
      if (!z) { l.intensity = 0; continue; }
      l.position.set(z.def.x, 1.4 + Math.sin(t * 3 + z.phase) * 0.25, z.def.z);
      const flick = 1.35 + Math.sin(t * 13 + z.phase) * 0.45 + Math.sin(t * 29 + z.phase * 2) * 0.25;
      l.intensity = flick * (z.state === 'dying' ? z.fade : 1);
    }
  }
}

/** instancia global de la Mega Guardería en llamas (creada por props) */
export let MEGA_FIRE: FireSystem | null = null;
export function setMegaFire(f: FireSystem | null) { MEGA_FIRE = f; }
