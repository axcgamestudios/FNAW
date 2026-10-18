/**
 * Modelos 3D procedurales articulados de los animatrónicos.
 * Estructura con pivotes (huesos) para animación por código:
 * caminar, correr, girar la cabeza, observar, atacar y retirarse.
 */
import * as THREE from 'three';
import { plasticMaterial } from '../world/materials';

export interface RigBones {
  pelvis: THREE.Object3D;
  torso: THREE.Object3D;
  head: THREE.Object3D;
  jaw: THREE.Object3D;
  armL: THREE.Object3D;
  armR: THREE.Object3D;
  forearmL: THREE.Object3D;
  forearmR: THREE.Object3D;
  legL: THREE.Object3D;
  legR: THREE.Object3D;
  shinL: THREE.Object3D;
  shinR: THREE.Object3D;
  earL?: THREE.Object3D;
  earR?: THREE.Object3D;
  fingersL?: THREE.Object3D;
  fingersR?: THREE.Object3D;
}

export interface CharacterRig {
  root: THREE.Group;
  bones: RigBones;
  eyes: THREE.Mesh[];
  eyeGlow: THREE.Mesh | null;
  height: number;
  kind: string;
}

const endoMat = new THREE.MeshStandardMaterial({ color: 0x33383e, roughness: 0.32, metalness: 0.92 });
const toothMat = new THREE.MeshStandardMaterial({ color: 0xd8d2ba, roughness: 0.35 });
const eyeWhiteMat = new THREE.MeshStandardMaterial({ color: 0xc9c9c2, roughness: 0.25 });

function pivot(parent: THREE.Object3D, x: number, y: number, z: number): THREE.Object3D {
  const p = new THREE.Object3D();
  p.position.set(x, y, z);
  parent.add(p);
  return p;
}

function mesh(
  parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material,
  x = 0, y = 0, z = 0
): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  parent.add(m);
  return m;
}

/** Extremidad: pivote + cápsula colgando del pivote */
function limb(parent: THREE.Object3D, len: number, radius: number, mat: THREE.Material, x = 0, y = 0, z = 0): THREE.Object3D {
  const p = pivot(parent, x, y, z);
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(radius, len - radius * 2, 6, 12), mat);
  m.position.y = -len / 2;
  m.castShadow = true;
  p.add(m);
  return p;
}

/** Articulación esférica visible (rodilla / codo / hombro) */
function joint(parent: THREE.Object3D, r = 0.075, y = 0): THREE.Mesh {
  const j = mesh(parent, new THREE.SphereGeometry(r, 10, 10), endoMat, 0, y, 0);
  return j;
}

/** Ojos con pupila emisiva */
function eyes(head: THREE.Object3D, opts: { eyeColor: number; spread?: number; y?: number; z?: number; size?: number }) {
  const spread = opts.spread ?? 0.11;
  const y = opts.y ?? 0.06;
  const z = opts.z ?? 0.14;
  const size = opts.size ?? 0.055;
  const out: THREE.Mesh[] = [];
  for (const sx of [-1, 1]) {
    const socket = mesh(head, new THREE.SphereGeometry(size * 1.18, 10, 10), eyeWhiteMat, sx * spread, y, z);
    const pupil = mesh(
      socket,
      new THREE.SphereGeometry(size * 0.62, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0x0a0a0a, emissive: opts.eyeColor, emissiveIntensity: 1.6 }),
      0, 0, size * 0.55
    );
    pupil.name = 'pupil';
    out.push(pupil);
  }
  return out;
}

/** Fila de dientes */
function teethRow(parent: THREE.Object3D, y: number, z: number, w: number, count: number, flip = false) {
  const g = new THREE.Group();
  const tw = w / count;
  for (let i = 0; i < count; i++) {
    const t = mesh(g, new THREE.BoxGeometry(tw * 0.75, 0.055, 0.035), toothMat, -w / 2 + tw * (i + 0.5), 0, 0);
    if (flip) t.position.y = -0.01;
  }
  g.position.set(0, y, z);
  parent.add(g);
  return g;
}

function endoSpine(parent: THREE.Object3D, count: number, y0: number, y1: number, r = 0.03) {
  const n = count;
  for (let i = 0; i < n; i++) {
    const y = y0 + ((y1 - y0) * i) / (n - 1);
    mesh(parent, new THREE.SphereGeometry(r, 8, 8), endoMat, 0, y, -0.09);
  }
}

/* halo de ojos emisivo (sin luz real: gratis para el shader) */
function makeEyeGlow(eyeColor: number, x: number, y: number, z: number): THREE.Mesh {
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 10, 8),
    new THREE.MeshBasicMaterial({
      color: eyeColor,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    })
  );
  glow.position.set(x, y, z);
  return glow;
}

/* ================= BRUNO EL OSO ================= */

function buildBruno(eyeColor: number): CharacterRig {
  const bodyMat = plasticMaterial(0x8a5a2c, 0.42, 0.55);
  const muzzleMat = plasticMaterial(0xc9a06a, 0.45, 0.4);
  const hatMat = plasticMaterial(0x1a1a1e, 0.5, 0.3);
  const root = new THREE.Group();
  const pelvis = pivot(root, 0, 0.98, 0);
  // caderas
  joint(pelvis, 0.1);

  const torso = pivot(pelvis, 0, 0, 0);
  // tronco: cápsula + tripa esférica
  const chest = mesh(torso, new THREE.CapsuleGeometry(0.24, 0.28, 8, 14), bodyMat, 0, 0.32, 0);
  chest.scale.set(1, 1, 0.82);
  const belly = mesh(torso, new THREE.SphereGeometry(0.24, 14, 14), bodyMat, 0, 0.16, 0.03);
  belly.scale.set(1.05, 1, 0.85);
  endoSpine(torso, 5, 0.08, 0.55);
  // costuras del traje
  mesh(torso, new THREE.BoxGeometry(0.02, 0.62, 0.02), endoMat, -0.2, 0.3, 0.16);
  mesh(torso, new THREE.BoxGeometry(0.02, 0.62, 0.02), endoMat, 0.2, 0.3, 0.16);
  // pajarita + botones
  const bowMat = plasticMaterial(0x8a2020, 0.5, 0.4);
  mesh(torso, new THREE.BoxGeometry(0.14, 0.07, 0.06), bowMat, -0.08, 0.52, 0.2);
  mesh(torso, new THREE.BoxGeometry(0.14, 0.07, 0.06), bowMat, 0.08, 0.52, 0.2);
  mesh(torso, new THREE.SphereGeometry(0.035, 8, 8), bowMat, 0, 0.52, 0.22);
  for (const by of [0.34, 0.2]) {
    mesh(torso, new THREE.CylinderGeometry(0.03, 0.03, 0.015, 10), plasticMaterial(0x2a2a2e, 0.4, 0.6), 0, by, 0.22);
  }

  // cabeza
  const head = pivot(torso, 0, 0.62, 0);
  const neck = mesh(head, new THREE.CylinderGeometry(0.05, 0.06, 0.12, 8), endoMat, 0, -0.06, 0);
  neck.position.y = -0.05;
  const skull = mesh(head, new THREE.SphereGeometry(0.21, 16, 16), bodyMat, 0, 0.16, 0);
  skull.scale.set(1, 0.95, 0.92);
  // orejas
  const earL = pivot(head, -0.17, 0.3, 0);
  mesh(earL, new THREE.SphereGeometry(0.075, 10, 10), bodyMat, 0, 0, 0);
  mesh(earL, new THREE.SphereGeometry(0.045, 8, 8), muzzleMat, 0, 0, 0.03);
  const earR = pivot(head, 0.17, 0.3, 0);
  mesh(earR, new THREE.SphereGeometry(0.075, 10, 10), bodyMat, 0, 0, 0);
  mesh(earR, new THREE.SphereGeometry(0.045, 8, 8), muzzleMat, 0, 0, 0.03);
  // sombrero de copa
  mesh(head, new THREE.CylinderGeometry(0.13, 0.13, 0.02, 12), hatMat, 0, 0.34, 0);
  mesh(head, new THREE.CylinderGeometry(0.09, 0.1, 0.16, 12), hatMat, 0, 0.42, 0);
  // hocico
  const muzzle = mesh(head, new THREE.SphereGeometry(0.11, 12, 12), muzzleMat, 0, 0.08, 0.15);
  muzzle.scale.set(1.15, 0.8, 1);
  const nose = mesh(head, new THREE.SphereGeometry(0.04, 8, 8), plasticMaterial(0x1a1a1a, 0.3, 0.5), 0, 0.12, 0.245);
  nose.scale.set(1.3, 0.8, 0.8);
  // mandíbula articulada
  const jaw = pivot(head, 0, 0.02, 0.06);
  const jawMesh = mesh(jaw, new THREE.SphereGeometry(0.09, 12, 10), muzzleMat, 0, -0.04, 0.06);
  jawMesh.scale.set(1.1, 0.55, 1);
  teethRow(jaw, 0.01, 0.1, 0.13, 6, true);
  teethRow(head, 0.05, 0.2, 0.13, 6);
  const eyeM = eyes(head, { eyeColor, y: 0.2, z: 0.15, spread: 0.1, size: 0.05 });
  // cejas
  mesh(head, new THREE.BoxGeometry(0.07, 0.02, 0.02), bodyMat, -0.1, 0.27, 0.17);
  mesh(head, new THREE.BoxGeometry(0.07, 0.02, 0.02), bodyMat, 0.1, 0.27, 0.17);

  // brazos
  const armL = limb(torso, 0.34, 0.07, bodyMat, -0.3, 0.5, 0);
  const armR = limb(torso, 0.34, 0.07, bodyMat, 0.3, 0.5, 0);
  joint(armL, 0.085);
  joint(armR, 0.085);
  const forearmL = limb(armL, 0.32, 0.06, bodyMat, 0, -0.34, 0);
  const forearmR = limb(armR, 0.32, 0.06, bodyMat, 0, -0.34, 0);
  joint(forearmL, 0.065);
  joint(forearmR, 0.065);
  // manos de mitón + pulgar
  const handL = pivot(forearmL, 0, -0.36, 0);
  mesh(handL, new THREE.SphereGeometry(0.075, 10, 10), bodyMat, 0, -0.05, 0);
  mesh(handL, new THREE.CapsuleGeometry(0.025, 0.05, 4, 8), bodyMat, -0.06, -0.02, 0.02).rotation.z = 0.7;
  const handR = pivot(forearmR, 0, -0.36, 0);
  mesh(handR, new THREE.SphereGeometry(0.075, 10, 10), bodyMat, 0, -0.05, 0);
  mesh(handR, new THREE.CapsuleGeometry(0.025, 0.05, 4, 8), bodyMat, 0.06, -0.02, 0.02).rotation.z = -0.7;

  // piernas
  const legL = limb(pelvis, 0.46, 0.09, bodyMat, -0.14, 0, 0);
  const legR = limb(pelvis, 0.46, 0.09, bodyMat, 0.14, 0, 0);
  joint(legL, 0.09);
  joint(legR, 0.09);
  const shinL = limb(legL, 0.44, 0.075, bodyMat, 0, -0.46, 0);
  const shinR = limb(legR, 0.44, 0.075, bodyMat, 0, -0.46, 0);
  joint(shinL, 0.075);
  joint(shinR, 0.075);
  // pies
  const footL = pivot(shinL, 0, -0.48, 0);
  mesh(footL, new THREE.BoxGeometry(0.14, 0.09, 0.24), bodyMat, 0, -0.03, 0.05);
  const footR = pivot(shinR, 0, -0.48, 0);
  mesh(footR, new THREE.BoxGeometry(0.14, 0.09, 0.24), bodyMat, 0, -0.03, 0.05);

  const glow = makeEyeGlow(eyeColor, 0, 0.85, 0.25);
  root.add(glow);

  return {
    root,
    bones: { pelvis, torso, head, jaw, armL, armR, forearmL, forearmR, legL, legR, shinL, shinR, earL, earR },
    eyes: eyeM,
    eyeGlow: glow,
    height: 1.85,
    kind: 'bear',
  };
}

/* ================= CLARA LA CONEJA ================= */

function buildClara(eyeColor: number): CharacterRig {
  const bodyMat = plasticMaterial(0xc86a8a, 0.4, 0.5);
  const innerEarMat = plasticMaterial(0xe8c8d0, 0.5, 0.3);
  const root = new THREE.Group();
  const pelvis = pivot(root, 0, 0.96, 0);
  joint(pelvis, 0.09);

  const torso = pivot(pelvis, 0, 0, 0);
  const chest = mesh(torso, new THREE.CapsuleGeometry(0.2, 0.3, 8, 14), bodyMat, 0, 0.34, 0);
  chest.scale.set(1, 1, 0.8);
  const belly = mesh(torso, new THREE.SphereGeometry(0.2, 14, 14), bodyMat, 0, 0.18, 0.02);
  belly.scale.set(1, 1, 0.85);
  endoSpine(torso, 4, 0.08, 0.55);
  // lazo en el cuello
  const bowMat = plasticMaterial(0x3a6aa8, 0.5, 0.4);
  mesh(torso, new THREE.BoxGeometry(0.12, 0.06, 0.05), bowMat, -0.07, 0.55, 0.16);
  mesh(torso, new THREE.BoxGeometry(0.12, 0.06, 0.05), bowMat, 0.07, 0.55, 0.16);

  const head = pivot(torso, 0, 0.64, 0);
  mesh(head, new THREE.CylinderGeometry(0.05, 0.06, 0.1, 8), endoMat, 0, -0.04, 0);
  const skull = mesh(head, new THREE.SphereGeometry(0.18, 16, 16), bodyMat, 0, 0.14, 0);
  skull.scale.set(0.95, 1.05, 0.9);
  // orejas largas de coneja
  const earL = pivot(head, -0.09, 0.28, 0);
  const earMeshL = mesh(earL, new THREE.CapsuleGeometry(0.045, 0.24, 6, 10), bodyMat, 0, 0.15, 0);
  earMeshL.scale.set(1, 1, 0.55);
  mesh(earL, new THREE.CapsuleGeometry(0.028, 0.2, 6, 10), innerEarMat, 0, 0.15, 0.03);
  const earR = pivot(head, 0.09, 0.28, 0);
  const earMeshR = mesh(earR, new THREE.CapsuleGeometry(0.045, 0.24, 6, 10), bodyMat, 0, 0.15, 0);
  earMeshR.scale.set(1, 1, 0.55);
  mesh(earR, new THREE.CapsuleGeometry(0.028, 0.2, 6, 10), innerEarMat, 0, 0.15, 0.03);
  // hocico pequeño
  mesh(head, new THREE.SphereGeometry(0.07, 12, 12), innerEarMat, 0, 0.05, 0.15).scale.set(1.1, 0.75, 1);
  mesh(head, new THREE.SphereGeometry(0.028, 8, 8), plasticMaterial(0x1a1a1a, 0.3, 0.5), 0, 0.08, 0.2);
  // mandíbula + dientes de conejo
  const jaw = pivot(head, 0, 0.0, 0.05);
  mesh(jaw, new THREE.SphereGeometry(0.07, 12, 10), bodyMat, 0, -0.03, 0.06).scale.set(1.05, 0.5, 1);
  // dientes grandes
  mesh(jaw, new THREE.BoxGeometry(0.032, 0.075, 0.025), toothMat, -0.022, 0.02, 0.11);
  mesh(jaw, new THREE.BoxGeometry(0.032, 0.075, 0.025), toothMat, 0.022, 0.02, 0.11);
  teethRow(jaw, 0.0, 0.08, 0.1, 4, true);
  teethRow(head, 0.02, 0.17, 0.1, 4);
  const eyeM = eyes(head, { eyeColor, y: 0.18, z: 0.13, spread: 0.09, size: 0.05 });
  // mechón
  mesh(head, new THREE.ConeGeometry(0.03, 0.08, 6), bodyMat, 0, 0.32, 0).rotation.z = 0.3;

  const armL = limb(torso, 0.32, 0.06, bodyMat, -0.26, 0.52, 0);
  const armR = limb(torso, 0.32, 0.06, bodyMat, 0.26, 0.52, 0);
  joint(armL, 0.075);
  joint(armR, 0.075);
  const forearmL = limb(armL, 0.3, 0.05, bodyMat, 0, -0.32, 0);
  const forearmR = limb(armR, 0.3, 0.05, bodyMat, 0, -0.32, 0);
  joint(forearmL, 0.06);
  joint(forearmR, 0.06);
  const handL = pivot(forearmL, 0, -0.34, 0);
  mesh(handL, new THREE.SphereGeometry(0.065, 10, 10), bodyMat, 0, -0.04, 0);
  mesh(handL, new THREE.CapsuleGeometry(0.02, 0.045, 4, 8), bodyMat, -0.05, -0.015, 0.02).rotation.z = 0.7;
  const handR = pivot(forearmR, 0, -0.34, 0);
  mesh(handR, new THREE.SphereGeometry(0.065, 10, 10), bodyMat, 0, -0.04, 0);
  mesh(handR, new THREE.CapsuleGeometry(0.02, 0.045, 4, 8), bodyMat, 0.05, -0.015, 0.02).rotation.z = -0.7;

  // piernas de coneja (zancudas)
  const legL = limb(pelvis, 0.44, 0.08, bodyMat, -0.13, 0, 0);
  const legR = limb(pelvis, 0.44, 0.08, bodyMat, 0.13, 0, 0);
  joint(legL, 0.08);
  joint(legR, 0.08);
  const shinL = limb(legL, 0.42, 0.06, bodyMat, 0, -0.44, 0);
  const shinR = limb(legR, 0.42, 0.06, bodyMat, 0, -0.44, 0);
  joint(shinL, 0.06);
  joint(shinR, 0.06);
  const footL = pivot(shinL, 0, -0.46, 0);
  mesh(footL, new THREE.BoxGeometry(0.12, 0.08, 0.26), bodyMat, 0, -0.025, 0.06);
  const footR = pivot(shinR, 0, -0.46, 0);
  mesh(footR, new THREE.BoxGeometry(0.12, 0.08, 0.26), bodyMat, 0, -0.025, 0.06);

  const glow = makeEyeGlow(eyeColor, 0, 0.8, 0.2);
  root.add(glow);

  return {
    root,
    bones: { pelvis, torso, head, jaw, armL, armR, forearmL, forearmR, legL, legR, shinL, shinR, earL, earR },
    eyes: eyeM,
    eyeGlow: glow,
    height: 1.8,
    kind: 'rabbit',
  };
}

/* ================= GINA LA GALLINA ================= */

function buildGina(eyeColor: number): CharacterRig {
  const bodyMat = plasticMaterial(0xd8c832, 0.42, 0.5);
  const beakMat = plasticMaterial(0xe89428, 0.45, 0.35);
  const legMat = plasticMaterial(0xe89428, 0.5, 0.3);
  const root = new THREE.Group();
  const pelvis = pivot(root, 0, 0.94, 0);
  joint(pelvis, 0.085);

  const torso = pivot(pelvis, 0, 0, 0);
  const chest = mesh(torso, new THREE.CapsuleGeometry(0.21, 0.26, 8, 14), bodyMat, 0, 0.32, 0);
  chest.scale.set(1, 1, 0.85);
  endoSpine(torso, 4, 0.08, 0.52);
  // babero
  const bibMat = new THREE.MeshStandardMaterial({ color: 0xe8e2d0, roughness: 0.7 });
  const bib = mesh(torso, new THREE.BoxGeometry(0.26, 0.2, 0.03), bibMat, 0, 0.22, 0.18);
  // texto del babero
  const bibCanvas = document.createElement('canvas');
  bibCanvas.width = 128;
  bibCanvas.height = 96;
  const bctx = bibCanvas.getContext('2d')!;
  bctx.fillStyle = '#e8e2d0';
  bctx.fillRect(0, 0, 128, 96);
  bctx.fillStyle = '#202018';
  bctx.font = 'bold 22px monospace';
  bctx.textAlign = 'center';
  bctx.fillText('PIZZA', 64, 40);
  bctx.fillText('TIME!', 64, 68);
  const bibTex = new THREE.CanvasTexture(bibCanvas);
  (bib.material as THREE.MeshStandardMaterial).map = bibTex;
  (bib.material as THREE.MeshStandardMaterial).needsUpdate = true;

  const head = pivot(torso, 0, 0.6, 0);
  mesh(head, new THREE.CylinderGeometry(0.045, 0.055, 0.1, 8), endoMat, 0, -0.04, 0);
  const skull = mesh(head, new THREE.SphereGeometry(0.17, 16, 16), bodyMat, 0, 0.12, 0);
  skull.scale.set(0.95, 1.1, 0.9);
  // penacho
  for (const [dx, dz, ang] of [[-0.03, 0, 0.5], [0, 0.02, 0], [0.03, 0, -0.5]] as Array<[number, number, number]>) {
    mesh(head, new THREE.ConeGeometry(0.02, 0.12, 6), beakMat, dx, 0.3, dz).rotation.z = ang;
  }
  // pico superior
  const beakTop = mesh(head, new THREE.ConeGeometry(0.075, 0.14, 8), beakMat, 0, 0.05, 0.18);
  beakTop.rotation.x = Math.PI / 2.1;
  beakTop.scale.set(1.2, 1, 0.7);
  // mandíbula (pico inferior)
  const jaw = pivot(head, 0, -0.01, 0.08);
  const beakBot = mesh(jaw, new THREE.ConeGeometry(0.06, 0.11, 8), beakMat, 0, 0, 0.08);
  beakBot.rotation.x = Math.PI / 2.3;
  beakBot.scale.set(1.15, 1, 0.6);
  const eyeM = eyes(head, { eyeColor, y: 0.16, z: 0.13, spread: 0.1, size: 0.05 });

  const armL = limb(torso, 0.3, 0.055, bodyMat, -0.25, 0.5, 0);
  const armR = limb(torso, 0.3, 0.055, bodyMat, 0.25, 0.5, 0);
  joint(armL, 0.07);
  joint(armR, 0.07);
  const forearmL = limb(armL, 0.28, 0.048, bodyMat, 0, -0.3, 0);
  const forearmR = limb(armR, 0.28, 0.048, bodyMat, 0, -0.3, 0);
  joint(forearmL, 0.058);
  joint(forearmR, 0.058);
  const handL = pivot(forearmL, 0, -0.32, 0);
  mesh(handL, new THREE.SphereGeometry(0.06, 10, 10), bodyMat, 0, -0.035, 0);
  mesh(handL, new THREE.CapsuleGeometry(0.018, 0.04, 4, 8), bodyMat, -0.045, -0.01, 0.02).rotation.z = 0.7;
  const handR = pivot(forearmR, 0, -0.32, 0);
  mesh(handR, new THREE.SphereGeometry(0.06, 10, 10), bodyMat, 0, -0.035, 0);
  mesh(handR, new THREE.CapsuleGeometry(0.018, 0.04, 4, 8), bodyMat, 0.045, -0.01, 0.02).rotation.z = -0.7;

  // patas finas
  const legL = limb(pelvis, 0.42, 0.045, legMat, -0.12, 0, 0);
  const legR = limb(pelvis, 0.42, 0.045, legMat, 0.12, 0, 0);
  joint(legL, 0.06, 0);
  joint(legR, 0.06, 0);
  const shinL = limb(legL, 0.4, 0.038, legMat, 0, -0.42, 0);
  const shinR = limb(legR, 0.4, 0.038, legMat, 0, -0.42, 0);
  joint(shinL, 0.05);
  joint(shinR, 0.05);
  // pies con garras
  const footL = pivot(shinL, 0, -0.44, 0);
  mesh(footL, new THREE.BoxGeometry(0.11, 0.06, 0.2), legMat, 0, -0.02, 0.04);
  for (const tx of [-0.04, 0, 0.04]) {
    mesh(footL, new THREE.ConeGeometry(0.014, 0.05, 5), beakMat, tx, -0.02, 0.15).rotation.x = Math.PI / 2;
  }
  const footR = pivot(shinR, 0, -0.44, 0);
  mesh(footR, new THREE.BoxGeometry(0.11, 0.06, 0.2), legMat, 0, -0.02, 0.04);
  for (const tx of [-0.04, 0, 0.04]) {
    mesh(footR, new THREE.ConeGeometry(0.014, 0.05, 5), beakMat, tx, -0.02, 0.15).rotation.x = Math.PI / 2;
  }

  const glow = makeEyeGlow(eyeColor, 0, 0.75, 0.2);
  root.add(glow);

  return {
    root,
    bones: { pelvis, torso, head, jaw, armL, armR, forearmL, forearmR, legL, legR, shinL, shinR },
    eyes: eyeM,
    eyeGlow: glow,
    height: 1.78,
    kind: 'chicken',
  };
}

/* ================= REN EL ZORRO (estropeado) ================= */

function buildRen(eyeColor: number): CharacterRig {
  const bodyMat = plasticMaterial(0x9a4020, 0.62, 0.15);
  const tornMat = plasticMaterial(0x5a2818, 0.75, 0.05);
  const muzzleMat = plasticMaterial(0xc98a5a, 0.6, 0.1);
  const root = new THREE.Group();
  const pelvis = pivot(root, 0, 0.92, 0);
  joint(pelvis, 0.09);

  const torso = pivot(pelvis, 0, 0, 0);
  const chest = mesh(torso, new THREE.CapsuleGeometry(0.22, 0.28, 8, 14), bodyMat, 0, 0.3, 0);
  chest.scale.set(1, 1, 0.8);
  endoSpine(torso, 6, 0.06, 0.52, 0.035);
  // agujero en el pecho: endoesqueleto visible
  mesh(torso, new THREE.SphereGeometry(0.1, 12, 12), tornMat, 0.06, 0.28, 0.1);
  for (let i = 0; i < 3; i++) {
    mesh(torso, new THREE.TorusGeometry(0.07, 0.012, 6, 12), endoMat, 0.08, 0.2 + i * 0.09, 0.13).rotation.y = Math.PI / 2;
  }

  const head = pivot(torso, 0, 0.58, 0);
  mesh(head, new THREE.CylinderGeometry(0.05, 0.06, 0.12, 8), endoMat, 0, -0.06, 0);
  // mitad de la cara falta: cráneo endo + piel
  const skull = mesh(head, new THREE.SphereGeometry(0.19, 16, 16), bodyMat, 0, 0.12, 0);
  skull.scale.set(0.95, 0.95, 1);
  // cráneo metálico expuesto (lado derecho)
  const endoSkull = mesh(head, new THREE.SphereGeometry(0.185, 14, 14), endoMat, 0.05, 0.12, 0.02);
  endoSkull.scale.set(0.5, 0.85, 0.9);
  // orejas puntiagudas (una rota)
  const earL = pivot(head, -0.13, 0.26, 0);
  mesh(earL, new THREE.ConeGeometry(0.05, 0.16, 6), bodyMat, 0, 0.07, 0);
  const earR = pivot(head, 0.13, 0.26, 0);
  const er = mesh(earR, new THREE.ConeGeometry(0.045, 0.09, 6), bodyMat, 0, 0.04, 0);
  er.rotation.z = 0.7;
  // parche del ojo (levantado)
  const patch = mesh(head, new THREE.CircleGeometry(0.05, 10), plasticMaterial(0x1a1a1a, 0.6), 0.11, 0.15, 0.16);
  patch.rotation.set(-0.6, 0.4, 1.2);
  // hocico largo de zorro
  const muzzle2 = mesh(head, new THREE.CapsuleGeometry(0.07, 0.14, 8, 12), muzzleMat, 0, 0.03, 0.14);
  muzzle2.rotation.x = Math.PI / 2;
  mesh(head, new THREE.SphereGeometry(0.026, 8, 8), plasticMaterial(0x1a1a1a, 0.4, 0.4), 0, 0.03, 0.26);
  // mandíbula grande con muchos dientes afilados
  const jaw = pivot(head, 0, -0.02, 0.06);
  const jawM = mesh(jaw, new THREE.CapsuleGeometry(0.06, 0.12, 8, 10), tornMat, 0, -0.02, 0.08);
  jawM.rotation.x = Math.PI / 2;
  // dientes cónicos
  for (let i = 0; i < 7; i++) {
    const tx = -0.09 + i * 0.03;
    mesh(jaw, new THREE.ConeGeometry(0.011, 0.035, 5), toothMat, tx, 0.03, 0.13 + Math.abs(3.5 - i) * -0.006);
  }
  for (let i = 0; i < 6; i++) {
    const tx = -0.075 + i * 0.03;
    mesh(head, new THREE.ConeGeometry(0.011, 0.035, 5), toothMat, tx, 0.065, 0.17 + Math.abs(3 - i) * -0.006).rotation.x = Math.PI;
  }
  // un solo ojo brillante (el otro es endo apagado)
  const eyeM = eyes(head, { eyeColor, y: 0.17, z: 0.14, spread: 0.09, size: 0.05 });
  mesh(head, new THREE.SphereGeometry(0.045, 8, 8), endoMat, 0.1, 0.17, 0.12);

  // brazo izquierdo de piel, derecho endoesqueleto expuesto
  const armL = limb(torso, 0.32, 0.065, bodyMat, -0.28, 0.5, 0);
  joint(armL, 0.08);
  const forearmL = limb(armL, 0.3, 0.055, bodyMat, 0, -0.32, 0);
  joint(forearmL, 0.06);
  const handL = pivot(forearmL, 0, -0.34, 0);
  mesh(handL, new THREE.SphereGeometry(0.065, 10, 10), bodyMat, 0, -0.035, 0);
  for (let i = 0; i < 3; i++) {
    mesh(handL, new THREE.ConeGeometry(0.014, 0.06, 5), toothMat, -0.035 + i * 0.035, -0.06, 0.04).rotation.x = 0.5;
  }
  const armR = limb(torso, 0.32, 0.05, endoMat, 0.28, 0.5, 0);
  joint(armR, 0.07);
  const forearmR = limb(armR, 0.3, 0.04, endoMat, 0, -0.32, 0);
  joint(forearmR, 0.055);
  const handR = pivot(forearmR, 0, -0.34, 0);
  mesh(handR, new THREE.SphereGeometry(0.05, 10, 10), endoMat, 0, -0.03, 0);
  for (let i = 0; i < 3; i++) {
    mesh(handR, new THREE.ConeGeometry(0.013, 0.06, 5), endoMat, -0.03 + i * 0.03, -0.06, 0.03).rotation.x = 0.5;
  }

  // pierna izquierda endo, derecha de piel
  const legL = limb(pelvis, 0.42, 0.045, endoMat, -0.13, 0, 0);
  joint(legL, 0.06);
  const shinL = limb(legL, 0.4, 0.038, endoMat, 0, -0.42, 0);
  const footL = pivot(shinL, 0, -0.44, 0);
  mesh(footL, new THREE.BoxGeometry(0.1, 0.05, 0.2), endoMat, 0, -0.015, 0.04);
  const legR = limb(pelvis, 0.42, 0.085, bodyMat, 0.13, 0, 0);
  joint(legR, 0.085);
  const shinR = limb(legR, 0.4, 0.07, bodyMat, 0, -0.42, 0);
  joint(shinR, 0.07);
  const footR = pivot(shinR, 0, -0.44, 0);
  mesh(footR, new THREE.BoxGeometry(0.12, 0.07, 0.22), bodyMat, 0, -0.02, 0.05);

  const glow = makeEyeGlow(eyeColor, 0, 0.75, 0.25);
  root.add(glow);

  return {
    root,
    bones: { pelvis, torso, head, jaw, armL, armR, forearmL, forearmR, legL, legR, shinL, shinR, earL, earR },
    eyes: eyeM,
    eyeGlow: glow,
    height: 1.82,
    kind: 'fox',
  };
}

/* ================= LA MARIONETA ================= */

function buildPuppet(eyeColor: number): CharacterRig {
  const clothMat = new THREE.MeshStandardMaterial({ color: 0x14141a, roughness: 0.88 });
  const root = new THREE.Group();
  // flota: raíz ligeramente elevada
  const pelvis = pivot(root, 0, 1.06, 0);

  const torso = pivot(pelvis, 0, 0, 0);
  // cuerpo delgado cónico (tela)
  const body = mesh(torso, new THREE.CylinderGeometry(0.13, 0.05, 0.62, 12), clothMat, 0, 0.26, 0);
  body.castShadow = true;
  // botones blancos
  for (const by of [0.3, 0.42]) {
    mesh(torso, new THREE.SphereGeometry(0.022, 8, 8), new THREE.MeshStandardMaterial({ color: 0xe8e8e0, roughness: 0.5 }), 0, by, 0.12);
  }
  // no tiene piernas: cono invertido bajo la pelvis
  mesh(torso, new THREE.ConeGeometry(0.09, 0.5, 10), clothMat, 0, -0.22, 0).rotation.x = Math.PI;
  // "piernas" como estelas de tela (para el rig, animables)
  const legL = pivot(torso, -0.05, -0.3, 0);
  mesh(legL, new THREE.CapsuleGeometry(0.028, 0.3, 4, 8), clothMat, 0, -0.15, 0);
  const legR = pivot(torso, 0.05, -0.3, 0);
  mesh(legR, new THREE.CapsuleGeometry(0.028, 0.3, 4, 8), clothMat, 0, -0.15, 0);
  const shinL = pivot(legL, 0, -0.3, 0);
  mesh(shinL, new THREE.CapsuleGeometry(0.02, 0.22, 4, 8), clothMat, 0, -0.11, 0);
  const shinR = pivot(legR, 0, -0.3, 0);
  mesh(shinR, new THREE.CapsuleGeometry(0.02, 0.22, 4, 8), clothMat, 0, -0.11, 0);

  // cabeza: máscara blanca con cara pintada
  const head = pivot(torso, 0, 0.62, 0);
  mesh(head, new THREE.CylinderGeometry(0.035, 0.04, 0.1, 8), endoMat, 0, -0.04, 0);
  const mask = mesh(head, new THREE.SphereGeometry(0.16, 18, 18), new THREE.MeshPhysicalMaterial({ color: 0xe8e6dc, roughness: 0.25, clearcoat: 0.8 }), 0, 0.13, 0);
  mask.scale.set(1, 1.12, 0.88);
  // cara pintada en canvas
  const faceCanvas = document.createElement('canvas');
  faceCanvas.width = 256;
  faceCanvas.height = 256;
  const fctx = faceCanvas.getContext('2d')!;
  fctx.fillStyle = '#e8e6dc';
  fctx.fillRect(0, 0, 256, 256);
  // ojos: huecos negros grandes
  fctx.fillStyle = '#0a0a0a';
  fctx.beginPath();
  fctx.ellipse(88, 105, 26, 34, 0, 0, Math.PI * 2);
  fctx.fill();
  fctx.beginPath();
  fctx.ellipse(168, 105, 26, 34, 0, 0, Math.PI * 2);
  fctx.fill();
  // pupilas blancas
  fctx.fillStyle = '#f5f5f0';
  fctx.beginPath();
  fctx.arc(88, 108, 7, 0, Math.PI * 2);
  fctx.fill();
  fctx.beginPath();
  fctx.arc(168, 108, 7, 0, Math.PI * 2);
  fctx.fill();
  // rayas verticales (lágrimas) bajo los ojos
  fctx.strokeStyle = '#7a1a1a';
  fctx.lineWidth = 7;
  fctx.beginPath();
  fctx.moveTo(88, 140);
  fctx.lineTo(88, 200);
  fctx.stroke();
  fctx.beginPath();
  fctx.moveTo(168, 140);
  fctx.lineTo(168, 200);
  fctx.stroke();
  // mejillas
  fctx.fillStyle = '#b04040';
  fctx.beginPath();
  fctx.ellipse(52, 160, 18, 10, 0, 0, Math.PI * 2);
  fctx.fill();
  fctx.beginPath();
  fctx.ellipse(204, 160, 18, 10, 0, 0, Math.PI * 2);
  fctx.fill();
  // boca: línea roja vertical (sonrisa cosida)
  fctx.strokeStyle = '#9a1a1a';
  fctx.lineWidth = 5;
  fctx.beginPath();
  fctx.moveTo(128, 150);
  fctx.lineTo(128, 210);
  fctx.stroke();
  for (let i = 0; i < 5; i++) {
    const y = 155 + i * 12;
    fctx.beginPath();
    fctx.moveTo(116, y);
    fctx.lineTo(140, y + 6);
    fctx.stroke();
  }
  const faceTex = new THREE.CanvasTexture(faceCanvas);
  // proyectar la cara como plano delante de la máscara
  const facePlane = mesh(head, new THREE.PlaneGeometry(0.22, 0.24), new THREE.MeshStandardMaterial({ map: faceTex, roughness: 0.3, transparent: true }), 0, 0.13, 0.135);
  facePlane.name = 'face';
  const jaw = pivot(head, 0, 0.0, 0.05);

  // ojos emisivos reales (detrás de la máscara, se ven por los huecos)
  const eyeM: THREE.Mesh[] = [];
  for (const sx of [-1, 1]) {
    const e = mesh(head, new THREE.SphereGeometry(0.03, 8, 8), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: eyeColor, emissiveIntensity: 2.2 }), sx * 0.052, 0.15, 0.1);
    eyeM.push(e);
  }

  // brazos larguísimos de 3 segmentos
  const armL = limb(torso, 0.36, 0.03, clothMat, -0.16, 0.5, 0);
  const armR = limb(torso, 0.36, 0.03, clothMat, 0.16, 0.5, 0);
  const forearmL = limb(armL, 0.34, 0.026, clothMat, 0, -0.36, 0);
  const forearmR = limb(armR, 0.34, 0.026, clothMat, 0, -0.36, 0);
  // manos de dedos largos
  const handL = pivot(forearmL, 0, -0.36, 0);
  const fingersL = pivot(handL, 0, -0.08, 0);
  for (let i = 0; i < 4; i++) {
    mesh(fingersL, new THREE.CapsuleGeometry(0.009, 0.11, 4, 6), clothMat, -0.033 + i * 0.022, -0.06, 0);
  }
  const handR = pivot(forearmR, 0, -0.36, 0);
  const fingersR = pivot(handR, 0, -0.08, 0);
  for (let i = 0; i < 4; i++) {
    mesh(fingersR, new THREE.CapsuleGeometry(0.009, 0.11, 4, 6), clothMat, -0.033 + i * 0.022, -0.06, 0);
  }

  const glow = makeEyeGlow(eyeColor, 0, 1.85, 0.2);
  root.add(glow);

  return {
    root,
    bones: { pelvis, torso, head, jaw, armL, armR, forearmL, forearmR, legL, legR, shinL, shinR, fingersL, fingersR },
    eyes: eyeM,
    eyeGlow: glow,
    height: 2.05,
    kind: 'puppet',
  };
}

/* ================= SOL Y LUNA (guardián de la alberca) ================= */

export type SolLunaMode = 'sun' | 'moon';

interface SolLunaUD {
  solluna: true;
  sunHead: THREE.Group;
  moonHead: THREE.Group;
  sunJaw: THREE.Group;
  moonJaw: THREE.Group;
  suitMat: THREE.MeshStandardMaterial;
  trimMat: THREE.MeshStandardMaterial;
  pupils: THREE.Mesh[];
  glowMat: THREE.MeshBasicMaterial;
  stars: THREE.Mesh[];
  rays: THREE.Group;
  sunSuitMap: THREE.Texture;
  moonSuitMap: THREE.Texture;
  sunTrimColor: number;
  moonTrimColor: number;
}

/* ---------- TEXTURAS (canvas, alta resolución) ---------- */

function mkCanvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  return [c, c.getContext('2d')!];
}

/** traje de bufón a rayas. vertical=true → rayas a lo largo (torso);
 *  vertical=false → bandas transversales (mangas/perneras).
 *  star=true añade estrellas claras (modo luna). */
function suitCanvas(a: string, b: string, vertical: boolean, stars: boolean): THREE.CanvasTexture {
  const [c, g] = mkCanvas(256);
  g.fillStyle = a; g.fillRect(0, 0, 256, 256);
  g.fillStyle = b;
  const n = 8;
  for (let i = 0; i < n; i += 2) {
    if (vertical) g.fillRect(i * 32, 0, 32, 256);
    else g.fillRect(0, i * 32, 256, 32);
  }
  // costura central tenue
  g.strokeStyle = 'rgba(0,0,0,0.16)';
  g.lineWidth = 2;
  for (let i = 1; i < n; i++) {
    g.beginPath();
    if (vertical) { g.moveTo(i * 32, 0); g.lineTo(i * 32, 256); }
    else { g.moveTo(0, i * 32); g.lineTo(256, i * 32); }
    g.stroke();
  }
  if (stars) {
    g.fillStyle = 'rgba(225,230,255,0.9)';
    for (const [x, y, r] of [[36, 40, 7], [150, 28, 5], [220, 90, 6], [80, 120, 5], [180, 170, 7], [40, 200, 6], [120, 220, 4]] as Array<[number, number, number]>) {
      drawStar(g, x, y, r);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  return t;
}

function drawStar(g: CanvasRenderingContext2D, x: number, y: number, r: number) {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 ? r * 0.42 : r;
    const px = x + Math.cos(a) * rr;
    const py = y + Math.sin(a) * rr;
    if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
  }
  g.closePath();
  g.fill();
}

/** Cara del SOL (512): ojos grandes amigables, sonrisa enorme, mejillas */
function sunFaceCanvas(): THREE.CanvasTexture {
  const [c, g] = mkCanvas(512);
  // base dorada con degradado suave
  const grad = g.createRadialGradient(256, 210, 40, 256, 256, 260);
  grad.addColorStop(0, '#ffdf6e');
  grad.addColorStop(1, '#f2b93a');
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 512);

  // cejas gruesas arqueadas
  g.strokeStyle = '#5a3410';
  g.lineWidth = 16;
  g.lineCap = 'round';
  for (const sx of [-1, 1]) {
    g.beginPath();
    g.arc(256 + sx * 74, 196, 52, Math.PI * 1.22, Math.PI * 1.78);
    g.stroke();
  }
  // ojos grandes: esclerótica + iris + brillo
  for (const sx of [-1, 1]) {
    const ex = 256 + sx * 74;
    g.fillStyle = '#fdfcf4';
    g.beginPath(); g.ellipse(ex, 232, 40, 46, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#5a3410'; g.lineWidth = 7;
    g.beginPath(); g.ellipse(ex, 232, 40, 46, 0, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#20344a';
    g.beginPath(); g.arc(ex, 236, 21, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#0c1622';
    g.beginPath(); g.arc(ex, 238, 11, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffffff';
    g.beginPath(); g.arc(ex - 8, 228, 7, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(ex + 9, 243, 4, 0, Math.PI * 2); g.fill();
  }
  // nariz pequeña
  g.fillStyle = '#c98a2a';
  g.beginPath(); g.moveTo(240, 288); g.lineTo(272, 288); g.lineTo(256, 308); g.closePath(); g.fill();

  // SONRISA gigante abierta con dientes superiores
  g.fillStyle = '#5a1410';
  g.beginPath(); g.arc(256, 300, 130, 0.22, Math.PI - 0.22); g.closePath(); g.fill();
  // dientes superiores
  g.fillStyle = '#fbf8ec';
  const tw = 116 / 7;
  for (let i = 0; i < 7; i++) {
    const tx = 256 - 58 + tw * (i + 0.5);
    g.fillRect(tx - tw * 0.36, 302, tw * 0.72, 20);
  }
  // lengua
  g.fillStyle = '#a23330';
  g.beginPath(); g.ellipse(256, 388, 54, 30, 0, 0, Math.PI * 2); g.fill();
  // contorno de la sonrisa
  g.strokeStyle = '#5a3410'; g.lineWidth = 9;
  g.beginPath(); g.arc(256, 300, 130, 0.22, Math.PI - 0.22); g.stroke();

  // mejillas rojas con blush
  for (const sx of [-1, 1]) {
    const chx = 256 + sx * 160;
    g.fillStyle = 'rgba(226,74,54,0.65)';
    g.beginPath(); g.ellipse(chx, 300, 38, 24, 0, 0, Math.PI * 2); g.fill();
    // pecas
    g.fillStyle = 'rgba(150,60,30,0.5)';
    for (const [fx, fy] of [[chx - 18, 292], [chx, 286], [chx + 18, 292]] as Array<[number, number]>) {
      g.beginPath(); g.arc(fx, fy, 5, 0, Math.PI * 2); g.fill();
    }
  }
  return new THREE.CanvasTexture(c);
}

/** Cara de la LUNA (512): media luna pálida, ojos entrecerrados,
 *  sonrisa CRECIENTE de agujas — la cara icónica de Security Breach */
function moonFaceCanvas(): THREE.CanvasTexture {
  const [c, g] = mkCanvas(512);
  // base pálida azulada
  g.fillStyle = '#dfe4f5';
  g.fillRect(0, 0, 512, 512);
  // lado sombreado (media luna): sombra que cubre el lado derecho
  g.fillStyle = '#3a4680';
  g.beginPath();
  g.moveTo(512, 0);
  g.lineTo(512, 512);
  g.lineTo(340, 512);
  g.bezierCurveTo(430, 380, 430, 130, 340, 0);
  g.closePath();
  g.fill();
  // transición suave de la media luna
  const sh = g.createLinearGradient(330, 0, 380, 512);
  sh.addColorStop(0, 'rgba(224,229,248,0.95)');
  sh.addColorStop(0.5, 'rgba(120,135,195,0.55)');
  sh.addColorStop(1, 'rgba(224,229,248,0.95)');
  g.fillStyle = sh;
  g.beginPath();
  g.moveTo(512, 0);
  g.lineTo(512, 512);
  g.lineTo(340, 512);
  g.bezierCurveTo(430, 380, 430, 130, 340, 0);
  g.closePath();
  g.fill();

  // cejas caíadas malignas
  g.strokeStyle = '#141a3a';
  g.lineWidth = 18;
  g.lineCap = 'round';
  for (const sx of [-1, 1]) {
    g.beginPath();
    g.moveTo(256 + sx * 30, 168);
    g.quadraticCurveTo(256 + sx * 86, 158, 256 + sx * 122, 196);
    g.stroke();
  }
  // ojos entrecerrados (párpados caídos) con pupila ROJA brillante
  for (const sx of [-1, 1]) {
    const ex = 256 + sx * 74;
    // cuenca oscura
    g.fillStyle = '#0d1230';
    g.beginPath(); g.ellipse(ex, 234, 42, 30, 0, 0, Math.PI * 2); g.fill();
    // ojo pálido bajo el párpado
    g.fillStyle = '#c9d1ee';
    g.beginPath(); g.ellipse(ex, 240, 34, 22, 0, 0, Math.PI * 2); g.fill();
    // pupila roja
    g.fillStyle = '#ff2a2a';
    g.beginPath(); g.arc(ex, 242, 15, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffd0d0';
    g.beginPath(); g.arc(ex - 5, 237, 5, 0, Math.PI * 2); g.fill();
    // párpado superior caído (corte diagonal)
    g.fillStyle = '#0d1230';
    g.beginPath();
    g.moveTo(ex - 46, 224);
    g.quadraticCurveTo(ex, 196, ex + 46, 216);
    g.lineTo(ex + 46, 204);
    g.quadraticCurveTo(ex, 188, ex - 46, 210);
    g.closePath();
    g.fill();
    g.strokeStyle = '#141a3a'; g.lineWidth = 8;
    g.beginPath(); g.moveTo(ex - 46, 226); g.quadraticCurveTo(ex, 200, ex + 46, 220); g.stroke();
  }

  // nariz
  g.fillStyle = '#8a93c8';
  g.beginPath(); g.moveTo(242, 290); g.lineTo(270, 290); g.lineTo(256, 312); g.closePath(); g.fill();

  // SONRISA CRECIENTE ENORME de agujas
  const gx = 256, gy = 320, gr = 118;
  g.fillStyle = '#1a1030';
  g.beginPath(); g.arc(gx, gy, gr, 0.30, Math.PI - 0.30); g.closePath(); g.fill();
  // borde pálido de los labios
  g.strokeStyle = '#e8ecff';
  g.lineWidth = 10;
  g.beginPath(); g.arc(gx, gy, gr, 0.30, Math.PI - 0.30); g.stroke();
  // AGUJAS: dientes finísimos arriba y abajo
  g.strokeStyle = '#f2f4ff';
  g.lineWidth = 5;
  const nT = 13;
  for (let i = 0; i <= nT; i++) {
    const a = 0.34 + (Math.PI - 0.68) * (i / nT);
    const x1 = gx + Math.cos(a) * (gr - 6);
    const y1 = gy + Math.sin(a) * (gr - 6);
    const x2 = gx + Math.cos(a) * (gr - 40);
    const y2 = gy + Math.sin(a) * (gr - 40);
    g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
  }
  // agujas de la mandíbula inferior
  g.lineWidth = 5;
  for (let i = 1; i < nT; i++) {
    const a = 0.34 + (Math.PI - 0.68) * (i / nT);
    const x1 = gx + Math.cos(a) * (gr - 74);
    const y1 = gy + Math.sin(a) * (gr - 74) + 34;
    const x2 = gx + Math.cos(a) * (gr - 44);
    const y2 = gy + Math.sin(a) * (gr - 44) + 20;
    g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
  }

  const t = new THREE.CanvasTexture(c);
  return t;
}

/* ---------- construcción del cuerpo ---------- */

function buildSolLuna(eyeColor: number): CharacterRig {
  // trajes: materiales con textura de rayas (se intercambian día/noche)
  const sunSuitMap = suitCanvas('#f2c437', '#d84430', true, false);
  const moonSuitMap = suitCanvas('#283468', '#8a93d8', true, true);
  const sunSleeveMap = suitCanvas('#f2c437', '#d84430', false, false);
  const moonSleeveMap = suitCanvas('#283468', '#8a93d8', false, true);
  const suitMat = new THREE.MeshStandardMaterial({ map: moonSuitMap, roughness: 0.58 });
  const sleeveMat = new THREE.MeshStandardMaterial({ map: moonSleeveMap, roughness: 0.58 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x8a93d8, roughness: 0.45 });
  const bellMat = new THREE.MeshStandardMaterial({ color: 0xd8b83a, roughness: 0.22, metalness: 0.85 });

  const root = new THREE.Group();
  const pelvis = pivot(root, 0, 1.02, 0);
  joint(pelvis, 0.1);

  const torso = pivot(pelvis, 0, 0, 0);
  /* cuerpo de bufón acolchado: pecho esférico + barriga + cintura */
  const chest = mesh(torso, new THREE.SphereGeometry(0.30, 20, 16), suitMat, 0, 0.38, 0);
  chest.scale.set(1.02, 0.94, 0.82);
  const belly = mesh(torso, new THREE.SphereGeometry(0.27, 18, 14), suitMat, 0, 0.14, 0);
  belly.scale.set(1.02, 1, 0.86);
  // cintura acolchada
  const waist = mesh(torso, new THREE.CylinderGeometry(0.20, 0.24, 0.16, 14), trimMat, 0, -0.02, 0);
  waist.scale.z = 0.85;
  // botones-cascabel dorados en el pecho
  for (const [bx, by] of [[-0.09, 0.44], [0.09, 0.44], [0, 0.32]] as Array<[number, number]>) {
    mesh(torso, new THREE.SphereGeometry(0.035, 12, 12), bellMat, bx, by, 0.235);
  }
  // cuello volante de picos con cascabeles
  const collar = new THREE.Group();
  collar.position.y = 0.62;
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2;
    const petal = mesh(collar, new THREE.ConeGeometry(0.052, 0.17, 6), trimMat, Math.cos(a) * 0.20, 0.0, Math.sin(a) * 0.20);
    petal.rotation.set(Math.sin(a) * 0.85, 0, -Math.cos(a) * 0.85);
    mesh(collar, new THREE.SphereGeometry(0.026, 10, 10), bellMat, Math.cos(a) * 0.26, 0.07, Math.sin(a) * 0.26);
  }
  torso.add(collar);
  // estrellas físicas del traje lunar (visibles solo de noche)
  const stars: THREE.Mesh[] = [];
  const starMat = new THREE.MeshBasicMaterial({ color: 0xd8dcff, toneMapped: false });
  const starSpots: Array<[number, number, number]> = [
    [-0.17, 0.44, 0.22], [0.15, 0.30, 0.23], [0.11, 0.48, 0.21], [-0.10, 0.17, 0.24], [0.21, 0.38, 0.16],
  ];
  for (const [sx, sy, sz] of starSpots) {
    const st = mesh(torso, new THREE.SphereGeometry(0.02, 6, 6), starMat, sx, sy, sz);
    stars.push(st);
  }

  /* ---- CABEZA compartida ---- */
  const head = pivot(torso, 0, 0.78, 0);
  mesh(head, new THREE.CylinderGeometry(0.05, 0.06, 0.16, 8), endoMat, 0, -0.06, 0);

  // grupo SOL: cráneo dorado texturizado + PICOS radiales + casquete
  const sunHead = new THREE.Group();
  const sunSkull = mesh(sunHead, new THREE.SphereGeometry(0.24, 28, 22), new THREE.MeshStandardMaterial({
    map: sunFaceCanvas(), roughness: 0.34,
    emissive: 0x9a7018, emissiveIntensity: 0.22, emissiveMap: sunFaceSafe(),
  }), 0, 0.20, 0);
  sunSkull.scale.set(1, 0.96, 0.94);
  // 16 picos alternos alrededor de toda la cabeza
  const rays = new THREE.Group();
  const rayMat = new THREE.MeshStandardMaterial({ color: 0xf6cd42, roughness: 0.4 });
  const rayTipMat = new THREE.MeshStandardMaterial({ color: 0xd84430, roughness: 0.4 });
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const long = i % 2 === 0;
    const spike = mesh(
      rays,
      new THREE.ConeGeometry(0.042, long ? 0.30 : 0.20, 5),
      long ? rayMat : rayTipMat,
      Math.cos(a) * 0.265, 0.20, Math.sin(a) * 0.265
    );
    spike.rotation.set(Math.sin(a) * 1.05, 0, -Math.cos(a) * 1.05);
    if (long) {
      mesh(rays, new THREE.SphereGeometry(0.02, 8, 8), bellMat, Math.cos(a) * 0.34, 0.20, Math.sin(a) * 0.34);
    }
  }
  sunHead.add(rays);
  head.add(sunHead);

  // grupo LUNA: cráneo pálido texturizado + gorro de dormir con cascabel
  const moonHead = new THREE.Group();
  const moonSkull = mesh(moonHead, new THREE.SphereGeometry(0.24, 28, 22), new THREE.MeshStandardMaterial({
    map: moonFaceCanvas(), roughness: 0.42,
    emissive: 0x8090c8, emissiveIntensity: 0.30, emissiveMap: moonFaceSafe(),
  }), 0, 0.20, 0);
  moonSkull.scale.set(1, 0.96, 0.94);
  const capMat = new THREE.MeshStandardMaterial({ map: moonSleeveMap, roughness: 0.7 });
  const cap = mesh(moonHead, new THREE.ConeGeometry(0.17, 0.40, 12), capMat, 0.06, 0.48, -0.05);
  cap.rotation.z = -0.5;
  const capBend = mesh(moonHead, new THREE.ConeGeometry(0.10, 0.22, 10), capMat, 0.22, 0.52, -0.08);
  capBend.rotation.z = -1.35;
  mesh(moonHead, new THREE.SphereGeometry(0.055, 12, 12), bellMat, 0.30, 0.56, -0.08);
  // cuernitos de luna creciente
  const hornMat = new THREE.MeshStandardMaterial({ color: 0xd8dcf0, roughness: 0.35 });
  for (const sx of [-1, 1]) {
    const horn = mesh(moonHead, new THREE.ConeGeometry(0.055, 0.16, 8), hornMat, sx * 0.21, 0.33, -0.03);
    horn.rotation.z = sx * -0.85;
  }
  head.add(moonHead);

  /* ---- mandíbulas (una por modo) ---- */
  const jaw = pivot(head, 0, 0.05, 0.09);
  const sunJaw = new THREE.Group();
  const sj = mesh(sunJaw, new THREE.SphereGeometry(0.11, 14, 10), new THREE.MeshStandardMaterial({ color: 0x8a2418, roughness: 0.45 }), 0, -0.02, 0.04);
  sj.scale.set(1.15, 0.52, 1);
  teethRow(sunJaw, 0, 0.06, 0.12, 7, true);
  jaw.add(sunJaw);
  const moonJaw = new THREE.Group();
  const mj = mesh(moonJaw, new THREE.SphereGeometry(0.11, 14, 10), new THREE.MeshStandardMaterial({ color: 0x141a3a, roughness: 0.5 }), 0, -0.02, 0.04);
  mj.scale.set(1.2, 0.52, 1);
  teethRow(moonJaw, 0, 0.06, 0.13, 9, true);
  jaw.add(moonJaw);

  // ojos 3D emisivos alineados con los del canvas (brillan en la oscuridad)
  const eyeM: THREE.Mesh[] = [];
  for (const sx of [-1, 1]) {
    const pupil = mesh(
      head,
      new THREE.SphereGeometry(0.042, 10, 10),
      new THREE.MeshStandardMaterial({ color: 0x1a1a1a, emissive: 0xff3030, emissiveIntensity: 2.6 }),
      sx * 0.088, 0.245, 0.185
    );
    pupil.name = 'pupil';
    eyeM.push(pupil);
  }

  /* ---- brazos largos de bufón con mangas a rayas ---- */
  const armL = limb(torso, 0.42, 0.064, sleeveMat, -0.32, 0.52, 0);
  const armR = limb(torso, 0.42, 0.064, sleeveMat, 0.32, 0.52, 0);
  joint(armL, 0.08); joint(armR, 0.08);
  const forearmL = limb(armL, 0.38, 0.052, sleeveMat, 0, -0.42, 0);
  const forearmR = limb(armR, 0.38, 0.052, sleeveMat, 0, -0.42, 0);
  joint(forearmL, 0.06); joint(forearmR, 0.06);
  // hombreras acolchadas + puños con cascabel
  for (const [arm, sx] of [[armL, -1], [armR, 1]] as Array<[THREE.Object3D, number]>) {
    mesh(arm, new THREE.SphereGeometry(0.085, 12, 12), trimMat, 0, 0.01, 0);
  }
  for (const [f] of [[forearmL], [forearmR]] as Array<[THREE.Object3D]>) {
    mesh(f, new THREE.TorusGeometry(0.072, 0.02, 10, 16), trimMat, 0, -0.30, 0).rotation.x = Math.PI / 2;
    mesh(f, new THREE.SphereGeometry(0.03, 10, 10), bellMat, 0, -0.34, 0.05);
    const hand = pivot(f, 0, -0.40, 0);
    mesh(hand, new THREE.SphereGeometry(0.09, 12, 12), suitMat, 0, -0.05, 0);
    // dedos largos de mimo
    for (let i = 0; i < 3; i++) {
      const fin = mesh(hand, new THREE.CapsuleGeometry(0.016, 0.09, 4, 8), suitMat, (i - 1) * 0.045, -0.12, 0.05);
      fin.rotation.x = 0.5;
    }
  }

  /* ---- piernas bombacho con rayas y zapatitos rizados ---- */
  const legL = limb(pelvis, 0.5, 0.09, sleeveMat, -0.15, 0, 0);
  const legR = limb(pelvis, 0.5, 0.09, sleeveMat, 0.15, 0, 0);
  joint(legL, 0.09); joint(legR, 0.09);
  const shinL = limb(legL, 0.47, 0.07, sleeveMat, 0, -0.5, 0);
  const shinR = limb(legR, 0.47, 0.07, sleeveMat, 0, -0.5, 0);
  joint(shinL, 0.07); joint(shinR, 0.07);
  for (const [sh, sx] of [[shinL, -1], [shinR, 1]] as Array<[THREE.Object3D, number]>) {
    // calcetín acolchado del tobillo
    mesh(sh, new THREE.SphereGeometry(0.085, 12, 12), trimMat, 0, -0.40, 0);
    const foot = pivot(sh, 0, -0.48, 0);
    mesh(foot, new THREE.SphereGeometry(0.09, 14, 12), suitMat, 0, -0.02, 0.04).scale.set(1.1, 0.75, 1.35);
    // punta rizada hacia arriba con cascabel
    const toe = mesh(foot, new THREE.SphereGeometry(0.055, 10, 10), trimMat, 0, 0.015, 0.20);
    toe.scale.set(0.9, 0.65, 1.5);
    mesh(foot, new THREE.SphereGeometry(0.028, 10, 10), bellMat, 0, 0.05, 0.30);
  }

  const glowMat = new THREE.MeshBasicMaterial({
    color: eyeColor, transparent: true, opacity: 0.85,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  });
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), glowMat);
  glow.position.set(0, 2.08, 0.24);
  root.add(glow);

  const ud: SolLunaUD = {
    solluna: true, sunHead, moonHead, sunJaw, moonJaw, suitMat, trimMat,
    pupils: eyeM, glowMat, stars, rays,
    sunSuitMap, moonSuitMap,
    sunTrimColor: 0xd84430, moonTrimColor: 0x8a93d8,
  };
  (root as unknown as { userData: SolLunaUD }).userData = ud;

  const rig: CharacterRig = {
    root,
    bones: { pelvis, torso, head, jaw, armL, armR, forearmL, forearmR, legL, legR, shinL, shinR },
    eyes: eyeM,
    eyeGlow: glow,
    height: 2.42,
    kind: 'solluna',
  };
  setSolLunaMode(rig, 'moon');
  return rig;
}

/** versión "solo zonas claras" de la cara del sol para emissiveMap
 *  (la cara brilla suavemente en penumbra) */
function sunFaceSafe(): THREE.Texture {
  const t = sunFaceCanvas();
  return emissiveFrom(t, ['#ffdf6e', '#f2b93a', '#fbf8ec', '#fdfcf4', '#e24a36']);
}
function moonFaceSafe(): THREE.Texture {
  const t = moonFaceCanvas();
  return emissiveFrom(t, ['#dfe4f5', '#c9d1ee', '#e8ecff', '#f2f4ff', '#c9d1ee']);
}
/** convierte un canvas: zonas con esos colores → blanco, resto → negro */
function emissiveFrom(tex: THREE.Texture, whites: string[]): THREE.Texture {
  const src = tex.image as HTMLCanvasElement;
  const [c, g] = mkCanvas(src.width);
  g.drawImage(src, 0, 0);
  const img = g.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  // blanco exacto r,g,b
  const target: Array<[number, number, number]> = whites.map((w) => {
    const n = parseInt(w.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  });
  for (let i = 0; i < d.length; i += 4) {
    let keep = false;
    for (const [r, gg, b] of target) {
      if (Math.abs(d[i] - r) < 18 && Math.abs(d[i + 1] - gg) < 18 && Math.abs(d[i + 2] - b) < 18) {
        keep = true; break;
      }
    }
    const v = keep ? 255 : 0;
    d[i] = v; d[i + 1] = v; d[i + 2] = v; d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return new THREE.CanvasTexture(c);
}

/** Transformación día/noche del guardián de la alberca.
 *  moon = cazador en la oscuridad · sun = modo amable con las luces encendidas */
export function setSolLunaMode(rig: CharacterRig, mode: SolLunaMode) {
  const ud = (rig.root as unknown as { userData: SolLunaUD }).userData;
  if (!ud || !ud.solluna) return;
  const sun = mode === 'sun';
  ud.sunHead.visible = sun;
  ud.moonHead.visible = !sun;
  ud.sunJaw.visible = sun;
  ud.moonJaw.visible = !sun;
  ud.stars.forEach((s) => { s.visible = !sun; });
  ud.rays.visible = sun;
  // traje a rayas: sol rojo/amarillo — luna índigo/lavanda
  ud.suitMat.map = sun ? ud.sunSuitMap : ud.moonSuitMap;
  ud.suitMat.needsUpdate = true;
  ud.trimMat.color.setHex(sun ? ud.sunTrimColor : ud.moonTrimColor);
  // ojos: cálidos de día — rojos de noche
  for (const p of ud.pupils) {
    const m = p.material as THREE.MeshStandardMaterial;
    m.emissive.setHex(sun ? 0x3a2a08 : 0xff3030);
    m.emissiveIntensity = sun ? 0.9 : 2.6;
  }
  ud.glowMat.color.setHex(sun ? 0xffe9a8 : 0xff4040);
}


/* ================= FÁBRICA ================= */

export function buildAnimatronic(kind: string, eyeColor: number): CharacterRig {
  switch (kind) {
    case 'bear': return buildBruno(eyeColor);
    case 'rabbit': return buildClara(eyeColor);
    case 'chicken': return buildGina(eyeColor);
    case 'fox': return buildRen(eyeColor);
    case 'puppet': return buildPuppet(eyeColor);
    case 'solluna': return buildSolLuna(eyeColor);
    default: return buildBruno(eyeColor);
  }
}
