#!/usr/bin/env python3
"""v12 — props.ts splice: daycare OUT, huge burning basement IN."""
import re

P = '/home/z/my-project/src/game/world/props.ts'
src = open(P, encoding='utf-8').read()
orig = src

# ============================================================
# 1) buildOffice: remove desk_torch prop (flashlight starts in hand)
# ============================================================
start = src.index("  // LINTERNA del guardia sobre el escritorio")
end = src.index("  // cupcake de Chica sobre el escritorio")
src = src[:start] + """  // v12 — ya NO hay linterna sobre el escritorio: el guardia EMPIEZA con ella en la mano

""" + src[end:]

# ============================================================
# 2) buildProps call list
# ============================================================
src = src.replace("  buildDaycare(world);\n  buildMegaDaycare(world);",
                  "  buildWestStorage(world);\n  buildBasement(world);")

# ============================================================
# 3) Replace old daycare section header + BALL_PIT + DAYCARE_GEN_SPOTS + buildDaycare
#    with WEST STORAGE annex
# ============================================================
d_start = src.index("/* ============ GUARDERÍA (SUPER GUARDERÍA BRUNO — arranque en la alberca) ============ */")
d_end = src.index("/* ============ PLAZA DE COMIDA ============ */")

WEST_STORAGE = r"""/* ============ ALMACÉN OESTE (v12 — la antigua guardería ahora es un archivo de storage) ============ */

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

"""
src = src[:d_start] + WEST_STORAGE + src[d_end:]

# ============================================================
# 4) Replace MEGA section (import + MEGA_PIT + charMat + buildMegaDaycare)
#    with THE BURNING BASEMENT
# ============================================================
m_start = src.index("/* ============ MEGA GUARDERÍA EN LLAMAS (v7 — capítulo 4) ============ */")

BASEMENT = r"""/* ============ EL SÓTANO EN LLAMAS (v12 — capítulo 7, GRAN FINAL) ============ */
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
"""
src = src[:m_start] + BASEMENT

# ============================================================
# Sanity checks + write
# ============================================================
assert 'buildMegaDaycare' not in src, 'old mega daycare still referenced'
assert 'buildDaycare' not in src, 'old daycare still referenced'
assert 'DAYCARE_GEN_SPOTS' not in src, 'gen spots still referenced'
assert 'desk_torch' not in src, 'desk torch still referenced'
assert src.count('buildBasement') == 2, f"buildBasement count {src.count('buildBasement')}"
assert src.count('buildWestStorage') == 2, f"buildWestStorage count {src.count('buildWestStorage')}"
assert 'BALL_PIT' in src and 'MEGA_PIT' in src

open(P, 'w', encoding='utf-8').write(src)
print(f'props.ts patched: {len(orig)} -> {len(src)} bytes')
