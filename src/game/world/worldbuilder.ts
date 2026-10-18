/**
 * Constructor del mundo: MEGAPLEX Complejo Bruno (estilo Security Breach).
 * Muros definidos en map.json (con huecos y alturas por tramo), techos por
 * sala, atrio de 9 m, puertas con bisagra, conductos, colisiones AABB,
 * registro de salas y luces con parpadeo.
 *
 * v8 — PUERTAS RECONSTRUIDAS: marco real (jambas + dintel + umbral) fijado al
 * muro, hoja detallada por material con pivote EXACTO en el canto del hueco
 * (bug de origen: las puertas en muro-Z quedaban incrustadas en el muro),
 * dirección de giro determinista (siempre hacia la sala B) y animación con
 * desaceleración suave gestionada desde game.ts mediante baseAngle/swing.
 * v8 — ZÓCALOS Y REMATES 3D reales fusionados en 1-2 mallas para todo el mapa.
 * v8 — CONDUCTOS con hueco real en el muro (map.json) y túnel de rastreo.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import mapData from '@/data/map.json';
import type { RoomDef, DoorDef, VentDef, Interactable, WallDef } from '../core/types';
import { floorMaterials, wallMaterials, ceilingMaterial, darkMetalMaterial, metalMaterial, woodMaterial } from './materials';
import { buildProps, type AnchorMap, type PropAnim } from './props';

export interface WallOpening {
  at: number;
  width: number;
  height?: number; // altura del hueco; por encima se construye dintel
}

interface WallSpec {
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  wallType: RoomDef['wall'];
  h: number;
  openings?: WallOpening[];
}

export interface Collider {
  box: THREE.Box3;
  active: boolean;
  id?: string;
  tall: boolean; // true = colisión total (no saltable)
}

export interface DoorRT {
  def: DoorDef;
  group: THREE.Group;
  open: boolean;
  targetAngle: number;
  angle: number;
  /** ángulo de CERRADO (0 para muro-X, PI/2 para muro-Z) */
  baseAngle: number;
  /** sentido de giro determinista: +1 / -1 (hacia la sala B) */
  swing: number;
  /** amplitud de apertura en radianes (~110°) */
  openAngle: number;
  collider: Collider;
  locked: boolean;
  code?: string;
  isSecret: boolean;
  opening: boolean;
  lastToggle: number;
}

export interface VentRT {
  def: VentDef;
  coverMesh?: THREE.Mesh;
  coverClosed: boolean;
  coverTimer: number;
  coverCollider?: Collider;
  blocked: boolean;
  bangTimer: number;
}

export interface RoomRT {
  def: RoomDef;
  center: THREE.Vector3;
  lightLevel: number; // intensidad actual (asignada por el pool de luces)
  lightBase: number;
  lightColor: number;
  flicker: number;
  lightOn: boolean;
  fixture: THREE.Mesh | null;
  blackoutTimer: number;
}

/** definición de luz decorativa registrada por los props (las gestiona el pool) */
export interface AccentLightDef {
  pos: THREE.Vector3;
  target?: THREE.Vector3;
  color: number;
  intensity: number;
  distance: number;
  angle?: number;
  penumbra?: number;
  decay?: number;
  spot?: boolean;
}

const WALL_T = 0.3;
const DOOR_H = 2.15;

/** salas con luz encendida al empezar la noche (el resto: fundida) */
const LIGHTS_ON_DEFAULT = new Set(['office']);

type MapData = typeof mapData;

export class WorldBuilder {
  scene: THREE.Scene;
  root = new THREE.Group();
  rooms = new Map<string, RoomRT>();
  doors = new Map<string, DoorRT>();
  vents = new Map<string, VentRT>();
  colliders: Collider[] = [];
  interactables: Interactable[] = [];
  anchors: AnchorMap = new Map();
  propAnims: PropAnim[] = [];
  /** luces decorativas registradas por los props (las materializa el pool) */
  accents: AccentLightDef[] = [];
  /** modo visión de cámara: la sala del feed recibe un impulso de luz tenue */
  camView = false;
  /* ============ POOL DE LUCES ============
   * Un número FIJO de luces reales se reubica cada frame a las salas
   * encendidas más cercanas. Nº de luces constante = shaders estables
   * (sin recompilaciones ni límites de uniforms). */
  private roomPool: THREE.PointLight[] = [];
  private emergencyPool: THREE.PointLight | null = null;
  private accentPointPool: THREE.PointLight | null = null;
  private accentSpotPool: THREE.SpotLight[] = [];
  private stageSpot: THREE.SpotLight | null = null;
  private roomList: RoomRT[] = [];
  private emPositions: Array<[number, number]> = [
    [-37.5, 21.5], [0, 15.5], [-30, -20.5], [30, -20.5],
    [0, 6], [-36, 5], [24, 26], [-25.5, 21],
  ];
  private clock = 0;
  private power = 1;
  /* geometría de remates acumulada: zócalos + pilastras (1 malla al final) */
  private trimGeos: THREE.BufferGeometry[] = [];
  /* coronación superior de muros de papel pintado (otra malla) */
  private crownGeos: THREE.BufferGeometry[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    scene.add(this.root);
  }

  get map(): MapData {
    return mapData as unknown as MapData;
  }

  roomAt(x: number, z: number): RoomRT | null {
    for (const r of this.rooms.values()) {
      const [x1, z1, x2, z2] = r.def.rect;
      if (x >= x1 - 0.3 && x <= x2 + 0.3 && z >= z1 - 0.3 && z <= z2 + 0.3) return r;
    }
    return null;
  }

  roomIdAt(x: number, z: number): string {
    return this.roomAt(x, z)?.def.id ?? '';
  }

  /** Altura del suelo: tarima del escenario del atrio con rampa frontal */
  floorHeightAt(x: number, z: number): number {
    // escenario del atrio: x[-7,7] z[-9,-5], plataforma 0.7 con rampa z[-5,-4.2]
    if (x > -7 && x < 7 && z > -9 && z < -4.2) {
      if (z < -5) return 0.7;
      const t = (-4.2 - z) / 0.8; // 0 en el borde sur, 1 al llegar a -5
      return 0.7 * Math.max(0, Math.min(1, t));
    }
    return 0;
  }

  addCollider(box: THREE.Box3, id?: string, tall = true): Collider {
    const c: Collider = { box, active: true, id, tall };
    this.colliders.push(c);
    return c;
  }

  buildAll(onProgress: (frac: number, label: string) => void) {
    onProgress(0.1, 'Cimentando el MEGAPLEX...');
    this.buildFloorsAndCeilings();
    onProgress(0.3, 'Levantando paredes...');
    this.buildWalls();
    onProgress(0.5, 'Colgando puertas...');
    this.buildDoors();
    onProgress(0.65, 'Instalando conductos...');
    this.buildVents();
    onProgress(0.8, 'Montando las atracciones...');
    buildProps(this);
    onProgress(1, 'Encendiendo las luces...');
    this.buildLights();
  }

  /* ================= SUELOS Y TECHOS ================= */

  private buildFloorsAndCeilings() {
    for (const r of this.map.rooms as RoomDef[]) {
      const [x1, z1, x2, z2] = r.rect;
      const w = x2 - x1;
      const d = z2 - z1;
      const h = r.height ?? 3.6;
      const mat = floorMaterials[r.floor]([Math.max(1, w / 2.6), Math.max(1, d / 2.6)]);
      const floor = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, d), mat);
      floor.position.set((x1 + x2) / 2, -0.05, (z1 + z2) / 2);
      floor.receiveShadow = true;
      floor.name = `floor_${r.id}`;
      this.root.add(floor);

      // techo por sala (a su altura)
      const ceil = new THREE.Mesh(
        new THREE.PlaneGeometry(w, d),
        ceilingMaterial([Math.max(1, w / 2.2), Math.max(1, d / 2.2)])
      );
      ceil.rotation.x = Math.PI / 2;
      ceil.position.set((x1 + x2) / 2, h, (z1 + z2) / 2);
      ceil.receiveShadow = true;
      this.root.add(ceil);

      this.rooms.set(r.id, {
        def: r,
        center: new THREE.Vector3((x1 + x2) / 2, 0, (z1 + z2) / 2),
        lightLevel: 0,
        lightBase: r.ambientLight?.intensity ?? 0.45,
        lightColor: r.ambientLight?.color ?? 0xffd9a8,
        flicker: r.ambientLight?.flicker ?? 0.08,
        lightOn: true,
        fixture: null,
        blackoutTimer: 0,
      });
    }
    // Techo del hueco de la puerta de salida (último tramo sur, lóbulo del lobby)
    // (el lobby ya tiene techo propio a 6 m)
  }

  /* ================= PAREDES ================= */

  private wallSpecs(): WallSpec[] {
    return (this.map.walls as WallDef[]).map((w) => ({
      x1: w.x1,
      z1: w.z1,
      x2: w.x2,
      z2: w.z2,
      wallType: w.wallType,
      h: w.h ?? (this.map.building.wallHeight || 4.2),
      openings: (w.openings ?? []).map((o) => ({ at: o.at, width: o.width, height: o.height ?? DOOR_H })),
    }));
  }

  private buildWalls() {
    for (const spec of this.wallSpecs()) {
      this.buildWall(spec);
    }
    // pilares del portal sur del atrio (junto a la gran arcada)
    for (const px of [-5.5, 5.5]) {
      const pillar = new THREE.Mesh(
        new THREE.BoxGeometry(0.55, 9, 0.55),
        wallMaterials.wallpaper([0.5, 3])
      );
      pillar.position.set(px, 4.5, 13);
      pillar.castShadow = true;
      pillar.receiveShadow = true;
      (pillar.userData as { castShadow?: boolean }).castShadow = true;
      this.root.add(pillar);
      this.addCollider(
        new THREE.Box3(new THREE.Vector3(px - 0.28, 0, 12.72), new THREE.Vector3(px + 0.28, 9, 13.28)),
        `pillar_${px}`
      );
    }
    this.buildTrimMeshes();
  }

  /** materializa los remates acumulados en 1-2 mallas fusionadas */
  private buildTrimMeshes() {
    const trimMat = this.frameMaterial(false);
    if (this.trimGeos.length) {
      const mesh = new THREE.Mesh(mergeGeometries(this.trimGeos, false)!, trimMat);
      mesh.receiveShadow = true;
      this.root.add(mesh);
      this.trimGeos = [];
    }
    if (this.crownGeos.length) {
      const cm = trimMat.clone();
      cm.color = new THREE.Color(0x55402a);
      const mesh = new THREE.Mesh(mergeGeometries(this.crownGeos, false)!, cm);
      mesh.receiveShadow = true;
      this.root.add(mesh);
      this.crownGeos = [];
    }
  }

  private buildWall(spec: WallSpec) {
    const alongX = Math.abs(spec.z2 - spec.z1) < 0.001;
    const a = alongX ? Math.min(spec.x1, spec.x2) : Math.min(spec.z1, spec.z2);
    const b = alongX ? Math.max(spec.x1, spec.x2) : Math.max(spec.z1, spec.z2);
    const fixed = alongX ? spec.z1 : spec.x1;
    const H = spec.h;
    const openings = (spec.openings ?? []).slice().sort((o1, o2) => o1.at - o2.at);
    // el remate fino solo en zonas públicas (no en la mega guardería calcinada)
    const decorated = spec.wallType === 'wallpaper' || spec.wallType === 'tile';

    const mat = wallMaterials[spec.wallType]([Math.max(0.5, (b - a) / 2.4), H / 2.4]);

    /* zócalo 3D a lo largo del tramo sólido (ambas caras), fusionado al final */
    const baseboard = (from: number, to: number) => {
      if (!decorated || to - from < 0.3) return;
      const len = to - from;
      const hgt = 0.16;
      const dep = 0.05;
      for (const s of [1, -1]) {
        const cx = alongX ? (from + to) / 2 : fixed + s * (WALL_T / 2 + dep / 2 - 0.01);
        const cz = alongX ? fixed + s * (WALL_T / 2 + dep / 2 - 0.01) : (from + to) / 2;
        const g = new THREE.BoxGeometry(alongX ? len : dep, hgt, alongX ? dep : len);
        g.translate(cx, hgt / 2, cz);
        this.trimGeos.push(g);
      }
    };
    /* cornisa superior en muros de papel pintado */
    const crown = (from: number, to: number) => {
      if (spec.wallType !== 'wallpaper' || to - from < 0.3) return;
      const len = to - from;
      const dep = 0.04;
      for (const s of [1, -1]) {
        const cx = alongX ? (from + to) / 2 : fixed + s * (WALL_T / 2 + dep / 2 - 0.005);
        const cz = alongX ? fixed + s * (WALL_T / 2 + dep / 2 - 0.005) : (from + to) / 2;
        const g = new THREE.BoxGeometry(alongX ? len : dep, 0.1, alongX ? dep : len);
        g.translate(cx, H - 0.05, cz);
        this.crownGeos.push(g);
      }
    };
    /* pilastra marcando cada lado de las aperturas grandes (puertas/arcos) */
    const pilaster = (at: number, w: number) => {
      if (!decorated || w < 0.8) return;
      const dep = WALL_T + 0.1;
      for (const edge of [at - w / 2, at + w / 2]) {
        const c = edge;
        const g = new THREE.BoxGeometry(alongX ? 0.16 : dep, H, alongX ? dep : 0.16);
        g.translate(alongX ? c : fixed, H / 2, alongX ? fixed : c);
        this.trimGeos.push(g);
      }
    };

    const solid = (from: number, to: number) => {
      if (to - from < 0.05) return;
      const len = to - from;
      const cx = alongX ? (from + to) / 2 : fixed;
      const cz = alongX ? fixed : (from + to) / 2;
      const geo = new THREE.BoxGeometry(alongX ? len : WALL_T, H, alongX ? WALL_T : len);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(cx, H / 2, cz);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      (mesh.userData as { castShadow?: boolean }).castShadow = true;
      this.root.add(mesh);
      baseboard(from, to);
      crown(from, to);
      this.addCollider(
        new THREE.Box3(
          new THREE.Vector3(cx - (alongX ? len / 2 : WALL_T / 2 + 0.02), 0, cz - (alongX ? WALL_T / 2 + 0.02 : len / 2)),
          new THREE.Vector3(cx + (alongX ? len / 2 : WALL_T / 2 + 0.02), H, cz + (alongX ? WALL_T / 2 + 0.02 : len / 2))
        ),
        undefined,
        true
      );
    };

    const lintel = (from: number, to: number, h: number) => {
      if (H - h < 0.1) return;
      const len = to - from;
      const cx = alongX ? (from + to) / 2 : fixed;
      const cz = alongX ? fixed : (from + to) / 2;
      const geo = new THREE.BoxGeometry(alongX ? len : WALL_T, H - h, alongX ? WALL_T : len);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(cx, h + (H - h) / 2, cz);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      (mesh.userData as { castShadow?: boolean }).castShadow = true;
      this.root.add(mesh);
    };

    /* manga de conducto: reviste el hueco pequeño a través del muro */
    const ventSleeve = (op: { at: number; width: number; height: number }) => {
      const sleeveMat = darkMetalMaterial([1.4, 0.4]);
      const geos: THREE.BufferGeometry[] = [];
      const t = 0.04;
      const wIn = op.width - 0.06;
      const hIn = op.height - 0.06;
      const depth = WALL_T + 0.02;
      const inner = (bw: number, bh: number, bx: number, by: number, bd: number) => {
        const g = new THREE.BoxGeometry(alongX ? bw : bd, bh, alongX ? bd : bw);
        g.translate(alongX ? bx : fixed, by, alongX ? fixed : bx);
        geos.push(g);
      };
      // paredes interiores del túnel (suelo, techo y laterales)
      inner(wIn, t, op.at, t / 2, depth);
      inner(wIn, t, op.at, hIn - t / 2, depth);
      for (const s of [1, -1]) {
        inner(t, hIn, op.at + s * (wIn / 2 - t / 2), hIn / 2, depth);
      }
      // bridas (aletas) en ambas caras del muro
      const fw = op.width + 0.1;
      const fh = op.height + 0.08;
      for (const s of [1, -1]) {
        const g = new THREE.BoxGeometry(alongX ? fw : 0.06, fh, alongX ? 0.06 : fw);
        g.translate(alongX ? op.at : fixed + s * (WALL_T / 2 + 0.03), fh / 2, alongX ? fixed + s * (WALL_T / 2 + 0.03) : op.at);
        geos.push(g);
      }
      const mesh = new THREE.Mesh(mergeGeometries(geos, false)!, sleeveMat);
      mesh.receiveShadow = true;
      (mesh.userData as { castShadow?: boolean }).castShadow = true;
      this.root.add(mesh);
    };

    let cursor = a;
    for (const op of openings) {
      const oStart = op.at - op.width / 2;
      const oEnd = op.at + op.width / 2;
      if (oStart > cursor + 0.02) solid(cursor, oStart);
      lintel(oStart, oEnd, op.height ?? DOOR_H);
      if ((op.height ?? DOOR_H) <= 1.3) {
        // hueco de conducto: túnel revestido en vez de muro ciego
        ventSleeve({ at: op.at, width: op.width, height: op.height ?? DOOR_H });
      } else {
        pilaster(op.at, op.width);
      }
      cursor = oEnd;
    }
    if (cursor < b - 0.02) solid(cursor, b);
  }

  /* ================= PUERTAS (v8 — reconstruidas desde cero) ================= */

  /** ancho de jamba que roba hueco a la hoja */
  private static readonly JAMB = 0.085;
  /** grosor de la hoja */
  private static readonly LEAF_T = 0.062;
  /** profundidad del marco (muro 0.3 + 3 cm saliente a cada lado) */
  private static readonly FRAME_D = WALL_T + 0.06;

  private buildDoors() {
    for (const d of this.map.doors as DoorDef[]) {
      this.buildDoor(d);
    }
  }

  /** busca la altura real del hueco de esta puerta en el muro que la contiene */
  private openingHeightOf(d: DoorDef): number {
    for (const spec of this.wallSpecs()) {
      const wallAlongX = Math.abs(spec.z2 - spec.z1) < 0.001;
      if (wallAlongX !== (d.axis === 'x')) continue;
      const fixed = wallAlongX ? spec.z1 : spec.x1;
      const at = wallAlongX ? d.x : d.z;
      const doorFixed = wallAlongX ? d.z : d.x;
      if (Math.abs(fixed - doorFixed) > 0.35) continue;
      const lo = Math.min(
        wallAlongX ? spec.x1 : spec.z1,
        wallAlongX ? spec.x2 : spec.z2
      );
      const hi = Math.max(
        wallAlongX ? spec.x1 : spec.z1,
        wallAlongX ? spec.x2 : spec.z2
      );
      if (at < lo - 0.1 || at > hi + 0.1) continue;
      const op = (spec.openings ?? []).find((o) => Math.abs(o.at - at) < 0.25);
      if (op) return op.height ?? DOOR_H;
    }
    return DOOR_H;
  }

  /** material del marco: metal de servicio o madera lacada */
  private frameMaterial(dark: boolean): THREE.MeshStandardMaterial {
    if (dark) return darkMetalMaterial();
    const base = woodMaterial([0.8, 0.4]);
    const m = base.clone();
    m.color = new THREE.Color(0x6b4a28);
    return m;
  }

  private buildDoor(d: DoorDef) {
    const alongX = d.axis === 'x';
    const isGate = d.id.startsWith('gate_');
    const isFire = d.id.startsWith('door_mega');
    const isExit = d.id === 'door_exit';
    const isMetal = !isGate && !isFire && (
      d.id.includes('electrical') || d.id.includes('generator') || d.id.includes('exit') ||
      d.id.includes('workshop') || d.id.includes('loading') || d.id.includes('freezers') || d.id.includes('pump') ||
      d.id.includes('storageN') || d.id.includes('storageS') || d.id.includes('techS')
    );
    const J = WorldBuilder.JAMB;
    const FD = WorldBuilder.FRAME_D;
    const openH = Math.min(this.openingHeightOf(d), 2.75);
    const leafW = Math.max(0.7, d.width - 2 * J);
    const leafH = Math.max(1.9, Math.min(2.45, openH - 0.07));
    const frameMat = this.frameMaterial(isGate || isMetal || isFire || isExit);

    /* ---------- MARCO FIJO al muro: jambas + cabezal + umbral ---------- */
    const frameGeos: THREE.BufferGeometry[] = [];
    const fbox = (w: number, h: number, dp: number, x: number, y: number, z: number) => {
      const g = new THREE.BoxGeometry(w, h, dp);
      g.translate(x, y, z);
      frameGeos.push(g);
    };
    if (alongX) {
      const jL = d.x - d.width / 2 + J / 2;
      const jR = d.x + d.width / 2 - J / 2;
      fbox(J, openH, FD, jL, openH / 2, d.z);           // jamba oeste
      fbox(J, openH, FD, jR, openH / 2, d.z);           // jamba este
      fbox(d.width, 0.11, FD, d.x, openH + 0.025, d.z); // cabezal bajo el dintel
      fbox(d.width, 0.03, FD, d.x, 0.015, d.z);         // umbral
    } else {
      const jN = d.z - d.width / 2 + J / 2;
      const jS = d.z + d.width / 2 - J / 2;
      fbox(FD, openH, J, d.x, openH / 2, jN);           // jamba norte
      fbox(FD, openH, J, d.x, openH / 2, jS);           // jamba sur
      fbox(FD, 0.11, d.width, d.x, openH + 0.025, d.z); // cabezal
      fbox(FD, 0.03, d.width, d.x, 0.015, d.z);         // umbral
    }
    // bisagra visible en la jamba del pivote (3 nudillos)
    const hingeX = alongX ? d.x - d.width / 2 + J / 2 : d.x;
    const hingeZ = alongX ? d.z : d.z + d.width / 2 - J / 2;
    for (const hy of [0.5, 1.05, 1.6]) {
      if (hy > openH - 0.25) break;
      const g = new THREE.CylinderGeometry(0.035, 0.035, 0.13, 8);
      g.rotateZ(Math.PI / 2);
      if (!alongX) g.rotateY(Math.PI / 2);
      g.translate(hingeX, hy, hingeZ);
      frameGeos.push(g);
    }
    const frameMesh = new THREE.Mesh(mergeGeometries(frameGeos, false)!, frameMat);
    frameMesh.receiveShadow = true;
    (frameMesh.userData as { castShadow?: boolean }).castShadow = true;
    this.root.add(frameMesh);

    /* ---------- HOJA MÓVIL: pivote exacto en el canto del hueco ----------
     * Eje X: pivote en (x0 - w/2 + J, z) rotación base 0 (+X local = +X mundo)
     * Eje Z: pivote en (x, z0 + w/2 - J) rotación base PI/2 (+X local = -Z mundo)
     *   (el bug de origen: la bisagra estaba en el borde bajo, con lo que la
     *    hoja quedaba DENTRO del muro) */
    const g = new THREE.Group();
    if (alongX) {
      g.position.set(d.x - d.width / 2 + J, 0, d.z);
    } else {
      g.position.set(d.x, 0, d.z + d.width / 2 - J);
      g.rotation.y = Math.PI / 2;
    }
    const baseAngle = alongX ? 0 : Math.PI / 2;

    const markShadow = (m: THREE.Mesh) => {
      m.castShadow = true;
      m.receiveShadow = true;
      (m.userData as { castShadow?: boolean }).castShadow = true;
    };
    const leafGeos: THREE.BufferGeometry[] = []; // misma materia que la hoja
    const lbox = (w: number, h: number, dp: number, x: number, y: number, z: number) => {
      const gg = new THREE.BoxGeometry(w, h, dp);
      gg.translate(x, y, z);
      leafGeos.push(gg);
    };

    if (isGate) {
      /* REJA de seguridad: barras + carriles + cerradura */
      const barMat = metalMaterial([0.55, 1]);
      const nBars = Math.max(7, Math.round(leafW / 0.22));
      for (let i = 0; i < nBars; i++) {
        const bx = 0.06 + ((leafW - 0.12) / (nBars - 1)) * i;
        const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, leafH - 0.12, 10), barMat);
        bar.position.set(bx, leafH / 2 + 0.04, 0);
        markShadow(bar);
        g.add(bar);
      }
      for (const hy of [0.35, 0.95, 1.55, Math.min(2.1, leafH - 0.3)]) {
        lbox(leafW - 0.06, 0.075, 0.075, leafW / 2, hy, 0);
      }
      // placa de cerradura + pestillo
      const lock = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.3, 0.13), darkMetalMaterial());
      lock.position.set(leafW - 0.28, 0.95, 0);
      markShadow(lock);
      g.add(lock);
      if (leafGeos.length) {
        const rails = new THREE.Mesh(mergeGeometries(leafGeos, false)!, barMat);
        markShadow(rails);
        g.add(rails);
      }
      // señalización roja de seguridad
      const sign = new THREE.Mesh(
        new THREE.BoxGeometry(0.62, 0.17, 0.05),
        new THREE.MeshStandardMaterial({ color: 0x3a1414, emissive: 0xd84830, emissiveIntensity: 0.8 })
      );
      sign.position.set(leafW / 2, Math.min(2.35, openH - 0.28), 0.07);
      g.add(sign);
    } else if (isFire) {
      /* PUERTA CORTAFUEGO: chapa con nervaduras + barra antipánico */
      const steel = metalMaterial([0.7, 1]);
      lbox(leafW, leafH, WorldBuilder.LEAF_T, leafW / 2, leafH / 2 + 0.05, 0);
      for (const ry of [0.55, 1.15, 1.75]) {
        lbox(leafW - 0.12, 0.09, WorldBuilder.LEAF_T + 0.035, leafW / 2, ry, 0);
      }
      lbox(leafW - 0.3, 0.2, WorldBuilder.LEAF_T + 0.03, leafW / 2, 0.18, 0); // zócalo de empuje
      const plate = new THREE.Mesh(mergeGeometries(leafGeos, false)!, steel);
      markShadow(plate);
      g.add(plate);
      // barra antipánica roja
      const panicMat = new THREE.MeshStandardMaterial({ color: 0x8c1d12, roughness: 0.5, metalness: 0.3 });
      const panic = new THREE.Mesh(new THREE.BoxGeometry(leafW * 0.62, 0.075, 0.1), panicMat);
      panic.position.set(leafW / 2, 1.02, WorldBuilder.LEAF_T / 2 + 0.07);
      markShadow(panic);
      g.add(panic);
      const panic2 = panic.clone();
      panic2.position.z = -WorldBuilder.LEAF_T / 2 - 0.07;
      markShadow(panic2);
      g.add(panic2);
      // letrero cortafuego
      const sign = new THREE.Mesh(
        new THREE.BoxGeometry(0.55, 0.16, 0.05),
        new THREE.MeshStandardMaterial({ color: 0x2a0e08, emissive: 0xd84830, emissiveIntensity: 0.85 })
      );
      sign.position.set(leafW / 2, Math.min(2.1, openH - 0.32), WorldBuilder.LEAF_T / 2 + 0.04);
      g.add(sign);
    } else if (isMetal || isExit) {
      /* PUERTA METÁLICA de servicio: placa + remaches + ventanita + pomo U */
      const steel = metalMaterial([0.65, 1]);
      lbox(leafW, leafH, WorldBuilder.LEAF_T, leafW / 2, leafH / 2 + 0.05, 0);
      // remaches perimetrales
      for (let i = 0; i < 7; i++) {
        const rx = 0.09 + ((leafW - 0.18) / 6) * i;
        for (const ry of [0.22, leafH - 0.18]) {
          const c = new THREE.CylinderGeometry(0.017, 0.017, WorldBuilder.LEAF_T + 0.012, 6);
          c.rotateX(Math.PI / 2);
          c.translate(rx, ry, 0);
          leafGeos.push(c);
        }
      }
      lbox(leafW - 0.16, 0.24, WorldBuilder.LEAF_T + 0.025, leafW / 2, 0.16, 0); // placa antipatada
      const plate = new THREE.Mesh(mergeGeometries(leafGeos, false)!, steel);
      markShadow(plate);
      g.add(plate);
      // ventanilla de malla
      if (isExit || d.width > 1.5) {
        const glass = new THREE.Mesh(
          new THREE.BoxGeometry(leafW * 0.34, 0.42, 0.02),
          new THREE.MeshPhysicalMaterial({ color: 0x14181c, roughness: 0.28, metalness: 0.4, transparent: true, opacity: 0.88 })
        );
        glass.position.set(leafW / 2, Math.min(1.72, leafH - 0.4), WorldBuilder.LEAF_T / 2 + 0.012);
        markShadow(glass);
        g.add(glass);
        const wf = new THREE.Mesh(new THREE.BoxGeometry(leafW * 0.34 + 0.09, 0.5, 0.032), darkMetalMaterial());
        wf.position.set(leafW / 2, Math.min(1.72, leafH - 0.4), WorldBuilder.LEAF_T / 2 + 0.005);
        markShadow(wf);
        g.add(wf);
      }
      // pomo de seguridad (U) por ambas caras
      const handleMat = darkMetalMaterial();
      for (const s of [1, -1]) {
        const h1 = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.05, 0.05), handleMat);
        h1.position.set(leafW - 0.2, 1.02, s * (WorldBuilder.LEAF_T / 2 + 0.055));
        markShadow(h1);
        g.add(h1);
        const h2 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.05), handleMat);
        h2.position.set(leafW - 0.2, 1.07, s * (WorldBuilder.LEAF_T / 2 + 0.055));
        markShadow(h2);
        g.add(h2);
      }
      if (isExit) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(leafW * 0.66, 0.075, 0.09), metalMaterial([0.5, 0.2]));
        bar.position.set(leafW / 2, 1.02, WorldBuilder.LEAF_T / 2 + 0.09);
        markShadow(bar);
        g.add(bar);
        const sign = new THREE.Mesh(
          new THREE.BoxGeometry(0.5, 0.18, 0.06),
          new THREE.MeshStandardMaterial({ color: 0x113311, emissive: 0x22ff44, emissiveIntensity: 0.95 })
        );
        sign.position.set(leafW / 2, Math.min(2.25, openH - 0.3), WorldBuilder.LEAF_T / 2 + 0.05);
        g.add(sign);
      }
    } else {
      /* PUERTA DE MADERA con bastidor de montantes y travesaños + 2 paneles
       * hundidos + manilla de latón con escudo */
      const wood = woodMaterial([0.55, 1]);
      const stW = 0.14; // montante
      lbox(stW, leafH, WorldBuilder.LEAF_T, stW / 2, leafH / 2 + 0.05, 0);
      lbox(stW, leafH, WorldBuilder.LEAF_T, leafW - stW / 2, leafH / 2 + 0.05, 0);
      lbox(leafW - 2 * stW, 0.12, WorldBuilder.LEAF_T, leafW / 2, leafH - 0.08, 0);        // riel superior
      lbox(leafW - 2 * stW, 0.13, WorldBuilder.LEAF_T, leafW / 2, 1.02, 0);                // riel de cerradura
      lbox(leafW - 2 * stW, 0.17, WorldBuilder.LEAF_T, leafW / 2, 0.14, 0);                // riel inferior
      // paneles hundidos (panel superior y de ojo)
      const panelTopH = leafH - 1.02 - 0.12 - 0.26;
      lbox(leafW - 2 * stW - 0.07, Math.max(0.3, panelTopH), WorldBuilder.LEAF_T - 0.03, leafW / 2, 1.02 + 0.13 + panelTopH / 2, 0);
      const panelBotH = 1.02 - 0.13 - 0.17 - 0.16;
      lbox(leafW - 2 * stW - 0.07, Math.max(0.3, panelBotH), WorldBuilder.LEAF_T - 0.03, leafW / 2, 0.17 + 0.16 + panelBotH / 2 + 0.06, 0);
      const leaf = new THREE.Mesh(mergeGeometries(leafGeos, false)!, wood);
      markShadow(leaf);
      g.add(leaf);
      // ventanilla superior con marco
      if (!d.secret) {
        const glass = new THREE.Mesh(
          new THREE.BoxGeometry(Math.max(0.3, leafW * 0.34), 0.44, 0.02),
          new THREE.MeshPhysicalMaterial({ color: 0x16191d, roughness: 0.18, metalness: 0.35, transparent: true, opacity: 0.86 })
        );
        glass.position.set(leafW / 2, Math.min(1.68, leafH - 0.42), WorldBuilder.LEAF_T / 2 + 0.008);
        markShadow(glass);
        g.add(glass);
        const wf = new THREE.Mesh(new THREE.BoxGeometry(Math.max(0.3, leafW * 0.34) + 0.09, 0.52, 0.03), darkMetalMaterial());
        wf.position.set(leafW / 2, Math.min(1.68, leafH - 0.42), WorldBuilder.LEAF_T / 2 + 0.001);
        markShadow(wf);
        g.add(wf);
      }
      // manilla de latón (palanca + escudo + ojo de cerradura) por ambas caras
      const brass = new THREE.MeshStandardMaterial({ color: 0x9a7422, roughness: 0.32, metalness: 0.85 });
      for (const s of [1, -1]) {
        const lever = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.038, 0.038), brass);
        lever.position.set(leafW - 0.19, 1.03, s * (WorldBuilder.LEAF_T / 2 + 0.05));
        lever.rotation.z = -0.06 * s;
        markShadow(lever);
        g.add(lever);
        const rose = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.018, 12), brass);
        rose.rotation.x = Math.PI / 2;
        rose.position.set(leafW - 0.19, 1.03, s * (WorldBuilder.LEAF_T / 2 + 0.02));
        markShadow(rose);
        g.add(rose);
        const key = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.012, 8), darkMetalMaterial());
        key.rotation.x = Math.PI / 2;
        key.position.set(leafW - 0.19, 0.955, s * (WorldBuilder.LEAF_T / 2 + 0.022));
        g.add(key);
      }
    }

    if (d.secret) {
      this.dressAsShelf(g, leafW);
    }

    this.root.add(g);

    /* ---------- colisión de la hoja cerrada + registro ---------- */
    const collider = this.addCollider(
      new THREE.Box3(
        new THREE.Vector3(
          d.x - (alongX ? d.width / 2 : WALL_T / 2),
          0,
          d.z - (alongX ? WALL_T / 2 : d.width / 2)
        ),
        new THREE.Vector3(
          d.x + (alongX ? d.width / 2 : WALL_T / 2),
          openH,
          d.z + (alongX ? WALL_T / 2 : d.width / 2)
        )
      ),
      `door_${d.id}`
    );

    /* ---------- giro determinista: la hoja SIEMPRE abre hacia la sala B ---------- */
    const rb = this.rooms.get(d.roomB);
    let swing = 1;
    if (alongX) {
      swing = rb && rb.def.rect[1] > d.z ? -1 : 1;   // sala B al norte(+Z) → gira -1
    } else {
      swing = rb && rb.def.rect[0] > d.x ? -1 : 1;   // sala B al este(+X) → gira -1
    }

    const door: DoorRT = {
      def: d,
      group: g,
      open: false,
      targetAngle: baseAngle,
      angle: baseAngle,
      baseAngle,
      swing,
      openAngle: 1.92,
      collider,
      locked: !!d.locked,
      code: d.code,
      isSecret: !!d.secret,
      opening: false,
      lastToggle: 0,
    };
    (g as unknown as { userData: { door?: DoorRT } }).userData.door = door;
    this.doors.set(d.id, door);
  }

  private dressAsShelf(g: THREE.Group, w: number) {
    const shelfMat = woodDoorMatShelf();
    for (let i = 0; i < 3; i++) {
      const board = new THREE.Mesh(new THREE.BoxGeometry(w * 0.96, 0.05, 0.34), shelfMat);
      board.position.set(w / 2, 0.5 + i * 0.62, 0.14);
      g.add(board);
      for (let b = 0; b < 3; b++) {
        const bw = 0.22 + Math.random() * 0.12;
        const box = new THREE.Mesh(
          new THREE.BoxGeometry(bw, 0.3 + Math.random() * 0.16, 0.22),
          new THREE.MeshStandardMaterial({ color: 0x6b5a3e, roughness: 0.85 })
        );
        box.position.set(w * 0.18 + b * 0.3 + Math.random() * 0.06, 0.68 + i * 0.62, 0.14);
        box.rotation.y = (Math.random() - 0.5) * 0.4;
        g.add(box);
      }
    }
  }

  /* ================= CONDUCTOS (v8 — túneles alineados con el muro) ================= */

  private buildVents() {
    for (const v of this.map.vents as VentDef[]) {
      const rt: VentRT = { def: v, coverClosed: false, coverTimer: 0, blocked: false, bangTimer: 0 };
      const ax = v.a[0];
      const az = v.a[1];
      const bx = v.b[0];
      const bz = v.b[1];
      const dx = bx - ax;
      const dz = bz - az;
      const len = Math.hypot(dx, dz);
      const alongX = Math.abs(dx) > Math.abs(dz);
      const cx = (ax + bx) / 2;
      const cz = (az + bz) / 2;
      const ductMat = metalMaterial([Math.max(1, len / 1.2), 1]);
      const markShadow = (m: THREE.Mesh) => {
        m.castShadow = true;
        m.receiveShadow = true;
        (m.userData as { castShadow?: boolean }).castShadow = true;
      };

      /* El conducto atraviesa ahora un HUECO REAL del muro revestido con su
       * manga (buildWall). Caja exterior: 0.96 x 1.12 — cabe por dentro de la
       * manga (1.00 x 1.16) sin tocarla: nada queda "trabado" en el muro. */
      const ductLen = len + 0.5;
      const DW = 0.96;  // ancho exterior
      const DH = 1.12;  // altura exterior
      const SW = 0.05;  // grosor de pared lateral
      const geos: THREE.BufferGeometry[] = [];
      const dbox = (w: number, h: number, dp: number, px: number, py: number, pz: number) => {
        const g = new THREE.BoxGeometry(alongX ? w : dp, h, alongX ? dp : w);
        g.translate(px, py, pz);
        geos.push(g);
      };
      // suelo + techo del túnel
      dbox(ductLen, 0.035, DW, cx, 0.017, cz);
      dbox(ductLen, 0.05, DW, cx, DH - 0.025, cz);
      // laterales
      dbox(ductLen, DH, SW, cx, DH / 2, cz + (alongX ? DW / 2 - SW / 2 : 0));
      dbox(ductLen, DH, SW, cx, DH / 2, cz - (alongX ? DW / 2 - SW / 2 : 0));
      const duct = new THREE.Mesh(mergeGeometries(geos, false)!, ductMat);
      markShadow(duct);
      this.root.add(duct);
      // colisiones de los laterales (el jugador no atraviesa la caja)
      for (const s of [1, -1]) {
        const px = cx + (alongX ? 0 : s * (DW / 2 - 0.01));
        const pz = cz + (alongX ? s * (DW / 2 - 0.01) : 0);
        this.addCollider(
          new THREE.Box3().setFromCenterAndSize(
            new THREE.Vector3(px, 0.6, pz),
            new THREE.Vector3(alongX ? ductLen : 0.12, 1.2, alongX ? 0.12 : ductLen)
          ),
          `vent_side_${v.id}_${s > 0 ? 'a' : 'b'}`
        );
      }

      this.buildGrate(ax, az, alongX);
      this.buildGrate(bx, bz, alongX);

      if (v.coverAt) {
        const px = v.coverAt === 'a' ? ax : bx;
        const pz = v.coverAt === 'a' ? az : bz;
        const cover = new THREE.Mesh(
          new THREE.BoxGeometry(alongX ? 1.0 : 0.09, 1.16, alongX ? 0.09 : 1.0),
          new THREE.MeshStandardMaterial({ color: 0x565e66, roughness: 0.4, metalness: 0.85 })
        );
        cover.position.set(px + (alongX ? 0 : 0.22), 0.58, pz + (alongX ? 0.22 : 0));
        cover.visible = false;
        this.root.add(cover);
        rt.coverMesh = cover;
        rt.coverCollider = this.addCollider(
          new THREE.Box3().setFromCenterAndSize(cover.position.clone(), new THREE.Vector3(alongX ? 1.04 : 0.24, 1.2, alongX ? 0.24 : 1.04)),
          `vent_cover_${v.id}`
        );
        rt.coverCollider.active = false;
      }
      this.vents.set(v.id, rt);
    }
  }

  private buildGrate(x: number, z: number, alongX: boolean) {
    /* rejilla de paso: barras verticales + marco de esquinas, fusionadas */
    const geos: THREE.BufferGeometry[] = [];
    const n = 7;
    for (let i = 0; i < n; i++) {
      const off = -0.4 + (i / (n - 1)) * 0.8;
      const g = new THREE.CylinderGeometry(0.019, 0.019, 1.08, 6);
      g.translate(alongX ? 0 : off, 0.56, alongX ? off : 0);
      geos.push(g);
    }
    const frame = new THREE.BoxGeometry(alongX ? 0.05 : 0.98, 1.18, alongX ? 0.98 : 0.05);
    frame.translate(0, 0.59, 0);
    geos.push(frame);
    const mesh = new THREE.Mesh(mergeGeometries(geos, false)!, darkMetalMaterial());
    mesh.receiveShadow = true;
    (mesh.userData as { castShadow?: boolean }).castShadow = true;
    mesh.position.set(x, 0, z);
    this.root.add(mesh);
  }

  /* ================= LUCES (POOL) ================= */

  /** registra una luz decorativa (la ilumina el pool cuando el jugador está cerca) */
  registerAccent(def: AccentLightDef) {
    this.accents.push(def);
  }

  private buildLights() {
    const LM = 42;
    for (const rt of this.rooms.values()) {
      const amb = rt.def.ambientLight;
      const h = rt.def.height ?? 3.6;
      const dimFactor = rt.def.id === 'office' ? 0.85 : 0.17;
      rt.lightBase = (amb?.intensity ?? 0.45) * LM * dimFactor;
      rt.lightOn = LIGHTS_ON_DEFAULT.has(rt.def.id);
      this.roomList.push(rt);
      const fixture = new THREE.Mesh(
        new THREE.BoxGeometry(1.1, 0.08, 0.4),
        new THREE.MeshStandardMaterial({ color: 0x9a9482, emissive: new THREE.Color(rt.lightColor), emissiveIntensity: 0.02 })
      );
      fixture.position.set(rt.center.x, h - 0.06, rt.center.z);
      this.root.add(fixture);
      rt.fixture = fixture;
    }

    // ---- v11: LA OFICINA ES EL ÚNICO REFUGIO ILUMINADO ----
    // 3 luces cálidas permanentes y distribuidas (la del pool + estas) para
    // que toda la sala quede clara: escritorio, estantería y rincón de cámaras.
    {
      const office = this.rooms.get('office');
      if (office) {
        const cx = office.center.x;
        const cz = office.center.z;
        const spots: Array<[number, number, number]> = [
          [cx + 2.6, cz - 2.8, 24],   // lado del escritorio
          [cx - 3.4, cz + 2.6, 20],   // zona de estanterías
          [cx + 3.6, cz + 2.6, 18],   // rincón de la puerta
        ];
        for (const [x, z, it] of spots) {
          const l = new THREE.PointLight(0xffe9c0, it, 17, 1.35);
          l.position.set(x, 2.92, z);
          this.root.add(l);
        }
      }
    }

    // ---- POOL: 5 puntuales de sala ----
    for (let i = 0; i < 5; i++) {
      const l = new THREE.PointLight(0xffd9a8, 0, 15, 1.7);
      l.position.set(0, 3, 0);
      this.root.add(l);
      this.roomPool.push(l);
    }

    // ---- POOL: 1 roja de emergencia (sigue la más cercana) ----
    const em = new THREE.PointLight(0xff2211, 0, 10, 1.9);
    em.position.set(0, 3.4, 0);
    this.root.add(em);
    this.emergencyPool = em;
    // luminarias rojas visibles en las 8 posiciones (meshes emisivos, baratos)
    const emMat = new THREE.MeshStandardMaterial({ color: 0x330604, emissive: 0xff2211, emissiveIntensity: 1.6 });
    for (const [x, z] of this.emPositions) {
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.12, 0.2), emMat);
      lamp.position.set(x, 3.55, z);
      this.root.add(lamp);
    }

    // ---- POOL: 1 puntual de acento (cala / fríos / decorativas) ----
    const ap = new THREE.PointLight(0xffffff, 0, 8, 1.9);
    ap.position.set(0, 2.5, 0);
    this.root.add(ap);
    this.accentPointPool = ap;

    // ---- POOL: 2 focos de acento (vitrinas / estatua / proyector) ----
    for (let i = 0; i < 2; i++) {
      const s = new THREE.SpotLight(0xffd9a8, 0, 10, 0.5, 0.5, 1.6);
      s.position.set(0, 4, 0);
      s.target.position.set(0, 0, 0);
      this.root.add(s);
      this.root.add(s.target);
      this.accentSpotPool.push(s);
    }

    // ---- foco azul moribundo del escenario del atrio (fijo) ----
    const stage = new THREE.SpotLight(0x5588ff, 9, 20, 0.5, 0.45, 1.2);
    stage.position.set(0, 7.6, -8.2);
    stage.target.position.set(0, 1.6, -6.2);
    this.root.add(stage);
    this.root.add(stage.target);
    this.stageSpot = stage;
  }

  setPowerFactor(p: number) {
    this.power = p;
  }

  setRoomLight(roomId: string, on: boolean) {
    const r = this.rooms.get(roomId);
    if (r) r.lightOn = on;
  }

  setAllLights(on: boolean, except: string[] = []) {
    for (const r of this.rooms.values()) {
      if (!except.includes(r.def.id)) r.lightOn = on;
    }
  }

  update(dt: number, focusPos: THREE.Vector3) {
    this.clock += dt;
    const t = this.clock;

    // ---- selección de las 5 salas encendidas más cercanas (sin alocar) ----
    // en modo cámara, la sala del feed entra SIEMPRE (impulso de visión nocturna)
    const feed = this.camView ? this.roomAt(focusPos.x, focusPos.z) : null;
    const chosen: RoomRT[] = [];
    for (let slot = 0; slot < this.roomPool.length; slot++) {
      let best: RoomRT | null = null;
      let bestD = Infinity;
      for (const r of this.roomList) {
        if (!r.lightOn || chosen.includes(r)) continue;
        const dx = r.center.x - focusPos.x;
        const dz = r.center.z - focusPos.z;
        let d = dx * dx + dz * dz;
        if (r === feed) d *= 0.25; // prioridad a la sala del feed
        if (d < bestD) { best = r; bestD = d; }
      }
      if (best) chosen.push(best);
    }

    // apagar las salas sin luz del pool y actualizar luminarias
    for (const r of this.roomList) {
      const slot = chosen.indexOf(r);
      let intensity = 0;
      if (slot >= 0) {
        intensity = r.lightBase * this.power;
        if (r.flicker > 0.02) {
          const f =
            0.72 +
            0.28 * Math.sin(t * 7.3 + r.center.x) * Math.sin(t * 3.1 + r.center.z) +
            (Math.random() < 0.004 * r.flicker * 60 ? -0.8 : 0);
          intensity *= Math.max(0.05, f);
        }
        // impulso de la sala del feed de la tableta
        if (r === feed) intensity = Math.max(intensity, r.lightBase * 0.55);
        const l = this.roomPool[slot];
        const h = r.def.height ?? 3.6;
        l.position.set(r.center.x, h - 0.55, r.center.z);
        l.color.setHex(r.lightColor);
        l.intensity = intensity;
        l.distance = r.def.id === 'atrium' ? 22 : 15;
        // v11: la OFICINA es el único refugio iluminado del juego — su luz
        // es más intensa y con caída más suave para llenar toda la sala
        if (r.def.id === 'office') {
          l.intensity = intensity * 2.2;
          l.decay = 1.15;
          l.distance = 20;
        } else {
          l.decay = 1.7;
        }
      }
      r.lightLevel = intensity;
      if (r.fixture) {
        const fm = r.fixture.material as THREE.MeshStandardMaterial;
        fm.emissiveIntensity = intensity > 2 ? Math.min(3, 0.8 + intensity / 26) : 0.02;
      }
    }

    // ---- emergencia roja: la posición más cercana ----
    if (this.emergencyPool) {
      let bx = this.emPositions[0][0];
      let bz = this.emPositions[0][1];
      let bestD = Infinity;
      for (const [x, z] of this.emPositions) {
        const d = (x - focusPos.x) ** 2 + (z - focusPos.z) ** 2;
        if (d < bestD) { bestD = d; bx = x; bz = z; }
      }
      this.emergencyPool.position.set(bx, 3.4, bz);
      this.emergencyPool.intensity = 6;
    }

    // ---- acentos: el puntual y los 2 focos más cercanos ----
    if (this.accentPointPool) {
      let bestD = Infinity;
      let best: AccentLightDef | null = null;
      for (const a of this.accents) {
        if (a.spot) continue;
        const d = a.pos.distanceToSquared(focusPos);
        if (d < bestD) { bestD = d; best = a; }
      }
      const l = this.accentPointPool;
      if (best) {
        l.position.copy(best.pos);
        l.color.setHex(best.color);
        l.intensity = best.intensity;
        l.distance = best.distance;
        l.decay = best.decay ?? 1.9;
      } else {
        l.intensity = 0;
      }
    }
    for (const sp of this.accentSpotPool) {
      let bestD = Infinity;
      let best: AccentLightDef | null = null;
      for (const a of this.accents) {
        if (!a.spot) continue;
        const d = a.pos.distanceToSquared(focusPos);
        if (d < bestD) { bestD = d; best = a; }
      }
      if (best) {
        sp.position.copy(best.pos);
        sp.target.position.copy(best.target ?? best.pos);
        sp.color.setHex(best.color);
        sp.intensity = best.intensity;
        sp.distance = best.distance;
        sp.angle = best.angle ?? 0.5;
        sp.penumbra = best.penumbra ?? 0.5;
        sp.decay = best.decay ?? 1.6;
      } else {
        sp.intensity = 0;
      }
    }

    for (const a of this.propAnims) {
      a.update(dt, this.clock);
    }
  }

  reset() {
    for (const d of this.doors.values()) {
      d.open = false;
      d.targetAngle = d.baseAngle;
      d.angle = d.baseAngle;
      d.group.rotation.y = d.baseAngle;
      d.collider.active = true;
      d.locked = !!d.def.locked;
      d.opening = false;
    }
    for (const v of this.vents.values()) {
      v.coverClosed = false;
      v.coverTimer = 0;
      v.blocked = false;
      if (v.coverMesh) v.coverMesh.visible = false;
      if (v.coverCollider) v.coverCollider.active = false;
    }
    for (const r of this.rooms.values()) {
      r.lightOn = LIGHTS_ON_DEFAULT.has(r.def.id);
      r.blackoutTimer = 0;
      r.lightLevel = 0;
    }
    for (const c of this.colliders) {
      if (c.id?.startsWith('item_')) c.active = false;
    }
  }
}

function woodDoorMatShelf(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color: 0x7a5a34, roughness: 0.8 });
}
