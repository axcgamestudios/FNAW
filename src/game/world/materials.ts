/**
 * Materiales PBR compartidos (cacheados).
 * Prioriza las texturas reales del repositorio (Assets) y
 * recurre a las procedurales si no se cargaron.
 */
import * as THREE from 'three';
import {
  floorTile, floorChecker, floorWood, floorConcrete, floorCarpet, floorMetal,
  wallTile, wallWallpaper, wallConcrete, wallMetal, ceilingTex,
  woodDeskTex, metalTex, darkMetalTex, PbrSet,
} from './textures';
import { Assets } from './assets';

const matCache = new Map<string, THREE.MeshStandardMaterial>();

/** textura real clonada con repeat, o null si no hay assets */
function realTex(tex: THREE.Texture | undefined, rep: [number, number]): THREE.Texture | null {
  if (!tex || !Assets.loaded) return null;
  const t = tex.clone();
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rep[0], rep[1]);
  t.needsUpdate = true;
  return t;
}

function texPbr(
  key: string,
  real: THREE.Texture | null,
  procedural: () => PbrSet,
  rep: [number, number],
  opts: { roughness: number; metalness?: number; bumpScale?: number }
): THREE.MeshStandardMaterial {
  const ck = `${key}_${rep[0]}_${rep[1]}`;
  if (matCache.has(ck)) return matCache.get(ck)!;
  if (real) {
    const bump = real.clone();
    bump.wrapS = bump.wrapT = THREE.RepeatWrapping;
    bump.repeat.set(rep[0], rep[1]);
    bump.colorSpace = THREE.NoColorSpace;
    const m = new THREE.MeshStandardMaterial({
      map: real,
      bumpMap: bump,
      bumpScale: opts.bumpScale ?? 0.04,
      roughness: opts.roughness,
      metalness: opts.metalness ?? 0,
    });
    matCache.set(ck, m);
    return m;
  }
  return pbrMaterial(key, procedural(), { repeat: rep });
}

function pbrMaterial(key: string, s: PbrSet, opts: { color?: number; repeat?: [number, number] } = {}): THREE.MeshStandardMaterial {
  const ck = `${key}_${opts.color ?? 'x'}`;
  if (matCache.has(ck)) return matCache.get(ck)!;
  const m = new THREE.MeshStandardMaterial({
    map: s.map.clone(),
    bumpMap: s.bumpMap.clone(),
    bumpScale: s.bumpScale,
    roughness: s.roughness,
    metalness: s.metalness ?? 0,
    color: opts.color ?? 0xffffff,
  });
  if (opts.repeat) {
    m.map!.repeat.set(opts.repeat[0], opts.repeat[1]);
    m.bumpMap!.repeat.set(opts.repeat[0], opts.repeat[1]);
  }
  m.map!.needsUpdate = true;
  m.bumpMap!.needsUpdate = true;
  matCache.set(ck, m);
  return m;
}

export const floorMaterials = {
  tile: (rep: [number, number]) => texPbr('f_stone', realTex(Assets.textures?.floorStone, rep), () => floorTile(), rep, { roughness: 0.55, bumpScale: 0.035 }),
  checker: (rep: [number, number]) => texPbr('f_checker', realTex(Assets.textures?.floorChecker, rep), () => floorChecker(), rep, { roughness: 0.5, bumpScale: 0.03 }),
  wood: (rep: [number, number]) => texPbr('f_wood', realTex(Assets.textures?.floorWood, rep), () => floorWood(), rep, { roughness: 0.7, bumpScale: 0.035 }),
  concrete: (rep: [number, number]) => texPbr('f_conc', realTex(Assets.textures?.floorConcrete, rep), () => floorConcrete(), rep, { roughness: 0.92, bumpScale: 0.05 }),
  carpet: (rep: [number, number]) => texPbr('f_carpet', realTex(Assets.textures?.floorCarpet, rep), () => floorCarpet(), rep, { roughness: 0.95, bumpScale: 0.06 }),
  metal: (rep: [number, number]) => texPbr('f_metal', realTex(Assets.textures?.wallMetal, rep), () => floorMetal(), rep, { roughness: 0.45, metalness: 0.7, bumpScale: 0.04 }),
  /** baldosa encerada de la oficina: refleja la linterna y las luces */
  polished: (rep: [number, number]) => {
    const base = texPbr('f_checker', realTex(Assets.textures?.floorChecker, rep), () => floorChecker(), rep, { roughness: 0.5, bumpScale: 0.03 });
    const ck = `f_polished_${rep[0]}_${rep[1]}`;
    if (matCache.has(ck)) return matCache.get(ck)!;
    const m = base.clone();
    m.roughness = 0.18;
    m.metalness = 0.25;
    m.envMapIntensity = 1.5;
    matCache.set(ck, m);
    return m;
  },
};

export const wallMaterials = {
  tile: (rep: [number, number]) => pbrMaterial('w_tile', wallTile(), { repeat: rep }),
  wallpaper: (rep: [number, number]) => pbrMaterial('w_wp', wallWallpaper(), { repeat: rep }),
  concrete: (rep: [number, number]) => pbrMaterial('w_conc', wallConcrete(), { repeat: rep }),
  metal: (rep: [number, number]) => texPbr('w_metal', realTex(Assets.textures?.wallMetal, rep), () => wallMetal(), rep, { roughness: 0.42, metalness: 0.7, bumpScale: 0.05 }),
};

export const ceilingMaterial = (rep: [number, number]) => pbrMaterial('ceil', ceilingTex(), { repeat: rep });

export const woodMaterial = (rep: [number, number] = [1, 1]) => texPbr('wood', realTex(Assets.textures?.floorWood, rep), () => woodDeskTex(), rep, { roughness: 0.6, bumpScale: 0.03 });

export const metalMaterial = (rep: [number, number] = [1, 1]) => texPbr('metal', realTex(Assets.textures?.wallMetal, rep), () => metalTex(), rep, { roughness: 0.35, metalness: 0.85, bumpScale: 0.03 });

export const darkMetalMaterial = (rep: [number, number] = [1, 1]) => pbrMaterial('dmetal', darkMetalTex(), { repeat: rep });

/** Plástico viejo de animatrónicos (usado también en props) */
export function plasticMaterial(color: number, rough = 0.38, shine = 0): THREE.MeshPhysicalMaterial {
  const ck = `plastic_${color}_${rough}_${shine}`;
  if (matCache.has(ck)) return matCache.get(ck) as unknown as THREE.MeshPhysicalMaterial;
  const m = new THREE.MeshPhysicalMaterial({
    color,
    roughness: rough,
    metalness: 0.02,
    clearcoat: shine > 0 ? shine : 0.45,
    clearcoatRoughness: 0.5,
  });
  matCache.set(ck, m as unknown as THREE.MeshStandardMaterial);
  return m;
}

export function disposeMaterials() {
  for (const m of matCache.values()) m.dispose();
  matCache.clear();
}
