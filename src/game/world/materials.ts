/**
 * Materiales PBR compartidos (cacheados).
 */
import * as THREE from 'three';
import {
  floorTile, floorChecker, floorWood, floorConcrete, floorCarpet, floorMetal,
  wallTile, wallWallpaper, wallConcrete, wallMetal, ceilingTex,
  woodDeskTex, metalTex, darkMetalTex, PbrSet,
} from './textures';

const matCache = new Map<string, THREE.MeshStandardMaterial>();

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
  tile: (rep: [number, number]) => pbrMaterial('f_tile', floorTile(), { repeat: rep }),
  checker: (rep: [number, number]) => pbrMaterial('f_checker', floorChecker(), { repeat: rep }),
  wood: (rep: [number, number]) => pbrMaterial('f_wood', floorWood(), { repeat: rep }),
  concrete: (rep: [number, number]) => pbrMaterial('f_conc', floorConcrete(), { repeat: rep }),
  carpet: (rep: [number, number]) => pbrMaterial('f_carpet', floorCarpet(), { repeat: rep }),
  metal: (rep: [number, number]) => pbrMaterial('f_metal', floorMetal(), { repeat: rep }),
};

export const wallMaterials = {
  tile: (rep: [number, number]) => pbrMaterial('w_tile', wallTile(), { repeat: rep }),
  wallpaper: (rep: [number, number]) => pbrMaterial('w_wp', wallWallpaper(), { repeat: rep }),
  concrete: (rep: [number, number]) => pbrMaterial('w_conc', wallConcrete(), { repeat: rep }),
  metal: (rep: [number, number]) => pbrMaterial('w_metal', wallMetal(), { repeat: rep }),
};

export const ceilingMaterial = (rep: [number, number]) => pbrMaterial('ceil', ceilingTex(), { repeat: rep });

export const woodMaterial = (rep: [number, number] = [1, 1]) => pbrMaterial('wood', woodDeskTex(), { repeat: rep });

export const metalMaterial = (rep: [number, number] = [1, 1]) => pbrMaterial('metal', metalTex(), { repeat: rep });

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
