/**
 * RigAnimator: animación procedural de esqueletos GLTF/procedurales en
 * ESPACIO DE PERSONAJE (independiente de la convención de ejes de cada hueso).
 *
 * Cada hueso se anima aplicando un offset de rotación medido en el espacio del
 * modelo (raíz con yaw=0): piernas/brazos por DIRECCIÓN objetivo (fromTo) y
 * torso/cabeza/mandíbula por ángulos de Euler. La aplicación final conjuga el
 * cuaternión del padre actual, por lo que funciona con cualquier rig:
 *   local = P⁻¹ · C · Qoff · C⁻¹ · P · Qrest
 * donde C = rotación de la raíz (yaw), P = cuaternión mundial del padre.
 */
import * as THREE from 'three';
import type { RigBones } from '../world/assets';

export type AnimState =
  | 'dormant' | 'patrol' | 'investigate' | 'chase' | 'search'
  | 'checkMask' | 'stunned' | 'attack' | 'retreat' | 'hunt' | 'dying';

export interface AnimCtx {
  dt: number;
  time: number;
  speed: number;
  walkRef: number;
  state: AnimState;
  stateTime: number;
  yaw: number;
  crawling: boolean;
  lookYaw: number;   // offset de yaw deseado de la cabeza (hacia el jugador)
  lookPitch: number;
}

interface DirBone {
  bone: THREE.Object3D;
  restQuat: THREE.Quaternion;
  restDir: THREE.Vector3;   // dirección en espacio de personaje
  target: THREE.Vector3;    // objetivo actual (amortiguado)
  smooth: THREE.Vector3;    // dirección actual suavizada
}

interface RotBone {
  bone: THREE.Object3D;
  restQuat: THREE.Quaternion;
  offset: THREE.Quaternion;   // offset actual
  goal: THREE.Quaternion;     // objetivo actual
}

const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _q3 = new THREE.Quaternion();
const _q4 = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _charQ = new THREE.Quaternion();
const _pQ = new THREE.Quaternion();
const _e = new THREE.Euler();

function damp(current: number, goal: number, lambda: number, dt: number): number {
  return current + (goal - current) * (1 - Math.exp(-lambda * dt));
}

export class RigAnimator {
  root: THREE.Object3D;
  model: THREE.Object3D | null;
  bones: RigBones;

  private dirBones = new Map<string, DirBone>();
  private rotBones = new Map<string, RotBone>();
  private order: string[] = [];
  private walkPhase = 0;
  private breathPhase = Math.random() * 10;
  private restModelY = 0;
  private stepPulse = 0;

  constructor(root: THREE.Object3D, model: THREE.Object3D | null, bones: RigBones) {
    this.root = root;
    this.model = model;
    this.bones = bones;
    this.bind();
  }

  /* ============ CAPTURA DE LA POSE DE REPOSO ============ */
  private bind() {
    this.root.updateMatrixWorld(true);
    this.restModelY = this.model ? this.model.position.y : 0;

    const dirPair: Array<[string, THREE.Object3D | undefined, THREE.Object3D | undefined]> = [
      ['armL', this.bones.armL, this.bones.forearmL],
      ['armR', this.bones.armR, this.bones.forearmR],
      ['forearmL', this.bones.forearmL, this.firstChild(this.bones.forearmL)],
      ['forearmR', this.bones.forearmR, this.firstChild(this.bones.forearmR)],
      ['legL', this.bones.legL, this.bones.shinL],
      ['legR', this.bones.legR, this.bones.shinR],
      ['shinL', this.bones.shinL, this.firstChild(this.bones.shinL)],
      ['shinR', this.bones.shinR, this.firstChild(this.bones.shinR)],
    ];
    for (const [key, bone, child] of dirPair) {
      if (!bone || !child) continue;
      const from = bone.getWorldPosition(new THREE.Vector3());
      const to = child.getWorldPosition(new THREE.Vector3());
      const dir = to.sub(from).normalize();
      if (dir.lengthSq() < 0.5) continue; // hueso degenerado
      this.dirBones.set(key, {
        bone,
        restQuat: bone.quaternion.clone(),
        restDir: dir.clone(),
        target: dir.clone(),
        smooth: dir.clone(),
      });
      this.order.push(key);
    }

    const rotKeys: Array<[string, THREE.Object3D | undefined]> = [
      ['pelvis', this.bones.pelvis],
      ['torso', this.bones.torso],
      ['neck', this.bones.neck],
      ['head', this.bones.head],
      ['jaw', this.bones.jaw],
      ['earL', this.bones.earL],
      ['earR', this.bones.earR],
    ];
    for (const [key, bone] of rotKeys) {
      if (!bone) continue;
      this.rotBones.set(key, {
        bone,
        restQuat: bone.quaternion.clone(),
        offset: new THREE.Quaternion(),
        goal: new THREE.Quaternion(),
      });
      this.order.push(key);
    }
  }

  private firstChild(bone: THREE.Object3D | undefined): THREE.Object3D | undefined {
    if (!bone) return undefined;
    return bone.children.find((c) => c.type === 'Object3D' || c.type === 'Bone') ?? bone.children[0];
  }

  reset() {
    for (const d of this.dirBones.values()) {
      d.bone.quaternion.copy(d.restQuat);
      d.smooth.copy(d.restDir);
      d.target.copy(d.restDir);
    }
    for (const r of this.rotBones.values()) {
      r.bone.quaternion.copy(r.restQuat);
      r.offset.identity();
      r.goal.identity();
    }
    if (this.model) this.model.position.y = this.restModelY;
    this.walkPhase = 0;
  }

  /* ============ ACTUALIZACIÓN ============ */
  update(ctx: AnimCtx) {
    const { dt, time } = ctx;
    const moving = ctx.speed > 0.15;
    const run = ctx.speed > ctx.walkRef * 1.15;

    // fase de paso
    if (moving) {
      this.walkPhase += dt * ctx.speed * (ctx.crawling ? 4.4 : 2.55);
    } else {
      this.walkPhase = 0;
    }
    const ph = this.walkPhase;
    const s = Math.sin(ph);
    const amp = Math.min(1, ctx.speed / Math.max(0.4, ctx.walkRef)) * (run ? 0.62 : 0.5);
    this.breathPhase += dt;

    /* --- OBJETIVOS --- */
    const legs: Record<string, THREE.Vector3> = {};
    const arms: Record<string, THREE.Vector3> = {};
    const rot: Record<string, [number, number, number]> = {};

    if (ctx.crawling) {
      // gateo por conductos: brazos extendidos al frente, piernas arrastrando
      arms.armL = this.dirFrom(0.55, -0.35, 0.75);
      arms.armR = this.dirFrom(-0.55, -0.35, 0.75);
      arms.forearmL = this.dirFrom(0.5, -0.15, 0.85);
      arms.forearmR = this.dirFrom(-0.5, -0.15, 0.85);
      legs.legL = this.dirFrom(0.18, -0.9, -0.35);
      legs.legR = this.dirFrom(-0.18, -0.9, -0.35);
      legs.shinL = this.dirFrom(0.15, -0.7, -0.65);
      legs.shinR = this.dirFrom(-0.15, -0.7, -0.65);
      rot.torso = [0.32, 0, 0];
      rot.head = [-0.42, ctx.lookYaw * 0.5, 0];
      rot.jaw = [0.12, 0, 0];
    } else if (moving) {
      // ciclo de caminar/correr real
      const swing = 0.62 * (run ? 1.3 : 1);
      const legFwdL = -s * swing;      // <0 = adelante
      const legFwdR = s * swing;
      const kneeL = Math.max(0, s) * (run ? 1.2 : 0.9);   // flexión al recobrar
      const kneeR = Math.max(0, -s) * (run ? 1.2 : 0.9);
      legs.legL = this.legDir(0.06, legFwdL);
      legs.legR = this.legDir(-0.06, legFwdR);
      legs.shinL = this.legDir(0.05, legFwdL + kneeL);
      legs.shinR = this.legDir(-0.05, legFwdR + kneeR);
      // brazos en contrafase, ligeramente flexionados
      const armSwL = s * 0.55 * (run ? 1.35 : 1);
      const armSwR = -s * 0.55 * (run ? 1.35 : 1);
      arms.armL = this.armDir(0.16, armSwL);
      arms.armR = this.armDir(-0.16, armSwR);
      arms.forearmL = this.armDir(0.16, armSwL - 0.55 - Math.max(0, s) * 0.35);
      arms.forearmR = this.armDir(-0.16, armSwR - 0.55 - Math.max(0, -s) * 0.35);
      // torso: inclinación al correr, balanceo y contrarrotación de hombros
      rot.torso = [run ? 0.24 : 0.07, -s * 0.09 * amp, Math.cos(ph) * 0.04 * amp];
      rot.pelvis = [0, s * 0.08 * amp, Math.sin(ph) * 0.03];
      rot.head = [run ? -0.14 : -0.03, ctx.lookYaw * 0.55, Math.sin(ph) * 0.02];
      rot.jaw = [run ? 0.3 : 0.05, 0, 0];
      this.stepPulse = Math.abs(Math.cos(ph));
    } else {
      // reposo: respiración, micro-balanceo
      const br = Math.sin(this.breathPhase * 1.35);
      arms.armL = this.armDir(0.17, br * 0.03);
      arms.armR = this.armDir(-0.17, -br * 0.03);
      arms.forearmL = this.armDir(0.17, -0.18 + br * 0.02);
      arms.forearmR = this.armDir(-0.17, -0.18 - br * 0.02);
      legs.legL = this.legDir(0.07, 0.02);
      legs.legR = this.legDir(-0.07, -0.02);
      legs.shinL = this.legDir(0.06, 0.03);
      legs.shinR = this.legDir(-0.06, -0.03);
      rot.torso = [0.02 + br * 0.018, 0, Math.sin(this.breathPhase * 0.42) * 0.016];
      rot.pelvis = [0, 0, Math.sin(this.breathPhase * 0.3) * 0.008];
      rot.head = [ctx.lookPitch * 0.6, ctx.lookYaw, 0];
      rot.jaw = [Math.max(0, Math.sin(this.breathPhase * 0.5)) * 0.05, 0, 0];
    }

    /* --- POSES DE ESTADO (sustituyen/añaden sobre lo anterior) --- */
    switch (ctx.state) {
      case 'attack': {
        const windup = ctx.stateTime < 0.42;
        if (windup) {
          // armar el zarpazo: torso atrás, garras arriba, mandíbula abriéndose
          arms.armL = this.dirFrom(0.5, 0.35, 0.78);
          arms.armR = this.dirFrom(-0.5, 0.35, 0.78);
          arms.forearmL = this.dirFrom(0.4, 0.1, 0.9);
          arms.forearmR = this.dirFrom(-0.4, 0.1, 0.9);
          rot.torso = [-0.16, 0, 0];
          rot.jaw = [0.55, 0, 0];
          rot.head = [-0.12, 0, 0];
        } else {
          // embestida: zarpazo frontal completo
          arms.armL = this.dirFrom(0.42, -0.15, 0.89);
          arms.armR = this.dirFrom(-0.42, -0.15, 0.89);
          arms.forearmL = this.dirFrom(0.38, -0.05, 0.92);
          arms.forearmR = this.dirFrom(-0.38, -0.05, 0.92);
          rot.torso = [0.38, 0, 0];
          rot.jaw = [0.72, 0, 0];
          rot.head = [0.18, 0, 0];
        }
        break;
      }
      case 'dying': {
        // jumpscare: agarre al jugador
        arms.armL = this.dirFrom(0.34, 0.62, 0.7);
        arms.armR = this.dirFrom(-0.34, 0.62, 0.7);
        arms.forearmL = this.dirFrom(0.3, 0.35, 0.89);
        arms.forearmR = this.dirFrom(-0.3, 0.35, 0.89);
        rot.torso = [0.22, 0, 0];
        rot.jaw = [0.85, 0, 0];
        rot.head = [0.28, 0, 0];
        break;
      }
      case 'checkMask': {
        // curiosidad: inclinarse hacia el guardia, cabeza ladeada
        const lean = Math.min(1, ctx.stateTime * 2.5);
        arms.armL = this.dirFrom(0.3, -0.15, 0.2);
        arms.armR = this.dirFrom(-0.3, -0.15, 0.2);
        arms.forearmL = this.dirFrom(0.28, -0.05, 0.35);
        arms.forearmR = this.dirFrom(-0.28, -0.05, 0.35);
        rot.torso = [0.16 * lean, 0, 0];
        rot.head = [0.1, ctx.lookYaw * 0.8, 0.26 * lean];
        rot.jaw = [0.08, 0, 0];
        break;
      }
      case 'stunned': {
        // congelado por la linterna: cabeza torcida, temblor
        const tr = Math.sin(time * 34) * 0.02;
        arms.armL = this.armDir(0.22, 0.05 + tr);
        arms.armR = this.armDir(-0.22, -0.05 - tr);
        arms.forearmL = this.armDir(0.22, -0.1);
        arms.forearmR = this.armDir(-0.22, -0.1);
        rot.head = [0.06, 0, -0.34 + tr];
        rot.jaw = [0.18, 0, 0];
        rot.torso = [0.04, 0, -0.05];
        break;
      }
      case 'chase':
      case 'hunt': {
        rot.jaw = [run ? 0.3 : 0.18, 0, 0];
        if (!moving) {
          rot.torso = [0.1, 0, 0];
        }
        break;
      }
      case 'investigate':
      case 'search': {
        // escaneo lateral de la cabeza
        if (!moving) {
          const scan = Math.sin(ctx.stateTime * 1.6) * 0.5;
          rot.head = [0.05, scan, 0.04 * Math.sin(ctx.stateTime * 3.1)];
          rot.torso = [0.06, scan * 0.25, 0];
        }
        break;
      }
    }

    /* --- espasmo aleatorio de terror en la cabeza --- */
    if (ctx.state !== 'dying' && ctx.state !== 'stunned') {
      const twitch = Math.sin(time * 13.7) * Math.sin(time * 2.3);
      if (rot.head && twitch > 0.86) {
        rot.head = [rot.head[0] + (Math.random() - 0.5) * 0.06, rot.head[1] + (Math.random() - 0.5) * 0.1, rot.head[2]];
      }
    }

    /* --- orejas de conejo --- */
    if (this.bones.earL || this.bones.earR) {
      const wig = Math.sin(this.breathPhase * 0.9) * 0.05 + (moving ? Math.sin(ph * 2) * 0.06 : 0);
      rot.earL = [0, 0, wig];
      rot.earR = [0, 0, -wig];
    }

    /* --- APLICAR CON AMORTIGUACIÓN --- */
    const lambda = ctx.state === 'dying' || ctx.state === 'attack' ? 22 : 11;
    for (const [key, d] of this.dirBones) {
      const goal = (key.startsWith('arm') || key.startsWith('forearm') ? arms[key] : legs[key]) ?? d.restDir;
      d.target.copy(goal);
      d.smooth.lerp(d.target, Math.min(1, dt * (moving ? lambda : 7)));
      if (d.smooth.lengthSq() < 1e-6) d.smooth.copy(d.restDir);
      d.smooth.normalize();
      // offset = fromTo(dirReposo -> dirActualSuavizada) en espacio de personaje
      _q.setFromUnitVectors(d.restDir, d.smooth);
      this.applyQuat(d.bone, _q, d.restQuat);
    }
    for (const [key, r] of this.rotBones) {
      const goal = rot[key];
      if (goal) {
        _e.set(goal[0], goal[1], goal[2], 'XYZ');
        r.goal.setFromEuler(_e);
      } else {
        r.goal.identity();
      }
      r.offset.slerp(r.goal, Math.min(1, dt * lambda * 0.55));
      this.applyQuat(r.bone, r.offset, r.restQuat);
    }

    /* --- bob vertical del modelo (paso) --- */
    const bob = moving ? Math.abs(Math.sin(ph)) * 0.05 * amp : Math.sin(this.breathPhase * 1.35) * 0.004;
    if (this.model) this.model.position.y = this.restModelY + bob;
  }

  /** aplica local = P⁻¹ · C · Qoff · C⁻¹ · P · Qrest */
  private applyQuat(bone: THREE.Object3D, qOff: THREE.Quaternion, restQuat: THREE.Quaternion) {
    // C: rotación mundial de la raíz (solo yaw)
    _charQ.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, this.root.rotation.y);
    const parent = bone.parent;
    if (parent) parent.getWorldQuaternion(_pQ);
    else _pQ.identity();
    _q2.copy(_pQ).invert();
    _q4.copy(_charQ).invert();
    _q3.copy(_charQ).multiply(qOff).multiply(_q4).multiply(_pQ);
    bone.quaternion.copy(_q2.multiply(_q3)).multiply(restQuat);
  }

  /* ============ DIRECCIONES CANÓNICAS (espacio de personaje) ============ */
  /** brazo colgando con oscilación: swing > 0 = adelante (+Z) */
  private armDir(side: number, swing: number): THREE.Vector3 {
    return _v.set(side, -Math.cos(swing), Math.sin(swing)).normalize().clone();
  }
  /** pierna colgando: fwd > 0 = adelante (+Z) */
  private legDir(side: number, fwd: number): THREE.Vector3 {
    return _v.set(side, -Math.cos(fwd), Math.sin(fwd)).normalize().clone();
  }
  /** dirección explícita */
  private dirFrom(x: number, y: number, z: number): THREE.Vector3 {
    return _v.set(x, y, z).normalize().clone();
  }
}
