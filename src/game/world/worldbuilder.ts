/**
 * Constructor del mundo: MEGAPLEX Complejo Bruno (estilo Security Breach).
 * Muros definidos en map.json (con huecos y alturas por tramo), techos por
 * sala, atrio de 9 m, puertas con bisagra, conductos, colisiones AABB,
 * registro de salas y luces con parpadeo.
 */
import * as THREE from 'three';
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
  light: THREE.PointLight | null;
  lightBase: number;
  flicker: number;
  lightOn: boolean;
  fixture: THREE.Mesh | null;
  blackoutTimer: number;
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
  emergencyLights: THREE.PointLight[] = [];
  stageSpots: THREE.SpotLight[] = [];
  /** modo visión de cámara: la sala del feed recibe un impulso de luz tenue */
  camView = false;
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
        light: null,
        lightBase: r.ambientLight?.intensity ?? 0.45,
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
      pillar.castShadow = false;
      pillar.receiveShadow = true;
      this.root.add(pillar);
      this.addCollider(
        new THREE.Box3(new THREE.Vector3(px - 0.28, 0, 12.72), new THREE.Vector3(px + 0.28, 9, 13.28)),
        `pillar_${px}`
      );
    }
  }

  private buildWall(spec: WallSpec) {
    const alongX = Math.abs(spec.z2 - spec.z1) < 0.001;
    const a = alongX ? Math.min(spec.x1, spec.x2) : Math.min(spec.z1, spec.z2);
    const b = alongX ? Math.max(spec.x1, spec.x2) : Math.max(spec.z1, spec.z2);
    const fixed = alongX ? spec.z1 : spec.x1;
    const H = spec.h;
    const openings = (spec.openings ?? []).slice().sort((o1, o2) => o1.at - o2.at);

    const mat = wallMaterials[spec.wallType]([Math.max(0.5, (b - a) / 2.4), H / 2.4]);

    const solid = (from: number, to: number) => {
      if (to - from < 0.05) return;
      const len = to - from;
      const cx = alongX ? (from + to) / 2 : fixed;
      const cz = alongX ? fixed : (from + to) / 2;
      const geo = new THREE.BoxGeometry(alongX ? len : WALL_T, H, alongX ? WALL_T : len);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(cx, H / 2, cz);
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      this.root.add(mesh);
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
  }

  private buildDoor(d: DoorDef) {
    const g = new THREE.Group();
    const isMetal = d.id.includes('electrical') || d.id.includes('generator') || d.id.includes('exit') ||
      d.id.includes('workshop') || d.id.includes('loading') || d.id.includes('freezers') || d.id.includes('pump') ||
      d.id.includes('storageN') || d.id.includes('storageS') || d.id.includes('techS');
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
      const frame = new THREE.Mesh(new THREE.BoxGeometry(w * 0.4 + 0.08, 0.58, 0.03), darkMetalMaterial());
      frame.position.set(w / 2, 1.6, 0.02);
      g.add(frame);
    }
    // Manilla
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.05, 0.05), darkMetalMaterial());
    handle.position.set(w - 0.22, 1.02, 0.07);
    g.add(handle);
    if (d.secret) {
      this.dressAsShelf(g, w);
    }
    if (d.id === 'door_exit') {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(w * 0.8, 0.08, 0.1), metalMaterial([0.5, 0.2]));
      bar.position.set(w / 2, 1.05, 0.09);
      g.add(bar);
      const sign = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.18, 0.06),
        new THREE.MeshStandardMaterial({ color: 0x113311, emissive: 0x22ff44, emissiveIntensity: 0.9 })
      );
      sign.position.set(w / 2, 2.2, 0.06);
      g.add(sign);
    }

    const alongX = d.axis === 'x'; // hueco en muro que corre en X
    const hx = alongX ? d.x - d.width / 2 + 0.04 : d.x;
    const hz = alongX ? d.z : d.z - d.width / 2 + 0.04;
    if (alongX) {
      g.position.set(hx, 0, d.z);
    } else {
      g.position.set(d.x, 0, hz);
      g.rotation.y = Math.PI / 2;
    }
    let openDir = 1;
    if (alongX) {
      const rb = this.rooms.get(d.roomB);
      openDir = rb && rb.def.rect[1] < d.z ? 1 : -1;
    } else {
      const rb = this.rooms.get(d.roomB);
      openDir = rb && rb.def.rect[0] < d.x ? 1 : -1;
    }

    this.root.add(g);

    const cx = d.x;
    const cz = d.z;
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
      this.addCollider(
        new THREE.Box3().setFromCenterAndSize(sideA.position.clone().setY(0.6), new THREE.Vector3(alongX ? ductLen : 0.14, 1.2, alongX ? 0.14 : ductLen)),
        `vent_side_${v.id}_a`
      );
      this.addCollider(
        new THREE.Box3().setFromCenterAndSize(sideB.position.clone().setY(0.6), new THREE.Vector3(alongX ? ductLen : 0.14, 1.2, alongX ? 0.14 : ductLen)),
        `vent_side_${v.id}_b`
      );

      this.buildGrate(ax, az, alongX);
      this.buildGrate(bx, bz, alongX);

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
    const LM = 42;
    for (const rt of this.rooms.values()) {
      const amb = rt.def.ambientLight;
      const color = amb?.color ?? 0xffd9a8;
      const h = rt.def.height ?? 3.6;
      const dimFactor = rt.def.id === 'office' ? 0.6 : 0.17;
      const base = (amb?.intensity ?? 0.45) * LM * dimFactor;
      const light = new THREE.PointLight(color, base, 15, 1.7);
      light.position.set(rt.center.x, h - 0.55, rt.center.z);
      this.root.add(light);
      rt.light = light;
      rt.lightBase = base;
      rt.lightOn = LIGHTS_ON_DEFAULT.has(rt.def.id);
      this.roomLights.push(rt);
      const fixture = new THREE.Mesh(
        new THREE.BoxGeometry(1.1, 0.08, 0.4),
        new THREE.MeshStandardMaterial({ color: 0x9a9482, emissive: new THREE.Color(color), emissiveIntensity: 1.4 })
      );
      fixture.position.set(rt.center.x, h - 0.06, rt.center.z);
      this.root.add(fixture);
      rt.fixture = fixture;
    }

    // Focos del escenario del atrio: un azul moribundo y dos apagados
    const spotColors = [0xff5544, 0x44ff88, 0x5588ff];
    const spotX = [-4.5, 0, 4.5];
    for (let i = 0; i < 3; i++) {
      const spot = new THREE.SpotLight(spotColors[i], i === 2 ? 9 : 0, 20, 0.5, 0.45, 1.2);
      spot.position.set(spotX[i], 7.6, -8.2);
      spot.target.position.set(spotX[i], 1.6, -6.2);
      spot.castShadow = i === 2;
      this.root.add(spot);
      this.root.add(spot.target);
      this.stageSpots.push(spot);
    }

    // Luces de emergencia (rojas) — siempre encendidas, tenues
    const emPos: Array<[number, number]> = [
      [-37.5, 21.5], [0, 15.5], [-30, -20.5], [30, -20.5],
      [0, 6], [-36, 5], [24, 26], [-25.5, 21],
    ];
    for (const [x, z] of emPos) {
      const l = new THREE.PointLight(0xff2211, 6, 10, 1.9);
      l.position.set(x, 3.4, z);
      this.root.add(l);
      this.emergencyLights.push(l);
    }
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
    // Culling: solo las 12 luces más cercanas al foco
    const sorted = this.roomLights
      .map((r) => ({ r, d: r.center.distanceToSquared(focusPos) }))
      .sort((a, b) => a.d - b.d);
    for (let i = 0; i < sorted.length; i++) {
      const { r } = sorted[i];
      const enable = i < 12;
      if (r.light) {
        let intensity = 0;
        if (enable && r.lightOn) {
          intensity = r.lightBase * this.power;
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
    if (this.camView) {
      const r = this.roomAt(focusPos.x, focusPos.z);
      if (r && r.light) {
        const boost = r.lightBase * 0.55;
        if (r.light.intensity < boost) r.light.intensity = boost;
        if (r.fixture) {
          const fm = r.fixture.material as THREE.MeshStandardMaterial;
          fm.emissiveIntensity = 0.6;
        }
      }
    }
    for (const a of this.propAnims) {
      a.update(dt, this.clock);
    }
  }

  reset() {
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
      r.lightOn = LIGHTS_ON_DEFAULT.has(r.def.id);
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
