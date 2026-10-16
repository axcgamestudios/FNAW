/**
 * Mobiliario y decoración de todas las salas.
 * Incluye anclajes (anchors) para misiones y objetos recogibles.
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

/** Ventilador de techo animado */
function ceilingFan(world: WorldBuilder, x: number, z: number) {
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
  g.position.set(x, 3.2, z);
  world.root.add(g);
  FANS.push(blades);
}

/** Luminaria rota colgando (oscila) */
function brokenLight(world: WorldBuilder, x: number, z: number) {
  const g = new THREE.Group();
  const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.9, 5), darkMetalMaterial());
  wire.position.y = -0.45;
  const bulb = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.14, 0.22, 8),
    new THREE.MeshStandardMaterial({ color: 0xfff2cc, emissive: 0xffe9b0, emissiveIntensity: 1.2 })
  );
  bulb.position.y = -0.95;
  g.add(wire, bulb);
  g.position.set(x, 3.2, z);
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
  // cajas de cartón
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
  world.addCollider(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(x, 1, z), new THREE.Vector3(ry % Math.PI < 0.1 ? len : 0.7, 2, ry % Math.PI < 0.1 ? 0.7 : len)));
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
  // marquesina
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

/* ============ CONSTRUCCIÓN POR SALAS ============ */

export function buildProps(world: WorldBuilder) {
  buildOffice(world);
  buildStage(world);
  buildDining(world);
  buildKidsCove(world);
  buildArcade(world);
  buildPrize(world);
  buildKitchen(world);
  buildStorage(world);
  buildSecretRoom(world);
  buildWorkshop(world);
  buildElectrical(world);
  buildMachinery(world);
  buildExit(world);
  buildRestrooms(world);
  buildHalls(world);
  buildCeilingDecor(world);

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

function buildOffice(world: WorldBuilder) {
  const deskMat = woodMaterial([1.5, 0.9]);
  box(3.4, 0.08, 1.15, deskMat, 0, 0.78, 13.6, 0, true, world);
  for (const dx of [-1.55, 1.55]) for (const dz of [-0.45, 0.45]) {
    box(0.09, 0.78, 0.09, darkMetalMaterial(), dx, 0.39, 13.6 + dz, 0, false, world);
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
  monitor.position.set(-0.9, 1.28, 13.3);
  monitor.rotation.y = Math.PI + 0.2;
  world.root.add(monitor);
  world.anchors.set('desk_monitor', { pos: new THREE.Vector3(-0.9, 1.28, 13.3), mesh: monitor });

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
  // jaula protectora: dos aros + radios
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
  fan.position.set(0.62, 0.82, 13.45);
  fan.rotation.y = -0.35;
  fan.traverse((o) => {
    if (o instanceof THREE.Mesh) { o.castShadow = true; }
  });
  world.root.add(fan);
  world.propAnims.push({ update: (dt) => { blades.rotation.z += dt * 16; } });

  // Prop de linterna (modelo GLB real) + tableta (recogibles capítulo 1)
  const torch = new THREE.Group();
  const glbTorch = Assets.rigs.get('flashlight');
  if (glbTorch) {
    const torchModel = glbTorch.root.clone(true);
    torchModel.rotation.z = Math.PI / 2;
    torchModel.rotation.y = 0.4;
    torchModel.position.y = 0.1;
    torch.add(torchModel);
  } else {
    const torchBody = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.24, 10), metalMaterial([0.4, 0.4]));
    torchBody.rotation.z = Math.PI / 2;
    const torchLens = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.045, 0.04, 10), new THREE.MeshStandardMaterial({ color: 0xfff8dd, emissive: 0xfff0c0, emissiveIntensity: 0.35 }));
    torchLens.rotation.z = Math.PI / 2;
    torchLens.position.x = 0.13;
    torch.add(torchBody, torchLens);
  }
  torch.position.set(1.6, 0.86, 13.7);
  torch.rotation.y = 0.4;
  world.root.add(torch);
  world.anchors.set('desk_torch', { pos: new THREE.Vector3(1.6, 0.86, 13.7), mesh: torch });

  const tablet = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.02, 0.22), plasticMaterial(0x1a1e22, 0.4));
  const tabletScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.16), new THREE.MeshStandardMaterial({ color: 0x0a0f0a, emissive: 0x33ff55, emissiveIntensity: 0.12 }));
  tabletScreen.rotation.x = -Math.PI / 2;
  tabletScreen.position.y = 0.02;
  const tabG = new THREE.Group();
  tabG.add(tablet, tabletScreen);
  tabG.position.set(1.1, 0.86, 13.8);
  tabG.rotation.y = -0.3;
  world.root.add(tabG);
  world.anchors.set('desk_tablet', { pos: new THREE.Vector3(1.1, 0.86, 13.8), mesh: tabG });

  // cupcake de Chica sobre el escritorio (pastel rosa con ojos y vela)
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
  cupcake.position.set(2.3, 0.82, 13.75);
  world.root.add(cupcake);
  world.propAnims.push({
    update: (_dt, t) => {
      flame.scale.setScalar(0.85 + Math.sin(t * 11) * 0.18 + Math.random() * 0.06);
      (flame.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.8 + Math.sin(t * 9) * 0.5;
    },
  });

  // gorrito de fiesta en el escritorio
  const partyHat = new THREE.Mesh(
    new THREE.ConeGeometry(0.05, 0.14, 10),
    plasticMaterial(0x3a8ad8, 0.4, 0.6)
  );
  partyHat.position.set(-1.95, 0.895, 13.9);
  partyHat.rotation.z = 0.18;
  world.root.add(partyHat);

  // radios del techo colgando (chismes sucios)
  const wirePts: Array<[number, number, number]> = [
    [-2.5, 3.2, 11.5], [-1.5, 2.55, 12.2], [-0.2, 2.6, 12.6], [1.1, 2.5, 12.4],
  ];
  const wireCurve = new THREE.CatmullRomCurve3(wirePts.map((p) => new THREE.Vector3(...p)));
  const wire = new THREE.Mesh(
    new THREE.TubeGeometry(wireCurve, 24, 0.014, 6),
    new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.9 })
  );
  world.root.add(wire);
  const wire2Pts: Array<[number, number, number]> = [
    [2.5, 3.2, 15.5], [1.8, 2.6, 14.8], [0.8, 2.68, 14.2],
  ];
  const wire2 = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(wire2Pts.map((p) => new THREE.Vector3(...p))), 20, 0.012, 6),
    new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.9 })
  );
  world.root.add(wire2);

  // Cámaras de vigilancia en las esquinas de la oficina (una vigilando al guardia)
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
    cam.position.set(x, 2.72, z);
    cam.rotation.y = ry;
    cam.traverse((o) => { if (o instanceof THREE.Mesh) o.castShadow = true; });
    world.root.add(cam);
    world.propAnims.push({
      update: (_dt, t) => {
        // parpadeo del LED y vaivén lento del cuerpo (servo)
        (led.material as THREE.MeshStandardMaterial).emissiveIntensity = Math.sin(t * 3.2) > 0 ? 2.5 : 0.4;
        body.rotation.y = Math.sin(t * 0.35 + x) * 0.12;
      },
    });
    return cam;
  };
  buildWallCam(-5.5, 10.2, Math.PI / 2 + 0.5);   // esquina NO mirando a la puerta sur
  buildWallCam(5.5, 16.2, -Math.PI / 2 - 0.4);   // esquina SE mirando al escritorio

  // Archivadores
  for (const [dx, dz] of [[-5.2, 10.5], [-5.2, 11.7]] as Array<[number, number]>) {
    box(0.55, 1.35, 0.6, darkMetalMaterial(), dx, 0.675, dz, 0, true, world);
  }
  // Cajas apiladas en la esquina
  const boxMat = new THREE.MeshStandardMaterial({ color: 0x6b5a3e, roughness: 0.88 });
  box(0.55, 0.42, 0.55, boxMat, 5.45, 0.21, 10.3, 0.2, true, world);
  box(0.46, 0.36, 0.46, boxMat, 5.42, 0.6, 10.32, -0.14, false, world);
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
  chair.position.set(0, 0.55, 14.6);
  world.root.add(chair);

  // Panel eléctrico de la oficina (anclaje misión 1)
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
  panel.position.set(-5.75, 1.5, 13);
  panel.rotation.y = Math.PI / 2;
  world.root.add(panel);
  world.anchors.set('office_panel', { pos: new THREE.Vector3(-5.6, 1.5, 13), mesh: panel });

  // Pósters, dibujos infantiles y corcho con notas
  addPoster(world, posterBruno(), -2.5, 1.9, 16.9, Math.PI);
  addPoster(world, posterParty(), 2.8, 1.9, 16.9, Math.PI);
  addDrawing(world, 3, -1.3, 1.75, 16.9, Math.PI);
  addDrawing(world, 1, 4.1, 1.75, 16.9, Math.PI);
  addDrawing(world, 2, -3.6, 1.7, 9.14, 0);
  // fila de dibujos en la pared oeste
  addDrawing(world, 4, -5.86, 1.8, 11.5, Math.PI / 2);
  addDrawing(world, 5, -5.86, 1.8, 12.6, Math.PI / 2);
  // corcho con avisos
  const cork = new THREE.Mesh(
    new THREE.BoxGeometry(1.1, 0.8, 0.04),
    new THREE.MeshStandardMaterial({ color: 0x8a6a44, roughness: 0.95 })
  );
  cork.position.set(5.86, 1.85, 12.4);
  cork.rotation.y = -Math.PI / 2;
  world.root.add(cork);
  for (let i = 0; i < 4; i++) {
    const note = new THREE.Mesh(
      new THREE.PlaneGeometry(0.2, 0.24),
      new THREE.MeshStandardMaterial({ color: [0xd9d2be, 0xcfd8c8, 0xd8ccb8, 0xd2c8d8][i], roughness: 0.9 })
    );
    note.position.set(5.82, 1.65 + (i % 2) * 0.35, 12.05 + ((i / 2) | 0) * 0.42);
    note.rotation.set(0, -Math.PI / 2, (Math.random() - 0.5) * 0.3);
    world.root.add(note);
  }
  // Nota del esquema maestro (lore / misión 5)
  const noteM = new THREE.Mesh(
    new THREE.PlaneGeometry(0.24, 0.3),
    new THREE.MeshStandardMaterial({ color: 0xd9d2be, emissive: 0x555533, emissiveIntensity: 0.06 })
  );
  noteM.position.set(4.9, 1.35, 16.92);
  noteM.rotation.set(0, Math.PI, 0);
  world.root.add(noteM);
  world.anchors.set('note_master', { pos: new THREE.Vector3(4.9, 1.4, 16.9), mesh: noteM });
  world.anchors.set('tape_office', { pos: new THREE.Vector3(-4.8, 1.2, 16.8) });

  // Taza de café, papeles y walkie sobre el escritorio
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.035, 0.09, 8), plasticMaterial(0xd8d2c2, 0.6));
  cup.position.set(-1.7, 0.87, 13.9);
  world.root.add(cup);
  for (let i = 0; i < 3; i++) {
    const papers = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.008, 0.19), plasticMaterial(0xc9c2ae, 0.9));
    papers.position.set(-1.9 + i * 0.06, 0.83 + i * 0.009, 13.5 - i * 0.05);
    papers.rotation.y = 0.4 + i * 0.5;
    world.root.add(papers);
  }
  const walkie = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.03), plasticMaterial(0x1a1c20, 0.6));
  walkie.position.set(0.15, 0.91, 13.95);
  walkie.rotation.y = -0.6;
  world.root.add(walkie);
  const walkieAnt = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.12, 6), darkMetalMaterial());
  walkieAnt.position.set(0.12, 1.03, 13.94);
  world.root.add(walkieAnt);
}

function buildStage(world: WorldBuilder) {
  // Tarima
  const plat = box(9.8, 0.45, 4.4, woodMaterial([4, 2]), 8.5, 0.225, -14.8, 0, false, world);
  plat.receiveShadow = true;
  // Borde de luces de la tarima
  const skirt = new THREE.Mesh(
    new THREE.BoxGeometry(9.8, 0.12, 0.06),
    new THREE.MeshStandardMaterial({ color: 0x220a0a, emissive: 0x882211, emissiveIntensity: 0.5 })
  );
  skirt.position.set(8.5, 0.2, -12.62);
  world.root.add(skirt);

  // Telón (cortinas laterales + fondo estrellado)
  const curtainMat = new THREE.MeshStandardMaterial({ color: 0x5a1220, roughness: 0.9, bumpMap: woodMaterial([1, 1]).map, bumpScale: 0.08 });
  for (const cx of [3.7, 13.3]) {
    const cur = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2.6, 4.4), curtainMat);
    cur.position.set(cx, 1.3, -14.8);
    world.root.add(cur);
    world.addCollider(new THREE.Box3().setFromCenterAndSize(cur.position.clone(), new THREE.Vector3(0.55, 2.6, 4.4)));
    (cur as unknown as { wavePhase: number }).wavePhase = cx;
    world.propAnims.push({
      update: (_dt, t) => {
        cur.scale.x = 1 + Math.sin(t * 0.4 + cx) * 0.03;
      },
    });
  }
  // Fondo con estrellas
  const backdrop = new THREE.Mesh(
    new THREE.PlaneGeometry(9.2, 2.8),
    new THREE.MeshStandardMaterial({ color: 0x0e1226, emissive: 0x223048, emissiveIntensity: 0.35, roughness: 0.6 })
  );
  backdrop.position.set(8.5, 1.4, -16.95);
  world.root.add(backdrop);
  // Estrellitas del fondo
  for (let i = 0; i < 24; i++) {
    const st = new THREE.Mesh(
      new THREE.PlaneGeometry(0.08, 0.08),
      new THREE.MeshStandardMaterial({ color: 0xd8c86a, emissive: 0xd8c86a, emissiveIntensity: 1.1 })
    );
    st.position.set(4.4 + Math.random() * 8.2, 0.6 + Math.random() * 2.1, -16.93);
    world.root.add(st);
  }
  // Micrófono
  const mic = new THREE.Group();
  const micPole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 1.1, 6), darkMetalMaterial());
  const micTop = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), metalMaterial([0.4, 0.4]));
  micTop.position.y = 0.58;
  mic.add(micPole, micTop);
  mic.position.set(8.5, 0.45, -13.2);
  world.root.add(mic);
  // Altavoces
  for (const sx of [4.4, 12.6]) {
    const sp = box(0.8, 1.2, 0.7, darkMetalMaterial(), sx, 1.05, -16.3, 0, true, world);
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.1, 10), plasticMaterial(0x1a1a1a, 0.8));
    cone.rotation.x = Math.PI / 2;
    cone.position.set(sx, 1.0, -15.92);
    world.root.add(cone);
  }
}

function buildDining(world: WorldBuilder) {
  const tableTopMat = woodMaterial([1.2, 1.2]);
  const positions: Array<[number, number]> = [
    [-11.5, 0.5], [-11.5, 2.8], [-9, -1.2], [-9, 1.8], [-6.5, 0.3], [-6.5, 2.6], [-3.5, 0.6], [-3.5, 2.9], [-11.8, -1.9], [-6.8, -1.6],
  ];
  for (const [x, z] of positions) {
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.07, 18), tableTopMat);
    top.position.set(x, 0.76, z);
    top.castShadow = true;
    top.receiveShadow = true;
    world.root.add(top);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.75, 8), darkMetalMaterial());
    pole.position.set(x, 0.38, z);
    world.root.add(pole);
    world.addCollider(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(x, 0.4, z), new THREE.Vector3(1.4, 0.85, 1.4)), undefined, false);
    // sombreros de fiesta
    for (let hIdx = 0; hIdx < 3; hIdx++) {
      const hat = new THREE.Mesh(
        new THREE.ConeGeometry(0.07, 0.16, 8),
        plasticMaterial([0xd84a4a, 0xd8b13a, 0x4a8fd8][(x + z + hIdx) % 3 < 0 ? 0 : (Math.abs(x + z + hIdx) | 0) % 3] ?? 0xd84a4a, 0.5)
      );
      hat.position.set(x + (Math.random() - 0.5) * 0.8, 0.87, z + (Math.random() - 0.5) * 0.8);
      hat.rotation.z = (Math.random() - 0.5) * 0.3;
      world.root.add(hat);
    }
    // sillas alrededor
    for (let c = 0; c < 4; c++) {
      const ang = (c / 4) * Math.PI * 2 + 0.4;
      const chx = x + Math.cos(ang) * 1.15;
      const chz = z + Math.sin(ang) * 1.15;
      const ch = new THREE.Group();
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.05, 0.4), tableTopMat);
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.05), tableTopMat);
      back.position.set(0, 0.27, -0.19);
      const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.45, 6), darkMetalMaterial());
      legs.position.y = -0.25;
      ch.add(seat, back, legs);
      ch.position.set(chx, 0.48, chz);
      ch.rotation.y = -ang + Math.PI / 2;
      world.root.add(ch);
    }
  }
  // Carteles de pared
  addPoster(world, posterParty(), -13.3, 1.9, 0.5, Math.PI / 2);
  addPoster(world, posterBruno(), 2.9, 1.9, -1.5, -Math.PI / 2);
  addDrawing(world, 0, -13.3, 1.5, 2.5, Math.PI / 2);
  addDrawing(world, 0, 2.9, 1.6, -2.5, -Math.PI / 2);
  // guirnalda
  const banner = new THREE.Mesh(
    new THREE.BoxGeometry(14, 0.16, 0.02),
    new THREE.MeshStandardMaterial({ color: 0x7a3040, emissive: 0x401018, emissiveIntensity: 0.25 })
  );
  banner.position.set(-5, 2.7, -1);
  banner.rotation.z = 0.03;
  world.root.add(banner);
  for (let i = 0; i < 10; i++) {
    const pen = new THREE.Mesh(
      new THREE.ConeGeometry(0.05, 0.14, 6),
      plasticMaterial([0xd84a4a, 0xd8b13a, 0x4a8fd8, 0x4ad86e][i % 4], 0.5)
    );
    pen.position.set(-11.5 + i * 1.4, 2.6, -1);
    pen.rotation.x = Math.PI;
    world.root.add(pen);
  }
}

function buildKidsCove(world: WorldBuilder) {
  /* ============ LA CALA DEL PIRATA (guarida de Foxy) ============ */
  // Sala: x [3,13], z [-3.5,5]. El telón cierra el norte con un hueco central
  // por donde Foxy asoma la cabeza (FNAF Pirate Cove).

  // tarima baja de la cala (visual, sin colisión para no bloquear a la IA)
  const platMat = woodMaterial([3, 1.6]);
  box(7.6, 0.16, 1.0, platMat, 8, 0.08, -3.0, 0, false, world);

  // telón estrellado púrpura: dos paños laterales con hueco central (x=8)
  const curtainMat = new THREE.MeshStandardMaterial({
    map: pirateCurtainTex(),
    roughness: 0.92,
    side: THREE.DoubleSide,
  });
  const curtainPanel = (x: number, w: number) => {
    const cur = new THREE.Mesh(new THREE.BoxGeometry(w, 2.8, 0.1), curtainMat);
    cur.position.set(x, 1.42, -2.72);
    cur.castShadow = true;
    cur.receiveShadow = true;
    world.root.add(cur);
    world.addCollider(new THREE.Box3().setFromCenterAndSize(cur.position.clone(), new THREE.Vector3(w, 2.8, 0.2)), `cove_curtain_${x}`);
    return cur;
  };
  curtainPanel(5.85, 3.3);
  curtainPanel(10.15, 3.3);
  // drapeado superior sobre el hueco (Foxy lo empuja al salir)
  const valance = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 0.12), curtainMat);
  valance.position.set(8, 2.62, -2.72);
  world.root.add(valance);
  world.propAnims.push({
    update: (_dt, t) => {
      // el hueco respira: la cortina central se mece
      valance.rotation.z = Math.sin(t * 0.8) * 0.03;
    },
  });

  // pilares del telón
  for (const px of [4.05, 11.95]) {
    box(0.18, 2.9, 0.18, woodMaterial([0.4, 2]), px, 1.45, -2.72, 0, true, world);
  }

  // cartel de neón sobre el telón
  const neon = new THREE.Mesh(
    new THREE.PlaneGeometry(2.2, 0.55),
    new THREE.MeshStandardMaterial({ map: pirateCoveSignTex(), emissive: 0x9a7ad8, emissiveIntensity: 0.55, roughness: 0.6 })
  );
  neon.position.set(8, 3.0, -2.64);
  world.root.add(neon);

  // farolillo moribundo dentro de la cala (deja ver los ojos de Foxy)
  const coveLight = new THREE.PointLight(0x8a6ad8, 3.5, 6, 1.9);
  coveLight.position.set(8, 2.3, -3.0);
  world.root.add(coveLight);

  // cartel de madera "FUERA DE SERVICIO" en caballete, delante del hueco
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
  sign.position.set(8, 0, -1.85);
  sign.rotation.set(-0.06, 0.14, 0.015);
  world.root.add(sign);
  world.addCollider(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(8, 0.5, -1.85), new THREE.Vector3(1.0, 0.9, 0.3)), 'cove_sign');

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
  chest.position.set(4.6, 0, -1.6);
  chest.rotation.y = 0.5;
  chest.traverse((o) => {
    if (o instanceof THREE.Mesh) { o.castShadow = true; o.receiveShadow = true; }
  });
  world.root.add(chest);
  world.addCollider(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(4.6, 0.25, -1.6), new THREE.Vector3(0.65, 0.5, 0.5)), 'cove_chest');

  // silueta de barco pirata de cartón (pared este de la cala)
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
  ship.position.set(11.9, 0.35, -1.4);
  ship.rotation.y = -0.5;
  ship.traverse((o) => {
    if (o instanceof THREE.Mesh) { o.castShadow = true; o.receiveShadow = true; }
  });
  world.root.add(ship);
  world.addCollider(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(11.9, 0.8, -1.4), new THREE.Vector3(1.4, 1.8, 0.5)), 'cove_ship');

  // luna recortada y estrellas en la pared oeste
  const moon = new THREE.Mesh(
    new THREE.CircleGeometry(0.35, 24),
    new THREE.MeshStandardMaterial({ color: 0xd8c890, emissive: 0x554420, emissiveIntensity: 0.25, roughness: 0.8 })
  );
  moon.position.set(3.35, 2.5, 1.2);
  moon.rotation.y = Math.PI / 2;
  world.root.add(moon);

  // dibujos infantiles de Foxy hechos por los niños
  addDrawing(world, 1, 3.35, 1.6, -0.8, -Math.PI / 2);
  addDrawing(world, 2, 3.35, 1.6, 2.6, -Math.PI / 2);
}

function buildArcade(world: WorldBuilder) {
  const cabs: Array<[number, number, number, boolean]> = [
    [15.5, -2.4, 0.1, false], [16.7, -2.4, 0.1, true], [17.9, -2.4, 0.1, false],
    [21.5, -2.4, -0.1, false], [22.7, -2.4, -0.1, false],
    [15.2, 3.8, Math.PI, false], [16.4, 3.8, Math.PI, true], [21.8, 3.8, Math.PI, false],
  ];
  cabs.forEach(([x, z, ry, broken], i) => arcadeCabinet(world, x, z, ry, broken, [0x37ff88, 0xff8844, 0x88aaff][i % 3]));
  // Mesa de hockey
  box(1.6, 0.75, 0.9, plasticMaterial(0x224433, 0.6, 0.4), 19, 0.38, 1.5, 0.2, true, world);
  // Cartel SALA DE JUEGOS
  const sign = new THREE.Mesh(
    new THREE.BoxGeometry(2.8, 0.5, 0.06),
    new THREE.MeshStandardMaterial({ color: 0x3a1020, emissive: 0xff3344, emissiveIntensity: 0.55 })
  );
  sign.position.set(18.5, 2.65, -3.4);
  world.root.add(sign);
  world.anchors.set('tape_arcade', { pos: new THREE.Vector3(19, 0.85, 1.5) });
  // Ficha suelta en el suelo
  const token = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.008, 10), metalMaterial([0.3, 0.3]));
  token.position.set(19.5, 0.06, 2.2);
  world.root.add(token);
}

function buildPrize(world: WorldBuilder) {
  // La caja musical sobre pedestal, con pequeño carrusel
  const pedestal = box(0.9, 0.95, 0.9, darkMetalMaterial(), -2, 0.475, -14.5, 0, true, world);
  const mb = new THREE.Group();
  const mbBox = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.55, 0.7), plasticMaterial(0x6a1f2e, 0.4, 0.7));
  mbBox.position.y = 0.28;
  const mbRoof = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.3, 4), plasticMaterial(0x8a2f3e, 0.4, 0.7));
  mbRoof.position.y = 0.68;
  mbRoof.rotation.y = Math.PI / 4;
  const carousel = new THREE.Group();
  const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.4, 12), plasticMaterial(0xd8c05a, 0.35, 0.8));
  carousel.add(cyl);
  const figureColors = [0xd84a4a, 0x4a8fd8, 0x4ad86e, 0xd8b13a];
  for (let i = 0; i < 4; i++) {
    const f = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.07, 4, 8), plasticMaterial(figureColors[i], 0.4, 0.7));
    body.position.y = 0.28;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), plasticMaterial(figureColors[i], 0.4, 0.7));
    head.position.y = 0.38;
    f.add(body, head);
    f.position.set(Math.cos((i / 4) * Math.PI * 2) * 0.16, 0, Math.sin((i / 4) * Math.PI * 2) * 0.16);
    carousel.add(f);
  }
  carousel.position.y = 0.28;
  carousel.position.x = 0.12;
  mb.add(mbBox, mbRoof, carousel);
  mb.position.set(-2, 0.95, -14.5);
  world.root.add(mb);
  world.anchors.set('music_box', { pos: new THREE.Vector3(-2, 1.2, -14.5), mesh: mb });
  world.propAnims.push({ update: (dt, t) => { carousel.rotation.y += dt * 0.35; carousel.position.y = 0.28 + Math.sin(t * 2.2) * 0.008; } });

  // Luz cálida sobre la caja musical
  const mbLight = new THREE.PointLight(0xffd9a8, 26, 7, 1.7);
  mbLight.position.set(-2, 2.2, -14.5);
  world.root.add(mbLight);
  (mbLight as unknown as { userData: { mbLight?: boolean } }).userData.mbLight = true;

  // Regalos
  const giftColors = [0xa83a3a, 0x3a6aa8, 0x8a8a3a];
  for (let i = 0; i < 8; i++) {
    const g = new THREE.Mesh(
      new THREE.BoxGeometry(0.3 + Math.random() * 0.25, 0.25 + Math.random() * 0.2, 0.3 + Math.random() * 0.2),
      plasticMaterial(giftColors[i % 3], 0.6, 0.2)
    );
    g.position.set(-5.4 + Math.random() * 5.5, 0.15 + (i % 3) * 0.001, -16.5 + Math.random() * 2.2);
    g.rotation.y = Math.random() * Math.PI;
    g.castShadow = true;
    world.root.add(g);
  }
  // Mostrador de premios
  box(2.4, 1.0, 0.7, woodMaterial([1, 1]), -4.8, 0.5, -10.2, 0, true, world);
  // Peluches en el mostrador
  for (let i = 0; i < 3; i++) {
    const plush = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 10), plasticMaterial([0x8a5a2c, 0xd8a8c8, 0xd8c05a][i], 0.85));
    plush.position.set(-5.5 + i * 0.6, 1.13, -10.2);
    world.root.add(plush);
  }
  // Letrero RINCÓN DE PREMIOS
  const sign = new THREE.Mesh(
    new THREE.BoxGeometry(3.0, 0.5, 0.06),
    new THREE.MeshStandardMaterial({ color: 0x4a2030, emissive: 0xd8b13a, emissiveIntensity: 0.5 })
  );
  sign.position.set(-2, 2.65, -9.4);
  world.root.add(sign);
  world.anchors.set('tape_prize', { pos: new THREE.Vector3(-4.5, 1.15, -10.2) });
}

function buildKitchen(world: WorldBuilder) {
  const steel = metalMaterial([1, 1]);
  // Mostradores en L (despejados del conducto oeste x=-23.3)
  box(6.0, 0.9, 0.7, steel, -20.2, 0.45, -16.4, 0, true, world);
  box(0.7, 0.9, 3.6, steel, -22.1, 0.45, -14.0, 0, true, world);
  // Cocina industrial
  box(2.2, 1.1, 0.9, darkMetalMaterial(), -17, 0.55, -16.3, 0, true, world);
  for (let i = 0; i < 4; i++) {
    const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.05, 8), plasticMaterial(0xcc2222, 0.5));
    knob.rotation.x = Math.PI / 2;
    knob.position.set(-17.8 + i * 0.5, 0.95, -15.83);
    world.root.add(knob);
  }
  // Nevera enorme
  box(1.4, 2.3, 0.95, steel, -14.2, 1.15, -16.3, 0, true, world);
  const fdoor = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.1, 0.8), steel);
  fdoor.position.set(-13.46, 1.15, -16.3);
  world.root.add(fdoor);
  // Cacerolas colgantes
  const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 3.4, 6), darkMetalMaterial());
  rail.rotation.z = Math.PI / 2;
  rail.position.set(-20.5, 2.3, -14);
  world.root.add(rail);
  for (let i = 0; i < 5; i++) {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.11, 0.16, 10), darkMetalMaterial());
    pot.position.set(-21.8 + i * 0.65, 2.12, -14);
    world.root.add(pot);
  }
  // Mesa de preparación
  box(2.6, 0.9, 1.0, steel, -19, 0.45, -11.5, 0, true, world);
  // Caja de herramientas (anclaje cinta)
  world.anchors.set('tape_kitchen', { pos: new THREE.Vector3(-19, 0.95, -11.5) });
  // Campana extractora
  box(2.4, 0.5, 0.8, darkMetalMaterial(), -17, 2.7, -16.4, 0, false, world);
}

function buildStorage(world: WorldBuilder) {
  // Almacén norte
  shelfUnit(world, -11.5, -15.8, 0, 2.6, 7);
  shelfUnit(world, -7.2, -12.5, Math.PI / 2, 2.4, 5);
  shelfUnit(world, -11.8, -10.2, 0, 2.6, 6);
  world.anchors.set('fuse_storageA', { pos: new THREE.Vector3(-11.5, 1.05, -15.8) });
  world.anchors.set('note_code', { pos: new THREE.Vector3(-7.2, 1.05, -12.5) });
  // Barriles
  for (let i = 0; i < 4; i++) {
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.9, 12), plasticMaterial(0x3a4a3a, 0.8));
    barrel.position.set(-12.5 + (i % 2) * 0.7, 0.45, -10.6 + ((i / 2) | 0) * 0.7);
    barrel.castShadow = true;
    world.root.add(barrel);
    world.addCollider(new THREE.Box3().setFromCenterAndSize(barrel.position.clone(), new THREE.Vector3(0.65, 0.9, 0.65)));
  }

  // Almacén sur (con armarios para esconderse)
  shelfUnit(world, -12.8, 10.4, 0, 2.6, 6);
  shelfUnit(world, -7.2, 12.2, Math.PI / 2, 2.2, 5);
  locker(world, -13.4, 12.2, 0);
  locker(world, -13.4, 11.3, 0);
  world.anchors.set('tape_storageB', { pos: new THREE.Vector3(-12.8, 1.05, 10.4) });
  world.anchors.set('fuse_storageB', { pos: new THREE.Vector3(-7.2, 1.05, 12.2) });
  // La estantería secreta ya existe como puerta
}

function buildSecretRoom(world: WorldBuilder) {
  // Sala oculta: trajes viejos y mesa con grabaciones
  const suitMat = plasticMaterial(0x8a7420, 0.85, 0.05);
  for (let i = 0; i < 5; i++) {
    const suit = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.5, 6, 10), suitMat);
    body.position.y = 1.0;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 10), suitMat);
    head.position.y = 1.5;
    suit.add(body, head);
    suit.position.set(-13.2 + i * 0.7, 0, 16.2);
    suit.rotation.y = Math.PI + (Math.random() - 0.5) * 0.4;
    world.root.add(suit);
    world.addCollider(new THREE.Box3().setFromCenterAndSize(suit.position.clone().setY(1), new THREE.Vector3(0.5, 1.8, 0.5)));
  }
  // traje dorado grande en el rincón
  const golden = new THREE.Group();
  const gbody = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.6, 8, 12), plasticMaterial(0xd8a838, 0.5, 0.5));
  gbody.position.y = 1.1;
  const ghead = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 12), plasticMaterial(0xd8a838, 0.5, 0.5));
  ghead.position.y = 1.7;
  golden.add(gbody, ghead);
  golden.position.set(-7, 0, 16.1);
  world.root.add(golden);
  world.anchors.set('tape_secret', { pos: new THREE.Vector3(-9.5, 0.9, 15.8) });
}

function buildWorkshop(world: WorldBuilder) {
  const benchMat = woodMaterial([1, 0.5]);
  // Bancos de trabajo
  box(4.2, 0.9, 1.1, benchMat, -20.5, 0.45, 1.5, 0, true, world);
  box(3.0, 0.9, 1.0, benchMat, -15.5, 0.45, -1.8, 0.3, true, world);
  world.anchors.set('workbench', { pos: new THREE.Vector3(-20.5, 0.95, 1.5) });
  world.anchors.set('fuse_workshop', { pos: new THREE.Vector3(-15.5, 0.95, -1.8) });
  // Caja de herramientas roja
  const tb = new THREE.Group();
  const tbBase = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.3, 0.3), plasticMaterial(0xaa2222, 0.5));
  const tbLid = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.12, 0.3), plasticMaterial(0x991919, 0.5));
  tbLid.position.y = 0.21;
  const tbHandle = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.02, 6, 10, Math.PI), darkMetalMaterial());
  tbHandle.position.y = 0.3;
  tb.add(tbBase, tbLid, tbHandle);
  tb.position.set(-19.5, 1.0, 1.2);
  world.root.add(tb);
  // Cabezas de repuesto en estantería (inquietantes)
  const headShelf = shelfUnit(world, -23.3, 3.2, Math.PI / 2, 2.4, 0);
  const wallMat = plasticMaterial(0x7a6a58, 0.6);
  for (let i = 0; i < 3; i++) {
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 12), wallMat);
    head.position.set(-23.3, 0.7 + i * 0.65, 2.2 + i * 0.28);
    world.root.add(head);
    const eyes = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 6), new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0x333311, emissiveIntensity: 0.4 }));
    eyes.position.set(-23.3, 0.72 + i * 0.65, 2.06 + i * 0.28);
    world.root.add(eyes);
  }
  // Endoesqueleto de repuesto tendido en el banco
  const endo = buildSpareEndoskeleton();
  endo.position.set(-15.5, 0.95, -1.8);
  endo.rotation.y = 0.4;
  world.root.add(endo);
  // Armario escondite
  locker(world, -22.9, 4.2, 0);
  world.anchors.set('tape_workshop', { pos: new THREE.Vector3(-21.5, 0.95, 1.5) });
  world.anchors.set('cover_workshop', { pos: new THREE.Vector3(-16.5, 0.95, 1.0) });
  // Pistola de grasa y cables
  const grease = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.18, 8), plasticMaterial(0x3355aa, 0.5));
  grease.position.set(-18.6, 0.98, 1.8);
  world.root.add(grease);
}

function buildElectrical(world: WorldBuilder) {
  const panelMat = metalMaterial([0.8, 1]);
  // Generador central
  box(2.2, 1.5, 1.4, darkMetalMaterial(), -21, 0.75, 13, 0, true, world);
  const genLight = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.2, 0.05),
    new THREE.MeshStandardMaterial({ color: 0x113311, emissive: 0x33ff44, emissiveIntensity: 1.2 })
  );
  genLight.position.set(-21, 1.3, 13.72);
  world.root.add(genLight);
  world.propAnims.push({
    update: (_dt, t) => {
      const m = genLight.material as THREE.MeshStandardMaterial;
      m.emissiveIntensity = 0.9 + Math.sin(t * 12) * 0.25;
    },
  });

  // Paneles de interruptores
  for (let p = 0; p < 3; p++) {
    const px = -15.5 + p * 2.8;
    const pg = new THREE.Group();
    const pbody = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.6, 0.15), panelMat);
    pg.add(pbody);
    for (let i = 0; i < 4; i++) {
      const sw = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 0.3, 0.08),
        new THREE.MeshStandardMaterial({ color: i % 2 ? 0x8a2020 : 0x208a3a, roughness: 0.5 })
      );
      sw.position.set(-0.42 + i * 0.28, 0.25, 0.12);
      pg.add(sw);
      (sw as unknown as { switchIndex?: number }).switchIndex = i;
      (sw as unknown as { panelIndex?: number }).panelIndex = p;
    }
    pg.position.set(px, 1.6, 16.9);
    world.root.add(pg);
  }
  world.anchors.set('west_switches', { pos: new THREE.Vector3(-15.5, 1.6, 16.7) });
  world.anchors.set('master_switches', { pos: new THREE.Vector3(-12.7, 1.6, 16.7) });
  world.anchors.set('electrical_panel', { pos: new THREE.Vector3(-18.3, 1.6, 16.7) });
  // Nota del orden (lore)
  const note = new THREE.Mesh(
    new THREE.PlaneGeometry(0.24, 0.3),
    new THREE.MeshStandardMaterial({ color: 0xd9d2be, emissive: 0x444422, emissiveIntensity: 0.05 })
  );
  note.position.set(-17, 1.9, 16.92);
  world.root.add(note);
  world.anchors.set('note_order', { pos: new THREE.Vector3(-17, 1.9, 16.9), mesh: note });
  world.anchors.set('tape_electrical', { pos: new THREE.Vector3(-21, 1.6, 13.8) });
  // Pilas de baterías de repuesto
  shelfUnit(world, -22.5, 10.8, 0, 1.8, 3);
  // Cables del techo
  for (let i = 0; i < 4; i++) {
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 6, 5), plasticMaterial(0x1a1a1a, 0.8));
    cable.rotation.z = Math.PI / 2 + (Math.random() - 0.5) * 0.3;
    cable.position.set(-19 + i * 1.8, 2.7 + Math.random() * 0.3, 11 + Math.random() * 4);
    world.root.add(cable);
  }
}

function buildMachinery(world: WorldBuilder) {
  const steel = metalMaterial([1.2, 1]);
  // Calentador de agua
  const heater = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.8, 14), steel);
  heater.position.set(11.5, 0.9, 15.8);
  heater.castShadow = true;
  world.root.add(heater);
  world.addCollider(new THREE.Box3().setFromCenterAndSize(heater.position.clone(), new THREE.Vector3(1.2, 1.8, 1.2)));
  // Bombas y tuberías
  box(1.8, 1.0, 0.9, darkMetalMaterial(), 8.5, 0.5, 16.3, 0, true, world);
  for (let i = 0; i < 5; i++) {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 6.5, 8), steel);
    pipe.rotation.x = Math.PI / 2;
    pipe.position.set(7.5 + (i % 2) * 0.35, 2.4 + ((i / 2) | 0) * 0.22, 13.5);
    world.root.add(pipe);
  }
  const pipeV = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 3.2, 8), steel);
  pipeV.position.set(6.5, 1.6, 15.5);
  world.root.add(pipeV);
  world.addCollider(new THREE.Box3().setFromCenterAndSize(pipeV.position.clone(), new THREE.Vector3(0.2, 3.2, 0.2)));
  world.anchors.set('tape_machinery', { pos: new THREE.Vector3(8.5, 1.1, 16.3) });
  // Válvulas
  for (let i = 0; i < 2; i++) {
    const valve = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.03, 6, 12), darkMetalMaterial());
    valve.position.set(9.2 + i * 0.8, 1.3, 16.5);
    world.root.add(valve);
  }
}

function buildExit(world: WorldBuilder) {
  // Mostrador de recepción
  box(2.6, 1.05, 0.8, woodMaterial([1.4, 0.7]), 16, 0.525, 14.5, 0.1, true, world);
  const bell = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), metalMaterial([0.3, 0.3]));
  bell.position.set(15.2, 1.1, 14.4);
  world.root.add(bell);
  // Bancos
  box(2.0, 0.45, 0.5, woodMaterial([1, 0.5]), 21.5, 0.225, 12.5, 0, true, world);
  box(2.0, 0.45, 0.5, woodMaterial([1, 0.5]), 21.5, 0.225, 15.5, 0, true, world);
  // Puertas dobles de salida (visual tras la puerta funcional)
  for (const dx of [17.9, 19.2]) {
    const ext = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.3, 0.12), metalMaterial([0.8, 1]));
    ext.position.set(dx, 1.15, 16.85);
    world.root.add(ext);
    const pushBar = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.07, 0.09), darkMetalMaterial());
    pushBar.position.set(dx, 1.05, 16.72);
    world.root.add(pushBar);
  }
  world.anchors.set('exit_door', { pos: new THREE.Vector3(18.5, 1.2, 16.5) });
  // Planta de plástico
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.17, 0.35, 8), plasticMaterial(0x7a4a2a, 0.7));
  pot.position.set(14, 0.18, 16.4);
  world.root.add(pot);
  for (let i = 0; i < 6; i++) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.5, 6), plasticMaterial(0x2a5a2a, 0.8));
    leaf.position.set(14 + (Math.random() - 0.5) * 0.25, 0.55, 16.4 + (Math.random() - 0.5) * 0.25);
    leaf.rotation.set((Math.random() - 0.5) * 0.6, 0, (Math.random() - 0.5) * 0.6);
    world.root.add(leaf);
  }
  // Cartel RECEPCIÓN
  addPoster(world, posterBruno(), 23.9, 1.9, 12, -Math.PI / 2);
}

function buildRestrooms(world: WorldBuilder) {
  const tileMat = plasticMaterial(0x8a8a80, 0.3, 0.4);
  // Cabinas
  for (let i = 0; i < 3; i++) {
    box(0.9, 2.1, 1.2, tileMat, 16.5 + i * 1.1, 1.05, -16.2, 0, true, world);
  }
  // Lavabos
  box(2.2, 0.85, 0.6, tileMat, 22.8, 0.42, -15.8, 0, true, world);
  for (let i = 0; i < 2; i++) {
    const sink = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.12, 10), plasticMaterial(0xd8d2c8, 0.3, 0.5));
    sink.position.set(22.2 + i * 0.7, 0.95, -15.8);
    world.root.add(sink);
  }
  // Espejo
  const mirror = new THREE.Mesh(
    new THREE.PlaneGeometry(1.8, 0.9),
    new THREE.MeshPhysicalMaterial({ color: 0x0a0c0e, roughness: 0.08, metalness: 0.9 })
  );
  mirror.position.set(22.9, 1.7, -16.15);
  mirror.rotation.y = -Math.PI / 2;
  world.root.add(mirror);
  world.anchors.set('tape_restrooms', { pos: new THREE.Vector3(16.5, 1.2, -15.5) });
}

function buildHalls(world: WorldBuilder) {
  // Pósters del pasillo principal
  addPoster(world, posterBruno(), -14, 1.9, -8.85, 0);
  addPoster(world, posterParty(), -2, 1.9, -8.85, 0);
  addPoster(world, posterBruno(), 8, 1.9, -8.85, 0);
  addPoster(world, posterParty(), -20, 1.9, -3.65, Math.PI);
  addPoster(world, posterBruno(), -10, 1.9, -3.65, Math.PI);
  addDrawing(world, 0, -6, 1.6, -3.65, Math.PI);
  addDrawing(world, 2, 14, 1.6, -3.65, Math.PI);
  addDrawing(world, 1, 20, 1.6, -8.85, 0);
  // Ventiladores de techo
  ceilingFan(world, -12, -6.2);
  ceilingFan(world, 6, -6.2);
  ceilingFan(world, 16, -6.2);
  ceilingFan(world, -16, 7);
  ceilingFan(world, 14, 7);
  // Lámpara rota oscilante
  brokenLight(world, -2, 7);
  brokenLight(world, 10, -6.2);
  // Papelera
  for (const [x, z] of [[-22, -5], [12, -5], [-22, 7.5], [22, 7.5], [4, 6.5]] as Array<[number, number]>) {
    const bin = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.18, 0.55, 10), darkMetalMaterial());
    bin.position.set(x, 0.28, z);
    bin.castShadow = true;
    world.root.add(bin);
    world.addCollider(new THREE.Box3().setFromCenterAndSize(bin.position.clone(), new THREE.Vector3(0.45, 0.55, 0.45)));
  }
  // Teléfono público (evento radio)
  const phone = new THREE.Group();
  const phoneBody = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.5, 0.18), plasticMaterial(0x33261a, 0.6));
  phoneBody.position.y = 0.4;
  const phoneBox = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 0.22), darkMetalMaterial());
  phoneBox.position.y = 1.32;
  phone.add(phoneBody, phoneBox);
  phone.position.set(-23.8, 0, -6.5);
  world.root.add(phone);
  world.anchors.set('payphone', { pos: new THREE.Vector3(-23.6, 1.2, -6.5), mesh: phone });

  // Monte de cámara dañado CAM 09 (misión 2)
  const cam9 = new THREE.Group();
  const camBody = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.22, 0.4), plasticMaterial(0x2a2e2a, 0.6));
  const camLens = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.1, 8), darkMetalMaterial());
  camLens.rotation.x = Math.PI / 2;
  camLens.position.z = 0.24;
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 6), new THREE.MeshStandardMaterial({ emissive: 0xff2222, emissiveIntensity: 1.2, color: 0x220000 }));
  led.position.set(0.1, 0.13, 0.16);
  cam9.add(camBody, camLens, led);
  cam9.position.set(-8, 2.55, 8.5);
  cam9.rotation.y = Math.PI * 0.75;
  world.root.add(cam9);
  world.anchors.set('cam09_mount', { pos: new THREE.Vector3(-8, 2.4, 8.5), mesh: cam9 });

  // Monte CAM 05 (misión 2)
  const cam5 = cam9.clone();
  cam5.position.set(17, 2.55, 4.4);
  cam5.rotation.y = Math.PI * 1.8;
  world.root.add(cam5);
  world.anchors.set('cam05_mount', { pos: new THREE.Vector3(17, 2.4, 4.4), mesh: cam5 });

  // Sillas volcadas en el pasillo (decoración de deterioro)
  for (const [x, z, ry] of [[-4, -6, 1.2], [-1, -5, 2.4], [18, -6, 0.4]] as Array<[number, number, number]>) {
    const ch = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.06, 0.42), woodMaterial([0.4, 0.4]));
    ch.position.set(x, 0.22, z);
    ch.rotation.set(Math.PI / 2.2, ry, 0);
    world.root.add(ch);
    const bk = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.5, 0.05), woodMaterial([0.4, 0.4]));
    bk.position.set(x + 0.2, 0.3, z);
    bk.rotation.set(0.4, ry, Math.PI / 2.1);
    world.root.add(bk);
  }
}

function buildCeilingDecor(world: WorldBuilder) {
  // Carteles colgantes en pasillos
  for (const [x, z, txt] of [[0, -6.2, 0], [-6, 7, 1], [10, 7, 2]] as Array<[number, number, number]>) {
    const hang = new THREE.Group();
    const plate = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 0.4, 0.04),
      new THREE.MeshStandardMaterial({ color: 0x27221c, emissive: 0xd8b13a, emissiveIntensity: 0.18 })
    );
    plate.position.y = -0.5;
    for (const wx of [-0.55, 0.55]) {
      const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.5, 4), darkMetalMaterial());
      wire.position.set(wx, -0.25, 0);
      hang.add(wire);
    }
    hang.add(plate);
    hang.position.set(x, 3.2, z);
    world.root.add(hang);
    const ph = txt * 1.7;
    world.propAnims.push({ update: (_dt, t) => { hang.rotation.y = Math.sin(t * 0.3 + ph) * 0.12; } });
  }
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

export function createPickupMesh(kind: 'fuse' | 'tape' | 'note' | 'battery' | 'cover' | 'key'): THREE.Object3D {
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
  }
}
