/**
 * Constructor del mundo: plan de planta completo de la Pizzería Estelar Bruno.
 * Paredes con huecos, puertas con bisagra, conductos de ventilación,
 * colisiones AABB, registro de salas y luces con parpadeo.
 */
import * as THREE from 'three';
import mapData from '@/data/map.json';
import type { RoomDef, DoorDef, VentDef, Interactable } from '../core/types';
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
  coverTimer: number; // tiempo restante de bloqueo antes de que Clara la tumbe
  coverCollider?: Collider;
  blocked: boolean;
  bangTimer: number;
}

export interface RoomRT {
  def: RoomDef;
  center: THREE.Vector3;
  light: THREE.PointLight | null;
  lightBase: number;
  flicker: number;
  lightOn: boolean;
  fixture: THREE.Mesh | null;
  blackoutTimer: number;
}

const WALL_H = 3.2;
const WALL_T = 0.28;
const DOOR_H = 2.15;

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
  emergencyLights: THREE.PointLight[] = [];
  stageSpots: THREE.SpotLight[] = [];
  private roomLights: RoomRT[] = [];
  private clock = 0;
  private power = 1;

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

  /** Altura del suelo en un punto (tarima del escenario con rampa suave) */
  floorHeightAt(x: number, z: number): number {
    // Tarima del escenario: x [3.6, 13.4], z [-17, -12.6], borde suave de 0.45
    if (x > 3.0 && x < 14.0 && z > -17.0 && z < -12.4) {
      let f = 1;
      if (z > -13.0) f = Math.max(0, (-13.0 - z) / 0.6 + 1); // rampa frontal
      if (z > -12.4) f = 0;
      return 0.45 * Math.min(1, Math.max(0, f));
    }
    return 0;
  }

  addCollider(box: THREE.Box3, id?: string, tall = true): Collider {
    const c: Collider = { box, active: true, id, tall };
    this.colliders.push(c);
    return c;
  }

  buildAll(onProgress: (frac: number, label: string) => void) {
    onProgress(0.1, 'Cimentando la pizzería...');
    this.buildFloorsAndCeilings();
    onProgress(0.3, 'Levantando paredes...');
    this.buildWalls();
    onProgress(0.5, 'Colgando puertas...');
    this.buildDoors();
    onProgress(0.65, 'Instalando conductos...');
    this.buildVents();
    onProgress(0.8, 'Amueblando las salas...');
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
      const mat = floorMaterials[r.floor]([Math.max(1, w / 2.6), Math.max(1, d / 2.6)]);
      const floor = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, d), mat);
      floor.position.set((x1 + x2) / 2, -0.05, (z1 + z2) / 2);
      floor.receiveShadow = true;
      floor.name = `floor_${r.id}`;
      this.root.add(floor);

      this.rooms.set(r.id, {
        def: r,
        center: new THREE.Vector3((x1 + x2) / 2, 0, (z1 + z2) / 2),
        light: null,
        lightBase: r.ambientLight?.intensity ?? 0.45,
        flicker: r.ambientLight?.flicker ?? 0.08,
        lightOn: true,
        fixture: null,
        blackoutTimer: 0,
      });
    }
    // Techo continuo
    const ceil = new THREE.Mesh(
      new THREE.PlaneGeometry(48, 34),
      ceilingMaterial([48 / 2.2, 34 / 2.2])
    );
    ceil.rotation.x = Math.PI / 2;
    ceil.position.y = WALL_H;
    this.root.add(ceil);
  }

  /* ================= PAREDES ================= */

  private wallSpecs(): WallSpec[] {
    return [
      // Perímetro
      { x1: -24, z1: -17, x2: 24, z2: -17, wallType: 'wallpaper' },
      { x1: -24, z1: 17, x2: 24, z2: 17, wallType: 'wallpaper' },
      { x1: -24, z1: -17, x2: -24, z2: 17, wallType: 'concrete' },
      { x1: 24, z1: -17, x2: 24, z2: 17, wallType: 'wallpaper' },
      // Separadores banda norte
      { x1: -13, z1: -17, x2: -13, z2: -9, wallType: 'concrete' },
      { x1: -6, z1: -17, x2: -6, z2: -9, wallType: 'concrete' },
      { x1: 2, z1: -17, x2: 2, z2: -9, wallType: 'wallpaper' },
      { x1: 15, z1: -17, x2: 15, z2: -9, wallType: 'tile' },
      // Muro sur banda norte | pasillo principal
      { x1: -24, z1: -9, x2: -13, z2: -9, wallType: 'tile', openings: [
        { at: -23.3, width: 1.0, height: 1.15 },
        { at: -18.5, width: 1.6, height: DOOR_H },
      ] },
      { x1: -13, z1: -9, x2: -6, z2: -9, wallType: 'concrete', openings: [{ at: -9.5, width: 1.4, height: DOOR_H }] },
      { x1: -6, z1: -9, x2: 2, z2: -9, wallType: 'wallpaper', openings: [
        { at: -4.5, width: 1.0, height: 1.15 },
        { at: -2, width: 2.4, height: 2.6 },
      ] },
      { x1: 2, z1: -9, x2: 15, z2: -9, wallType: 'wallpaper', openings: [{ at: 8.5, width: 9, height: 2.6 }] },
      { x1: 15, z1: -9, x2: 24, z2: -9, wallType: 'tile', openings: [{ at: 19.5, width: 1.4, height: DOOR_H }] },
      // Muro sur pasillo principal | banda central
      { x1: -24, z1: -3.5, x2: -13.5, z2: -3.5, wallType: 'concrete', openings: [
        { at: -23.3, width: 1.0, height: 1.15 },
        { at: -19, width: 1.8, height: DOOR_H },
      ] },
      { x1: -13.5, z1: -3.5, x2: 3, z2: -3.5, wallType: 'wallpaper', openings: [{ at: -6.5, width: 7, height: 2.6 }] },
      { x1: 3, z1: -3.5, x2: 13, z2: -3.5, wallType: 'wallpaper', openings: [{ at: 8, width: 1.8, height: DOOR_H }] },
      { x1: 13, z1: -3.5, x2: 24, z2: -3.5, wallType: 'tile', openings: [{ at: 18.5, width: 1.8, height: DOOR_H }] },
      // Separadores banda central
      { x1: -13.5, z1: -3.5, x2: -13.5, z2: 5, wallType: 'concrete', openings: [{ at: 0.75, width: 1.6, height: DOOR_H }] },
      { x1: 3, z1: -3.5, x2: 3, z2: 5, wallType: 'wallpaper', openings: [{ at: 0.75, width: 1.6, height: DOOR_H }] },
      { x1: 13, z1: -3.5, x2: 13, z2: 5, wallType: 'tile', openings: [
        { at: 0.75, width: 1.6, height: DOOR_H },
        { at: 3.5, width: 1.0, height: 1.15 },
      ] },
      // Muro sur banda central | pasillos sur
      { x1: -24, z1: 5, x2: -13.5, z2: 5, wallType: 'concrete', openings: [
        { at: -19, width: 1.6, height: DOOR_H },
        { at: -15.5, width: 1.0, height: 1.15 },
      ] },
      { x1: -13.5, z1: 5, x2: 3, z2: 5, wallType: 'wallpaper', openings: [{ at: -7, width: 1.6, height: DOOR_H }] },
      { x1: 3, z1: 5, x2: 13, z2: 5, wallType: 'wallpaper', openings: [{ at: 5, width: 1.6, height: DOOR_H }] },
      { x1: 13, z1: 5, x2: 24, z2: 5, wallType: 'tile', openings: [{ at: 18, width: 1.6, height: DOOR_H }] },
      // Muro sur pasillos | banda sur
      { x1: -24, z1: 9, x2: -14, z2: 9, wallType: 'concrete', openings: [{ at: -19, width: 1.6, height: DOOR_H }] },
      { x1: -14, z1: 9, x2: -6, z2: 9, wallType: 'concrete', openings: [{ at: -10, width: 1.6, height: DOOR_H }] },
      { x1: -6, z1: 9, x2: 6, z2: 9, wallType: 'tile', openings: [
        { at: -3.75, width: 1.6, height: 2.3 },
        { at: 0, width: 1.0, height: 1.15 },
        { at: 3.75, width: 1.6, height: 2.3 },
      ] },
      { x1: 6, z1: 9, x2: 13, z2: 9, wallType: 'metal', openings: [
        { at: 9.5, width: 1.6, height: DOOR_H },
        { at: 12, width: 1.0, height: 1.15 },
      ] },
      { x1: 13, z1: 9, x2: 24, z2: 9, wallType: 'wallpaper', openings: [{ at: 18.5, width: 1.8, height: DOOR_H }] },
      // Separadores banda sur
      { x1: -14, z1: 9, x2: -14, z2: 17, wallType: 'concrete' },
      { x1: -6, z1: 9, x2: -6, z2: 17, wallType: 'concrete' },
      { x1: 6, z1: 9, x2: 6, z2: 17, wallType: 'metal' },
      { x1: 13, z1: 9, x2: 13, z2: 17, wallType: 'metal' },
      // Muro almacén sur | sala oculta
      { x1: -14, z1: 13.2, x2: -6, z2: 13.2, wallType: 'concrete', openings: [{ at: -10, width: 1.4, height: 2.1 }] },
    ];
  }

  private buildWalls() {
    for (const spec of this.wallSpecs()) {
      this.buildWall(spec);
    }
    // Relleno junto al conducto largo oeste (evita quedar atrapado en la esquina)
    this.addCollider(new THREE.Box3(new THREE.Vector3(-24, 0, -8.9), new THREE.Vector3(-23.75, 3, -3.7)), 'duct_fill_w', false);
  }

  private buildWall(spec: WallSpec) {
    const alongX = Math.abs(spec.z2 - spec.z1) < 0.001;
    const a = alongX ? Math.min(spec.x1, spec.x2) : Math.min(spec.z1, spec.z2);
    const b = alongX ? Math.max(spec.x1, spec.x2) : Math.max(spec.z1, spec.z2);
    const fixed = alongX ? spec.z1 : spec.x1;
    const openings = (spec.openings ?? []).slice().sort((o1, o2) => o1.at - o2.at);

    const mat = wallMaterials[spec.wallType]([Math.max(0.5, (b - a) / 2.4), WALL_H / 2.4]);

    const solid = (from: number, to: number) => {
      if (to - from < 0.05) return;
      const len = to - from;
      const cx = alongX ? (from + to) / 2 : fixed;
      const cz = alongX ? fixed : (from + to) / 2;
      const geo = new THREE.BoxGeometry(alongX ? len : WALL_T, WALL_H, alongX ? WALL_T : len);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(cx, WALL_H / 2, cz);
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      this.root.add(mesh);
      this.addCollider(
        new THREE.Box3(
          new THREE.Vector3(cx - (alongX ? len / 2 : WALL_T / 2 + 0.02), 0, cz - (alongX ? WALL_T / 2 + 0.02 : len / 2)),
          new THREE.Vector3(cx + (alongX ? len / 2 : WALL_T / 2 + 0.02), WALL_H, cz + (alongX ? WALL_T / 2 + 0.02 : len / 2))
        ),
        undefined,
        true
      );
    };

    const lintel = (from: number, to: number, h: number) => {
      if (WALL_H - h < 0.1) return;
      const len = to - from;
      const cx = alongX ? (from + to) / 2 : fixed;
      const cz = alongX ? fixed : (from + to) / 2;
      const geo = new THREE.BoxGeometry(alongX ? len : WALL_T, WALL_H - h, alongX ? WALL_T : len);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(cx, h + (WALL_H - h) / 2, cz);
      mesh.receiveShadow = true;
      this.root.add(mesh);
    };

    let cursor = a;
    for (const op of openings) {
      const oStart = op.at - op.width / 2;
      const oEnd = op.at + op.width / 2;
      if (oStart > cursor + 0.02) solid(cursor, oStart);
      lintel(oStart, oEnd, op.height ?? DOOR_H);
      cursor = oEnd;
    }
    if (cursor < b - 0.02) solid(cursor, b);
  }

  /* ================= PUERTAS ================= */

  private buildDoors() {
    for (const d of this.map.doors as DoorDef[]) {
      this.buildDoor(d);
    }
    // Arcadas sin puerta (escenario / comedor / entradas de oficina): ya creadas como huecos
  }

  private buildDoor(d: DoorDef) {
    const g = new THREE.Group();
    const isMetal = d.id.includes('electrical') || d.id.includes('machinery') || d.id.includes('exit');
    const leafMat = isMetal ? metalMaterial([0.6, 1]) : this.woodDoorMat();
    const w = d.width - 0.08;
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(w, 2.05, 0.07), leafMat);
    leaf.position.set(w / 2, 1.02, 0);
    leaf.castShadow = true;
    g.add(leaf);
    // Ventanilla en puertas de madera
    if (!isMetal && !d.secret) {
      const glass = new THREE.Mesh(
        new THREE.BoxGeometry(w * 0.4, 0.5, 0.02),
        new THREE.MeshPhysicalMaterial({ color: 0x181a1c, roughness: 0.15, metalness: 0.3, transparent: true, opacity: 0.85 })
      );
      glass.position.set(w / 2, 1.6, 0.04);
      g.add(glass);
      // Marco de la ventanilla
      const frame = new THREE.Mesh(new THREE.BoxGeometry(w * 0.4 + 0.08, 0.58, 0.03), darkMetalMaterial());
      frame.position.set(w / 2, 1.6, 0.02);
      g.add(frame);
    }
    // Manilla
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.05, 0.05), darkMetalMaterial());
    handle.position.set(w - 0.22, 1.02, 0.07);
    g.add(handle);
    if (d.secret) {
      // Estantería falsa: cajas y tablas sobre la puerta
      this.dressAsShelf(g, w);
    }
    if (d.id === 'door_exit') {
      // Barra antipánico
      const bar = new THREE.Mesh(new THREE.BoxGeometry(w * 0.8, 0.08, 0.1), metalMaterial([0.5, 0.2]));
      bar.position.set(w / 2, 1.05, 0.09);
      g.add(bar);
      // Cartel SALIDA
      const sign = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.18, 0.06),
        new THREE.MeshStandardMaterial({ color: 0x113311, emissive: 0x22ff44, emissiveIntensity: 0.9 })
      );
      sign.position.set(w / 2, 2.2, 0.06);
      g.add(sign);
    }

    const alongX = d.axis === 'x'; // hueco en muro que corre en X
    // bisagra en el extremo negativo del hueco
    const hx = alongX ? d.x - d.width / 2 + 0.04 : d.x;
    const hz = alongX ? d.z : d.z - d.width / 2 + 0.04;
    if (alongX) {
      g.position.set(hx, 0, d.z);
    } else {
      g.position.set(d.x, 0, hz);
      g.rotation.y = Math.PI / 2;
    }
    // dirección de apertura (hacia roomB)
    let openDir = 1;
    if (alongX) {
      const rb = this.rooms.get(d.roomB);
      openDir = rb && rb.def.rect[1] < d.z ? 1 : -1; // abre hacia el sur si roomB está al sur
    } else {
      const rb = this.rooms.get(d.roomB);
      openDir = rb && rb.def.rect[0] < d.x ? 1 : -1;
    }

    this.root.add(g);

    const cx = alongX ? d.x : d.x;
    const cz = alongX ? d.z : d.z;
    const collider = this.addCollider(
      new THREE.Box3(
        new THREE.Vector3(cx - (alongX ? d.width / 2 : 0.1), 0, cz - (alongX ? 0.1 : d.width / 2)),
        new THREE.Vector3(cx + (alongX ? d.width / 2 : 0.1), 2.1, cz + (alongX ? 0.1 : d.width / 2))
      ),
      `door_${d.id}`
    );

    const door: DoorRT = {
      def: d,
      group: g,
      open: false,
      targetAngle: 0,
      angle: 0,
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

  private woodDoorMat(): THREE.MeshStandardMaterial {
    return woodMaterial([0.8, 1]);
  }

  private dressAsShelf(g: THREE.Group, w: number) {
    const shelfMat = woodDoorMatShelf();
    for (let i = 0; i < 3; i++) {
      const board = new THREE.Mesh(new THREE.BoxGeometry(w * 0.96, 0.05, 0.34), shelfMat);
      board.position.set(w / 2, 0.5 + i * 0.62, 0.12);
      g.add(board);
      // cajas encima
      for (let b = 0; b < 3; b++) {
        const bw = 0.22 + Math.random() * 0.12;
        const box = new THREE.Mesh(
          new THREE.BoxGeometry(bw, 0.3 + Math.random() * 0.16, 0.22),
          new THREE.MeshStandardMaterial({ color: 0x6b5a3e, roughness: 0.85 })
        );
        box.position.set(w * 0.18 + b * 0.3 + Math.random() * 0.06, 0.68 + i * 0.62, 0.12);
        box.rotation.y = (Math.random() - 0.5) * 0.4;
        g.add(box);
      }
    }
  }

  /* ================= CONDUCTOS ================= */

  private buildVents() {
    for (const v of this.map.vents as VentDef[]) {
      const rt: VentRT = { def: v, coverClosed: false, coverTimer: 0, blocked: false, bangTimer: 0 };
      // El conducto largo oeste se construye de extremo a extremo
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

      // Interior hueco: suelo, laterales y techo
      const ductLen = len + 0.5;
      const floor = new THREE.Mesh(new THREE.BoxGeometry(alongX ? ductLen : 1.0, 0.04, alongX ? 1.0 : ductLen), ductMat);
      floor.position.set(cx, 0.03, cz);
      this.root.add(floor);
      const sideA = new THREE.Mesh(new THREE.BoxGeometry(alongX ? ductLen : 0.08, 1.15, alongX ? 0.08 : ductLen), ductMat);
      sideA.position.set(cx + (alongX ? 0 : 0.52), 0.575, cz + (alongX ? 0.52 : 0));
      this.root.add(sideA);
      const sideB = new THREE.Mesh(new THREE.BoxGeometry(alongX ? ductLen : 0.08, 1.15, alongX ? 0.08 : ductLen), ductMat);
      sideB.position.set(cx - (alongX ? 0 : 0.52), 0.575, cz - (alongX ? 0.52 : 0));
      this.root.add(sideB);
      const top = new THREE.Mesh(new THREE.BoxGeometry(alongX ? ductLen : 1.0, 0.06, alongX ? 1.0 : ductLen), ductMat);
      top.position.set(cx, 1.18, cz);
      this.root.add(top);
      // Colliders de los laterales
      this.addCollider(
        new THREE.Box3().setFromCenterAndSize(sideA.position.clone().setY(0.6), new THREE.Vector3(alongX ? ductLen : 0.14, 1.2, alongX ? 0.14 : ductLen)),
        `vent_side_${v.id}_a`
      );
      this.addCollider(
        new THREE.Box3().setFromCenterAndSize(sideB.position.clone().setY(0.6), new THREE.Vector3(alongX ? ductLen : 0.14, 1.2, alongX ? 0.14 : ductLen)),
        `vent_side_${v.id}_b`
      );
      if (len > 2.5) {
        // relleno lateral para el conducto largo (impide caminar junto a él dentro del pasillo)
        this.addCollider(
          new THREE.Box3().setFromCenterAndSize(
            new THREE.Vector3(cx + (alongX ? 0 : 1.0), 1.6, cz + (alongX ? 1.0 : 0)),
            new THREE.Vector3(alongX ? ductLen : 0.6, 3.2, alongX ? 0.6 : ductLen)
          ),
          `vent_fill_${v.id}`
        );
        this.addCollider(
          new THREE.Box3().setFromCenterAndSize(
            new THREE.Vector3(cx - (alongX ? 0 : 1.0), 1.6, cz - (alongX ? 1.0 : 0)),
            new THREE.Vector3(alongX ? ductLen : 0.6, 3.2, alongX ? 0.6 : ductLen)
          ),
          `vent_fill2_${v.id}`
        );
      }

      // Rejillas en ambos extremos (barras)
      this.buildGrate(ax, az, alongX);
      this.buildGrate(bx, bz, alongX);

      // Tapa si procede
      if (v.coverAt) {
        const px = v.coverAt === 'a' ? ax : bx;
        const pz = v.coverAt === 'a' ? az : bz;
        const cover = new THREE.Mesh(
          new THREE.BoxGeometry(alongX ? 1.0 : 0.08, 1.15, alongX ? 0.08 : 1.0),
          new THREE.MeshStandardMaterial({ color: 0x565e66, roughness: 0.4, metalness: 0.85 })
        );
        cover.position.set(px + (alongX ? 0 : 0.2), 0.6, pz + (alongX ? 0.2 : 0));
        cover.visible = false;
        this.root.add(cover);
        rt.coverMesh = cover;
        rt.coverCollider = this.addCollider(
          new THREE.Box3().setFromCenterAndSize(cover.position.clone(), new THREE.Vector3(alongX ? 1.0 : 0.2, 1.2, alongX ? 0.2 : 1.0)),
          `vent_cover_${v.id}`
        );
        rt.coverCollider.active = false;
      }
      this.vents.set(v.id, rt);
    }
  }

  private buildGrate(x: number, z: number, alongX: boolean) {
    const g = new THREE.Group();
    const barMat = darkMetalMaterial();
    const n = 6;
    for (let i = 0; i < n; i++) {
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.1, 6), barMat);
      const off = -0.42 + (i / (n - 1)) * 0.84;
      bar.position.set(alongX ? 0 : off, 0.55, alongX ? off : 0);
      g.add(bar);
    }
    const frame = new THREE.Mesh(new THREE.BoxGeometry(alongX ? 0.06 : 0.98, 1.2, alongX ? 0.98 : 0.06), barMat);
    frame.position.set(0, 0.6, 0);
    g.add(frame);
    g.position.set(x, 0, z);
    this.root.add(g);
  }

  /* ================= LUCES ================= */

  private buildLights() {
    // Multiplicador de unidades físicas de Three.js r155+ (candelas)
    const LM = 42;
    for (const rt of this.rooms.values()) {
      const amb = rt.def.ambientLight;
      const color = amb?.color ?? 0xffd9a8;
      const light = new THREE.PointLight(color, (amb?.intensity ?? 0.45) * LM, 15, 1.7);
      light.position.set(rt.center.x, 2.85, rt.center.z);
      this.root.add(light);
      rt.light = light;
      rt.lightBase = (amb?.intensity ?? 0.45) * LM;
      this.roomLights.push(rt);
      // Luminaria empotrada
      const fixture = new THREE.Mesh(
        new THREE.BoxGeometry(1.1, 0.08, 0.4),
        new THREE.MeshStandardMaterial({ color: 0x9a9482, emissive: new THREE.Color(color), emissiveIntensity: 1.4 })
      );
      fixture.position.set(rt.center.x, WALL_H - 0.06, rt.center.z);
      this.root.add(fixture);
      rt.fixture = fixture;
    }

    // Focos del escenario (colores de espectáculo)
    const spotColors = [0xff5544, 0x44ff88, 0x5588ff];
    const spotX = [5.5, 8.5, 11.5];
    for (let i = 0; i < 3; i++) {
      const spot = new THREE.SpotLight(spotColors[i], 55, 18, 0.5, 0.45, 1.2);
      spot.position.set(spotX[i], 3.0, -9.5);
      spot.target.position.set(spotX[i], 1.2, -13.5);
      this.root.add(spot);
      this.root.add(spot.target);
      this.stageSpots.push(spot);
    }

    // Luces de emergencia (rojas) — siempre encendidas
    const emPos: Array<[number, number]> = [
      [-19, 15], [18.5, 15.5], [0, 12.5], [-19, 2], [8.5, 0], [-8.5, 1.5],
    ];
    for (const [x, z] of emPos) {
      const l = new THREE.PointLight(0xff2211, 12, 10, 1.8);
      l.position.set(x, 2.9, z);
      this.root.add(l);
      this.emergencyLights.push(l);
    }
  }

  setPowerFactor(p: number) {
    this.power = p;
  }

  /** Parpadeo, culling de luces cercanas y animaciones de props.
   * focus = posición de interés (jugador o cámara de seguridad activa) */
  update(dt: number, focusPos: THREE.Vector3) {
    this.clock += dt;
    // Culling: solo las 11 luces más cercanas al foco
    const sorted = this.roomLights
      .map((r) => ({ r, d: r.center.distanceToSquared(focusPos) }))
      .sort((a, b) => a.d - b.d);
    for (let i = 0; i < sorted.length; i++) {
      const { r } = sorted[i];
      const enable = i < 11;
      if (r.light) {
        let intensity = 0;
        if (enable && r.lightOn) {
          intensity = r.lightBase * this.power;
          // parpadeo
          if (r.flicker > 0.02) {
            const t = this.clock;
            const f =
              0.72 +
              0.28 * Math.sin(t * 7.3 + r.center.x) * Math.sin(t * 3.1 + r.center.z) +
              (Math.random() < 0.004 * r.flicker * 60 ? -0.8 : 0);
            intensity *= Math.max(0.05, f);
          }
        }
        r.light.intensity = intensity;
        if (r.fixture) {
          const fm = r.fixture.material as THREE.MeshStandardMaterial;
          fm.emissiveIntensity = intensity > 2 ? Math.min(3, 0.8 + intensity / 26) : 0.02;
        }
      }
    }
    // Animaciones de props (ventiladores, cortinas, pantallas)
    for (const a of this.propAnims) {
      a.update(dt, this.clock);
    }
  }

  reset() {
    // Puertas cerradas, tapas fuera, luces on
    for (const d of this.doors.values()) {
      d.open = false;
      d.targetAngle = 0;
      d.angle = 0;
      d.group.rotation.y = d.def.axis === 'x' ? 0 : Math.PI / 2;
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
      r.lightOn = true;
      r.blackoutTimer = 0;
    }
    for (const c of this.colliders) {
      if (c.id?.startsWith('item_')) c.active = false;
    }
  }
}

function woodDoorMatShelf(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color: 0x7a5a34, roughness: 0.8 });
}
