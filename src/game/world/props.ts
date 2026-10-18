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

/** Armario (escondite) */
function locker(world: WorldBuilder, x: number, z: number, ry: number) {
  const g = new THREE.Group();
  const mat = darkMetalMaterial();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 2.0, 0.6), mat);
  body.position.y = 1.0;
  body.castShadow = true;
  g.add(body);
  for (const dx of [-0.19, 0.19]) {
    const doorP = new THREE.Mesh(new THREE.BoxGeometry(0.36, 1.9, 0.03), metalMaterial([0.3, 0.8]));
    doorP.position.set(dx, 1.0, 0.32);
    g.add(doorP);
    const vent1 = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.03, 0.05), mat);
    vent1.position.set(dx, 1.7, 0.34);
    const vent2 = vent1.clone();
    vent2.position.y = 1.6;
    g.add(vent1, vent2);
  }
  g.position.set(x, 0, z);
  g.rotation.y = ry;
  world.root.add(g);
  const c = Math.abs(Math.cos(ry)), s = Math.abs(Math.sin(ry));
  world.addCollider(
    new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(x, 1, z), new THREE.Vector3(0.8 * c + 0.6 * s, 2, 0.6 * c + 0.8 * s)),
    `locker_${x.toFixed(1)}_${z.toFixed(1)}`
  );
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
  buildDaycare(world);
  buildMegaDaycare(world);
  buildFoodcourt(world);
  buildRestrooms(world);
  buildProms(world);
  buildLobby(world);
  buildTechHall(world);
  buildServices(world);
  buildGenerator(world);
  buildSouthService(world);

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

  // LINTERNA del guardia sobre el escritorio (anclaje cap 1 — EL PRIMER TURNO)
  const deskTorch = new THREE.Group();
  const glbDeskTorch = Assets.rigs.get('flashlight');
  if (glbDeskTorch) {
    const torchModel = glbDeskTorch.root.clone(true);
    torchModel.rotation.z = Math.PI / 2;
    torchModel.rotation.y = -0.55;
    torchModel.position.y = 0.015;
    deskTorch.add(torchModel);
  } else {
    const torchBody = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.24, 10), metalMaterial([0.35, 0.9]));
    torchBody.rotation.z = Math.PI / 2.3;
    deskTorch.add(torchBody);
  }
  const deskTorchLens = new THREE.Mesh(
    new THREE.SphereGeometry(0.042, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0x88aaff, emissive: 0x66ccff, emissiveIntensity: 2.0 })
  );
  deskTorchLens.position.set(0.13, 0.015, 0);
  deskTorch.add(deskTorchLens);
  deskTorch.position.set(CX - 0.12, 0.84, 22.3);
  deskTorch.rotation.y = -0.55;
  world.root.add(deskTorch);
  // brillo tenue de espera
  const deskLensMat = deskTorchLens.material as THREE.MeshStandardMaterial;
  world.propAnims.push({ update: (_dt, t) => { deskLensMat.emissiveIntensity = 1.4 + Math.sin(t * 2.1) * 0.7; } });
  world.anchors.set('desk_torch', { pos: new THREE.Vector3(CX - 0.12, 0.86, 22.3), mesh: deskTorch });

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
  neonSign(world, 'SEGURIDAD', 0x44ff88, CX, 2.9, 19.2, 0, 2.0, 0.45);
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
  neonSign(world, 'GALERÍAS', 0xd8b13a, 0, 6.2, 18.4, Math.PI, 3.4, 0.6);
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
  neonSign(world, 'GALERÍA ESTELAR', 0xff8844, -37, 3.6, -9.6, 0, 3.2, 0.55);
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

  neonSign(world, 'TEATRO BRUNO', 0xff4466, -23, 4.9, -9.6, 0, 3.0, 0.55);
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
  neonSign(world, 'SALÓN RECREATIVO', 0x37ff88, -9, 3.9, -9.6, 0, 3.4, 0.55);
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
  neonSign(world, 'BOLERA BRUNO', 0x4aafff, 5, 4.2, -9.6, 0, 3.2, 0.55);
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
  neonSign(world, 'PREMIOS', 0xd8b13a, 19, 3.4, -9.6, 0, 2.4, 0.5);
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

  neonSign(world, 'GOLF DEL CAIMÁN', 0x4ad86e, 35, 3.9, -9.6, 0, 3.4, 0.55);
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

/* ============ GUARDERÍA (SUPER GUARDERÍA BRUNO — arranque en la alberca) ============ */

/** rectángulo de la ALBERCA DE PELOTAS gigante (para zona de ruido/sigilo) */
export const BALL_PIT = { x1: -27, z1: 3, x2: -18, z2: 10 };

/** generadores Sol y Luna (posiciones deben coincidir con trials.json) */
export const DAYCARE_GEN_SPOTS: Array<[number, number, number]> = [
  // [x, z, rotY] — repartidos por la guardería
  [-26.2, 9.3, Math.PI / 2],   // g1: dentro de la alberca (oeste)
  [-26.2, 0.9, Math.PI / 2],   // g2: suroeste (juguetería)
  [-26.4, 11.6, 0],            // g3: noroeste (piano)
  [-17.9, 11.9, Math.PI],      // g4: noreste (torre)
  [-17.4, 5.2, Math.PI],       // g5: este (bajo el arcoíris)
];

function buildDaycare(world: WorldBuilder) {
  // Sala: x[-29,-16] z[-3,13], h 4.5

  /* ---- ALBERCA DE PELOTAS GIGANTE (9 × 7 m) — estilo Security Breach ---- */
  const pit = new THREE.Group();
  const PX = -22.5, PZ = 6.5;            // centro
  const PW = 9, PD = 7;                  // ancho × fondo interior
  const WALL_H = 0.55;                   // altura del muro acolchado

  // suelo interior azul oscuro (fondo de la alberca)
  const floorMat = plasticMaterial(0x1a2a6a, 0.95, 0.2);
  const floor = new THREE.Mesh(new THREE.BoxGeometry(PW, 0.06, PD), floorMat);
  floor.position.set(PX, 0.03, PZ);
  floor.receiveShadow = true;
  pit.add(floor);

  // muros acolchados de colores con canto redondeado (SIN colisionador: se vadea)
  const rimColors = [0xd84a4a, 0x4ad84a, 0xd8d84a, 0x4a8fd8, 0xd84ad8, 0xd8842a];
  const padSide = (i: number) => plasticMaterial(rimColors[i % 6], 0.9, 0.15);
  function wallRun(x0: number, z0: number, x1: number, z1: number, segs: number) {
    const dx = (x1 - x0) / segs, dz = (z1 - z0) / segs;
    const horiz = Math.abs(dx) > Math.abs(dz);
    const len = horiz ? Math.abs(dx) : Math.abs(dz);
    for (let i = 0; i < segs; i++) {
      const cx = x0 + dx * (i + 0.5), cz = z0 + dz * (i + 0.5);
      const mat = padSide(i + Math.floor(Math.random() * 3));
      // cuerpo del muro
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(horiz ? len * 0.98 : 0.34, WALL_H, horiz ? 0.34 : len * 0.98),
        mat
      );
      body.position.set(cx, WALL_H / 2, cz);
      body.castShadow = true;
      pit.add(body);
      // canto superior redondeado
      const cap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.17, 0.17, horiz ? len * 0.98 : len * 0.98, 10),
        plasticMaterial(rimColors[(i + 3) % 6], 0.85, 0.2)
      );
      cap.rotation.z = Math.PI / 2;
      if (!horiz) cap.rotation.y = Math.PI / 2;
      cap.position.set(cx, WALL_H + 0.02, cz);
      pit.add(cap);
    }
  }
  wallRun(PX - PW / 2, PZ - PD / 2, PX + PW / 2, PZ - PD / 2, 9);   // norte
  wallRun(PX - PW / 2, PZ + PD / 2, PX + PW / 2, PZ + PD / 2, 9);   // sur
  wallRun(PX - PW / 2, PZ - PD / 2, PX - PW / 2, PZ + PD / 2, 7);   // oeste
  wallRun(PX + PW / 2, PZ - PD / 2, PX + PW / 2, PZ + PD / 2, 7);   // este

  // escalón de gomaespuma de entrada (lado este, hacia la guardería)
  for (let s = 0; s < 2; s++) {
    const step = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.16 + s * 0.16, 2.0),
      plasticMaterial(s === 0 ? 0xd84a4a : 0x4a8fd8, 0.9, 0.15)
    );
    step.position.set(PX + PW / 2 + 0.34 + s * 0.55, (0.16 + s * 0.16) / 2, PZ);
    pit.add(step);
  }

  // MAR DE BOLAS: 3 capas en empaquetado hexagonal denso (1 draw call)
  const ballColors = [
    0xe8382e, 0x2e6ee8, 0xf2d030, 0x38c24a, 0xf27a20, 0xf0ead8, 0xd838a8, 0x35c8c8,
  ];
  const R = 0.115;                       // radio de bola
  const hexDx = R * 2 * 0.88;            // paso horizontal (apretado)
  const hexDz = R * 2 * 0.78;            // paso vertical (hex)
  const cols = Math.floor(PW / hexDx);
  const rows = Math.floor(PD / hexDz);
  const BALL_N = cols * rows * 3 + 220;  // 3 capas + derrame
  const ballGeo = new THREE.SphereGeometry(R, 18, 14);
  // plástico brillante con clearcoat (v7): las bolas atrapan la luz
  const ballMat = new THREE.MeshPhysicalMaterial({
    roughness: 0.24, metalness: 0.0, clearcoat: 0.85, clearcoatRoughness: 0.25,
    envMapIntensity: 1.1,
  });
  const ballsIM = new THREE.InstancedMesh(ballGeo, ballMat, BALL_N);
  ballsIM.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const dummy = new THREE.Object3D();
  const col = new THREE.Color();
  let bi = 0;
  const topY = WALL_H - 0.10;
  for (let layer = 0; layer < 3; layer++) {
    const ly = 0.10 + layer * R * 1.55;
    const off = (layer % 2) * (hexDx / 2);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (bi >= BALL_N - 220) break;
        const jx = (Math.random() - 0.5) * 0.03;
        const jz = (Math.random() - 0.5) * 0.03;
        dummy.position.set(
          PX - PW / 2 + R + 0.1 + c * hexDx + off + jx,
          ly + (Math.random() - 0.5) * 0.012,
          PZ - PD / 2 + R + 0.1 + r * hexDz + jz
        );
        dummy.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
        const sc = 0.94 + Math.random() * 0.18;
        dummy.scale.set(sc, sc, sc);
        dummy.updateMatrix();
        ballsIM.setMatrixAt(bi, dummy.matrix);
        ballsIM.setColorAt(bi, col.setHex(ballColors[(layer * 5 + r * 3 + c) % ballColors.length]));
        bi++;
      }
    }
  }
  // bolas derramadas fuera de la alberca (suelo de la guardería)
  const outside: Array<[number, number]> = [
    [PX + PW / 2 + 1.6, PZ - 1.5], [PX + PW / 2 + 2.1, PZ + 0.6], [PX + PW / 2 + 1.4, PZ + 2.2],
    [PX - PW / 2 - 1.2, PZ + 1.0], [PX - PW / 2 - 1.8, PZ - 0.8], [PX - PW / 2 - 1.1, PZ + 2.4],
    [PX + 1.0, PZ + PD / 2 + 1.3], [PX - 2.0, PZ + PD / 2 + 1.7], [PX + 3.2, PZ + PD / 2 + 1.1],
    [PX + 0.4, PZ - PD / 2 - 1.4], [PX - 3.1, PZ - PD / 2 - 1.1],
  ];
  for (let s = 0; s < 220 && bi < BALL_N; s++) {
    const [ox, oz] = outside[s % outside.length];
    const far = 0.4 + Math.random() * 1.4;
    const ang = Math.random() * Math.PI * 2;
    dummy.position.set(ox + Math.cos(ang) * far, R * 0.9, oz + Math.sin(ang) * far);
    dummy.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    ballsIM.setMatrixAt(bi, dummy.matrix);
    ballsIM.setColorAt(bi, col.setHex(ballColors[s % ballColors.length]));
    bi++;
  }
  // rellenar instancias restantes por si la capa no llenó (invisibles bajo la superficie)
  while (bi < BALL_N) {
    dummy.position.set(PX + (Math.random() - 0.5) * PW * 0.9, 0.1, PZ + (Math.random() - 0.5) * PD * 0.9);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    ballsIM.setMatrixAt(bi, dummy.matrix);
    ballsIM.setColorAt(bi, col.setHex(0x2e6ee8));
    bi++;
  }
  ballsIM.castShadow = false;
  ballsIM.receiveShadow = false;
  pit.add(ballsIM);
  world.root.add(pit);
  // vaivén sutil del mar de bolas (respiración)
  world.propAnims.push({ update: (_dt, t) => { ballsIM.position.y = Math.sin(t * 0.6) * 0.012; } });


  /* ---- TORRE DE JUEGOS con tobogán (este) — la linterna brilla arriba ---- */
  const tower = new THREE.Group();
  const structMat = plasticMaterial(0x3a6ac8, 0.55, 0.4);
  // patas
  for (const [lx, lz] of [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]] as Array<[number, number]>) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 2.6, 10), metalMaterial([0.5, 1]));
    leg.position.set(lx, 1.3, lz);
    tower.add(leg);
  }
  // plataforma
  const plat = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.14, 2.2), structMat);
  plat.position.set(0, 1.35, 0);
  plat.castShadow = true;
  tower.add(plat);
  // barandilla de tubos
  for (const side of [-1, 1]) {
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.0, 8), plasticMaterial(0xd8d84a, 0.4));
    rail.rotation.z = Math.PI / 2;
    rail.position.set(0, 1.85, side * 1.06);
    tower.add(rail);
    const rail2 = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.0, 8), plasticMaterial(0xd84a4a, 0.4));
    rail2.rotation.z = Math.PI / 2;
    rail2.position.set(side * 1.06, 1.85, 0);
    tower.add(rail2);
  }
  // escalera de mano
  for (let i = 0; i < 5; i++) {
    const rung = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.8, 8), metalMaterial([0.6, 1]));
    rung.rotation.z = Math.PI / 2;
    rung.position.set(0, 0.3 + i * 0.27, -1.28);
    tower.add(rung);
  }
  // tobogán (rampa curva)
  const slideMat = plasticMaterial(0xd84a4a, 0.25, 0.5);
  const slide = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 2.8), slideMat);
  slide.position.set(0.15, 0.62, 1.8);
  slide.rotation.x = -0.42;
  slide.castShadow = true;
  tower.add(slide);
  for (const sx of [-0.36, 0.36]) {
    const lip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.26, 2.8), plasticMaterial(0xd8d84a, 0.3));
    lip.position.set(0.15 + sx, 0.72, 1.8);
    lip.rotation.x = -0.42;
    tower.add(lip);
  }
  tower.position.set(-17.6, 0, 8.6);
  world.root.add(tower);
  world.addCollider(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(-17.6, 1.3, 8.6), new THREE.Vector3(2.4, 2.7, 2.4)), 'playtower');

  /* ---- 5 GENERADORES SOL Y LUNA ---- */
  DAYCARE_GEN_SPOTS.forEach(([gx, gz, gry], i) => {
    const gen = new THREE.Group();
    // cuerpo con franjas de peligro
    const bodyMat = plasticMaterial(0xd8b13a, 0.45, 0.5);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.15, 0.55), bodyMat);
    body.position.y = 0.58;
    body.castShadow = true;
    gen.add(body);
    const stripeMat = plasticMaterial(0x1a1a1a, 0.5, 0.4);
    for (let s = 0; s < 3; s++) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.12, 0.57), stripeMat);
      stripe.position.y = 0.3 + s * 0.34;
      gen.add(stripe);
    }
    // panel superior
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.34, 0.08), metalMaterial([0.4, 1]));
    panel.position.set(0, 1.3, 0.14);
    gen.add(panel);
    // palanca
    const lever = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.26, 8), plasticMaterial(0xd84a4a, 0.4));
    lever.position.set(0, 1.32, 0.2);
    lever.rotation.x = -0.5;
    gen.add(lever);
    // LUZ DE ESTADO (roja → verde al arrancar)
    const status = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0x5a0808, emissive: 0xff2020, emissiveIntensity: 2.6 })
    );
    status.position.set(0, 1.62, 0);
    gen.add(status);
    world.propAnims.push({
      update: (_dt, t) => {
        const m = status.material as THREE.MeshStandardMaterial;
        if (m.emissive.getHex() === 0xff2020) m.emissiveIntensity = 1.8 + Math.sin(t * 5 + i * 1.7) * 0.9;
      },
    });
    // rejilla de ventilación
    for (let v = 0; v < 3; v++) {
      const vent = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.03, 0.4), metalMaterial([0.3, 1]));
      vent.position.set(0, 0.22 + v * 0.09, 0);
      gen.add(vent);
    }
    gen.position.set(gx, 0, gz);
    gen.rotation.y = gry;
    world.root.add(gen);
    world.addCollider(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(gx, 0.7, gz), new THREE.Vector3(0.95, 1.5, 0.75)), `dcgen_${i}`);
    world.anchors.set(`dcgen_g${i + 1}`, { pos: new THREE.Vector3(gx, 1.1, gz), mesh: status });
  });

  /* ---- lunas de noche decorativas (emisivas, coste 0) ---- */
  const moonLampMat = new THREE.MeshStandardMaterial({ color: 0x8a93d8, emissive: 0x4a5ac8, emissiveIntensity: 1.2 });
  for (const [mx, mz, mry] of [[-28.85, 4, Math.PI / 2], [-16.15, 9, -Math.PI / 2], [-22.5, 12.85, Math.PI], [-24, -2.82, 0]] as Array<[number, number, number]>) {
    const lamp = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.05, 16), moonLampMat);
    disc.rotation.x = Math.PI / 2;
    lamp.add(disc);
    // creciente
    const bite = new THREE.Mesh(new THREE.SphereGeometry(0.19, 12, 10), plasticMaterial(0x1a1a2e, 0.6));
    bite.position.set(-0.09, 0.07, 0.045);
    lamp.add(bite);
    lamp.position.set(mx, 2.8, mz);
    lamp.rotation.y = mry;
    world.root.add(lamp);
  }

  /* ---- estrellas del techo (Points baratísimas) ---- */
  const starGeo = new THREE.BufferGeometry();
  const starPos: number[] = [];
  for (let i = 0; i < 90; i++) {
    starPos.push(-28.5 + Math.random() * 12, 4.25 + Math.random() * 0.2, -2.5 + Math.random() * 15);
  }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xbcd0ff, size: 0.05, transparent: true, opacity: 0.85 }));
  world.root.add(stars);

  /* ---- carteles de cara SOL / LUNA en las paredes ---- */
  const faceDisc = (x: number, z: number, ry: number, sun: boolean) => {
    const g = new THREE.Group();
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(0.42, 24),
      plasticMaterial(sun ? 0xf2c93a : 0x232a52, 0.4, 0.4)
    );
    g.add(disc);
    const smile = new THREE.Mesh(
      new THREE.TorusGeometry(0.2, 0.035, 8, 16, Math.PI),
      plasticMaterial(sun ? 0x5a1410 : 0xe8e4d0, 0.5)
    );
    smile.position.y = -0.08;
    smile.rotation.z = Math.PI; // arco sonriente hacia abajo
    g.add(smile);
    for (const sx of [-0.16, 0.16]) {
      const eye = new THREE.Mesh(
        new THREE.SphereGeometry(0.05, 8, 8),
        new THREE.MeshStandardMaterial({ color: 0x0a0a12, emissive: sun ? 0x3a2a08 : 0xff3030, emissiveIntensity: sun ? 0.4 : 1.6 })
      );
      eye.position.set(sx, 0.12, 0.03);
      g.add(eye);
    }
    g.position.set(x, 2.5, z);
    g.rotation.y = ry;
    world.root.add(g);
  };
  faceDisc(-28.8, 7.5, Math.PI / 2, false); // LUNA junto a la alberca
  faceDisc(-16.2, 3.2, -Math.PI / 2, true); // SOL junto al arcoíris

  /* ---- mobiliario clásico de guardería ---- */
  shelfUnit(world, -27.8, 1.5, Math.PI / 2, 2.6, 5);
  // mesas pequeñas con sillas (sur de la alberca)
  const tableColors = [0xd8b13a, 0x4a8fd8, 0xd84a8a];
  for (let i = 0; i < 3; i++) {
    const tx = -24 + i * 3.2;
    const tz = 1.2;
    const table = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.45, 0.5, 12), plasticMaterial(tableColors[i], 0.5, 0.4));
    table.position.set(tx, 0.25, tz);
    table.castShadow = true;
    world.root.add(table);
    world.addCollider(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(tx, 0.3, tz), new THREE.Vector3(1.1, 0.6, 1.1)), `dtable_${i}`);
    for (const s of [-0.8, 0.8]) {
      const chair = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 0.28), plasticMaterial(tableColors[i], 0.6));
      chair.position.set(tx + s, 0.14, tz + (s > 0 ? 0.85 : -0.85));
      world.root.add(chair);
    }
  }

  // arcoíris decorativo (pared este)
  const rainbowColors = [0xd84a4a, 0xd8a83a, 0x4ad84a, 0x4a8fd8, 0x8a4ad8];
  for (let i = 0; i < 5; i++) {
    const arc = new THREE.Mesh(
      new THREE.TorusGeometry(2.2 - i * 0.32, 0.11, 8, 32, Math.PI),
      plasticMaterial(rainbowColors[i], 0.5, 0.4)
    );
    arc.position.set(-16.3, 0.1, 5);
    arc.rotation.y = -Math.PI / 2;
    world.root.add(arc);
  }

  // caballito de balancín
  const horse = new THREE.Group();
  const hBody = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.45, 6, 10), plasticMaterial(0xc8a8d8, 0.6));
  hBody.rotation.z = Math.PI / 2;
  const hHead = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), plasticMaterial(0xc8a8d8, 0.6));
  hHead.position.set(0.5, 0.15, 0);
  const hRock = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.06, 0.14), woodMaterial([0.6, 0.4]));
  hRock.position.y = -0.32;
  horse.add(hBody, hHead, hRock);
  horse.position.set(-20.5, 0.55, 11.9);
  horse.rotation.y = 0.8;
  world.root.add(horse);
  world.addCollider(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(-20.5, 0.5, 11.9), new THREE.Vector3(1.2, 1.0, 0.5)), 'horse');
  world.propAnims.push({ update: (_dt, t) => { horse.rotation.z = Math.sin(t * 0.9) * 0.12; } });

  // dibujos infantiles por todas las paredes
  addDrawing(world, 0, -28.85, 1.5, 1, Math.PI / 2);
  addDrawing(world, 1, -28.85, 1.5, 4, Math.PI / 2);
  addDrawing(world, 2, -28.85, 1.5, 9.5, Math.PI / 2);
  addDrawing(world, 3, -20, 1.5, -2.82, 0);
  addDrawing(world, 4, -24, 1.5, -2.82, 0);
  addDrawing(world, 5, -22, 2.2, 12.85, Math.PI);

  neonSign(world, 'SUPER GUARDERÍA', 0xffd070, -22.5, 3.9, -2.7, 0, 3.4, 0.5);
  neonSign(world, 'ALBERCA DE PELOTAS', 0x70d0ff, -22.5, 1.9, 2.75, 0, 3.2, 0.42);

  // juguete de piano enorme
  const piano = new THREE.Group();
  const pBody2 = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.55, 0.8), plasticMaterial(0xd83a3a, 0.4, 0.6));
  pBody2.position.y = 0.4;
  piano.add(pBody2);
  for (let i = 0; i < 8; i++) {
    const key = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.04, 0.3), plasticMaterial(i % 2 ? 0x111111 : 0xe8e2d2, 0.5));
    key.position.set(-0.63 + i * 0.18, 0.7, 0.2);
    piano.add(key);
  }
  piano.position.set(-26.2, 0, 10.2);
  piano.rotation.y = 0.4;
  world.root.add(piano);
  world.addCollider(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(-26.2, 0.5, 10.2), new THREE.Vector3(1.7, 1.0, 0.9)), 'piano');
  world.anchors.set('tape_daycare', { pos: new THREE.Vector3(-27.8, 1.1, 1.5) });
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
    [25, -2.2, 'PATATAS', 0xd8a83a],
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
  neonSign(world, 'CALA DEL PIRATA', 0x9a7ad8, -36.5, 2.9, -3.5, Math.PI, 2.8, 0.45);
  neonSign(world, 'GUARDERÍA', 0xffd070, -22, 2.9, -3.5, Math.PI, 1.8, 0.45);
  neonSign(world, 'COMIDA', 0xff8844, 23, 2.9, -3.5, Math.PI, 1.5, 0.45);
  neonSign(world, 'BAÑOS', 0x88aaff, 37, 2.9, -3.5, Math.PI, 1.2, 0.4);
  neonSign(world, 'VESTÍBULO', 0x44ff88, 0, 3.1, 13.4, 0, 2.0, 0.45);
  neonSign(world, 'OFICINA', 0xffd070, -37.5, 2.9, 18.7, Math.PI, 1.5, 0.4);
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
  neonSign(world, 'COMPLEJO BRUNO', 0xffc83a, -5, 5.2, 33.8, Math.PI, 6.0, 1.0);
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
  locker(world, -41, 32.5, 0);
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


/* ============ MEGA GUARDERÍA EN LLAMAS (v7 — capítulo 4) ============ */
/* Sala: x[-44,44] z[-62,-34], techo 9 m. La guardería GIGANTE arde:
   alberca chamuscada, castillo de juegos calcinado, piano gigante,
   arcoíris semi-fundido, carrusel roto... y LUNA colgando del techo. */

import { FireSystem, MEGA_EXTINTORES, setMegaFire, sharedSmokeTexture } from './fire';

/** rectángulo de la ALBERCA GIGANTE quemada (zona de ruido/sigilo) */
export const MEGA_PIT = { x1: -7.5, z1: -47, x2: 7.5, z2: -38 };

/** material "chamuscado": plástico negro-grisáceo mate */
function charMat(rough = 0.92): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color: 0x1c1815, roughness: rough, metalness: 0.05 });
}

function buildMegaDaycare(world: WorldBuilder) {
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
  // anillo-percha
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.55, 0.05, 8, 22),
    new THREE.MeshStandardMaterial({ color: 0x3a2a20, roughness: 0.5, metalness: 0.8 })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = -2.0;
  perch.add(ring);
  // resplandor rojo tenue bajo la percha (la "presencia" de Luna)
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

  /* ---- ALBERCA DE PELOTAS GIGANTE (15 × 9 m), medio chamuscada ---- */
  const pit = new THREE.Group();
  const PX = 0, PZ = -42.5;
  const PW = 15, PD = 9;
  const WALL_H2 = 0.66;
  // fondo interior oscuro
  const floor2 = new THREE.Mesh(
    new THREE.BoxGeometry(PW, 0.06, PD),
    new THREE.MeshStandardMaterial({ color: 0x201812, roughness: 0.7 })
  );
  floor2.position.set(PX, 0.03, PZ);
  floor2.receiveShadow = true;
  pit.add(floor2);
  // muros acolchados con la tela de fiesta (algunos paneles calcinados)
  const padTex = Assets.textures?.texPartyFabric;
  const padMat = (burnedPanel: boolean) => {
    if (!burnedPanel && padTex) {
      const m = padTex.clone();
      m.wrapS = m.wrapT = THREE.RepeatWrapping;
      m.repeat.set(2, 0.5);
      m.needsUpdate = true;
      return new THREE.MeshStandardMaterial({ map: m, roughness: 0.8, color: 0x6a5a4a });
    }
    return charMat();
  };
  function wallRun2(x0: number, z0: number, x1: number, z1: number, segs: number) {
    const dx = (x1 - x0) / segs, dz = (z1 - z0) / segs;
    const horiz = Math.abs(dx) > Math.abs(dz);
    const len = horiz ? Math.abs(dx) : Math.abs(dz);
    for (let i = 0; i < segs; i++) {
      const cx = x0 + dx * (i + 0.5), cz = z0 + dz * (i + 0.5);
      const burnedPanel = Math.random() < 0.3;
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(horiz ? len * 0.98 : 0.36, WALL_H2, horiz ? 0.36 : len * 0.98),
        padMat(burnedPanel)
      );
      body.position.set(cx, WALL_H2 / 2, cz);
      body.castShadow = true;
      pit.add(body);
      const cap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.18, len * 0.98, 10),
        burnedPanel ? charMat() : plasticMaterial(0xd8842a, 0.7, 0.3)
      );
      cap.rotation.z = Math.PI / 2;
      if (!horiz) cap.rotation.y = Math.PI / 2;
      cap.position.set(cx, WALL_H2 + 0.02, cz);
      pit.add(cap);
    }
  }
  wallRun2(PX - PW / 2, PZ - PD / 2, PX + PW / 2, PZ - PD / 2, 12);
  wallRun2(PX - PW / 2, PZ + PD / 2, PX + PW / 2, PZ + PD / 2, 12);
  wallRun2(PX - PW / 2, PZ - PD / 2, PX - PW / 2, PZ + PD / 2, 7);
  wallRun2(PX + PW / 2, PZ - PD / 2, PX + PW / 2, PZ + PD / 2, 7);

  // MAR DE BOLAS: 3 capas hexagonales, paleta viva + bolas fundidas negras
  const ballColors2 = [
    0xe8382e, 0x2e6ee8, 0xf2d030, 0x38c24a, 0xf27a20, 0xf0ead8, 0xd838a8, 0x35c8c8,
    0x181210, 0x2a1410, 0x351a08,
  ];
  const R2 = 0.125;
  const hexDx2 = R2 * 2 * 0.88;
  const hexDz2 = R2 * 2 * 0.78;
  const cols2 = Math.floor(PW / hexDx2);
  const rows2 = Math.floor(PD / hexDz2);
  const BALL_N2 = cols2 * rows2 * 3 + 260;
  const ballGeo2 = new THREE.SphereGeometry(R2, 18, 14);
  // plástico brillante con clearcoat: las bolas brillan con la luz del fuego
  const ballMat2 = new THREE.MeshPhysicalMaterial({
    roughness: 0.28, metalness: 0.0, clearcoat: 0.9, clearcoatRoughness: 0.22,
    envMapIntensity: 1.3,
  });
  const ballsIM2 = new THREE.InstancedMesh(ballGeo2, ballMat2, BALL_N2);
  ballsIM2.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const dummy2 = new THREE.Object3D();
  const col2 = new THREE.Color();
  let bi2 = 0;
  for (let layer = 0; layer < 3; layer++) {
    const ly = 0.10 + layer * R2 * 1.55;
    const off = (layer % 2) * (hexDx2 / 2);
    for (let r = 0; r < rows2; r++) {
      for (let c = 0; c < cols2; c++) {
        if (bi2 >= BALL_N2 - 260) break;
        dummy2.position.set(
          PX - PW / 2 + R2 + 0.12 + c * hexDx2 + off + (Math.random() - 0.5) * 0.03,
          ly + (Math.random() - 0.5) * 0.012,
          PZ - PD / 2 + R2 + 0.12 + r * hexDz2 + (Math.random() - 0.5) * 0.03
        );
        dummy2.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
        const sc = 0.93 + Math.random() * 0.2;
        dummy2.scale.set(sc, sc, sc);
        dummy2.updateMatrix();
        ballsIM2.setMatrixAt(bi2, dummy2.matrix);
        // la esquina sureste "ardió": mezcla de bolas fundidas
        const melt = c > cols2 * 0.55 && r < rows2 * 0.35;
        ballsIM2.setColorAt(
          bi2,
          col2.setHex(melt ? ballColors2[8 + (Math.random() * 3 | 0)] : ballColors2[(layer * 5 + r * 3 + c) % 8])
        );
        bi2++;
      }
    }
  }
  // bolas derramadas por la sala quemada
  const spill: Array<[number, number]> = [
    [PX + 8.4, PZ - 3.6], [PX + 9.1, PZ - 1.8], [PX + 8.8, PZ + 1.0], [PX + 8.6, PZ + 3.4],
    [PX - 8.3, PZ - 2.2], [PX - 8.9, PZ + 1.4], [PX - 8.5, PZ + 3.6],
    [PX - 2.0, PZ - 5.2], [PX + 2.4, PZ - 5.4], [PX + 5.0, PZ - 5.6],
    [PX - 4.4, PZ + 5.4], [PX + 1.2, PZ + 5.8],
  ];
  for (let s = 0; s < 260 && bi2 < BALL_N2; s++) {
    const [ox, oz] = spill[s % spill.length];
    const far = 0.3 + Math.random() * 1.6;
    const ang = Math.random() * Math.PI * 2;
    dummy2.position.set(ox + Math.cos(ang) * far, R2 * 0.9, oz + Math.sin(ang) * far);
    dummy2.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    dummy2.scale.set(1, 1, 1);
    dummy2.updateMatrix();
    ballsIM2.setMatrixAt(bi2, dummy2.matrix);
    ballsIM2.setColorAt(bi2, col2.setHex(ballColors2[Math.random() < 0.4 ? 8 + (Math.random() * 3 | 0) : (Math.random() * 8 | 0)]));
    bi2++;
  }
  while (bi2 < BALL_N2) {
    dummy2.position.set(PX + (Math.random() - 0.5) * PW * 0.9, 0.1, PZ + (Math.random() - 0.5) * PD * 0.9);
    dummy2.scale.set(1, 1, 1);
    dummy2.updateMatrix();
    ballsIM2.setMatrixAt(bi2, dummy2.matrix);
    ballsIM2.setColorAt(bi2, col2.setHex(0x2e6ee8));
    bi2++;
  }
  pit.add(ballsIM2);
  world.root.add(pit);
  world.propAnims.push({ update: (_dt, t) => { ballsIM2.position.y = Math.sin(t * 0.55) * 0.014; } });

  /* ---- CASTILLO DE JUEGOS CALCINADO (oeste, x[-40,-27] z[-50,-39]) ---- */
  const castle = new THREE.Group();
  const postMat = charMat();
  const plast = (c: number) => plasticMaterial(c, 0.72, 0.15);
  // torres en las esquinas
  const towers: Array<[number, number, number]> = [
    [-39.2, -49.2, 5.6], [-28.0, -49.2, 5.0], [-39.2, -39.5, 4.2], [-28.0, -39.5, 3.4],
  ];
  for (const [tx, tz, th] of towers) {
    const tw = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.36, th, 10), postMat);
    tw.position.set(tx - (-33.5), th / 2, tz - (-44.5));
    tw.castShadow = true;
    castle.add(tw);
    // tejado cónico quemado
    const roof = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.7, 8), charMat());
    roof.position.set(tx - (-33.5), th + 0.35, tz - (-44.5));
    castle.add(roof);
  }
  // plataformas multi-nivel
  const plats: Array<[number, number, number, number, number]> = [
    [-36.5, 1.6, -47.0, 5.0, 4.0],   // nivel 1 norte
    [-36.5, 3.2, -47.0, 3.6, 3.0],   // nivel 2 norte
    [-34.0, 1.6, -41.5, 8.0, 3.6],   // nivel 1 sur
  ];
  for (const [px, py, pz, pw, pd] of plats) {
    const plat = new THREE.Mesh(new THREE.BoxGeometry(pw, 0.14, pd), charWood);
    plat.position.set(px - (-33.5), py, pz - (-44.5));
    plat.castShadow = true;
    castle.add(plat);
    // vallas rotas
    for (const sz of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(pw * 0.9, 0.07, 0.07), charred);
      rail.position.set(px - (-33.5), py + 0.55, pz - (-44.5) + (sz * pd) / 2);
      rail.rotation.z = Math.random() * 0.06;
      castle.add(rail);
    }
  }
  // rampa-tobogán derrumbada
  const slide2 = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.09, 5.6), plasticMaterial(0x8a2a1a, 0.65, 0.2));
  slide2.position.set(-30.2 - (-33.5), 1.9, -43.8 - (-44.5));
  slide2.rotation.set(-0.34, 0.25, 0.12);
  castle.add(slide2);
  // tubo-túnel (medio derretido)
  const tube = new THREE.Mesh(
    new THREE.TorusGeometry(1.15, 0.62, 12, 24, Math.PI * 1.15),
    plasticMaterial(0x6a2018, 0.8, 0.1)
  );
  tube.position.set(-37.5 - (-33.5), 1.15, -41.2 - (-44.5));
  tube.rotation.y = Math.PI / 2;
  castle.add(tube);
  castle.position.set(-33.5, 0, -44.5);
  world.root.add(castle);
  world.addCollider(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(-36.5, 2.4, -47.0), new THREE.Vector3(5.4, 4.8, 4.4)), 'mega_castle_n');
  world.addCollider(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(-34.0, 0.9, -41.5), new THREE.Vector3(8.4, 1.8, 3.9)), 'mega_castle_s');
  world.addCollider(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(-37.5, 1.2, -41.2), new THREE.Vector3(1.6, 2.4, 2.4)), 'mega_tube');

  /* ---- PIANO GIGANTE (norte centro) — teclas de colores pisables ---- */
  const piano2 = new THREE.Group();
  const keyColors = [0xd84040, 0xd8a040, 0xd8d840, 0x40d860, 0x40a0d8, 0x8040d8];
  for (let i = 0; i < 16; i++) {
    const key = new THREE.Mesh(
      new THREE.BoxGeometry(0.86, 0.12, 1.7),
      plasticMaterial(keyColors[i % 6], 0.6, 0.3)
    );
    key.position.set(-7.2 + i * 0.96, 0.06, 0);
    key.castShadow = true;
    piano2.add(key);
  }
  // costados del piano
  for (const sx of [-7.8, 7.8]) {
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 1.9), plasticMaterial(0x3a3a3a, 0.45, 0.4));
    side.position.set(sx, 0.45, 0);
    piano2.add(side);
  }
  piano2.position.set(1.2, 0, -59.4);
  piano2.rotation.y = 0;
  world.root.add(piano2);
  world.addCollider(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(1.2, 0.45, -59.4), new THREE.Vector3(16.6, 0.9, 1.9)), 'mega_piano');

  /* ---- ESTANTERÍA GIGANTE CAÍDA (noreste, apoyada en la pared) ---- */
  const shelf = new THREE.Group();
  const shMat = charMat(0.8);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(11, 0.5, 2.6), shMat);
  frame.position.y = 1.2;
  shelf.add(frame);
  for (const bx of [-5.2, 5.2]) {
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6.5, 0.4), shMat);
    back.position.set(bx, 3.2, -1.15);
    shelf.add(back);
  }
  // peluches calcinados esparcidos
  for (let i = 0; i < 14; i++) {
    const pl = new THREE.Mesh(
      new THREE.SphereGeometry(0.22 + Math.random() * 0.14, 10, 8),
      charMat(0.95)
    );
    pl.position.set((Math.random() - 0.5) * 10, 1.5 + Math.random() * 0.3, (Math.random() - 0.5) * 1.6);
    pl.scale.y = 0.7;
    shelf.add(pl);
  }
  shelf.position.set(35, 0, -58.5);
  shelf.rotation.z = 0.12;
  shelf.rotation.y = -0.08;
  world.root.add(shelf);
  world.addCollider(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(35, 1.6, -58.5), new THREE.Vector3(11.5, 3.4, 2.8)), 'mega_shelf');

  /* ---- ARCOÍRIS SEMI-FUNDIDO (corredor este, sobre la ruta e5→e6) ---- */
  const rainbowColors2 = [0x8a3030, 0x8a6828, 0x38702f, 0x2f5570, 0x523070];
  for (let i = 0; i < 5; i++) {
    const arc = new THREE.Mesh(
      new THREE.TorusGeometry(3.4 - i * 0.45, 0.16, 10, 30, Math.PI),
      plasticMaterial(rainbowColors2[i], 0.6, 0.3)
    );
    arc.position.set(21.5, 0.05, -50 + i * 3.4);
    arc.rotation.y = -Math.PI / 2;
    arc.rotation.z = 0;
    world.root.add(arc);
    world.addCollider(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(21.5, 1.0, -50 + i * 3.4), new THREE.Vector3(0.5, 2.0, 2.0)), `mega_rainbow_${i}`, false);
  }
  // un arco desprendido en el suelo
  const fallen = new THREE.Mesh(
    new THREE.TorusGeometry(2.8, 0.15, 10, 26, Math.PI * 0.9),
    plasticMaterial(0x6a2020, 0.75, 0.15)
  );
  fallen.position.set(16, 0.15, -55);
  fallen.rotation.set(Math.PI / 2, 0.3, 0);
  world.root.add(fallen);

  /* ---- CARRUSEL ROTO (este) ---- */
  const carousel = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.4, 0.55, 22), charMat(0.75));
  base.position.y = 0.28;
  base.castShadow = true;
  carousel.add(base);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 6.4, 12), beamMat);
  pole.position.y = 3.4;
  carousel.add(pole);
  const roof2 = new THREE.Mesh(new THREE.ConeGeometry(4.8, 1.6, 18), plasticMaterial(0x5a1a1a, 0.8, 0.1));
  roof2.position.y = 7.0;
  carousel.add(roof2);
  // caballitos torcidos colgando de cadenas
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const r = 3.4;
    const cx = Math.cos(a) * r, cz = Math.sin(a) * r;
    const hh = 1.4 + (i % 3) * 0.7;
    for (const [chx, chz] of [[cx - 0.16, cz], [cx + 0.16, cz]] as Array<[number, number]>) {
      const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, hh + 1.2, 6), beamMat);
      chain.position.set(chx, (5.6 + hh) / 2, chz);
      carousel.add(chain);
    }
    const horse2 = new THREE.Group();
    const hb = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.42, 6, 10), plasticMaterial(i % 2 ? 0x7a3a5a : 0x3a5a7a, 0.7));
    hb.rotation.z = Math.PI / 2 + (Math.random() - 0.5) * 0.7;
    horse2.add(hb);
    const hh2 = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), plasticMaterial(i % 2 ? 0x7a3a5a : 0x3a5a7a, 0.7));
    hh2.position.set(0.42, 0.12, 0);
    horse2.add(hh2);
    horse2.position.set(cx, hh, cz);
    horse2.rotation.y = -a + Math.PI / 2;
    carousel.add(horse2);
  }
  carousel.position.set(36, 0, -46);
  world.root.add(carousel);
  world.addCollider(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(36, 1.2, -46), new THREE.Vector3(8.6, 2.4, 8.6)), 'mega_carousel');
  world.propAnims.push({ update: (_dt, t) => { carousel.rotation.y = Math.sin(t * 0.11) * 0.04; } });

  /* ---- COFIRES DE JUGUETES (escondites) ---- */
  const chestMat = plasticMaterial(0x8a5a2a, 0.75, 0.1);
  const chests: Array<[number, number, number]> = [
    [-25, -39, 0], [-8, -52, 0.5], [26, -38.5, -0.4], [10, -57, 0.2],
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

  /* ---- 7 ESTACIONES DE EXTINTORES (anclas dcgen_eN para el sistema de pruebas) ---- */
  MEGA_EXTINTORES.forEach(([ex, ez, ery], i) => {
    const g = new THREE.Group();
    // cuerpo rojo con banda
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
    // cabeza + palanca + manguera
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
    // manómetro
    const gauge = new THREE.Mesh(
      new THREE.SphereGeometry(0.045, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xd8d0b0, emissive: 0x807850, emissiveIntensity: 0.4 })
    );
    gauge.position.set(-0.1, 0.94, 0.03);
    g.add(gauge);
    // cartel verde sobre el soporte
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.2, 0.04),
      new THREE.MeshStandardMaterial({ color: 0x0a2a10, emissive: 0x22c840, emissiveIntensity: 1.1 })
    );
    sign.position.set(0, 1.65, 0.02);
    g.add(sign);
    // LUZ DE ESTADO (roja → verde al usarse; mismo convenio que generadores)
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
    // ancla con el MISMO convenio que los generadores (dcgen_<taskId>)
    world.anchors.set(`dcgen_e${i + 1}`, { pos: new THREE.Vector3(ex, 1.1, ez), mesh: status });
  });

  /* ---- decoración: dibujos quemados, letreros, lámparas caídas ---- */
  addDrawing(world, 1, -43.8, 1.8, -40, Math.PI / 2);
  addDrawing(world, 3, -43.8, 1.8, -48, Math.PI / 2);
  addDrawing(world, 5, 43.8, 1.8, -44, -Math.PI / 2);
  addDrawing(world, 2, 20, 1.8, -61.8, 0);
  neonSign(world, 'MEGA GUARDERÍA', 0xff7030, 0, 8.0, -34.35, 0, 5.0, 0.7);
  neonSign(world, 'SALIDA DE EMERGENCIA', 0x40ff70, -37, 3.1, -34.35, 0, 2.6, 0.5);
  neonSign(world, 'SALIDA DE EMERGENCIA', 0x40ff70, -22, 3.1, -34.35, 0, 2.6, 0.5);
  neonSign(world, 'SALIDA DE EMERGENCIA', 0x40ff70, -6, 3.1, -34.35, 0, 2.6, 0.5);
  // lámparas-luna colgando torcidas (una se balancea)
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

  /* ---- quemaduras en el suelo (circulos de hollín) ---- */
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
