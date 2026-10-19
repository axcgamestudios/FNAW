/**
 * Mobiliario y decoración del MEGAPLEX Complejo Bruno.
 * Incluye anclajes (anchors) para misiones, pruebas y objetos recogibles.
 */
import * as THREE from 'three';
import { woodMaterial, metalMaterial, darkMetalMaterial, plasticMaterial } from './materials';
import { posterBruno, posterParty, kidDrawing, screenStaticTex, pirateCurtainTex, outOfOrderTex, pirateCoveSignTex } from './textures';
import { Assets } from './assets';
import type { WorldBuilder } from './worldbuilder';

export interface Anchor {
  pos: THREE.Vector3;
  mesh?: THREE.Object3D;
}
export type AnchorMap = Map<string, Anchor>;

export interface PropAnim {
  update: (dt: number, time: number) => void;
}

const FANS: THREE.Object3D[] = [];
const FLICKER_SCREENS: THREE.Mesh[] = [];

function box(
  w: number, h: number, d: number, mat: THREE.Material,
  x: number, y: number, z: number, ry = 0, collide = true, world?: WorldBuilder
): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.rotation.y = ry;
  m.castShadow = true;
  m.receiveShadow = true;
  if (world) {
    world.root.add(m);
    if (collide) {
      world.addCollider(
        new THREE.Box3().setFromCenterAndSize(m.position.clone(), new THREE.Vector3(w, h, d)),
        undefined,
        h > 0.7
      );
    }
  }
  return m;
}

function addPoster(
  world: WorldBuilder, tex: THREE.Texture, x: number, y: number, z: number,
  ry: number, w = 1.1, h = 1.4
) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 })
  );
  m.position.set(x, y, z);
  m.rotation.y = ry;
  world.root.add(m);
}

function addDrawing(world: WorldBuilder, variant: number, x: number, y: number, z: number, ry: number) {
  addPoster(world, kidDrawing(variant), x, y, z, ry, 0.62, 0.62);
}

/** cartel de neón (plano emisivo con marco) */
function neonSign(world: WorldBuilder, text: string, color: number, x: number, y: number, z: number, ry: number, w = 2.6, h = 0.6) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#0a0a10';
  ctx.fillRect(0, 0, 512, 128);
  ctx.font = 'bold 64px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = `#${color.toString(16).padStart(6, '0')}`;
  ctx.shadowBlur = 26;
  ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
  ctx.fillText(text.toUpperCase(), 256, 68);
  ctx.shadowBlur = 8;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text.toUpperCase(), 256, 68);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshStandardMaterial({ map: tex, emissive: new THREE.Color(color), emissiveIntensity: 0.65, emissiveMap: tex, roughness: 0.6 })
  );
  m.position.set(x, y, z);
  m.rotation.y = ry;
  world.root.add(m);
  return m;
}

/** Ventilador de techo animado */
function ceilingFan(world: WorldBuilder, x: number, z: number, y = 3.2) {
  const g = new THREE.Group();
  const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.18, 10), darkMetalMaterial());
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 6), darkMetalMaterial());
  rod.position.y = 0.3;
  g.add(motor, rod);
  const blades = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.02, 0.16), plasticMaterial(0x8a7a58, 0.6));
    b.position.x = 0.55;
    const holder = new THREE.Group();
    holder.add(b);
    holder.rotation.y = (i / 4) * Math.PI * 2;
    blades.add(holder);
  }
  blades.position.y = 0.55;
  g.add(blades);
  g.position.set(x, y, z);
  world.root.add(g);
  FANS.push(blades);
}

/** Luminaria rota colgando (oscila) */
function brokenLight(world: WorldBuilder, x: number, z: number, y = 3.2) {
  const g = new THREE.Group();
  const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.9, 5), darkMetalMaterial());
  wire.position.y = -0.45;
  const bulb = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.14, 0.22, 8),
    new THREE.MeshStandardMaterial({ color: 0xfff2cc, emissive: 0xffe9b0, emissiveIntensity: 1.2 })
  );
  bulb.position.y = -0.95;
  g.add(wire, bulb);
  g.position.set(x, y, z);
  world.root.add(g);
  const base = g.rotation.z;
  world.propAnims.push({ update: (_dt, t) => { g.rotation.z = base + Math.sin(t * 0.7) * 0.1; } });
}

function shelfUnit(world: WorldBuilder, x: number, z: number, ry = 0, len = 2.4, boxes = 6) {
  const g = new THREE.Group();
  const mat = darkMetalMaterial();
  for (let i = 0; i < 3; i++) {
    const board = new THREE.Mesh(new THREE.BoxGeometry(len, 0.05, 0.6), mat);
    board.position.y = 0.35 + i * 0.65;
    g.add(board);
  }
  for (const sx of [-len / 2 + 0.05, len / 2 - 0.05]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.95, 0.08), mat);
    post.position.set(sx, 1.0, -0.28);
    g.add(post);
    const post2 = post.clone();
    post2.position.z = 0.28;
    g.add(post2);
  }
  for (let i = 0; i < boxes; i++) {
    const bw = 0.3 + Math.random() * 0.25;
    const b = new THREE.Mesh(
      new THREE.BoxGeometry(bw, 0.24 + Math.random() * 0.2, 0.3 + Math.random() * 0.2),
      new THREE.MeshStandardMaterial({ color: 0x77664a, roughness: 0.9 })
    );
    b.position.set((Math.random() - 0.5) * (len - 0.5), 0.5 + ((i / boxes) * 2.6 | 0) * 0.65, (Math.random() - 0.5) * 0.3);
    b.rotation.y = (Math.random() - 0.5) * 0.5;
    g.add(b);
  }
  g.position.set(x, 0, z);
  g.rotation.y = ry;
  world.root.add(g);
  const axisX = Math.abs(Math.sin(ry)) < 0.5;
  world.addCollider(
    new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(x, 1, z), new THREE.Vector3(axisX ? len : 0.7, 2, axisX ? 0.7 : len))
  );
  return g;
}

/** v13 — LOCKER estilo Security Breach: casilla HUECA con puerta de rendijas.
 *  El guardia se teletransporta DENTRO (interactuable "Hide" del map.json en
 *  la misma posición) y ve el pasillo a través de las ranuras horizontales
 *  a la altura de los ojos; la linterna encendida dentro dibuja franjas de
 *  luz en el suelo. La unidad 0 de cada banco queda con la puerta vencida. */
const LOCKER_COLORS = [0x2c3a4a, 0x33424f, 0x27333f, 0x3a4a55, 0x2f3d49];

function lockerDoorNumber(n: number): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = 96;
  c.height = 48;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#141a20';
  ctx.fillRect(0, 0, 96, 48);
  ctx.fillStyle = '#c8cfd8';
  ctx.font = 'bold 26px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(n).padStart(3, '0'), 48, 25);
  ctx.strokeStyle = '#5a6a78';
  ctx.strokeRect(2, 2, 92, 44);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function lockerBank(world: WorldBuilder, x0: number, z0: number, ry: number, units: number, firstNumber: number) {
  const g = new THREE.Group();
  g.position.set(x0, 0, z0);
  g.rotation.y = ry;
  const UNIT_W = 0.8;
  const H = 2.05;
  const D = 0.66;
  for (let i = 0; i < units; i++) {
    const unit = new THREE.Group();
    unit.position.x = i * UNIT_W;
    const color = LOCKER_COLORS[(i + firstNumber) % LOCKER_COLORS.length];
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.62, metalness: 0.35 });
    // carcasa hueca: trasera, laterales, techo y base
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.76, H - 0.06, 0.05), mat);
    back.position.set(0, H / 2, -D / 2 + 0.03);
    back.castShadow = true;
    back.receiveShadow = true;
    unit.add(back);
    for (const sx of [-0.385, 0.385]) {
      const side = new THREE.Mesh(new THREE.BoxGeometry(0.05, H, D), mat);
      side.position.set(sx, H / 2, 0);
      side.castShadow = true;
      side.receiveShadow = true;
      unit.add(side);
    }
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.05, D), mat);
    top.position.set(0, H - 0.02, 0);
    top.castShadow = true;
    unit.add(top);
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.06, D), mat);
    base.position.set(0, 0.03, 0);
    unit.add(base);
    // puerta con bisagra en el canto izquierdo (grupo pivotante)
    const door = new THREE.Group();
    door.position.set(-0.36, 0, D / 2 - 0.02);
    const doorMat = new THREE.MeshStandardMaterial({
      color: LOCKER_COLORS[(i + firstNumber + 2) % LOCKER_COLORS.length],
      roughness: 0.58,
      metalness: 0.4,
    });
    // mitad inferior maciza + cabecero
    const low = new THREE.Mesh(new THREE.BoxGeometry(0.72, 1.1, 0.035), doorMat);
    low.position.set(0.36, 0.58, 0);
    low.castShadow = true;
    low.receiveShadow = true;
    door.add(low);
    const header = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.16, 0.035), doorMat);
    header.position.set(0.36, H - 0.08, 0);
    header.castShadow = true;
    door.add(header);
    // VENTANA DE RENDIJAS a la altura de los ojos (1.36..1.86): 4 lamas
    // de 7 cm con huecos de 7 cm → el guardia dentro VE el pasillo
    for (let sl = 0; sl < 4; sl++) {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.07, 0.035), doorMat);
      slat.position.set(0.36, 1.40 + sl * 0.145, 0);
      slat.castShadow = true;
      door.add(slat);
    }
    // marco de la ventana
    for (const fy of [1.325, 1.905]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.045, 0.045), doorMat);
      bar.position.set(0.36, fy, 0.01);
      door.add(bar);
    }
    // manilla + bisagras
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.05), metalMaterial([0.9, 0.6]));
    handle.position.set(0.66, 1.05, 0.03);
    door.add(handle);
    for (const hy of [0.45, 1.55]) {
      const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.14, 8), darkMetalMaterial());
      hinge.position.set(0.02, hy, 0.02);
      door.add(hinge);
    }
    // número estarcido
    const num = new THREE.Mesh(
      new THREE.PlaneGeometry(0.17, 0.09),
      new THREE.MeshStandardMaterial({ map: lockerDoorNumber(firstNumber + i), roughness: 0.8 })
    );
    num.position.set(0.36, H - 0.13, 0.028);
    door.add(num);
    // unidad vencida: puerta colgando abierta (la primera de cada banco)
    if (i === 0) door.rotation.y = 0.62;
    unit.add(door);
    g.add(unit);
  }
  world.root.add(g);
  // colisión única del banco completo
  const axisX = Math.abs(Math.sin(ry)) < 0.5;
  const len = units * UNIT_W;
  world.addCollider(
    new THREE.Box3().setFromCenterAndSize(
      new THREE.Vector3(x0, 1, z0),
      new THREE.Vector3(axisX ? len : D, H, axisX ? D : len)
    ),
    `lockerbank_${x0.toFixed(1)}_${z0.toFixed(1)}`
  );
}

/** v13 — bancos de lockers por todo el MEGAPLEX (escondites estilo Security
 *  Breach). Las posiciones coinciden EXACTAMENTE con los hidingSpots
 *  "locker_*" de map.json (la unidad escondite es la que tiene la puerta
 *  cerrada, índice 1 del banco). */
function buildLockerBanks(world: WorldBuilder) {
  // Pasillo técnico (3 bancos contra el muro sur, mirando al norte)
  lockerBank(world, -33.2, -23.35, 0, 3, 101);
  lockerBank(world, -6.8, -23.35, 0, 3, 104);
  lockerBank(world, 19.2, -23.35, 0, 3, 107);
  // Galerías laterales oeste/este del atrio sur (muro sur de cada galería)
  lockerBank(world, -41.6, 13.65, 0, 3, 110);
  lockerBank(world, 38.4, 13.65, 0, 3, 113);
  // Atrio central: muro oeste (mirando +X) y muro este (mirando -X),
  // en los tramos sólidos entre la reja de la guardería y las galerías
  // (con ry=±π/2 las unidades avanzan hacia ∓Z: oeste z0=12 baja, este sube)
  lockerBank(world, -15.5, 12.0, Math.PI / 2, 4, 201);
  lockerBank(world, 15.5, 10.0, -Math.PI / 2, 4, 205);
  // Promenades norte (muro norte mirando al sur)
  lockerBank(world, -39.2, -8.35, 0, 3, 301);
  lockerBank(world, 38.4, -8.35, 0, 3, 304);
  // Rockstar Row (camerinos, muro oeste mirando +X)
  lockerBank(world, -43.35, -13.0, Math.PI / 2, 3, 401);
  // Arcade (muro sur mirando al norte)
  lockerBank(world, -9.2, -9.65, Math.PI, 3, 501);
  // Food court (muro este mirando -X)
  lockerBank(world, 30.45, 9.0, -Math.PI / 2, 3, 601);
  // Lobby (muro sur mirando al norte)
  lockerBank(world, -14.8, 33.35, Math.PI, 3, 701);
  // Bolera (rincón este del muro norte, junto a las máquinas de chapa)
  lockerBank(world, 10.05, -16.35, 0, 2, 801);
  // Galería técnica sur (la vieja casilla suelta se sustituye por banco)
  lockerBank(world, -41.7, 32.5, Math.PI, 3, 901);
}

function arcadeCabinet(world: WorldBuilder, x: number, z: number, ry: number, broken = false, screenColor = 0x37ff88) {
  const g = new THREE.Group();
  const bodyMat = plasticMaterial(broken ? 0x2a2226 : 0x3a2030, 0.55, 0.5);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.8, 0.9), bodyMat);
  body.position.y = 0.9;
  body.castShadow = true;
  g.add(body);
  const screenMat = new THREE.MeshStandardMaterial({
    color: 0x050805,
    emissive: broken ? 0x000000 : screenColor,
    emissiveIntensity: 0,
    roughness: 0.25,
  });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.48), screenMat);
  screen.position.set(0, 1.25, 0.44);
  screen.rotation.x = -0.18;
  g.add(screen);
  if (!broken) {
    const overlay = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.48), new THREE.MeshStandardMaterial({ map: screenStaticTex(), emissive: 0x333333, emissiveMap: screenStaticTex(), emissiveIntensity: 1, color: 0x111111 }));
    overlay.position.set(0, 1.25, 0.45);
    overlay.rotation.x = -0.18;
    g.add(overlay);
    FLICKER_SCREENS.push(overlay);
  }
  const panel = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 0.3), plasticMaterial(0x222222, 0.6));
  panel.position.set(0, 0.95, 0.52);
  panel.rotation.x = 0.25;
  g.add(panel);
  const marquee = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 0.28, 0.14),
    new THREE.MeshStandardMaterial({ color: 0x662233, emissive: 0xff2255, emissiveIntensity: broken ? 0 : 0.5 })
  );
  marquee.position.set(0, 1.82, 0.38);
  g.add(marquee);
  g.position.set(x, 0, z);
  g.rotation.y = ry;
  world.root.add(g);
  const c = Math.abs(Math.cos(ry)), s = Math.abs(Math.sin(ry));
  world.addCollider(
    new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(x, 0.9, z), new THREE.Vector3(0.9 * c + 0.95 * s, 1.9, 0.95 * c + 0.9 * s))
  );
  return g;
}

/** Máquina expendedora con frontal emisivo */
function vendingMachine(world: WorldBuilder, x: number, z: number, ry: number, color = 0xff5544) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.9, 0.75), plasticMaterial(0x1c1f24, 0.5, 0.35));
  body.position.y = 0.95;
  body.castShadow = true;
  g.add(body);
  const front = new THREE.Mesh(
    new THREE.PlaneGeometry(0.72, 1.5),
    new THREE.MeshStandardMaterial({ color: 0x0a0c10, emissive: color, emissiveIntensity: 0.28, roughness: 0.3 })
  );
  front.position.set(0, 1.0, 0.385);
  g.add(front);
  const c2 = document.createElement('canvas');
  c2.width = 128; c2.height = 128;
  const cctx = c2.getContext('2d')!;
  cctx.fillStyle = '#101018';
  cctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 5; j++) {
      cctx.fillStyle = ['#c04030', '#c0a030', '#3060c0', '#30a050'][(i + j) % 4];
      cctx.fillRect(14 + i * 26, 16 + j * 20, 18, 14);
    }
  }
  const tex = new THREE.CanvasTexture(c2);
  tex.colorSpace = THREE.SRGBColorSpace;
  const goods = new THREE.Mesh(
    new THREE.PlaneGeometry(0.66, 0.85),
    new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0x888888, emissiveIntensity: 0.4 })
  );
  goods.position.set(0, 1.25, 0.39);
  g.add(goods);
  g.position.set(x, 0, z);
  g.rotation.y = ry;
  world.root.add(g);
  const c = Math.abs(Math.cos(ry)), s = Math.abs(Math.sin(ry));
  world.addCollider(
    new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(x, 1, z), new THREE.Vector3(1.05 * c + 0.8 * s, 2, 0.8 * c + 1.05 * s))
  );
  return g;
}

/** Banco de mall con jardinera */
function mallBench(world: WorldBuilder, x: number, z: number, ry = 0) {
  const g = new THREE.Group();
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.09, 0.55), woodMaterial([1.4, 0.6]));
  seat.position.y = 0.45;
  const back = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.42, 0.08), woodMaterial([1.4, 0.6]));
  back.position.set(0, 0.75, -0.26);
  for (const dx of [-0.75, 0.75]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.45, 0.5), darkMetalMaterial());
    leg.position.set(dx, 0.22, 0);
    g.add(leg);
  }
  g.add(seat, back);
  g.position.set(x, 0, z);
  g.rotation.y = ry;
  world.root.add(g);
  const c = Math.abs(Math.cos(ry)), s = Math.abs(Math.sin(ry));
  world.addCollider(
    new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(x, 0.5, z), new THREE.Vector3(1.85 * c + 0.6 * s, 0.9, 0.6 * c + 1.85 * s))
  );
}

/** Jardinera con planta */
function planter(world: WorldBuilder, x: number, z: number) {
  const g = new THREE.Group();
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.34, 0.55, 10), plasticMaterial(0x5a4a3a, 0.75));
  pot.position.y = 0.28;
  g.add(pot);
  for (let i = 0; i < 7; i++) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.9, 6), plasticMaterial(0x2a5a2a, 0.85));
    leaf.position.set((Math.random() - 0.5) * 0.5, 0.85 + Math.random() * 0.2, (Math.random() - 0.5) * 0.5);
    leaf.rotation.set((Math.random() - 0.5) * 0.5, 0, (Math.random() - 0.5) * 0.5);
    g.add(leaf);
  }
  g.position.set(x, 0, z);
  world.root.add(g);
  world.addCollider(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(x, 0.6, z), new THREE.Vector3(1.0, 1.2, 1.0)));
}

/** Papelera */
function trashBin(world: WorldBuilder, x: number, z: number) {
  const bin = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.18, 0.55, 10), darkMetalMaterial());
  bin.position.set(x, 0.28, z);
  bin.castShadow = true;
  world.root.add(bin);
  world.addCollider(new THREE.Box3().setFromCenterAndSize(bin.position.clone(), new THREE.Vector3(0.45, 0.55, 0.45)));
}

/* ============ CONSTRUCCIÓN POR SALAS ============ */

export function buildProps(world: WorldBuilder) {
  buildOffice(world);
  buildAtrium(world);
  buildRockstar(world);
  buildTheater(world);
  buildArcade(world);
  buildBowling(world);
  buildPrize(world);
  buildGolf(world);
  buildPirateCove(world);
  buildWestStorage(world);
  buildBasement(world);
  buildFoodcourt(world);
  buildRestrooms(world);
  buildProms(world);
  buildLobby(world);
  buildTechHall(world);
  buildServices(world);
  buildGenerator(world);
  buildSouthService(world);
  // v13 — escondites estilo Security Breach
  buildLockerBanks(world);

  // Animaciones globales
  world.propAnims.push({
    update: (dt, t) => {
      for (const f of FANS) f.rotation.y += dt * (5 + Math.sin(t * 0.5) * 0.4);
      for (const scr of FLICKER_SCREENS) {
        const m = scr.material as THREE.MeshStandardMaterial;
        m.emissiveIntensity = 0.35 + Math.random() * 0.5 * (Math.random() < 0.06 ? 0 : 1);
      }
    },
  });
}

/* ============ OFICINA DE SEGURIDAD (hub del guardia) ============ */

function buildOffice(world: WorldBuilder) {
  // Sala: x[-44,-31] z[19,29]. Escritorio contra la pared norte (z=19.5)
  const CX = -37.5;
  const deskMat = woodMaterial([1.5, 0.9]);
  box(3.4, 0.08, 1.15, deskMat, CX, 0.78, 21.8, 0, true, world);
  for (const dx of [-1.55, 1.55]) for (const dz of [-0.45, 0.45]) {
    box(0.09, 0.78, 0.09, darkMetalMaterial(), CX + dx, 0.39, 21.8 + dz, 0, false, world);
  }

  // Monitor con estática
  const monitor = new THREE.Group();
  const monBody = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.5, 0.4), plasticMaterial(0x333830, 0.5));
  const monScreen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.5, 0.38),
    new THREE.MeshStandardMaterial({ map: screenStaticTex(), emissive: 0x88ff99, emissiveMap: screenStaticTex(), emissiveIntensity: 0.8, color: 0x111111 })
  );
  monScreen.position.set(0, 0.04, 0.21);
  monitor.add(monBody, monScreen);
  monitor.position.set(CX - 0.9, 1.28, 21.55);
  monitor.rotation.y = Math.PI + 0.2;
  world.root.add(monitor);
  world.anchors.set('desk_monitor', { pos: new THREE.Vector3(CX - 0.9, 1.28, 21.55), mesh: monitor });

  // Ventilador de mesa FNAF2 (metal verde-negro, jaula con radios)
  const fan = new THREE.Group();
  const fanGreen = new THREE.MeshStandardMaterial({ color: 0x2a3a2a, roughness: 0.55, metalness: 0.6 });
  const fanBase = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 0.05, 12), fanGreen);
  const fanPost = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.034, 0.3, 10), fanGreen);
  fanPost.position.y = 0.17;
  const motor = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.09, 6, 10), fanGreen);
  motor.rotation.x = Math.PI / 2;
  motor.position.set(0, 0.36, 0.03);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.09, 10), darkMetalMaterial());
  hub.rotation.x = Math.PI / 2;
  hub.position.set(0, 0.36, 0.05);
  const blades = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const bl = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.014, 0.055), plasticMaterial(0x8a8878, 0.45, 0.2));
    bl.position.x = 0.085;
    bl.rotation.x = 0.5;
    const h = new THREE.Group();
    h.add(bl);
    h.rotation.z = (i / 4) * Math.PI * 2;
    blades.add(h);
  }
  blades.position.set(0, 0.36, 0.07);
  const cageFront = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.008, 6, 20), darkMetalMaterial());
  cageFront.position.set(0, 0.36, 0.1);
  const cageBack = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.008, 6, 20), darkMetalMaterial());
  cageBack.position.set(0, 0.36, 0.0);
  const spokes = new THREE.Group();
  for (let i = 0; i < 8; i++) {
    const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.3, 6), darkMetalMaterial());
    sp.rotation.z = (i / 8) * Math.PI;
    spokes.add(sp);
  }
  spokes.position.set(0, 0.36, 0.05);
  fan.add(fanBase, fanPost, motor, hub, blades, cageFront, cageBack, spokes);
  fan.position.set(CX + 0.62, 0.82, 22.1);
  fan.rotation.y = -0.35;
  fan.traverse((o) => {
    if (o instanceof THREE.Mesh) { o.castShadow = true; }
  });
  world.root.add(fan);
  world.propAnims.push({ update: (dt) => { blades.rotation.z += dt * 16; } });

  // Tableta de vigilancia (recogible capítulo 2 — ya no hay linterna aquí)
  const tablet = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.02, 0.22), plasticMaterial(0x1a1e22, 0.4));
  const tabletScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.16), new THREE.MeshStandardMaterial({ color: 0x0a0f0a, emissive: 0x33ff55, emissiveIntensity: 0.12 }));
  tabletScreen.rotation.x = -Math.PI / 2;
  tabletScreen.position.y = 0.02;
  const tabG = new THREE.Group();
  tabG.add(tablet, tabletScreen);
  tabG.position.set(CX + 1.1, 0.86, 22.15);
  tabG.rotation.y = -0.3;
  world.root.add(tabG);
  world.anchors.set('desk_tablet', { pos: new THREE.Vector3(CX + 1.1, 0.86, 22.15), mesh: tabG });

  // v12 — ya NO hay linterna sobre el escritorio: el guardia EMPIEZA con ella en la mano

  // cupcake de Chica sobre el escritorio
  const cupcake = new THREE.Group();
  const cakeBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.04, 0.045, 12),
    new THREE.MeshStandardMaterial({ color: 0x9a5a3a, roughness: 0.8 })
  );
  cakeBase.position.y = 0.022;
  const frosting = new THREE.Mesh(
    new THREE.ConeGeometry(0.052, 0.05, 12),
    plasticMaterial(0xe88ab0, 0.4, 0.5)
  );
  frosting.position.y = 0.062;
  const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.05, 6), plasticMaterial(0xd8d2c2, 0.5));
  candle.position.y = 0.1;
  const flame = new THREE.Mesh(
    new THREE.SphereGeometry(0.009, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0xffd070, emissive: 0xffa020, emissiveIntensity: 2.2 })
  );
  flame.position.y = 0.132;
  for (const ex of [-0.02, 0.02]) {
    const eye = new THREE.Mesh(
      new THREE.SphereGeometry(0.013, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xf0f0e8, emissive: 0x88ff99, emissiveIntensity: 1.1 })
    );
    eye.position.set(ex, 0.07, 0.042);
    const pupil = new THREE.Mesh(
      new THREE.SphereGeometry(0.006, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0x101010 })
    );
    pupil.position.set(ex, 0.07, 0.052);
    cupcake.add(eye, pupil);
  }
  cupcake.add(cakeBase, frosting, candle, flame);
  cupcake.position.set(CX + 2.3, 0.82, 21.95);
  world.root.add(cupcake);
  world.propAnims.push({
    update: (_dt, t) => {
      flame.scale.setScalar(0.85 + Math.sin(t * 11) * 0.18 + Math.random() * 0.06);
      (flame.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.8 + Math.sin(t * 9) * 0.5;
    },
  });

  // gorrito de fiesta
  const partyHat = new THREE.Mesh(
    new THREE.ConeGeometry(0.05, 0.14, 10),
    plasticMaterial(0x3a8ad8, 0.4, 0.6)
  );
  partyHat.position.set(CX - 1.95, 0.895, 22.05);
  partyHat.rotation.z = 0.18;
  world.root.add(partyHat);

  // cables colgando del techo
  const wirePts: Array<[number, number, number]> = [
    [CX - 2.5, 3.1, 21.5], [CX - 1.5, 2.45, 22.2], [CX - 0.2, 2.5, 22.6], [CX + 1.1, 2.4, 22.4],
  ];
  const wireCurve = new THREE.CatmullRomCurve3(wirePts.map((p) => new THREE.Vector3(...p)));
  const wire = new THREE.Mesh(
    new THREE.TubeGeometry(wireCurve, 24, 0.014, 6),
    new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.9 })
  );
  world.root.add(wire);

  // Cámaras de vigilancia en las esquinas de la oficina
  const buildWallCam = (x: number, z: number, ry: number) => {
    const cam = new THREE.Group();
    const mount = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.22, 8), darkMetalMaterial());
    mount.rotation.z = Math.PI / 2.6;
    mount.position.set(0, 0.05, 0.05);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.11, 0.24), plasticMaterial(0x2a2c30, 0.55));
    body.position.set(0.05, 0.12, 0.02);
    const lens = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.04, 0.06, 10),
      new THREE.MeshStandardMaterial({ color: 0x0a0a0c, roughness: 0.25, metalness: 0.7 })
    );
    lens.rotation.z = Math.PI / 2;
    lens.position.set(0.19, 0.12, 0.02);
    const led = new THREE.Mesh(
      new THREE.SphereGeometry(0.008, 6, 6),
      new THREE.MeshStandardMaterial({ color: 0xff3333, emissive: 0xff2222, emissiveIntensity: 2.5 })
    );
    led.position.set(0.05, 0.19, 0.13);
    cam.add(mount, body, lens, led);
    cam.position.set(x, 2.7, z);
    cam.rotation.y = ry;
    cam.traverse((o) => { if (o instanceof THREE.Mesh) o.castShadow = true; });
    world.root.add(cam);
    world.propAnims.push({
      update: (_dt, t) => {
        (led.material as THREE.MeshStandardMaterial).emissiveIntensity = Math.sin(t * 3.2) > 0 ? 2.5 : 0.4;
        body.rotation.y = Math.sin(t * 0.35 + x) * 0.12;
      },
    });
    return cam;
  };
  buildWallCam(-43.6, 20.2, Math.PI / 2 + 0.5);
  buildWallCam(-31.6, 27.6, -Math.PI / 2 - 0.4);

  // Archivadores
  for (const [dx, dz] of [[-43.4, 20.5], [-43.4, 21.7]] as Array<[number, number]>) {
    box(0.55, 1.35, 0.6, darkMetalMaterial(), dx, 0.675, dz, 0, true, world);
  }
  // Cajas apiladas en la esquina
  const boxMat = new THREE.MeshStandardMaterial({ color: 0x6b5a3e, roughness: 0.88 });
  box(0.55, 0.42, 0.55, boxMat, -31.6, 0.21, 20.3, 0.2, true, world);
  box(0.46, 0.36, 0.46, boxMat, -31.63, 0.6, 20.32, -0.14, false, world);
  // Silla de oficina
  const chair = new THREE.Group();
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.5), plasticMaterial(0x2a2a2e, 0.7));
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.55, 0.07), plasticMaterial(0x2a2a2e, 0.7));
  back.position.set(0, 0.35, -0.24);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.35, 8), darkMetalMaterial());
  pole.position.y = -0.2;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.3, 0.05, 10), darkMetalMaterial());
  base.position.y = -0.37;
  chair.add(seat, back, pole, base);
  chair.position.set(CX, 0.55, 22.8);
  world.root.add(chair);

  // Panel eléctrico de la oficina (pared este)
  const panel = new THREE.Group();
  const pBody = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.12), metalMaterial([0.4, 0.6]));
  const pDoor = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.84, 0.03), darkMetalMaterial());
  pDoor.position.z = 0.08;
  for (let i = 0; i < 6; i++) {
    const sw = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.05), plasticMaterial(i % 2 ? 0xcc3333 : 0x33aa44, 0.5));
    sw.position.set(-0.2 + (i % 3) * 0.2, 0.22 - ((i / 3) | 0) * 0.44, 0.1);
    panel.add(sw);
  }
  panel.add(pBody, pDoor);
  panel.position.set(-31.4, 1.5, 24.5);
  panel.rotation.y = -Math.PI / 2;
  world.root.add(panel);
  world.anchors.set('office_panel', { pos: new THREE.Vector3(-31.7, 1.5, 24.5), mesh: panel });

  // Pósters, dibujos infantiles y corcho con notas
  addPoster(world, posterBruno(), CX - 2.5, 1.9, 28.85, Math.PI);
  addPoster(world, posterParty(), CX + 2.8, 1.9, 28.85, Math.PI);
  addDrawing(world, 3, CX - 1.3, 1.75, 28.85, Math.PI);
  addDrawing(world, 1, CX + 4.1 - 6, 1.75, 28.85, Math.PI);
  addDrawing(world, 2, CX - 3.6, 1.7, 19.15, 0);
  addDrawing(world, 4, -43.85, 1.8, 24.5, Math.PI / 2);
  addDrawing(world, 5, -43.85, 1.8, 25.6, Math.PI / 2);
  // corcho con avisos
  const cork = new THREE.Mesh(
    new THREE.BoxGeometry(1.1, 0.8, 0.04),
    new THREE.MeshStandardMaterial({ color: 0x8a6a44, roughness: 0.95 })
  );
  cork.position.set(-31.4, 1.85, 26.5);
  cork.rotation.y = -Math.PI / 2;
  world.root.add(cork);
  for (let i = 0; i < 4; i++) {
    const note = new THREE.Mesh(
      new THREE.PlaneGeometry(0.2, 0.24),
      new THREE.MeshStandardMaterial({ color: [0xd9d2be, 0xcfd8c8, 0xd8ccb8, 0xd2c8d8][i], roughness: 0.9 })
    );
    note.position.set(-31.34, 1.65 + (i % 2) * 0.35, 26.15 + ((i / 2) | 0) * 0.42);
    note.rotation.set(0, -Math.PI / 2, (Math.random() - 0.5) * 0.3);
    world.root.add(note);
  }
  world.anchors.set('note_master', { pos: new THREE.Vector3(-31.34, 1.4, 26.5) });
  world.anchors.set('tape_office', { pos: new THREE.Vector3(-43, 1.2, 27.8) });

  // Taza de café, papeles y walkie sobre el escritorio
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.035, 0.09, 8), plasticMaterial(0xd8d2c2, 0.6));
  cup.position.set(CX - 1.7, 0.87, 22.05);
  world.root.add(cup);
  for (let i = 0; i < 3; i++) {
    const papers = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.008, 0.19), plasticMaterial(0xc9c2ae, 0.9));
    papers.position.set(CX - 1.9 + i * 0.06, 0.83 + i * 0.009, 21.75 - i * 0.05);
    papers.rotation.y = 0.4 + i * 0.5;
    world.root.add(papers);
  }
  const walkie = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.03), plasticMaterial(0x1a1c20, 0.6));
  walkie.position.set(CX + 0.15, 0.91, 22.1);
  walkie.rotation.y = -0.6;
  world.root.add(walkie);
  const walkieAnt = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.12, 6), darkMetalMaterial());
  walkieAnt.position.set(CX + 0.12, 1.03, 22.09);
  world.root.add(walkieAnt);
  // Aviso de turnos en la pared norte
  neonSign(world, 'SECURITY', 0x44ff88, CX, 2.9, 19.2, 0, 2.0, 0.45);
}

/* ============ ATRIO CENTRAL (el corazón del MEGAPLEX) ============ */

function buildAtrium(world: WorldBuilder) {
  // Sala: x[-16,16] z[-9,13], altura 9. Escenario al norte (x[-7,7] z[-9,-5])
  const stageMat = woodMaterial([5, 2.4]);
  box(14, 0.7, 4.0, stageMat, 0, 0.35, -7, 0, false, world);
  // rampa frontal (visual; la altura real la da floorHeightAt)
  const ramp = new THREE.Mesh(new THREE.BoxGeometry(6, 0.7, 1.4), stageMat);
  ramp.position.set(0, 0.32, -4.6);
  ramp.rotation.x = 0.42;
  world.root.add(ramp);

  // telón de fondo del escenario (rojo) + logo BRUNO emisivo
  const curtainMat = new THREE.MeshStandardMaterial({ map: pirateCurtainTex(), roughness: 0.92, color: 0x884455 });
  for (const cx of [-6.4, 6.4]) {
    const curt = new THREE.Mesh(new THREE.BoxGeometry(1.6, 6.5, 0.12), curtainMat);
    curt.position.set(cx, 3.25, -8.8);
    world.root.add(curt);
  }
  const backdrop = new THREE.Mesh(new THREE.BoxGeometry(11, 6.5, 0.1), new THREE.MeshStandardMaterial({ color: 0x3a1020, roughness: 0.9 }));
  backdrop.position.set(0, 3.25, -8.8);
  world.root.add(backdrop);
  const logo = neonSign(world, 'BRUNO', 0xffc83a, 0, 5.6, -8.7, 0, 5.0, 1.2);
  (logo.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.85;

  // focos del escenario (visual: truss)
  const trussMat = darkMetalMaterial();
  const truss = new THREE.Mesh(new THREE.BoxGeometry(14, 0.16, 0.16), trussMat);
  truss.position.set(0, 7.6, -8.3);
  world.root.add(truss);
  for (const fx of [-4.5, 0, 4.5]) {
    const spotBody = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 0.3, 8), trussMat);
    spotBody.position.set(fx, 7.35, -8.2);
    spotBody.rotation.x = 0.6;
    world.root.add(spotBody);
  }

  // micrófono de Freddy en el escenario
  const mic = new THREE.Group();
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.02, 1.5, 8), darkMetalMaterial());
  stand.position.y = 0.75;
  const micHead = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), darkMetalMaterial());
  micHead.position.y = 1.55;
  mic.add(stand, micHead);
  mic.position.set(0, 0.7, -6.5);
  world.root.add(mic);

  // fuente central: pilón circular de dos niveles
  const fountain = new THREE.Group();
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.4, 0.55, 24), plasticMaterial(0x8a8478, 0.5, 0.2));
  basin.position.y = 0.275;
  const water = new THREE.Mesh(
    new THREE.CylinderGeometry(2.0, 2.0, 0.06, 24),
    new THREE.MeshPhysicalMaterial({ color: 0x0c2434, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.9 })
  );
  water.position.y = 0.56;
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 1.8, 12), plasticMaterial(0x8a8478, 0.5, 0.2));
  column.position.y = 1.4;
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.55, 0.3, 16), plasticMaterial(0x8a8478, 0.5, 0.2));
  bowl.position.y = 2.3;
  fountain.add(basin, water, column, bowl);
  fountain.position.set(0, 0, 3.5);
  fountain.traverse((o) => { if (o instanceof THREE.Mesh) { o.castShadow = true; o.receiveShadow = true; } });
  world.root.add(fountain);
  world.addCollider(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(0, 1, 3.5), new THREE.Vector3(4.8, 2.4, 4.8)), 'fountain');
  // estrella dorada sobre la fuente (emblema Bruno)
  const star = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.42, 0),
    new THREE.MeshStandardMaterial({ color: 0xd8a838, metalness: 0.9, roughness: 0.25, emissive: 0x553310, emissiveIntensity: 0.4 })
  );
  star.position.set(0, 3.1, 3.5);
  world.root.add(star);
  world.propAnims.push({ update: (_dt, t) => { star.rotation.y = t * 0.4; star.position.y = 3.1 + Math.sin(t * 0.8) * 0.05; } });

  // anillo de balcón (decorativo): barandilla a 4.5 m en el perímetro
  // v9 — el atrio llega hasta z=18: el anillo se extiende al sur
  const railMat = darkMetalMaterial();
  const rail = (x1: number, z1: number, x2: number, z2: number) => {
    const len = Math.hypot(x2 - x1, z2 - z1);
    const r = new THREE.Mesh(new THREE.BoxGeometry(len, 0.08, 0.06), railMat);
    r.position.set((x1 + x2) / 2, 4.55, (z1 + z2) / 2);
    r.rotation.y = Math.atan2(z2 - z1, x2 - x1);
    world.root.add(r);
    const r2 = new THREE.Mesh(new THREE.BoxGeometry(len, 0.08, 0.06), railMat);
    r2.position.set((x1 + x2) / 2, 4.15, (z1 + z2) / 2);
    r2.rotation.y = r.rotation.y;
    world.root.add(r2);
  };
  rail(-15, -8, 15, -8);
  rail(-15, 18, 15, 18);
  rail(-15, -8, -15, 18);
  rail(15, -8, 15, 18);
  // columnas del balcón (v9: añadidas al sur para el atrio grande)
  for (const [px, pz] of [[-14, -7], [14, -7], [-14, 11], [14, 11], [0, -7], [0, 11], [-14, 17], [14, 17], [0, 17.4]] as Array<[number, number]>) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 9, 12), plasticMaterial(0x9a8a70, 0.55, 0.1));
    col.position.set(px, 4.5, pz);
    col.castShadow = false;
    world.root.add(col);
    world.addCollider(new THREE.Box3().setFromCenterAndSize(col.position.clone(), new THREE.Vector3(0.7, 9, 0.7)), `col_${px}_${pz}`);
  }

  // banderas colgantes del techo
  const pennantColors = [0xd84a4a, 0x4a8fd8, 0xd8b13a, 0x4ad86e];
  for (let i = 0; i < 10; i++) {
    const px = -12 + (i % 5) * 6;
    const pz = -3 + ((i / 5) | 0) * 9;
    const pen = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.7, 0.02),
      new THREE.MeshStandardMaterial({ color: pennantColors[i % 4], emissive: pennantColors[i % 4], emissiveIntensity: 0.12, roughness: 0.8 })
    );
    pen.position.set(px, 7.2, pz);
    world.root.add(pen);
    const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 1.2, 4), darkMetalMaterial());
    wire.position.set(px, 8.1, pz);
    world.root.add(wire);
    world.propAnims.push({ update: (_dt, t) => { pen.rotation.y = Math.sin(t * 0.5 + i) * 0.15; } });
  }

  // estrellas de suelo (adhesivos brillantes hacia el escenario)
  for (let i = 0; i < 12; i++) {
    const st = new THREE.Mesh(
      new THREE.CircleGeometry(0.22, 5),
      new THREE.MeshStandardMaterial({ color: 0x443a28, emissive: 0xd8b13a, emissiveIntensity: 0.22, roughness: 0.7 })
    );
    st.rotation.x = -Math.PI / 2;
    st.rotation.z = Math.random() * Math.PI;
    st.position.set((Math.random() - 0.5) * 26, 0.065, 4 + Math.random() * 7);
    world.root.add(st);
  }

  // cabinas de información (dos, a los lados de la puerta sur)
  for (const kx of [-9, 9]) {
    const kiosk = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 2.2, 8), plasticMaterial(0x8a3a3a, 0.5, 0.25));
    body.position.y = 1.1;
    const top = new THREE.Mesh(new THREE.ConeGeometry(1.0, 0.5, 8), plasticMaterial(0xd8b13a, 0.4, 0.5));
    top.position.y = 2.45;
    kiosk.add(body, top);
    kiosk.position.set(kx, 0, 11);
    world.root.add(kiosk);
    world.addCollider(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(kx, 1, 11), new THREE.Vector3(1.9, 2.4, 1.9)), `kiosk_${kx}`);
  }

  // bancos y plantas alrededor de la fuente
  mallBench(world, -6.5, 3.5, Math.PI / 2);
  mallBench(world, 6.5, 3.5, -Math.PI / 2);
  planter(world, -8, 8);
  planter(world, 8, 8);
  planter(world, -8, -1);
  planter(world, 8, -1);
  trashBin(world, 0, 9.5);

  // pósters gigantes de los animatrónicos en las paredes del atrio
  addPoster(world, posterBruno(), -15.85, 4.5, 0, Math.PI / 2, 2.2, 2.8);
  addPoster(world, posterParty(), 15.85, 4.5, 0, -Math.PI / 2, 2.2, 2.8);
  addDrawing(world, 0, -12, 1.6, 12.85, Math.PI);
  addDrawing(world, 2, 12, 1.6, 12.85, Math.PI);

  // cartel direccional colgante
  const hang = new THREE.Group();
  const plate = new THREE.Mesh(
    new THREE.BoxGeometry(3.0, 0.6, 0.05),
    new THREE.MeshStandardMaterial({ color: 0x27221c, emissive: 0xd8b13a, emissiveIntensity: 0.2 })
  );
  plate.position.y = -0.7;
  for (const wx of [-1.2, 1.2]) {
    const wire2 = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.7, 4), darkMetalMaterial());
    wire2.position.set(wx, -0.35, 0);
    hang.add(wire2);
  }
  hang.add(plate);
  hang.position.set(0, 6.5, 8.5);
  world.root.add(hang);
  world.propAnims.push({ update: (_dt, t) => { hang.rotation.y = Math.sin(t * 0.3) * 0.1; } });

  world.anchors.set('tape_atrium', { pos: new THREE.Vector3(9, 2.3, 11) });
  world.anchors.set('atrium_center', { pos: new THREE.Vector3(0, 1, 3.5) });

  /* ============ v9 — ESTATUA DORADA DE FREDDY (icono del atrio) ============
   * Preside la entrada sur: el que entra por los arcos del vestíbulo la ve
   * de frente, como la estatua de Freddy del Pizzaplex. Model GLB estático. */
  const statue = Assets.createVariant('golden', 0xd8a838);
  const root = statue.root;
  root.position.set(0, 0, 15.2);
  root.rotation.y = Math.PI; // mira al norte: saludando al escenario
  root.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.castShadow = true;
      o.receiveShadow = true;
      (o.userData as { castShadow?: boolean }).castShadow = true;
    }
  });
  world.root.add(root);
  // pedestal circular de mármol falso + placa
  const plinth = new THREE.Mesh(
    new THREE.CylinderGeometry(1.15, 1.35, 0.55, 20),
    plasticMaterial(0x7d7568, 0.42, 0.3)
  );
  plinth.position.set(0, 0.275, 15.2);
  plinth.castShadow = true;
  plinth.receiveShadow = true;
  (plinth.userData as { castShadow?: boolean }).castShadow = true;
  world.root.add(plinth);
  const plinthTop = new THREE.Mesh(
    new THREE.CylinderGeometry(1.2, 1.15, 0.1, 20),
    plasticMaterial(0x8d8578, 0.3, 0.5)
  );
  plinthTop.position.set(0, 0.58, 15.2);
  world.root.add(plinthTop);
  root.position.y = 0.62;
  const plateS = neonSign(world, 'FREDDY', 0xffc83a, 0, 1.35, 14.35, Math.PI, 1.6, 0.34);
  (plateS.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.55;
  world.addCollider(
    new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(0, 1.6, 15.2), new THREE.Vector3(2.6, 3.2, 2.6)),
    'statue_freddy'
  );
  // foco tenue dedicado a la estatua (lo materializa el pool de acentos)
  world.registerAccent({
    pos: new THREE.Vector3(0, 6.4, 17.6),
    target: new THREE.Vector3(0, 1.8, 15.2),
    color: 0xffe6b0,
    intensity: 14,
    distance: 11,
    angle: 0.34,
    penumbra: 0.6,
    decay: 1.7,
    spot: true,
  });

  /* letreros de neón de las zonas nuevas sobre los arcos del norte */
  neonSign(world, 'FAZER BLAST', 0x4ad8ff, -9, 5.0, -8.6, 0, 3.2, 0.6);
  neonSign(world, 'BONNIE BOWL', 0xff5ad8, 5, 5.0, -8.6, 0, 3.2, 0.6);
  neonSign(world, 'GALLERIES', 0xd8b13a, 0, 6.2, 18.4, Math.PI, 3.4, 0.6);
}

/* ============ GALERÍA ESTELAR (Rockstar Row) ============ */

function buildRockstar(world: WorldBuilder) {
  // Sala: x[-44,-30] z[-17,-9]. Estatuas con vitrina.
  const pedestalMat = plasticMaterial(0x4a3040, 0.5, 0.3);
  const starStatue = (x: number, z: number, ry: number, color: number, name: string) => {
    const g = new THREE.Group();
    const ped = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.9, 1.3), pedestalMat);
    ped.position.y = 0.45;
    g.add(ped);
    // figura estilizada (torso + cabeza)
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.5, 8, 12), plasticMaterial(color, 0.4, 0.6));
    body.position.y = 1.55;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 12), plasticMaterial(color, 0.4, 0.6));
    head.position.y = 2.15;
    const eyes = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), new THREE.MeshStandardMaterial({ emissive: 0xffd070, emissiveIntensity: 0.8, color: 0x221100 }));
    eyes.position.set(-0.08, 2.2, 0.17);
    const eyes2 = eyes.clone();
    eyes2.position.x = 0.08;
    g.add(body, head, eyes, eyes2);
    // vitrina
    const glass = new THREE.Mesh(
      new THREE.BoxGeometry(1.25, 2.6, 1.25),
      new THREE.MeshPhysicalMaterial({ color: 0x9ac8d8, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.22 })
    );
    glass.position.y = 1.3;
    g.add(glass);
    g.position.set(x, 0, z);
    g.rotation.y = ry;
    g.traverse((o) => { if (o instanceof THREE.Mesh) o.castShadow = true; });
    world.root.add(g);
    world.addCollider(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(x, 1.4, z), new THREE.Vector3(1.4, 2.8, 1.4)), `statue_${name}`);
    // foco tenue sobre la vitrina (materializado por el pool de luces)
    world.registerAccent({
      pos: new THREE.Vector3(x, 4.3, z),
      target: new THREE.Vector3(x, 2.0, z),
      color: 0xffd9a8, intensity: 5, distance: 4.5, angle: 0.5, penumbra: 0.5, spot: true,
    });
    return g;
  };
  starStatue(-41, -14.5, 0.5, 0x6a4a2a, 'freddy');
  starStatue(-38, -15.5, 0, 0x4a5aa8, 'bonnie');
  starStatue(-35, -14.5, -0.5, 0xd8b13a, 'chica');

  // alfombra roja central
  const carpet = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.02, 7), plasticMaterial(0x8a1a1a, 0.95));
  carpet.position.set(-37, 0.05, -12.5);
  carpet.receiveShadow = true;
  world.root.add(carpet);

  // cuerdas de terciopelo con postes
  const ropeMat = new THREE.MeshStandardMaterial({ color: 0x6a1a2a, roughness: 0.85 });
  for (const [x1, z1, x2, z2] of [
    [-42.8, -16.5, -33, -16.5], [-42.8, -11, -33, -11],
  ] as Array<[number, number, number, number]>) {
    for (const tx of [x1, x2]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.95, 8), darkMetalMaterial());
      post.position.set(tx, 0.48, z1);
      world.root.add(post);
    }
    const len = Math.hypot(x2 - x1, z2 - z1);
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, len, 6), ropeMat);
    rope.rotation.z = Math.PI / 2;
    rope.position.set((x1 + x2) / 2, 0.85, z1);
    world.root.add(rope);
  }

  // vitrinas de trofeos en la pared oeste
  for (let i = 0; i < 3; i++) {
    const caseG = new THREE.Group();
    const shell = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.9, 0.5), new THREE.MeshPhysicalMaterial({ color: 0x9ac8d8, roughness: 0.06, transparent: true, opacity: 0.25 }));
    shell.position.y = 1.15;
    const trophy = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 0.4, 8), new THREE.MeshStandardMaterial({ color: 0xd8a838, metalness: 0.9, roughness: 0.25 }));
    trophy.position.y = 0.9;
    const cup = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), new THREE.MeshStandardMaterial({ color: 0xd8a838, metalness: 0.9, roughness: 0.25 }));
    cup.position.y = 1.2;
    caseG.add(shell, trophy, cup);
    caseG.position.set(-43.6, 0, -15.5 + i * 2.2);
    world.root.add(caseG);
    world.addCollider(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(-43.6, 1.2, -15.5 + i * 2.2), new THREE.Vector3(0.9, 2.2, 0.6)), `trophy_${i}`);
  }

  // póster dorado de la banda
  addPoster(world, posterBruno(), -30.15, 2.2, -13, Math.PI / 2, 1.3, 1.7);
  neonSign(world, 'ROCKSTAR ROW', 0xff8844, -37, 3.6, -9.6, 0, 3.2, 0.55);
  world.anchors.set('key_rockstar', { pos: new THREE.Vector3(-41, 2.1, -14.5) });
  world.anchors.set('tape_rockstar', { pos: new THREE.Vector3(-35, 2.1, -14.5) });
}

/* ============ TEATRO BRUNO ============ */

function buildTheater(world: WorldBuilder) {
  // Sala: x[-30,-16] z[-17,-9], h 5.5. Pantalla en la pared oeste.
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(6.5, 3.6),
    new THREE.MeshStandardMaterial({ color: 0x0a0a12, emissive: 0x182848, emissiveIntensity: 0.35, roughness: 0.4 })
  );
  screen.position.set(-29.8, 2.6, -13);
  screen.rotation.y = Math.PI / 2;
  world.root.add(screen);
  // marco de la pantalla
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.2, 4.0, 7.2), darkMetalMaterial());
  frame.position.set(-29.75, 2.6, -13);
  world.root.add(frame);
  world.addCollider(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(-29.8, 2, -13), new THREE.Vector3(0.4, 4, 7.2)), 'theater_screen');

  // cortinas laterales rojas
  const curtMat = new THREE.MeshStandardMaterial({ map: pirateCurtainTex(), color: 0xaa3344, roughness: 0.95 });
  for (const cz of [-16.3, -9.7]) {
    const curt = new THREE.Mesh(new THREE.BoxGeometry(0.35, 4.6, 1.8), curtMat);
    curt.position.set(-29.2, 2.3, cz);
    world.root.add(curt);
  }

  // filas de butacas mirando la pantalla (oeste) — despejadas del portal sur
  const seatMat = plasticMaterial(0x6a2028, 0.7, 0.1);
  const seatBackMat = plasticMaterial(0x7a2830, 0.7, 0.1);
  for (let row = 0; row < 3; row++) {
    const rz = -16.2 + row * 1.7;
    for (let col = 0; col < 5; col++) {
      const sx = -27 + col * 1.15;
      box(0.9, 0.45, 0.7, seatMat, sx, 0.225, rz, Math.PI / 2, false, world);
      box(0.9, 0.75, 0.14, seatBackMat, sx - 0.34, 0.72, rz, Math.PI / 2, false, world);
    }
    for (let col = 0; col < 5; col++) {
      const sx = -27 + col * 1.15;
      box(0.7, 0.45, 0.5, darkMetalMaterial(), sx, 0.1, rz, Math.PI / 2, false, world);
    }
  }
  world.addCollider(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(-24.5, 0.5, -14.5), new THREE.Vector3(6.4, 1, 4.4)), 'theater_seats');

  // proyector al este con haz tenue
  const proj = new THREE.Group();
  const pBody = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 0.7), darkMetalMaterial());
  const pLens = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.14, 10), darkMetalMaterial());
  pLens.rotation.z = Math.PI / 2;
  pLens.position.x = 0.42;
  const reel = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.03, 12), darkMetalMaterial());
  reel.rotation.x = Math.PI / 2;
  reel.position.set(0, 0.28, -0.15);
  const reel2 = reel.clone();
  reel2.position.z = 0.15;
  proj.add(pBody, pLens, reel, reel2);
  proj.position.set(-16.6, 4.2, -13);
  proj.rotation.y = -Math.PI / 2;
  world.root.add(proj);
  world.propAnims.push({ update: (_dt) => { reel.rotation.y += 0.08; reel2.rotation.y += 0.06; } });
  world.registerAccent({
    pos: new THREE.Vector3(-16.8, 4.0, -13),
    target: new THREE.Vector3(-29.8, 2.6, -13),
    color: 0x88aadd, intensity: 14, distance: 14, angle: 0.35, penumbra: 0.6, spot: true,
  });

  // luces de pasillo
  for (const az of [-16.2, -12.5, -9.8]) {
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(11, 0.05, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x2a1018, emissive: 0xff8866, emissiveIntensity: 0.5 })
    );
    strip.position.set(-22, 0.08, az);
    world.root.add(strip);
  }

  neonSign(world, 'BRUNO THEATER', 0xff4466, -23, 4.9, -9.6, 0, 3.0, 0.55);
  world.anchors.set('key_theater', { pos: new THREE.Vector3(-27.5, 1.0, -15.5) });
  world.anchors.set('tape_theater', { pos: new THREE.Vector3(-17.5, 1.0, -15.5) });
}

/* ============ SALÓN RECREATIVO ============ */

function buildArcade(world: WorldBuilder) {
  // Sala: x[-16,-2] z[-17,-9]. Filas de máquinas frente a frente.
  const cabs: Array<[number, number, number, boolean]> = [
    [-13.5, -15.8, 0, false], [-12.3, -15.8, 0, true], [-11.1, -15.8, 0, false],
    [-7.5, -15.8, 0, false], [-6.3, -15.8, 0, true], [-5.1, -15.8, 0, false],
    [-13.5, -11.5, Math.PI, false], [-12.3, -11.5, Math.PI, false], [-11.1, -11.5, Math.PI, true],
    [-7.5, -11.5, Math.PI, false], [-6.3, -11.5, Math.PI, true], [-5.1, -11.5, Math.PI, false],
  ];
  cabs.forEach(([x, z, ry, broken], i) => arcadeCabinet(world, x, z, ry, broken, [0x37ff88, 0xff8844, 0x88aaff][i % 3]));

  // máquina de peluches (garra)
  const claw = new THREE.Group();
  const cBody = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.7, 1.0), plasticMaterial(0x882838, 0.45, 0.5));
  cBody.position.y = 0.85;
  const cGlass = new THREE.Mesh(
    new THREE.BoxGeometry(1.05, 0.9, 0.85),
    new THREE.MeshPhysicalMaterial({ color: 0xaac8e8, roughness: 0.06, transparent: true, opacity: 0.25 })
  );
  cGlass.position.y = 1.25;
  const plush = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 10), plasticMaterial(0x8a5a2c, 0.85));
  plush.position.set(-0.25, 0.95, 0);
  const plush2 = plush.clone();
  plush2.position.set(0.2, 0.95, 0.15);
  claw.add(cBody, cGlass, plush, plush2);
  claw.position.set(-14.8, 0, -13);
  claw.rotation.y = Math.PI / 2;
  world.root.add(claw);
  world.addCollider(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(-14.8, 1, -13), new THREE.Vector3(1.3, 1.9, 1.1)), 'claw');

  // máquina de cambio y hockey
  vendingMachine(world, -3.2, -15.5, -Math.PI / 2, 0xffc83a);
  box(1.6, 0.75, 0.9, plasticMaterial(0x224433, 0.6, 0.4), -9, 0.38, -13.5, 0.2, true, world);

  // alfombra ajedrezada ya está (suelo). Neón y carteles
  neonSign(world, 'ARCADE HALL', 0x37ff88, -9, 3.9, -9.6, 0, 3.4, 0.55);
  neonSign(world, 'FLIPER', 0xff8844, -15.85, 2.6, -13.5, Math.PI / 2, 1.6, 0.4);
  // cabina de fotos (escondite)
  const booth = new THREE.Group();
  const bBody = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.2, 1.1), plasticMaterial(0x3a2848, 0.5, 0.3));
  bBody.position.y = 1.1;
  const bCurtain = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.8), curtainMatDark());
  bCurtain.position.set(0, 1.0, 0.56);
  booth.add(bBody, bCurtain);
  booth.position.set(-13.4, 0, -15.6);
  world.root.add(booth);
  world.addCollider(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(-13.4, 1.1, -15.6), new THREE.Vector3(1.2, 2.3, 1.2)), 'photo_booth');

  ceilingFan(world, -9, -13.5, 4.3);
  brokenLight(world, -4, -13, 4.2);
  trashBin(world, -3.5, -10.5);
  world.anchors.set('tape_arcade', { pos: new THREE.Vector3(-9, 0.85, -13.5) });
  addDrawing(world, 5, -15.85, 1.6, -11, Math.PI / 2);
}

function curtainMatDark() {
  return new THREE.MeshStandardMaterial({ map: pirateCurtainTex(), color: 0x553a66, roughness: 0.95 });
}

/* ============ BOLERA BRUNO ============ */

function buildBowling(world: WorldBuilder) {
  // Sala: x[-2,12] z[-17,-9], h 5. 4 carriles norte-sur. Chapa al norte (z=-16.5).
  const laneMat = woodMaterial([1.2, 5]);
  const laneColors = [0xd8c8a0, 0xd8c8a0, 0xd8c8a0, 0xd8c8a0];
  for (let i = 0; i < 4; i++) {
    const lx = -0.2 + i * 3.0;
    const lane = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.05, 9.6), laneMat);
    lane.position.set(lx, 0.05, -12.5);
    lane.receiveShadow = true;
    (lane.material as THREE.MeshStandardMaterial).color.setHex(laneColors[i]);
    world.root.add(lane);
    // canal lateral
    const gutter = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.06, 9.6), plasticMaterial(0x222428, 0.4));
    gutter.position.set(lx + 1.5, 0.04, -12.5);
    world.root.add(gutter);
    // máquinas de chapa (norte) — tareas de la PRUEBA
    const setter = new THREE.Group();
    const sBody = new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.3, 0.8), plasticMaterial(0x8a2a2a, 0.45, 0.4));
    sBody.position.y = 0.65;
    const sPanel = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.35, 0.06), new THREE.MeshStandardMaterial({ color: 0x113311, emissive: 0x33ff44, emissiveIntensity: 1.0 }));
    sPanel.position.set(0, 1.0, 0.43);
    setter.add(sBody, sPanel);
    setter.position.set(lx, 0, -16.4);
    setter.traverse((o) => { if (o instanceof THREE.Mesh) o.castShadow = true; });
    world.root.add(setter);
    world.addCollider(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(lx, 0.7, -16.4), new THREE.Vector3(2.35, 1.4, 0.85)), `setter_${i}`);
    // marcador emisivo
    const score = new THREE.Mesh(
      new THREE.PlaneGeometry(2.0, 0.9),
      new THREE.MeshStandardMaterial({ map: screenStaticTex(), emissive: 0x88ff88, emissiveMap: screenStaticTex(), emissiveIntensity: 0.7, color: 0x111111 })
    );
    score.position.set(lx, 3.4, -16.6);
    world.root.add(score);
    FLICKER_SCREENS.push(score);
    // bolos (10 por carril, minúsculos)
    const pinMat = plasticMaterial(0xe8e2d2, 0.4, 0.3);
    for (let p = 0; p < 10; p++) {
      const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 0.32, 8), pinMat);
      const row = Math.floor(p / 4);
      pin.position.set(lx + (p % 4) * 0.16 - 0.24 + row * 0.08, 0.24, -15.3 + row * 0.18);
      world.root.add(pin);
    }
  }
  // devolución de bolas (máquinas cortas: NO atraviesan la sala, dejan cruzar)
  for (const bx of [1.3, 7.3, 10.3]) {
    box(0.9, 0.55, 4.0, plasticMaterial(0x33363c, 0.5, 0.3), bx, 0.3, -12.5, 0, true, world);
  }
  // bolas de bolos decorativas
  for (let i = 0; i < 5; i++) {
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), plasticMaterial([0x1a1a2a, 0x2a1a1a, 0x1a2a1a][i % 3], 0.15, 0.7));
    ball.position.set(1.3 + (i % 3) * 0.2, 0.68, -10.5 + (i / 3 | 0) * 0.3);
    world.root.add(ball);
  }
  // mostrador de zapatos y bancos al sur (despejado del portal x[8,11])
  box(4.0, 1.0, 0.8, woodMaterial([2, 0.8]), 2.5, 0.5, -9.9, 0, true, world);
  mallBench(world, -1, -10.6, Math.PI);
  neonSign(world, 'BRUNO BOWLING', 0x4aafff, 5, 4.2, -9.6, 0, 3.2, 0.55);
  ceilingFan(world, 5, -13, 4.7);
  addPoster(world, posterParty(), 11.85, 2.0, -13, -Math.PI / 2);
  world.anchors.set('tape_bowling', { pos: new THREE.Vector3(11, 0.08, -11.5) });
}

/* ============ RINCÓN DE PREMIOS ============ */

function buildPrize(world: WorldBuilder) {
  // Sala: x[12,26] z[-17,-9]
  // mostrador (retirado del portal sur)
  box(3.6, 1.0, 0.8, woodMaterial([1.6, 0.8]), 19, 0.5, -11.4, 0, true, world);
  // estantería de peluches (pared norte)
  const shelf = shelfUnit(world, 19, -16.4, 0, 4.6, 8);
  // peluches grandes en el suelo
  const plushColors = [0x8a5a2c, 0xd8a8c8, 0xd8c05a, 0x4a8fd8];
  for (let i = 0; i < 7; i++) {
    const plush = new THREE.Mesh(new THREE.SphereGeometry(0.22 + Math.random() * 0.1, 12, 10), plasticMaterial(plushColors[i % 4], 0.9));
    plush.position.set(14.5 + Math.random() * 8, 0.24, -15.8 + Math.random() * 1.4);
    plush.castShadow = true;
    world.root.add(plush);
  }
  // máquina de la garra dorada
  const claw = new THREE.Group();
  const cBody = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.7, 1.0), plasticMaterial(0x2a8a6a, 0.45, 0.5));
  cBody.position.y = 0.85;
  claw.add(cBody);
  claw.position.set(23.5, 0, -12);
  claw.rotation.y = -0.5;
  world.root.add(claw);
  world.addCollider(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(23.5, 0.9, -12), new THREE.Vector3(1.3, 1.8, 1.1)), 'claw2');
  // caja musical de la guardería vieja (deco)
  neonSign(world, 'PRIZES', 0xd8b13a, 19, 3.4, -9.6, 0, 2.4, 0.5);
  addPoster(world, posterBruno(), 12.15, 2.0, -13, Math.PI / 2);
  addDrawing(world, 3, 14, 1.6, -16.85, 0);
  addDrawing(world, 1, 16, 1.6, -16.85, 0);
  ceilingFan(world, 19, -13.5, 4.0);
  world.anchors.set('tape_prize', { pos: new THREE.Vector3(18, 1.1, -10.2) });
}

/* ============ GOLF DEL CAIMÁN ============ */

function buildGolf(world: WorldBuilder) {
  // Sala: x[26,44] z[-17,-9]. Dos green con molino. Pasillos despejados.
  const greenMat = plasticMaterial(0x2a6a3a, 0.95);
  const GREEN_D = 6.0;
  for (const [gx, gz] of [[31, -13.5], [40, -13.5]] as Array<[number, number]>) {
    const green = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.06, GREEN_D), greenMat);
    green.position.set(gx, 0.05, gz);
    green.receiveShadow = true;
    world.root.add(green);
    // borde de madera
    const border = new THREE.Mesh(new THREE.BoxGeometry(6.9, 0.18, GREEN_D + 0.4), woodMaterial([3, 3]));
    border.position.set(gx, 0.07, gz);
    world.root.add(border);
    world.addCollider(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(gx, 0.15, gz + GREEN_D / 2 + 0.2), new THREE.Vector3(6.9, 0.25, 0.15)));
    world.addCollider(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(gx, 0.15, gz - GREEN_D / 2 - 0.2), new THREE.Vector3(6.9, 0.25, 0.15)));
    world.addCollider(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(gx - 3.45, 0.15, gz), new THREE.Vector3(0.15, 0.25, GREEN_D + 0.4)));
    world.addCollider(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(gx + 3.45, 0.15, gz), new THREE.Vector3(0.15, 0.25, GREEN_D + 0.4)));
    // bandera
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.3, 6), plasticMaterial(0xd8d2c2, 0.5));
    pole.position.set(gx + 1.8, 0.7, gz - 1.8);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.28), plasticMaterial(0xd84a4a, 0.8));
    flag.position.set(gx + 2.0, 1.2, gz - 1.8);
    world.root.add(pole, flag);
    world.propAnims.push({ update: (_dt, t) => { flag.rotation.y = Math.sin(t * 2 + gx) * 0.6; } });
    // hoyo
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.18, 16), new THREE.MeshStandardMaterial({ color: 0x081008 }));
    hole.rotation.x = -Math.PI / 2;
    hole.position.set(gx + 1.8, 0.085, gz - 1.8);
    world.root.add(hole);
  }
  // molino holandés con aspas animadas (sobre el green este, no en el pasillo)
  const mill = new THREE.Group();
  const mBody = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.8, 2.0, 10), plasticMaterial(0x8a5a3a, 0.7));
  mBody.position.y = 1.0;
  const mRoof = new THREE.Mesh(new THREE.ConeGeometry(0.7, 0.7, 10), plasticMaterial(0x6a3a2a, 0.7));
  mRoof.position.y = 2.35;
  const bladesMill = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const bl = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.22, 0.03), woodMaterial([0.6, 0.4]));
    bl.position.x = 0.75;
    const holder = new THREE.Group();
    holder.add(bl);
    holder.rotation.z = (i / 4) * Math.PI * 2;
    bladesMill.add(holder);
  }
  bladesMill.position.set(0, 2.0, 0.85);
  mill.add(mBody, mRoof, bladesMill);
  mill.position.set(38.5, 0, -13.5);
  mill.traverse((o) => { if (o instanceof THREE.Mesh) o.castShadow = true; });
  world.root.add(mill);
  world.addCollider(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(38.5, 1.2, -13.5), new THREE.Vector3(1.7, 2.5, 1.7)), 'windmill');
  world.propAnims.push({ update: (dt) => { bladesMill.rotation.z += dt * 0.8; } });

  // carteles temáticos (boca de caimán)
  const gator = new THREE.Group();
  const gBody = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.2, 0.5), plasticMaterial(0x2a6a3a, 0.6, 0.3));
  gBody.position.y = 0.6;
  const gEyeL = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), plasticMaterial(0x2a6a3a, 0.6));
  gEyeL.position.set(-0.6, 1.3, 0.2);
  const gEyeR = gEyeL.clone();
  gEyeR.position.x = 0.6;
  const gPupil = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshStandardMaterial({ emissive: 0xffd020, emissiveIntensity: 0.9, color: 0x221100 }));
  gPupil.position.set(-0.6, 1.32, 0.36);
  const gPupilR = gPupil.clone();
  gPupilR.position.x = 0.6;
  gator.add(gBody, gEyeL, gEyeR, gPupil, gPupilR);
  gator.position.set(43.4, 0, -13);
  gator.rotation.y = -Math.PI / 2;
  world.root.add(gator);
  world.addCollider(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(43.4, 0.8, -13), new THREE.Vector3(0.7, 1.6, 2.5)), 'gator');

  neonSign(world, 'MONTY GOLF', 0x4ad86e, 35, 3.9, -9.6, 0, 3.4, 0.55);
  planter(world, 28, -10.5);
  planter(world, 42, -16);
  world.anchors.set('tape_golf', { pos: new THREE.Vector3(35.7, 0.08, -12) });
}

/* ============ LA CALA DEL PIRATA (guarida de Foxy) ============ */

function buildPirateCove(world: WorldBuilder) {
  // Sala: x[-44,-29] z[-3,13], h 5. El telón cierra el OESTE con hueco central (z=5).
  const platMat = woodMaterial([3, 1.6]);
  box(1.0, 0.16, 7.0, platMat, -42.8, 0.08, 5, 0, false, world);

  // telón estrellado púrpura: dos paños con hueco central (z=5)
  const curtainMat = new THREE.MeshStandardMaterial({
    map: pirateCurtainTex(),
    roughness: 0.92,
    side: THREE.DoubleSide,
  });
  const curtainPanel = (z: number, w: number) => {
    const cur = new THREE.Mesh(new THREE.BoxGeometry(0.12, 3.4, w), curtainMat);
    cur.position.set(-42.3, 1.72, z);
    cur.castShadow = true;
    cur.receiveShadow = true;
    world.root.add(cur);
    world.addCollider(new THREE.Box3().setFromCenterAndSize(cur.position.clone(), new THREE.Vector3(0.22, 3.4, w)), `cove_curtain_${z}`);
    return cur;
  };
  curtainPanel(1.6, 5.2);
  curtainPanel(8.4, 5.2);
  const valance = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.55, 2.2), curtainMat);
  valance.position.set(-42.3, 3.25, 5);
  world.root.add(valance);
  world.propAnims.push({
    update: (_dt, t) => {
      valance.rotation.x = Math.sin(t * 0.8) * 0.04;
    },
  });

  // pilares del telón
  for (const pz of [2.6, 7.4]) {
    box(0.18, 3.5, 0.18, woodMaterial([0.4, 2]), -42.3, 1.75, pz, 0, true, world);
  }

  // cartel de neón sobre el telón (mirando al este, hacia la sala)
  const neon = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 0.6),
    new THREE.MeshStandardMaterial({ map: pirateCoveSignTex(), emissive: 0x9a7ad8, emissiveIntensity: 0.6, roughness: 0.6 })
  );
  neon.position.set(-42.18, 3.9, 5);
  neon.rotation.y = Math.PI / 2;
  world.root.add(neon);

  // farolillo moribundo dentro de la cala (deja ver los ojos de Foxy)
  world.registerAccent({
    pos: new THREE.Vector3(-43.2, 2.6, 5),
    color: 0x8a6ad8, intensity: 4, distance: 7, decay: 1.9,
  });

  // cartel de madera "FUERA DE SERVICIO" en caballete
  const sign = new THREE.Group();
  const board = new THREE.Mesh(
    new THREE.PlaneGeometry(0.95, 0.48),
    new THREE.MeshStandardMaterial({ map: outOfOrderTex(), roughness: 0.85 })
  );
  board.position.y = 0.62;
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.68, 0.05), woodMaterial([0.2, 1]));
  legL.position.set(-0.34, 0.34, 0.06);
  legL.rotation.z = 0.12;
  const legR = legL.clone();
  legR.position.x = 0.34;
  legR.rotation.z = -0.12;
  sign.add(board, legL, legR);
  sign.position.set(-40.5, 0, 5);
  sign.rotation.set(-0.06, Math.PI / 2, 0.015);
  world.root.add(sign);
  world.addCollider(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(-40.5, 0.5, 5), new THREE.Vector3(0.3, 0.9, 1.0)), 'cove_sign');

  // cofre del tesoro abierto
  const chest = new THREE.Group();
  const chestMat = woodMaterial([1, 0.6]);
  const cBody = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.34, 0.42), chestMat);
  cBody.position.y = 0.17;
  const cLid = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.6, 12, 1, false, 0, Math.PI), chestMat);
  cLid.rotation.z = Math.PI / 2;
  cLid.position.set(0, 0.34, -0.14);
  cLid.rotation.x = -0.5;
  const gold = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xd8a018, emissive: 0x553300, emissiveIntensity: 0.35, metalness: 0.85, roughness: 0.35 })
  );
  gold.position.set(0, 0.3, 0.02);
  gold.scale.set(1.5, 0.6, 1);
  chest.add(cBody, cLid, gold);
  chest.position.set(-41.5, 0, 10.5);
  chest.rotation.y = 0.5;
  chest.traverse((o) => {
    if (o instanceof THREE.Mesh) { o.castShadow = true; o.receiveShadow = true; }
  });
  world.root.add(chest);
  world.addCollider(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(-41.5, 0.25, 10.5), new THREE.Vector3(0.65, 0.5, 0.5)), 'cove_chest');

  // silueta de barco pirata de cartón
  const ship = new THREE.Group();
  const hull = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.28, 1.5, 8, 1, false, 0, Math.PI),
    new THREE.MeshStandardMaterial({ color: 0x6a4a2a, roughness: 0.9 })
  );
  hull.rotation.z = Math.PI / 2;
  hull.position.y = 0.5;
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 1.1, 6), woodMaterial([0.2, 1]));
  mast.position.y = 1.0;
  const sail = new THREE.Mesh(
    new THREE.PlaneGeometry(0.7, 0.65),
    new THREE.MeshStandardMaterial({ color: 0xd9d2be, roughness: 0.95, side: THREE.DoubleSide })
  );
  sail.position.set(0, 1.0, 0.12);
  const flag = new THREE.Mesh(
    new THREE.PlaneGeometry(0.22, 0.14),
    new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.95, side: THREE.DoubleSide })
  );
  flag.position.set(0.14, 1.55, 0.05);
  ship.add(hull, mast, sail, flag);
  ship.position.set(-33, 0.35, 10.5);
  ship.rotation.y = -0.5;
  ship.traverse((o) => {
    if (o instanceof THREE.Mesh) { o.castShadow = true; o.receiveShadow = true; }
  });
  world.root.add(ship);
  world.addCollider(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(-33, 0.8, 10.5), new THREE.Vector3(1.4, 1.8, 0.5)), 'cove_ship');

  // luna recortada y dibujos de Foxy (pared norte)
  const moon = new THREE.Mesh(
    new THREE.CircleGeometry(0.4, 24),
    new THREE.MeshStandardMaterial({ color: 0xd8c890, emissive: 0x554420, emissiveIntensity: 0.3, roughness: 0.8 })
  );
  moon.position.set(-36, 2.8, -2.8);
  world.root.add(moon);
  addDrawing(world, 1, -34, 1.6, -2.82, 0);
  addDrawing(world, 2, -38, 1.6, -2.82, 0);

  // interruptores de la atracción (PRUEBA cap 4) — a lo largo de la pared sur
  for (let i = 0; i < 3; i++) {
    const sw = new THREE.Group();
    const boxS = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.14), metalMaterial([0.4, 0.5]));
    const lever = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.3, 0.08), plasticMaterial(0xcc2222, 0.5));
    lever.position.set(0, 0.1, 0.1);
    sw.add(boxS, lever);
    sw.position.set(-40.5 + i * 3.5, 1.4, 12.8);
    world.root.add(sw);
  }
  world.anchors.set('tape_cove', { pos: new THREE.Vector3(-33, 1.0, 10.5) });
}

/* ============ ALMACÉN OESTE (v12 — la antigua guardería ahora es un archivo de storage) ============ */

/** v12 — ya no hay alberca de pelotas: región vacía (nadie "vadea" nada) */
export const BALL_PIT = { x1: 1e9, z1: 1e9, x2: 1e9, z2: 1e9 };

function buildWestStorage(world: WorldBuilder) {
  // Sala: x[-29,-16] z[-3,13], h 4.5 — oscura, cargada de estanterías y cajas
  const crateMat = woodMaterial([0.55, 0.8]);

  // filas de estanterías de archivo contra las paredes
  shelfUnit(world, -28.4, 0.8, Math.PI / 2, 2.6, 6);
  shelfUnit(world, -28.4, 4.6, Math.PI / 2, 2.6, 6);
  shelfUnit(world, -28.4, 8.4, Math.PI / 2, 2.6, 5);
  shelfUnit(world, -23.2, 12.35, 0, 3.2, 6);
  shelfUnit(world, -17.3, 0.2, -Math.PI / 2, 2.6, 5);

  // pilas de cajas de madera en el suelo
  const crateStack = (x: number, z: number, n: number) => {
    for (let i = 0; i < n; i++) {
      box(0.72, 0.5, 0.66, crateMat, x + (Math.random() - 0.5) * 0.12, 0.26 + i * 0.52, z + (Math.random() - 0.5) * 0.12, (Math.random() - 0.5) * 0.3, i === 0, world);
    }
  };
  crateStack(-25.5, 4.8, 3);
  crateStack(-24.0, 10.8, 2);
  crateStack(-19.0, 9.2, 3);
  crateStack(-18.3, 2.4, 2);

  // cajas de cartón sueltas (IM barato)
  const cGeo = new THREE.BoxGeometry(0.46, 0.36, 0.4);
  const cMat = new THREE.MeshStandardMaterial({ color: 0x8a6a42, roughness: 0.93 });
  const N = 34;
  const im = new THREE.InstancedMesh(cGeo, cMat, N);
  const dummy = new THREE.Object3D();
  const spots: Array<[number, number]> = [
    [-27.5, 2.2], [-26.9, 6.9], [-27.4, 11.4], [-24.5, 2.0], [-23.6, 5.6], [-22.2, 9.9],
    [-20.4, 4.2], [-19.6, 11.4], [-18.2, 6.6], [-25.8, 8.2], [-21.0, 1.4], [-17.8, 11.0],
    [-23.8, 8.0], [-20.0, 7.8], [-25.2, 5.4], [-19.2, 3.0], [-22.8, 11.3], [-26.4, 3.7],
    [-27.8, 9.5], [-18.7, 8.3], [-24.2, 12.2], [-21.4, 10.4], [-19.0, 0.6], [-23.0, 3.4],
    [-17.6, 4.8], [-25.0, 10.2], [-22.0, 6.2], [-20.8, 2.6], [-24.8, 6.4], [-18.6, 10.6],
    [-26.0, 12.0], [-21.6, 0.9], [-19.4, 5.8], [-23.4, 6.9],
  ];
  for (let i = 0; i < N; i++) {
    const [sx, sz] = spots[i % spots.length];
    dummy.position.set(sx + (Math.random() - 0.5) * 0.5, 0.18, sz + (Math.random() - 0.5) * 0.5);
    dummy.rotation.set(0, Math.random() * Math.PI, 0);
    const s = 0.8 + Math.random() * 0.5;
    dummy.scale.set(s, s, s);
    dummy.updateMatrix();
    im.setMatrixAt(i, dummy.matrix);
  }
  im.castShadow = false;
  im.receiveShadow = true;
  world.root.add(im);

  // archivadores metálicos apoyados en la pared este
  for (const [fx, fz, fry] of [[-16.9, 3.4, -Math.PI / 2], [-16.9, 5.6, -Math.PI / 2], [-16.9, 7.8, -Math.PI / 2]] as Array<[number, number, number]>) {
    box(0.5, 1.3, 0.62, darkMetalMaterial(), fx, 0.65, fz, fry, true, world);
    // cajones
    for (let dr = 0; dr < 3; dr++) {
      box(0.42, 0.34, 0.05, metalMaterial([0.3, 0.7]), fx - 0.33, 0.3 + dr * 0.4, fz, fry, false, world);
    }
  }

  // palet con sacos
  box(1.6, 0.14, 1.2, woodMaterial([0.5, 1.1]), -20.5, 0.09, 3.4, 0.2, true, world);
  for (let i = 0; i < 4; i++) {
    box(0.7, 0.34, 0.5, new THREE.MeshStandardMaterial({ color: 0x7a6a4a, roughness: 0.95 }), -20.5 + (i % 2) * 0.35 - 0.18, 0.34 + Math.floor(i / 2) * 0.36, 3.4, (Math.random() - 0.5) * 0.4, false, world);
  }

  // arcón-escondite (chest_daycare del mapData en (-26.5, 7.5))
  box(1.6, 0.8, 0.85, woodMaterial([0.5, 0.9]), -26.5, 0.4, 7.5, 0.2, true, world);

  // bombilla colgante rota + luz de emergencia
  brokenLight(world, -22.5, 6.2, 3.7);
  brokenLight(world, -19.5, 10.2, 3.7);

  // carretilla y fregadero de mantenimiento
  box(0.8, 0.4, 0.5, metalMaterial([0.35, 0.9]), -17.8, 0.22, 12.3, 0.7, true, world);

  // letrero y carteles
  neonSign(world, 'WEST STORAGE', 0x70d0ff, -22.5, 3.6, -2.72, 0, 3.4, 0.5);
  addPoster(world, posterBruno(), -28.85, 2.0, 7.5, Math.PI / 2);
  addPoster(world, posterParty(), -28.85, 2.0, 9.8, Math.PI / 2);
  addDrawing(world, 2, -16.15, 1.6, 5.5, -Math.PI / 2);
  addDrawing(world, 4, -16.15, 1.6, 10.2, -Math.PI / 2);

  // cinta de mantenimiento (tape_w4) sobre una estantería
  world.anchors.set('tape_daycare', { pos: new THREE.Vector3(-28.4, 1.15, 4.6) });
}

/* ============ PLAZA DE COMIDA ============ */

function buildFoodcourt(world: WorldBuilder) {
  // Sala: x[16,31] z[-3,13]
  // mesas redondas con bancos
  for (let i = 0; i < 6; i++) {
    const tx = 19.5 + (i % 3) * 4.5;
    const tz = 2.5 + ((i / 3) | 0) * 5;
    const table = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.55, 0.75, 14), plasticMaterial(0x8a5a3a, 0.5, 0.2));
    table.position.set(tx, 0.375, tz);
    table.castShadow = true;
    world.root.add(table);
    world.addCollider(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(tx, 0.5, tz), new THREE.Vector3(1.3, 0.9, 1.3)), `ftable_${i}`);
    for (const ang of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      const stool = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.16, 0.55, 10), plasticMaterial(0xd8442a, 0.7));
      stool.position.set(tx + Math.cos(ang) * 1.15, 0.275, tz + Math.sin(ang) * 1.15);
      world.root.add(stool);
    }
  }
  // mostradores de comida (pared norte)
  const counters: Array<[number, number, string, number]> = [
    [20, -2.2, 'PIZZA', 0xd8442a],
    [25, -2.2, 'FRIES', 0xd8a83a],
  ];
  for (const [cx, cz, label, color] of counters) {
    box(3.6, 1.05, 0.9, plasticMaterial(0x33363c, 0.5, 0.3), cx, 0.525, cz, 0, true, world);
    neonSign(world, label, color, cx, 2.6, -2.72, 0, 1.8, 0.42);
    // menú emisivo
    const menu = new THREE.Mesh(
      new THREE.PlaneGeometry(2.4, 1.0),
      new THREE.MeshStandardMaterial({ map: screenStaticTex(), emissive: 0x88ff88, emissiveMap: screenStaticTex(), emissiveIntensity: 0.45, color: 0x111111 })
    );
    menu.position.set(cx, 2.6, -2.68);
    world.root.add(menu);
    FLICKER_SCREENS.push(menu);
  }
  // bandejas y papeleras
  trashBin(world, 29, 6);
  trashBin(world, 17.5, 9);
  planter(world, 29.5, 11);
  ceilingFan(world, 23, 5, 4.0);
  addPoster(world, posterParty(), 16.15, 2.0, 5, Math.PI / 2);
  world.anchors.set('key_foodcourt', { pos: new THREE.Vector3(19.5, 1.1, 2.5) });
  world.anchors.set('tape_foodcourt', { pos: new THREE.Vector3(28, 1.1, 10) });
}

/* ============ BAÑOS ============ */

function buildRestrooms(world: WorldBuilder) {
  // Sala: x[31,44] z[-3,13], h 3.6. División central en x=37.5
  const tileMat = plasticMaterial(0x8a8a80, 0.3, 0.4);
  // muro divisorio con paso
  box(0.25, 3.6, 6.4, tileMat, 37.5, 1.8, -0.2, 0, true, world);
  // cabinas (oeste)
  for (let i = 0; i < 3; i++) {
    box(0.9, 2.1, 1.2, tileMat, 32.6, 1.05, 8.5 - i * 1.5, 0, true, world);
  }
  // lavabos (ambos lados; el oeste retirado de la puerta)
  box(2.2, 0.85, 0.6, tileMat, 43.5, 0.42, 4.5, Math.PI / 2, true, world);
  box(2.2, 0.85, 0.6, tileMat, 31.6, 0.42, 6.8, Math.PI / 2, true, world);
  for (let i = 0; i < 2; i++) {
    for (const bx of [43.5, 31.6]) {
      const sink = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.12, 10), plasticMaterial(0xd8d2c8, 0.3, 0.5));
      sink.position.set(bx, 0.95, 3.7 + i * 0.7);
      world.root.add(sink);
    }
  }
  // espejos
  for (const bx of [43.6, 31.5]) {
    const mirror = new THREE.Mesh(
      new THREE.PlaneGeometry(1.6, 0.9),
      new THREE.MeshPhysicalMaterial({ color: 0x0a0c0e, roughness: 0.08, metalness: 0.9 })
    );
    mirror.position.set(bx, 1.7, 4.5);
    mirror.rotation.y = bx > 40 ? -Math.PI / 2 : Math.PI / 2;
    world.root.add(mirror);
  }
  // luz parpadeante muy intensa (clásico terror)
  brokenLight(world, 37.5, 4.5, 3.3);
  world.anchors.set('tape_restrooms', { pos: new THREE.Vector3(32.6, 1.2, 8.5) });
}

/* ============ PASEOS (promenades) ============ */

function buildProms(world: WorldBuilder) {
  // westPromN: x[-44,-16] z[-9,-3]
  // eastPromN: x[16,44] z[-9,-3]
  // promS: x[-44,44] z[13,19]
  // Bancas y jardineras
  mallBench(world, -38, -6, 0);
  mallBench(world, -28, -6, 0);
  mallBench(world, -20, -6, 0);
  mallBench(world, 20, -6, 0);
  mallBench(world, 28, -6, 0);
  mallBench(world, 36, -6, 0);
  mallBench(world, -36, 16, 0);
  mallBench(world, 0, 16, Math.PI);
  mallBench(world, 30, 16, 0);
  planter(world, -42, -6);
  planter(world, -17, -6);
  planter(world, 17, -6);
  planter(world, 42, -6);
  planter(world, -30, 16.5);
  planter(world, 15, 16.5);
  planter(world, 40, 16.5);
  // máquinas expendedoras
  vendingMachine(world, -22, -8.4, 0, 0xff5544);
  vendingMachine(world, 34, -8.4, 0, 0x44aaff);
  vendingMachine(world, -8, 18.2, Math.PI, 0xffc83a);
  // papeleras
  trashBin(world, -26, -6);
  trashBin(world, 26, -6);
  trashBin(world, -20, 16);
  trashBin(world, 20, 16);
  // carteles direcciones
  neonSign(world, 'ATRIO →', 0x44ff88, -16.3, 2.9, -6, Math.PI / 2, 1.5, 0.4);
  neonSign(world, '← ATRIO', 0x44ff88, 16.3, 2.9, -6, -Math.PI / 2, 1.5, 0.4);
  neonSign(world, "PIRATE'S COVE", 0x9a7ad8, -36.5, 2.9, -3.5, Math.PI, 2.8, 0.45);
  neonSign(world, 'DAYCARE', 0xffd070, -22, 2.9, -3.5, Math.PI, 1.8, 0.45);
  neonSign(world, 'COMIDA', 0xff8844, 23, 2.9, -3.5, Math.PI, 1.5, 0.45);
  neonSign(world, 'RESTROOMS', 0x88aaff, 37, 2.9, -3.5, Math.PI, 1.2, 0.4);
  neonSign(world, 'LOBBY', 0x44ff88, 0, 3.1, 13.4, 0, 2.0, 0.45);
  neonSign(world, 'OFFICE', 0xffd070, -37.5, 2.9, 18.7, Math.PI, 1.5, 0.4);
  // pósters
  addPoster(world, posterBruno(), -30, 2.0, -8.85, 0);
  addPoster(world, posterParty(), -24, 2.0, -8.85, 0);
  addPoster(world, posterBruno(), 24, 2.0, -8.85, 0);
  addPoster(world, posterParty(), 30, 2.0, -8.85, 0);
  addPoster(world, posterBruno(), -10, 2.0, 18.85, Math.PI);
  addPoster(world, posterParty(), 10, 2.0, 18.85, Math.PI);
  addDrawing(world, 2, -30, 1.7, 12.85, Math.PI);
  addDrawing(world, 0, -20, 1.7, 12.85, Math.PI);
  // ventiladores de techo
  ceilingFan(world, -34, -6, 3.7);
  ceilingFan(world, -24, -6, 3.7);
  ceilingFan(world, 24, -6, 3.7);
  ceilingFan(world, 34, -6, 3.7);
  ceilingFan(world, -20, 16, 3.7);
  ceilingFan(world, 20, 16, 3.7);
  brokenLight(world, -10, 16, 3.6);
  // duchas de emergencia de las cabinas de seguridad (armarios ya puestos por hidingSpots visuales)
  world.anchors.set('tape_promS', { pos: new THREE.Vector3(-30, 1.0, 16.5) });
  world.anchors.set('payphone', { pos: new THREE.Vector3(-42.5, 1.2, 16.5) });
  // teléfono público
  const phone = new THREE.Group();
  const phoneBody = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.5, 0.18), plasticMaterial(0x33261a, 0.6));
  phoneBody.position.y = 0.4;
  const phoneBox = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 0.22), darkMetalMaterial());
  phoneBox.position.y = 1.32;
  phone.add(phoneBody, phoneBox);
  phone.position.set(-43.6, 0, 15);
  phone.rotation.y = Math.PI / 2;
  world.root.add(phone);
}

/* ============ VESTÍBULO PRINCIPAL ============ */

function buildLobby(world: WorldBuilder) {
  // Sala: x[-31,20] z[19,34], h 6. Entrada sur con puertas de salida.
  // ESTÁTUA GIGANTE DE FREDDY (centro)
  const statue = new THREE.Group();
  const sPed = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.6, 1.0, 16), plasticMaterial(0x8a6a4a, 0.6));
  sPed.position.y = 0.5;
  const sBody = new THREE.Mesh(new THREE.CapsuleGeometry(0.75, 1.3, 10, 16), plasticMaterial(0x6a4a2a, 0.45, 0.4));
  sBody.position.y = 2.2;
  const sHead = new THREE.Mesh(new THREE.SphereGeometry(0.62, 16, 14), plasticMaterial(0x6a4a2a, 0.45, 0.4));
  sHead.position.y = 3.55;
  // orejas + sombrero de copa
  for (const ex of [-0.42, 0.42]) {
    const ear = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.1, 10), plasticMaterial(0x6a4a2a, 0.45, 0.4));
    ear.rotation.z = Math.PI / 2;
    ear.position.set(ex, 4.1, 0);
    statue.add(ear);
  }
  const hatB = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.38, 0.42, 12), plasticMaterial(0x1a1a1e, 0.5, 0.3));
  hatB.position.set(0, 4.25, 0.12);
  const hatTop = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.34, 12), plasticMaterial(0x1a1a1e, 0.5, 0.3));
  hatTop.position.set(0, 4.55, 0.12);
  // ojos emisivos
  for (const ex of [-0.24, 0.24]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), new THREE.MeshStandardMaterial({ color: 0x221100, emissive: 0xffd070, emissiveIntensity: 1.0 }));
    eye.position.set(ex, 3.68, 0.5);
    statue.add(eye);
  }
  // lazo del sombrero
  const tie = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.1, 0.02), plasticMaterial(0x1a1a1e, 0.5));
  tie.position.set(0, 4.12, 0.36);
  statue.add(sPed, sBody, sHead, hatB, hatTop, tie);
  statue.position.set(-5, 0, 27);
  statue.traverse((o) => { if (o instanceof THREE.Mesh) o.castShadow = true; });
  world.root.add(statue);
  world.addCollider(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(-5, 2.5, 27), new THREE.Vector3(2.0, 5.0, 2.0)), 'freddy_statue');
  world.registerAccent({
    pos: new THREE.Vector3(-5, 5.6, 29.5),
    target: new THREE.Vector3(-5, 3, 27),
    color: 0xffd9a8, intensity: 22, distance: 9, angle: 0.5, penumbra: 0.5, spot: true,
  });

  // tornos de entrada (fila) entre las puertas sur
  for (let i = 0; i < 5; i++) {
    const tsx = -12 + i * 6;
    if (tsx > -8.2 && tsx < -2.8) continue; // hueco de la puerta de salida
    const turn = new THREE.Group();
    const post1 = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.1, 8), darkMetalMaterial());
    post1.position.set(-0.55, 0.55, 0);
    const post2 = post1.clone();
    post2.position.x = 0.55;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.06, 0.05), metalMaterial([0.4, 0.4]));
    arm.position.set(0, 0.95, 0);
    turn.add(post1, post2, arm);
    turn.position.set(tsx, 0, 31.5);
    world.root.add(turn);
    world.propAnims.push({ update: (dt, t) => { arm.rotation.y = Math.sin(t * 0.6 + i) * 0.8; } });
    world.addCollider(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(tsx, 0.6, 31.5), new THREE.Vector3(1.3, 1.2, 0.3)), `turnstile_${i}`);
  }

  // escalera mecánica tapiada (decoración noroeste)
  const escalator = new THREE.Group();
  for (let s = 0; s < 10; s++) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.18, 0.35), metalMaterial([0.5, 0.3]));
    step.position.set(0, 0.3 + s * 0.32, -s * 0.55);
    escalator.add(step);
  }
  const balus = new THREE.Mesh(new THREE.BoxGeometry(0.06, 3.8, 6.4), darkMetalMaterial());
  balus.position.set(0.62, 1.9, -2.9);
  const balus2 = balus.clone();
  balus2.position.x = -0.62;
  escalator.add(balus, balus2);
  escalator.position.set(-27, 0, 22.5);
  escalator.rotation.y = -0.4;
  world.root.add(escalator);
  // barrera FUERA DE SERVICIO
  const barrier = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.4, 0.08), plasticMaterial(0xd8a81a, 0.6));
  barrier.position.set(-27, 1.2, 24.6);
  barrier.rotation.y = -0.4;
  world.root.add(barrier);
  world.addCollider(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(-27, 1.8, 24), new THREE.Vector3(2.4, 3.6, 1.4)), 'escalator_block');

  // fuentes de techo: lucernario emisivo
  const skylight = new THREE.Mesh(
    new THREE.PlaneGeometry(14, 8),
    new THREE.MeshStandardMaterial({ color: 0x0a0e1a, emissive: 0x223044, emissiveIntensity: 0.5 })
  );
  skylight.rotation.x = Math.PI / 2;
  skylight.position.set(-5, 5.95, 27);
  world.root.add(skylight);

  // mostrador de tickets + plantas
  box(2.6, 1.05, 0.8, woodMaterial([1.4, 0.7]), 12, 0.525, 22, 0.1, true, world);
  planter(world, -28, 32);
  planter(world, 16, 32);
  planter(world, -28, 20.5);
  trashBin(world, 0, 30);
  trashBin(world, -12, 25);
  neonSign(world, 'BRUNO COMPLEX', 0xffc83a, -5, 5.2, 33.8, Math.PI, 6.0, 1.0);
  neonSign(world, 'SALIDA', 0x22ff44, -5.5, 2.9, 33.8, Math.PI, 1.6, 0.5);
  addPoster(world, posterBruno(), 19.85, 2.4, 27, -Math.PI / 2, 1.4, 1.8);
  addDrawing(world, 3, -18, 1.7, 33.85, Math.PI);
  addDrawing(world, 4, 8, 1.7, 33.85, Math.PI);
  world.anchors.set('tape_lobby', { pos: new THREE.Vector3(12, 1.1, 22) });
  world.anchors.set('exit_door', { pos: new THREE.Vector3(-5.5, 1.2, 33.5) });
}

/* ============ PASILLO TÉCNICO (larga espina dorsal del complejo) ============ */

function buildTechHall(world: WorldBuilder) {
  // Sala: x[-44,44] z[-24,-17], h 3.4. Tuberías y armarios.
  const pipeMat = metalMaterial([8, 1]);
  for (let i = 0; i < 3; i++) {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.09 + i * 0.03, 0.09 + i * 0.03, 87, 10), pipeMat);
    pipe.rotation.z = Math.PI / 2;
    pipe.position.set(0, 2.6 + i * 0.28, -23.3 - i * 0.05);
    world.root.add(pipe);
  }
  for (let i = 0; i < 3; i++) {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 87, 10), pipeMat);
    pipe.rotation.z = Math.PI / 2;
    pipe.position.set(0, 2.2 - i * 0.3, -17.7 + i * 0.05);
    world.root.add(pipe);
  }
  // válvulas y cajas de unión
  for (let i = 0; i < 8; i++) {
    const vx = -38 + i * 10;
    const valve = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.035, 8, 14), darkMetalMaterial());
    valve.rotation.y = Math.PI / 2;
    valve.position.set(vx, 2.3, -23.1);
    world.root.add(valve);
    if (i % 2 === 0) {
      const jbox = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.2), metalMaterial([0.4, 0.5]));
      jbox.position.set(vx + 5, 1.6, -17.4);
      world.root.add(jbox);
    }
  }
  // señales de peligro (planos emisivos tenues)
  for (let i = 0; i < 6; i++) {
    const wx = -30 + i * 12;
    const warn = new THREE.Mesh(
      new THREE.PlaneGeometry(0.55, 0.55),
      new THREE.MeshStandardMaterial({ color: 0x332211, emissive: 0xd8a81a, emissiveIntensity: 0.35 })
    );
    warn.position.set(wx, 2.2, -24.15 + 0.17);
    world.root.add(warn);
  }
  // luz de emergencia oscilante extra
  brokenLight(world, 0, -20.5, 3.2);
  brokenLight(world, 20, -20.5, 3.2);
  trashBin(world, -10, -20.5);
  world.anchors.set('tape_tech', { pos: new THREE.Vector3(10, 1.2, -20.5) });
}

/* ============ SERVICIOS (taller, cocina, almacenes, eléctrico, fríos, muelle) ============ */

function buildServices(world: WorldBuilder) {
  /* TALLER DE PIEZAS: x[-44,-30] z[-34,-24] */
  const benchMat = woodMaterial([1, 0.5]);
  box(4.2, 0.9, 1.1, benchMat, -39, 0.45, -30.5, 0, true, world);
  box(3.0, 0.9, 1.0, benchMat, -33.5, 0.45, -33, 0.3, true, world);
  world.anchors.set('workbench', { pos: new THREE.Vector3(-39, 0.95, -30.5) });
  world.anchors.set('fuse_workshop', { pos: new THREE.Vector3(-33.5, 0.95, -33) });
  // cabezas de repuesto
  const wallMat = plasticMaterial(0x7a6a58, 0.6);
  for (let i = 0; i < 3; i++) {
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 12), wallMat);
    head.position.set(-43.6, 0.7 + i * 0.65, -28 - i * 0.3);
    world.root.add(head);
    const eyes = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 6), new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0x333311, emissiveIntensity: 0.4 }));
    eyes.position.set(-43.42, 0.72 + i * 0.65, -28 - i * 0.3);
    world.root.add(eyes);
  }
  // endoesqueleto de repuesto
  const endo = buildSpareEndoskeleton();
  endo.position.set(-33.5, 0.95, -33);
  endo.rotation.y = 0.4;
  world.root.add(endo);
  shelfUnit(world, -43.5, -32.5, Math.PI / 2, 2.4, 4);
  world.anchors.set('tape_workshop', { pos: new THREE.Vector3(-37, 0.95, -30.5) });

  /* COCINA INDUSTRIAL: x[-30,-14] z[-34,-24] */
  const steel = metalMaterial([1, 1]);
  box(10.0, 0.9, 0.7, steel, -24, 0.45, -33.3, 0, true, world);
  box(0.7, 0.9, 4.5, steel, -28.9, 0.45, -30.5, 0, true, world);
  box(3.0, 1.1, 0.9, darkMetalMaterial(), -19, 0.55, -33.2, 0, true, world);
  box(1.4, 2.3, 0.95, steel, -15.5, 1.15, -33.2, 0, true, world);
  // cacerolas colgantes
  const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 8, 6), darkMetalMaterial());
  rail.rotation.z = Math.PI / 2;
  rail.position.set(-23, 2.3, -30);
  world.root.add(rail);
  for (let i = 0; i < 7; i++) {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.11, 0.16, 10), darkMetalMaterial());
    pot.position.set(-26.3 + i * 1.0, 2.12, -30);
    world.root.add(pot);
  }
  box(2.6, 0.9, 1.0, steel, -20, 0.45, -26, 0, true, world);
  box(2.4, 0.5, 0.8, darkMetalMaterial(), -19, 3.6, -33.4, 0, false, world);
  world.anchors.set('tape_kitchen', { pos: new THREE.Vector3(-20, 0.95, -26) });

  /* ALMACÉN NORTE: x[-14,2] z[-34,-24] */
  shelfUnit(world, -11.5, -32.5, 0, 2.6, 7);
  shelfUnit(world, -6, -27.5, Math.PI / 2, 2.4, 5);
  shelfUnit(world, -1.5, -32.5, 0, 2.6, 6);
  world.anchors.set('fuse_storageN', { pos: new THREE.Vector3(-11.5, 1.05, -32.5) });
  for (let i = 0; i < 4; i++) {
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.9, 12), plasticMaterial(0x3a4a3a, 0.8));
    barrel.position.set(-12.5 + (i % 2) * 0.7, 0.45, -25.5 + ((i / 2) | 0) * 0.7);
    barrel.castShadow = true;
    world.root.add(barrel);
    world.addCollider(new THREE.Box3().setFromCenterAndSize(barrel.position.clone(), new THREE.Vector3(0.65, 0.9, 0.65)));
  }

  /* MUELLE DE CARGA: x[2,16] z[-34,-24] */
  for (let i = 0; i < 6; i++) {
    const crate = new THREE.Mesh(
      new THREE.BoxGeometry(1.0 + Math.random() * 0.5, 0.8 + Math.random() * 0.4, 1.0),
      new THREE.MeshStandardMaterial({ color: 0x6b5a3e, roughness: 0.88 })
    );
    crate.position.set(4 + (i % 3) * 2.2, 0.5, -32 - ((i / 3) | 0) * 1.6);
    crate.rotation.y = (Math.random() - 0.5) * 0.3;
    crate.castShadow = true;
    world.root.add(crate);
    world.addCollider(new THREE.Box3().setFromCenterAndSize(crate.position.clone(), new THREE.Vector3(1.3, 1.2, 1.1)), `crate_${i}`);
  }
  // portón de camión cerrado
  const shutter = new THREE.Mesh(new THREE.BoxGeometry(4.0, 3.4, 0.15), metalMaterial([2, 1]));
  shutter.position.set(9, 1.7, -33.8);
  world.root.add(shutter);
  world.anchors.set('tape_loading', { pos: new THREE.Vector3(12, 1.1, -26) });

  /* CUARTO ELÉCTRICO: x[16,30] z[-34,-24] */
  const panelMat = metalMaterial([0.8, 1]);
  box(2.2, 1.5, 1.4, darkMetalMaterial(), 27.5, 0.75, -31, 0, true, world);
  const genLight = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.2, 0.05),
    new THREE.MeshStandardMaterial({ color: 0x113311, emissive: 0x33ff44, emissiveIntensity: 1.2 })
  );
  genLight.position.set(27.5, 1.3, -30.28);
  world.root.add(genLight);
  world.propAnims.push({
    update: (_dt, t) => {
      const m = genLight.material as THREE.MeshStandardMaterial;
      m.emissiveIntensity = 0.9 + Math.sin(t * 12) * 0.25;
    },
  });
  // paneles de interruptores (dos tareas del cap 1)
  for (let p = 0; p < 2; p++) {
    const px = 20.5 + p * 3.4;
    const pg = new THREE.Group();
    const pbody = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.7, 0.15), panelMat);
    pg.add(pbody);
    for (let i = 0; i < 4; i++) {
      const sw = new THREE.Mesh(
        new THREE.BoxGeometry(0.24, 0.32, 0.08),
        new THREE.MeshStandardMaterial({ color: i % 2 ? 0x8a2020 : 0x208a3a, roughness: 0.5 })
      );
      sw.position.set(-0.45 + i * 0.3, 0.25, 0.12);
      pg.add(sw);
      (sw as unknown as { switchIndex?: number }).switchIndex = i;
      (sw as unknown as { panelIndex?: number }).panelIndex = p;
    }
    pg.position.set(px, 1.65, -33.6);
    world.root.add(pg);
  }
  world.anchors.set('breaker_1', { pos: new THREE.Vector3(20.5, 1.65, -33.4) });
  world.anchors.set('breaker_2', { pos: new THREE.Vector3(23.9, 1.65, -33.4) });
  world.anchors.set('electrical_panel', { pos: new THREE.Vector3(27.5, 1.6, -29.8) });
  shelfUnit(world, 18.5, -25.8, 0, 1.8, 3);
  world.anchors.set('tape_electrical', { pos: new THREE.Vector3(18.5, 1.1, -25.8) });
  // nota del orden
  const note = new THREE.Mesh(
    new THREE.PlaneGeometry(0.24, 0.3),
    new THREE.MeshStandardMaterial({ color: 0xd9d2be, emissive: 0x444422, emissiveIntensity: 0.05 })
  );
  note.position.set(26, 1.9, -24.15 + 0.17);
  world.root.add(note);
  world.anchors.set('note_order', { pos: new THREE.Vector3(26, 1.9, -24), mesh: note });

  /* CÁMARAS FRÍAS: x[30,44] z[-34,-24] */
  for (let i = 0; i < 4; i++) {
    box(1.2, 2.2, 1.0, metalMaterial([0.5, 0.5]), 33 + (i % 2) * 1.8, 1.1, -31 + ((i / 2) | 0) * 2.2, 0, true, world);
  }
  // estanterías de helado con cajas
  shelfUnit(world, 42.5, -28, Math.PI / 2, 2.4, 6);
  // escarcha (planos azulados)
  for (let i = 0; i < 3; i++) {
    const frost = new THREE.Mesh(
      new THREE.PlaneGeometry(2.2, 2.6),
      new THREE.MeshStandardMaterial({ color: 0x8ab0c8, roughness: 0.9, transparent: true, opacity: 0.16 })
    );
    frost.position.set(38 + i * 2.0, 1.6, -33.8);
    world.root.add(frost);
  }
  world.registerAccent({
    pos: new THREE.Vector3(37, 3.2, -29),
    color: 0x88bbdd, intensity: 3.2, distance: 12, decay: 1.8,
  });
  world.anchors.set('tape_freezers', { pos: new THREE.Vector3(42.5, 1.1, -28) });
}

/* ============ SALA DE GENERADORES (prueba final) ============ */

function buildGenerator(world: WorldBuilder) {
  // Sala: x[20,31] z[19,34], h 4.5
  const steel = metalMaterial([1.2, 1]);
  for (let i = 0; i < 3; i++) {
    const gx = 22 + i * 3.2;
    const gen = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.7, 3.2), darkMetalMaterial());
    body.position.y = 0.85;
    const pipe1 = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3.0, 8), steel);
    pipe1.rotation.x = Math.PI / 2;
    pipe1.position.set(0, 1.8, 0.5);
    const pipe2 = pipe1.clone();
    pipe2.position.z = -0.5;
    const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 1.4, 8), steel);
    stack.position.set(0.6, 2.4, 0);
    const light = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.16, 0.05),
      new THREE.MeshStandardMaterial({ color: 0x113311, emissive: 0x33ff44, emissiveIntensity: 0.6 })
    );
    light.position.set(0, 1.2, 1.63);
    gen.add(body, pipe1, pipe2, stack, light);
    gen.position.set(gx, 0, 27);
    gen.traverse((o) => { if (o instanceof THREE.Mesh) o.castShadow = true; });
    world.root.add(gen);
    world.addCollider(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(gx, 1, 27), new THREE.Vector3(2.3, 2.0, 3.3)), `gen_${i}`);
    world.propAnims.push({
      update: (_dt, t) => {
        const m = light.material as THREE.MeshStandardMaterial;
        m.emissiveIntensity = 0.5 + Math.sin(t * 8 + i) * 0.3;
      },
    });
  }
  // PANEL MAESTRO con 4 interruptores (secuencia 3-1-4-2) en la pared norte
  const master = new THREE.Group();
  const mBody = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.6, 0.16), metalMaterial([0.8, 1]));
  master.add(mBody);
  for (let i = 0; i < 4; i++) {
    const sw = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.42, 0.1),
      new THREE.MeshStandardMaterial({ color: 0x8a2020, roughness: 0.45 })
    );
    sw.position.set(-0.9 + i * 0.6, 0.15, 0.14);
    master.add(sw);
  }
  master.position.set(25.5, 1.9, 19.5);
  world.root.add(master);
  world.anchors.set('master_switches', { pos: new THREE.Vector3(25.5, 1.9, 19.8) });

  // barriles de aceite
  for (let i = 0; i < 3; i++) {
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.95, 12), plasticMaterial(0x1a3a1a, 0.7));
    drum.position.set(29.8, 0.48, 22 + i * 1.0);
    drum.castShadow = true;
    world.root.add(drum);
    world.addCollider(new THREE.Box3().setFromCenterAndSize(drum.position.clone(), new THREE.Vector3(0.7, 1, 0.7)));
  }
  world.anchors.set('tape_generator', { pos: new THREE.Vector3(29.8, 1.2, 22) });
}

/* ============ ALMACÉN SUR + SALA DE BOMBAS + SALA TÉCNICA SUR ============ */

function buildSouthService(world: WorldBuilder) {
  /* ALMACÉN SUR: x[31,44] z[19,27] */
  shelfUnit(world, 34, 25, 0, 3.0, 6);
  shelfUnit(world, 41.5, 22.5, Math.PI / 2, 3.0, 5);
  world.anchors.set('fuse_storageS', { pos: new THREE.Vector3(34, 1.05, 25) });
  world.anchors.set('tape_storageS', { pos: new THREE.Vector3(41.5, 1.05, 22.5) });

  /* SALA DE BOMBAS: x[31,44] z[27,34] */
  const steel = metalMaterial([1.2, 1]);
  for (let i = 0; i < 2; i++) {
    box(1.8, 1.2, 1.4, darkMetalMaterial(), 35 + i * 3.4, 0.6, 31.5, 0, true, world);
    const pump = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 1.1, 10), steel);
    pump.position.set(35 + i * 3.4, 1.7, 31.5);
    world.root.add(pump);
  }
  const pipeH = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 12, 8), steel);
  pipeH.rotation.z = Math.PI / 2;
  pipeH.position.set(37, 3.0, 33.5);
  world.root.add(pipeH);
  for (let i = 0; i < 4; i++) {
    const pipeV = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 3.4, 8), steel);
    pipeV.position.set(32 + i * 3.2, 1.7, 33.4);
    world.root.add(pipeV);
  }
  world.anchors.set('tape_pump', { pos: new THREE.Vector3(38.4, 1.3, 31.5) });

  /* SALA TÉCNICA SUR: x[-44,-31] z[29,34] — rincón del DORADO */
  shelfUnit(world, -36, 32.5, 0, 2.4, 4);
  // v13: el banco de lockers de esta sala lo pone buildLockerBanks
  // traje dorado inquietante contra la pared
  const goldenSuit = new THREE.Group();
  const gbody = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.7, 8, 12), plasticMaterial(0xd8a838, 0.5, 0.5));
  gbody.position.y = 1.0;
  const ghead = new THREE.Mesh(new THREE.SphereGeometry(0.21, 12, 12), plasticMaterial(0xd8a838, 0.5, 0.5));
  ghead.position.y = 1.65;
  const geye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), new THREE.MeshStandardMaterial({ color: 0x110000, emissive: 0xffd070, emissiveIntensity: 0.7 }));
  geye.position.set(-0.08, 1.7, 0.17);
  const geye2 = geye.clone();
  geye2.position.x = 0.08;
  goldenSuit.add(gbody, ghead, geye, geye2);
  goldenSuit.position.set(-33, 0, 33);
  goldenSuit.rotation.y = Math.PI;
  world.root.add(goldenSuit);
  world.anchors.set('tape_golden', { pos: new THREE.Vector3(-33, 1.0, 33) });
  // luz muy tenue parpadeante
  brokenLight(world, -38, 31.5, 3.0);
}

/* ============ ENDOMODELO DE RECAMBIO (decoración) ============ */

function buildSpareEndoskeleton(): THREE.Group {
  const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ color: 0x3a3f44, roughness: 0.35, metalness: 0.9 });
  const spine = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.6, 8), m);
  spine.position.y = 0.32;
  g.add(spine);
  const rib = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.28, 4, 8), m);
  rib.position.y = 0.45;
  g.add(rib);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.12, 6), m);
  neck.position.y = 0.75;
  g.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 10), m);
  head.position.y = 0.9;
  g.add(head);
  const eyes = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 6), new THREE.MeshStandardMaterial({ emissive: 0x884422, emissiveIntensity: 0.8, color: 0x110000 }));
  eyes.position.set(0.05, 0.93, 0.1);
  const eyes2 = eyes.clone();
  eyes2.position.x = -0.05;
  g.add(eyes, eyes2);
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.42, 4, 8), m);
    arm.position.set(side * 0.22, 0.45, 0);
    arm.rotation.z = side * 0.5;
    g.add(arm);
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.36, 4, 8), m);
    leg.position.set(side * 0.1, 0.05, 0.14);
    leg.rotation.x = 1.2;
    g.add(leg);
  }
  g.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = true;
  });
  return g;
}

/* ============ MALLAS DE OBJETOS RECOGIBLES ============ */

export function createPickupMesh(kind: 'fuse' | 'tape' | 'note' | 'battery' | 'cover' | 'key' | 'keycard' | 'part'): THREE.Object3D {
  switch (kind) {
    case 'fuse': {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.16, 10), new THREE.MeshPhysicalMaterial({ color: 0x664422, roughness: 0.3, transparent: true, opacity: 0.9 }));
      body.rotation.z = Math.PI / 2;
      for (const cap of [-0.09, 0.09]) {
        const c = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 10), metalMaterial([0.2, 0.2]));
        c.rotation.z = Math.PI / 2;
        c.position.x = cap;
        g.add(c);
      }
      g.add(body);
      return g;
    }
    case 'tape': {
      const g = new THREE.Group();
      const shell = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.03, 0.11), plasticMaterial(0x1a1a1e, 0.5));
      const label = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.032, 0.07), new THREE.MeshStandardMaterial({ color: 0xd8c890, roughness: 0.8 }));
      g.add(shell, label);
      return g;
    }
    case 'note': {
      const g = new THREE.Group();
      const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.3), new THREE.MeshStandardMaterial({ color: 0xd9d2be, roughness: 0.9, emissive: 0x333322, emissiveIntensity: 0.08 }));
      paper.rotation.x = -Math.PI / 2.2;
      g.add(paper);
      return g;
    }
    case 'battery': {
      const g = new THREE.Group();
      for (let i = 0; i < 2; i++) {
        const b = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.1, 8), plasticMaterial(i ? 0x222a22 : 0xaa8822, 0.4, 0.3));
        b.position.x = i * 0.055;
        g.add(b);
      }
      g.rotation.z = Math.PI / 2.4;
      return g;
    }
    case 'cover': {
      const g = new THREE.Group();
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.1, 0.05), new THREE.MeshStandardMaterial({ color: 0x565e66, roughness: 0.4, metalness: 0.85 }));
      const handle = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.015, 6, 10), darkMetalMaterial());
      handle.position.set(0, 0.45, 0.06);
      g.add(plate, handle);
      g.rotation.x = -Math.PI / 2.15;
      return g;
    }
    case 'key': {
      const g = new THREE.Group();
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.18, 6), new THREE.MeshStandardMaterial({ color: 0xd8a838, roughness: 0.3, metalness: 0.95, emissive: 0x584410, emissiveIntensity: 0.35 }));
      shaft.rotation.z = Math.PI / 2;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.012, 6, 12), new THREE.MeshStandardMaterial({ color: 0xd8a838, roughness: 0.3, metalness: 0.95, emissive: 0x584410, emissiveIntensity: 0.35 }));
      ring.position.x = -0.12;
      const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 0.015), new THREE.MeshStandardMaterial({ color: 0xd8a838, metalness: 0.95, roughness: 0.3 }));
      tooth.position.set(0.07, -0.02, 0);
      g.add(shaft, ring, tooth);
      return g;
    }
    case 'keycard': {
      const g = new THREE.Group();
      const card = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.008, 0.09),
        new THREE.MeshStandardMaterial({ color: 0xd8c838, roughness: 0.35, metalness: 0.4, emissive: 0x585010, emissiveIntensity: 0.5 })
      );
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.009, 0.016), new THREE.MeshStandardMaterial({ color: 0x18181c, roughness: 0.3 }));
      stripe.position.set(-0.01, 0, -0.028);
      g.add(card, stripe);
      g.rotation.x = -Math.PI / 2.4;
      return g;
    }
    case 'part': {
      // pieza de juguete (mecanismo de la caja musical)
      const g = new THREE.Group();
      const gear = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.03, 12), new THREE.MeshStandardMaterial({ color: 0xb88a3a, metalness: 0.85, roughness: 0.3, emissive: 0x403010, emissiveIntensity: 0.4 }));
      gear.rotation.x = Math.PI / 2;
      const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.12, 6), metalMaterial([0.2, 0.2]));
      pin.rotation.z = Math.PI / 2;
      pin.position.x = 0.05;
      g.add(gear, pin);
      return g;
    }
  }
}


/* ============ EL SÓTANO EN LLAMAS (v12 — capítulo 7, GRAN FINAL) ============ */
/* Sala: x[-44,44] z[-62,-34], techo 9 m. La PIZZERÍA ORIGINAL arde bajo el
   MEGAPLEX: filas de estanterías industriales, cajas, bidones, el viejo
   escenario del show, piezas de repuesto, jaulas de almacenaje... y
   LUNA colgando del techo en medio del humo. */

import { FireSystem, MEGA_EXTINTORES, setMegaFire, sharedSmokeTexture } from './fire';

/** v12 — ya no hay alberca gigante: región vacía (nadie "vadea" nada) */
export const MEGA_PIT = { x1: 1e9, z1: 1e9, x2: 1e9, z2: 1e9 };

/** material "chamuscado": plástico negro-grisáceo mate */
function charMat(rough = 0.92): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color: 0x1c1815, roughness: rough, metalness: 0.05 });
}

function buildBasement(world: WorldBuilder) {
  const charred = charMat();
  const charWood = charMat(0.85);

  /* ---- techo ennegrecido (plano de hollín bajo el techo real) ---- */
  const soot = new THREE.Mesh(
    new THREE.PlaneGeometry(88, 28),
    new THREE.MeshStandardMaterial({ color: 0x0c0a09, roughness: 1 })
  );
  soot.rotation.x = Math.PI / 2;
  soot.position.set(0, 8.92, -48);
  world.root.add(soot);

  /* ---- vigas metálicas calcinadas cruzando el techo ---- */
  const beamMat = new THREE.MeshStandardMaterial({ color: 0x241d18, roughness: 0.6, metalness: 0.7 });
  for (let i = 0; i < 7; i++) {
    const bz = -35.5 - i * 4.2;
    const beam = new THREE.Mesh(new THREE.BoxGeometry(88, 0.5, 0.34), beamMat);
    beam.position.set(0, 8.3, bz);
    world.root.add(beam);
    // tirantes colgantes torcidos
    if (i % 2 === 0) {
      for (const hx of [-30, -6, 14, 34]) {
        const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.4 + Math.random() * 1.2, 6), beamMat);
        rod.position.set(hx + (Math.random() - 0.5) * 2, 7.5, bz + 0.2);
        rod.rotation.z = (Math.random() - 0.5) * 0.5;
        world.root.add(rod);
      }
    }
  }

  /* ---- percha de LUNA en el centro del techo ---- */
  const perch = new THREE.Group();
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 2.0, 10), charred);
  cord.position.y = -1.0;
  perch.add(cord);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.55, 0.05, 8, 22),
    new THREE.MeshStandardMaterial({ color: 0x3a2a20, roughness: 0.5, metalness: 0.8 })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = -2.0;
  perch.add(ring);
  const aura = new THREE.Mesh(
    new THREE.SphereGeometry(0.9, 14, 10),
    new THREE.MeshBasicMaterial({ color: 0x881510, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  aura.position.y = -2.0;
  perch.add(aura);
  perch.position.set(0, 8.9, -48);
  world.root.add(perch);
  world.propAnims.push({
    update: (_dt, t) => {
      ring.rotation.z = Math.sin(t * 0.4) * 0.08;
      aura.scale.setScalar(1 + Math.sin(t * 2.2) * 0.12);
    },
  });

  /* ---- estrellas del techo (rojo-mortecinas, casi todas fundidas) ---- */
  const starGeo = new THREE.BufferGeometry();
  const starPos: number[] = [];
  for (let i = 0; i < 120; i++) {
    starPos.push(-43 + Math.random() * 86, 8.4 + Math.random() * 0.3, -61 + Math.random() * 26);
  }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
  world.root.add(new THREE.Points(starGeo, new THREE.PointsMaterial({
    color: 0xff6a4a, size: 0.06, transparent: true, opacity: 0.5,
  })));

  /* =================================================================
   *  FILAS DE ESTANTERÍAS INDUSTRIALES (el corazón del sótano)
   *  Cada fila deja un hueco para circular; colisión por tramos.
   * ================================================================= */
  const rackMat = new THREE.MeshStandardMaterial({ color: 0x2e2a26, roughness: 0.55, metalness: 0.75 });
  const rackRust = new THREE.MeshStandardMaterial({ color: 0x4a3428, roughness: 0.72, metalness: 0.6 });
  const RACK_H = 4.3;

  function rackRow(x0: number, x1: number, z: number, g0: number, g1: number) {
    const segs: Array<[number, number]> = [
      [x0, Math.min(g0, x1)],
      [Math.max(g1, x0), x1],
    ];
    for (const [a, b] of segs) {
      if (b - a < 0.8) continue;
      const mat = Math.random() < 0.4 ? rackRust : rackMat;
      const g = new THREE.Group();
      // postes verticales
      const nPosts = Math.max(2, Math.round((b - a) / 3.4) + 1);
      for (let i = 0; i < nPosts; i++) {
        const px = a + (b - a) * (i / (nPosts - 1));
        for (const pz of [-0.55, 0.55]) {
          const post = new THREE.Mesh(new THREE.BoxGeometry(0.11, RACK_H, 0.11), mat);
          post.position.set(px, RACK_H / 2, pz);
          post.castShadow = true;
          g.add(post);
        }
        // travesaño diagonal (arriostramiento)
        if (i < nPosts - 1) {
          const px2 = a + (b - a) * ((i + 1) / (nPosts - 1));
          for (const pz of [-0.55, 0.55]) {
            const diag = new THREE.Mesh(new THREE.BoxGeometry(px2 - px, 0.06, 0.06), mat);
            diag.position.set((px + px2) / 2, 2.4, pz);
            diag.rotation.z = 0.32;
            g.add(diag);
          }
        }
      }
      // niveles (tablones)
      for (const ly of [0.32, 1.35, 2.4, 3.45]) {
        const board = new THREE.Mesh(new THREE.BoxGeometry(b - a - 0.06, 0.07, 1.25), mat);
        board.position.set((a + b) / 2, ly, 0);
        board.castShadow = true;
        board.receiveShadow = true;
        g.add(board);
      }
      g.position.set(0, 0, z);
      world.root.add(g);
      world.addCollider(
        new THREE.Box3().setFromCenterAndSize(
          new THREE.Vector3((a + b) / 2, RACK_H / 2, z),
          new THREE.Vector3(b - a, RACK_H, 1.4)
        ),
        `rack_${x0}_${z}_${a.toFixed(0)}`
      );
    }
  }

  rackRow(-40, -16, -40, -37, -34);   // A: noroeste, hueco al oeste
  rackRow(-40, -16, -47, -20, -17);   // B: suroeste, hueco al este
  rackRow(-6, 18, -44, 99, 100);      // C: centro, maciza
  rackRow(10, 36, -51, 22, 25);       // D: este, hueco central
  rackRow(-28, -10, -57, -18, -15);   // E: sur, hueco al este

  /* ---- MAREMAGNUM DE CAJAS DE CARTÓN (InstancedMesh, 1 draw call) ---- */
  const boxGeo = new THREE.BoxGeometry(0.5, 0.38, 0.42);
  const boxMat = new THREE.MeshStandardMaterial({ color: 0x8a6a42, roughness: 0.92 });
  const BOX_N = 240;
  const boxesIM = new THREE.InstancedMesh(boxGeo, boxMat, BOX_N);
  const dummy = new THREE.Object3D();
  // sobre los niveles de las estanterías (tramos sólidos)
  const rackSpots: Array<[number, number, number]> = [
    // [centroSegmento, z, semilongitud]
    [-38.5, -40, 1.5], [-25.5, -40, 11], [-19, -47, 1], [-28.5, -47, 11.5],
    [6, -44, 12], [16, -44, 2], [13, -51, 9], [33.5, -51, 2.5], [27.5, -57, 1.5], [-13, -57, 8],
  ];
  let bi = 0;
  for (const [cx, cz, half] of rackSpots) {
    const n = Math.max(3, Math.round(half * 1.6));
    for (let i = 0; i < n && bi < BOX_N - 60; i++) {
      const lvl = [0.32, 1.35, 2.4, 3.45][Math.floor(Math.random() * 4)] + 0.2;
      dummy.position.set(cx + (Math.random() - 0.5) * half * 1.7, lvl, cz + (Math.random() - 0.5) * 1.1);
      dummy.rotation.set(0, Math.random() * Math.PI, 0);
      const s = 0.8 + Math.random() * 0.6;
      dummy.scale.set(s, s * 0.8, s);
      dummy.updateMatrix();
      boxesIM.setMatrixAt(bi, dummy.matrix);
      bi++;
    }
  }
  // pilas en el suelo: esquinas y pasillos
  const floorStacks: Array<[number, number, number]> = [
    [-43.0, -37.5, 8], [-43.0, -58.5, 6], [-9.0, -59.5, 7], [-2.5, -38.0, 6],
    [20.0, -38.5, 7], [38.0, -58.8, 8], [43.0, -38.5, 6], [30.0, -43.5, 5],
    [-13.0, -38.2, 6], [8.0, -55.0, 5], [-33.0, -54.5, 6], [37.5, -59.0, 6],
  ];
  for (const [sx, sz, n] of floorStacks) {
    for (let i = 0; i < n && bi < BOX_N; i++) {
      const h = Math.floor(i / 3);
      dummy.position.set(sx + (Math.random() - 0.5) * 1.4, 0.2 + h * 0.36, sz + (Math.random() - 0.5) * 1.4);
      dummy.rotation.set(0, Math.random() * Math.PI, 0);
      const s = 0.85 + Math.random() * 0.45;
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      boxesIM.setMatrixAt(bi, dummy.matrix);
      bi++;
    }
  }
  while (bi < BOX_N) {
    dummy.position.set(-42 + Math.random() * 84, 0.19, -61 + Math.random() * 25);
    dummy.rotation.set(0, Math.random() * Math.PI, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    boxesIM.setMatrixAt(bi, dummy.matrix);
    bi++;
  }
  boxesIM.castShadow = false;
  boxesIM.receiveShadow = true;
  world.root.add(boxesIM);

  /* ---- BIDONES DE ACEITE (óxido) ---- */
  const drumMat = new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.75, metalness: 0.55 });
  const drums: Array<[number, number, number, boolean]> = [
    [-43.2, -42.5, 0, false], [-42.2, -40.5, 0.6, false], [-43.0, -49.0, 0.2, true],
    [19.0, -40.5, 0, false], [20.1, -41.5, 0.4, false], [21.2, -40.8, 0.9, true],
    [-12.5, -55.5, 0, false], [-11.4, -54.8, 0.5, false], [34.5, -56.0, 0, false],
    [35.6, -55.2, 0.3, true], [-30.5, -59.5, 0, false], [12.0, -38.5, 0.2, false],
  ];
  for (const [dx, dz, dry, tipped] of drums) {
    const d = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.92, 14), drumMat);
    if (tipped) {
      d.rotation.set(0, dry, Math.PI / 2);
      d.position.set(dx, 0.32, dz);
    } else {
      d.rotation.y = dry;
      d.position.set(dx, 0.46, dz);
    }
    d.castShadow = true;
    world.root.add(d);
    // aros de refuerzo
    for (const ry of [-0.2, 0.2]) {
      const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.315, 0.02, 6, 16), drumMat);
      hoop.rotation.x = Math.PI / 2;
      hoop.position.set(dx, 0.46 + (tipped ? 0 : ry), dz);
      if (tipped) hoop.rotation.z = Math.PI / 2;
      world.root.add(hoop);
    }
    world.addCollider(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(dx, 0.5, dz), new THREE.Vector3(0.75, 1.0, 0.75)), `drum_${dx}_${dz}`);
  }

  /* =================================================================
   *  EL ESCENARIO DEL SHOW ORIGINAL (sur-centro) — donde empezó todo
   * ================================================================= */
  const stage = new THREE.Group();
  const stageDeck = new THREE.Mesh(new THREE.BoxGeometry(12, 0.45, 2.8), charWood);
  stageDeck.position.set(10, 0.225, -60.0);
  stageDeck.castShadow = true;
  stageDeck.receiveShadow = true;
  stage.add(stageDeck);
  world.addCollider(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(10, 0.3, -60.0), new THREE.Vector3(12.2, 0.6, 3.0)), 'basement_stage');
  // telón de fondo desgarrado
  const curtMat = new THREE.MeshStandardMaterial({ map: pirateCurtainTex(), color: 0x9a8478, roughness: 0.95 });
  const curt = new THREE.Mesh(new THREE.PlaneGeometry(12.6, 3.4), curtMat);
  curt.position.set(10, 2.1, -61.72);
  curt.rotation.y = 0;
  stage.add(curt);
  // cortinas laterales
  for (const sxs of [3.6, 16.4]) {
    const sideCurt = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 3.2), curtMat);
    sideCurt.position.set(sxs, 2.0, -60.9);
    sideCurt.rotation.y = 0.5 * (sxs < 10 ? 1 : -1);
    stage.add(sideCurt);
  }
  // banner del show
  const bC = document.createElement('canvas');
  bC.width = 512; bC.height = 128;
  const bCtx = bC.getContext('2d')!;
  bCtx.fillStyle = '#120a08';
  bCtx.fillRect(0, 0, 512, 128);
  bCtx.font = 'bold 44px monospace';
  bCtx.textAlign = 'center';
  bCtx.fillStyle = '#d8b040';
  bCtx.fillText('FREDDY & FRIENDS', 256, 62);
  bCtx.font = 'bold 22px monospace';
  bCtx.fillStyle = '#a08060';
  bCtx.fillText('THE ORIGINAL SHOW — 1983', 256, 96);
  const bTex = new THREE.CanvasTexture(bC);
  bTex.colorSpace = THREE.SRGBColorSpace;
  const banner = new THREE.Mesh(
    new THREE.PlaneGeometry(9.6, 2.0),
    new THREE.MeshStandardMaterial({ map: bTex, emissive: 0x553008, emissiveIntensity: 0.35, roughness: 0.85 })
  );
  banner.position.set(10, 4.6, -61.55);
  stage.add(banner);
  // tres atriles con placas (los puestos vacíos de Freddy, Bonnie y Chica)
  const names = ['FREDDY', 'BONNIE', 'CHICA'];
  names.forEach((nm, i) => {
    const mx = 5.6 + i * 4.4;
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 1.2, 8), beamMat);
    stand.position.set(mx, 1.05, -59.7);
    stage.add(stand);
    const mic = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.14, 6, 8), darkMetalMaterial());
    mic.position.set(mx, 1.75, -59.55);
    mic.rotation.x = 0.25;
    stage.add(mic);
    const pC2 = document.createElement('canvas');
    pC2.width = 128; pC2.height = 64;
    const pCtx = pC2.getContext('2d')!;
    pCtx.fillStyle = '#241a12';
    pCtx.fillRect(0, 0, 128, 64);
    pCtx.strokeStyle = '#8a7040';
    pCtx.strokeRect(4, 4, 120, 56);
    pCtx.font = 'bold 20px monospace';
    pCtx.textAlign = 'center';
    pCtx.fillStyle = '#c8a850';
    pCtx.fillText(nm, 64, 40);
    const pTex = new THREE.CanvasTexture(pC2);
    pTex.colorSpace = THREE.SRGBColorSpace;
    const plaque = new THREE.Mesh(
      new THREE.PlaneGeometry(0.66, 0.34),
      new THREE.MeshStandardMaterial({ map: pTex, roughness: 0.7 })
    );
    plaque.position.set(mx, 0.35, -59.35);
    stage.add(plaque);
  });
  // focos del show (apagados, apuntando al suelo)
  for (const lx of [6.5, 13.5]) {
    const fix = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.17, 0.3, 10), darkMetalMaterial());
    fix.position.set(lx, 5.6, -59.4);
    fix.rotation.x = -0.8;
    stage.add(fix);
    const barn = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.4), darkMetalMaterial());
    barn.position.set(lx, 5.45, -59.25);
    barn.rotation.x = -0.8;
    stage.add(barn);
  }
  world.root.add(stage);

  /* ---- CABEZAS DE RESPUESTO en las estanterías (lo más inquietante) ---- */
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x0a0a12, emissive: 0x18e0ff, emissiveIntensity: 2.4 });
  function spareHead(x: number, y: number, z: number, ry: number, kind: 'bear' | 'rabbit' | 'chick') {
    const g = new THREE.Group();
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.23, 16, 12), charMat(0.68));
    head.castShadow = true;
    g.add(head);
    if (kind === 'bear') {
      for (const ex of [-0.17, 0.17]) {
        const ear = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.1, 8), charMat(0.7));
        ear.position.set(ex, 0.22, 0);
        ear.rotation.z = ex * 1.4;
        g.add(ear);
      }
    } else if (kind === 'rabbit') {
      for (const ex of [-0.09, 0.09]) {
        const ear = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.34, 0.05), charMat(0.7));
        ear.position.set(ex, 0.34, 0);
        ear.rotation.z = ex * 0.8;
        g.add(ear);
      }
    } else {
      const beak = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.16, 8), charMat(0.6));
      beak.rotation.x = Math.PI / 2;
      beak.position.set(0, -0.02, 0.22);
      g.add(beak);
    }
    for (const ex of [-0.09, 0.09]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.038, 10, 8), eyeMat.clone());
      eye.position.set(ex, 0.06, 0.19);
      g.add(eye);
    }
    g.position.set(x, y, z);
    g.rotation.y = ry;
    world.root.add(g);
    // parpadeo espeluznante
    const eyes = g.children.filter((c) => (c as THREE.Mesh).material === undefined || true);
    world.propAnims.push({
      update: (_dt, t) => {
        const flick = Math.random() < 0.008 ? 0.1 : 1.9 + Math.sin(t * 3 + x) * 0.5;
        for (const ch of g.children) {
          const m = (ch as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
          if (m && m.emissive && m.emissive.getHex() === 0x18e0ff) m.emissiveIntensity = flick;
        }
      },
    });
  }
  spareHead(-3.2, 2.62, -44.1, 0.5, 'bear');
  spareHead(-1.9, 2.62, -44.3, -0.4, 'rabbit');
  spareHead(-0.7, 1.57, -44.15, 0.2, 'chick');
  spareHead(16.6, 2.62, -44.2, 2.9, 'bear');
  spareHead(31.0, 2.6, -51.2, -1.2, 'rabbit');

  /* ---- TRAJE VACÍO colgado de una cadena (junto al escenario) ---- */
  const suit = new THREE.Group();
  const suitMat = new THREE.MeshStandardMaterial({ color: 0x241e18, roughness: 0.85, metalness: 0.1 });
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.55, 8, 12), suitMat);
  torso.position.y = 1.15;
  suit.add(torso);
  for (const sx of [-0.34, 0.34]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.5, 6, 8), suitMat);
    arm.position.set(sx, 1.15, 0);
    arm.rotation.z = sx * 0.5;
    suit.add(arm);
  }
  for (const lx of [-0.13, 0.13]) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.5, 6, 8), suitMat);
    leg.position.set(lx, 0.4, 0);
    suit.add(leg);
  }
  const suitHead = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10), charMat(0.75));
  suitHead.position.y = 1.72;
  suit.add(suitHead);
  for (const ex of [-0.16, 0.16]) {
    const ear = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.09, 8), charMat(0.75));
    ear.position.set(ex, 1.92, 0);
    ear.rotation.z = ex * 1.4;
    suit.add(ear);
  }
  // cadena de la que cuelga
  const hangChain = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const link = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.012, 6, 10), beamMat);
    link.position.y = -i * 0.08;
    link.rotation.y = i * 0.7;
    hangChain.add(link);
  }
  hangChain.position.set(0, 2.4, 0);
  suit.add(hangChain);
  suit.position.set(2.4, 1.15, -59.6);
  world.root.add(suit);
  world.addCollider(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(2.4, 1.1, -59.6), new THREE.Vector3(0.9, 2.3, 0.9)), 'basement_suit');
  world.propAnims.push({ update: (_dt, t) => { suit.rotation.y = Math.sin(t * 0.32) * 0.5 + 0.2; suit.rotation.z = Math.sin(t * 0.5) * 0.05; } });

  /* ---- JAULA DE ALMACENAJE (sureste) con candado ---- */
  const cage = new THREE.Group();
  const meshTex = (() => {
    const cc = document.createElement('canvas');
    cc.width = 128; cc.height = 128;
    const g2 = cc.getContext('2d')!;
    g2.clearRect(0, 0, 128, 128);
    g2.strokeStyle = '#8a8a86';
    g2.lineWidth = 3;
    for (let i = 0; i <= 128; i += 16) {
      g2.beginPath(); g2.moveTo(i, 0); g2.lineTo(i, 128); g2.stroke();
      g2.beginPath(); g2.moveTo(0, i); g2.lineTo(128, i); g2.stroke();
    }
    const tx = new THREE.CanvasTexture(cc);
    tx.wrapS = tx.wrapT = THREE.RepeatWrapping;
    tx.repeat.set(10, 3);
    return tx;
  })();
  const cageMat = new THREE.MeshStandardMaterial({
    map: meshTex, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide,
    color: 0xb0b0aa, roughness: 0.5, metalness: 0.8,
  });
  const CX0 = 30, CX1 = 43, CZ0 = -61, CZ1 = -56.5, CH = 3.2;
  // paredes de malla
  const wallN = new THREE.Mesh(new THREE.PlaneGeometry(CX1 - CX0, CH), cageMat);
  wallN.position.set((CX0 + CX1) / 2, CH / 2, CZ0);
  cage.add(wallN);
  const wallS = new THREE.Mesh(new THREE.PlaneGeometry(CX1 - CX0, CH), cageMat);
  wallS.position.set((CX0 + CX1) / 2, CH / 2, CZ1);
  cage.add(wallS);
  const wallW = new THREE.Mesh(new THREE.PlaneGeometry(CZ1 - CZ0, CH), cageMat);
  wallW.rotation.y = Math.PI / 2;
  wallW.position.set(CX0, CH / 2, (CZ0 + CZ1) / 2);
  cage.add(wallW);
  const wallE = wallW.clone();
  wallE.position.x = CX1;
  cage.add(wallE);
  // postes + travesaño
  for (const [px, pz] of [[CX0, CZ0], [CX1, CZ0], [CX0, CZ1], [CX1, CZ1]] as Array<[number, number]>) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, CH + 0.2, 0.12), beamMat);
    post.position.set(px, (CH + 0.2) / 2, pz);
    post.castShadow = true;
    cage.add(post);
  }
  const topBar = new THREE.Mesh(new THREE.BoxGeometry(CX1 - CX0, 0.08, 0.08), beamMat);
  topBar.position.set((CX0 + CX1) / 2, CH, CZ1);
  cage.add(topBar);
  // candado + puerta cerrada (decorativa)
  const lock = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.2, 0.08), new THREE.MeshStandardMaterial({ color: 0x8a6a18, metalness: 0.9, roughness: 0.3 }));
  lock.position.set(CX0 + 0.2, 1.25, CZ1);
  cage.add(lock);
  world.root.add(cage);
  world.addCollider(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3((CX0 + CX1) / 2, CH / 2, (CZ0 + CZ1) / 2), new THREE.Vector3(CX1 - CX0, CH, CZ1 - CZ0 + 0.3)), 'basement_cage');
  // cajas dentro de la jaula
  for (let i = 0; i < 8; i++) {
    const bC2 = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.4, 0.5), boxMat);
    bC2.position.set(31.5 + (i % 4) * 1.1, 0.22 + Math.floor(i / 4) * 0.44, -60.4 + Math.floor(i / 4) * 0.55);
    bC2.rotation.y = Math.random() * 0.6;
    bC2.castShadow = true;
    world.root.add(bC2);
  }

  /* ---- CALDERA Y TUBERÍAS (noroeste) ---- */
  const boiler = new THREE.Group();
  const boMat = new THREE.MeshStandardMaterial({ color: 0x3a3430, roughness: 0.62, metalness: 0.72 });
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 3.0, 18), boMat);
  tank.position.y = 1.5;
  tank.castShadow = true;
  boiler.add(tank);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.95, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), boMat);
  dome.position.y = 3.0;
  boiler.add(dome);
  for (const by of [0.8, 1.8, 2.6]) {
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.97, 0.04, 8, 20), boMat);
    hoop.rotation.x = Math.PI / 2;
    hoop.position.y = by;
    boiler.add(hoop);
  }
  // manómetros + válvulas
  for (const gy of [1.2, 2.2]) {
    const gauge = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), new THREE.MeshStandardMaterial({ color: 0xd8d0b0, emissive: 0x807850, emissiveIntensity: 0.5, roughness: 0.3 }));
    gauge.position.set(0.92, gy, 0.35);
    boiler.add(gauge);
  }
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.03, 8, 16), new THREE.MeshStandardMaterial({ color: 0x8a1818, roughness: 0.5, metalness: 0.6 }));
  wheel.position.set(0, 3.4, 0);
  wheel.rotation.x = Math.PI / 2;
  boiler.add(wheel);
  for (let s = 0; s < 4; s++) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.03, 0.03), boMat);
    spoke.position.set(0, 3.4, 0);
    spoke.rotation.y = (s / 4) * Math.PI;
    boiler.add(spoke);
  }
  boiler.position.set(-41.5, 0, -36.6);
  world.root.add(boiler);
  world.addCollider(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(-41.5, 1.6, -36.6), new THREE.Vector3(2.1, 3.4, 2.1)), 'basement_boiler');

  // tuberías por las paredes (norte y oeste)
  const pipeMat = new THREE.MeshStandardMaterial({ color: 0x4a4038, roughness: 0.55, metalness: 0.8 });
  for (const py of [2.6, 3.3]) {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 56, 10), pipeMat);
    pipe.rotation.z = Math.PI / 2;
    pipe.position.set(0, py, -61.72);
    world.root.add(pipe);
  }
  for (const px of [-30, -12, 8, 26]) {
    const vpipe = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 3.3, 8), pipeMat);
    vpipe.position.set(px, 1.65, -61.68);
    world.root.add(vpipe);
  }
  // válvulas de rueda en la pared
  for (const [vx, vz, vy] of [[-20, -61.6, 1.6], [16, -61.6, 1.6], [40, -44.0, 1.7], [-43.6, -50, 1.7]] as Array<[number, number, number]>) {
    const vw = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.025, 8, 14), new THREE.MeshStandardMaterial({ color: 0x8a1818, roughness: 0.55, metalness: 0.55 }));
    vw.position.set(vx, vy, vz);
    if (vx < -43 || vx > 39) vw.rotation.y = Math.PI / 2;
    world.root.add(vw);
  }

  /* ---- PILARES DE HORMIGÓN ---- */
  const pillarMat = new THREE.MeshStandardMaterial({ color: 0x585450, roughness: 0.85 });
  for (const [px, pz] of [[-13, -52], [31, -44], [-31, -54]] as Array<[number, number]>) {
    const pil = new THREE.Mesh(new THREE.BoxGeometry(0.85, 9, 0.85), pillarMat);
    pil.position.set(px, 4.5, pz);
    pil.castShadow = true;
    pil.receiveShadow = true;
    world.root.add(pil);
    world.addCollider(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(px, 4.5, pz), new THREE.Vector3(0.95, 9, 0.95)), `bpillar_${px}_${pz}`);
    // caja de fusibles anclada al pilar
    if (px === -13 || px === 31) {
      const fb = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.22), darkMetalMaterial());
      fb.position.set(px, 1.7, pz + 0.55);
      world.root.add(fb);
      const flick = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), new THREE.MeshStandardMaterial({ color: 0x300804, emissive: 0xff3020, emissiveIntensity: 1.4 }));
      flick.position.set(px, 2.12, pz + 0.68);
      world.root.add(flick);
      world.propAnims.push({ update: (_dt, t) => { (flick.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.1 + Math.sin(t * 7 + px) * 0.7; } });
    }
  }

  /* ---- MESAS DE FIESTA APILADAS + SILLAS (restos de la pizzería, suroeste) ---- */
  const tableMat = plasticMaterial(0x7a5a3a, 0.6, 0.25);
  for (let i = 0; i < 5; i++) {
    const tb = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.08, 14), tableMat);
    tb.position.set(-34.5 + (i % 2) * 0.3, 0.55 + i * 0.14, -59.8 + (i % 3) * 0.25);
    tb.castShadow = true;
    world.root.add(tb);
  }
  world.addCollider(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(-34.5, 0.9, -59.8), new THREE.Vector3(2.0, 1.8, 1.6)), 'basement_tables');
  // sillas plegadas recargadas en la pared oeste
  for (let i = 0; i < 7; i++) {
    const ch2 = new THREE.Group();
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.75, 0.05), tableMat);
    back.position.y = 0.6;
    ch2.add(back);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.45), tableMat);
    seat.position.set(0, 0.35, 0.2);
    ch2.add(seat);
    ch2.position.set(-43.6, 0, -55.5 + i * 0.85);
    ch2.rotation.set(0, Math.PI / 2, -0.25);
    world.root.add(ch2);
  }

  /* ---- PALETS ---- */
  const palletMat = woodMaterial([0.5, 1.2]);
  const palletSpots: Array<[number, number, number]> = [[-24.5, -36.5, 0.3], [14.0, -58.5, -0.2], [33.5, -42.0, 0.1], [-9.5, -36.8, 0.4]];
  for (const [px, pz, pry] of palletSpots) {
    const pg = new THREE.Group();
    for (let s = 0; s < 5; s++) {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.05, 0.22), palletMat);
      slat.position.set(0, 0.03, -0.55 + s * 0.28);
      pg.add(slat);
    }
    for (const bx of [-0.7, 0.7]) {
      const beam2 = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.09, 1.4), palletMat);
      beam2.position.set(bx, 0.0, 0);
      pg.add(beam2);
    }
    pg.position.set(px, 0.08, pz);
    pg.rotation.y = pry;
    world.root.add(pg);
    // cajas encima
    for (let b2 = 0; b2 < 2; b2++) {
      const bx2 = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.4, 0.5), boxMat);
      bx2.position.set(px + (Math.random() - 0.5) * 0.6, 0.33 + b2 * 0.42, pz + (Math.random() - 0.5) * 0.5);
      bx2.rotation.y = Math.random() * 0.5;
      bx2.castShadow = true;
      world.root.add(bx2);
    }
  }

  /* ---- EScombros: losas caídas, escombros, cables colgando ---- */
  const tileMat = new THREE.MeshStandardMaterial({ color: 0x9a948a, roughness: 0.9 });
  const debrisMat = charMat(0.98);
  for (let i = 0; i < 8; i++) {
    const tile = new THREE.Mesh(new THREE.BoxGeometry(1.1 + Math.random() * 0.8, 0.05, 0.9 + Math.random() * 0.7), tileMat);
    tile.position.set(-40 + Math.random() * 80, 0.05 + Math.random() * 0.12, -60 + Math.random() * 24);
    tile.rotation.set(Math.random() * 0.14, Math.random() * Math.PI, Math.random() * 0.1);
    tile.receiveShadow = true;
    world.root.add(tile);
  }
  for (let i = 0; i < 10; i++) {
    const rub = new THREE.Mesh(new THREE.ConeGeometry(0.5 + Math.random() * 0.9, 0.3 + Math.random() * 0.5, 6), debrisMat);
    rub.position.set(-42 + Math.random() * 84, 0.16, -60 + Math.random() * 24);
    rub.rotation.y = Math.random() * Math.PI;
    world.root.add(rub);
  }
  // cables colgando del techo
  const wireMat = new THREE.MeshStandardMaterial({ color: 0x181410, roughness: 0.9 });
  for (let i = 0; i < 12; i++) {
    const wx = -40 + Math.random() * 80;
    const wz = -60 + Math.random() * 24;
    const len = 1.0 + Math.random() * 2.2;
    const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.02, len, 5), wireMat);
    wire.position.set(wx, 8.3 - len / 2, wz);
    wire.rotation.z = (Math.random() - 0.5) * 0.3;
    world.root.add(wire);
  }

  /* ---- CADENAS + GANCHOS colgando de las vigas ---- */
  const chains: THREE.Group[] = [];
  for (const [cx, cz] of [[-18, -44], [4, -55], [24, -47], [-8, -52], [36, -43], [12, -44]] as Array<[number, number]>) {
    const cg = new THREE.Group();
    for (let i = 0; i < 6; i++) {
      const link = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.014, 6, 10), beamMat);
      link.position.y = -i * 0.085;
      link.rotation.y = i * 0.8;
      cg.add(link);
    }
    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.016, 6, 12, Math.PI * 1.5), beamMat);
    hook.position.y = -0.62;
    cg.add(hook);
    const cl = 1.4 + Math.random() * 1.4;
    cg.position.set(cx, 8.3 - cl, cz);
    world.root.add(cg);
    chains.push(cg);
  }
  world.propAnims.push({
    update: (_dt, t) => {
      for (let i = 0; i < chains.length; i++) chains[i].rotation.y = Math.sin(t * 0.4 + i) * 0.35;
    },
  });

  /* ---- LA SILLA SOLITARIA bajo una bombilla (sur-centro) ---- */
  const chairMat = woodMaterial([0.4, 0.9]);
  const chair = new THREE.Group();
  const cSeat = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.06, 0.52), chairMat);
  cSeat.position.y = 0.48;
  cSeat.castShadow = true;
  chair.add(cSeat);
  const cBack = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.62, 0.06), chairMat);
  cBack.position.set(0, 0.82, -0.24);
  chair.add(cBack);
  for (const lx of [-0.2, 0.2]) for (const lz of [-0.2, 0.2]) {
    const cLeg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.48, 0.05), chairMat);
    cLeg.position.set(lx, 0.24, lz);
    chair.add(cLeg);
  }
  chair.position.set(-2.5, 0, -54.2);
  chair.rotation.y = 0.6;
  world.root.add(chair);
  world.addCollider(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(-2.5, 0.5, -54.2), new THREE.Vector3(0.7, 1.1, 0.7)), 'basement_chair');
  brokenLight(world, -2.5, -54.2, 2.8);

  /* ---- RECREATIVAS ROTAS junto al escenario ---- */
  arcadeCabinet(world, 18.6, -60.2, 0, true);
  arcadeCabinet(world, 19.7, -59.4, 0.35, true);

  /* ---- CHARCOS (reflejan el fuego: roughness bajo) ---- */
  const puddleMat = new THREE.MeshStandardMaterial({ color: 0x0a0d12, roughness: 0.12, metalness: 0.55 });
  for (const [ux, uz, ur] of [[-12, -49.5, 1.4], [8, -55, 1.9], [-30, -36, 1.1], [22, -57.5, 1.3], [-15, -38.5, 0.9]] as Array<[number, number, number]>) {
    const pu = new THREE.Mesh(new THREE.CircleGeometry(ur, 18), puddleMat);
    pu.rotation.x = -Math.PI / 2;
    pu.position.set(ux, 0.035, uz);
    pu.receiveShadow = true;
    world.root.add(pu);
  }

  /* ---- CARRETILLA + FREGONA + CAJA DE HERRAMIENTAS ---- */
  const wheelbarrow = new THREE.Group();
  const tray = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.3, 0.55), new THREE.MeshStandardMaterial({ color: 0x5a2a1a, roughness: 0.6, metalness: 0.4 }));
  tray.position.y = 0.45;
  tray.rotation.x = 0.12;
  wheelbarrow.add(tray);
  const wWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.07, 12), darkMetalMaterial());
  wWheel.rotation.z = Math.PI / 2;
  wWheel.position.set(0.5, 0.17, 0);
  wheelbarrow.add(wWheel);
  for (const lx of [-0.32, 0.32]) {
    const wLeg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.42, 0.05), darkMetalMaterial());
    wLeg.position.set(-0.35, 0.21, lx);
    wheelbarrow.add(wLeg);
  }
  wheelbarrow.position.set(-8.5, 0, -42.6);
  wheelbarrow.rotation.y = -0.7;
  world.root.add(wheelbarrow);
  world.addCollider(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(-8.5, 0.4, -42.6), new THREE.Vector3(1.0, 0.8, 0.7)), 'basement_wheel');
  const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.19, 0.35, 12), plasticMaterial(0x3a5a3a, 0.55, 0.3));
  bucket.position.set(20.2, 0.18, -55.6);
  bucket.castShadow = true;
  world.root.add(bucket);
  const toolBox = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.24, 0.28), new THREE.MeshStandardMaterial({ color: 0x8a2818, roughness: 0.5, metalness: 0.5 }));
  toolBox.position.set(33.5, 0.62, -42.0);
  toolBox.rotation.y = 0.3;
  world.root.add(toolBox);

  /* ---- COFIRES-ESCONDITES (4, posiciones del mapData) ---- */
  const chestMat = plasticMaterial(0x8a5a2a, 0.75, 0.1);
  const chests: Array<[number, number, number]> = [
    [-25, -37.8, 0], [-8, -52, 0.5], [26, -38.5, -0.4], [10, -57, 0.2],
  ];
  for (const [cx, cz, ry] of chests) {
    const ch = new THREE.Group();
    const body3 = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.8, 0.9), chestMat);
    body3.position.y = 0.4;
    body3.castShadow = true;
    ch.add(body3);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.22, 0.94), charMat(0.8));
    lid.position.set(0, 0.9, -0.42);
    lid.rotation.x = -1.9;
    ch.add(lid);
    ch.position.set(cx, 0, cz);
    ch.rotation.y = ry;
    world.root.add(ch);
    world.addCollider(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(cx, 0.5, cz), new THREE.Vector3(1.8, 1.0, 1.0)), `megachest_${cx}`);
  }

  /* ---- 5 ESTACIONES DE EXTINTORES (anclas dcgen_eN para el sistema de pruebas) ---- */
  MEGA_EXTINTORES.forEach(([ex, ez, ery], i) => {
    const g = new THREE.Group();
    const body4 = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.13, 0.62, 14),
      plasticMaterial(0xc22018, 0.45, 0.35)
    );
    body4.position.y = 0.62;
    body4.castShadow = true;
    g.add(body4);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.125, 0.1, 14), plasticMaterial(0xe8e2d2, 0.5));
    band.position.y = 0.66;
    g.add(band);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.12, 0.1), darkMetalMaterial());
    head.position.y = 0.98;
    g.add(head);
    for (const lx of [-0.07, 0.07]) {
      const lever = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.02, 0.18), darkMetalMaterial());
      lever.position.set(lx, 1.05, 0);
      g.add(lever);
    }
    const hose = new THREE.Mesh(
      new THREE.TorusGeometry(0.14, 0.022, 8, 16, Math.PI * 1.4),
      plasticMaterial(0x1a1a1a, 0.85)
    );
    hose.position.set(0.1, 0.78, 0.05);
    g.add(hose);
    const gauge = new THREE.Mesh(
      new THREE.SphereGeometry(0.045, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xd8d0b0, emissive: 0x807850, emissiveIntensity: 0.4 })
    );
    gauge.position.set(-0.1, 0.94, 0.03);
    g.add(gauge);
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.2, 0.04),
      new THREE.MeshStandardMaterial({ color: 0x0a2a10, emissive: 0x22c840, emissiveIntensity: 1.1 })
    );
    sign.position.set(0, 1.65, 0.02);
    g.add(sign);
    const status = new THREE.Mesh(
      new THREE.SphereGeometry(0.085, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0x5a0808, emissive: 0xff2020, emissiveIntensity: 2.6 })
    );
    status.position.set(0, 1.9, 0);
    g.add(status);
    world.propAnims.push({
      update: (_dt, t) => {
        const m = status.material as THREE.MeshStandardMaterial;
        if (m.emissive.getHex() === 0xff2020) m.emissiveIntensity = 1.8 + Math.sin(t * 5 + i * 1.7) * 0.9;
      },
    });
    g.position.set(ex, 0, ez);
    g.rotation.y = ery;
    world.root.add(g);
    world.addCollider(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(ex, 0.8, ez), new THREE.Vector3(0.5, 1.6, 0.5)), `dcext_${i}`);
    world.anchors.set(`dcgen_e${i + 1}`, { pos: new THREE.Vector3(ex, 1.1, ez), mesh: status });
  });

  /* ---- decoración: carteles, dibujos quemados, letreros ---- */
  addPoster(world, posterBruno(), -43.8, 2.1, -46, Math.PI / 2);
  addPoster(world, posterParty(), 43.8, 2.2, -50, -Math.PI / 2);
  addDrawing(world, 1, -43.8, 1.8, -40, Math.PI / 2);
  addDrawing(world, 3, -43.8, 1.8, -52, Math.PI / 2);
  addDrawing(world, 5, 43.8, 1.8, -44, -Math.PI / 2);
  addDrawing(world, 2, 20, 1.8, -61.82, 0);
  neonSign(world, 'THE BASEMENT', 0xff7030, 0, 8.0, -34.35, 0, 5.4, 0.7);
  neonSign(world, 'STORAGE — B1', 0xffa030, 22, 4.2, -34.35, 0, 3.0, 0.5);
  neonSign(world, 'SHOW STAGE', 0xff40c0, 10, 5.9, -61.82, 0, 3.2, 0.5);
  neonSign(world, 'EMERGENCY EXIT', 0x40ff70, -37, 3.1, -34.35, 0, 2.6, 0.5);
  neonSign(world, 'EMERGENCY EXIT', 0x40ff70, -22, 3.1, -34.35, 0, 2.6, 0.5);
  neonSign(world, 'EMERGENCY EXIT', 0x40ff70, -6, 3.1, -34.35, 0, 2.6, 0.5);

  /* ---- lámparas colgando torcidas (una se balancea) ---- */
  const moonLamp2 = new THREE.MeshStandardMaterial({ color: 0x4a4a5a, emissive: 0x901810, emissiveIntensity: 0.7 });
  const swingLamps: THREE.Group[] = [];
  for (const [lx, lz] of [[-20, -37.5], [12, -38.5], [-32, -52], [26, -59], [40, -40]] as Array<[number, number]>) {
    const lamp = new THREE.Group();
    const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.6, 6), charred);
    wire.position.y = -0.8;
    lamp.add(wire);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.24, 0.12, 14), moonLamp2);
    disc.position.y = -1.66;
    lamp.add(disc);
    lamp.position.set(lx, 6.4, lz);
    lamp.rotation.z = (Math.random() - 0.5) * 0.6;
    world.root.add(lamp);
    swingLamps.push(lamp);
  }
  world.propAnims.push({
    update: (_dt, t) => {
      for (let i = 0; i < swingLamps.length; i++) {
        swingLamps[i].rotation.z = Math.sin(t * (0.5 + i * 0.13) + i) * 0.16 + (i % 2 ? 0.2 : -0.15);
      }
    },
  });

  /* ---- quemaduras en el suelo (círculos de hollín) ---- */
  const scorchMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45, depthWrite: false });
  for (let i = 0; i < 16; i++) {
    const sc = new THREE.Mesh(new THREE.CircleGeometry(0.8 + Math.random() * 2.2, 18), scorchMat);
    sc.rotation.x = -Math.PI / 2;
    sc.position.set(-40 + Math.random() * 80, 0.06, -60 + Math.random() * 24);
    world.root.add(sc);
  }

  /* ---- capa de humo flotando cerca del techo ---- */
  for (let i = 0; i < 6; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: sharedSmokeTexture(), color: 0x181410, transparent: true, opacity: 0.28, depthWrite: false,
    }));
    s.scale.set(24 + Math.random() * 16, 12 + Math.random() * 8, 1);
    s.position.set(-36 + i * 14, 7.2 + Math.random() * 0.8, -58 + Math.random() * 20);
    s.userData.vx = 0.14 + Math.random() * 0.1;
    world.root.add(s);
    const smokeDrift = s;
    world.propAnims.push({
      update: (dt, t) => {
        smokeDrift.position.x += (smokeDrift.userData.vx as number) * dt;
        if (smokeDrift.position.x > 46) smokeDrift.position.x = -46;
        (smokeDrift.material as THREE.SpriteMaterial).opacity = 0.22 + Math.sin(t * 0.3 + i) * 0.07;
      },
    });
  }

  /* ---- el FUEGO: sistema de zonas (fuente única de posiciones) ---- */
  setMegaFire(new FireSystem(world));
}
