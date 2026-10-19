/**
 * Game: orquestador principal. Motor Three.js, bucle, entrada,
 * interacciones, capítulos con cinemáticas y modelos GLTF del repo.
 */
import * as THREE from 'three';
import chaptersData from '@/data/chapters.json';
import storyData from '@/data/story.json';
import animData from '@/data/animatronics.json';
import type { ChapterDef, AnimatronicDef, Interactable, NoiseEvent } from './types';
import { WorldBuilder } from '../world/worldbuilder';
import { NavGraph } from '../ai/navgraph';
import { Animatronic, setEyeGlow, type AIHost, type PlayerLike } from '../ai/animatronic';
import { Player } from '../player/player';
import { SecurityCameras } from '../systems/cameras';
import { MissionSystem } from '../systems/missions';
import { EventDirector } from '../systems/events';
import { CinematicPlayer } from '../systems/cinematic';
import { MEGA_FIRE } from '../world/fire';
import { TrialSystem, type TrialHudData } from '../systems/trials';
import { AudioEngine } from '../audio/audio';
import { useHud } from './state';
import { loadSave, unlockChapter, addTape, addEnding } from '../systems/save';
import { mapData } from '../ai/mapdata';
import { createPickupMesh } from '../world/props';
import { Assets, type GltfRig } from '../world/assets';
import { disposeTextures } from '../world/textures';
import { disposeMaterials } from '../world/materials';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

type StoryTape = { id: string; title: string; location: string; text: string };
type StoryNote = { id: string; title: string; location: string; text: string };

export class Game {
  renderer!: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera!: THREE.PerspectiveCamera;
  canvas: HTMLCanvasElement;
  world!: WorldBuilder;
  nav = new NavGraph();
  player!: Player;
  animatronics: Animatronic[] = [];
  cams!: SecurityCameras;
  missions!: MissionSystem;
  events!: EventDirector;
  cine!: CinematicPlayer;
  trials!: TrialSystem;
  audio = new AudioEngine();
  chapter = 1;
  chapterDef!: ChapterDef;
  mode = 'boot';
  time = 0; // segundos de juego del capítulo
  power = 100;
  holdInteract: { inter: Interactable; progress: number } | null = null;
  interactables: Interactable[] = [];
  noises: NoiseEvent[] = [];
  private hudTimer = 0;
  private raf = 0;
  private lastFrame = 0;
  private danger = 0;
  private dust: THREE.Points | null = null;
  /* post-processing: bloom sutil para luces de neón, ojos y fuego (alta calidad) */
  private composer: EffectComposer | null = null;
  private bloomPass: UnrealBloomPass | null = null;
  private renderPass: RenderPass | null = null;
  private callLineIdx = 0;
  private callLineTimer = 0;
  private callQueue: string[] = [];
  private callDurations: number[] | null = null;
  private deathTimer = 0;
  private dyingAnimatronic: Animatronic | null = null;
  private jumpscareTimer = 0;
  private quality: 'low' | 'medium' | 'high' = 'high';
  private autoQuality = true;
  private fpsAcc = 0;
  private fpsCount = 0;
  private fpsLowTime = 0;
  private disposed = false;
  private windowListeners: Array<[string, EventListener]> = [];
  private interactPressed = false;
  private menuRig: GltfRig | null = null;
  private menuTwitchT = 0;
  private menuSpot: THREE.SpotLight | null = null;
  private flashlightModel: THREE.Object3D | null = null;
  private flashlightLens: THREE.Mesh | null = null;
  private chapterEndPending = false;
  /** v7 — acumulador de daño por fuego (Mega Guardería) */
  private fireBurnT = 0;
  private powerOut = false;
  /** v9 — la salida se abre al superar SOL Y LUNA del cap 7 */
  private exitUnlocked = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  /* ============ INICIALIZACIÓN ============ */

  async init(onProgress: (frac: number, label: string) => void) {
    onProgress(0.02, 'Starting 3D engines...');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    // v11: sombras suaves de alta calidad (PCFSoft) + tone mapping cinematográfico
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    // pérdida de contexto WebGL: evitar pestaña muerta silenciosamente
    this.canvas.addEventListener('webglcontextlost', ((e: Event) => {
      e.preventDefault();
      useHud.getState().setLoading(0, '3D CONTEXT LOST — reload the page');
      useHud.getState().setMode('boot');
      this.pause();
    }) as EventListener, false);

    const save = loadSave();
    this.quality = save.settings.quality;
    useHud.getState().setSettings(save.settings);
    useHud.getState().setProgress(save.unlockedChapter, save.tapes);
    this.audio.setVolumes(save.settings.master, save.settings.music, save.settings.sfx);

    // noche cerrada: fondo casi negro + niebla densa
    this.scene.background = new THREE.Color(0x010102);
    this.scene.fog = new THREE.FogExp2(0x030407, 0.058);
    // hemisferio casi nulo: el edificio está a oscuras, la linterna es esencial
    const hemi = new THREE.HemisphereLight(0x11131c, 0x020203, 0.022);
    this.scene.add(hemi);

    // entorno PMREM sutil: reflejos especulares realistas en metales y suelos
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const envScene = new RoomEnvironment();
    const envRT = pmrem.fromScene(envScene, 0.06);
    this.scene.environment = envRT.texture;
    (this.scene as THREE.Scene & { environmentIntensity: number }).environmentIntensity = 0.07;
    pmrem.dispose();

    this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.08, 95);
    this.scene.add(this.camera);

    // v11: CADENA DE POST-PROCESADO (tras crear la cámara) — render + bloom
    // sutil + salida con tone mapping. Da "glow" real a neones, ojos emisivos
    // y llamas. Solo en calidad alta; media/baja renderizan directo.
    this.setupPostProcessing();

    // cargar modelos GLB y texturas del repositorio
    await Assets.loadAll((f, label) => onProgress(0.05 + f * 0.45, label));

    onProgress(0.55, 'Building the MEGAPLEX...');
    await nextFrame();
    this.world = new WorldBuilder(this.scene);
    this.world.buildAll((f, label) => onProgress(0.55 + f * 0.2, label));
    // rendimiento: sombras solo en estructuras (muros, marcos, conductos y
    // puertas — marcadas con userData.castShadow en el worldbuilder) y
    // personajes; los props pequeños no proyectan sombra
    this.world.root.traverse((o) => {
      if (o instanceof THREE.Mesh) o.castShadow = !!(o.userData as { castShadow?: boolean }).castShadow;
    });
    await nextFrame();

    onProgress(0.8, 'Charting animatronic routes...');
    this.nav.build(this.world);

    onProgress(0.84, 'Recruiting the guard...');
    this.player = new Player(this.camera, {
      world: this.world,
      addNoise: (x, z, r) => this.addNoise(x, z, r),
      sfx: {
        footstep: (pos, surface, running, heavy) => this.audio.footstep(pos, surface, running, heavy),
        locker: (pos) => this.audio.locker(pos),
      },
      power: this.power,
    });
    this.attachFlashlightModel();
    this.buildGuardArms();

    onProgress(0.9, 'Waking the animatronics...');
    const host = this.makeAIHost();
    for (const def of (animData as { animatronics: AnimatronicDef[] }).animatronics) {
      this.animatronics.push(new Animatronic(def, host));
    }

    this.cams = new SecurityCameras(window.innerWidth / window.innerHeight, {
      camSwitch: () => this.audio.camSwitch(),
      setStatic: (l) => this.audio.setStatic(l),
    });
    this.cine = new CinematicPlayer(this.camera, this.world);
    this.trials = new TrialSystem(this.makeTrialHost());

    this.buildDust();

    // luces de menú y estrobo creadas AHORA (nunca en caliente):
    // añadirlas después provocaría recompilar TODOS los shaders = congelación
    this.menuSpot = new THREE.SpotLight(0xcfd8e8, 0, 9, 0.55, 0.5, 1.6);
    this.menuSpot.position.set(-37.1, 3.1, 25.1);
    this.menuSpot.target.position.set(-37.5, 2.1, 23.3);
    this.scene.add(this.menuSpot, this.menuSpot.target);
    this.scene.add(this.jumpscareStrobe);

    this.setupInput();
    onProgress(0.97, 'Ready...');
    this.enterMenu();
    this.render();
    onProgress(1, 'Complete');
  }

  /** modelo GLB de la linterna en primera persona (tamaño real, mano derecha) */
  private attachFlashlightModel() {
    const rig = Assets.rigs.get('flashlight');
    if (!rig) return;
    const model = rig.root;
    // tras la corrección de eje: el cuerpo ocupa z ∈ [-0.095, +0.095] (cabeza en -Z)
    // y y ∈ [0, 0.062]; el origen queda en la base del cuerpo
    model.position.set(0.3, -0.285, -0.42);
    model.rotation.set(0.06, -0.08, 0.02);
    model.visible = false;
    this.camera.add(model);
    this.flashlightModel = model;
    // lente emisiva en la cabeza del frontal (-Z, altura del eje del cilindro)
    const lens = new THREE.Mesh(
      new THREE.CircleGeometry(0.024, 16),
      new THREE.MeshStandardMaterial({ color: 0xfff6d8, emissive: 0xffeeb0, emissiveIntensity: 0 })
    );
    lens.position.set(0, 0.031, -0.094);
    lens.rotation.y = Math.PI;
    model.add(lens);
    this.flashlightLens = lens;
  }

  /** brazos del guardia en primera persona sosteniendo la linterna */
  private guardArms: THREE.Group | null = null;
  private guardArmsSway = new THREE.Quaternion();

  private buildGuardArms() {
    const skinTex = Assets.textures?.guardSkin;
    const clothTex = Assets.textures?.guardUniform;
    const group = new THREE.Group();

    const skinMat = new THREE.MeshStandardMaterial({
      map: skinTex ?? null, color: skinTex ? 0xffffff : 0xb08a68, roughness: 0.72, metalness: 0,
    });
    const clothMat = new THREE.MeshStandardMaterial({
      map: clothTex ?? null, color: clothTex ? 0xffffff : 0x27292e, roughness: 0.88, metalness: 0,
    });

    /** miembro cilíndrico del punto A al B (espacio de cámara) */
    const limb = (a: THREE.Vector3, b: THREE.Vector3, rA: number, rB: number, mat: THREE.Material) => {
      const len = a.distanceTo(b);
      const m = new THREE.Mesh(new THREE.CylinderGeometry(rA, rB, len, 10), mat);
      m.position.copy(a).add(b).multiplyScalar(0.5);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
      return m;
    };

    // ---- brazo derecho: antebrazo visible desde el borde inferior-derecho ----
    // manga (uniforme) + puño remangado (piel) + mano
    group.add(limb(new THREE.Vector3(0.5, -0.42, -0.1), new THREE.Vector3(0.38, -0.33, -0.24), 0.066, 0.056, clothMat));
    group.add(limb(new THREE.Vector3(0.38, -0.33, -0.24), new THREE.Vector3(0.32, -0.29, -0.33), 0.052, 0.046, skinMat));
    const handR = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.04, 0.09), skinMat);
    handR.position.set(0.305, -0.26, -0.38);
    handR.rotation.y = -0.15;
    const thumbR = new THREE.Mesh(new THREE.BoxGeometry(0.019, 0.018, 0.048), skinMat);
    thumbR.position.set(0.283, -0.242, -0.36);
    group.add(handR, thumbR);

    // ---- brazo izquierdo: sujeta el frente por debajo ----
    group.add(limb(new THREE.Vector3(-0.36, -0.52, -0.12), new THREE.Vector3(-0.08, -0.42, -0.28), 0.064, 0.054, clothMat));
    group.add(limb(new THREE.Vector3(-0.08, -0.42, -0.28), new THREE.Vector3(0.05, -0.37, -0.38), 0.05, 0.045, skinMat));
    const handL = new THREE.Mesh(new THREE.BoxGeometry(0.054, 0.044, 0.088), skinMat);
    handL.position.set(0.13, -0.33, -0.43);
    handL.rotation.set(0.2, -0.5, 0);
    const fingersL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.034, 0.052), skinMat);
    fingersL.position.set(0.18, -0.31, -0.48);
    fingersL.rotation.set(0.2, -0.5, 0);
    group.add(handL, fingersL);

    group.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.castShadow = false;
        o.receiveShadow = false;
        o.frustumCulled = false;
      }
    });
    group.visible = false;
    this.camera.add(group);
    this.guardArms = group;
  }

  /** balanceo de los brazos en primera persona según el paso del jugador */
  private updateGuardArms(dt: number) {
    if (!this.guardArms || !this.guardArms.visible) return;
    const t = performance.now() / 1000;
    const speed = Math.hypot(this.player.vel.x, this.player.vel.z);
    const bobY = Math.sin(t * speed * 2.3) * Math.min(0.02, speed * 0.006);
    const bobX = Math.cos(t * speed * 1.15) * Math.min(0.014, speed * 0.004);
    this.guardArms.position.set(bobX, bobY, 0);
    const target = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(Math.sin(t * speed * 2.3) * 0.012 + Math.sin(t * 1.1) * 0.006, 0, Math.cos(t * speed * 1.15) * 0.01)
    );
    this.guardArmsSway.slerp(target, Math.min(1, dt * 8));
    this.guardArms.quaternion.copy(this.guardArmsSway);
    // lente de la linterna brilla al encender
    if (this.flashlightLens) {
      const m = this.flashlightLens.material as THREE.MeshStandardMaterial;
      m.emissiveIntensity = this.player.flashlightOn ? 2.8 : 0.04;
    }
  }

  private makeAIHost(): AIHost {
    return {
      time: 0,
      chapter: 1,
      chapterTime: 0,
      aggression: 1,
      nav: this.nav,
      world: this.world,
      noises: this.noises,
      onDeath: (ai) => this.onDeath(ai),
      sfx: {
        footstep: (pos, kind, running, heavy) => this.audio.footstep(pos, kind, running, heavy),
        servo: (pos, voice) => this.audio.servo(pos, voice),
        roar: (pos, voice) => this.audio.roar(pos, voice),
        doorCreak: (pos) => this.audio.doorCreak(pos),
        ventBang: (pos) => this.audio.ventBang(pos),
        stinger: () => this.audio.stinger(),
        vocal: (pos, voice) => this.audio.vocal(pos, voice),
        playHunterRun: (pos) => this.audio.playHunterRun(pos),
      },
    };
  }

  private buildDust() {
    const count = this.quality === 'low' ? 0 : this.quality === 'medium' ? 260 : 420;
    if (count === 0) return;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 16;
      pos[i * 3 + 1] = Math.random() * 3;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 16;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xbfae8a,
      size: 0.018,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.dust = new THREE.Points(geo, mat);
    this.scene.add(this.dust);
  }

  private updateDust(_dt: number) {
    if (!this.dust) return;
    this.dust.position.set(
      Math.round(this.player.pos.x / 8) * 8,
      0,
      Math.round(this.player.pos.z / 8) * 8
    );
    const p = this.dust.geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = p.array as Float32Array;
    for (let i = 0; i < arr.length; i += 3) {
      arr[i + 1] += Math.sin(this.time * 0.6 + i) * 0.0008 + 0.0012;
      arr[i] += Math.cos(this.time * 0.4 + i * 0.7) * 0.0006;
      if (arr[i + 1] > 3.1) arr[i + 1] = 0.05;
    }
    p.needsUpdate = true;
  }

  /* ============ MENÚ (estilo FNAF: Freddy en estática) ============ */

  enterMenu() {
    this.mode = 'menu';
    useHud.getState().setMode('menu');
    useHud.getState().setTablet(false);
    // música del tema (archivo real del repo) al volver al menú
    this.audio.startThemeMusic();
    // Freddy del menú: clon en la oficina mirando a cámara
    const CX = -37.5;
    const CZ = 24.5;
    if (!this.menuRig && Assets.has('freddy')) {
      this.menuRig = Assets.createVariant('freddy');
      this.menuRig.root.position.set(CX, 0, CZ - 1.2);
      this.menuRig.root.rotation.y = 0;
      this.scene.add(this.menuRig.root);
    } else if (this.menuRig) {
      this.scene.add(this.menuRig.root);
    }
    // foco cenital tenue sobre Freddy (creado en init; solo se enciende)
    if (this.menuSpot) this.menuSpot.intensity = 60;
    this.audio.setStatic(0);
    this.audio.setBreathing(false);
    this.audio.setChase(false);
    this.audio.stopPhoneVoice();
    // v7 — al salir al menú, el infierno se calla
    this.audio.setDaycareSong(false);
    this.audio.setFireAmbience(false);
    MEGA_FIRE?.setEnabled(false);
    useHud.getState().setSubtitle(null);
  }

  private menuCamera(dt: number) {
    const t = performance.now() / 1000;
    const CX = -37.5;
    const CZ = 24.5;
    // cámara fija frente al rostro de Freddy
    this.camera.position.set(CX + Math.sin(t * 0.07) * 0.08, 2.18 + Math.sin(t * 0.11) * 0.02, CZ + 0.9);
    this.camera.rotation.set(0, 0, 0);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = 0 + Math.sin(t * 0.05) * 0.03;
    this.camera.rotation.x = 0.1;
    // espasmos de cabeza de Freddy
    if (this.menuRig) {
      this.menuTwitchT -= dt;
      const head = this.menuRig.bones.head;
      if (head) {
        if (this.menuTwitchT <= 0) {
          this.menuTwitchT = 1.2 + Math.random() * 3.5;
        }
        head.rotation.z = Math.sin(t * 0.8) * 0.03 + (Math.random() < 0.02 ? (Math.random() - 0.5) * 0.2 : 0);
        head.rotation.y = Math.sin(t * 0.33) * 0.08;
      }
      for (const e of this.menuRig.eyes) {
        const mats = Array.isArray(e.material) ? e.material : [e.material];
        for (const m of mats as THREE.MeshStandardMaterial[]) {
          m.emissiveIntensity = 1.2 + (Math.random() < 0.06 ? -1.1 : 0);
        }
      }
      this.menuRig.mixer?.update(dt);
    }
    if (this.world) this.world.update(dt, this.camera.position);
  }

  /* ============ CAPÍTULOS ============ */

  startChapter(n: number) {
    this.chapter = n;
    const chapters = (chaptersData as { chapters: ChapterDef[] }).chapters;
    this.chapterDef = chapters.find((x) => x.chapter === n) ?? chapters[0];
    this.time = 0;
    this.power = this.chapterDef.startPower;
    this.noises = [];
    this.danger = 0;
    this.chapterEndPending = false;
    this.powerOut = false;
    this.exitUnlocked = false;
    // silenciar la música del tema al entrar en juego
    this.audio.stopThemeMusic();
    // v7 — y la nana del incendio (la prueba la reactivará)
    this.audio.setDaycareSong(false);
    this.audio.setFireAmbience(false);
    // quitar Freddy del menú y su foco
    if (this.menuRig) this.scene.remove(this.menuRig.root);
    if (this.menuSpot) this.menuSpot.intensity = 0;
    // v12 — el guardia EMPIEZA ya con la linterna en la mano
    this.world.reset();
    this.player.reset();
    for (const a of this.animatronics) a.reset();
    this.cams.reset(n);
    this.missions = new MissionSystem(this.chapterDef, this.world, useHud, this.makeMissionHost());
    this.events = new EventDirector(this.makeEventHost());
    this.trials.reset(n);
    this.buildInteractables();
    this.trialInteractables = [];

    // v12 — MOON solo existe al FINAL del juego (cap 7, EL SÓTANO)
    const luna = this.animatronics.find((a) => a.def.id === 'luna');
    if (luna) {
      if (n === 7) {
        // cap 7 — EL SÓTANO EN LLAMAS: LUNA cuelga boca abajo del techo
        luna.setDayNight('moon');
        luna.teleportTo(0, -48, 0.6);
        luna.hangFromCeiling(6.55);
      } else {
        // resto de noches: duerme retirada en lo más profundo del sótano
        luna.setDayNight('moon');
        luna.retire();
        luna.teleportTo(0, -58, 0.4);
      }
    }
    // el sótano solo arde en el cap 7 (final)
    MEGA_FIRE?.setEnabled(n === 7);
    if (n === 1) {
      // cap 1 — EL PRIMER TURNO: el guardia nuevo entra por el VESTÍBULO
      this.player.crouching = false;
    } else {
      // cap 2+: se aparece en la Oficina de Seguridad (hub del turno)
      this.player.pos.set(-37.5, 0, 26.5);
      this.player.yaw = 0;
    }
    // v12 — EMPEZAR YA CON LA LINTERNA (equipada y encendida)
    this.missions.hasFlashlight = true;
    this.player.flashlightOn = true;
    if (this.flashlightModel) this.flashlightModel.visible = true;
    if (this.guardArms) this.guardArms.visible = true;

    this.callQueue = [];
    this.callLineIdx = 0;
    this.callLineTimer = 0;
    useHud.getState().syncHud({
      chapter: n,
      chapterTitle: this.chapterDef.title,
      hour: 0,
      power: this.power,
      objectives: [],
      prompt: null,
      subtitle: null,
      deadBy: null,
      chapterComplete: false,
      ending: null,
      jumpscare: null,
    });
    this.missions.syncObjectives();
    this.audio.startAmbient();
    this.audio.setChase(false);
    this.audio.resume();
    // ¿cinemática de entrada?
    if (this.chapterDef.introCinematic) {
      this.playCinematic(this.chapterDef.introCinematic, () => {
        this.beginPlay();
      });
    } else {
      this.beginPlay();
    }
  }

  private beginPlay() {
    this.mode = 'playing';
    useHud.getState().setMode('playing');
  }

  private makeMissionHost() {
    return {
      sfx: {
        alertBeep: () => this.audio.alertBeep(),
        switchClick: () => this.audio.switchClick(),
        keypadBeep: (ok: boolean) => this.audio.keypadBeep(ok),
        powerUp: () => this.audio.powerUp(),
        pickup: () => this.audio.pickup(),
        repairClick: () => this.audio.repairClick(),
      },
      notify: (msg: string) => this.notify(msg),
      setPower: (v: number) => {
        this.power = Math.max(0, Math.min(100, v));
      },
      getPower: () => this.power,
    };
  }

  private makeEventHost() {
    return {
      world: this.world,
      player: this.player,
      animatronics: this.animatronics,
      time: 0,
      night: this.chapter,
      eventRate: this.chapterDef?.eventRate ?? 1,
      audio: {
        knock: (pos: { x: number; y: number; z: number }, count?: number) => this.audio.knock(pos, count),
        whisper: (pos: { x: number; y: number; z: number }) => this.audio.whisper(pos),
        childLaugh: (pos: { x: number; y: number; z: number }) => this.audio.childLaugh(pos),
        radioBurst: (pos: { x: number; y: number; z: number }) => this.audio.radioBurst(pos),
        ventBang: (pos: { x: number; y: number; z: number }) => this.audio.ventBang(pos),
        doorCreak: (pos: { x: number; y: number; z: number }) => this.audio.doorCreak(pos),
        kitchenClatter: (pos: { x: number; y: number; z: number }) => this.audio.kitchenClatter(pos),
        footstep: (pos: { x: number; y: number; z: number }, surface: string, running: boolean, heavy: boolean) =>
          this.audio.footstep(pos, surface, running, heavy),
        setStatic: (l: number) => this.audio.setStatic(l),
        powerDown: () => this.audio.powerDown(),
      },
      addPowerDrain: (v: number) => {
        this.power = Math.max(0, this.power - v);
      },
      onCallStart: (lines: string[]) => this.startCall(lines),
      onKitchenNoise: () => {
        this.notify('NOISE IN THE KITCHEN — CHECK IT OUT');
      },
    };
  }

  /* ============ HOST DE PRUEBAS ============ */

  private trialInteractables: Interactable[] = [];

  private makeTrialHost() {
    return {
      world: this.world,
      player: this.player,
      animatronics: this.animatronics,
      notify: (msg: string) => this.notify(msg),
      setTrialHud: (d: TrialHudData) =>
        useHud.getState().syncHud({
          trialActive: !!d.name,
          trialName: d.name,
          trialAttempts: d.attempts,
          trialTasks: d.tasksTotal,
          trialTasksDone: d.tasksDone,
        }),
      completeObjective: (id: string) => this.missions.completeObjective(id),
      objectiveDone: (id: string) => !!this.missions.objectives.find((o) => o.def.id === id)?.done,
      registerInteractable: (inter: Interactable) => {
        this.trialInteractables.push(inter);
        this.interactables.push(inter);
      },
      clearTrialInteractables: () => {
        this.interactables = this.interactables.filter((i) => !this.trialInteractables.includes(i));
        this.trialInteractables = [];
      },
      addNoise: (x: number, z: number, r: number) => this.addNoise(x, z, r),
      unlockDoor: (id: string) => this.forceUnlockDoor(id),
      onTrialSuccess: () => {
        // el Freddy Dorado despierta al superar la prueba de generadores (cap 5)
        if (this.chapter === 5) {
          const golden = this.animatronics.find((a) => a.def.id === 'golden');
          if (golden && !golden.active) {
            this.audio.stinger();
            golden.scriptWake();
            this.notify('THE GOLDEN SUIT HAS RISEN — RUN TO THE LOBBY');
            this.player.setShake(0.9);
          }
        }
        // cap 7 — SOL Y LUNA superado: la salida se abre de par en par
        if (this.chapter === 7) {
          this.exitUnlocked = true;
          this.notify("THE EXIT IS OPEN — RUN, DON'T LOOK BACK");
          this.audio.stinger();
        }
      },
      sfx: {
        stinger: () => this.audio.stinger(),
        roar: (pos: THREE.Vector3, voice: string) => this.audio.roar(pos, voice),
        ventBang: (pos: THREE.Vector3) => this.audio.ventBang(pos),
        childLaugh: (pos: THREE.Vector3) => this.audio.childLaugh(pos),
        footstep: (pos: THREE.Vector3, surface: string, running: boolean, heavy: boolean) =>
          this.audio.footstep(pos, surface, running, heavy),
        powerDown: () => this.audio.powerDown(),
        powerUp: () => this.audio.powerUp(),
        switchClick: () => this.audio.switchClick(),
        respawn: () => this.audio.respawn(),
        moonScream: (pos: THREE.Vector3) => this.audio.moonScream(pos),
        lullaby: (pos: THREE.Vector3) => this.audio.lullaby(pos),
        // v7 — Mega Guardería en llamas
        extinguisherSpray: () => this.audio.extinguisherSpray(),
        setFireAmbience: (on: boolean) => this.audio.setFireAmbience(on),
        setDaycareSong: (on: boolean) => this.audio.setDaycareSong(on),
        playLoopSfx: (name, pos, vol) => this.audio.playLoopSfx(name, pos, vol),
        freddyLaugh: (pos: THREE.Vector3) => this.audio.freddyLaugh(pos),
      },
    };
  }

  /** desbloquear y abrir una puerta/reja desde el sistema de pruebas */
  private forceUnlockDoor(id: string) {
    const door = this.world.doors.get(id);
    if (!door || !door.locked) return;
    door.locked = false;
    this.nav.setDoorBlocked(id, false);
    door.open = true;
    door.targetAngle = door.baseAngle + door.swing * door.openAngle;
    this.audio.doorCreak(new THREE.Vector3(door.def.x, 1, door.def.z));
  }

  /* ============ CINEMÁTICAS ============ */

  playCinematic(id: string, onEnd: () => void) {
    this.mode = 'cinematic';
    useHud.getState().setMode('cinematic');
    this.audio.setStatic(0);
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
    const ok = this.cine.play(id, onEnd);
    if (!ok) {
      this.mode = 'playing';
      useHud.getState().setMode('playing');
      onEnd();
    }
  }

  skipCinematic() {
    if (this.cine.active) this.cine.skip();
  }

  /* ============ ENTRADA ============ */

  private setupInput() {
    const kd = (e: KeyboardEvent) => this.onKeyDown(e);
    const ku = (e: KeyboardEvent) => this.onKeyUp(e);
    const mm = (e: MouseEvent) => this.onMouseMove(e);
    const rs = () => this.onResize();
    window.addEventListener('keydown', kd as EventListener);
    window.addEventListener('keyup', ku as EventListener);
    window.addEventListener('mousemove', mm as EventListener);
    window.addEventListener('resize', rs);
    this.windowListeners = [
      ['keydown', kd as EventListener], ['keyup', ku as EventListener], ['mousemove', mm as EventListener], ['resize', rs],
    ];
  }

  private onKeyDown(e: KeyboardEvent) {
    if (e.code === 'Tab') e.preventDefault();
    this.player.keys[e.code] = true;
    if (this.mode === 'cinematic') {
      if (e.code === 'KeyE' || e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        this.skipCinematic();
      } else if (e.code === 'Escape') {
        this.cine.stop(true);
      }
      return;
    }
    if (this.mode !== 'playing') {
      if (e.code === 'Escape' && this.mode === 'paused') this.resume();
      return;
    }
    switch (e.code) {
      case 'KeyF':
        this.player.toggleFlashlight();
        // v11: CLICK REAL de linterna del repo (con fallback al blip)
        if (!this.audio.flashlightClick(this.player.flashlightOn)) this.audio.camSwitch();
        break;
      case 'KeyQ':
        this.toggleMask();
        break;
      case 'KeyC':
        this.toggleTablet();
        break;
      case 'ControlLeft':
      case 'ControlRight':
        this.player.crouching = !this.player.crouching;
        break;
      case 'KeyE':
        this.tryInteract();
        break;
      case 'Escape':
        this.pause();
        break;
      case 'ArrowLeft':
      case 'KeyA':
        if (useHud.getState().tabletOpen) this.cams.switchCam(-1);
        break;
      case 'ArrowRight':
      case 'KeyD':
        if (useHud.getState().tabletOpen) this.cams.switchCam(1);
        break;
      default:
        if (e.code.startsWith('Digit')) {
          const n = parseInt(e.code.slice(5), 10);
          const stt = useHud.getState();
          if (stt.tabletOpen && n >= 1 && n <= 9) {
            const cam = this.cams.cams.find((c) => c.index === n);
            if (cam) this.cams.setCam(n);
          }
        }
        break;
    }
  }

  private onKeyUp(e: KeyboardEvent) {
    this.player.keys[e.code] = false;
    if (e.code === 'KeyE') this.holdInteract = null;
  }

  private onMouseMove(e: MouseEvent) {
    if (this.mode !== 'playing') return;
    const locked = document.pointerLockElement === this.canvas;
    if (!locked) {
      if (e.buttons & 1) {
        const settings = useHud.getState().settings;
        this.player.onMouseMove(e.movementX, e.movementY, settings.sensitivity, settings.invertY);
      }
      return;
    }
    const settings = useHud.getState().settings;
    this.player.onMouseMove(e.movementX, e.movementY, settings.sensitivity, settings.invertY);
  }

  onCanvasClick() {
    if (this.mode === 'cinematic') {
      this.skipCinematic();
      return;
    }
    if (this.mode === 'playing' && document.pointerLockElement !== this.canvas) {
      this.canvas.requestPointerLock?.();
    }
  }

  private onResize() {
    if (!this.renderer) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.composer?.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.cams.camera.aspect = w / h;
    this.cams.camera.updateProjectionMatrix();
  }

  /** v11: cadena de post-procesado (solo calidad alta) */
  private setupPostProcessing() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.composer = new EffectComposer(this.renderer);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), 0.38, 0.55, 0.86);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(new OutputPass());
    this.composer.setSize(w, h);
  }

  private toggleMask() {
    if (this.player.inVent) {
      this.notify("You can't put the mask on here");
      return;
    }
    this.player.masked = !this.player.masked;
    this.audio.setBreathing(this.player.masked);
    this.audio.servo(this.player.pos, 'deep');
  }

  private toggleTablet() {
    const st = useHud.getState();
    if (!this.missions.hasTablet) {
      this.notify('The surveillance tablet is in the office');
      return;
    }
    if (st.note || st.keypadDoor) return;
    const open = !st.tabletOpen;
    st.setTablet(open);
    this.audio.camSwitch();
  }

  /* ============ INTERACCIONES ============ */

  private buildInteractables() {
    this.interactables = [];
    const world = this.world;
    const P = () => this.player;
    const ch = this.chapter;

    // puertas
    for (const door of world.doors.values()) {
      const isExit = door.def.id === 'door_exit';
      const isSecret = door.def.id === 'door_techS';
      const isGenerator = door.def.id === 'door_generator' || door.def.id === 'door_generator2';
      // v12 — puertas cortafuego del SÓTANO (se abren con 3 tarjetas)
      const isMegaFire = door.def.id === 'door_mega_w' || door.def.id === 'door_mega_c' || door.def.id === 'door_mega_e';
      this.interactables.push({
        id: `door_${door.def.id}`,
        label: isSecret ? 'Push the shelf' : door.locked ? 'Locked door' : door.open ? 'Close door' : 'Open door',
        pos: { x: door.def.x, y: 1.1, z: door.def.z },
        radius: 1.9,
        enabled: () => this.mode === 'playing' && !P().hidden,
        action: () => {
          if (isSecret && door.locked) {
            door.locked = false;
            this.nav.setDoorBlocked('door_techS', false);
            this.notify('The shelf slides inward... the technical room');
            this.audio.doorCreak(new THREE.Vector3(door.def.x, 1, door.def.z));
            door.open = true;
            door.targetAngle = door.baseAngle + door.swing * door.openAngle;
            return;
          }
          if (isGenerator && door.locked) {
            // la sala de generadores se abre en el capítulo 5
            if (ch >= 5) {
              door.locked = false;
              this.nav.setDoorBlocked(door.def.id, false);
              this.notify('GENERATOR ROOM OPEN');
              this.audio.keypadBeep(true);
              return;
            }
            this.notify(door.def.lockedMsg ?? 'Locked');
            this.audio.keypadBeep(false);
            return;
          }
          if (isMegaFire && door.locked) {
            // v12 — las puertas cortafuego del sótano se abren con las 3 tarjetas
            if (ch === 7 && this.missions.keycards >= 3) {
              door.locked = false;
              this.nav.setDoorBlocked(door.def.id, false);
              door.open = true;
              door.targetAngle = door.baseAngle + door.swing * door.openAngle;
              this.audio.keypadBeep(true);
              this.audio.doorCreak(new THREE.Vector3(door.def.x, 1, door.def.z));
              this.notify('FIRE DOORS OPEN — THE BASEMENT WAITS BELOW');
              return;
            }
            this.notify(`FIRE DOOR — 3 KEYCARDS REQUIRED (${this.missions.keycards}/3)`);
            this.audio.keypadBeep(false);
            return;
          }
          if (door.locked) {
            if (isExit && ch === 7 && this.exitUnlocked) {
              this.missions.completeObjective('c7_escape');
              this.finishGame('escape');
              return;
            }
            if (isExit && ch === 7) {
              this.notify('THE EXIT IS SEALED — KILL THE INFERNO FIRST (5 extinguishers)');
            } else {
              this.notify(door.def.lockedMsg ?? 'Locked');
            }
            this.audio.keypadBeep(false);
            return;
          }
          door.open = !door.open;
          door.targetAngle = door.open
            ? door.baseAngle + door.swing * door.openAngle
            : door.baseAngle;
          this.audio.doorCreak(new THREE.Vector3(door.def.x, 1, door.def.z));
          this.addNoise(door.def.x, door.def.z, 6);
        },
      });
    }

    // escondites
    for (const spot of mapData.hidingSpots) {
      const [x, z] = spot.pos;
      const [lx, lz] = spot.look;
      // v13: el guardia mira HACIA FUERA del escondite (la dirección look)
      // y al salir aparece DELANTE de la puerta, no incrustado dentro.
      const dx = lx - x;
      const dz = lz - z;
      const dLen = Math.hypot(dx, dz) || 1;
      const hideYaw = Math.atan2(-dx / dLen, -dz / dLen);
      const exitPos = new THREE.Vector3(x + (dx / dLen) * 1.05, 0, z + (dz / dLen) * 1.05);
      this.interactables.push({
        id: `hide_${spot.id}`,
        label: spot.type === 'locker' ? 'Hide in the locker' : 'Hide',
        pos: { x, y: 0.9, z },
        radius: 1.6,
        enabled: () => this.mode === 'playing' && !P().hidden && !P().inVent,
        action: () => {
          this.player.hide(spot.id, new THREE.Vector3(x, 0, z), hideYaw);
          this.hideExit = exitPos;
          // v13 — SI UN CAZADOR TE VIO ESCONDERTE, VIENE A SACARTE:
          // esconderse con él encima ya no es un botón de salvación.
          let witnessed = false;
          for (const a of this.animatronics) {
            if (!a.active || a.retired) continue;
            if (a.state !== 'chase' && a.state !== 'hunt') continue;
            if (a.pos.distanceTo(new THREE.Vector3(x, 0, z)) < 7.5) {
              a.markWitnessedHide(x, z);
              witnessed = true;
            }
          }
          if (witnessed) {
            this.notify('IT SAW YOU HIDE — GET OUT OF THERE! [E]');
            this.player.setShake(0.5);
          } else {
            this.notify('Hidden — hold your breath [E to come out]');
          }
        },
      });
      this.interactables.push({
        id: `unhide_${spot.id}`,
        label: 'Leave hiding spot',
        pos: { x, y: 0.9, z },
        radius: 2.4,
        requireLook: false,
        enabled: () => this.mode === 'playing' && P().hidden === true && P().hiddenSpotId === spot.id,
        action: () => {
          this.player.unhide(this.hideExit ?? new THREE.Vector3(x, 0, z));
        },
      });
    }

    // v12 — la linterna ya NO está en el escritorio: se empieza equipada

    const tabletA = world.anchors.get('desk_tablet');
    if (tabletA) {
      this.interactables.push({
        id: 'pickup_tablet',
        label: 'Take the surveillance tablet',
        pos: { x: tabletA.pos.x, y: tabletA.pos.y, z: tabletA.pos.z },
        radius: 1.7,
        enabled: () => !this.missions.hasTablet,
        action: () => {
          this.missions.hasTablet = true;
          tabletA.mesh!.visible = false;
          this.audio.pickup();
          this.missions.completeObjective('c2_tablet');
          this.notify('Tablet equipped [C]');
        },
      });
    }

    // breakers del Cuarto Eléctrico (cap1)
    for (const [anchorId, objId] of [['breaker_1', 'c1_b1'], ['breaker_2', 'c1_b2']] as Array<[string, string]>) {
      const a = world.anchors.get(anchorId);
      if (!a) continue;
      this.interactables.push({
        id: anchorId,
        label: 'Reset the breaker',
        pos: { x: a.pos.x, y: a.pos.y, z: a.pos.z },
        radius: 1.8,
        holdTime: 5,
        holdLabel: 'RESETTING BREAKER',
        enabled: () => this.mode === 'playing' && ch === 1 && !this.missions.objectives.find((o) => o.def.id === objId)?.done,
        action: () => {
          this.power = Math.min(100, this.power + 20);
          this.audio.powerUp();
          this.missions.completeObjective(objId);
        },
      });
    }

    // tarjetas de acceso (cap6)
    for (const [anchorId, objId, label] of [
      ['key_rockstar', 'c7_key1', 'Rockstar Row'],
      ['key_theater', 'c7_key2', 'Bruno Theater'],
      ['key_foodcourt', 'c7_key3', 'Food Court'],
    ] as Array<[string, string, string]>) {
      const a = world.anchors.get(anchorId);
      if (!a) continue;
      const mesh = createPickupMesh('keycard');
      mesh.position.copy(a.pos);
      world.root.add(mesh);
      a.mesh = mesh;
      const y0 = mesh.position.y;
      world.propAnims.push({ update: (_dt, t) => { if (mesh.visible) mesh.position.y = y0 + Math.sin(t * 2 + a!.pos.x) * 0.02; } });
      this.interactables.push({
        id: `pickup_${anchorId}`,
        label: `Take keycard — ${label}`,
        pos: { x: a.pos.x, y: a.pos.y, z: a.pos.z },
        radius: 1.6,
        enabled: () => this.mode === 'playing' && ch === 7 && mesh.visible,
        action: () => {
          mesh.visible = false;
          this.missions.keycards++;
          this.audio.pickup();
          this.missions.completeObjective(objId);
          this.notify(`KEYCARD ${this.missions.keycards}/3 — ${label}`);
        },
      });
    }

    // monitor de la oficina abre la tableta
    const monitor = world.anchors.get('desk_monitor');
    if (monitor) {
      this.interactables.push({
        id: 'monitor',
        label: 'Check the monitor',
        pos: { x: monitor.pos.x, y: monitor.pos.y, z: monitor.pos.z },
        radius: 1.5,
        enabled: () => this.mode === 'playing' && this.missions.hasTablet && !useHud.getState().tabletOpen,
        action: () => this.toggleTablet(),
      });
    }
  }

  private updateInteractions(dt: number) {
    const st = useHud.getState();
    if (this.mode !== 'playing' || st.tabletOpen || st.note || st.keypadDoor) {
      if (st.prompt) st.setPrompt(null);
      this.holdInteract = null;
      return;
    }
    const p = this.player;
    const look = p.lookDir;
    let best: Interactable | null = null;
    let bestScore = -1;
    for (const inter of this.interactables) {
      if (!inter.enabled()) continue;
      const dx = inter.pos.x - p.pos.x;
      const dz = inter.pos.z - p.pos.z;
      const dy = (inter.pos.y ?? 1) - (p.pos.y + 1.5);
      const d = Math.hypot(dx, dz, dy * 0.5);
      if (d > inter.radius) continue;
      let score = 1 - d / inter.radius;
      if (inter.requireLook !== false) {
        const len = Math.hypot(dx, dz) || 1;
        const dot = (dx / len) * look.x + (dz / len) * look.z;
        if (dot < 0.35) continue;
        score += dot * 0.5;
      }
      if (score > bestScore) {
        bestScore = score;
        best = inter;
      }
    }
    // recogidas automáticas (objetos de misión)
    const item = this.missions.itemAt(p.pos, 0.95);
    if (item) {
      this.pickupItem(item.id, item.kind);
    }
    if (best) {
      const holding = this.player.keys['KeyE'];
      if (best.holdTime) {
        if (holding) {
          if (!this.holdInteract || this.holdInteract.inter !== best) {
            this.holdInteract = { inter: best, progress: 0 };
          }
          this.holdInteract.progress += dt / best.holdTime;
          this.addNoise(p.pos.x, p.pos.z, 13);
          if (Math.random() < dt * 6) this.audio.repairClick();
          if (this.holdInteract.progress >= 1) {
            best.action();
            this.holdInteract = null;
            st.setPrompt(null);
          } else {
            st.setPrompt(`${best.holdLabel ?? 'HOLD E'} — [E]`, this.holdInteract.progress);
          }
        } else {
          if (this.holdInteract?.inter !== best) this.holdInteract = null;
          st.setPrompt(`${best.label} — hold [E]`);
        }
      } else {
        this.holdInteract = null;
        st.setPrompt(`${best.label} [E]`);
        if (this.interactPressed) {
          best.action();
          this.interactPressed = false;
        }
      }
    } else {
      if (this.holdInteract) this.holdInteract = null;
      if (st.prompt) st.setPrompt(null);
    }
    if (this.interactPressed) this.interactPressed = false;
  }

  private tryInteract() {
    this.interactPressed = true;
  }

  private pickupItem(id: string, kind: string) {
    this.missions.removeItem(id);
    this.audio.pickup();
    switch (kind) {
      case 'fuse':
        this.missions.fusesHeld++;
        this.missions.progressObjective('c2_fuses');
        this.notify(`Fuse acquired (${this.missions.fusesHeld})`);
        break;
      case 'token':
        this.missions.progressObjective('c2_tokens');
        this.notify('Golden token acquired');
        break;
      case 'battery':
        // v11: linterna infinita — las pilas del mapa ahora dan un impulso de energía al edificio
        this.power = Math.min(100, this.power + 12);
        this.notify('POWER +12%');
        break;
      case 'key':
        this.missions.hasKey = true;
        this.notify('MASTER KEY');
        break;
      case 'note': {
        const noteId = id.replace('_pick', '');
        const note = (storyData.notes as StoryNote[]).find((x) => x.id === noteId);
        if (note) {
          useHud.getState().setNote({ id: note.id, title: note.title, text: note.text });
        }
        break;
      }
      case 'tape': {
        const tape = (storyData.tapes as StoryTape[]).find((x) => x.id === id);
        if (tape) {
          useHud.getState().setNote({ id: tape.id, title: tape.title, text: tape.text });
          const save = addTape(tape.id);
          useHud.getState().setProgress(save.unlockedChapter, save.tapes);
        }
        if (this.chapter === 4) {
          this.missions.progressObjective('c4_tape');
        }
        break;
      }
    }
  }

  /* ============ LÓGICA DE CAPÍTULO ============ */

  notify(msg: string) {
    const st = useHud.getState();
    st.setAlert(msg);
    window.setTimeout(() => {
      if (useHud.getState().alert === msg) useHud.getState().setAlert(null);
    }, 3200);
  }

  private startCall(lines: string[]) {
    this.callQueue = [...lines];
    this.callLineIdx = 0;
    this.callLineTimer = 1.2;
    const totalDur = lines.reduce((s, l) => s + 2.2 + l.length * 0.036, 0);
    this.audio.phoneBeep();
    this.audio.startPhoneVoice(totalDur);
    // cargar la VOZ REAL (TTS) de las líneas de este capítulo
    this.callDurations = null;
    this.audio.loadCall(this.chapter).then((durs) => {
      if (durs && durs.length === lines.length && this.callQueue.length) {
        this.callDurations = durs;
      }
    });
    useHud.getState().syncHud({ callActive: true });
  }

  private updateCall(dt: number) {
    if (!this.callQueue.length) return;
    this.callLineTimer -= dt;
    if (this.callLineTimer <= 0) {
      const line = this.callQueue[this.callLineIdx];
      if (line !== undefined) {
        useHud.getState().setSubtitle(`☎ ${line}`);
        // voz REAL de Rulo (TTS) si está cargada
        const realDur = this.callDurations?.[this.callLineIdx];
        this.audio.playCallLine(this.callLineIdx);
        this.callLineTimer = realDur != null ? realDur + 0.55 : 2.2 + line.length * 0.036;
        this.callLineIdx++;
        if (this.callLineIdx >= this.callQueue.length) {
          const dur = this.callLineTimer;
          this.callQueue = [];
          window.setTimeout(() => {
            useHud.getState().setSubtitle(null);
            useHud.getState().syncHud({ callActive: false });
            this.audio.stopPhoneVoice();
            this.audio.stopCallVoice();
            this.audio.phoneBeep();
          }, dur * 1000);
        }
      }
    }
  }

  keypadSubmit(code: string) {
    const st = useHud.getState();
    const doorId = st.keypadDoor;
    if (!doorId) return;
    const door = this.world.doors.get(doorId);
    if (!door) return;
    if (code === (door.code ?? '1993')) {
      door.locked = false;
      this.nav.setDoorBlocked(doorId, false);
      door.open = true;
      door.targetAngle = door.baseAngle + door.swing * door.openAngle;
      this.audio.keypadBeep(true);
      this.audio.doorCreak(new THREE.Vector3(door.def.x, 1, door.def.z));
      st.setKeypad(null);
      this.notify('DOOR OPEN');
    } else {
      this.audio.keypadBeep(false);
      this.notify('Wrong code');
    }
  }

  closeNote() {
    useHud.getState().setNote(null);
    this.audio.pickup();
  }

  private addNoise(x: number, z: number, radius: number) {
    this.noises.push({ x, z, radius, worldTime: this.time });
    if (this.noises.length > 40) this.noises.shift();
  }

  /* ============ MUERTE Y VICTORIA ============ */

  private jumpscareStrobe: THREE.PointLight = new THREE.PointLight(0xff2233, 0, 6, 1.6);
  private pendingTrialRespawn = false;
  /** v13 — punto de salida al dejar el escondite (delante de la puerta) */
  private hideExit: THREE.Vector3 | null = null;

  private onDeath(ai: Animatronic) {
    if (this.mode !== 'playing') return;
    this.mode = 'dying';
    this.dyingAnimatronic = ai;
    this.deathTimer = 1.5;
    this.jumpscareTimer = 0;
    // GRITO FNAF: archivo real del repo (jumpscare.mp3) o sintético de respaldo
    if (!this.audio.playJumpscareFile()) this.audio.superScream(ai.def.voice);
    this.audio.setChase(false);
    this.audio.setStatic(0.0);
    useHud.getState().setJumpscare(ai.def.kind);
    useHud.getState().setTablet(false);
    this.player.setShake(1.6);
    this.holdInteract = null;
    useHud.getState().setPrompt(null);
    // ¿prueba activa? → respawn tras el jumpscare
    this.pendingTrialRespawn = !!this.trials.onPlayerCaught();
    // luz estroboscópica en la cara (creada en init; aquí solo se enciende)
    this.jumpscareStrobe.intensity = 40;
    // congelar al resto de animatrónicos (la escena es SUYA)
    for (const a of this.animatronics) {
      if (a !== ai) {
        a.currentSpeed = 0;
      }
    }
  }

  private updateDying(dt: number) {
    this.jumpscareTimer += dt;
    const ai = this.dyingAnimatronic;
    if (ai) {
      // EMBESTIDA FNAF: el modelo GLB se planta a 1.05 m de la cámara, cara a cara
      const cam = this.camera;
      const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
      fwd.y = 0;
      fwd.normalize();
      const eyeY = cam.position.y;
      const target = cam.position.clone().addScaledVector(fwd, 1.05);
      // espasmos violentos de posición (el clásico temblor FNAF)
      const jit = 0.09;
      target.x += (Math.random() - 0.5) * jit;
      target.z += (Math.random() - 0.5) * jit;
      ai.pos.set(target.x, 0, target.z);
      ai.rig.root.position.copy(ai.pos);
      // mirar SIEMPRE a la cámara
      const faceYaw = Math.atan2(cam.position.x - target.x, cam.position.z - target.z);
      ai.rig.root.rotation.y = faceYaw + (Math.random() - 0.5) * 0.08;
      ai.yaw = ai.rig.root.rotation.y;
      ai.poseDying(dt);
      // ojos al máximo: brillo feroz durante el agarre
      setEyeGlow(ai.rig, 1.6);
      for (const e of ai.rig.eyes) {
        const mats = Array.isArray(e.material) ? e.material : [e.material];
        for (const m of mats as THREE.MeshStandardMaterial[]) m.emissiveIntensity = 3.2;
      }
      // estrobo blanco/rojo en plena cara + luz frontal fija
      if (this.jumpscareStrobe) {
        const facePos = target.clone().addScaledVector(fwd, -0.35);
        facePos.y = eyeY + 0.15;
        this.jumpscareStrobe.position.copy(facePos);
        const strobe = Math.sin(this.jumpscareTimer * 55) > 0;
        this.jumpscareStrobe.intensity = strobe ? 30 : 60;
        this.jumpscareStrobe.color.setHex(strobe ? 0xff2233 : 0xffffff);
      }
      // cámara: FOV violento + giro de cabeza + sacudida
      this.camera.fov = 96;
      this.camera.updateProjectionMatrix();
      this.camera.rotation.z = (Math.random() - 0.5) * 0.24;
      this.player.setShake(1.5);
      // exposición pulsante
      if (this.renderer) {
        this.renderer.toneMappingExposure = 1.0 + Math.max(0, Math.sin(this.jumpscareTimer * 40)) * 1.6;
      }
    }
    this.deathTimer -= dt;
    if (this.deathTimer <= 0) {
      // apagar estrobo y restaurar cámara y ojos
      if (this.jumpscareStrobe) this.jumpscareStrobe.intensity = 0;
      if (ai) {
        setEyeGlow(ai.rig, 0.1);
        for (const e of ai.rig.eyes) {
          const mats = Array.isArray(e.material) ? e.material : [e.material];
          for (const m of mats as THREE.MeshStandardMaterial[]) m.emissiveIntensity = 1.2;
        }
      }
      this.camera.rotation.z = 0;
      this.camera.fov = 70;
      this.camera.updateProjectionMatrix();
      if (this.renderer) this.renderer.toneMappingExposure = 1.0;
      useHud.getState().setJumpscare(null);
      if (this.pendingTrialRespawn) {
        // RESPAWN de la prueba
        this.pendingTrialRespawn = false;
        this.mode = 'playing';
        useHud.getState().setMode('playing');
        useHud.getState().setSubtitle(null);
        this.audio.setStatic(0);
        this.trials.respawnPlayer();
        const t = this.trials;
        this.notify(`RESPAWNED — TRIAL RESET (ATTEMPT #${Math.max(1, t.attempts + 1)})`);
        this.player.setShake(0.4);
      } else {
        this.mode = 'dead';
        useHud.getState().setMode('dead');
        useHud.getState().setDead(ai ? ai.def.name : 'Algo');
        useHud.getState().setSubtitle(null);
        this.audio.setStatic(0.6);
        this.audio.setBreathing(false);
      }
    }
  }

  retryChapter() {
    this.audio.setStatic(0);
    useHud.getState().setDead(null);
    useHud.getState().setJumpscare(null);
    if (this.cine.active) this.cine.stop(false);
    this.startChapter(this.chapter);
  }

  /** fin de capítulo: cinemática de salida + pantalla de completado */
  private completeChapter() {
    if (this.chapterEndPending) return;
    this.chapterEndPending = true;
    this.audio.setChase(false);
    this.audio.setBreathing(false);
    const finish = () => {
      const save = unlockChapter(this.chapter + 1);
      useHud.getState().setProgress(save.unlockedChapter, save.tapes);
      this.mode = 'complete';
      useHud.getState().setMode('complete');
      useHud.getState().syncHud({ chapterComplete: true });
      this.audio.victory();
    };
    if (this.chapterDef.outroCinematic) {
      this.playCinematic(this.chapterDef.outroCinematic, finish);
    } else {
      finish();
    }
  }

  private finishGame(reason: 'escape') {
    if (this.mode !== 'playing') return;
    this.audio.setChase(false);
    this.audio.setBreathing(false);
    const save = loadSave();
    const ending = save.tapes.length >= 10 ? 'secret' : 'normal';
    const lines = ending === 'secret' ? storyData.endingSecret : storyData.endingNormal;
    addEnding(ending);
    const finale = () => {
      useHud.getState().setEnding(ending, lines);
      this.mode = 'ending';
      useHud.getState().setMode('ending');
      // tema musical del repo en la pantalla final
      this.audio.startThemeMusic();
    };
    if (this.chapterDef.outroCinematic) {
      this.playCinematic(this.chapterDef.outroCinematic, finale);
    } else {
      finale();
    }
  }

  returnToMenu() {
    if (this.cine.active) this.cine.stop(false);
    this.enterMenu();
  }

  pause() {
    if (this.mode !== 'playing') return;
    this.mode = 'paused';
    useHud.getState().setMode('paused');
    this.audio.suspend();
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
  }

  resume() {
    if (this.mode !== 'paused') return;
    this.mode = 'playing';
    useHud.getState().setMode('playing');
    this.audio.resume();
  }

  applySettings() {
    const s = useHud.getState().settings;
    this.audio.setVolumes(s.master, s.music, s.sfx);
    if (s.quality !== this.quality) {
      this.quality = s.quality;
      this.autoQuality = false;
      this.applyQuality();
    }
  }

  private applyQuality() {
    const dpr = window.devicePixelRatio || 1;
    // tope de 1.25 en alta: en pantallas retina 1.75-2.0 cuadruplica los píxeles
    const pr = this.quality === 'low' ? 0.7 : this.quality === 'medium' ? Math.min(1, dpr) : Math.min(1.25, dpr);
    this.renderer?.setPixelRatio(pr);
    this.composer?.setPixelRatio?.(pr);
    // el bloom solo en ALTA (y sombras completas); MEDIA conserva sombras de
    // la linterna sin post-procesado, BAJA lo apaga todo
    if (this.bloomPass) this.bloomPass.enabled = this.quality === 'high';
    if (this.renderPass) this.renderPass.enabled = this.quality !== 'low';
    if (this.player) {
      this.player.flashlight.castShadow = this.quality !== 'low';
      this.renderer.shadowMap.enabled = this.quality !== 'low';
    }
  }

  /* ============ BUCLE PRINCIPAL ============ */

  private render = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.render);
    const now = performance.now();
    let dt = (now - this.lastFrame) / 1000;
    this.lastFrame = now;
    if (dt > 0.06) dt = 0.06;
    if (dt <= 0) return;

    // auto-ajuste de calidad
    this.fpsAcc += dt;
    this.fpsCount++;
    if (this.fpsAcc > 1) {
      const fps = this.fpsCount / this.fpsAcc;
      this.fpsAcc = 0;
      this.fpsCount = 0;
      if (this.autoQuality && this.mode === 'playing') {
        if (fps < 32) this.fpsLowTime += 1;
        else this.fpsLowTime = Math.max(0, this.fpsLowTime - 0.5);
        if (this.fpsLowTime >= 5) {
          if (this.quality === 'high') this.quality = 'medium';
          else if (this.quality === 'medium') this.quality = 'low';
          this.applyQuality();
          this.fpsLowTime = 0;
        }
      }
    }

    if (this.mode === 'playing') {
      this.tick(dt);
    } else if (this.mode === 'dying') {
      this.updateDying(dt);
      this.world.update(dt, this.player.pos);
    } else if (this.mode === 'cinematic') {
      this.cine.update(dt);
      this.world.update(dt, this.camera.position);
      // v13 — los animatrónicos RESPIRAN durante las cinemáticas:
      // antes el juego no los actualizaba y quedaban en la T-pose de
      // fábrica del GLB. Sin IA: solo animación de reposo.
      for (const a of this.animatronics) a.poseIdle(dt);
    } else if (this.mode === 'menu' || this.mode === 'boot') {
      this.menuCamera(dt);
    } else if (this.mode === 'dead' || this.mode === 'complete' || this.mode === 'ending') {
      // escena congelada con la última cámara
      this.world.update(dt, this.camera.position);
    }

    // v7 — el infierno arde en TODOS los modos (también en cinemáticas)
    if (MEGA_FIRE?.enabled) MEGA_FIRE.update(dt, this.camera.position);

    if (this.audio.available) {
      this.audio.update(dt);
      if (this.mode !== 'cinematic') {
        this.audio.updateListener(this.camera.position, this.camera.quaternion);
      } else {
        this.audio.updateListener(this.camera.position, this.camera.quaternion);
      }
    }

    const st = useHud.getState();
    const tabletRendering = st.tabletOpen && this.mode === 'playing';
    // la tableta renderiza con más exposición (visión nocturna de las cámaras)
    this.renderer.toneMappingExposure = tabletRendering ? 3.0 : 1.0;
    // brazos del guardia en primera persona
    if (this.mode === 'playing') this.updateGuardArms(dt);
    const activeCam = tabletRendering ? this.cams.camera : this.camera;
    // v11: render con post-procesado (bloom) en alta calidad; directo en el resto.
    // RenderPass apunta a la cámara ACTIVA (tableta o jugador).
    if (this.composer && this.quality === 'high' && this.renderPass) {
      this.renderPass.camera = activeCam;
      this.composer.render();
    } else {
      this.renderer.render(this.scene, activeCam);
    }
  };

  private tick(dt: number) {
    if (!this.chapterDef || !this.missions) return;
    const st = useHud.getState();
    this.time += dt;

    // jugador (bloqueado si tablet/nota/teclado abiertos)
    const uiBlocked = st.tabletOpen || !!st.note || !!st.keypadDoor;
    if (!uiBlocked) {
      this.player.update(dt);
    } else {
      this.player.keys = {};
    }

    // IA host actualizado
    const host = this.animatronics[0]?.host;
    if (host) {
      host.time = this.time;
      host.chapter = this.chapter;
      host.chapterTime = this.time;
      host.aggression = this.chapterDef.aggression * (this.trials.active ? 1.25 : 1);
    }

    // animatrónicos (solo los del capítulo despiertan; el resto sigue dormido)
    const playerLike = this.player as unknown as PlayerLike;
    for (const a of this.animatronics) {
      if (!a.def.activeChapters.includes(this.chapter) && !a.active) {
        a.update(dt * 0.2, playerLike); // dormido: animación mínima
        continue;
      }
      a.update(dt, playerLike);
    }

    // eventos
    this.events.update(dt);
    this.events.checkKitchenNoise(this.time / 60);
    if (!this.events.callDone && this.chapterDef.radio && this.time / 60 >= this.chapterDef.radio.atMinute) {
      this.events.triggerCall(this.chapterDef.radio.lines);
    }
    this.updateCall(dt);

    // pruebas (trials): activación y efectos
    const room = this.world.roomIdAt(this.player.pos.x, this.player.pos.z);
    this.trials.update(dt, room);

    // objetivos de desplazamiento
    const othersDoneFor = (excludeId: string) =>
      this.missions.objectives
        .filter((o) => o.def.id !== excludeId && !o.def.optional && o.def.type !== 'survive')
        .every((o) => o.done);
    const gotoChecks: Array<[string, string, boolean]> = [
      ['c3_cove', 'pirateCove', true],
      ['c6_enter', 'techHall', false],
      // v12 — misiones más largas: puntos de patrulla por capítulo
      ['c1_storage', 'daycare', false],
      ['c1_arcade', 'arcade', false],
      ['c1_kitchen', 'kitchen', false],
      ['c2_prize', 'prize', false],
      ['c3_kitchen', 'kitchen', false],
      ['c3_arcade', 'arcade', false],
      ['c4_rockstar', 'rockstar', false],
      ['c4_theater', 'theater', false],
      ['c5_electrical', 'electrical', false],
      ['c5_techS', 'techS', false],
      ['c5_freezers', 'freezers', false],
      ['c6_storageN', 'storageN', false],
      ['c7_descend', 'megadaycare', false],
    ];
    for (const [objId, roomId, requireOthers] of gotoChecks) {
      const o = this.missions.objectives.find((x) => x.def.id === objId);
      if (!o || o.done || room !== roomId) continue;
      if (!requireOthers || othersDoneFor(o.def.id)) {
        this.missions.completeObjective(objId);
        // susto guionizado al llegar a la cala
        if (objId === 'c3_cove') {
          const foxy = this.animatronics.find((a) => a.def.id === 'foxy');
          if (foxy && !foxy.active) {
            this.audio.stinger();
            this.player.setShake(0.6);
            this.notify("SOMETHING MOVES BEHIND THE COVE'S CURTAIN...");
          }
        }
        if (objId === 'c6_enter') {
          this.audio.stinger();
          this.player.setShake(0.4);
          this.notify('THE TECHNICAL GALLERY — PITCH BLACK. LISTEN TO THE DOORS...');
        }
        // v12 — sustos guionizados al llegar a los nuevos puntos de patrulla
        if (objId === 'c1_storage') {
          this.audio.stinger();
          this.player.setShake(0.4);
          this.notify('THE WEST STORAGE — THE BOXES HAVE BEEN MOVING ON THEIR OWN...');
        }
        if (objId === 'c1_arcade') {
          this.audio.childLaugh(this.player.pos.clone());
          this.player.setShake(0.5);
          this.notify('A LAUGH RUNS THROUGH THE ARCADE — SOMETHING DROPPED A TOKEN');
        }
        if (objId === 'c3_kitchen') {
          this.audio.kitchenClatter(new THREE.Vector3(-20, 1, -26));
          this.player.setShake(0.5);
          this.notify('THE POTS ARE CLANGING IN THE DARK — SHE IS CLOSE');
        }
        if (objId === 'c5_techS') {
          this.audio.stinger();
          this.player.setShake(0.7);
          this.notify('THE GOLDEN SUIT STANDS IN THE CORNER — EMPTY... OR NOT');
        }
        if (objId === 'c7_descend') {
          this.audio.stinger();
          this.player.setShake(0.8);
          this.notify('THE HEAT BITES. THE SMOKE BREATHES. THE BASEMENT IS ALIVE');
        }
      }
    }

    // cap 1 — EL PRIMER TURNO: volver VIVO a la oficina cuando la ronda está completa
    if (this.chapter === 1) {
      const oExit = this.missions.objectives.find((x) => x.def.id === 'c1_office');
      if (oExit && !oExit.done && room === 'office') {
        const othersDone = this.missions.objectives
          .filter((x) => x.def.id !== 'c1_office' && !x.def.optional)
          .every((x) => x.done);
        if (othersDone) {
          this.missions.completeObjective('c1_office');
          this.notify('ROUND COMPLETE — 6:00 AM. RULO: "NOT BAD, ROOKIE..."');
        }
      }
    }

    // energía
    let drain = 0.045;
    if (st.tabletOpen) drain += 0.29;
    if (this.player.flashlightOn) drain += 0.05;
    if (this.player.running) drain += 0.06;
    this.power = Math.max(0, this.power - drain * dt);
    this.world.setPowerFactor(this.power > 25 ? 1 : this.power / 25);
    if (this.power <= 0) {
      // apagón total: solo quedan las rojas de emergencia
      if (!this.powerOut) {
        this.powerOut = true;
        // Marcha Toreador REAL de FNAF 1 mientras muere la luz
        this.audio.playToreador();
      }
      for (const r of this.world.rooms.values()) r.lightOn = false;
    } else if (this.powerOut && this.power > 30) {
      // red recuperada: vuelve la tenue luz de la oficina
      this.powerOut = false;
      const office = this.world.rooms.get('office');
      if (office) office.lightOn = true;
    }

    // puertas animadas (v8): giro determinista hacia la sala B con
    // aceleración inicial y desaceleración suave al llegar al objetivo
    for (const d of this.world.doors.values()) {
      const diff = d.targetAngle - d.angle;
      if (Math.abs(diff) > 0.0015) {
        const vmax = 2.9;                                     // rad/s
        const v = Math.min(vmax, 0.5 + Math.abs(diff) * 4.6); // ease-out
        d.angle += Math.sign(diff) * Math.min(Math.abs(diff), v * dt);
        d.group.rotation.y = d.angle;
        if (Math.abs(d.targetAngle - d.angle) < 0.0015) d.angle = d.targetAngle;
      }
      d.collider.active = !d.open && Math.abs(d.angle - d.baseAngle) < 0.45;
    }

    // tapas de conducto: Bonnie las tumba
    for (const v of this.world.vents.values()) {
      if (!v.coverClosed) continue;
      const bonnie = this.animatronics.find((a) => a.def.id === 'bonnie');
      if (bonnie && bonnie.active) {
        const px = v.def.coverAt === 'a' ? v.def.a[0] : v.def.b[0];
        const pz = v.def.coverAt === 'a' ? v.def.a[1] : v.def.b[1];
        const d = Math.hypot(bonnie.pos.x - px, bonnie.pos.z - pz);
        if (d < 1.6 && (bonnie.state === 'chase' || bonnie.state === 'hunt')) {
          v.coverTimer -= dt;
          if (v.coverTimer < 0 && Math.random() < dt * 1.4) {
            this.audio.ventBang({ x: px, y: 0.6, z: pz });
            v.coverTimer = 2.4;
          }
          if (Math.random() < dt * 0.11) {
            v.coverClosed = false;
            v.blocked = false;
            if (v.coverMesh) v.coverMesh.visible = false;
            if (v.coverCollider) v.coverCollider.active = false;
            this.nav.setVentBlocked(v.def.id, false);
            this.audio.doorSlam({ x: px, y: 0.6, z: pz });
            this.notify('VENT COVER KNOCKED DOWN!');
          }
        }
      }
    }

    // detección de escondites
    if (this.player.hidden) {
      for (const a of this.animatronics) {
        if (!a.active || a.state === 'dormant') continue;
        // v13 — si te VIO esconderte, ya lo maneja su IA (va a por ti).
        if (a.sawHideSpot) continue;
        const d = a.pos.distanceTo(this.player.pos);
        if (d < 2.0 && (a.state === 'search' || a.state === 'chase' || a.state === 'hunt')) {
          if (Math.random() < dt * 0.35) {
            const spot = mapData.hidingSpots.find((s) => s.id === this.player.hiddenSpotId);
            const exit = spot
              ? new THREE.Vector3(
                  spot.pos[0] + (spot.look[0] - spot.pos[0]) / (Math.hypot(spot.look[0] - spot.pos[0], spot.look[1] - spot.pos[1]) || 1) * 1.05,
                  0,
                  spot.pos[1] + (spot.look[1] - spot.pos[1]) / (Math.hypot(spot.look[0] - spot.pos[0], spot.look[1] - spot.pos[1]) || 1) * 1.05
                )
              : this.player.pos.clone();
            this.player.unhide(exit);
            a.state = 'chase';
            a.stateTimer = 0;
            this.notify('THEY FOUND YOU!');
            break;
          }
        }
      }
    }

    // peligro
    let danger = 0;
    let chase = false;
    for (const a of this.animatronics) {
      if (!a.active) continue;
      if (a.state === 'chase' || a.state === 'hunt' || a.state === 'attack') {
        chase = true;
        danger = Math.max(danger, 1);
      } else {
        const d = a.pos.distanceTo(this.player.pos);
        danger = Math.max(danger, Math.max(0, 1 - d / 14) * 0.5);
      }
    }
    this.danger = danger;
    this.audio.danger = danger;
    this.audio.setChase(chase);

    // mundo (luces); en modo tableta se impulsa la sala del feed
    this.world.camView = st.tabletOpen;
    const focus = st.tabletOpen ? this.cams.camera.position : this.player.pos;
    this.world.update(dt, focus);
    // v7 — daño por llamas (la animación del fuego vive en el render loop)
    if (MEGA_FIRE?.enabled && this.mode === 'playing') {
      const h = MEGA_FIRE.hazardAt(this.player.pos.x, this.player.pos.z);
      if (h > 0.5) {
        this.fireBurnT += dt;
        this.player.setShake(Math.max(0.5, h));
        if (this.fireBurnT > 0.45) {
          this.fireBurnT = 0;
          const luna = this.animatronics.find((a) => a.def.id === 'luna');
          if (luna) {
            this.notify('THE FLAMES WRAP AROUND YOU — AND MOON DRAGS YOU IN!');
            this.onDeath(luna);
          }
        }
      } else {
        this.fireBurnT = Math.max(0, this.fireBurnT - dt * 2);
      }
    }
    this.updateDust(dt);
    this.updateInteractions(dt);
    this.cams.update(dt, this.animatronics, st.tabletOpen);

    // fin de capítulo: todos los objetivos requeridos
    if (!this.chapterEndPending && this.missions.allRequiredDone()) {
      this.completeChapter();
      return;
    }

    // HUD a 10 Hz
    this.hudTimer -= dt;
    if (this.hudTimer <= 0) {
      this.hudTimer = 0.1;
      useHud.getState().syncHud({
        battery: this.player.flashlightBattery,
        stamina: this.player.stamina,
        power: this.power,
        maskOn: this.player.masked,
        flashlightOn: this.player.flashlightOn,
        crouching: this.player.crouching,
        inVent: this.player.inVent,
        danger,
        tabletGlitch: this.cams.glitchLevel > 0.55,
      });
    }
  }

  /* ============ LIMPIEZA ============ */

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    for (const [name, fn] of this.windowListeners) {
      window.removeEventListener(name, fn);
    }
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
    this.audio.stopThemeMusic();
    this.audio.suspend();
    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) m.dispose();
      }
    });
    disposeTextures();
    disposeMaterials();
    this.renderer?.dispose();
  }
}

function nextFrame(): Promise<void> {
  return new Promise((r) => requestAnimationFrame(() => r()));
}
