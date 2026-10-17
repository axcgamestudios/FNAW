/**
 * Biblioteca de assets GLTF: carga los modelos del repositorio del usuario,
 * normaliza escala/orientación, mapea huesos por nombre/estructura y
 * expone rigs animables + texturas reales.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';

export interface RigBones {
  pelvis?: THREE.Object3D;
  torso?: THREE.Object3D;
  chest?: THREE.Object3D;
  neck?: THREE.Object3D;
  head?: THREE.Object3D;
  jaw?: THREE.Object3D;
  armL?: THREE.Object3D;
  armR?: THREE.Object3D;
  forearmL?: THREE.Object3D;
  forearmR?: THREE.Object3D;
  legL?: THREE.Object3D;
  legR?: THREE.Object3D;
  shinL?: THREE.Object3D;
  shinR?: THREE.Object3D;
  earL?: THREE.Object3D;
  earR?: THREE.Object3D;
}

export interface GltfRig {
  root: THREE.Group;
  model: THREE.Object3D;
  bones: RigBones;
  mixer: THREE.AnimationMixer | null;
  idleAction: THREE.AnimationAction | null;
  eyes: THREE.Mesh[];
  height: number;
  kind: string;
}

interface ModelConfig {
  file: string;
  height: number;
  rotY: number;
  eyeColor: number;
  eyeNames?: RegExp;
  /** eje largo del modelo (la linterna apunta por Z, no por Y) */
  lengthAxis?: 'x' | 'y' | 'z';
  /** longitud objetivo cuando se normaliza por eje */
  length?: number;
  /** desactivar clips GLB (animación 100% procedural del RigAnimator) */
  noClips?: boolean;
  /** rotación previa a la normalización (modelos OBJ reconvertidos "acostados") */
  preRotX?: number;
  /** marca de material cuyas mallas son los rayos del Sol (Luna/Sol) */
  sunRaysMaterial?: string;
}

const CONFIGS: Record<string, ModelConfig> = {
  // más grandes que el guardia (1.78 m)
  freddy: { file: 'models/freddy.glb', height: 2.62, rotY: 0, eyeColor: 0x4dd2ff, eyeNames: /eye|iris|pupil/i, noClips: true },
  bonnie: { file: 'models/bonnie.glb', height: 2.56, rotY: 0, eyeColor: 0xff5070, eyeNames: /eye/i, noClips: true },
  chica: { file: 'models/chica.glb', height: 2.46, rotY: 0, eyeColor: 0xffe066, eyeNames: /eye/i, noClips: true },
  foxy: { file: 'models/foxy.glb', height: 2.42, rotY: 0, eyeColor: 0xffbf40, eyeNames: /eye/i, noClips: true },
  golden: { file: 'models/freddy.glb', height: 2.62, rotY: 0, eyeColor: 0xffdd44, eyeNames: /eye|iris|pupil/i, noClips: true },
  jeremy: { file: 'models/jeremy.glb', height: 1.78, rotY: 0, eyeColor: 0x000000 },
  // Luna (cara nocturna del Eclipse): GLB estático YA DE PIE (el nodo raíz
  // Sketchfab hornea Rx+90°). La cara apunta a -Z → rotY π para mirar a +Z.
  // MAT_DayMan = los rayos del Sol: visibles solo en modo Sol.
  moon: { file: 'models/moon.glb', height: 2.42, rotY: Math.PI, eyeColor: 0xff3232, noClips: true, sunRaysMaterial: 'MAT_DayMan' },
  // El GLB de la linterna mide 0.136 m por su eje X (la lente está en +X):
  // se normaliza por X y se rota +90° para que la cabeza mire a -Z (al frente).
  flashlight: { file: 'models/flashlight.glb', height: 0.19, rotY: Math.PI / 2, eyeColor: 0x000000, lengthAxis: 'x', length: 0.19 },
};

export interface GameTextures {
  floorChecker: THREE.Texture;
  floorCarpet: THREE.Texture;
  floorConcrete: THREE.Texture;
  floorWood: THREE.Texture;
  floorStone: THREE.Texture;
  wallMetal: THREE.Texture;
  guardSkin: THREE.Texture;
  guardUniform: THREE.Texture;
  // texturas del repo FNAW (v7 — Mega Guardería en llamas)
  texCheckerBurned: THREE.Texture;
  texPartyFabric: THREE.Texture;
  texConcreteCracked: THREE.Texture;
  texWoodOld: THREE.Texture;
  texMetalRusty: THREE.Texture;
  texStoneSlabs: THREE.Texture;
}

export class AssetLibrary {
  rigs = new Map<string, GltfRig>();
  textures!: GameTextures;
  loaded = false;
  private raws = new Map<string, THREE.Object3D>();
  private clips = new Map<string, THREE.AnimationClip[]>();

  async loadAll(onProgress: (frac: number, label: string) => void) {
    const loader = new GLTFLoader();
    const texLoader = new THREE.TextureLoader();
    const texFiles: Array<[keyof GameTextures, string]> = [
      ['floorChecker', 'textures/floor_checker.jpg'],
      ['floorCarpet', 'textures/floor_carpet_party.jpg'],
      ['floorConcrete', 'textures/floor_concrete.jpg'],
      ['floorWood', 'textures/floor_wood.jpg'],
      ['floorStone', 'textures/floor_stone.jpg'],
      ['wallMetal', 'textures/wall_metal.jpg'],
      ['guardSkin', 'textures/guard_skin.png'],
      ['guardUniform', 'textures/guard_uniform.png'],
      ['texCheckerBurned', 'textures/tex_checker_burned.jpg'],
      ['texPartyFabric', 'textures/tex_party_fabric.jpg'],
      ['texConcreteCracked', 'textures/tex_concrete_cracked.jpg'],
      ['texWoodOld', 'textures/tex_wood_old.jpg'],
      ['texMetalRusty', 'textures/tex_metal_rusty.jpg'],
      ['texStoneSlabs', 'textures/tex_stone_slabs.jpg'],
    ];
    const entries = Object.entries(CONFIGS).filter(([k]) => k !== 'golden');
    const total = entries.length + texFiles.length;
    let done = 0;
    const tick = (label: string) => {
      done++;
      onProgress(done / total, label);
    };

    // texturas
    const texResult: Partial<GameTextures> = {};
    for (const [key, url] of texFiles) {
      try {
        const t = await texLoader.loadAsync(url);
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 4;
        texResult[key] = t;
      } catch {
        // fallback: textura procedural oscura
        const c = document.createElement('canvas');
        c.width = c.height = 64;
        const ctx = c.getContext('2d')!;
        ctx.fillStyle = '#555';
        ctx.fillRect(0, 0, 64, 64);
        const t = new THREE.CanvasTexture(c);
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        texResult[key] = t;
      }
      tick(`Cargando texturas (${done})...`);
    }
    this.textures = texResult as GameTextures;

    // modelos
    for (const [kind, cfg] of entries) {
      try {
        const gltf = await loader.loadAsync(cfg.file);
        this.raws.set(kind, gltf.scene);
        this.clips.set(kind, gltf.animations || []);
      } catch (err) {
        console.warn(`No se pudo cargar el modelo ${kind}:`, err);
      }
      tick(`Cargando modelo: ${kind}...`);
    }

    // rigs normales (golden se clona bajo demanda)
    for (const kind of ['freddy', 'bonnie', 'chica', 'foxy', 'jeremy', 'moon', 'flashlight']) {
      if (this.raws.has(kind)) {
        this.rigs.set(kind, this.prepareRig(kind));
      }
    }
    this.loaded = true;
  }

  has(kind: string): boolean {
    return this.rigs.has(kind);
  }

  /** preparar un rig: normaliza tamaño, origen y orientación; mapea huesos */
  private prepareRig(kind: string, sourceOverride?: THREE.Object3D): GltfRig {
    const cfg = CONFIGS[kind] ?? CONFIGS.freddy;
    const src = sourceOverride ?? this.raws.get(kind)!;
    const model = cloneSkeleton(src);
    const root = new THREE.Group();
    root.add(model);

    // materiales: clonar y preparar (sombras + ojos emisivos)
    const eyes: THREE.Mesh[] = [];
    model.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        if (o.geometry && 'skinIndex' in (o.geometry.attributes ?? {})) {
          o.frustumCulled = false;
        }
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        const newMats = mats.map((m) => {
          const cm = (m as THREE.Material).clone() as THREE.MeshStandardMaterial;
          if (cm.map) {
            cm.map = cm.map.clone();
            cm.map.needsUpdate = true;
          }
          cm.metalness = Math.min(cm.metalness ?? 0, 0.55);
          cm.roughness = Math.max(cm.roughness ?? 0.6, 0.45);
          return cm;
        });
        o.material = Array.isArray(o.material) ? newMats : newMats[0];
        if (cfg.eyeNames && cfg.eyeNames.test(o.name)) {
          for (const m of (Array.isArray(o.material) ? o.material : [o.material]) as THREE.MeshStandardMaterial[]) {
            m.emissive = new THREE.Color(cfg.eyeColor);
            m.emissiveIntensity = 1.6;
          }
          eyes.push(o);
        }
      }
    });

    // normalizar: escala y apoyo en el suelo.
    // La linterna se normaliza por su eje largo (Z) para que mida ~27 cm de largo;
    // el resto por altura Y.
    // Modelos "acostados" (OBJ reconvertido, p. ej. moon.glb con la cabeza en +Z):
    // se enderezan con preRotX ANTES de medir la caja.
    // Orden de Euler 'YXZ': primero X (enderezar), luego Y (orientar la cara).
    if (cfg.preRotX) {
      model.rotation.order = 'YXZ';
      model.rotation.x = cfg.preRotX;
    }
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    if (cfg.lengthAxis) {
      const axisLen = cfg.lengthAxis === 'z' ? size.z : cfg.lengthAxis === 'x' ? size.x : size.y;
      const scale = (cfg.length ?? 0.27) / Math.max(0.0001, axisLen);
      model.scale.setScalar(scale);
    } else {
      const scale = cfg.height / Math.max(0.0001, size.y);
      model.scale.setScalar(scale);
    }
    model.updateMatrixWorld(true);
    const box2 = new THREE.Box3().setFromObject(model);
    const center = box2.getCenter(new THREE.Vector3());
    // centrar en XZ y apoyar en el suelo
    model.position.x -= center.x;
    model.position.z -= center.z;
    model.position.y -= box2.min.y;
    model.rotation.y = cfg.rotY;

    // Luna/Sol: memorizar colores base y marcar los rayos del Sol (MAT_DayMan)
    if (cfg.sunRaysMaterial) {
      model.traverse((o) => {
        if (!(o instanceof THREE.Mesh)) return;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        const names = mats.map((mm) => (mm as THREE.MeshStandardMaterial).name || '');
        if (names.some((n) => n === cfg.sunRaysMaterial)) {
          (o.userData as { sunRays?: boolean }).sunRays = true;
          o.visible = false; // nace como LUNA
        }
        for (const mm of mats as THREE.MeshStandardMaterial[]) {
          (o.userData as { moonBase?: { color: number; emissive: number; ei: number } }).moonBase = {
            color: mm.color.getHex(),
            emissive: mm.emissive ? mm.emissive.getHex() : 0,
            ei: mm.emissiveIntensity ?? 0,
          };
        }
      });
    }

    // mixer (solo para el guardia / variantes; los animatrónicos van 100% procedural)
    let mixer: THREE.AnimationMixer | null = null;
    let idleAction: THREE.AnimationAction | null = null;
    const clips = this.clips.get(kind) ?? [];
    if (clips.length && !cfg.noClips) {
      mixer = new THREE.AnimationMixer(model);
      const idle = clips.find((c) => /idle/i.test(c.name)) ?? clips[0];
      if (idle) {
        idleAction = mixer.clipAction(idle);
        idleAction.play();
      }
    }

    const bones = mapBones(model, kind);
    return { root, model, bones, mixer, idleAction, eyes, height: cfg.height, kind };
  }

  /** rig clonado (por ejemplo, Freddy Dorado) con tinte opcional */
  createVariant(kind: string, tint?: number): GltfRig {
    const src = this.raws.get('freddy')!;
    const rig = this.prepareRig('golden', src);
    if (tint !== undefined) {
      rig.model.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          for (const m of mats as THREE.MeshStandardMaterial[]) {
            m.color = new THREE.Color(tint);
            m.emissive = new THREE.Color(tint);
            m.emissiveIntensity = 0.22;
            m.metalness = 0.85;
            m.roughness = 0.38;
          }
        }
      });
    }
    // clonar animaciones también
    const clips = this.clips.get('freddy') ?? [];
    if (clips.length) {
      rig.mixer = new THREE.AnimationMixer(rig.model);
    }
    return rig;
  }

  /** pose estática de ragdoll (prop decorativo de Foxy) */
  createSlumpedFoxy(): THREE.Object3D | null {
    const src = this.raws.get('foxy');
    if (!src) return null;
    const model = cloneSkeleton(src);
    const root = new THREE.Group();
    root.add(model);
    const clips = this.clips.get('foxy') ?? [];
    if (clips.length) {
      const mixer = new THREE.AnimationMixer(model);
      const action = mixer.clipAction(clips[clips.length - 1]);
      action.play();
      action.paused = true;
      action.time = action.getClip().duration * 0.55;
      mixer.update(0.016);
    }
    model.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.castShadow = true;
        if (o.geometry && 'skinIndex' in (o.geometry.attributes ?? {})) o.frustumCulled = false;
      }
    });
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    model.scale.setScalar(1.85 / Math.max(0.001, size.y));
    model.updateMatrixWorld(true);
    const box2 = new THREE.Box3().setFromObject(model);
    model.position.y -= box2.min.y;
    return root;
  }

  update(dt: number) {
    for (const rig of this.rigs.values()) {
      rig.mixer?.update(dt);
    }
  }
}

/* ============ LUNA / SOL (GLB estático del Eclipse) ============ */

const _moonWarm = new THREE.Color(0xffc23a);
const _moonDark = new THREE.Color(0x283468);

/** Cambia la cara del guardián de la guardería entre LUNA (noche) y SOL (día).
 *  - LUNA: cuerpo azulado y apagado, sin rayos.
 *  - SOL: cuerpo dorado cálido con brillo, rayos del Sol visibles. */
export function setMoonMode(rig: GltfRig, mode: 'sun' | 'moon') {
  rig.model.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const ud = o.userData as { sunRays?: boolean; moonBase?: { color: number; emissive: number; ei: number } };
    if (ud.sunRays) o.visible = mode === 'sun';
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats as THREE.MeshStandardMaterial[]) {
      const base = ud.moonBase ?? { color: m.color.getHex(), emissive: m.emissive ? m.emissive.getHex() : 0, ei: m.emissiveIntensity ?? 0 };
      if (mode === 'sun') {
        m.color.setHex(base.color).lerp(_moonWarm, 0.55).multiplyScalar(1.3);
        m.emissive.setHex(0xff9a18);
        m.emissiveIntensity = 0.3;
      } else {
        m.color.setHex(base.color).lerp(_moonDark, 0.2).multiplyScalar(0.85);
        m.emissive.setHex(base.emissive);
        m.emissiveIntensity = base.ei;
      }
    }
  });
}

/* ============ MAPEO DE HUESOS ============ */

function findBone(model: THREE.Object3D, patterns: RegExp[]): THREE.Object3D | undefined {
  const all: THREE.Object3D[] = [];
  model.traverse((o) => all.push(o));
  for (const p of patterns) {
    const hit = all.find((o) => o.name && p.test(o.name));
    if (hit) return hit;
  }
  return undefined;
}

function mapBones(model: THREE.Object3D, kind: string): RigBones {
  if (kind === 'freddy' || kind === 'golden') {
    // Freddy usa nombres genéricos; three.js sanitiza los puntos de los
    // nombres Blender ("Bone.003_14" -> "Bone003_14")
    const byName = (n: string) => {
      let found: THREE.Object3D | undefined;
      model.traverse((o) => {
        if (o.name === n) found = o;
      });
      return found;
    };
    return {
      pelvis: byName('Bone_35'),
      legR: byName('Bone003_14'),
      shinR: byName('Bone005_13'),
      legL: byName('Bone004_17'),
      shinL: byName('Bone006_16'),
      torso: byName('Bone001_34'),
      armR: byName('Bone010_20'),
      forearmR: byName('Bone012_19'),
      armL: byName('Bone011_23'),
      forearmL: byName('Bone013_22'),
      neck: byName('Bone002_33'),
      head: byName('Bone009_32'),
      jaw: byName('Bone017_24'),
      earL: byName('Bone019_30'),
      earR: byName('Bone024_31'),
    };
  }
  const side = (base: string, side: 'L' | 'R') => new RegExp(`bip_${base}_${side}($|_|chica|foxy|\\.)`, 'i');
  return {
    pelvis: findBone(model, [/bip_pelvis/i]),
    torso: findBone(model, [/bip_spine/i]),
    neck: findBone(model, [/bip_neck/i]),
    head: findBone(model, [/bip_head($|_)/i, /bip_head_01[12]/i]),
    jaw: findBone(model, [/bip_jaw($|_)/i, /bip_jaw_01[23]/i]),
    armL: findBone(model, [side('upperArm', 'L'), side('upperarm', 'L')]),
    armR: findBone(model, [side('upperArm', 'R'), side('upperarm', 'R')]),
    forearmL: findBone(model, [side('lowerArm', 'L'), side('lowerarm', 'L')]),
    forearmR: findBone(model, [side('lowerArm', 'R'), side('lowerarm', 'R')]),
    legL: findBone(model, [side('hip', 'L')]),
    legR: findBone(model, [side('hip', 'R')]),
    shinL: findBone(model, [side('knee', 'L')]),
    shinR: findBone(model, [side('knee', 'R')]),
    earL: findBone(model, [/bip_ear_0_L/i, /bip_ear_0_.*_L/i]),
    earR: findBone(model, [/bip_ear_0_R/i, /bip_ear_0_.*_R/i]),
  };
}

/* instancia global */
export const Assets = new AssetLibrary();
